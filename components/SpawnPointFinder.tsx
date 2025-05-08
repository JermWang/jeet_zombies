"use client";

import { useEffect, useCallback } from 'react';
import { useRapier } from '@react-three/rapier';
import useGameStore from '@/hooks/useGameStore';
import * as THREE from 'three'; // Use * as THREE for THREE.Vector3
import { GROUP_ENVIRONMENT } from '@/lib/physicsConstants';

// Constants (can be moved to a shared constants file if used elsewhere)
const SPAWN_RADIUS_MIN = 55;
const SPAWN_RADIUS_MAX = 140;
const SPAWN_CHECK_HEIGHT = 10;
const SAFE_SPAWN_Y_OFFSET = 0.1;
const MAX_SPAWN_ATTEMPTS = 10;
const OBSTACLE_CHECK_RADIUS = 0.5;

const SpawnPointFinder = () => {
    const rapier = useRapier();
    const setFindSafeSpawnPoint = useGameStore((state) => state.setFindSafeSpawnPoint);

    const findSafeSpawnPointInternal = useCallback((): THREE.Vector3 | null => {
        const { world, rapier: RAPIER_API } = rapier;
        if (!world || !RAPIER_API) {
            console.warn("[SpawnPointFinder] Rapier world or API not available for findSafeSpawnPointInternal.");
            return null;
        }

        for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const rayOrigin = { x: x, y: SPAWN_CHECK_HEIGHT, z: z };
            const rayDirection = { x: 0, y: -1, z: 0 };
            // console.log(`[SpawnPointFinder Attempt ${attempt + 1}] Trying raycast from X: ${x.toFixed(2)}, Y: ${rayOrigin.y.toFixed(2)}, Z: ${z.toFixed(2)}`);

            const groundCheckRay = new RAPIER_API.Ray(rayOrigin, rayDirection);
            const maxToi = SPAWN_CHECK_HEIGHT + 5; // Max distance ray travels
            const solid = true;
            
            let hitColliderInfo = null;

            const groundCheckHit = world.castRay(
                groundCheckRay, 
                maxToi, 
                solid,
                undefined, // query_filter_flags: Include fixed and dynamic bodies
                undefined, // query_filter_groups: Interaction groups for the ray itself (not used here)
                undefined, // query_filter_mask: Interaction mask for the ray itself (not used here)
                undefined, // query_filter_collider: Specific collider to ignore (not used here)
                (collider) => { // Callback to filter which colliders are hit
                    const isInGroup = (collider.collisionGroups() & (1 << GROUP_ENVIRONMENT)) !== 0;
                    // console.log(`[SpawnPointFinder Ray Filter] Attempt ${attempt + 1}: Checking collider handle ${collider.handle}. Groups: ${collider.collisionGroups().toString(2)}. Is in GROUP_ENVIRONMENT (${GROUP_ENVIRONMENT}): ${isInGroup}`);
                    if (isInGroup) {
                        hitColliderInfo = { handle: collider.handle, groups: collider.collisionGroups() };
                    }
                    return isInGroup; 
                }
            );

            if (groundCheckHit) {
                // console.log(`[SpawnPointFinder Attempt ${attempt + 1}] Raycast HIT! Collider:`, hitColliderInfo, "Hit details:", groundCheckHit);
                const hitDistance = (groundCheckHit as any).timeOfImpact;
                
                // console.log(`[SpawnPointFinder Attempt ${attempt + 1}] Extracted hitDistance (timeOfImpact):`, hitDistance, "(Type:", typeof hitDistance + ")");

                if (typeof hitDistance !== 'number') {
                    // console.warn(`[SpawnPointFinder Attempt ${attempt + 1}] Hit distance (timeOfImpact) is not a number or undefined. Actual value:`, hitDistance);
                    // if (groundCheckHit) {
                    //    console.log(`[SpawnPointFinder Attempt ${attempt + 1}] Keys of groundCheckHit:`, Object.keys(groundCheckHit).join(', '));
                    // }
                    continue;
                }

                const groundY = rayOrigin.y + rayDirection.y * hitDistance;
                const potentialSpawnY = groundY + SAFE_SPAWN_Y_OFFSET;
                const potentialSpawnPoint = { x: x, y: potentialSpawnY, z: z };

                const shape = new RAPIER_API.Ball(OBSTACLE_CHECK_RADIUS);
                const shapePosition = potentialSpawnPoint;
                const shapeRotation = { x: 0, y: 0, z: 0, w: 1 };
                let isObstructed = false;

                world.intersectionsWithShape(shapePosition, shapeRotation, shape, (collider) => {
                     if (!((collider.collisionGroups() & (1 << GROUP_ENVIRONMENT)) !== 0)) {
                         console.log("[SpawnPointFinder] Obstacle check hit a NON-ENVIRONMENT object:", collider.handle, "Collision Groups:", collider.collisionGroups());
                         isObstructed = true;
                         return false;
                     }
                     return true;
                });

                if (!isObstructed) {
                    return new THREE.Vector3(x, potentialSpawnY, z);
                }
            } else {
                // console.log(`[SpawnPointFinder Attempt ${attempt + 1}] Raycast MISSED ground in GROUP_ENVIRONMENT.`);
            }
        }
        console.warn(`[SpawnPointFinder] Failed to find a safe spawn location after ${MAX_SPAWN_ATTEMPTS} attempts.`);
        return null;
    }, [rapier]); // findSafeSpawnPointInternal depends only on rapier context

    useEffect(() => {
        // console.log(`[SpawnPointFinder] useEffect running. Rapier ready: ${!!(rapier && rapier.world)}`);
        if (!rapier || !rapier.world) {
            setFindSafeSpawnPoint(null);
            return;
        }
        setFindSafeSpawnPoint(findSafeSpawnPointInternal);
        
        return () => {
            // console.log("[SpawnPointFinder] useEffect CLEANUP FIRING");
            // console.log('[SpawnPointFinder] useEffect cleanup. Setting findSafeSpawnPoint to null.');
            // setFindSafeSpawnPoint(null); // TEMPORARILY COMMENTED OUT for debugging remounts
        };
    }, [rapier, findSafeSpawnPointInternal, setFindSafeSpawnPoint]);

    return null; // This component renders nothing
};

export default SpawnPointFinder; 