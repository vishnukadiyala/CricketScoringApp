import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'

const PORT = process.env.PORT || 3001
const MODEL_ID = process.env.NOVA_MODEL_ID || 'amazon.nova-lite-v1:0'

const SYSTEM_PROMPT = `You are an enthusiastic, knowledgeable cricket commentator providing ball-by-ball commentary for a live cricket match. Your style is energetic and engaging — like a real TV commentator.

Rules:
- Keep each commentary to 2-3 sentences maximum.
- React to the ball event described — call out runs, boundaries, wickets with genuine excitement.
- Reference the batsman and bowler by name when provided.
- Mention the match situation (score, required rate, overs remaining) when it adds drama.
- Use vivid cricket language: "cracking drive", "thunderbolt yorker", "sliced to the boundary", "clean as a whistle".
- For dot balls, keep it brief but interesting.
- For wickets, be dramatic and describe the dismissal.
- For boundaries (4s and 6s), show excitement.
- Never say "I" — you're a commentator, not a participant.
- Do NOT repeat the score numbers robotically; weave them naturally.
- Respond as if speaking live on air. Start immediately with the commentary.
- Do NOT use markdown formatting, asterisks, or bullet points. Just speak naturally as a commentator would.`

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const app = express()
app.use(cors())
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('commentary-request', async (data) => {
    const { contextText } = data
    if (!contextText) {
      socket.emit('commentary-error', { message: 'Missing contextText' })
      return
    }

    console.log(`[${socket.id}] Request: ${contextText.slice(0, 100)}...`)

    try {
      const command = new ConverseStreamCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [
          {
            role: 'user',
            content: [{ text: contextText }],
          },
        ],
        inferenceConfig: {
          maxTokens: 256,
          temperature: 0.8,
          topP: 0.9,
        },
      })

      const response = await bedrockClient.send(command)

      let fullText = ''

      for await (const event of response.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          const text = event.contentBlockDelta.delta.text
          fullText += text
          socket.emit('commentary-text', { text, done: false })
        }
      }

      socket.emit('commentary-text', { text: '', done: true, fullText })
      socket.emit('commentary-audio', { audio: '', done: true, fullAudio: '' })

      console.log(`[${socket.id}] Done: "${fullText.slice(0, 120)}"`)
    } catch (err) {
      console.error(`[${socket.id}] Failed:`, err.message || err)
      socket.emit('commentary-error', {
        message: err.message || 'Failed to generate commentary',
      })
    }
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Commentary server running on port ${PORT}`)
  console.log(`Using model: ${MODEL_ID}`)
})
