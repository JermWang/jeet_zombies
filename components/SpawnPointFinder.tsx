"use client";

import { useEffect } from 'react';
import { useRapier } from '@react-three/rapier';
import useGameStore from '@/hooks/useGameStore';
import { Vector3 } from 'three';
import { GROUP_ENVIRONMENT } from '@/lib/physicsConstants';

// Constants from WaveManager (could be moved to a shared constants file)
const SPAWN_RADIUS_MIN = 45;
const SPAWN_RADIUS_MAX = 55;
const SPAWN_CHECK_HEIGHT = 10;
const SAFE_SPAWN_Y_OFFSET = 0.1;
const MAX_SPAWN_ATTEMPTS = 10;
const OBSTACLE_CHECK_RADIUS = 0.5;

const SpawnPointFinder = () => {
    const rapier = useRapier();
    const setFindSafeSpawnPoint = useGameStore((state) => state.setFindSafeSpawnPoint);

    // --- The actual safe spawn logic ---
    const findSafeSpawnPointInternal = (): Vector3 | null => {
        const { world, rapier: RAPIER_API } = rapier;
        if (!world || !RAPIER_API) return null;

        for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const rayOrigin = { x: x, y: SPAWN_CHECK_HEIGHT, z: z };
            const rayDirection = { x: 0, y: -1, z: 0 };
            const groundCheckRay = new RAPIER_API.Ray(rayOrigin, rayDirection);
            const maxToi = SPAWN_CHECK_HEIGHT + 5;
            const solid = true;
            const groundCheckHit = world.castRay(groundCheckRay, maxToi, solid, undefined, undefined, undefined, undefined, (collider) => {
                return (collider.collisionGroups() & (GROUP_ENVIRONMENT << 16)) !== 0;
            });

            if (groundCheckHit) {
                const hitDistance = (groundCheckHit as any).toi;
                if (typeof hitDistance !== 'number') continue;

                const groundY = rayOrigin.y + rayDirection.y * hitDistance;
                const potentialSpawnY = groundY + SAFE_SPAWN_Y_OFFSET;
                const potentialSpawnPoint = { x: x, y: potentialSpawnY, z: z };

                const shape = new RAPIER_API.Ball(OBSTACLE_CHECK_RADIUS);
                const shapePosition = potentialSpawnPoint;
                const shapeRotation = { x: 0, y: 0, z: 0, w: 1 };
                let isObstructed = false;

                world.intersectionsWithShape(shapePosition, shapeRotation, shape, (collider) => {
                     if ((collider.collisionGroups() & (GROUP_ENVIRONMENT << 16)) !== 0) {
                         isObstructed = true;
                         return false;
                     }
                     return true;
                });

                if (!isObstructed) {
                    return new Vector3(x, potentialSpawnY, z);
                }
            }
        }
        console.warn(`[SpawnPointFinder] Failed to find a safe spawn location after ${MAX_SPAWN_ATTEMPTS} attempts.`);
        return null;
    };

    // --- Register the function with the store on mount ---
    useEffect(() => {
        // console.log("[SpawnPointFinder] Registering function with store.");
        setFindSafeSpawnPoint(findSafeSpawnPointInternal); // CORRECT: Pass the function reference directly

        // Cleanup on unmount
        return () => {
            // console.log("[SpawnPointFinder] Clearing function from store.");
            setFindSafeSpawnPoint(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rapier, setFindSafeSpawnPoint]); // Re-register if rapier context changes (unlikely but safe)


    return null; // This component renders nothing
}

export default SpawnPointFinder; 