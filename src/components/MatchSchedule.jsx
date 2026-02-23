import { useNavigate } from 'react-router-dom'
import { useTournament } from '../context/TournamentContext'

export default function MatchSchedule() {
  const { matches, dispatch, getTeamName } = useTournament()
  const navigate = useNavigate()

  if (matches.length === 0) return null

  const handleStartMatch = (matchId) => {
    dispatch({ type: 'START_MATCH', matchId })
    navigate(`/match/${matchId}/score`)
  }

  const typeLabel = (type) => {
    if (type === 'league') return 'League'
    if (type === 'eliminator') return 'Eliminator'
    if (type === 'final') return 'Final'
    return type
  }

  return (
    <div className="card match-schedule">
      <h2>Schedule</h2>
      <div className="schedule-list">
        {matches.map(match => (
          <div key={match.id} className={`schedule-card status-${match.status}`}>
            <div className="schedule-header">
              <span className="match-type-label">{typeLabel(match.type)}</span>
              <span className={`status-badge ${match.status}`}>
                {match.status === 'upcoming' ? 'Upcoming' :
                 match.status === 'live' ? 'Live' : 'Completed'}
              </span>
            </div>
            <div className="schedule-teams">
              <span className="schedule-team">{getTeamName(match.team1Id)}</span>
              <span className="schedule-vs">vs</span>
              <span className="schedule-team">{getTeamName(match.team2Id)}</span>
            </div>
            {match.result && (
              <div className="schedule-result">{match.result}</div>
            )}
            <div className="schedule-actions">
              {match.status === 'upcoming' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleStartMatch(match.id)}
                >
                  Start Match
                </button>
              )}
              {match.status === 'live' && (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/match/${match.id}/score`)}
                >
                  Continue Scoring
                </button>
              )}
              {match.status === 'completed' && (
                <button
                  className="btn btn-outline"
                  onClick={() => navigate(`/match/${match.id}`)}
                >
                  View Scorecard
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
