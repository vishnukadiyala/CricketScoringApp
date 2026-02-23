import { useMatch } from '../context/MatchContext'

export default function InningsBreak() {
  const {
    phase, innings, currentInnings, cumulativeScores, team1, team2,
    inningsTimers, getOrdinal, dispatch,
  } = useMatch()

  // Follow-on decision
  if (phase === 'follow-on-decision') {
    const inn0 = innings[0]
    const inn1 = innings[1]
    const leadTeam = inn0.battingTeam
    const trailTeam = inn1.battingTeam

    return (
      <div className="setup-container">
        <div className="card innings-break">
          <h2>Follow-On Decision</h2>

          <div className="completed-innings-list">
            {[0, 1].map(idx => {
              const inn = innings[idx]
              if (!inn) return null
              return (
                <InningsSummaryCard key={idx} inn={inn} idx={idx} getOrdinal={getOrdinal} inningsTimers={inningsTimers} />
              )
            })}
          </div>

          <div className="follow-on-info">
            <p>
              <strong>{leadTeam}</strong> can enforce the follow-on.
            </p>
            <p>
              {trailTeam} scored {inn1.totalRuns} (less than 50% of {inn0.totalRuns})
            </p>
          </div>

          <div className="btn-group" style={{ marginTop: '16px' }}>
            <button
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'DECIDE_FOLLOW_ON', enforce: true })}
            >
              Enforce Follow-On
            </button>
            <button
              className="btn btn-outline"
              onClick={() => dispatch({ type: 'DECIDE_FOLLOW_ON', enforce: false })}
            >
              Continue Normal Order
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Regular innings break
  if (phase !== 'innings-break') return null

  const completedInnings = innings.slice(0, currentInnings + 1).filter(Boolean)
  const nextInningsNum = currentInnings + 2
  const ordinal = getOrdinal(nextInningsNum)

  // Cumulative scores
  const t1Cumulative = cumulativeScores.team1
  const t2Cumulative = cumulativeScores.team2

  return (
    <div className="setup-container">
      <div className="card innings-break">
        <h2>Innings Break</h2>

        <div className="completed-innings-list">
          {completedInnings.map((inn, idx) => (
            <InningsSummaryCard key={idx} inn={inn} idx={idx} getOrdinal={getOrdinal} inningsTimers={inningsTimers} />
          ))}
        </div>

        <div className="cumulative-summary">
          <h3>Cumulative Scores</h3>
          <div className="cumulative-row">
            <span>{team1}</span>
            <span className="cumulative-total">{t1Cumulative}</span>
          </div>
          <div className="cumulative-row">
            <span>{team2}</span>
            <span className="cumulative-total">{t2Cumulative}</span>
          </div>
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={() => dispatch({ type: 'START_NEXT_INNINGS' })}
        >
          Start {ordinal} Innings
        </button>
      </div>
    </div>
  )
}

function InningsSummaryCard({ inn, idx, getOrdinal, inningsTimers }) {
  if (!inn) return null

  const totalExtras = inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes
  const timerStart = inningsTimers?.[idx]
  // Use innings end time if available, otherwise capture a stable reference
  const elapsed = timerStart ? (inn.endTime || timerStart) - timerStart : null
  const duration = elapsed !== null ? formatDuration(elapsed) : null

  return (
    <div className="innings-summary-card">
      <div className="innings-summary-header">
        <span className="team-name">{inn.battingTeam} ({getOrdinal(idx + 1)} Inn)</span>
        <span className="final-score">{inn.totalRuns}/{inn.wickets}</span>
        <span className="overs">({inn.oversCompleted}.{inn.ballsInCurrentOver} overs)</span>
      </div>

      <div className="innings-summary-details">
        <div className="summary-row">
          <span className="summary-label">Extras:</span>
          <span className="summary-value">
            {totalExtras} ({inn.extras.wides}w, {inn.extras.noBalls}nb, {inn.extras.byes}b, {inn.extras.legByes}lb)
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Boundaries:</span>
          <span className="summary-value">{inn.fours} fours, {inn.sixes} sixes</span>
        </div>
        {duration && (
          <div className="summary-row">
            <span className="summary-label">Duration:</span>
            <span className="summary-value">{duration}</span>
          </div>
        )}
        {inn.fallOfWickets.length > 0 && (
          <div className="summary-row fow-row">
            <span className="summary-label">Fall of Wickets:</span>
            <div className="fow-list">
              {inn.fallOfWickets.map((fow, i) => (
                <span key={i} className="fow-item">
                  {fow.wickets}-{fow.runs} ({fow.batsmanName}, {fow.overs} ov)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
