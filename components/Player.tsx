"use client"

import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import useKeyboardControls from "@/hooks/use-keyboard-controls"
import { RigidBody, CuboidCollider, useRapier, RapierRigidBody, interactionGroups } from "@react-three/rapier"
import { THREE } from "@/utils/three-singleton"
import useGameStore from "@/hooks/useGameStore"
import { useSoundEffects } from "@/hooks/useSoundEffects"
import useWeaponStore from "@/hooks/useWeaponStore"
import weapons from "@/data/weapons"
import { 
    GROUP_ENVIRONMENT, 
    GROUP_PLAYER, 
    GROUP_ENEMY_HITBOX, 
    GROUP_BULLET 
} from "@/lib/physicsConstants"

// Define muzzle flash state type
interface MuzzleFlashState {
  visible: boolean;
  intensity: number;
  color: string;
  timeoutId: NodeJS.Timeout | null;
}

export default function Player() {
  // Core references
  const playerRef = useRef<RapierRigidBody>(null)
  const playerColliderRef = useRef<any>(null)
  const modelRef = useRef<THREE.Group>(null)
  const gunRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const visorRef = useRef<THREE.Group>(null)
  const muzzleFlashLightRef = useRef<THREE.PointLight>(null); // Ref for the light

  // Rapier world and character controller
  const rapier = useRapier()
  const characterController = useMemo(() => {
    if (!rapier) return null;
    const controller = rapier.world.createCharacterController(0.1)
    controller.enableAutostep(0.4, 0.1, true);
    controller.enableSnapToGround(0.5);
    controller.setApplyImpulsesToDynamicBodies(true);
    return controller;
  }, [rapier])

  // Game state
  const { camera } = useThree()
  const keys = useKeyboardControls()
  const { 
    isGameOver, 
    health, 
    decreaseHealth, 
    setPlayerPosition, 
    setCameraAngle, 
    damageEnemy // Include damageEnemy if it might be uncommented later
  } = useGameStore(state => ({
    isGameOver: state.isGameOver,
    health: state.health,
    decreaseHealth: state.decreaseHealth,
    setPlayerPosition: state.setPlayerPosition,
    setCameraAngle: state.setCameraAngle,
    damageEnemy: state.damageEnemy, 
  }));
  const { 
    playPistolSound, playShotgunSound, playSmgSound, playRifleSound,
    playWeaponSwitchSound, playJumpSound, playLandSound, playZombieBiteSound,
    playAmbientMapNoiseSound, ambientMapNoiseBuffer,
    playAmbientMusic, ambientMusicBuffer,
    audioContextStarted
  } = useSoundEffects(state => ({ 
      playPistolSound: state.playPistolSound,
      playShotgunSound: state.playShotgunSound,
      playSmgSound: state.playSmgSound,
      playRifleSound: state.playRifleSound,
      playWeaponSwitchSound: state.playWeaponSwitchSound,
      playJumpSound: state.playJumpSound,
      playLandSound: state.playLandSound,
      playZombieBiteSound: state.playZombieBiteSound,
      playAmbientMapNoiseSound: state.playAmbientMapNoiseSound,
      ambientMapNoiseBuffer: state.ambientMapNoiseBuffer,
      playAmbientMusic: state.playAmbientMusic,
      ambientMusicBuffer: state.ambientMusicBuffer,
      audioContextStarted: state.audioContextStarted
  }))
  const {
    currentWeapon,
    isReloading,
    reload,
    setCurrentWeapon,
    availableWeapons,
    shoot,
    lastShotTime: storeLastShotTime,
  } = useWeaponStore()

  // Player state
  const [isMoving, setIsMoving] = useState(false)
  const [recoilAnimation, setRecoilAnimation] = useState(0)
  const [reloadAnimation, setReloadAnimation] = useState(0)
  const [weaponSwitchAnimation, setWeaponSwitchAnimation] = useState(0)
  const [breathingAnim, setBreathingAnim] = useState(0)
  const [lastShootTime, setLastShootTime] = useState(0)
  const [muzzleFlash, setMuzzleFlash] = useState<MuzzleFlashState>({ // Muzzle Flash state
    visible: false,
    intensity: 0,
    color: "#ffffff",
    timeoutId: null,
  });

  // Camera control
  const [mouseLookEnabled, setMouseLookEnabled] = useState(false)
  const cameraRotation = useRef({ x: 0, y: 0 })
  const targetCameraRotation = useRef({ x: 0, y: 0 })
  const lastCameraPosition = useRef(new THREE.Vector3())
  const targetCameraPosition = useRef(new THREE.Vector3())

  // Movement
  const verticalVelocityRef = useRef(0)
  const previousVerticalVelocityRef = useRef(0); // Added to store previous frame's Y velocity
  const isGrounded = useRef(true)
  const lastJumpTime = useRef(0)
  const lastPosition = useRef(new THREE.Vector3(0, 1.5, 0))

  // Animation
  const animationTime = useRef(0)
  const lastDamageTime = useRef(0)
  const damageInterval = 1000

  // Camera settings
  const CAMERA_DISTANCE = 4.5
  const CAMERA_HEIGHT = 4.0
  const CAMERA_SMOOTHING = 0.08
  const ROTATION_SMOOTHING = 0.95
  const MOUSE_SENSITIVITY = 0.002
  const MAX_PITCH = Math.PI / 2.5 // ~72 degrees
  const MIN_PITCH = -Math.PI / 4 // Increased downward look to -45 degrees
  // New constant for positional lerp
  const CAMERA_POS_LERP_FACTOR = 0.1 // Adjust for desired positional smoothing (higher = faster)

  // Movement settings
  const MOVE_SPEED = 8
  const SPRINT_MULTIPLIER = 1.5
  const JUMP_FORCE = 6
  const GRAVITY = -9.81
  const MOVEMENT_STOP_THRESHOLD = 200
  const SHOOT_COOLDOWN = 100

  // Character colors - Based on the reference image
  const BODY_COLOR = "#cc0000"
  const VISOR_COLOR = "#ff3a00"
  const CHEST_LIGHT_COLOR = "#ff3a00"
  const WEAPON_COLOR = "#2a2a2a"
  const WEAPON_ACCENT = "#444444"

  // Create shared materials for player parts to reduce draw calls
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: BODY_COLOR,
        roughness: 0.7,
        metalness: 0.3,
      }),
    [],
  )

  const visorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: VISOR_COLOR,
        roughness: 0.3,
        metalness: 0.5,
        emissive: VISOR_COLOR,
        emissiveIntensity: 2.0,
      }),
    [],
  )

  const chestLightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CHEST_LIGHT_COLOR,
        roughness: 0.3,
        metalness: 0.5,
        emissive: CHEST_LIGHT_COLOR,
        emissiveIntensity: 2.0,
      }),
    [],
  )

  const weaponMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: WEAPON_COLOR,
        roughness: 0.5,
        metalness: 0.5,
      }),
    [],
  )

  const weaponAccentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: WEAPON_ACCENT,
        roughness: 0.4,
        metalness: 0.6,
      }),
    [],
  )

  // Configure interaction masks using bitwise operations
  const playerCollisions = interactionGroups(
      1 << GROUP_PLAYER,         // Belongs to Player group
      1 << GROUP_ENVIRONMENT     // Interacts ONLY with Environment group
  );

  useEffect(() => {
    if (playerColliderRef.current) {
      playerColliderRef.current.userData = { type: 'player' };
    }
  }, []); // Run once on mount

  const bulletRayCollisions = interactionGroups(
      1 << GROUP_BULLET,         // Belongs to Bullet group
      (1 << GROUP_ENVIRONMENT) | (1 << GROUP_ENEMY_HITBOX) // Interacts with Environment AND Enemy Hitbox groups
  );

  // Handle mouse controls
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0 && !mouseLookEnabled) {
        const target = event.target as HTMLElement
        const isUIElement =
          target.closest("button") ||
          target.closest("input") ||
          target.closest('[role="button"]') ||
          target.closest(".pointer-events-auto")

        if (!isUIElement) {
          document.body.requestPointerLock()
        }
      }
    }

    const handlePointerLockChange = () => {
      setMouseLookEnabled(document.pointerLockElement !== null)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseLookEnabled || isGameOver) return

      targetCameraRotation.current.y -= event.movementX * MOUSE_SENSITIVITY
      targetCameraRotation.current.x += event.movementY * MOUSE_SENSITIVITY

      targetCameraRotation.current.x = Math.max(MIN_PITCH, Math.min(MAX_PITCH, targetCameraRotation.current.x))

      setCameraAngle(targetCameraRotation.current.y)
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("pointerlockchange", handlePointerLockChange)

    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("pointerlockchange", handlePointerLockChange)
    }
  }, [isGameOver, setCameraAngle, mouseLookEnabled])

  useEffect(() => {
    if (isGameOver && document.pointerLockElement) {
      document.exitPointerLock()
      setMouseLookEnabled(false)
    }
  }, [isGameOver])

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return

      if (e.key >= "1" && e.key <= "4") {
        const weaponIndex = Number.parseInt(e.key) - 1
        const weaponIds = ["pistol", "shotgun", "smg", "rifle"]
        const targetWeapon = weaponIds[weaponIndex]

        if (availableWeapons.includes(targetWeapon)) {
          setCurrentWeapon(targetWeapon)
          setWeaponSwitchAnimation(1)
          playWeaponSwitchSound()
        }
      }

      if (e.key === "r" || e.key === "R") {
        console.log("Reload key ('R') pressed");
        reload()
      }

      if (e.code === "Space" && isGrounded.current && performance.now() - lastJumpTime.current > 300) {
        verticalVelocityRef.current = JUMP_FORCE
        isGrounded.current = false
        playJumpSound()
        lastJumpTime.current = performance.now()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isGameOver, availableWeapons, setCurrentWeapon, reload, playWeaponSwitchSound, playJumpSound])

  // Define triggerRecoil simply
  const triggerRecoil = () => {
    setRecoilAnimation(1)
  }

  // --- Trigger Muzzle Flash --- 
  const triggerMuzzleFlash = useCallback(() => {
    if (!currentWeapon) return;
    const weaponData = weapons[currentWeapon];
    if (!weaponData?.muzzleFlash) return; // Check if muzzleFlash data exists

    // Clear previous timeout if any
    if (muzzleFlash.timeoutId) {
      clearTimeout(muzzleFlash.timeoutId);
    }

    setMuzzleFlash((prev) => ({
      ...prev,
      visible: true,
      intensity: weaponData.muzzleFlash.intensity, // Use original access
      color: weaponData.muzzleFlash.color,         // Use original access
      timeoutId: null // Clear timeout ID before setting new one
    }));

    // Set new timeout to hide the flash
    const timeoutId = setTimeout(() => {
      setMuzzleFlash((prev) => ({ ...prev, visible: false, timeoutId: null }));
    }, weaponData.muzzleFlash.duration); // Use duration from weapon data

    // Store the new timeout ID
    setMuzzleFlash((prev) => ({ ...prev, timeoutId }));

  }, [currentWeapon, muzzleFlash.timeoutId]); // Revert dependencies

  // Define handleShoot simply (no useCallback)
  const handleShoot = useCallback(() => { 
    const world = rapier.world; 
    const rapierInstance = rapier.rapier; // Keep this line
    if (!world || !rapierInstance || !playerRef.current) return false;

    if (isGameOver || !currentWeapon || isReloading) return false

    const now = performance.now()
    if (now - lastShootTime < SHOOT_COOLDOWN) {
      console.log("Shoot cooldown active");
      return false
    }

    const weaponData = weapons[currentWeapon]
    if (!weaponData) return false

    const shotSuccessful = shoot();
    if (!shotSuccessful) {
      console.log("Shoot failed (no ammo, reloading, or other issue)");
      return false
    }

    console.log("Processing successful shot");
    setLastShootTime(now) // Revert time setting

    try {
      switch (currentWeapon) {
        case "pistol": playPistolSound(); break;
        case "shotgun": playShotgunSound(); break;
        case "smg": playSmgSound(); break;
        case "rifle": playRifleSound(); break;
        default: console.warn(`No shoot sound for weapon: ${currentWeapon}`);
      }
    } catch (error) {
      console.warn("Failed to play shooting sound:", error)
    }

    triggerRecoil()
    triggerMuzzleFlash() // Revert call

    // --- Raycasting --- 
    const gunPosition = new THREE.Vector3()
    if (gunRef.current) {
      gunRef.current.getWorldPosition(gunPosition)
    } else if (playerRef.current) {
        const playerPos = playerRef.current.translation()
      gunPosition.set(playerPos.x, playerPos.y + 1.5, playerPos.z) // Fallback position
    }

    const rayOrigin = camera.position.clone();
    const rayDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const ray = new rapierInstance.Ray(rayOrigin, rayDirection); // Use rapierInstance
    const maxDistance = 200; // Revert max distance
    
    // Use the specific collision groups for the bullet ray
    const groups = bulletRayCollisions; // Apply correct group
    const hitData = world.castRayAndGetNormal(ray, maxDistance, true, groups);

    let targetPoint: THREE.Vector3;
    let hitEnemyId: number | null = null; // Variable to store hit enemy ID

    if (hitData) {
      const rapierHitPoint = ray.pointAt(hitData.timeOfImpact);
      targetPoint = new THREE.Vector3(rapierHitPoint.x, rapierHitPoint.y, rapierHitPoint.z);

      // Check if the hit collider belongs to an enemy
      const hitCollider = hitData.collider;
      const hitBody = hitCollider.parent(); // Get the RigidBody
      if (hitBody && typeof hitBody.userData === 'object' && hitBody.userData !== null && 'type' in hitBody.userData && hitBody.userData.type === 'enemy' && 'id' in hitBody.userData) {
        hitEnemyId = hitBody.userData.id as number; // Get the enemy ID
        console.log(`Bullet hit enemy ID: ${hitEnemyId}`);
        // Call game store function to damage enemy
        // *** REMOVE THE DAMAGE CALL FROM HERE ***
        // damageEnemy(hitEnemyId, weaponData.damage); 
      } else {
        console.log("Bullet hit non-enemy object or environment.");
        // Optionally: Play bullet impact sound/effect for environment hits
        // playBulletImpactSound({x: targetPoint.x, y: targetPoint.y, z: targetPoint.z});
      }
    } else {
      targetPoint = rayOrigin.clone().add(rayDirection.multiplyScalar(maxDistance));
      console.log("Bullet hit nothing.");
    }

    // --- Calculate Muzzle Position ---
    const cameraForwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const muzzleOffset = 0.5; // Offset distance from gun center along forward direction
    const muzzlePosition = gunPosition.clone().add(cameraForwardDirection.multiplyScalar(muzzleOffset));

    // Dispatch event (keep original)
    console.log("Dispatching playerShoot event", { position: muzzlePosition.toArray(), direction: rayDirection.toArray(), weapon: currentWeapon, damage: weaponData.damage, hitEnemyId: hitEnemyId })
    const shootEvent = new CustomEvent("playerShoot", {
      detail: {
            position: muzzlePosition,
            direction: rayDirection,
        weaponId: currentWeapon,
            damage: weaponData.damage,
            hitEnemyId: hitEnemyId
        }
    })
    window.dispatchEvent(shootEvent)

    return true; // Revert return
  }, [ 
    rapier.world, rapier.rapier,
    isGameOver, currentWeapon, isReloading, lastShootTime, SHOOT_COOLDOWN, shoot,
    playPistolSound, playShotgunSound, playSmgSound, playRifleSound, 
    triggerRecoil, triggerMuzzleFlash, camera.quaternion, camera.position,
    playerRef, gunRef, damageEnemy // Add refs used for position fallback/calculation
  ]);

  // useEffect for mousedown listener (calls the regular handleShoot function)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      console.log("Mouse down event detected", { button: e.button, mouseLookEnabled, isGameOver });
      if (e.button === 0 && mouseLookEnabled && !isGameOver) { 
        console.log("Calling handleShoot()...");
        handleShoot(); 
      }
    }
    window.addEventListener("mousedown", handleMouseDown)
    return () => {
      window.removeEventListener("mousedown", handleMouseDown)
    }
  }, [isGameOver, mouseLookEnabled, handleShoot])

  const handleCollision = (event: any) => {
    if (!isGameOver && health > 0) {
      decreaseHealth(10)

      const now = Date.now()
      if (now - lastDamageTime.current > damageInterval) {
        playZombieBiteSound()
        lastDamageTime.current = now
      }
    }
  }

  useEffect(() => {
    const handlePlayerZombieCollision = (e: CustomEvent) => {
      handleCollision(e)
    }

    window.addEventListener("playerZombieCollision", handlePlayerZombieCollision as EventListener)
    return () => {
      window.removeEventListener("playerZombieCollision", handlePlayerZombieCollision as EventListener)
    }
  }, [playZombieBiteSound])

  useEffect(() => {
    const breathingInterval = setInterval(() => {
      setBreathingAnim((prev) => (prev + 0.01) % 1)
    }, 16)

    return () => clearInterval(breathingInterval)
  }, [])

  const handleCollisionEnter = useCallback((event: any) => {
    console.log("Collision with:", event.other.rigidBodyObject, event.other.colliderObject?.userData);
    if (event.other.colliderObject?.userData?.type === 'zombie') {
      const now = Date.now()
      if (!isGameOver && health > 0) {
        decreaseHealth(10)
        if (now - lastDamageTime.current > damageInterval) {
          playZombieBiteSound()
          lastDamageTime.current = now
        }
      }
    }
  }, [isGameOver, health, decreaseHealth, playZombieBiteSound]);

  // --- Play Ambient Music Once Audio Context is Ready AND Buffer is Loaded --- 
  useEffect(() => {
    if (audioContextStarted && ambientMusicBuffer) { 
      console.log("Player: Audio context ready and buffer loaded, attempting to play ambient music.");
      playAmbientMusic();
    } else if (audioContextStarted && !ambientMusicBuffer) {
        console.log("Player: Audio context ready, waiting for ambient music buffer...");
    }
  }, [audioContextStarted, ambientMusicBuffer, playAmbientMusic]);

  // Adjust Camera FOV
  useEffect(() => {
    // Check if it's a PerspectiveCamera before setting FOV
    if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 85; // Increased from default (likely 75)
        camera.updateProjectionMatrix();
    }
  }, [camera]); // Run when camera object is available

  useFrame((state, delta) => {
    // console.log(`[Player useFrame] delta: ${delta.toFixed(6)}`); // TEMP DISABLED
    if (typeof window !== "undefined" && (window as any).startComponentTimer) {
      ;(window as any).startComponentTimer("Player")
    }

    const player = playerRef.current;
    if (!player) return;
    
    const currentPositionRapier = player.translation();

    if (currentPositionRapier.y < -10) {
      console.warn("Player Y position unexpectedly low:", currentPositionRapier.y);
      return;
    }

    const controller = characterController;
    const collider = playerColliderRef.current;

    if (isGameOver || !controller || !collider) {
      if (typeof window !== "undefined" && (window as any).endComponentTimer) {
        ;(window as any).endComponentTimer("Player")
      }
      return
    }

    // --- Play Periodic Ambient Map Noise (only if buffer is loaded) --- 
    if (ambientMapNoiseBuffer) { 
        playAmbientMapNoiseSound();
    }

    // --- Interpolate Camera Rotation --- 
    cameraRotation.current.x += (targetCameraRotation.current.x - cameraRotation.current.x) * ROTATION_SMOOTHING;
    let deltaY = targetCameraRotation.current.y - cameraRotation.current.y;
    deltaY = (deltaY + Math.PI) % (2 * Math.PI) - Math.PI;
    cameraRotation.current.y += deltaY * ROTATION_SMOOTHING;

    // --- Update Player Position --- (Based on moveDirection which uses cameraRotation.current.y)
    const playerPos = new THREE.Vector3(currentPositionRapier.x, currentPositionRapier.y, currentPositionRapier.z);
    const moveDirection = new THREE.Vector3() // Reset each frame
    const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.current.y)
    const rightVec = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.current.y)
    if (keys.forward) moveDirection.sub(forwardVec)
    if (keys.backward) moveDirection.add(forwardVec)
    if (keys.left) moveDirection.add(rightVec)
    if (keys.right) moveDirection.sub(rightVec)

    moveDirection.normalize() // Normalize the HORIZONTAL direction vector
    const speed = (keys.sprint ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED)
    moveDirection.multiplyScalar(speed) // Get desired HORIZONTAL velocity vector

    // --- Apply Gravity to Vertical Velocity --- 
    verticalVelocityRef.current += GRAVITY * delta; 

    // --- Calculate Final Displacement Vector for this Frame ---
    const displacement = new THREE.Vector3(
        moveDirection.x * delta, // Apply delta to horizontal velocity
        verticalVelocityRef.current * delta, // Apply delta to vertical velocity
        moveDirection.z * delta  // Apply delta to horizontal velocity
    );
    // console.log(`[Player useFrame Displacement]`, { x: displacement.x.toFixed(4), y: displacement.y.toFixed(4), z: displacement.z.toFixed(4), vVel: verticalVelocityRef.current.toFixed(3) }); // Optional log

    // --- Compute Movement with Collisions --- 
    // console.log(`%c[Player useFrame BEFORE Compute] Displacement Input:`, "color: teal", { x: displacement.x.toFixed(4), y: displacement.y.toFixed(4), z: displacement.z.toFixed(4) }); // TEMP DISABLED
    controller.computeColliderMovement(collider, displacement); // Pass the calculated displacement
    const correctedMovement = controller.computedMovement();
    // console.log(`%c[Player useFrame AFTER Compute] Corrected Output:`, "color: blue", { x: correctedMovement.x.toFixed(4), y: correctedMovement.y.toFixed(4), z: correctedMovement.z.toFixed(4) }); // TEMP DISABLED
    // console.log(`[Player useFrame Corrected]`, { x: correctedMovement.x.toFixed(4), y: correctedMovement.y.toFixed(4), z: correctedMovement.z.toFixed(4) }); // Optional log

    // --- Update Player Position using correctedMovement --- 
    const currentPosition = player.translation(); // Get current position
    const newPosition = {
        x: currentPosition.x + correctedMovement.x,
        y: currentPosition.y + correctedMovement.y, // Use corrected Y
        z: currentPosition.z + correctedMovement.z
    };
    player.setNextKinematicTranslation(newPosition);

    // --- Ground Check (based on controller's result) --- 
    const grounded = controller.computedGrounded();
    
    // Store previous vertical velocity before potential reset
    const previousVerticalVelocity = previousVerticalVelocityRef.current;
    previousVerticalVelocityRef.current = verticalVelocityRef.current; // Update for next frame's landing check

    if (grounded) {
        // Reset vertical velocity ONLY IF the movement correction didn't push us up significantly
        // (Prevents resetting velocity if stepping up or on slope)
        if (correctedMovement.y <= 0.01) { // Use a small threshold
            verticalVelocityRef.current = 0; 
        } else {
            // If corrected movement is upward while grounded, adjust velocity slightly
            // This can help prevent bouncing on uneven ground/steps
            verticalVelocityRef.current = correctedMovement.y / delta; 
        }
    }

    // --- Landing Sound --- 
    if (grounded && !isGrounded.current && previousVerticalVelocity < -1.0) { 
        console.log(`Landed with previous velocity: ${previousVerticalVelocity.toFixed(2)}`); 
        playLandSound(); 
    }
    isGrounded.current = grounded; // Update grounded state ref

    // --- Update Animation State (`isMoving`) --- 
    const isAnyMovementKeyPressed = keys.forward || keys.backward || keys.left || keys.right;
    const horizontalMovementMagnitude = Math.sqrt(correctedMovement.x**2 + correctedMovement.z**2);
    const shouldBeMoving = horizontalMovementMagnitude > 0.001 || isAnyMovementKeyPressed;
    if (shouldBeMoving !== isMoving) {
        setIsMoving(shouldBeMoving);
    }

    // --- Update Visuals & Camera --- 
    const newPositionThree = new THREE.Vector3(newPosition.x, newPosition.y, newPosition.z);
    setPlayerPosition(newPositionThree) // Update game store
    if (isMoving && isGrounded.current) { 
      const effectiveSpeed = horizontalMovementMagnitude / delta;
      animationTime.current += delta * (keys.sprint ? 15 : 10) * (effectiveSpeed / MOVE_SPEED); 
    }
    if (modelRef.current) {
      modelRef.current.rotation.y = cameraRotation.current.y
    }
    if (visorRef.current) {
      visorRef.current.position.y = 0.05 + Math.sin(breathingAnim * Math.PI * 2) * 0.005
    }
    const cameraOffset = new THREE.Vector3(
      -Math.sin(cameraRotation.current.y) * CAMERA_DISTANCE * Math.cos(cameraRotation.current.x),
      CAMERA_HEIGHT + CAMERA_DISTANCE * Math.sin(cameraRotation.current.x),
      -Math.cos(cameraRotation.current.y) * CAMERA_DISTANCE * Math.cos(cameraRotation.current.x),
    )
    targetCameraPosition.current = newPositionThree.clone().add(cameraOffset)
    camera.position.lerp(targetCameraPosition.current, CAMERA_POS_LERP_FACTOR);
    const lookTarget = newPositionThree.clone().add(new THREE.Vector3(0, 2.3, 0))
    camera.lookAt(lookTarget)

    // --- Gun Logic START ---
    if (gunRef.current && currentWeapon) {
      const weaponData = weapons[currentWeapon]
      if (!weaponData) return

      // Store the base aiming position
      const baseAimPosition = { x: 0.4, y: 1.1, z: 0.6 }; // Our fixed aiming position
      const baseAimRotation = { x: 0, y: 0, z: 0 }; // Base rotation (gun group has no static rotation)

      // --- Gun Recoil Animation --- 
      if (recoilAnimation > 0) {
        const recoilStrength = weaponData.recoil || 0.3;
        const recoilProgress = Math.sin(recoilAnimation * Math.PI);
        
        // Calculate rotation recoil (pitch up)
        const recoilX = recoilProgress * recoilStrength * 0.5; 

        // Apply ONLY the rotation recoil
        gunRef.current.rotation.x = baseAimRotation.x + recoilX; 
        // Keep base Y and Z rotation (should be 0 if not otherwise set)
        gunRef.current.rotation.y = baseAimRotation.y;
        gunRef.current.rotation.z = baseAimRotation.z;

        // Keep the base aiming POSITION (Commented out old position logic)
        gunRef.current.position.set(baseAimPosition.x, baseAimPosition.y, baseAimPosition.z);
        // const recoilY = recoilProgress * recoilStrength * 0.2;
        // const recoilZ = recoilProgress * recoilStrength * 0.1;
        // gunRef.current.position.y = baseAimPosition.y - recoilY; // OLD - Don't change Y pos
        // gunRef.current.position.z = baseAimPosition.z - recoilY * 3; // OLD - Don't change Z pos

        setRecoilAnimation(Math.max(0, recoilAnimation - delta * (8 / recoilStrength)));
      } else {
        // Reset rotation and position when recoil finishes
        gunRef.current.rotation.set(baseAimRotation.x, baseAimRotation.y, baseAimRotation.z);
        gunRef.current.position.set(baseAimPosition.x, baseAimPosition.y, baseAimPosition.z);
      }

      // --- Reload and Weapon Switch Animations (Keep existing position logic for now) ---
      // Note: These might also need adjustment if they interfere with the fixed aim pose.
      if (isReloading) {
        setReloadAnimation(Math.min(reloadAnimation + delta * 2, 1))
        gunRef.current.position.y =
          baseAimPosition.y - Math.abs(Math.sin(reloadAnimation * Math.PI)) * 0.2; // Adjust relative to base Y
      } else if (reloadAnimation > 0) {
        setReloadAnimation(Math.max(reloadAnimation - delta * 4, 0))
        gunRef.current.position.y =
          baseAimPosition.y - Math.abs(Math.sin(reloadAnimation * Math.PI)) * 0.2; // Adjust relative to base Y
      }

      if (weaponSwitchAnimation > 0) {
        setWeaponSwitchAnimation(Math.max(weaponSwitchAnimation - delta * 3, 0))
        gunRef.current.position.x =
          baseAimPosition.x + Math.abs(Math.sin(weaponSwitchAnimation * Math.PI)) * 0.2; // Adjust relative to base X
      }

      // Dispatch gun position update event
      if (gunRef.current) {
        const gunWorldPos = new THREE.Vector3()
        gunRef.current.getWorldPosition(gunWorldPos)
        const gunWorldDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
        window.dispatchEvent(
          new CustomEvent("gunPositionUpdate", {
            detail: {
              position: gunWorldPos,
              direction: gunWorldDir,
            },
          }),
        )
      }
    }

    // --- Update Muzzle Flash Position --- 
    if (muzzleFlashLightRef.current && gunRef.current) {
      const muzzleWorldPosition = new THREE.Vector3();
      // Get world position of the gun group
      gunRef.current.getWorldPosition(muzzleWorldPosition);
      // Calculate forward direction relative to camera/gun
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      // Offset the light slightly forward from the gun group origin
      muzzleWorldPosition.add(forward.multiplyScalar(0.7)); // Adjust offset as needed
      muzzleFlashLightRef.current.position.copy(muzzleWorldPosition);
    }

    if (typeof window !== "undefined" && (window as any).endComponentTimer) {
      ;(window as any).endComponentTimer("Player")
    }
  })

  return (
    <>
      {/* Muzzle Flash Light - Rendered outside the player RigidBody */} 
      <pointLight
        ref={muzzleFlashLightRef}
        visible={muzzleFlash.visible}
        intensity={muzzleFlash.intensity}
        color={muzzleFlash.color}
        distance={5} // How far the light reaches
        decay={2} // Standard decay
        castShadow={false} // No need for shadows from a quick flash
      />

    <RigidBody
      ref={playerRef}
        position={[0, 2.0, 0]}
        type="kinematicPosition"
      colliders={false}
        enabledRotations={[false, true, false]}
      canSleep={false}
        onCollisionEnter={handleCollisionEnter}
      >
        <CuboidCollider 
          ref={playerColliderRef} 
          args={[0.4, 0.9, 0.4]} 
          position={[0, 0.9, 0]} 
          collisionGroups={playerCollisions}
        />

        <group ref={modelRef} position={[0, 0.7, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.5, 0]} material={bodyMaterial}>
          <boxGeometry args={[0.6, 0.8, 0.4]} />
        </mesh>

          <mesh castShadow position={[0, 0.5, 0.21]} material={chestLightMaterial}>
          <boxGeometry args={[0.2, 0.2, 0.01]} />
        </mesh>

          <mesh castShadow receiveShadow position={[0, 0, 0]} material={bodyMaterial}>
          <boxGeometry args={[0.5, 0.3, 0.35]} />
        </mesh>

          <mesh castShadow position={[0.31, 0.5, 0]} material={weaponAccentMaterial}>
          <boxGeometry args={[0.05, 0.7, 0.35]} />
        </mesh>

          <mesh castShadow position={[-0.31, 0.5, 0]} material={weaponAccentMaterial}>
          <boxGeometry args={[0.05, 0.7, 0.35]} />
        </mesh>

          <mesh castShadow position={[0, 0.5, -0.21]} material={weaponAccentMaterial}>
          <boxGeometry args={[0.5, 0.7, 0.05]} />
        </mesh>

          <mesh castShadow position={[0.4, 0.8, 0]} material={weaponAccentMaterial}>
          <boxGeometry args={[0.25, 0.15, 0.35]} />
        </mesh>

          <mesh castShadow position={[-0.4, 0.8, 0]} material={weaponAccentMaterial}>
          <boxGeometry args={[0.25, 0.15, 0.35]} />
        </mesh>

        <group ref={headRef} position={[0, 1.1, 0]}>
            <mesh castShadow receiveShadow material={bodyMaterial}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
          </mesh>

            <mesh castShadow position={[0, 0.25, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.45, 0.2, 0.45]} />
          </mesh>

            <mesh castShadow position={[0.26, 0, 0]} material={weaponAccentMaterial}>
            <boxGeometry args={[0.05, 0.4, 0.4]} />
          </mesh>

            <mesh castShadow position={[-0.26, 0, 0]} material={weaponAccentMaterial}>
            <boxGeometry args={[0.05, 0.4, 0.4]} />
          </mesh>

            <mesh castShadow position={[0, 0, -0.26]} material={weaponAccentMaterial}>
            <boxGeometry args={[0.4, 0.4, 0.05]} />
          </mesh>

          <group ref={visorRef}>
              <mesh position={[0, 0, 0.26]} material={visorMaterial}>
              <boxGeometry args={[0.4, 0.1, 0.01]} />
            </mesh>
          </group>
        </group>

        <group
            position={[0.4, 0.7, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
        >
            <mesh castShadow receiveShadow position={[0, 0, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.2, 0.4, 0.2]} />
          </mesh>

            <mesh castShadow position={[0, -0.2, 0]} material={weaponAccentMaterial}>
            <boxGeometry args={[0.22, 0.1, 0.22]} />
          </mesh>

            <mesh castShadow position={[0, -0.4, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.2, 0.4, 0.2]} />
          </mesh>

            <mesh castShadow position={[0, -0.7, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.22, 0.2, 0.22]} />
          </mesh>
        </group>

        <group
          position={[-0.4, 0.5, 0]}
            rotation={[isGrounded.current ? (isMoving ? -Math.sin(animationTime.current) * 0.3 : 0) : -0.3, 0, 0]}
        >
            <mesh castShadow receiveShadow position={[0, 0, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.2, 0.4, 0.2]} />
          </mesh>

            <mesh castShadow position={[0, -0.2, 0]} material={weaponAccentMaterial}>
            <boxGeometry args={[0.22, 0.1, 0.22]} />
          </mesh>

            <mesh castShadow position={[0, -0.4, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.2, 0.4, 0.2]} />
          </mesh>

            <mesh castShadow position={[0, -0.7, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.22, 0.2, 0.22]} />
          </mesh>
        </group>

        <group
            position={[0.2, 0, 0]}
            rotation={[isGrounded.current ? (isMoving ? -Math.sin(animationTime.current) * 0.3 : 0) : -0.5, 0, 0]}
        >
            <mesh castShadow receiveShadow position={[0, 0, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.25, 0.4, 0.25]} />
          </mesh>

            <mesh castShadow position={[0, -0.4, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.25, 0.4, 0.25]} />
          </mesh>

            <mesh castShadow position={[0, -0.7, 0.05]} material={bodyMaterial}>
            <boxGeometry args={[0.25, 0.2, 0.35]} />
          </mesh>

            <mesh castShadow position={[0, -0.2, 0.15]} material={weaponAccentMaterial}>
            <boxGeometry args={[0.27, 0.15, 0.1]} />
          </mesh>
        </group>

        <group
            position={[-0.2, 0, 0]}
            rotation={[isGrounded.current ? (isMoving ? Math.sin(animationTime.current) * 0.3 : 0) : 0.5, 0, 0]}
        >
            <mesh castShadow receiveShadow position={[0, 0, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.25, 0.4, 0.25]} />
          </mesh>

            <mesh castShadow position={[0, -0.4, 0]} material={bodyMaterial}>
            <boxGeometry args={[0.25, 0.4, 0.25]} />
          </mesh>

            <mesh castShadow position={[0, -0.7, 0.05]} material={bodyMaterial}>
            <boxGeometry args={[0.25, 0.2, 0.35]} />
          </mesh>

            <mesh castShadow position={[0, -0.2, 0.15]} material={weaponAccentMaterial}>
            <boxGeometry args={[0.27, 0.15, 0.1]} />
          </mesh>
        </group>

        {currentWeapon && (
          <group
            ref={gunRef}
              position={[0.4, 1.1, 0.6]}
            scale={weapons[currentWeapon]?.model?.scale || 1}
          >
            {currentWeapon === "pistol" && (
              <>
                  <mesh castShadow receiveShadow material={weaponMaterial}>
                  <boxGeometry args={[0.15, 0.2, 0.4]} />
                </mesh>

                  <mesh castShadow position={[0, 0, 0.25]} material={weaponAccentMaterial}>
                  <boxGeometry args={[0.1, 0.1, 0.2]} />
                </mesh>

                  <mesh castShadow position={[0, -0.2, 0]} rotation={[0.3, 0, 0]} material={weaponMaterial}>
                  <boxGeometry args={[0.1, 0.2, 0.15]} />
                </mesh>
              </>
            )}

            {currentWeapon === "shotgun" && (
              <>
                  <mesh castShadow receiveShadow material={weaponMaterial}>
                  <boxGeometry args={[0.15, 0.15, 0.8]} />
                </mesh>

                  <mesh castShadow position={[0, 0, 0.5]} material={weaponAccentMaterial}>
                  <boxGeometry args={[0.15, 0.15, 0.4]} />
                </mesh>

                  <mesh castShadow position={[0, -0.1, -0.3]} rotation={[0.2, 0, 0]} material={weaponMaterial}>
                  <boxGeometry args={[0.12, 0.2, 0.3]} />
                </mesh>
              </>
            )}

            {currentWeapon === "smg" && (
              <>
                  <mesh castShadow receiveShadow material={weaponMaterial}>
                  <boxGeometry args={[0.12, 0.2, 0.6]} />
                </mesh>

                  <mesh castShadow position={[0, 0, 0.4]} material={weaponAccentMaterial}>
                  <boxGeometry args={[0.08, 0.08, 0.3]} />
                </mesh>

                  <mesh castShadow position={[0, -0.2, 0]} rotation={[0.3, 0, 0]} material={weaponMaterial}>
                  <boxGeometry args={[0.1, 0.2, 0.15]} />
                </mesh>

                  <mesh castShadow position={[0, -0.1, 0.1]} material={weaponAccentMaterial}>
                  <boxGeometry args={[0.1, 0.15, 0.2]} />
                </mesh>
              </>
            )}

            {currentWeapon === "rifle" && (
              <>
                  <mesh castShadow receiveShadow material={weaponMaterial}>
                  <boxGeometry args={[0.15, 0.15, 0.9]} />
                </mesh>

                  <mesh castShadow position={[0, 0, 0.6]} material={weaponAccentMaterial}>
                  <boxGeometry args={[0.1, 0.1, 0.4]} />
                </mesh>

                  <mesh castShadow position={[0, -0.1, -0.2]} rotation={[0.2, 0, 0]} material={weaponMaterial}>
                  <boxGeometry args={[0.12, 0.2, 0.3]} />
                </mesh>

                  <mesh castShadow position={[0, 0.15, 0.2]} material={weaponAccentMaterial}>
                  <boxGeometry args={[0.1, 0.1, 0.2]} />
                </mesh>
              </>
            )}
          </group>
        )}
      </group>
    </RigidBody>
    </>
  )
}
