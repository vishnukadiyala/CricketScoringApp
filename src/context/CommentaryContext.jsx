import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { buildCommentaryContext, describeBallEvent } from '../lib/commentaryContext'

const CommentaryContext = createContext()

const COMMENTARY_SERVER = import.meta.env.VITE_COMMENTARY_SERVER_URL || 'http://localhost:3001'
const STORAGE_PREFIX = 'ncc_commentary_'

// ── State shape ──────────────────────────────────────────────────
const initialState = {
  entries: [],       // [{id, inningsIndex, overNumber, ballNumber, ballDisplay, text, audioBase64, timestamp, status}]
  isEnabled: true,   // always on by default
  isConnected: false,
  isGenerating: false,
  error: null,
}

function commentaryReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_ENABLED':
      return { ...state, isEnabled: !state.isEnabled, error: null }

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.value }

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.value }

    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [...state.entries, {
          id: action.id,
          inningsIndex: action.inningsIndex,
          overNumber: action.overNumber,
          ballNumber: action.ballNumber,
          ballDisplay: action.ballDisplay,
          text: '',
          audioBase64: '',
          timestamp: Date.now(),
          status: 'generating',
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

    default:
      return state
  }
}

// ── Provider ─────────────────────────────────────────────────────
export function CommentaryProvider({ matchId, children }) {
  const [state, dispatch] = useReducer(commentaryReducer, initialState)
  const socketRef = useRef(null)
  const activeRequestRef = useRef(null)

  // Load persisted text entries from localStorage
  useEffect(() => {
    if (!matchId) return
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + matchId)
      if (saved) {
        const entries = JSON.parse(saved)
        dispatch({ type: 'LOAD_ENTRIES', entries: entries.map((e) => ({ ...e, audioBase64: '' })) })
      }
    } catch { /* ignore */ }
  }, [matchId])

  // Persist text entries when they change
  useEffect(() => {
    if (!matchId || state.entries.length === 0) return
    try {
      const toSave = state.entries
        .filter((e) => e.status === 'done')
        .map(({ audioBase64, ...rest }) => rest)
      localStorage.setItem(STORAGE_PREFIX + matchId, JSON.stringify(toSave))
    } catch { /* storage full */ }
  }, [matchId, state.entries])

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

    socket.on('connect', () => dispatch({ type: 'SET_CONNECTED', value: true }))
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

    // Streamed audio — collect final combined audio
    socket.on('commentary-audio', (data) => {
      const reqId = activeRequestRef.current
      if (!reqId) return
      if (data.done && data.fullAudio) {
        dispatch({ type: 'SET_AUDIO', id: reqId, audio: data.fullAudio })
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
  }, [state.isEnabled])

  /**
   * Request commentary for a ball event.
   * Sends match context + ball description as text to Nova Sonic,
   * which generates spoken commentary (audio) + transcript (text).
   */
  const requestCommentary = useCallback(async (matchState, ballAction) => {
    if (!state.isEnabled || !socketRef.current?.connected) return

    const inn = matchState.innings?.[matchState.currentInnings]
    if (!inn) return

    const entryId = `${matchState.currentInnings}-${inn.oversCompleted}-${inn.ballsInCurrentOver}-${Date.now()}`
    const lastBall = inn.currentOver?.[inn.currentOver.length - 1] || '?'

    dispatch({
      type: 'ADD_ENTRY',
      id: entryId,
      inningsIndex: matchState.currentInnings,
      overNumber: inn.oversCompleted,
      ballNumber: inn.ballsInCurrentOver,
      ballDisplay: lastBall,
    })
    activeRequestRef.current = entryId
    dispatch({ type: 'SET_GENERATING', value: true })

    // Build text context describing the match situation + what just happened
    const contextText = [
      buildCommentaryContext(matchState),
      '',
      'THIS BALL: ' + describeBallEvent(ballAction),
    ].join('\n')

    // Send text-only request to backend
    socketRef.current.emit('commentary-request', { contextText })
  }, [state.isEnabled])

  const toggleEnabled = useCallback(() => {
    dispatch({ type: 'TOGGLE_ENABLED' })
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  const value = {
    ...state,
    requestCommentary,
    toggleEnabled,
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
  entries: [], isEnabled: false, isConnected: false,
  isGenerating: false, error: null,
  requestCommentary: NOOP_ASYNC, toggleEnabled: NOOP, clearError: NOOP,
}

export function useCommentary() {
  const ctx = useContext(CommentaryContext)
  return ctx || fallback
}
