"use client"

import { useState, useEffect, useCallback } from "react"

export default function useAudio(url: string) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [audioLoaded, setAudioLoaded] = useState(false)

  // Initialize audio with error handling
  useEffect(() => {
    if (typeof window === "undefined" || typeof Audio === "undefined") return

    // Create audio element
    const audioElement = new Audio()

    // Add event listeners for error handling
    const handleCanPlay = () => {
      console.log("Audio can play:", url)
      setAudioLoaded(true)
    }

    const handleError = (e: ErrorEvent) => {
      console.error("Audio error:", e)
      setAudioLoaded(false)
    }

    audioElement.addEventListener("canplay", handleCanPlay)
    audioElement.addEventListener("error", handleError)

    // Set properties
    audioElement.loop = true
    audioElement.volume = 0.3
    audioElement.muted = isMuted

    // Set source - use a relative path that works in the browser
    audioElement.src = url

    // Store the audio element
    setAudio(audioElement)

    return () => {
      audioElement.removeEventListener("canplay", handleCanPlay)
      audioElement.removeEventListener("error", handleError)
      audioElement.pause()
      setAudio(null)
    }
  }, [url])

  const togglePlay = useCallback(() => {
    if (!audio || !audioLoaded) return

    if (!playing) {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.error("Audio playback failed:", e)
        })
      }
    } else {
      audio.pause()
    }

    setPlaying(!playing)
  }, [audio, playing, audioLoaded])

  const toggleMute = useCallback(() => {
    if (!audio) return

    const newMutedState = !isMuted
    audio.muted = newMutedState
    setIsMuted(newMutedState)
  }, [audio, isMuted])

  // Auto-play when user interacts with the page
  useEffect(() => {
    if (!audio || !audioLoaded) return

    const handleInteraction = () => {
      if (isMuted) {
        setIsMuted(false)
        if (audio) audio.muted = false
        setPlaying(true)
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.error("Audio playback failed on interaction:", e)
          })
        }
      }
    }

    window.addEventListener("click", handleInteraction)
    window.addEventListener("keydown", handleInteraction)

    return () => {
      window.removeEventListener("click", handleInteraction)
      window.removeEventListener("keydown", handleInteraction)
    }
  }, [isMuted, audio, audioLoaded])

  return { playing, togglePlay, isMuted, toggleMute, audioLoaded }
}
