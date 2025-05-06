"use client";

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { RigidBody, CapsuleCollider, RapierRigidBody, CollisionPayload, interactionGroups } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '@/hooks/useGameStore';
import { useSoundEffects } from '@/hooks/useSoundEffects';

// --- Import Collision Groups --- 
import { 
    GROUP_ENVIRONMENT, 
    GROUP_PLAYER, 
    GROUP_ENEMY_HITBOX, 
    GROUP_BULLET 
} from "@/lib/physicsConstants";

// Boss collision group config
const bossCollisions = interactionGroups(
    1 << GROUP_ENEMY_HITBOX, // Belongs to Enemy Hitbox group (2)
    (1 << GROUP_ENVIRONMENT) | (1 << GROUP_BULLET) // Mask: Interacts with Environment (0) OR Bullet (3)
);

// Config (could be imported or passed as props if needed)
const BOSS_CONFIG: {
    health: number;
    scale: number;
    colliderArgs: [number, number]; // Explicitly type as tuple [radius, height]
    speed: number;
    attackRange: number;
    modelPath: string;
    yOffset: number;
    mass: number;
} = {
    health: 1000,
    scale: 1.8,
    colliderArgs: [0.7, 1.4], // REDUCED height from 1.6 to 1.4
    speed: 2.0,
    attackRange: 2.5,
    modelPath: "/models/zombie_animated.glb",
    yOffset: -0.04, // The required physics offset for RigidBody
    mass: 150,
};

interface IndividualBossProps {
    id: number;
    initialPosition: THREE.Vector3; // Get initial position from store
}

