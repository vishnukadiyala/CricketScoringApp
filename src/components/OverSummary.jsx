import { useMatch } from '../context/MatchContext'
import { getBallClass, calculateOverRuns } from '../lib/ballDisplay'

export default function OverSummary() {
  const { phase, innings, currentInnings, getOrdinal } = useMatch()

  if (phase !== 'scoring' && phase !== 'new-bowler' && phase !== 'innings-break'
      && phase !== 'match-over' && phase !== 'follow-on-decision' && phase !== 'squad-rotation') return null

  const inn = innings[currentInnings]
  if (!inn || !inn.allOvers?.length) return null

  const ordinal = getOrdinal(currentInnings + 1)

  return (
    <div className="over-summary">
      <h3>{inn.battingTeam} — {ordinal} Innings — Overs</h3>
      <div className="overs-list">
        {(inn.allOvers || []).map((over, idx) => {
          const overRuns = calculateOverRuns(over)

          return (
            <div key={idx} className="over-row">
              <span className="over-number">Ov {idx + 1}</span>
              <div className="over-balls">
                {over.map((ball, i) => (
                  <span key={`${idx}-${i}-${ball}`} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                ))}
              </div>
              <span className="over-total">{overRuns} runs</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
