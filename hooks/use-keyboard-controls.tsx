"use client"

import { useEffect, useState } from "react"

// Update the keyboard controls to clearly separate jump and shoot functions
const keyMap = {
  forward: ["ArrowUp", "w", "W"],
  backward: ["ArrowDown", "s", "S"],
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
  jump: [" ", "Space"], // Space key for jumping only
  sprint: ["Shift"], // Shift key for sprinting
}

export default function useKeyboardControls() {
  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    shoot: false,
    sprint: false,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Check which key was pressed and update state
        for (const [action, keyCodes] of Object.entries(keyMap)) {
          if (keyCodes.includes(e.key) || (e.code === "Space" && action === "jump")) {
            setKeys((prev) => ({ ...prev, [action]: true }))
          }
        }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Check which key was released and update state
      for (const [action, keyCodes] of Object.entries(keyMap)) {
        if (keyCodes.includes(e.key) || (e.code === "Space" && action === "jump")) {
          setKeys((prev) => ({ ...prev, [action]: false }))
        }
      }
    }

    // Handle mouse events separately for shooting
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        setKeys((prev) => ({ ...prev, shoot: true }))
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        setKeys((prev) => ({ ...prev, shoot: false }))
      }
    }

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)

    // Clean up
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  return keys
}
