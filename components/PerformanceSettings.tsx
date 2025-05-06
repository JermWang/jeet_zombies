"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Settings, Zap } from "lucide-react"

interface PerformanceSettingsProps {
  onQualityChange: (quality: "low" | "medium" | "high") => void
  onShadowsToggle: (enabled: boolean) => void
  onEffectsToggle: (enabled: boolean) => void
  onFpsTargetChange?: (fps: number) => void
  targetFps?: number
}

export default function PerformanceSettings({
  onQualityChange,
  onShadowsToggle,
  onEffectsToggle,
  onFpsTargetChange,
  targetFps = 60,
}: PerformanceSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium")
  const [shadows, setShadows] = useState(false)
  const [effects, setEffects] = useState(true)
  const [fps, setFps] = useState(targetFps)

  // Apply settings when changed
  useEffect(() => {
    onQualityChange(quality)
  }, [quality, onQualityChange])

  useEffect(() => {
    onShadowsToggle(shadows)
  }, [shadows, onShadowsToggle])

  useEffect(() => {
    onEffectsToggle(effects)
  }, [effects, onEffectsToggle])

  // Update FPS when changed
  useEffect(() => {
    setFps(targetFps)
  }, [targetFps])

  // Handle FPS change
  const handleFpsChange = (newFps: number) => {
    setFps(newFps)
    if (onFpsTargetChange) {
      onFpsTargetChange(newFps)
    }
  }

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto z-50">
      <Button
        variant="outline"
        size="sm"
        className="bg-black/70 border-2 border-red-900 hover:bg-red-900/20 text-red-500 font-silkscreen text-xs h-8 pixel-border"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Zap className="h-4 w-4 mr-1" />
        PERFORMANCE
      </Button>

      {isOpen && (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-black/90 border-2 border-red-900 p-4 rounded pixel-border w-64">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-red-500 font-silkscreen text-sm">PERFORMANCE SETTINGS</h3>
            <Settings className="h-4 w-4 text-red-500" />
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-red-400 font-silkscreen text-xs mb-2">QUALITY</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    quality === "low"
                      ? "bg-red-900/50 border-red-500"
                      : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => setQuality("low")}
                >
                  LOW
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    quality === "medium"
                      ? "bg-red-900/50 border-red-500"
                      : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => setQuality("medium")}
                >
                  MEDIUM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    quality === "high"
                      ? "bg-red-900/50 border-red-500"
                      : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => setQuality("high")}
                >
                  HIGH
                </Button>
              </div>
            </div>

            <div>
              <p className="text-red-400 font-silkscreen text-xs mb-2">SHADOWS</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    !shadows ? "bg-red-900/50 border-red-500" : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => setShadows(false)}
                >
                  OFF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    shadows ? "bg-red-900/50 border-red-500" : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => setShadows(true)}
                >
                  ON
                </Button>
              </div>
            </div>

            <div>
              <p className="text-red-400 font-silkscreen text-xs mb-2">EFFECTS</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    !effects ? "bg-red-900/50 border-red-500" : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => setEffects(false)}
                >
                  OFF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    effects ? "bg-red-900/50 border-red-500" : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => setEffects(true)}
                >
                  ON
                </Button>
              </div>
            </div>

            {/* FPS Target Setting */}
            <div>
              <p className="text-red-400 font-silkscreen text-xs mb-2">FPS LIMIT</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    fps === 30 ? "bg-red-900/50 border-red-500" : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => handleFpsChange(30)}
                >
                  30
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    fps === 60 ? "bg-red-900/50 border-red-500" : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => handleFpsChange(60)}
                >
                  60
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    fps === 120 ? "bg-red-900/50 border-red-500" : "bg-black/70 border-red-900 hover:bg-red-900/20"
                  } text-red-500 font-silkscreen text-xs h-8 pixel-border`}
                  onClick={() => handleFpsChange(120)}
                >
                  120
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
