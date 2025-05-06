// @ts-ignore
importScripts(
  "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/rapier.min.js"
);

// Declare RAPIER as a global variable for TypeScript
declare let RAPIER: any;

let world: any = null;
let rigidBodyMap = new Map<number, any>();
let lastId = 0;

// Function to get the next available ID
const getNextId = () => ++lastId;

self.onmessage = async (event) => {
  const { type, ...data } = event.data;

  if (type === "init") {
    await RAPIER.init();
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    world = new RAPIER.World(gravity);
    console.log("Physics worker initialized");
    self.postMessage({ type: "initialized" });
  } else if (world) {
    switch (type) {
      case "addBody": {
        const { position, velocity, mass, radius, isStatic, type: enemyType } = data;
        const bodyDesc =
          isStatic
            ? RAPIER.RigidBodyDesc.fixed().setTranslation(position[0], position[1], position[2])
            : RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(position[0], position[1], position[2])
                .setLinvel(velocity[0], velocity[1], velocity[2])
                .setAdditionalMass(mass)
                .setAngularDamping(5.0) // Prevent spinning
                .lockRotations(); // Prevent rotation

        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(0.1)
            .setFriction(0.5);
        world.createCollider(colliderDesc, body);

        const id = getNextId();
        rigidBodyMap.set(id, body);
        // console.log(`Worker: Added body ID ${id}`);
        self.postMessage({ type: "bodyAdded", id, position: [position[0], position[1], position[2]] }); // Send back initial pos
        break;
      }
      case "removeBody": {
        const { id } = data;
        const body = rigidBodyMap.get(id);
        if (body) {
          world.removeRigidBody(body);
          rigidBodyMap.delete(id);
          // console.log(`Worker: Removed body ID ${id}`);
          self.postMessage({ type: "bodyRemoved", id });
        } else {
          // console.warn(`Worker: Could not find body ID ${id} to remove.`);
        }
        break;
      }
      case "updateVelocity": {
        const { id, velocity } = data;
        const body = rigidBodyMap.get(id);
        if (body) {
          if (!body.isFixed() && !body.isSleeping()) {
            body.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
            body.wakeUp();
          }
        } else {
          console.warn(`Worker: Could not find body ID ${id} to update velocity.`);
        }
        break;
      }
      case "step": {
        const { deltaTime = 1 / 60, playerPosition } = data;
        world.step();

        const updatedBodies = [];
        for (const [id, body] of rigidBodyMap.entries()) {
          if (!body.isSleeping() && !body.isFixed()) {
            const pos = body.translation();
            updatedBodies.push({ id, position: [pos.x, pos.y, pos.z] });
          }
        }

        if (updatedBodies.length > 0) {
          self.postMessage({ type: "physicsUpdate", bodies: updatedBodies });
        }
        break;
      }
    }
  }
}; 