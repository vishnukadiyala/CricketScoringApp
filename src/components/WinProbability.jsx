import { useCommentary } from '../context/CommentaryContext'

export default function LiveScoreBanner() {
  const { liveScore, winProbability } = useCommentary()

  if (!liveScore) return null

  const { battingTeam, bowlingTeam, runs, wickets, overs, balls, striker, nonStriker, bowler, target, inningsNum } = liveScore
  const oversDisplay = `${overs}.${balls}`

  return (
    <div className="live-score-banner">
      {/* Score header */}
      <div className="live-score-header">
        <div className="live-score-team">{battingTeam}</div>
        <div className="live-score-main">
          <span className="live-score-runs">{runs}/{wickets}</span>
          <span className="live-score-overs">({oversDisplay} ov)</span>
        </div>
        <div className="live-score-innings">Inn {inningsNum}</div>
      </div>

      {/* Target info */}
      {target != null && (
        <div className="live-score-target">
          Need {target - runs} from {(Math.max(0, 12 - overs) * 6) - balls} balls
        </div>
      )}

      {/* Batsmen + Bowler */}
      <div className="live-score-players">
        {striker && (
          <span className="live-player striker">
            {striker.name}* {striker.runs}({striker.balls})
          </span>
        )}
        {nonStriker && (
          <span className="live-player">
            {nonStriker.name} {nonStriker.runs}({nonStriker.balls})
          </span>
        )}
        {bowler && (
          <span className="live-player bowler">
            {bowler.name} {bowler.overs}-{bowler.runs}-{bowler.wickets}
          </span>
        )}
      </div>

      {/* Win probability bar */}
      {winProbability && (
        <div className="live-score-prob">
          <div className="win-prob-header">
            <span className="win-prob-team batting">{battingTeam} {winProbability.batting}%</span>
            <span className="win-prob-team bowling">{bowlingTeam} {winProbability.bowling}%</span>
          </div>
          <div className="win-prob-bar">
            <div className="win-prob-fill batting" style={{ width: `${winProbability.batting}%` }} />
            <div className="win-prob-fill bowling" style={{ width: `${winProbability.bowling}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
