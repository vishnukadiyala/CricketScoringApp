import { memo } from 'react'
import { useTournament } from '../context/TournamentContext'
import { computeStandings } from '../lib/standings'

export default memo(function PointsTable() {
  const { teams, matches } = useTournament()

  if (teams.length === 0) return null

  const standings = computeStandings(teams, matches)

  return (
    <div className="card points-table">
      <h2>Points Table</h2>
      <div className="table-wrapper">
        <table className="standings-table">
          <caption className="sr-only">Tournament standings</caption>
          <thead>
            <tr>
              <th scope="col" className="col-pos">#</th>
              <th scope="col" className="col-team">Team</th>
              <th scope="col" className="col-num">P</th>
              <th scope="col" className="col-num">W</th>
              <th scope="col" className="col-num">L</th>
              <th scope="col" className="col-num">T</th>
              <th scope="col" className="col-num">Pts</th>
              <th scope="col" className="col-nrr">NRR</th>
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
})
