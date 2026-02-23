import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatch } from '../context/MatchContext'
import { generateMatchReport, shareReport } from '../lib/matchReport'

export default function MatchResult({ isTournament }) {
  const navigate = useNavigate()
  const [shareStatus, setShareStatus] = useState(null)
  const {
    phase, result, innings, superOver, team1, team2,
    cumulativeScores, cumulativeBoundaries, getOrdinal, getNRR, dispatch,
    followOnEnforced,
  } = useMatch()

  if (phase !== 'match-over') return null

  const nrr1 = getNRR('team1')
  const nrr2 = getNRR('team2')

  return (
    <div className="setup-container">
      <div className="card match-result">
        <h2>Match Over</h2>
        <div className="result-text">{result}</div>

        <div className="final-scores">
          {innings.map((inn, idx) => (
            inn && inn.batsmen && inn.batsmen.length > 0 && (
              <div key={idx} className="innings-final">
                <span className="team-name">{inn.battingTeam} ({getOrdinal(idx + 1)} Inn)</span>
                <span className="final-score">
                  {inn.totalRuns}/{inn.wickets}
                </span>
                <span className="overs">({inn.oversCompleted}.{inn.ballsInCurrentOver} overs)</span>
              </div>
            )
          ))}
        </div>

        <div className="cumulative-summary">
          <h3>Cumulative Totals</h3>
          <div className="cumulative-row">
            <span>{team1}</span>
            <span className="cumulative-total">{cumulativeScores.team1}</span>
          </div>
          <div className="cumulative-row">
            <span>{team2}</span>
            <span className="cumulative-total">{cumulativeScores.team2}</span>
          </div>
        </div>

        <div className="boundaries-summary">
          <h3>Boundaries</h3>
          <div className="cumulative-row">
            <span>{team1}</span>
            <span>{cumulativeBoundaries.team1.fours} fours, {cumulativeBoundaries.team1.sixes} sixes</span>
          </div>
          <div className="cumulative-row">
            <span>{team2}</span>
            <span>{cumulativeBoundaries.team2.fours} fours, {cumulativeBoundaries.team2.sixes} sixes</span>
          </div>
        </div>

        {superOver && (
          <div className="super-over-summary">
            <h3>Super Over</h3>
            <div className="cumulative-row">
              <span>{superOver.battingFirst}</span>
              <span>{superOver.innings1.runs}/{superOver.innings1.wickets}</span>
            </div>
            <div className="cumulative-row">
              <span>{superOver.battingSecond}</span>
              <span>{superOver.innings2.runs}/{superOver.innings2.wickets}</span>
            </div>
          </div>
        )}

        <div className="nrr-summary">
          <h3>Net Run Rate</h3>
          <div className="cumulative-row">
            <span>{team1}</span>
            <span>{nrr1}</span>
          </div>
          <div className="cumulative-row">
            <span>{team2}</span>
            <span>{nrr2}</span>
          </div>
        </div>

        <button
          className="btn btn-outline btn-block"
          onClick={async () => {
            const report = generateMatchReport({
              innings, team1, team2, result, superOver,
              cumulativeScores, cumulativeBoundaries, followOnEnforced,
            })
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

        {isTournament ? (
          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </button>
        ) : (
          <button
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'NEW_MATCH' })}
          >
            New Match
          </button>
        )}
      </div>
    </div>
  )
}
