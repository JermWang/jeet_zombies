"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface WorkerTask {
  id: number
  type: string
  data: any
  resolve: (result: any) => void
  reject: (error: any) => void
}

interface WorkerInstance {
  worker: Worker
  busy: boolean
  currentTask: WorkerTask | null
}

export default function useWorkerPool(workerCount = 4) {
  const [isReady, setIsReady] = useState(false)
  const [activeWorkers, setActiveWorkers] = useState(0)
  const workersRef = useRef<WorkerInstance[]>([])
  const taskQueue = useRef<WorkerTask[]>([])
  const taskIdCounter = useRef(0)
  const initialized = useRef(false)

  // Initialize worker pool
  useEffect(() => {
    // Skip if already initialized or running on server
    if (initialized.current || typeof window === "undefined") return
    initialized.current = true

    const workers: WorkerInstance[] = []
    let readyCount = 0

    // Create workers
    for (let i = 0; i < workerCount; i++) {
      try {
        // Create a new worker
        const worker = new Worker(new URL("../workers/pathfinding.worker.ts", import.meta.url))

        // Set up message handler
        worker.onmessage = (event) => {
          const { id, type, success, result, error } = event.data

          // Handle worker ready message
          if (type === "ready") {
            readyCount++
            if (readyCount === workerCount) {
              setIsReady(true)
            }
            return
          }

          // Find the worker instance
          const workerInstance = workers.find((w) => w.worker === worker)
          if (!workerInstance) return

          // Handle task completion
          if (workerInstance.currentTask && workerInstance.currentTask.id === id) {
            if (success) {
              workerInstance.currentTask.resolve(result)
            } else {
              workerInstance.currentTask.reject(new Error(error))
            }

            // Mark worker as available
            workerInstance.busy = false
            workerInstance.currentTask = null

            // Process next task if available
            processNextTask()
          }
        }

        // Handle worker errors
        worker.onerror = (error) => {
          console.error("Worker error:", error)

          // Find the worker instance
          const workerInstance = workers.find((w) => w.worker === worker)
          if (!workerInstance || !workerInstance.currentTask) return

          // Reject the current task
          workerInstance.currentTask.reject(error)

          // Mark worker as available
          workerInstance.busy = false
          workerInstance.currentTask = null

          // Process next task if available
          processNextTask()
        }

        // Add worker to pool
        workers.push({
          worker,
          busy: false,
          currentTask: null,
        })
      } catch (error) {
        console.error("Failed to create worker:", error)
      }
    }

    // Save workers to ref
    workersRef.current = workers

    // Function to process next task in queue
    function processNextTask() {
      // Skip if no tasks or no available workers
      if (taskQueue.current.length === 0) {
        setActiveWorkers(workers.filter((w) => w.busy).length)
        return
      }

      // Find available worker
      const availableWorker = workers.find((w) => !w.busy)
      if (!availableWorker) {
        setActiveWorkers(workers.filter((w) => w.busy).length)
        return
      }

      // Get next task
      const task = taskQueue.current.shift()
      if (!task) {
        setActiveWorkers(workers.filter((w) => w.busy).length)
        return
      }

      // Assign task to worker
      availableWorker.busy = true
      availableWorker.currentTask = task

      // Send task to worker
      availableWorker.worker.postMessage({
        type: task.type,
        id: task.id,
        ...task.data,
      })

      // Update active workers count
      setActiveWorkers(workers.filter((w) => w.busy).length)

      // Process next task if available
      if (taskQueue.current.length > 0) {
        processNextTask()
      }
    }
    // Expose processNextTask to component
    ;(window as any).__processNextWorkerTask = processNextTask

    // Clean up workers on unmount
    return () => {
      workers.forEach(({ worker }) => worker.terminate())
      delete (window as any).__processNextWorkerTask
    }
  }, [workerCount])

  // Function to execute a task on a worker
  const executeTask = useCallback(<T = any>(type: string, data: any): Promise<T> => {
    return new Promise((resolve, reject) => {
      // Create task
      const task: WorkerTask = {
        id: taskIdCounter.current++,
        type,
        data,
        resolve,
        reject,
      }

      // Add task to queue
      taskQueue.current.push(task)

      // Process task if possible
      if (typeof window !== "undefined" && (window as any).__processNextWorkerTask) {
        ;(window as any).__processNextWorkerTask()
      }
    })
  }, [])

  // Function to find a path
  const findPath = useCallback(
    (
      start: [number, number, number],
      end: [number, number, number],
      obstacles?: Array<{ position: [number, number, number]; radius: number }>,
    ) => {
      return executeTask<{ path: [number, number, number][]; direction: [number, number, number] }>("findPath", {
        start,
        end,
        obstacles,
      })
    },
    [executeTask],
  )

  // Function to perform a calculation
  const calculate = useCallback(
    <T = any>(operation: string, data: any): Promise<T> => {
      return executeTask<T>("calculate", { operation, data })
    },
    [executeTask],
  )

  return {
    isReady,
    activeWorkers,
    totalWorkers: workersRef.current.length,
    queueLength: taskQueue.current.length,
    findPath,
    calculate,
  }
}
