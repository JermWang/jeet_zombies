import { create } from "zustand"
import { THREE } from "./three-singleton"

// Define texture types
type TextureType = "ground" | "grave" | "treeBark" | "treeLeaves" | "fence" | "zombie"

// Create a store for textures
interface TextureStore {
  textures: Record<TextureType, THREE.Texture | null>
  loadTexture: (type: TextureType, url: string) => void
  getTexture: (type: TextureType) => THREE.Texture | null
}

// Create a fallback texture (1x1 pixel)
export function createFallbackTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#444444"
    ctx.fillRect(0, 0, 1, 1)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Create the texture store
export const useTextureStore = create<TextureStore>((set, get) => ({
  textures: {
    ground: null,
    grave: null,
    treeBark: null,
    treeLeaves: null,
    fence: null,
    zombie: null,
  },
  loadTexture: (type, url) => {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(4, 4)
        set((state) => ({
          textures: {
            ...state.textures,
            [type]: texture,
          },
        }))
      },
      undefined,
      (error) => {
        console.error(`Error loading texture ${type}:`, error)
        // Set fallback texture
        set((state) => ({
          textures: {
            ...state.textures,
            [type]: createFallbackTexture(),
          },
        }))
      },
    )
  },
  getTexture: (type) => {
    const texture = get().textures[type]
    return texture || createFallbackTexture()
  },
}))

// Preload textures
export function preloadTextures() {
  const store = useTextureStore.getState()

  // Load textures with placeholder URLs
  // In a real app, replace these with actual texture URLs
  store.loadTexture("ground", "/textures/ground.jpg")
  store.loadTexture("grave", "/textures/grave.jpg")
  store.loadTexture("treeBark", "/textures/bark.jpg")
  store.loadTexture("treeLeaves", "/textures/leaves.jpg")
  store.loadTexture("fence", "/textures/fence.jpg")
  store.loadTexture("zombie", "/textures/zombie.jpg")
}
