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
    playerPosition: THREE.Vector3;
    rapier: ReturnType<typeof useRapier>;
}

// --- UPDATED ActiveZombie Component ---
function ActiveZombie({ id, type, initialPosition, isHit, playerPosition, rapier }: ActiveZombieProps) {
    // Render Guard - Use props now
    if (id === 0 || type === 'zombie_boss') {
        console.log(`%c[ActiveZombie Render Guard] ID ${id} (${type}) is boss type. Returning null immediately.`, "color: orange; font-weight: bold");
        return null;
    }

    const groupRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<RapierRigidBody | null>(null);
    const leftLegRef = useRef<THREE.Object3D>(null);
    const rightLegRef = useRef<THREE.Object3D>(null);
    const leftArmRef = useRef<THREE.Object3D>(null);
    const rightArmRef = useRef<THREE.Object3D>(null);

    // Config memoization - Use type prop
    const config = useMemo(() => getEnemyConfig(type), [type]);

    // --- Effect to Create Rapier Body ---
    useEffect(() => {
        // Use props: id, type, initialPosition, config
        if (!rapier || !rapier.world || id === null || !config) return;

        if (type === 'zombie_boss') {
             console.warn(`[ActiveZombie Create Effect] Attempted to create body for zombie_boss (ID: ${id}). Skipping.`);
             return;
        }
        if (bodyRef.current) {
             // console.log(`[ActiveZombie Create Effect] Body ref already exists for ID ${id}. Skipping creation.`);
             return;
        }

        console.log(`[ActiveZombie Create Effect] Creating Rapier body for Enemy ID ${id}, Type: ${type}`);
        // Use initialPosition prop directly
        const spawnPos = initialPosition;
        console.log(`[ActiveZombie Create Effect] Using position: { x: ${spawnPos.x.toFixed(2)}, y: ${spawnPos.y.toFixed(2)}, z: ${spawnPos.z.toFixed(2)} }`);

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

        console.log(`[ActiveZombie Create Effect] Created Rapier body for Enemy ID ${id}. Stored in local ref.`);

        // --- Cleanup Function ---
        return () => {
            const bodyToRemove = bodyRef.current;
            console.log(`[ActiveZombie Cleanup] Running for ID: ${id}, Body Ref: ${bodyToRemove ? 'Exists' : 'null'}`);
            if (bodyToRemove && rapier.world) {
                try {
                    rapier.world.removeRigidBody(bodyToRemove);
                    console.log(`[ActiveZombie Cleanup] Successfully removed RB for Enemy ID ${id} using body ref.`);
                } catch (error) {
                    console.error(`[ActiveZombie Cleanup] Error removing RB for Enemy ID ${id}:`, error);
                }
            }
            bodyRef.current = null;
        };
    // Update dependencies to use props
    }, [rapier, id, type, initialPosition, config]);

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
        const currentPositionVec = rapierBodyApi.translation(); // Get THREE.Vector3 directly
        groupRef.current.position.copy(currentPositionVec);
        groupRef.current.position.y += config.visualYOffset; // Apply visual offset AFTER getting physics position

        // --- Rotation/Look At --- 
        const lookAtPos = new THREE.Vector3(playerPosition.x, currentPositionVec.y + config.visualYOffset, playerPosition.z); // Look at player on the same Y plane, adjust for visual offset
        groupRef.current.lookAt(lookAtPos);

        // --- Movement Logic --- 
        const currentPositionTHREE = new THREE.Vector3(currentPositionVec.x, currentPositionVec.y, currentPositionVec.z); // Convert Rapier Vector to THREE.Vector3
        const distanceToPlayer = currentPositionTHREE.distanceTo(playerPosition);

        // Decide if moving or attacking (Simplified for now)
        let desiredVelocity = new THREE.Vector3(0, 0, 0); 
        if (distanceToPlayer > ATTACK_DISTANCE_THRESHOLD) {
             // Move towards player
            const direction = new THREE.Vector3().subVectors(playerPosition, currentPositionTHREE).normalize(); // Use THREE.Vector3 for subtraction
            desiredVelocity.set(direction.x, 0, direction.z).multiplyScalar(config.speed || ZOMBIE_SPEED);
             // TODO: Implement pathfinding or obstacle avoidance if needed
         } else {
            // Close enough to attack (or stop)
            // TODO: Implement attack logic/animation trigger
            desiredVelocity.set(0, 0, 0);
        }

        // Apply linear velocity (respecting gravity which Rapier handles)
        rapierBodyApi.setLinvel({ x: desiredVelocity.x, y: rapierBodyApi.linvel().y, z: desiredVelocity.z }, true);

        // --- Procedural Animation (If Applicable) ---
        if (type === 'zombie_standard_shirt') {
            const walkSpeed = 3.0;
            const swingAmplitude = 0.2;
            const bodyBobAmplitude = 0.05;
            const time = state.clock.elapsedTime;
            const currentVelocity = rapierBodyApi.linvel();
            const speedMagnitude = Math.sqrt(currentVelocity.x ** 2 + currentVelocity.z ** 2);
            const isMoving = speedMagnitude > 0.1; // Threshold to consider moving

            // Calculate phase based on speed and time
            const phase = time * walkSpeed * (isMoving ? 1 : 0);

            // Apply limb swing and body bob only when moving
            if (isMoving) {
                if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(phase) * swingAmplitude;
                if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(phase + Math.PI) * swingAmplitude;
                if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(phase + Math.PI) * swingAmplitude;
                if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(phase) * swingAmplitude;
                if (groupRef.current) groupRef.current.position.y += Math.sin(phase * 2) * bodyBobAmplitude; // Bobbing
            } else {
                // Reset to default pose when idle
                if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
                if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
                if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
                if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
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
}

// --- UPDATED Main Zombies Manager Component ---
const Zombies = () => {
    // Select ONLY the necessary primitive data for active, non-boss enemies
    const enemiesToRenderData = useGameStore(
        (state) => Object.values(state.enemies)
            .filter(enemy => !enemy.isDead && enemy.type !== 'zombie_boss')
            .map(enemy => ({ // Map to a new object with only needed primitives
                id: enemy.id,
                type: enemy.type,
                position: enemy.position, // Assuming position reference is stable initially
                isHit: enemy.isHit,
            })),
        shallow // Keep shallow compare
    );
    const playerPosition = useGameStore((state) => state.playerPosition);
    const rapier = useRapier();

    // --- Log initial state on mount --- (Keep this)
    useEffect(() => {
        console.log('%c[Zombies Initial Mount] Initial enemies state:', 'color: purple; font-weight: bold', useGameStore.getState().enemies);
    }, []);

    // --- Log when this component actually re-renders --- (Keep this)
    useEffect(() => {
        console.log('%c[Zombies Re-render] Enemies to render count:', 'color: cyan', enemiesToRenderData.length);
    });

    return (
        <>
            {/* Map over the selected primitive data */}
            {enemiesToRenderData.map((enemyData) => (
                <ActiveZombie
                    key={enemyData.id} // Use id from mapped data
                    id={enemyData.id}
                    type={enemyData.type}
                    initialPosition={enemyData.position} // Use position from mapped data
                    isHit={enemyData.isHit}
                    playerPosition={playerPosition!}
                    rapier={rapier}
                />
            ))}
        </>
    );
}

export default Zombies;