import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import {
  buildCommentaryContext, describeBallEvent,
  buildOverSummaryContext, buildFullInningsContext, buildMatchReportContext,
} from '../lib/commentaryContext'
import { playMP3Audio } from '../lib/audioPlayback'
import { BALLS_PER_OVER } from '../lib/constants'

const CommentaryContext = createContext()

const COMMENTARY_SERVER = import.meta.env.VITE_COMMENTARY_SERVER_URL || 'http://localhost:3001'
const STORAGE_PREFIX = 'ncc_commentary_'

// ── State shape ──────────────────────────────────────────────────
const initialState = {
  entries: [],
  isEnabled: true,
  isAudioEnabled: true,
  isConnected: false,
  isGenerating: false,
  error: null,
  // Analysis
  winProbability: null,   // {batting: 65, bowling: 35, reason: "..."}
  overSummaries: [],      // [{overNumber, inningsIndex, text}]
  inningsReports: [],     // [{inningsIndex, text}]
  matchReport: null,      // string
}

function commentaryReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_ENABLED':
      return { ...state, isEnabled: !state.isEnabled, error: null }
    case 'TOGGLE_AUDIO':
      return { ...state, isAudioEnabled: !state.isAudioEnabled }
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.value }
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.value }

    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [...state.entries, {
          id: action.id, inningsIndex: action.inningsIndex,
          overNumber: action.overNumber, ballNumber: action.ballNumber,
          ballDisplay: action.ballDisplay, text: '', audioBase64: '',
          timestamp: Date.now(), status: 'generating',
        }],
      }
    case 'APPEND_TEXT': {
      const entries = state.entries.map((e) =>
        e.id === action.id ? { ...e, text: e.text + action.text } : e
      )
      return { ...state, entries }
    }
    case 'SET_FULL_TEXT': {
      const entries = state.entries.map((e) =>
        e.id === action.id ? { ...e, text: action.text, status: 'done' } : e
      )
      return { ...state, entries }
    }
    case 'SET_AUDIO': {
      const entries = state.entries.map((e) =>
        e.id === action.id ? { ...e, audioBase64: action.audio } : e
      )
      return { ...state, entries }
    }
    case 'SET_ERROR': {
      const entries = state.entries.map((e) =>
        e.id === action.id ? { ...e, status: 'error' } : e
      )
      return { ...state, entries, isGenerating: false, error: action.message }
    }
    case 'LOAD_ENTRIES':
      return { ...state, entries: action.entries }
    case 'CLEAR_ERROR':
      return { ...state, error: null }

    // Analysis
    case 'SET_WIN_PROBABILITY':
      return { ...state, winProbability: action.data }
    case 'ADD_OVER_SUMMARY':
      return { ...state, overSummaries: [...state.overSummaries, action.data] }
    case 'ADD_INNINGS_REPORT':
      return { ...state, inningsReports: [...state.inningsReports, action.data] }
    case 'SET_MATCH_REPORT':
      return { ...state, matchReport: action.text }
    case 'LOAD_ANALYSIS':
      return { ...state, ...action.data }

    default:
      return state
  }
}

// Derive ball display string from the action (matches MatchContext format)
function getBallDisplayFromAction(action) {
  if (action.wicket) return 'W'
  const runs = action.runs || 0
  switch (action.extraType) {
    case 'wide':   return runs > 0 ? `Wd+${runs}` : 'Wd'
    case 'noBall':  return runs > 0 ? `NB+${runs}` : 'NB'
    case 'bye':     return `B${runs}`
    case 'legBye':  return `LB${runs}`
    default:        return runs.toString()
  }
}

