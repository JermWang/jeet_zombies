"use client"

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore, { EnemyState } from '@/hooks/useGameStore';
// Removed: import usePhysicsWorker from '@/hooks/usePhysicsWorker';
import { useRapier, RapierRigidBody, interactionGroups, CollisionPayload } from '@react-three/rapier';
import ZombieModel from './ZombieModel';
import { getEnemyConfig } from '@/data/enemies';
import { Vector3 as RapierVector3, Ray } from '@dimforge/rapier3d-compat';
import { shallow } from 'zustand/shallow';

// NEW: Import useSoundEffects hook
import { useSoundEffects } from "@/hooks/useSoundEffects";

// --- Import Collision Groups ---
import { 
    GROUP_ENVIRONMENT, 
    GROUP_PLAYER, 
    GROUP_ENEMY_HITBOX, 
    GROUP_BULLET 
    // GROUP_ENEMY_SENSOR removed as it wasn't defined
} from "@/lib/physicsConstants";

// Constants
const ZOMBIE_SPEED = 1.5; // This might be overridden by config later
const IDLE_DISTANCE_THRESHOLD = 7; // Keep for potential future use? Or remove?
const ATTACK_DISTANCE_THRESHOLD = 1.8; // Might be overridden by config
const MAX_ZOMBIES_VISUAL = 50; // Match the pool size for visual instances
const ZOMBIE_SCALE = 1.0; // Might need adjustment for native geometry
const INITIAL_SPAWN_RADIUS = 10; // Radius for initial scattering

// --- Attack Constants (NEW) ---
const DEFAULT_ATTACK_DAMAGE = 10;
const DEFAULT_ATTACK_COOLDOWN = 2; // seconds

// --- NEW Stuck/Jump Constants ---
const STUCK_TIME_THRESHOLD = 1.5; // seconds before trying a jump if stuck
const STUCK_DISTANCE_THRESHOLD_SQ = 0.1 * 0.1; // Squared distance, e.g., 0.1 units
const JUMP_COOLDOWN = 3.0; // seconds between anti-stuck jumps
const JUMP_IMPULSE_STRENGTH = 8.0; // How strong the jump is

// --- NEW Wall "Climb" Constants ---
const CLIMB_MIN_PLAYER_HEIGHT_ADVANTAGE = 1.0; // Player needs to be at least this much higher
const CLIMB_JUMP_COOLDOWN = 4.0; // Cooldown for wall climb attempts
const CLIMB_JUMP_UP_IMPULSE = 10.0; // Stronger than normal stuck jump
const CLIMB_JUMP_FORWARD_IMPULSE_SCALE = 0.5; // Multiplied by zombieSpeed for forward push

// Zombie hitbox collision group config
const enemyHitboxCollisions = interactionGroups(
    1 << GROUP_ENEMY_HITBOX, // Belongs to Enemy Hitbox group (2)
    (1 << GROUP_ENVIRONMENT) | (1 << GROUP_BULLET) // Mask: Interacts with Environment (0) OR Bullet (3)
);

// Helper function to get random spawn position
function getRandomSpawnPosition(radius: number): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return new THREE.Vector3(x, 0, z); // Spawn at ground level (Y=0 initially)
}

// --- NEW PROPS INTERFACE ---
interface ActiveZombieProps {
    id: number;
    type: string;
    initialPosition: THREE.Vector3; // Use a specific prop for initial position
    isHit: boolean | undefined;
    playerPosition: THREE.Vector3; // Changed from nullable
    rapier: ReturnType<typeof useRapier>;
}

