import { useState, useEffect } from 'react'
import { useMatch } from '../context/MatchContext'
import { getBallClass } from '../lib/ballDisplay'
import { MAX_OVERS_PER_BOWLER, POWERPLAY_OVERS, BALLS_PER_OVER } from '../lib/constants'

export default function ScoreDisplay() {
  const {
    phase, innings, currentInnings, oversPerInnings, team1, team2,
    cumulativeScores, followOnEnforced, inningsTimers,
    getRunRate, getRequiredRunRate, getCumulativeTarget, getOrdinal,
  } = useMatch()

  if (phase !== 'scoring' && phase !== 'new-bowler') return null

  const inn = innings[currentInnings]
  if (!inn || !inn.batsmen || inn.batsmen.length < 2) return null

  const striker = inn.batsmen[inn.activeBatsmanIndex]
  const nonStriker = inn.batsmen[inn.nonStrikerIndex]
  const bowler = inn.bowlers[inn.currentBowlerIndex]

  if (!striker || !nonStriker || !bowler) return null

  const crr = getRunRate()
  const rrr = getRequiredRunRate()
  const cumulativeTarget = getCumulativeTarget()
  const ordinal = getOrdinal(currentInnings + 1)

  const battingKey = inn.battingTeam === team1 ? 'team1' : 'team2'
  const bowlingKey = inn.bowlingTeam === team1 ? 'team1' : 'team2'
  const currentCumulative = cumulativeScores[battingKey] + inn.totalRuns
  const opponentCumulative = cumulativeScores[bowlingKey]

  // Lead/deficit calculation (for innings 2+)
  const leadDeficit = currentInnings > 0 ? currentCumulative - opponentCumulative : null

  // Powerplay: first N overs
  const isPowerplay = inn.oversCompleted < POWERPLAY_OVERS
  const totalBalls = inn.oversCompleted * BALLS_PER_OVER + inn.ballsInCurrentOver

  // 4th innings required runs
  const isChasing = currentInnings === 3
  const requiredRuns = isChasing && cumulativeTarget ? cumulativeTarget - inn.totalRuns : null
  const remainingBalls = isChasing ? (oversPerInnings * BALLS_PER_OVER) - totalBalls : null

  return (
    <div className="score-display">
      {/* Team names and cumulative totals */}
      <div className="score-teams-bar">
        <div className={`score-team ${battingKey === 'team1' ? 'batting' : ''}`}>
          <span className="score-team-name">{team1}</span>
          <span className="score-team-total">{cumulativeScores.team1 + (inn.battingTeam === team1 ? inn.totalRuns : 0)}</span>
        </div>
        <div className="score-vs">vs</div>
        <div className={`score-team ${battingKey === 'team2' ? 'batting' : ''}`}>
          <span className="score-team-name">{team2}</span>
          <span className="score-team-total">{cumulativeScores.team2 + (inn.battingTeam === team2 ? inn.totalRuns : 0)}</span>
        </div>
      </div>

      {/* Current innings header */}
      <div className="score-header">
        <div className="team-score">
          <span className="team-name">
            {inn.battingTeam}
            <span className="innings-badge">{ordinal} Inn</span>
            {followOnEnforced && currentInnings >= 2 && (
              <span className="follow-on-badge">FOLLOW-ON</span>
            )}
          </span>
          <span className="score">{inn.totalRuns}/{inn.wickets}</span>
          {currentInnings > 0 && leadDeficit !== null && (
            <span className="lead-deficit">
              {leadDeficit > 0 ? `Lead by ${leadDeficit}` : leadDeficit < 0 ? `Trail by ${Math.abs(leadDeficit)}` : 'Scores level'}
            </span>
          )}
        </div>
        <div className="overs-info">
          <span className="overs">({inn.oversCompleted}.{inn.ballsInCurrentOver}/{oversPerInnings})</span>
          {isPowerplay && (
            <span className="powerplay-badge">PP</span>
          )}
        </div>
      </div>

      {/* Powerplay / fielding restrictions */}
      {isPowerplay ? (
        <div className="powerplay-bar">
          PP — POWERPLAY — Max 2 outside circle
        </div>
      ) : (
        <div className="fielding-bar">
          Max 5 fielders outside circle
        </div>
      )}

      {/* Required runs in 4th innings */}
      {isChasing && requiredRuns !== null && requiredRuns > 0 && (
        <div className="required-bar">
          Need {requiredRuns} from {remainingBalls} ball{remainingBalls !== 1 ? 's' : ''}
        </div>
      )}

      {/* Run rates */}
      <div className="rate-bar">
        <span>CRR: {crr}</span>
        {cumulativeTarget && cumulativeTarget > 0 && <span>Target: {cumulativeTarget}</span>}
        {rrr && <span>RRR: {rrr}</span>}
      </div>

      {/* Batsmen */}
      <div className="batsmen-info">
        <div className="batsman-row striker">
          <span className="striker-dot"></span>
          <span className="batsman-name">{striker.name}*</span>
          <span className="batsman-stats">{striker.runs} ({striker.balls})</span>
          <span className="batsman-sr">
            SR {striker.balls > 0 ? ((striker.runs / striker.balls) * 100).toFixed(1) : '0.0'}
          </span>
        </div>
        <div className="batsman-row">
          <span className="striker-dot hidden"></span>
          <span className="batsman-name">{nonStriker.name}</span>
          <span className="batsman-stats">{nonStriker.runs} ({nonStriker.balls})</span>
          <span className="batsman-sr">
            SR {nonStriker.balls > 0 ? ((nonStriker.runs / nonStriker.balls) * 100).toFixed(1) : '0.0'}
          </span>
        </div>
      </div>

      {/* Current bowler */}
      <div className="bowler-info">
        <span className="bowler-name">
          {bowler.name}
          <span className="bowler-cap">[{inn.bowlerOversMap?.[bowler.name] || 0}/{MAX_OVERS_PER_BOWLER} ov]</span>
        </span>
        <span className="bowler-stats">
          {bowler.overs}.{bowler.ballsInOver}-{bowler.maidens}-{bowler.runs}-{bowler.wickets}
        </span>
      </div>

      {/* This over strip */}
      {inn.currentOver?.length > 0 && (
        <div className="current-over">
          <span className="over-label">This Over:</span>
          <div className="over-balls">
            {(inn.currentOver || []).map((ball, i) => (
              <span key={i} className={`ball-badge ${getBallClass(ball)}`}>{ball}</span>
            ))}
          </div>
        </div>
      )}

      {/* Extras */}
      <div className="extras-line">
        Extras: {inn.extras?.wides || 0}w {inn.extras?.noBalls || 0}nb {inn.extras?.byes || 0}b {inn.extras?.legByes || 0}lb
        (Total: {(inn.extras?.wides || 0) + (inn.extras?.noBalls || 0) + (inn.extras?.byes || 0) + (inn.extras?.legByes || 0)})
      </div>

      {/* Innings Timer */}
      <InningsTimer startTime={inningsTimers[currentInnings]} />

      {/* Bowling Tracker */}
      <BowlingTracker innings={inn} currentBowlerIndex={inn.currentBowlerIndex} />
    </div>
  )
}

function InningsTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const update = () => setElapsed(Date.now() - startTime)
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startTime])

  if (!startTime) return null

  const totalSeconds = Math.floor(elapsed / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60

  return (
    <div className="innings-timer">
      <span className="timer-label">Innings Time:</span>
      <span className="timer-value">{mins}:{secs.toString().padStart(2, '0')}</span>
    </div>
  )
}

function BowlingTracker({ innings: inn, currentBowlerIndex }) {
  if (!inn || !inn.bowlers?.length) return null

  return (
    <div className="bowling-tracker">
      <h4>Bowling Figures</h4>
      <div className="bowling-list">
        {(inn.bowlers || []).map((b, idx) => {
          const overs = inn.bowlerOversMap?.[b.name] || 0
          const isCurrent = idx === currentBowlerIndex
          const isExhausted = overs >= MAX_OVERS_PER_BOWLER

          return (
            <div key={b.name} className={`bowling-row ${isCurrent ? 'current' : ''} ${isExhausted ? 'exhausted' : ''}`}>
              <span className="bowling-name">
                {b.name}
                {isExhausted && <span className="done-badge">DONE</span>}
              </span>
              <span className="bowling-figures">
                {b.overs}.{b.ballsInOver}-{b.maidens}-{b.runs}-{b.wickets}
              </span>
              <span className="bowling-overs-bar">
                <span className="overs-bar-fill" style={{ width: `${(overs / MAX_OVERS_PER_BOWLER) * 100}%` }}></span>
                <span className="overs-bar-text">{overs}/{MAX_OVERS_PER_BOWLER}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