export default function IndividualBoss({ id, initialPosition }: IndividualBossProps) {
    const rigidBodyRef = useRef<RapierRigidBody>(null);
    const groupRef = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(BOSS_CONFIG.modelPath);
    const { actions, names } = useAnimations(animations, groupRef);
    
    // Store state and actions
    const playerPosition = useGameStore((state) => state.playerPosition);
    const damageEnemy = useGameStore((state) => state.damageEnemy);
    const deactivateEnemy = useGameStore((state) => state.deactivateEnemy);
    const setEnemyRapierHandle = useGameStore((state) => state.setEnemyRapierHandle); // Get the action
    const { playZombieDeathSound } = useSoundEffects(); // Get death sound player

    const [currentAction, setCurrentAction] = useState<string>('idle');
    const [isDead, setIsDead] = useState(false);
    const [health, setHealth] = useState(BOSS_CONFIG.health);

    // Initial setup for animation and state
    useEffect(() => {
        // Default animation
        actions.idle?.reset().fadeIn(0.5).play();
        setCurrentAction('idle');

        // Handle external state changes (e.g., if killed by non-collision means)
        // Subscribe to the specific enemy's state in the store? (More advanced)
        // For now, rely on internal state management triggered by hits.

    }, [actions]);

    // Handle death logic
    useEffect(() => {
        if (isDead) {
            // Play death animation
            const deathAction = actions.death;
            if (deathAction) {
                setCurrentAction('death');
                Object.values(actions).forEach(action => action?.stop());
                deathAction.reset().setLoop(THREE.LoopOnce, 1).play();
                deathAction.clampWhenFinished = true;
            }
            playZombieDeathSound();
            // Disable physics interactions
            rigidBodyRef.current?.setEnabled(false);
            // Deactivate in the store after a delay (allows animation)
            const timer = setTimeout(() => {
                deactivateEnemy(id);
            }, 3000); // Adjust delay as needed
            return () => clearTimeout(timer);
        }
    }, [isDead, actions, playZombieDeathSound, deactivateEnemy, id]);

    useFrame((_state, delta) => {
        // --- TEMP: Disable movement/animation for collision debugging ---
        /*
        if (isDead || !rigidBodyRef.current || !playerPosition || !groupRef.current) return;

        const bossRb = rigidBodyRef.current;
        const currentPosition = bossRb.translation();
        const bossPositionVec3 = new THREE.Vector3(currentPosition.x, currentPosition.y, currentPosition.z);
        const distanceToPlayer = bossPositionVec3.distanceTo(playerPosition);

        // --- Movement Logic --- 
        let desiredAnimation = 'idle';
        if (distanceToPlayer > BOSS_CONFIG.attackRange) {
            // Move towards player
            const targetDirection = new THREE.Vector3().subVectors(playerPosition, bossPositionVec3).normalize();
            const desiredVelocity = targetDirection.multiplyScalar(BOSS_CONFIG.speed);
            // Apply velocity (maintain current Y velocity from Rapier gravity)
            bossRb.setLinvel({ x: desiredVelocity.x, y: bossRb.linvel().y, z: desiredVelocity.z }, true);
            // Face player
            groupRef.current.lookAt(playerPosition.x, bossPositionVec3.y + BOSS_CONFIG.yOffset, playerPosition.z);
            desiredAnimation = 'run'; // Use run animation
        } else {
            // Attack range - stop moving
            bossRb.setLinvel({ x: 0, y: bossRb.linvel().y, z: 0 }, true);
            desiredAnimation = 'attack'; // Use attack animation
            // TODO: Implement actual attack damage logic
        }

        // --- Animation Switching --- 
        if (currentAction !== desiredAnimation && actions[desiredAnimation]) {
            const currentActionClip = actions[currentAction];
            const nextActionClip = actions[desiredAnimation];
            currentActionClip?.fadeOut(0.3);
            // Add null check for nextActionClip
            if (nextActionClip) { 
                nextActionClip.reset().setLoop(desiredAnimation !== 'attack' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).fadeIn(0.3).play();
                 if (desiredAnimation === 'attack') nextActionClip.clampWhenFinished = true;
            }
            setCurrentAction(desiredAnimation);
        }
        */
        // --- END TEMP DISABLE ---
    });

    // Handle collisions (e.g., bullet hits)
    const handleCollisionEnter = (payload: CollisionPayload) => {
        if (isDead) return;
        // Check if collided object is a bullet (using userData with type assertion)
        const otherUserData = payload.other.rigidBody?.userData as any;
        if (otherUserData?.type === 'bullet') {
             const bulletDamage = (otherUserData.damage as number) || 10; // Default damage
             console.log(`Boss ID ${id} hit by bullet! Damage: ${bulletDamage}`);
             const newHealth = Math.max(0, health - bulletDamage);
             setHealth(newHealth);
             // Call store damage primarily for score/UI updates if needed
             damageEnemy(id, bulletDamage); 
             if (newHealth <= 0) {
                console.log(`Boss ID ${id} died.`);
                setIsDead(true);
            }
            // Optional: Remove bullet? Depends on bullet implementation
        }
    };

    // Calculate the required offset based on NEW collider args
    const colliderRadius = BOSS_CONFIG.colliderArgs[0];
    const colliderHalfHeight = BOSS_CONFIG.colliderArgs[1] / 2;
    // Calculate offset needed to place collider BOTTOM at RB origin
    const colliderOffsetY = colliderHalfHeight + colliderRadius; 

    // USE the initialPosition directly from props
    const initialPosArray: [number, number, number] = [initialPosition.x, initialPosition.y, initialPosition.z];

    // --- Log the calculated initial position --- 
    // console.log(`%c[IndividualBoss Calc] Calculated initialPosArray for RigidBody:`, "color: brown", initialPosArray); // TEMP DISABLED

    // --- DEBUG: Log collider properties on mount --- 
    useEffect(() => {
        if (rigidBodyRef.current) {
            const rb = rigidBodyRef.current;
            console.log(`[IndividualBoss.tsx] Boss RB (ID: ${id}) Mounted. Checking Colliders...`);
            for (let i = 0; i < rb.numColliders(); i++) {
                const collider = rb.collider(i);
                console.log(`  - Collider Handle: ${collider.handle}`);
                console.log(`  - Is Sensor? ${collider.isSensor()}`);
                console.log(`  - Collision Groups: ${collider.collisionGroups()}`);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]); // Run once when ID is available (effectively on mount)
    // --- END DEBUG --- 

    // --- Set Rapier Handle in Store on Mount --- 
    useEffect(() => {
        if (rigidBodyRef.current) {
            const handle = rigidBodyRef.current.handle;
            // --- Log actual position right after mount --- 
            const actualPos = rigidBodyRef.current.translation();
            console.log(`[IndividualBoss Mount] RB Handle: ${handle}. Initial prop Y: ${initialPosArray[1].toFixed(4)}. Actual Rapier Y after mount: ${actualPos.y.toFixed(4)}`);
            // -------------------------------------------
            console.log(`[IndividualBoss Mount] Setting Rapier handle ${handle} for Boss ID ${id} in store.`);
            setEnemyRapierHandle(id, handle);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, setEnemyRapierHandle]); // Add setEnemyRapierHandle dependency

    return (
        <RigidBody
            ref={rigidBodyRef}
            colliders={false} // Manual collider
            position={initialPosArray} // Set initial position adjusted for offset
            type="dynamic"
            mass={BOSS_CONFIG.mass}
            canSleep={false}
            enabledRotations={[false, true, false]}
            userData={{ type: 'enemy', enemyId: id, enemyType: 'zombie_boss' }}
            onCollisionEnter={handleCollisionEnter}
            linearDamping={0.5}
            angularDamping={0.5}
        >
            {/* Offset the collider upwards slightly LESS to lower it */}
            <CapsuleCollider 
                args={BOSS_CONFIG.colliderArgs} 
                position={[0, colliderOffsetY - 0.1, 0]} // Subtract a small value to lower it
                collisionGroups={bossCollisions} // Apply collision groups
            />
            {/* Keep the visual group offset as it was, based on the original colliderOffsetY */}
            <group 
                ref={groupRef} 
                userData={{ enemyId: id }} 
                position={[0, colliderOffsetY, 0]}
            >
                <primitive 
                    object={scene} 
                    scale={BOSS_CONFIG.scale} 
                    // Ensure primitive itself has no extra Y offset
                    position={[0, -2.2, 0]} 
                />
            </group>
        </RigidBody>
    );
} 