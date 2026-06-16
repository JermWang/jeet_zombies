import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// Load a GLB scene from the project's real /public assets, holding the Remotion
// render until it's ready (delayRender) so frames never capture a blank model.
// DRACO + Meshopt decoders are configured because the game's GLBs are compressed
// (drei's useGLTF does this automatically; a plain GLTFLoader does not, which
// otherwise yields invisible/empty geometry).
export function useGltfScene(publicPath: string): THREE.Group | null {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${publicPath}`));

  useEffect(() => {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      staticFile(publicPath),
      (gltf) => {
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // Cloned/posed SkinnedMeshes have a stale bounding volume and get
            // wrongly frustum-culled (→ invisible). Disable culling for them.
            mesh.frustumCulled = false;
          }
        });
        setScene(gltf.scene);
        continueRender(handle);
      },
      undefined,
      (err) => {
        console.error("GLB load error", publicPath, err);
        continueRender(handle);
      }
    );
  }, [handle, publicPath]);

  return scene;
}

// Load a texture from /public, holding the render until ready.
export function useTexture(publicPath: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${publicPath}`));

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      staticFile(publicPath),
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        setTex(t);
        continueRender(handle);
      },
      undefined,
      (err) => {
        console.error("Texture load error", publicPath, err);
        continueRender(handle);
      }
    );
  }, [handle, publicPath]);

  return tex;
}