// --- UPDATED ActiveZombie Component ---
const ActiveZombie = React.memo(function ActiveZombie({ id, type, initialPosition, isHit, playerPosition, rapier }: ActiveZombieProps) {
    // Render Guard - Allow ID 0 if not a boss
    if (type === 'zombie_boss') { // MODIFIED: Removed "id === 0 ||"
        // console.log(`%c[ActiveZombie Render Guard] ID ${id} (${type}) is boss type. Returning null immediately.`, "color: orange; font-weight: bold");
        return null;
    }

    const groupRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<RapierRigidBody | null>(null);
    const lastAttackTimeRef = useRef(0); // NEW: For attack cooldown
    const leftLegRef = useRef<THREE.Object3D>(null);
    const rightLegRef = useRef<THREE.Object3D>(null);
    const leftArmRef = useRef<THREE.Object3D>(null);
    const rightArmRef = useRef<THREE.Object3D>(null);

    // --- NEW Refs for Stuck/Jump Logic ---
    const lastPositionRef = useRef<THREE.Vector3 | null>(null);
    const timeBecameStuckRef = useRef<number | null>(null);
    const lastJumpTimeRef = useRef(0);
    const lastWallClimbTimeRef = useRef(0); // NEW: Ref for wall climb cooldown

    // Config memoization - Use type prop
    const config = useMemo(() => getEnemyConfig(type), [type]);

    // NEW: Get decreaseHealth from game store
    const decreaseHealth = useGameStore((state) => state.decreaseHealth);
    // NEW: Get playZombieBiteSound from sound effects hook
    const playZombieBiteSound = useSoundEffects((state) => state.playZombieBiteSound);

    // --- Effect to Create Rapier Body ---
    useEffect(() => {
        console.log(`%c[ActiveZombie Physics Effect RUN] ID: ${id}, Type: ${type}. bodyRef.current is initially: ${bodyRef.current ? 'SET' : 'NULL'}. Rapier valid: ${!!(rapier && rapier.world)}`, "color: yellow");
        
        if (!rapier || !rapier.world || id === null || !config) { // id can be 0 now
            console.log(`%c[ActiveZombie Physics Effect] ID: ${id} - Conditions (rapier, id, config) not met. Aborting effect.`, "color: orange");
            return;
        }
        // This zombie_boss check is redundant if filtered out by parent, but good as a safeguard
        if (type === 'zombie_boss') { 
            console.log(`%c[ActiveZombie Physics Effect] ID: ${id} is zombie_boss type. Aborting effect.`, "color: orange");
            return;
        }

        if (bodyRef.current) { // If body already exists for this instance
            console.log(`%c[ActiveZombie Physics Effect] ID: ${id} - Body already exists (ref is SET). SKIPPING body creation.`, "color: green");
            // This case should ideally not be hit frequently if deps are correct and stable.
            // If rapier changed, we *should* be re-creating. So this log might indicate an issue if rapier is in deps and it still hits this.
            // However, the cleanup function from the *previous* effect instance should have run.
            return; 
        }
        
        console.log(`%c[ActiveZombie Physics Effect] ID: ${id} - Creating NEW Rapier body.`, "color: cyan");
        const spawnPos = initialPosition;

        const rigidBodyDesc = rapier.rapier.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setUserData({ type: 'enemy', enemyType: type, id: id }) // Use props
            .lockRotations();
        const rapierBody = rapier.world.createRigidBody(rigidBodyDesc);
        bodyRef.current = rapierBody;

        let colliderDesc: any;
        if (config.colliderType === 'capsule') {
            const [radius, height] = config.hitboxArgs as [number, number];
            colliderDesc = rapier.rapier.ColliderDesc.capsule(height / 2, radius);
        } else {
            const [hx, hy, hz] = config.hitboxArgs as [number, number, number];
            colliderDesc = rapier.rapier.ColliderDesc.cuboid(hx, hy, hz);
        }
        colliderDesc
            .setTranslation(0, config.hitboxOffsetY, 0)
            .setActiveEvents(rapier.rapier.ActiveEvents.COLLISION_EVENTS)
            .setCollisionGroups(enemyHitboxCollisions);
        rapier.world.createCollider(colliderDesc, rapierBody);

        return () => {
            const bodyToRemove = bodyRef.current;
            console.log(`%c[ActiveZombie Physics CLEANUP START] ID: ${id}. bodyRef was ${bodyToRemove ? 'SET' : 'NULL'}.`, "color: red");
            if (bodyToRemove && rapier.world) {
                try {
                    rapier.world.removeRigidBody(bodyToRemove);
                    console.log(`%c[ActiveZombie Physics CLEANUP] Successfully removed RB for Enemy ID ${id}.`, "color: red");
                } catch (error) {
                    console.error(`[ActiveZombie Physics CLEANUP] Error removing RB for Enemy ID ${id}:`, error);
                }
            }
            bodyRef.current = null; // Explicitly nullify on cleanup
            console.log(`%c[ActiveZombie Physics CLEANUP END] ID: ${id}. bodyRef is now NULL.`, "color: red");
        };
    }, [id, type, config]); // REVERTED: Removed `rapier` from deps, as per user's observation of instability

    // --- Re-enable useFrame Hook ---
    useFrame((state, delta) => {
        const rapierBodyApi = bodyRef.current;
        const world = rapier?.world; 

        // --- Start Debug Logs ---
        if (!rapierBodyApi) {
            // console.log(`[Zombie ${id} useFrame] EXIT: No rapierBodyApi`); // Potentially too noisy
            return;
        }
        // console.log(`[Zombie ${id} useFrame] RUNNING. Body Pos: ${rapierBodyApi.translation().x.toFixed(1)},${rapierBodyApi.translation().y.toFixed(1)},${rapierBodyApi.translation().z.toFixed(1)}`); // Potentially too noisy
        // --- End Debug Logs ---

        if (!groupRef.current || !playerPosition || !config || !world) { // Added world check here too
            console.log(`[Zombie ${id} useFrame] EXIT: Missing refs, playerPos, config, or world.`);
            return;
        }

        const currentTime = state.clock.elapsedTime;
        const currentPositionVec = rapierBodyApi.translation(); 
        groupRef.current.position.copy(currentPositionVec as unknown as THREE.Vector3); 
        groupRef.current.position.y += config.visualYOffset; 

        const lookAtPos = new THREE.Vector3(playerPosition.x, currentPositionVec.y + config.visualYOffset, playerPosition.z);
        groupRef.current.lookAt(lookAtPos);

        const currentPositionTHREE = new THREE.Vector3(currentPositionVec.x, currentPositionVec.y, currentPositionVec.z);
        const distanceToPlayer = currentPositionTHREE.distanceTo(playerPosition);

        let desiredVelocity = new THREE.Vector3(0, 0, 0);
        const zombieSpeed = config.speed || ZOMBIE_SPEED;
        const attackRange = config.attackRange || ATTACK_DISTANCE_THRESHOLD;

        // 1. Calculate Base Desired Velocity (towards player)
        if (distanceToPlayer > attackRange) {
            const direction = new THREE.Vector3().subVectors(playerPosition, currentPositionTHREE).normalize();
            desiredVelocity.set(direction.x, 0, direction.z).multiplyScalar(zombieSpeed);
         } else {
            // Attack Logic
            desiredVelocity.set(0, 0, 0); 
            if (currentTime - lastAttackTimeRef.current > DEFAULT_ATTACK_COOLDOWN) {
                let actualDamage = DEFAULT_ATTACK_DAMAGE;
                if (config.minDamage !== undefined && config.maxDamage !== undefined) {
                    actualDamage = Math.floor(Math.random() * (config.maxDamage - config.minDamage + 1)) + config.minDamage;
                } else if (config.minDamage !== undefined) { 
                    actualDamage = config.minDamage;
                }
                // console.log(`%c[ActiveZombie ATTACK] ID: ${id} dealing ${actualDamage} damage...`, "color: red; font-weight: bold;"); // Keep console less noisy
                decreaseHealth(actualDamage);
                 playZombieBiteSound(); 
                lastAttackTimeRef.current = currentTime;
            }
        }
        // --- Debug Log: Desired Velocity BEFORE avoidance ---
        // console.log(`[Zombie ${id} useFrame] Desired Vel BEFORE Avoidance: x=${desiredVelocity.x.toFixed(2)}, z=${desiredVelocity.z.toFixed(2)}`);

        // 2. Obstacle Avoidance Steering (only if moving)
        const currentLinvel = rapierBodyApi.linvel();
        const isMovingIntent = desiredVelocity.lengthSq() > 0.01;
        let steered = false;
        let attemptedWallClimb = false; // NEW: Flag to skip normal steering if climb happens

        if (isMovingIntent) {
            const probeDistance = 1.5; 
            const whiskerAngle = Math.PI / 6; // 30 degrees for whiskers
            
            const desiredDirTHREE = desiredVelocity.clone().normalize();
            const origin = new RapierVector3(currentPositionVec.x, currentPositionVec.y + config.hitboxOffsetY, currentPositionVec.z);
            
            const raycastGroups = interactionGroups((1 << 5), (1 << GROUP_ENVIRONMENT));
            const filterCollider = rapierBodyApi.collider(0); 
            const solid = true;

            let avoidanceVector = new THREE.Vector3(0,0,0);
            let hitDetected = false;

            // --- Ray definitions ---
            const rays = [
                { name: "center", dir: desiredDirTHREE.clone() },
                {
                    name: "left",
                    dir: desiredDirTHREE.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), whiskerAngle)
                },
                {
                    name: "right",
                    dir: desiredDirTHREE.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -whiskerAngle)
                }
            ];

            // --- Cast rays and accumulate avoidance ---
            for (const rayDef of rays) {
                const rapierRayDir = new RapierVector3(rayDef.dir.x, 0, rayDef.dir.z); // Keep rays on XZ plane for ground avoidance
                const ray = new Ray(origin, rapierRayDir);
                const hit = world.castRayAndGetNormal(ray, probeDistance, solid, raycastGroups, filterCollider.handle);

                if (hit && hit.collider.handle !== filterCollider.handle) {
                    // --- NEW: Wall Climb Check (only for center ray hits) ---
                    if (rayDef.name === "center" && 
                        (playerPosition.y > currentPositionTHREE.y + CLIMB_MIN_PLAYER_HEIGHT_ADVANTAGE) &&
                        (currentTime - lastWallClimbTimeRef.current > CLIMB_JUMP_COOLDOWN)) {
                        
                        // Check if normal is somewhat vertical (wall-like)
                        const hitNormal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
                        if (Math.abs(hitNormal.y) < 0.7) { // Avoid attempting to "climb" floors or steep ceilings
                            console.log(`%c[Zombie ${id}] Attempting WALL CLIMB! Player Y: ${playerPosition.y.toFixed(1)}, Zombie Y: ${currentPositionTHREE.y.toFixed(1)}`, "color: green");
                            const forwardImpulse = desiredDirTHREE.clone().multiplyScalar(zombieSpeed * CLIMB_JUMP_FORWARD_IMPULSE_SCALE);
                            rapierBodyApi.applyImpulse({ x: forwardImpulse.x, y: CLIMB_JUMP_UP_IMPULSE, z: forwardImpulse.z }, true);
                            lastWallClimbTimeRef.current = currentTime;
                            attemptedWallClimb = true;
                            break; // Exit ray loop, prioritize climb
                        }
                    }
                    // --- End Wall Climb Check ---

                    if (attemptedWallClimb) continue; // Skip normal avoidance if climb happened

                    hitDetected = true;
                    const hitNormal = hit.normal;
                    const hitNormalTHREE = new THREE.Vector3(hitNormal.x, hitNormal.y, hitNormal.z).normalize();
                    
                    // Calculate a perpendicular avoidance vector
                    let avoidance = new THREE.Vector3().crossVectors(hitNormalTHREE, new THREE.Vector3(0,1,0)).normalize(); // Default to XZ plane
                    if (avoidance.lengthSq() < 0.01) { // if hitNormal is straight up/down, pick an arbitrary perpendicular
                        avoidance = new THREE.Vector3(hitNormalTHREE.z, 0, -hitNormalTHREE.x).normalize();
                    }
                    // Ensure avoidance pushes away from normal (might need to flip if cross product goes wrong way relative to desiredDir)
                    if (desiredDirTHREE.dot(avoidance) < 0) {
                        avoidance.negate();
                    }

                    // Stronger avoidance for center ray, gentler for whiskers
                    const weight = rayDef.name === "center" ? 1.0 : 0.5;
                    avoidanceVector.add(avoidance.multiplyScalar(weight));
                    // console.log(`[Zombie ${id} useFrame] Obstacle on ${rayDef.name} ray! Hit Normal: ${hitNormalTHREE.x.toFixed(1)},${hitNormalTHREE.y.toFixed(1)},${hitNormalTHREE.z.toFixed(1)}, Avoidance: ${avoidance.x.toFixed(1)},${avoidance.z.toFixed(1)}`);
                }
            }

            if (!attemptedWallClimb && hitDetected) {
                avoidanceVector.normalize();
                desiredVelocity.add(avoidanceVector.multiplyScalar(zombieSpeed * 0.75)); // Blend avoidance
                desiredVelocity.normalize().multiplyScalar(zombieSpeed); // Re-normalize to maintain speed
                steered = true;
            }
        }
        // --- Debug Log: Final Desired Velocity & Applied Linvel ---
        console.log(`[Zombie ${id} useFrame] ${steered ? 'STEERED' : 'Direct'}. Final Desired Vel: x=${desiredVelocity.x.toFixed(2)}, z=${desiredVelocity.z.toFixed(2)}. Applying Linvel: x=${desiredVelocity.x.toFixed(2)}, y=${currentLinvel.y.toFixed(2)}, z=${desiredVelocity.z.toFixed(2)}`);

        // 3. Apply Final Velocity
        if (!attemptedWallClimb) { // Don't apply regular velocity if a climb jump was made
            rapierBodyApi.setLinvel({ x: desiredVelocity.x, y: currentLinvel.y, z: desiredVelocity.z }, true);
        }

        // --- NEW Stuck Detection and Jump Logic ---
        if (isMovingIntent) { // Only check for stuck if trying to move
            if (lastPositionRef.current) {
                const distanceMovedSq = lastPositionRef.current.distanceToSquared(currentPositionTHREE);
                if (distanceMovedSq < STUCK_DISTANCE_THRESHOLD_SQ) {
                    if (timeBecameStuckRef.current === null) {
                        timeBecameStuckRef.current = currentTime;
                    }
                    if (currentTime - (timeBecameStuckRef.current || 0) > STUCK_TIME_THRESHOLD) {
                        if (currentTime - lastJumpTimeRef.current > JUMP_COOLDOWN) {
                            console.log(`%c[Zombie ${id}] Stuck! Attempting jump.`, "color: orange");
                            rapierBodyApi.applyImpulse({ x: 0, y: JUMP_IMPULSE_STRENGTH, z: 0 }, true);
                            lastJumpTimeRef.current = currentTime;
                            timeBecameStuckRef.current = null; // Reset stuck timer after jumping
                        }
                    }
                } else {
                    timeBecameStuckRef.current = null; // Moved enough, not stuck
                }
            }
            lastPositionRef.current = currentPositionTHREE.clone();
        } else {
            lastPositionRef.current = null; // Not trying to move, so not stuck
            timeBecameStuckRef.current = null;
        }

        // --- Procedural Animation (If Applicable) ---
        if (type === 'zombie_standard_shirt') {
            const walkSpeed = 3.0;
            const swingAmplitude = 0.2;
            // const bodyBobAmplitude = 0.05; // Body bobbing, can be added back if desired
            const time = state.clock.elapsedTime;
            const currentVelocity = rapierBodyApi.linvel();
            const speedMagnitude = Math.sqrt(currentVelocity.x ** 2 + currentVelocity.z ** 2);
            const isMoving = speedMagnitude > 0.1; // Threshold to consider moving

            // Calculate phase based on speed and time - still needed for legs
            const phase = time * walkSpeed * (isMoving ? 1 : 0);

            // --- New Zombie Arm Pose ---
            const ZOMBIE_ARM_OUTSTRETCH_ANGLE = -Math.PI / 2.8; // Arms forward and slightly up (approx -64 degrees)

            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = ZOMBIE_ARM_OUTSTRETCH_ANGLE;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = ZOMBIE_ARM_OUTSTRETCH_ANGLE;
                // Future idea: Add slight asymmetry to arms if desired:
                // rightArmRef.current.rotation.x = ZOMBIE_ARM_OUTSTRETCH_ANGLE * 0.95;
                // rightArmRef.current.rotation.z = Math.PI / 32;
            }

            // --- Leg Animation (remains the same) ---
            if (isMoving) {
                if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(phase) * swingAmplitude;
                if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(phase + Math.PI) * swingAmplitude;
            } else {
                // Reset leg pose when idle
                if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
                if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
            }
        } else if (type === 'zombie_brute') {
            // TODO: Add procedural animation for brute if needed
        }


    }); // End useFrame
    // -----------------------------------------------

    // No need for isDead check here, parent filters

    return (
        <group ref={groupRef} >
            <ZombieModel
                type={type} // Use prop
                leftArmRef={leftArmRef}
                rightArmRef={rightArmRef}
                leftLegRef={leftLegRef}
                rightLegRef={rightLegRef}
                isFlashing={isHit || false} // Use prop
            />
        </group>
    );
});

