"use client"

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore, { EnemyState } from '@/hooks/useGameStore';
// Removed: import usePhysicsWorker from '@/hooks/usePhysicsWorker';
import { useRapier, RapierRigidBody, interactionGroups, CollisionPayload } from '@react-three/rapier';
import ZombieModel from './ZombieModel';
import { getEnemyConfig } from '@/data/enemies';
import { Vector3 as RapierVector3 } from '@dimforge/rapier3d-compat';
import { shallow } from 'zustand/shallow';

// NEW: Import useSoundEffects hook
import { useSoundEffects } from "@/hooks/useSoundEffects";

// --- Import Collision Groups ---
import { 
    GROUP_ENVIRONMENT, 
    GROUP_PLAYER, 
    GROUP_ENEMY_HITBOX, 
    GROUP_BULLET 
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
    // Render Guard - Use props now
    if (id === 0 || type === 'zombie_boss') {
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

    // Config memoization - Use type prop
    const config = useMemo(() => getEnemyConfig(type), [type]);

    // NEW: Get decreaseHealth from game store
    const decreaseHealth = useGameStore((state) => state.decreaseHealth);
    // NEW: Get playZombieBiteSound from sound effects hook
    const playZombieBiteSound = useSoundEffects((state) => state.playZombieBiteSound);

    // --- Effect to Create Rapier Body ---
    useEffect(() => {
        console.log(`%c[ActiveZombie Physics Effect RUN] ID: ${id}, Type: ${type}. bodyRef.current is initially: ${bodyRef.current ? 'SET' : 'NULL'}`, "color: yellow");
        
        if (!rapier || !rapier.world || id === null || !config) {
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
    }, [id, type, config]); // DIAGNOSTIC STATE: Temporarily remove rapier from deps - User indicates this is preferred for stability

    // --- Re-enable useFrame Hook ---
    useFrame((state, delta) => {
        // ---- RE-ENABLE PHYSICS SYNC & LOGIC ----
        const rapierBodyApi = bodyRef.current;
        
        // NOTE: We need to fetch `isDead` state separately if needed inside useFrame
        //       For now, we assume the parent `Zombies` component handles unmounting dead ones.
        if (!groupRef.current || !playerPosition || !config || !rapierBodyApi) {
            return;
        }

        // --- Get Current Position Directly from Rapier Dynamic Body ---
        const currentPositionVec = rapierBodyApi.translation(); // This is a Rapier Vector3 like {x,y,z}
        groupRef.current.position.copy(currentPositionVec as unknown as THREE.Vector3); // Copy to THREE.Vector3 for group
        groupRef.current.position.y += config.visualYOffset; // Apply visual offset AFTER getting physics position

        // --- Rotation/Look At --- 
        const lookAtPos = new THREE.Vector3(playerPosition.x, currentPositionVec.y + config.visualYOffset, playerPosition.z); // Look at player on the same Y plane, adjust for visual offset
        groupRef.current.lookAt(lookAtPos);

        // --- Movement & Attack Logic --- 
        const currentPositionTHREE = new THREE.Vector3(currentPositionVec.x, currentPositionVec.y, currentPositionVec.z);
        const distanceToPlayer = currentPositionTHREE.distanceTo(playerPosition);

        let desiredVelocity = new THREE.Vector3(0, 0, 0);
        const zombieSpeed = config.speed || ZOMBIE_SPEED; // Use config speed, fallback to constant
        const attackRange = config.attackRange || ATTACK_DISTANCE_THRESHOLD; // Use config attack range

        if (distanceToPlayer > attackRange) {
             // Move towards player
            const direction = new THREE.Vector3().subVectors(playerPosition, currentPositionTHREE).normalize();
            desiredVelocity.set(direction.x, 0, direction.z).multiplyScalar(zombieSpeed);
         } else {
            // Close enough to attack
            desiredVelocity.set(0, 0, 0); // Stop moving when in attack range (or play attack animation)
            
            const currentTime = state.clock.elapsedTime;
            if (currentTime - lastAttackTimeRef.current > DEFAULT_ATTACK_COOLDOWN) {
                console.log(`%c[ActiveZombie ATTACK] ID: ${id} attacking player! Distance: ${distanceToPlayer.toFixed(2)}, Range: ${attackRange}`, "color: red; font-weight: bold;");
                
                // Calculate damage based on config
                let actualDamage = DEFAULT_ATTACK_DAMAGE;
                if (config.minDamage !== undefined && config.maxDamage !== undefined) {
                    actualDamage = Math.floor(Math.random() * (config.maxDamage - config.minDamage + 1)) + config.minDamage;
                } else if (config.minDamage !== undefined) { // If only minDamage is defined, use it as fixed damage
                    actualDamage = config.minDamage;
                }
                console.log(`%c[ActiveZombie ATTACK] ID: ${id} dealing ${actualDamage} damage. Config Min: ${config.minDamage}, Config Max: ${config.maxDamage}`, "color: red; font-weight: bold;");
                decreaseHealth(actualDamage);
                playZombieBiteSound(); // NEW: Play bite sound
                lastAttackTimeRef.current = currentTime;
                // TODO: Trigger attack animation via state or direct action call if model supports it
            }
        }

        // Apply linear velocity (respecting gravity which Rapier handles)
        rapierBodyApi.setLinvel({ x: desiredVelocity.x, y: rapierBodyApi.linvel().y, z: desiredVelocity.z }, true);

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

    // Log if rapierContextValue reference changes
    const rapierRef = useRef(rapierContextValue);
    useEffect(() => {
        if (rapierRef.current !== rapierContextValue) {
            console.warn("[Zombies Component] rapier context from useRapier() has CHANGED REFERENCE!");
            rapierRef.current = rapierContextValue;
        } else {
            // console.log("[Zombies Component] rapier context from useRapier() is STABLE."); // Too noisy
        }
    }, [rapierContextValue]);

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