/**
 * Play base64-encoded MP3 audio via HTML Audio element.
 * Returns a promise that resolves when playback finishes.
 */
export function playMP3Audio(base64Audio) {
  if (!base64Audio) return Promise.resolve()

  return new Promise((resolve, reject) => {
    try {
      const bytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); resolve() }
      audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Audio playback failed')) }
      audio.play().catch(reject)
    } catch (err) {
      reject(err)
    }
  })
}