// --- UPDATED Main Zombies Manager Component ---
const Zombies = () => {
    const enemiesFromStore = useGameStore((state) => state.enemies, shallow);
    
    // Select playerPosition vector values to stabilize the object reference passed as prop
    // Ensure playerPosition is not null before passing to ActiveZombie
    const playerPosition = useGameStore((state) => state.playerPosition);

    const playerPositionProp = useMemo(() => {
        return playerPosition ? new THREE.Vector3(playerPosition.x, playerPosition.y, playerPosition.z) : null;
    }, [playerPosition]);
    
    const rapierContextValue = useRapier(); // Get the context value

    const enemiesToRenderData = useMemo(() => {
        // console.log(`[Zombies Component] Memoizing enemiesToRenderData. Number of enemies from store: ${Object.keys(enemiesFromStore).length}`);
        return Object.values(enemiesFromStore) // If enemiesFromStore is an object pool like { id: enemyState }
            .filter(enemy => !enemy.isDead && enemy.type !== 'zombie_boss')
            .map(enemy => ({
                id: enemy.id,
                type: enemy.type,
                // Pass the position reference directly. ActiveZombie's effect for body creation no longer depends on it changing.
                position: enemy.position, 
                isHit: enemy.isHit,
            }));
    }, [enemiesFromStore]);

    // Initial setup log
    useEffect(() => {
        // console.log("[Zombies Initial Mount] Initial enemies state:", enemies);
    }, []); // Empty dependency array means this runs once on mount

    // console.log(`[Zombies Re-render] Enemies to render count: ${enemiesToRender.length}`);

    return (
        <>
            {/* Map over the selected primitive data */}
            {enemiesToRenderData.map((enemyData) => (
                playerPositionProp && ( // Ensure playerPositionProp is not null
                    <ActiveZombie
                        key={enemyData.id} // Use id from mapped data
                        id={enemyData.id}
                        type={enemyData.type}
                        initialPosition={enemyData.position} 
                        isHit={enemyData.isHit}
                        playerPosition={playerPositionProp} // Pass the memoized and non-null playerPositionProp
                        rapier={rapierContextValue}
                    />
                )
            ))}
        </>
    );
}

export default Zombies;