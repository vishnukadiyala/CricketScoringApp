/**
 * Play base64-encoded LPCM audio (16-bit signed, mono) via Web Audio API.
 * Nova Sonic outputs at 24 kHz.
 */
export function playLPCMAudio(base64Audio, sampleRate = 24000) {
  if (!base64Audio) return Promise.resolve()

  return new Promise((resolve, reject) => {
    try {
      // Decode base64 to binary
      const binary = atob(base64Audio)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }

      // Convert Int16 PCM to Float32
      const int16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768
      }

      // Play via AudioContext
      const ctx = new AudioContext({ sampleRate })
      const buffer = ctx.createBuffer(1, float32.length, sampleRate)
      buffer.getChannelData(0).set(float32)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        ctx.close().catch(() => {})
        resolve()
      }
      source.start()
    } catch (err) {
      reject(err)
    }
  })
}
