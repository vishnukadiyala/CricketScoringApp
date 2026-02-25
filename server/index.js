import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'

const PORT = process.env.PORT || 3001
const MODEL_ID = process.env.NOVA_MODEL_ID || 'amazon.nova-lite-v1:0'
const POLLY_VOICE = process.env.POLLY_VOICE || 'Matthew'
const POLLY_ENGINE = process.env.POLLY_ENGINE || 'generative'
const MAX_HISTORY_PAIRS = 3 // keep last 3 exchanges for context

const SYSTEM_PROMPT = `You are an enthusiastic cricket match storyteller — think of yourself as a podcast host following along live, not a traditional ball-by-ball TV commentator. Your job is to narrate the STORY of the match as it unfolds.

Style:
- 2-3 sentences maximum per ball.
- Speak naturally as if on air. No markdown, no asterisks, no bullet points.
- Never say "I" — you are the narrator, not a participant.
- Start immediately with the commentary. No preamble.
- IMPORTANT: Vary your language and phrasing. Do NOT repeat phrases you used in your previous commentaries. Check your prior responses and use different words, sentence structures, and observations each time.

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

const WIN_PROB_PROMPT = `You are a cricket match analyst AI. Given the current match situation, estimate each team's win probability as a percentage.

Consider these factors:
- Wickets in hand (more wickets = better for batting team)
- Required run rate vs current run rate
- Balls remaining
- Powerplay status
- Current batsmen's form (strike rate, boundaries)
- Bowler resources remaining
- In first innings: project the total based on current rate

Return ONLY valid JSON, nothing else:
{"batting": <number 0-100>, "bowling": <number 0-100>, "reason": "<one sentence explanation>"}`

const OVER_SUMMARY_PROMPT = `You are a cricket analyst. Summarize the over that just ended in 2-3 sentences.

Cover: runs scored, boundaries, wickets, bowler's performance, and what it means for the match.
Do NOT describe shot types or where the ball went — you don't have that information.
Do NOT use markdown formatting. Speak naturally.`

const INNINGS_REPORT_PROMPT = `You are a cricket analyst writing an innings summary. Write a 4-6 sentence report covering:

1. The total score and how it was built
2. Top performers with bat (name, runs, balls, boundaries)
3. Best bowlers (name, figures, economy)
4. Key partnerships and turning points
5. What it means for the match going forward

Do NOT describe shot types. Do NOT use markdown formatting. Write as a natural cricket report.`

const MATCH_REPORT_PROMPT = `You are a cricket journalist writing a match report. Write a comprehensive 6-8 sentence match summary covering:

1. The final result and winning margin
2. Player of the match recommendation with justification
3. The narrative arc — who was on top at different stages
4. Key turning points that decided the match
5. Standout individual performances
6. A concluding line capturing the drama

