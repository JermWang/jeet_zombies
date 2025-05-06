"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Activity, X } from "lucide-react"

interface WorkerMonitorProps {
  workerPool?: {
    isReady: boolean
    activeWorkers: number
    totalWorkers: number
    queueLength: number
  }
}

export default function WorkerMonitor({ workerPool }: WorkerMonitorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState({
    isReady: false,
    activeWorkers: 0,
    totalWorkers: 0,
    queueLength: 0,
    tasksCompleted: 0,
    tasksPerSecond: 0,
    averageTaskTime: 0,
  })

  // Track task completion
  const [taskCompletions, setTaskCompletions] = useState<number[]>([])
  const [taskTimes, setTaskTimes] = useState<number[]>([])

  // Update stats from props
  useEffect(() => {
    if (workerPool) {
      setStats((prev) => ({
        ...prev,
        isReady: workerPool.isReady,
        activeWorkers: workerPool.activeWorkers,
        totalWorkers: workerPool.totalWorkers,
        queueLength: workerPool.queueLength,
      }))
    }
  }, [workerPool])

  // Listen for worker task events
  useEffect(() => {
    const handleTaskComplete = (e: CustomEvent) => {
      const { taskTime } = e.detail

      // Add task completion time
      const now = performance.now()
      setTaskCompletions((prev) => [...prev, now])

      // Add task time
      if (taskTime) {
        setTaskTimes((prev) => [...prev, taskTime])
      }

      // Increment completed tasks
      setStats((prev) => ({
        ...prev,
        tasksCompleted: prev.tasksCompleted + 1,
      }))
    }

    window.addEventListener("workerTaskComplete", handleTaskComplete as EventListener)

    return () => {
      window.removeEventListener("workerTaskComplete", handleTaskComplete as EventListener)
    }
  }, [])

  // Calculate tasks per second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now()

      // Filter completions from the last second
      const recentCompletions = taskCompletions.filter((time) => now - time < 1000)
      setTaskCompletions(recentCompletions)

      // Calculate tasks per second
      const tasksPerSecond = recentCompletions.length

      // Calculate average task time (from the last 100 tasks)
      const recentTimes = taskTimes.slice(-100)
      const averageTaskTime =
        recentTimes.length > 0 ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length : 0

      // Update stats
      setStats((prev) => ({
        ...prev,
        tasksPerSecond,
        averageTaskTime,
      }))

      // Limit the number of stored task times
      if (taskTimes.length > 1000) {
        setTaskTimes(taskTimes.slice(-500))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [taskCompletions, taskTimes])

  useEffect(() => {
    // Set up performance monitoring
    if (typeof window !== "undefined") {
      // Initialize component timing
      ;(window as any).componentTimes = {}
      ;(window as any).startComponentTimer = (componentName: string) => {
        ;(window as any).componentTimerStart = performance.now()
      }
      ;(window as any).endComponentTimer = (componentName: string) => {
        const end = performance.now()
        const start = (window as any).componentTimerStart || end
        const time = end - start
        ;(window as any).componentTimes = {
          ...((window as any).componentTimes || {}),
          [componentName]: time,
        }
      }

      // Initialize draw call tracking
      ;(window as any).drawCalls = 0
      ;(window as any).triangles = 0
      ;(window as any).textures = 0
    }

    return () => {
      // Clean up
      if (typeof window !== "undefined") {
        delete (window as any).componentTimes
        delete (window as any).startComponentTimer
        delete (window as any).endComponentTimer
        delete (window as any).drawCalls
        delete (window as any).triangles
        delete (window as any).textures
      }
    }
  }, [])

  return (
    <div className="absolute top-4 right-4 z-50 pointer-events-auto">
      <Button
        variant="outline"
        size="sm"
        className="bg-black/70 border-2 border-green-900 hover:bg-green-900/20 text-green-500 font-silkscreen text-xs h-8 pixel-border"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Activity className="h-4 w-4 mr-1" />
        WORKER STATS
      </Button>

      {isOpen && (
        <div className="absolute top-10 right-0 bg-black/90 border-2 border-green-900 p-4 rounded pixel-border w-64">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-green-500 font-silkscreen text-sm">WORKER MONITOR</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-green-500 hover:bg-green-900/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Status */}
            <div className="bg-black/70 p-2 border border-green-900 rounded">
              <div className="flex justify-between items-center">
                <span className="text-green-400 font-silkscreen text-xs">STATUS</span>
                <span className={`font-silkscreen text-sm ${stats.isReady ? "text-green-500" : "text-yellow-500"}`}>
                  {stats.isReady ? "READY" : "INITIALIZING"}
                </span>
              </div>
            </div>

            {/* Worker Stats */}
            <div className="bg-black/70 p-2 border border-green-900 rounded">
              <div className="flex items-center mb-2">
                <Activity className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-green-400 font-silkscreen text-xs">WORKER STATS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-green-300 font-silkscreen">Active Workers</div>
                <div className="text-right text-green-300 font-silkscreen">
                  {stats.activeWorkers} / {stats.totalWorkers}
                </div>
                <div className="text-green-300 font-silkscreen">Queue Length</div>
                <div className="text-right text-green-300 font-silkscreen">{stats.queueLength}</div>
                <div className="text-green-300 font-silkscreen">Tasks Completed</div>
                <div className="text-right text-green-300 font-silkscreen">{stats.tasksCompleted}</div>
                <div className="text-green-300 font-silkscreen">Tasks/Second</div>
                <div className="text-right text-green-300 font-silkscreen">{stats.tasksPerSecond}</div>
                <div className="text-green-300 font-silkscreen">Avg Task Time</div>
                <div className="text-right text-green-300 font-silkscreen">{stats.averageTaskTime.toFixed(2)} ms</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
