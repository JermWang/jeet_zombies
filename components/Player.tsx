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

// NEW: Interface for Pickup UserData
interface PickupUserData {
    type: 'pickup';
    weaponId: string;
    pickupInstanceId: string;
}

// NEW: Type guard for PickupUserData
function isPickupUserData(userData: any): userData is PickupUserData {
    return (
        userData &&
        typeof userData === 'object' &&
        userData.type === 'pickup' &&
        typeof userData.weaponId === 'string' &&
        typeof userData.pickupInstanceId === 'string'
    );
}

// NEW: Interface for Ammo Pickup UserData
interface AmmoPickupUserData {
    type: 'ammoPickup';
    pickupInstanceId: string;
    amount: number;
}

// NEW: Type guard for AmmoPickupUserData
function isAmmoPickupUserData(userData: any): userData is AmmoPickupUserData {
    return (
        userData &&
        typeof userData === 'object' &&
        userData.type === 'ammoPickup' &&
        typeof userData.pickupInstanceId === 'string' &&
        typeof userData.amount === 'number'
    );
}

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
    damageEnemy,
    collectWeaponPickup,
    collectAmmoPickup,
    weaponPickups,
    ammoPickups,
  } = useGameStore(state => ({
    isGameOver: state.isGameOver,
    health: state.health,
    decreaseHealth: state.decreaseHealth,
    setPlayerPosition: state.setPlayerPosition,
    setCameraAngle: state.setCameraAngle,
    damageEnemy: state.damageEnemy,
    collectWeaponPickup: state.collectWeaponPickup,
    collectAmmoPickup: state.collectAmmoPickup,
    weaponPickups: state.weaponPickups,
    ammoPickups: state.ammoPickups,
  }));
  const { 
    playPistolSound, playShotgunSound, playSmgSound, playRifleSound,
    playWeaponSwitchSound, playJumpSound, playLandSound, playZombieBiteSound,
    playAmbientMapNoiseSound, playZombieAmbientSound,
    ambientMapNoiseBuffer, ambientMusicBuffer,
    playAmbientMusic, audioContextStarted,
    playItemPickupSound,
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
      playZombieAmbientSound: state.playZombieAmbientSound,
      ambientMapNoiseBuffer: state.ambientMapNoiseBuffer,
      ambientMusicBuffer: state.ambientMusicBuffer,
      playAmbientMusic: state.playAmbientMusic,
      audioContextStarted: state.audioContextStarted,
      playItemPickupSound: state.playItemPickupSound,
  }))
  const {
    currentWeapon,
    isReloading,
    reload,
    setCurrentWeapon,
    availableWeapons,
    shoot,
    lastShotTime: storeLastShotTime,
    addWeapon: addWeaponToStore,
    refuelAllWeapons,
  } = useWeaponStore()

  // Player state
  const [isMoving, setIsMoving] = useState(false)
  const [recoilAnimation, setRecoilAnimation] = useState(0)
  const [reloadAnimation, setReloadAnimation] = useState(0)
  const [weaponSwitchAnimation, setWeaponSwitchAnimation] = useState(0)
  const [breathingAnim, setBreathingAnim] = useState(0)
  const [lastShootTime, setLastShootTime] = useState(0)
  const lastInteractTime = useRef(0);
  const INTERACT_COOLDOWN = 300
  const PICKUP_RADIUS = 2.5;
  const [muzzleFlash, setMuzzleFlash] = useState<MuzzleFlashState>({
    visible: false,
    intensity: 0,
    color: "#ffffff",
    timeoutId: null,
  });
  const isFiringRef = useRef(false);

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

  // --- Moved Firing Logic Upwards to resolve linter errors ---
  const triggerRecoil = () => {
    setRecoilAnimation(1)
  }

  const triggerMuzzleFlash = useCallback(() => {
    if (!currentWeapon) return;
    const weaponData = weapons[currentWeapon];
    if (!weaponData?.muzzleFlash) return;
    if (muzzleFlash.timeoutId) {
      clearTimeout(muzzleFlash.timeoutId);
    }
    setMuzzleFlash((prev) => ({
      ...prev,
      visible: true,
      intensity: weaponData.muzzleFlash.intensity,
      color: weaponData.muzzleFlash.color,
      timeoutId: null 
    }));
    const timeoutId = setTimeout(() => {
      setMuzzleFlash((prev) => ({ ...prev, visible: false, timeoutId: null }));
    }, weaponData.muzzleFlash.duration);
    setMuzzleFlash((prev) => ({ ...prev, timeoutId }));
  }, [currentWeapon, muzzleFlash.timeoutId]);

  const handleShoot = useCallback(() => { 
    const world = rapier.world; 
    const rapierInstance = rapier.rapier;
    if (!world || !rapierInstance || !playerRef.current) return false;
    if (isGameOver || !currentWeapon || isReloading) return false;
    const weaponData = weapons[currentWeapon];
    if (!weaponData) return false;
    const dynamicShootCooldown = 1000 / weaponData.fireRate;
    const now = performance.now();
    if (now - lastShootTime < dynamicShootCooldown) {
      return false;
    }
    const shotSuccessful = shoot(); // From useWeaponStore
    if (!shotSuccessful) {
      return false;
    }
    setLastShootTime(now);
    try {
      // Sounds for SINGLE SHOT weapons triggered PER SHOT
      switch (currentWeapon) {
        case "pistol": playPistolSound(); break;
        case "shotgun": playShotgunSound(); break;
        // case "smg": playSmgSound(); break; // MOVED TO MOUSEDOWN
        // case "rifle": playRifleSound(); break; // MOVED TO MOUSEDOWN
        default: break; // Removed warning for potentially handled auto weapons
      }
    } catch (error) {
      console.warn("Failed to play single-shot shooting sound:", error);
    }
    triggerRecoil();
    triggerMuzzleFlash();
    const gunPosition = new THREE.Vector3();
    if (gunRef.current) {
      gunRef.current.getWorldPosition(gunPosition);
    } else if (playerRef.current) {
      const playerPos = playerRef.current.translation();
      gunPosition.set(playerPos.x, playerPos.y + 1.5, playerPos.z);
    }
    const rayOrigin = camera.position.clone();
    const rayDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const ray = new rapierInstance.Ray(rayOrigin, rayDirection);
    const maxDistance = 200;
    const groups = bulletRayCollisions;
    const hitData = world.castRayAndGetNormal(ray, maxDistance, true, groups);
    let targetPoint: THREE.Vector3;
    let hitEnemyId: number | null = null;
    if (hitData) {
      const rapierHitPoint = ray.pointAt(hitData.timeOfImpact);
      targetPoint = new THREE.Vector3(rapierHitPoint.x, rapierHitPoint.y, rapierHitPoint.z);
      const hitCollider = hitData.collider;
      const hitBody = hitCollider.parent();
      const userData = hitBody?.userData;
      if (userData && typeof userData === 'object' && userData !== null && 'type' in userData && userData.type === 'enemy' && 'id' in userData) {
        hitEnemyId = userData.id as number;
      }
    } else {
      targetPoint = rayOrigin.clone().add(rayDirection.multiplyScalar(maxDistance));
    }
    const cameraForwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const muzzleOffset = 0.5;
    const muzzlePosition = gunPosition.clone().add(cameraForwardDirection.multiplyScalar(muzzleOffset));
    const correctedBulletDirection = new THREE.Vector3().subVectors(targetPoint, muzzlePosition).normalize();
    const shootEvent = new CustomEvent("playerShoot", {
      detail: {
            position: muzzlePosition,
        direction: correctedBulletDirection,
        weaponId: currentWeapon,
            damage: weaponData.damage,
            hitEnemyId: hitEnemyId
        }
    });
    window.dispatchEvent(shootEvent);
    return true;
  }, [ 
    rapier.world, rapier.rapier, isGameOver, currentWeapon, isReloading, lastShootTime, shoot, 
    playPistolSound, playShotgunSound, triggerRecoil, triggerMuzzleFlash, 
    camera.quaternion, camera.position, playerRef, gunRef, damageEnemy
  ]);
  // --- End of Moved Firing Logic ---

  // Handle mouse controls (This useEffect now comes AFTER handleShoot is defined)
  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button === 0 && !mouseLookEnabled) {
        const target = event.target as HTMLElement;
        const isUIElement =
          target.closest("button") ||
          target.closest("input") ||
          target.closest('[role="button"]') ||
          target.closest(".pointer-events-auto");
        if (!isUIElement) {
          document.body.requestPointerLock();
        }
      }
    };

    const handlePointerLockChange = () => {
      setMouseLookEnabled(document.pointerLockElement !== null);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseLookEnabled || isGameOver) return;
      targetCameraRotation.current.y -= event.movementX * MOUSE_SENSITIVITY;
      targetCameraRotation.current.x += event.movementY * MOUSE_SENSITIVITY;
      targetCameraRotation.current.x = Math.max(MIN_PITCH, Math.min(MAX_PITCH, targetCameraRotation.current.x));
      setCameraAngle(targetCameraRotation.current.y);
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleGameMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && mouseLookEnabled && !isGameOver) { 
        const initialShotSuccess = handleShoot(); // Initial shot
        
        const weaponData = currentWeapon ? weapons[currentWeapon] : null;
        if (weaponData?.automatic) {
          isFiringRef.current = true;
          // Play the AUTOMATIC weapon sound ONCE on mousedown if the initial shot was successful
          if (initialShotSuccess) { 
              try {
                  switch (currentWeapon) {
                      case "smg": playSmgSound(); break;
                      case "rifle": playRifleSound(); break;
                      default: break; // Should already be handled by single-shot in handleShoot
                  }
              } catch (error) {
                  console.warn("Failed to play automatic shooting sound on mousedown:", error);
              }
          }
        } else if (!weaponData?.automatic && initialShotSuccess) {
            // Single-shot sounds are already handled within handleShoot itself
        }
      }
    };

    const handleGameMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isFiringRef.current = false;
        // NOTE: May need to add logic here to STOP looping sounds for SMG/Rifle if they are implemented that way
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown); // For pointer lock
    window.addEventListener("mousedown", handleGameMouseDown);     // For firing logic
    window.addEventListener("mouseup", handleGameMouseUp);         // For firing logic
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("mousedown", handleGameMouseDown);
      window.removeEventListener("mouseup", handleGameMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [isGameOver, setCameraAngle, mouseLookEnabled, handleShoot, currentWeapon, rapier, playSmgSound, playRifleSound]); // Added sound functions to deps

  useEffect(() => {
    if (isGameOver && document.pointerLockElement) {
      document.exitPointerLock()
      setMouseLookEnabled(false)
    }
  }, [isGameOver])

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return;

      // Log the state of availableWeapons when a key is pressed
      console.log('[handleKeyDown] Key pressed:', e.key, 'Current availableWeapons:', availableWeapons);

      if (e.key >= "1" && e.key <= "9") { // Allow up to 9 weapon slots potentially
        const weaponSlotIndex = Number.parseInt(e.key) - 1; // 0-indexed slot
        
        // Use the live availableWeapons array from the store
        if (weaponSlotIndex >= 0 && weaponSlotIndex < availableWeapons.length) {
          const targetWeapon = availableWeapons[weaponSlotIndex];
          console.log(`[handleKeyDown] Slot ${e.key} corresponds to weapon: ${targetWeapon}`); // Log the target weapon
          if (targetWeapon && targetWeapon !== currentWeapon) { // Check if different to avoid unnecessary sound/animation
            console.log(`[handleKeyDown] Switching to weapon: ${targetWeapon}`); // Log the switch attempt
            setCurrentWeapon(targetWeapon);
            setWeaponSwitchAnimation(1);
            playWeaponSwitchSound();
          }
        } else {
          console.log(`No weapon in slot ${e.key}`);
        }
      }

      if (e.key === "r" || e.key === "R") {
        console.log("Reload key ('R') pressed");
        reload();
      }

      if (e.code === "Space" && isGrounded.current && performance.now() - lastJumpTime.current > 300) {
        verticalVelocityRef.current = JUMP_FORCE;
        isGrounded.current = false;
        playJumpSound();
        lastJumpTime.current = performance.now();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGameOver, availableWeapons, currentWeapon, setCurrentWeapon, reload, playWeaponSwitchSound, playJumpSound]); // Added currentWeapon back to deps as it's used in the comparison

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
    // Call other periodic ambient sounds here too
    if (audioContextStarted) {
      playAmbientMapNoiseSound();
      playZombieAmbientSound(); // Call the new zombie ambient sound
    }
  }, [audioContextStarted, ambientMusicBuffer, playAmbientMusic, playAmbientMapNoiseSound, playZombieAmbientSound]);

  // Adjust Camera FOV
  useEffect(() => {
    // Check if it's a PerspectiveCamera before setting FOV
    if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 85; // Increased from default (likely 75)
        camera.updateProjectionMatrix();
    }
  }, [camera]); // Run when camera object is available

  // Use useFrame for game logic, physics, and camera updates
  useFrame((state, delta) => {
    if (isGameOver) {
      if (playerRef.current) {
        playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true); // Stop movement
        playerRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true); // Stop rotation
      }
      // Optionally, disable pointer lock if it was enabled
      if (mouseLookEnabled && document.pointerLockElement) { // Only exit if it was active
        document.exitPointerLock();
      }
      return; // Skip all other player logic
    }

    // --- Automatic Firing in useFrame ---
    if (isFiringRef.current && currentWeapon) {
        const weaponData = weapons[currentWeapon];
        if (weaponData?.automatic) {
            handleShoot(); // Attempt to shoot, handleShoot itself respects fireRate
        }
    }
    // --- End Automatic Firing ---

    const now = Date.now();

    // Interaction (E key)
    if (keys.interact && playerRef.current) {
      // console.log("[Player Interact Attempt] E pressed, keys.interact:", keys.interact); // DEBUG
      if (now - lastInteractTime.current > INTERACT_COOLDOWN) {
        // console.log("[Player Interact] Cooldown passed, attempting proximity check."); // DEBUG
        lastInteractTime.current = now;

        const playerPositionVec = playerRef.current.translation();
        const playerPos = new THREE.Vector3(playerPositionVec.x, playerPositionVec.y, playerPositionVec.z);

        let closestItem: { id: string; distance: number; type: 'weapon' | 'ammo' } | null = null;

        // Check weapon pickups
        weaponPickups.forEach(pickup => {
          if (!pickup.collected) {
            const pickupPos = new THREE.Vector3(...pickup.position);
            const distance = playerPos.distanceTo(pickupPos);
            if (distance < PICKUP_RADIUS) {
              if (!closestItem || distance < closestItem.distance) {
                closestItem = { id: pickup.id, distance, type: 'weapon' };
              }
            }
          }
        });

        // Check ammo pickups
        ammoPickups.forEach(pickup => {
          if (!pickup.collected) {
            const pickupPos = new THREE.Vector3(...pickup.position);
            const distance = playerPos.distanceTo(pickupPos);
            if (distance < PICKUP_RADIUS) {
              if (!closestItem || distance < closestItem.distance) {
                closestItem = { id: pickup.id, distance, type: 'ammo' };
              }
            }
          }
        });

        if (closestItem) {
          const currentClosestItem = closestItem as { id: string; distance: number; type: 'weapon' | 'ammo' }; // Intermediate constant for clearer type inference
          // console.log(`[Player Interact] Found closest item: ${currentClosestItem.type} ID: ${currentClosestItem.id} at distance: ${currentClosestItem.distance}`); // DEBUG
          if (currentClosestItem.type === 'weapon') {
            collectWeaponPickup(currentClosestItem.id);
            const weapon = weaponPickups.find(wp => wp.id === currentClosestItem.id); // Use currentClosestItem
            if (weapon) {
                console.log(`[Player Action] Picked up weapon: ${weapon.weaponId}`);
                addWeaponToStore(weapon.weaponId); // Also add to weapon store if not already present
                setCurrentWeapon(weapon.weaponId); // Switch to the new weapon
                playItemPickupSound();
            }
          } else if (currentClosestItem.type === 'ammo') {
            collectAmmoPickup(currentClosestItem.id);
            const ammo = ammoPickups.find(ap => ap.id === currentClosestItem.id); // Use currentClosestItem
            if (ammo) {
                console.log(`[Player Action] Picked up ammo: ${ammo.type}, Amount: ${ammo.amount}`);
                refuelAllWeapons(ammo.amount); // Example: refuel current weapon, or all by specific type
                playItemPickupSound();
            }
          }
        } else {
          // console.log("[Player Interact] No items in pickup radius."); // DEBUG
        }
      }
    }

    animationTime.current += delta
    const time = state.clock.elapsedTime

    const player = playerRef.current
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
              <group position={[0, 0, 0.1]}>
                <mesh castShadow receiveShadow material={weaponMaterial}>
                  <boxGeometry args={[0.15, 0.15, 0.8]} />
                </mesh>

                <mesh castShadow position={[0, 0, 0.5]} material={weaponAccentMaterial}>
                  <boxGeometry args={[0.15, 0.15, 0.4]} />
                </mesh>

                <mesh castShadow position={[0, -0.1, -0.3]} rotation={[0.2, 0, 0]} material={weaponMaterial}>
                  <boxGeometry args={[0.12, 0.2, 0.3]} />
                </mesh>
              </group>
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