Do NOT describe shot types. Do NOT use markdown formatting. Write as a professional cricket match report.`

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}
const region = process.env.AWS_REGION || 'us-east-1'

const bedrockClient = new BedrockRuntimeClient({ region, credentials })
const pollyClient = new PollyClient({ region, credentials })

const app = express()
app.use(cors())
app.get('/', (_req, res) => res.json({ service: 'Cricket AI Commentary Server', status: 'running' }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// Per-socket conversation history for varied commentary
const socketHistory = new Map()

/**
 * Generate speech audio from text using Amazon Polly.
 * Returns base64-encoded MP3 audio.
 */
async function generateSpeech(text) {
  const command = new SynthesizeSpeechCommand({
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: POLLY_VOICE,
    Engine: POLLY_ENGINE,
    SampleRate: '24000',
  })

  const response = await pollyClient.send(command)
  const audioBytes = await response.AudioStream.transformToByteArray()
  return Buffer.from(audioBytes).toString('base64')
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)
  socketHistory.set(socket.id, [])

  // Room-based broadcasting: clients join a match room to receive live updates
  socket.on('join-match', (matchId) => {
    if (!matchId) return
    socket.join(`match:${matchId}`)
    socket.matchRoom = `match:${matchId}`
    console.log(`[${socket.id}] Joined room match:${matchId}`)
  })

  socket.on('commentary-request', async (data) => {
    const { contextText, entryId } = data
    if (!contextText) {
      socket.emit('commentary-error', { message: 'Missing contextText' })
      return
    }

    console.log(`[${socket.id}] Request: ${contextText.slice(0, 100)}...`)

    try {
      // Build messages with conversation history
      const history = socketHistory.get(socket.id) || []
      const messages = [
        ...history,
        { role: 'user', content: [{ text: contextText }] },
      ]

      const command = new ConverseStreamCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
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

      // Update conversation history (keep last N pairs)
      history.push(
        { role: 'user', content: [{ text: contextText }] },
        { role: 'assistant', content: [{ text: fullText }] },
      )
      while (history.length > MAX_HISTORY_PAIRS * 2) {
        history.splice(0, 2)
      }
      socketHistory.set(socket.id, history)

      const donePayload = { text: '', done: true, fullText, entryId }
      socket.emit('commentary-text', donePayload)
      // Broadcast full text to all viewers in the match room
      if (socket.matchRoom) {
        socket.to(socket.matchRoom).emit('commentary-broadcast', {
          entryId, fullText, meta: data.meta,
        })
      }

      console.log(`[${socket.id}] Text: "${fullText.slice(0, 120)}"`)

      // Generate speech audio via Polly (non-blocking for text delivery)
      if (fullText.trim()) {
        try {
          const audioBase64 = await generateSpeech(fullText)
          const audioPayload = {
            audio: audioBase64,
            done: true,
            fullAudio: audioBase64,
            format: 'mp3',
            entryId,
          }
          socket.emit('commentary-audio', audioPayload)
          if (socket.matchRoom) {
            socket.to(socket.matchRoom).emit('commentary-audio', audioPayload)
          }
          console.log(`[${socket.id}] Audio: ${Math.round(audioBase64.length / 1024)}KB MP3`)
        } catch (pollyErr) {
          console.error(`[${socket.id}] Polly error:`, pollyErr.message)
          socket.emit('commentary-audio', { audio: '', done: true, fullAudio: '', format: 'mp3', entryId })
        }
      } else {
        socket.emit('commentary-audio', { audio: '', done: true, fullAudio: '', format: 'mp3', entryId })
      }
    } catch (err) {
      console.error(`[${socket.id}] Failed:`, err.message || err)
      socket.emit('commentary-error', {
        message: err.message || 'Failed to generate commentary',
      })
    }
  })

  // ── Win probability (non-streaming, returns JSON) ──
  socket.on('analysis-request', async (data) => {
    const { contextText } = data
    if (!contextText) return

    try {
      const command = new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: WIN_PROB_PROMPT }],
        messages: [{ role: 'user', content: [{ text: contextText }] }],
        inferenceConfig: { maxTokens: 150, temperature: 0.3 },
      })

      const response = await bedrockClient.send(command)
      const raw = response.output?.message?.content?.[0]?.text || ''

      try {
        // Extract JSON from response (model may wrap it in markdown)
        const jsonStr = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(jsonStr)
        const result = {
          batting: Math.max(0, Math.min(100, parsed.batting || 50)),
          bowling: Math.max(0, Math.min(100, parsed.bowling || 50)),
          reason: parsed.reason || '',
        }
        socket.emit('analysis-result', result)
        if (socket.matchRoom) socket.to(socket.matchRoom).emit('analysis-result', result)
      } catch {
        // Fallback: couldn't parse JSON
        const fallback = { batting: 50, bowling: 50, reason: raw.slice(0, 200) }
        socket.emit('analysis-result', fallback)
        if (socket.matchRoom) socket.to(socket.matchRoom).emit('analysis-result', fallback)
      }

      console.log(`[${socket.id}] WinProb: ${raw.slice(0, 80)}`)
    } catch (err) {
      console.error(`[${socket.id}] Analysis failed:`, err.message)
    }
  })

  // ── Reports: over summary, innings report, match report ──
  socket.on('report-request', async (data) => {
    const { contextText, reportType } = data
    if (!contextText || !reportType) return

    const prompts = {
      over: OVER_SUMMARY_PROMPT,
      innings: INNINGS_REPORT_PROMPT,
      match: MATCH_REPORT_PROMPT,
    }
    const prompt = prompts[reportType]
    if (!prompt) return

    try {
      const command = new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: prompt }],
        messages: [{ role: 'user', content: [{ text: contextText }] }],
        inferenceConfig: {
          maxTokens: reportType === 'match' ? 600 : 400,
          temperature: 0.7,
        },
      })

      const response = await bedrockClient.send(command)
      const text = response.output?.message?.content?.[0]?.text || ''

      const reportPayload = { reportType, text, meta: data.meta }
      socket.emit('report-result', reportPayload)
      if (socket.matchRoom) socket.to(socket.matchRoom).emit('report-result', reportPayload)
      console.log(`[${socket.id}] Report(${reportType}): "${text.slice(0, 100)}"`)
    } catch (err) {
      console.error(`[${socket.id}] Report(${reportType}) failed:`, err.message)
    }
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    socketHistory.delete(socket.id)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Commentary server running on port ${PORT}`)
  console.log(`Using model: ${MODEL_ID}, voice: ${POLLY_VOICE} (${POLLY_ENGINE})`)
})
