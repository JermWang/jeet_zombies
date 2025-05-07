"use client";

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/hooks/useGameStore';
import { useRapier, RapierRigidBody, interactionGroups } from '@react-three/rapier';
import ZombieModel from './ZombieModel'; // Assuming boss uses a variation of ZombieModel or specific animations
import { getEnemyConfig } from '@/data/enemies';
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { GROUP_ENVIRONMENT, GROUP_PLAYER, GROUP_ENEMY_HITBOX } from "@/lib/physicsConstants";

const DEFAULT_BOSS_ATTACK_DAMAGE = 50; // Placeholder
const DEFAULT_BOSS_ATTACK_COOLDOWN = 3; // seconds

// Collision group for the boss hitbox
const bossHitboxCollisions = interactionGroups(
    1 << GROUP_ENEMY_HITBOX,
    (1 << GROUP_ENVIRONMENT) | (1 << GROUP_PLAYER) // Boss hitbox can collide with environment and player
);

export interface IndividualBossProps {
    id: number;
    initialPosition: THREE.Vector3;
    type: string; // Should be 'zombie_boss'
}

export default function IndividualBoss({ id, initialPosition, type }: IndividualBossProps) {
    const groupRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<RapierRigidBody | null>(null);
    const lastAttackTimeRef = useRef(0);
    const rapier = useRapier();

    const config = useMemo(() => getEnemyConfig(type), [type]);
    const { decreaseHealth, playerPosition } = useGameStore((state) => ({
        decreaseHealth: state.decreaseHealth,
        playerPosition: state.playerPosition,
    }));
    const playZombieBiteSound = useSoundEffects((state) => state.playZombieBiteSound); // Or a specific boss attack sound

    // Effect to Create Rapier Body
    useEffect(() => {
        if (!rapier.world || !config || bodyRef.current) {
            // Avoid re-creating body or if essential refs/config aren't ready
            if(bodyRef.current) console.log("[IndividualBoss] Body already exists.");
            return;
        }
        console.log(`[IndividualBoss] Creating physics body for boss ID: ${id}, Type: ${type}`);

        const rigidBodyDesc = rapier.rapier.RigidBodyDesc.dynamic()
            .setTranslation(initialPosition.x, initialPosition.y, initialPosition.z)
            .setUserData({ type: 'enemy', enemyType: type, id: id }) // Consistent with other enemies
            .lockRotations(); // Boss probably shouldn't fall over easily
        const rapierBody = rapier.world.createRigidBody(rigidBodyDesc);
        
        let colliderDesc;
        if (config.colliderType === 'capsule') {
            const [radius, height] = config.hitboxArgs as [number, number];
            colliderDesc = rapier.rapier.ColliderDesc.capsule(height / 2, radius);
        } else { // cuboid
            const [hx, hy, hz] = config.hitboxArgs as [number, number, number];
            colliderDesc = rapier.rapier.ColliderDesc.cuboid(hx, hy, hz);
        }
        colliderDesc
            .setTranslation(0, config.hitboxOffsetY, 0) // Use Y offset from config
            .setActiveEvents(rapier.rapier.ActiveEvents.COLLISION_EVENTS)
            .setCollisionGroups(bossHitboxCollisions); // Boss-specific or general enemy hitbox group
        
        rapier.world.createCollider(colliderDesc, rapierBody);
        bodyRef.current = rapierBody;

        return () => {
            if (bodyRef.current && rapier.world) {
                try {
                    rapier.world.removeRigidBody(bodyRef.current);
                } catch (e) {
                    console.error("[IndividualBoss] Error removing boss rigid body:", e);
                }
            }
            bodyRef.current = null;
        };
    }, [id, type, initialPosition, config, rapier]);


    useFrame((state, delta) => {
        const rapierBody = bodyRef.current;
        if (!groupRef.current || !playerPosition || !config || !rapierBody) {
            return;
        }

        const currentPositionVec = rapierBody.translation();
        groupRef.current.position.copy(currentPositionVec as unknown as THREE.Vector3);
        groupRef.current.position.y += config.visualYOffset;

        const lookAtPos = new THREE.Vector3(playerPosition.x, currentPositionVec.y + config.visualYOffset, playerPosition.z);
        groupRef.current.lookAt(lookAtPos);

        const currentPositionTHREE = new THREE.Vector3(currentPositionVec.x, currentPositionVec.y, currentPositionVec.z);
        const distanceToPlayer = currentPositionTHREE.distanceTo(playerPosition);

        const bossSpeed = config.speed;
        const attackRange = config.attackRange;
        let desiredVelocity = new THREE.Vector3(0, 0, 0);

        if (distanceToPlayer > attackRange) {
            const direction = new THREE.Vector3().subVectors(playerPosition, currentPositionTHREE).normalize();
            desiredVelocity.set(direction.x, 0, direction.z).multiplyScalar(bossSpeed);
        } else {
            desiredVelocity.set(0, 0, 0);
            const currentTime = state.clock.elapsedTime;
            if (currentTime - lastAttackTimeRef.current > DEFAULT_BOSS_ATTACK_COOLDOWN) {
                let actualDamage = DEFAULT_BOSS_ATTACK_DAMAGE;
                if (config.minDamage !== undefined && config.maxDamage !== undefined) {
                    actualDamage = Math.floor(Math.random() * (config.maxDamage - config.minDamage + 1)) + config.minDamage;
                } else if (config.minDamage !== undefined) {
                    actualDamage = config.minDamage;
                }
                console.log(`%c[IndividualBoss ATTACK] ID: ${id} dealing ${actualDamage} damage to player.`, "color: red; font-weight: bold;");
                decreaseHealth(actualDamage);
                playZombieBiteSound(); // Placeholder, consider a unique boss attack sound
                lastAttackTimeRef.current = currentTime;
                // Here you would trigger boss-specific attack animations
            }
        }
        rapierBody.setLinvel({ x: desiredVelocity.x, y: rapierBody.linvel().y, z: desiredVelocity.z }, true);
    });

    return (
        <group ref={groupRef}>
            <ZombieModel
                type={type} // This will make ZombieModel load '/models/zombie_animated.glb'
                isFlashing={false} // Placeholder, boss hit state can be added
                // Pass any animation refs if ZombieModel is set up to use them for bosses
                />
            </group>
    );
} 