// ── Provider ─────────────────────────────────────────────────────
export function CommentaryProvider({ matchId, children }) {
  const [state, dispatch] = useReducer(commentaryReducer, initialState)
  const socketRef = useRef(null)
  const activeRequestRef = useRef(null)
  const audioQueueRef = useRef([])
  const isPlayingRef = useRef(false)
  const isAudioEnabledRef = useRef(state.isAudioEnabled)

  useEffect(() => { isAudioEnabledRef.current = state.isAudioEnabled }, [state.isAudioEnabled])

  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current) return
    const next = audioQueueRef.current.shift()
    if (!next) return
    isPlayingRef.current = true
    try { await playMP3Audio(next) } catch { /* skip */ }
    isPlayingRef.current = false
    processAudioQueue()
  }, [])

  // Load persisted entries + analysis from localStorage
  useEffect(() => {
    if (!matchId) return
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + matchId)
      if (saved) {
        const data = JSON.parse(saved)
        if (Array.isArray(data)) {
          // Legacy format: just entries
          dispatch({ type: 'LOAD_ENTRIES', entries: data.map((e) => ({ ...e, audioBase64: '' })) })
        } else {
          // New format: {entries, overSummaries, inningsReports, matchReport}
          dispatch({ type: 'LOAD_ENTRIES', entries: (data.entries || []).map((e) => ({ ...e, audioBase64: '' })) })
          dispatch({
            type: 'LOAD_ANALYSIS',
            data: {
              overSummaries: data.overSummaries || [],
              inningsReports: data.inningsReports || [],
              matchReport: data.matchReport || null,
            },
          })
        }
      }
    } catch { /* ignore */ }
  }, [matchId])

  // Persist entries + analysis
  useEffect(() => {
    if (!matchId || state.entries.length === 0) return
    try {
      const toSave = {
        entries: state.entries
          .filter((e) => e.status === 'done')
          .map(({ audioBase64, ...rest }) => rest),
        overSummaries: state.overSummaries,
        inningsReports: state.inningsReports,
        matchReport: state.matchReport,
      }
      localStorage.setItem(STORAGE_PREFIX + matchId, JSON.stringify(toSave))
    } catch { /* storage full */ }
  }, [matchId, state.entries, state.overSummaries, state.inningsReports, state.matchReport])

  // Socket.IO connection lifecycle
  useEffect(() => {
    if (!state.isEnabled) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        dispatch({ type: 'SET_CONNECTED', value: false })
      }
      return
    }

    const socket = io(COMMENTARY_SERVER, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', value: true })
      // Join match room so viewer tabs receive broadcasts
      if (matchId) socket.emit('join-match', matchId)
    })
    socket.on('disconnect', () => dispatch({ type: 'SET_CONNECTED', value: false }))
    socket.on('connect_error', () => dispatch({ type: 'SET_CONNECTED', value: false }))

    // Streamed text chunks
    socket.on('commentary-text', (data) => {
      const reqId = activeRequestRef.current
      if (!reqId) return
      if (data.done) {
        dispatch({ type: 'SET_FULL_TEXT', id: reqId, text: data.fullText || '' })
        dispatch({ type: 'SET_GENERATING', value: false })
        activeRequestRef.current = null
      } else {
        dispatch({ type: 'APPEND_TEXT', id: reqId, text: data.text || '' })
      }
    })

    // Audio (Polly MP3)
    socket.on('commentary-audio', (data) => {
      if (!data.fullAudio) return
      dispatch({ type: 'SET_AUDIO', id: data.entryId || '', audio: data.fullAudio })
      if (isAudioEnabledRef.current && data.fullAudio) {
        audioQueueRef.current.push(data.fullAudio)
        processAudioQueue()
      }
    })

    // Broadcast from scorer tab — viewer tabs receive full commentary entries
    socket.on('commentary-broadcast', (data) => {
      if (!data.entryId || !data.fullText) return
      dispatch({
        type: 'ADD_ENTRY', id: data.entryId,
        inningsIndex: data.meta?.inningsIndex ?? 0,
        overNumber: data.meta?.overNumber ?? 0,
        ballNumber: data.meta?.ballNumber ?? 0,
        ballDisplay: data.meta?.ballDisplay ?? '?',
      })
      dispatch({ type: 'SET_FULL_TEXT', id: data.entryId, text: data.fullText })
    })

    // Analysis results
    socket.on('analysis-result', (data) => {
      dispatch({ type: 'SET_WIN_PROBABILITY', data })
    })

    // Report results
    socket.on('report-result', (data) => {
      if (data.reportType === 'over') {
        dispatch({ type: 'ADD_OVER_SUMMARY', data: { text: data.text, ...data.meta } })
      } else if (data.reportType === 'innings') {
        dispatch({ type: 'ADD_INNINGS_REPORT', data: { text: data.text, ...data.meta } })
      } else if (data.reportType === 'match') {
        dispatch({ type: 'SET_MATCH_REPORT', text: data.text })
      }
    })

    socket.on('commentary-error', (data) => {
      const reqId = activeRequestRef.current
      dispatch({ type: 'SET_ERROR', id: reqId, message: data.message || 'Commentary failed' })
      activeRequestRef.current = null
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      dispatch({ type: 'SET_CONNECTED', value: false })
    }
  }, [state.isEnabled, processAudioQueue])

  /**
   * Request commentary + win probability for a ball event.
   * Also triggers over summary when an over ends.
   */
  const requestCommentary = useCallback(async (matchState, ballAction) => {
    if (!state.isEnabled || !socketRef.current?.connected) return

    const inn = matchState.innings?.[matchState.currentInnings]
    if (!inn) return

    const entryId = `${matchState.currentInnings}-${inn.oversCompleted}-${inn.ballsInCurrentOver}-${Date.now()}`

    // Derive ball display from the action (state is stale at this point)
    const ballDisplay = getBallDisplayFromAction(ballAction)

    dispatch({
      type: 'ADD_ENTRY', id: entryId,
      inningsIndex: matchState.currentInnings,
      overNumber: inn.oversCompleted,
      ballNumber: inn.ballsInCurrentOver,
      ballDisplay,
    })
    activeRequestRef.current = entryId
    dispatch({ type: 'SET_GENERATING', value: true })

    const contextText = [
      buildCommentaryContext(matchState, ballAction),
      '',
      'THIS BALL: ' + describeBallEvent(ballAction),
    ].join('\n')

    // Fire commentary request (include meta for broadcast to viewer tabs)
    socketRef.current.emit('commentary-request', {
      contextText, entryId,
      meta: {
        inningsIndex: matchState.currentInnings,
        overNumber: inn.oversCompleted,
        ballNumber: inn.ballsInCurrentOver,
        ballDisplay,
      },
    })

    // Fire win probability analysis (parallel, non-blocking)
    socketRef.current.emit('analysis-request', { contextText })

    // Check if this ball completes an over (legal delivery on ball 5)
    const isLegalDelivery = !ballAction.extraType || (ballAction.extraType !== 'wide' && ballAction.extraType !== 'noBall')
    if (isLegalDelivery && inn.ballsInCurrentOver === BALLS_PER_OVER - 1) {
      // Over will end after this ball — request over summary
      // Slight delay to let the state update first
      setTimeout(() => {
        const overContext = buildOverSummaryContext(matchState)
        socketRef.current?.emit('report-request', {
          contextText: overContext,
          reportType: 'over',
          meta: { overNumber: inn.oversCompleted + 1, inningsIndex: matchState.currentInnings },
        })
      }, 500)
    }
  }, [state.isEnabled])

  /**
   * Request an innings report. Call when innings ends.
   */
  const requestInningsReport = useCallback((matchState, inningsIndex) => {
    if (!socketRef.current?.connected) return
    const contextText = buildFullInningsContext(matchState, inningsIndex)
    socketRef.current.emit('report-request', {
      contextText,
      reportType: 'innings',
      meta: { inningsIndex },
    })
  }, [])

  /**
   * Request a full match report. Call when match ends.
   */
  const requestMatchReport = useCallback((matchState) => {
    if (!socketRef.current?.connected) return
    const contextText = buildMatchReportContext(matchState)
    socketRef.current.emit('report-request', { contextText, reportType: 'match' })
  }, [])

  const toggleEnabled = useCallback(() => dispatch({ type: 'TOGGLE_ENABLED' }), [])
  const toggleAudio = useCallback(() => dispatch({ type: 'TOGGLE_AUDIO' }), [])
  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), [])

  const value = {
    ...state,
    requestCommentary,
    requestInningsReport,
    requestMatchReport,
    toggleEnabled,
    toggleAudio,
    clearError,
  }

  return (
    <CommentaryContext.Provider value={value}>
      {children}
    </CommentaryContext.Provider>
  )
}

const NOOP = () => {}
const NOOP_ASYNC = async () => {}
const fallback = {
  entries: [], isEnabled: false, isAudioEnabled: false, isConnected: false,
  isGenerating: false, error: null,
  winProbability: null, overSummaries: [], inningsReports: [], matchReport: null,
  requestCommentary: NOOP_ASYNC, requestInningsReport: NOOP, requestMatchReport: NOOP,
  toggleEnabled: NOOP, toggleAudio: NOOP, clearError: NOOP,
}

export function useCommentary() {
  const ctx = useContext(CommentaryContext)
  return ctx || fallback
}
