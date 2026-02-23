import { useTournament } from '../context/TournamentContext'
import { computeStandings } from '../lib/standings'

export default function PointsTable() {
  const { teams, matches } = useTournament()

  if (teams.length === 0) return null

  const standings = computeStandings(teams, matches)

  return (
    <div className="card points-table">
      <h2>Points Table</h2>
      <div className="table-wrapper">
        <table className="standings-table">
          <thead>
            <tr>
              <th className="col-pos">#</th>
              <th className="col-team">Team</th>
              <th className="col-num">P</th>
              <th className="col-num">W</th>
              <th className="col-num">L</th>
              <th className="col-num">T</th>
              <th className="col-num">Pts</th>
              <th className="col-nrr">NRR</th>
            </tr>
          </thead>
          <tbody>
            {standings.map(s => (
              <tr
                key={s.teamId}
                className={
                  s.position === 1 ? 'row-first' :
                  s.position <= 3 ? 'row-playoff' : ''
                }
              >
                <td className="col-pos">{s.position}</td>
                <td className="col-team">{s.teamName}</td>
                <td className="col-num">{s.played}</td>
                <td className="col-num">{s.won}</td>
                <td className="col-num">{s.lost}</td>
                <td className="col-num">{s.tied}</td>
                <td className="col-num col-pts">{s.points}</td>
                <td className="col-nrr">{s.nrr >= 0 ? '+' : ''}{s.nrr.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
