import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { loadMatch } from '../lib/storage'
import { db, isFirebaseConfigured, isSpectatorMode } from '../lib/firebase'
import { ref, onValue, off } from 'firebase/database'
import { useTournament } from '../context/TournamentContext'
import MatchScorecard from '../components/MatchScorecard'
import { generateMatchReport, shareReport } from '../lib/matchReport'

// Firebase stores arrays as objects with numeric keys — deep convert back
function deepRestoreArrays(obj) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(deepRestoreArrays)
  if (typeof obj === 'object') {
    const keys = Object.keys(obj)
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
      return Object.values(obj).map(deepRestoreArrays)
    }
    const result = {}
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deepRestoreArrays(v)
    }
    return result
  }
  return obj
}

function restoreMatchDefaults(state) {
  if (!state || !state.innings) return state
  const innings = (Array.isArray(state.innings) ? state.innings : Object.values(state.innings)).map(inn => {
    if (!inn) return inn
    return {
      ...inn,
      currentOver: inn.currentOver || [],
      allOvers: inn.allOvers || [],
      batsmen: inn.batsmen || [],
      bowlers: inn.bowlers || [],
      fallOfWickets: inn.fallOfWickets || [],
      bowlerOversMap: inn.bowlerOversMap || {},
      extras: inn.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    }
  })
  return { ...state, innings }
}

export default function MatchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getTeamName, matches } = useTournament()
  const [shareStatus, setShareStatus] = useState(null)
  const [liveState, setLiveState] = useState(null)

  // Listen to Firebase for live match data
  useEffect(() => {
    if (!isFirebaseConfigured || !id) return

    const matchRef = ref(db, `matches/${id}`)
    const handler = (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const { _lastWriteTime, ...cleaned } = data
        const restored = deepRestoreArrays(cleaned)
        setLiveState(restoreMatchDefaults(restored))
      }
    }

    onValue(matchRef, handler)
    return () => off(matchRef, 'value', handler)
  }, [id])

  const match = matches.find(m => m.id === id)

  // Use Firebase live data if available, otherwise fall back to localStorage
  const matchState = liveState || loadMatch(id)

  if (!match) {
    return (
      <div className="app">
        <main className="app-main">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Match not found</h2>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    )
  }

  const typeLabel = match.type === 'league' ? 'League' :
    match.type === 'eliminator' ? 'Eliminator' : 'Final'

  return (
    <div className="app">
      <header className="app-header">
        <h1>Match {match.matchNumber} — {typeLabel}</h1>
        {match.status === 'live' && (
          <div className="live-indicator">LIVE</div>
        )}
      </header>
      <main className="app-main">
        <div className="match-page-teams">
          <span>{getTeamName(match.team1Id)}</span>
          <span className="schedule-vs">vs</span>
          <span>{getTeamName(match.team2Id)}</span>
        </div>

        {matchState ? (
          <MatchScorecard matchState={matchState} />
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <p>No scorecard data available.</p>
            {match.result && <p className="result-text">{match.result}</p>}
          </div>
        )}

        {matchState && !isSpectatorMode && (
          <>
            <button
              className="btn btn-outline btn-block"
              onClick={async () => {
                const report = generateMatchReport(matchState)
                const status = await shareReport(report)
                if (status === 'copied') {
                  setShareStatus('Copied to clipboard!')
                  setTimeout(() => setShareStatus(null), 2000)
                } else if (status === 'failed') {
                  setShareStatus('Could not share')
                  setTimeout(() => setShareStatus(null), 2000)
                }
              }}
            >
              Share Match Report
            </button>
            {shareStatus && <div className="share-feedback">{shareStatus}</div>}
          </>
        )}

        <button className="btn btn-outline btn-block" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </main>
    </div>
  )
}
