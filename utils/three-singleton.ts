/**
 * This file ensures we use a single instance of Three.js throughout the application
 * to prevent the "Multiple instances of Three.js being imported" warning and related issues.
 */
import * as THREE from "three"

// Export the singleton instance
export { THREE }

// Export common Three.js classes directly to make imports cleaner
export const Vector3 = THREE.Vector3
export const Quaternion = THREE.Quaternion
export const Euler = THREE.Euler
export const Matrix4 = THREE.Matrix4
export const Mesh = THREE.Mesh
export const MeshStandardMaterial = THREE.MeshStandardMaterial
export const Color = THREE.Color
export const Raycaster = THREE.Raycaster
export const Object3D = THREE.Object3D
export const Group = THREE.Group
export const Box3 = THREE.Box3
export const Sphere = THREE.Sphere
export const Clock = THREE.Clock
export const Scene = THREE.Scene
export const WebGLRenderer = THREE.WebGLRenderer
export const PerspectiveCamera = THREE.PerspectiveCamera
export const TextureLoader = THREE.TextureLoader
export const Material = THREE.Material
export const BoxGeometry = THREE.BoxGeometry
export const SphereGeometry = THREE.SphereGeometry
export const PlaneGeometry = THREE.PlaneGeometry
export const CylinderGeometry = THREE.CylinderGeometry
export const MeshBasicMaterial = THREE.MeshBasicMaterial
export const PointLight = THREE.PointLight
export const DirectionalLight = THREE.DirectionalLight
export const AmbientLight = THREE.AmbientLight
export const SpotLight = THREE.SpotLight
export const HemisphereLight = THREE.HemisphereLight
export const Texture = THREE.Texture

// Also export common Three.js types for convenience
export type {
  Vector3 as Vector3Type,
  Quaternion as QuaternionType,
  Euler as EulerType,
  Matrix4 as Matrix4Type,
  Mesh as MeshType,
  Material as MaterialType,
  Group as GroupType,
  Object3D as Object3DType,
  Scene as SceneType,
  Camera,
  MeshStandardMaterial as MeshStandardMaterialType,
  Color as ColorType,
  Raycaster as RaycasterType,
} from "three"

// Create a global variable to ensure Three.js is loaded only once
if (typeof window !== "undefined") {
  // @ts-ignore
  window.__THREE_SINGLETON__ = window.__THREE_SINGLETON__ || THREE
}

// Export a function to get the singleton instance
export function getThreeSingleton() {
  if (typeof window !== "undefined") {
    // @ts-ignore
    return window.__THREE_SINGLETON__
  }
  return THREE
}
