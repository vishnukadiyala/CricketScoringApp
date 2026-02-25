import { useCommentary } from '../context/CommentaryContext'

export default function WinProbability({ battingTeam, bowlingTeam }) {
  const { winProbability } = useCommentary()

  if (!winProbability) return null

  const battingPct = winProbability.batting
  const bowlingPct = winProbability.bowling

  return (
    <div className="win-probability">
      <div className="win-prob-header">
        <span className="win-prob-team batting">{battingTeam || 'Batting'} {battingPct}%</span>
        <span className="win-prob-label">Win Probability</span>
        <span className="win-prob-team bowling">{bowlingTeam || 'Bowling'} {bowlingPct}%</span>
      </div>
      <div className="win-prob-bar">
        <div
          className="win-prob-fill batting"
          style={{ width: `${battingPct}%` }}
        />
        <div
          className="win-prob-fill bowling"
          style={{ width: `${bowlingPct}%` }}
        />
      </div>
      {winProbability.reason && (
        <div className="win-prob-reason">{winProbability.reason}</div>
      )}
    </div>
  )
}
