import { useRef, useCallback, useEffect } from 'react'

/**
 * Hook for capturing raw PCM audio from the microphone.
 * Uses AudioWorklet for efficient Float32→Int16 conversion.
 * Returns base64-encoded 16-bit LPCM at 16 kHz mono (Nova Sonic input format).
 */
export function useAudioCapture() {
  const streamRef = useRef(null)
  const contextRef = useRef(null)
  const workletRef = useRef(null)
  const chunksRef = useRef([])
  const recordingRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAndCleanup()
    }
  }, [])

  function stopAndCleanup() {
    recordingRef.current = false
    if (workletRef.current) {
      workletRef.current.disconnect()
      workletRef.current = null
    }
    if (contextRef.current && contextRef.current.state !== 'closed') {
      contextRef.current.close().catch(() => {})
      contextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
  }

  /**
   * Record from the microphone for `durationMs` milliseconds.
   * Returns a base64-encoded string of 16-bit LPCM audio at 16 kHz mono.
   */
  const record = useCallback(async (durationMs = 3000) => {
    stopAndCleanup()
    chunksRef.current = []
    recordingRef.current = true

    // Request mic access at 16 kHz mono
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    streamRef.current = stream

    // Create AudioContext at 16 kHz
    const audioCtx = new AudioContext({ sampleRate: 16000 })
    contextRef.current = audioCtx

    // Load the PCM worklet processor
    await audioCtx.audioWorklet.addModule('/audio-worklet-processor.js')

    const source = audioCtx.createMediaStreamSource(stream)
    const worklet = new AudioWorkletNode(audioCtx, 'pcm-processor')
    workletRef.current = worklet

    // Collect PCM chunks from the worklet
    worklet.port.onmessage = (e) => {
      if (recordingRef.current) {
        chunksRef.current.push(new Int16Array(e.data))
      }
    }

    source.connect(worklet)
    worklet.connect(audioCtx.destination)

    // Wait for the specified duration
    await new Promise((resolve) => setTimeout(resolve, durationMs))

    recordingRef.current = false

    // Merge all chunks into a single Int16Array
    const totalLength = chunksRef.current.reduce((sum, c) => sum + c.length, 0)
    const merged = new Int16Array(totalLength)
    let offset = 0
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    // Convert Int16Array to base64
    const bytes = new Uint8Array(merged.buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    // Cleanup
    stopAndCleanup()

    return base64
  }, [])

  return { record }
}
