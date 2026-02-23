import { useTournament } from '../context/TournamentContext'
import { aggregatePlayerStats } from '../lib/playerStats'
import { loadMatch } from '../lib/storage'
import { getActivePlayerNames, countActivePlayers } from '../lib/squadUtils'

export default function TeamsPage() {
  const { teams, matches } = useTournament()

  if (teams.length === 0) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Teams</h1>
        </header>
        <main className="app-main">
          <div className="card" style={{ textAlign: 'center' }}>
            <p>No teams yet. Set up your tournament in Admin.</p>
          </div>
        </main>
      </div>
    )
  }

  // Load all completed match states
  const completedMatches = matches.filter(m => m.status === 'completed')
  const matchStates = completedMatches
    .map(m => loadMatch(m.id))
    .filter(Boolean)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Teams</h1>
      </header>
      <main className="app-main">
        {teams.map(team => {
          const stats = aggregatePlayerStats(team.id, team.name, matchStates)

          return (
            <div key={team.id} className="card team-card">
              <h2>{team.name}</h2>
              <p className="subtitle">Squad: {countActivePlayers(team.squad)} players</p>

              {stats.length > 0 ? (
                <div className="table-wrapper">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th className="col-name">Player</th>
                        <th className="col-stat">M</th>
                        <th className="col-stat">R</th>
                        <th className="col-stat">B</th>
                        <th className="col-stat">4s</th>
                        <th className="col-stat">6s</th>
                        <th className="col-stat">SR</th>
                        <th className="col-stat">W</th>
                        <th className="col-stat">Ec</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.sort((a, b) => b.batting.runs - a.batting.runs).map(p => (
                        <tr key={p.name}>
                          <td className="col-name">{p.name}</td>
                          <td className="col-stat">{p.matches}</td>
                          <td className="col-stat">{p.batting.runs}</td>
                          <td className="col-stat">{p.batting.balls}</td>
                          <td className="col-stat">{p.batting.fours}</td>
                          <td className="col-stat">{p.batting.sixes}</td>
                          <td className="col-stat">{p.batting.sr.toFixed(1)}</td>
                          <td className="col-stat">{p.bowling.wickets}</td>
                          <td className="col-stat">{p.bowling.economy.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="team-roster">
                  {getActivePlayerNames(team.squad).map((player, i) => (
                    <span key={i} className="chip">{player}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}
