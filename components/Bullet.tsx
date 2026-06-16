"use client";

import React, { useRef, useEffect, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import {
  RigidBody,
  BallCollider,
  useRapier,
  interactionGroups,
  CollisionEnterPayload,
  RapierRigidBody,
  CollisionPayload,
} from "@react-three/rapier"
import * as THREE from "three"
import { Trail } from "@react-three/drei"
import weapons from "@/data/weapons"
import { useSoundEffects } from "@/hooks/useSoundEffects";
import useGameStore from "@/hooks/useGameStore";
import useCosmetics from "@/hooks/useCosmetics";
import { 
    GROUP_ENVIRONMENT, 
    GROUP_PLAYER, 
    GROUP_ENEMY_HITBOX, 
    GROUP_BULLET 
} from "@/lib/physicsConstants";

interface BulletProps {
  id: number // ID provided by ShootingManager for key/state management
  initialPosition: THREE.Vector3
  initialDirection: THREE.Vector3
  weaponId: string
  damage: number
  onDespawn: (id: number) => void // Callback to notify manager
}

// Bullet collision group config
const bulletCollisions = interactionGroups(
    1 << GROUP_BULLET, // Belongs to Bullet group
    (1 << GROUP_ENVIRONMENT) | (1 << GROUP_ENEMY_HITBOX) // Interacts with Environment AND Enemy Hitbox groups
);

export function Bullet({ id, initialPosition, initialDirection, weaponId, damage, onDespawn }: BulletProps) {
  const bulletRef = useRef<RapierRigidBody>(null)
  const despawnTimer = useRef<NodeJS.Timeout | null>(null);
  const { playBulletImpactSound } = useSoundEffects();
  const damageEnemy = useGameStore((state) => state.damageEnemy);
  const rapier = useRapier();

  // Equipped trail cosmetic tints the tracer + glow.
  const trailColor = useCosmetics((s) => s.trailColor())

  const weaponData = weapons[weaponId]
  const speed = weaponData?.bulletSpeed || 30
  const maxLifetime = (weaponData?.bulletLifetime || 2) * 1000 // Convert lifetime to ms for setTimeout

  // Calculate initial velocity once
  const initialVelocity = useMemo(() => initialDirection.clone().multiplyScalar(speed), [
    initialDirection,
    speed
  ]);

  // Set initial state and despawn timer
  useEffect(() => {
    if (bulletRef.current) {
      bulletRef.current.setLinvel(initialVelocity, true)
      bulletRef.current.setTranslation(initialPosition, true)
    }

    // Set timer to despawn based on lifetime
    despawnTimer.current = setTimeout(() => {
      // console.log(`Bullet ${id} despawning due to lifetime`);
      onDespawn(id);
    }, maxLifetime);

    // Cleanup timer on unmount
    return () => {
      if (despawnTimer.current) {
        clearTimeout(despawnTimer.current);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // --- REMOVED DEBUG LOG & IMPERATIVE SET --- 
  /*
  useEffect(() => {
    if (bulletRef.current) {
      const rb = bulletRef.current;
      // Bullets only have one collider
      if (rb.numColliders() > 0) { 
        const collider = rb.collider(0);
        console.log(`[Bullet.tsx] Bullet ID ${id} Mounted. Checking Collider BEFORE setting groups...`);
        console.log(`  - Initial Collision Groups: ${collider.collisionGroups()}`);
        
        // --- IMPERATIVELY SET COLLISION GROUPS --- 
        collider.setCollisionGroups(bulletCollisions); 
        console.log(`  - Collision Groups AFTER setting: ${collider.collisionGroups()}`);
        // --- END IMPERATIVE SET --- 

        console.log(`  - Is Sensor? ${collider.isSensor()}`);
        console.log(`  - Parent RB Handle: ${collider.parent()?.handle}`);
      } else {
        console.warn(`[Bullet.tsx] Bullet ID ${id} mounted but has no collider?`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Run once when ID is available
  */
  // --- END REMOVED --- 

  const handleCollision = (event: CollisionEnterPayload) => {
    playBulletImpactSound();

    const otherRb = event.other.rigidBody;
    const otherUserData = otherRb?.userData as any;

    if (otherUserData?.type === "enemy") {
      const enemyId = otherUserData.id as number; // Get id from asserted userData
      if (typeof enemyId === 'number') {
          damageEnemy(enemyId, damage); // Call the store action
      }
    }

    // --- Disable physics body immediately ---
    if (bulletRef.current) {
        bulletRef.current.setEnabled(false);
    }

    // Clear lifetime timer
    if (despawnTimer.current) {
      clearTimeout(despawnTimer.current); // Clear lifetime timer
      despawnTimer.current = null;
    }
    onDespawn(id);
  }

  return (
    <RigidBody
      ref={bulletRef}
      type="dynamic"
      colliders={false} // Use separate collider component
      gravityScale={0} // Bullets shouldn't be affected by gravity
      enabledRotations={[false, false, false]}
      ccd={true} // RE-ENABLED CCD
      canSleep={false}
      position={initialPosition.toArray()} // Set initial position via prop
      onCollisionEnter={handleCollision}
      userData={{ type: "bullet", damage: damage }} // Identify rigid body AND store damage
    >
      <BallCollider 
        args={[0.05]} 
        restitution={0} // No bounce
        friction={0.7} // Standard friction
      />
      <mesh castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={trailColor} emissive={trailColor} emissiveIntensity={3} toneMapped={false} />
        {/* Optional Trail */}
        <Trail
          width={0.05}
          color={trailColor}
          length={5}
          decay={2}
          local={false}
          stride={0}
          interval={1}
        />
      </mesh>
    </RigidBody>
  )
} 