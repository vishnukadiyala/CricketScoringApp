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

const SYSTEM_PROMPT = `You are an enthusiastic cricket match storyteller — think of yourself as a podcast host following along live, not a traditional ball-by-ball TV commentator. Your job is to narrate the STORY of the match as it unfolds.

Style:
- 2-3 sentences maximum per ball.
- Speak naturally as if on air. No markdown, no asterisks, no bullet points.
- Never say "I" — you are the narrator, not a participant.
- Start immediately with the commentary. No preamble.

What to talk about (USE the data you're given):
- Partnerships: how the current pair is building, how long they've been together, who's the aggressor.
- Milestones: when a batsman is close to 25, 50, 75, 100 — build anticipation. Celebrate when they reach it.
- Momentum shifts: dot ball pressure, boundary sprees, tight overs, expensive overs.
- The bowler's contest: economy rate, spell analysis, wickets in this spell.
- Match situation: run rate vs required rate, balls remaining, what the chasing team needs.
- Over narrative: reference what's happened this over so far (e.g. "two dots followed by a boundary").
- Fall of wickets: reference recent dismissals to set the scene.
- Powerplay and free hit context when active.

What NOT to talk about (STRICTLY FORBIDDEN — you will be wrong if you guess):
- Shot type — NEVER say "drive", "pull", "flick", "cut", "sweep", "edge", "loft", "dab", "glance", etc.
- Where the ball went — NEVER say "through covers", "past midwicket", "over long-on", "to third man", "through the gap", etc.
- Ball trajectory or length — NEVER say "yorker", "bouncer", "full toss", "short ball", "outside off", etc.
- Batsman movement — NEVER say "steps forward", "rocks back", "dances down the pitch", "charges", etc.
- You have ZERO information about how the ball was played. Describing shots is FABRICATION. Only describe the outcome and what it means for the match.

Vary your approach:
- For dot balls: talk about the pressure building, the bowler's control, or the batsman's patience.
- For singles/doubles: talk about rotation, partnership building, keeping the scoreboard moving.
- For boundaries: celebrate the outcome, talk about what it means for the run rate or milestone chase.
- For sixes: maximum excitement — talk about the batsman's intent and what it does to the match.
- For wickets: be dramatic. Name the dismissal type and fielder. Talk about what the partnership was worth and who comes in next.
- For extras: mention the discipline lapse and what it gifts to the batting side.`

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
