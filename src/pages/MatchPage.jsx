import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { loadMatch } from '../lib/storage'
import { useTournament } from '../context/TournamentContext'
import MatchScorecard from '../components/MatchScorecard'
import { generateMatchReport, shareReport } from '../lib/matchReport'

export default function MatchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getTeamName, matches } = useTournament()
  const [shareStatus, setShareStatus] = useState(null)

  const match = matches.find(m => m.id === id)
  const matchState = loadMatch(id)

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

        {matchState && (
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
