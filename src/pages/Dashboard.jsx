import { Navigate } from 'react-router-dom'
import { useTournament } from '../context/TournamentContext'
import PointsTable from '../components/PointsTable'
import MatchSchedule from '../components/MatchSchedule'
import SpiritTracker from '../components/SpiritTracker'
import SyncStatus from '../components/SyncStatus'

export default function Dashboard() {
  const { teams, name, phase } = useTournament()

  if (teams.length === 0) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{name}</h1>
        <SyncStatus />
        {phase === 'completed' && (
          <div className="tournament-complete-badge">Tournament Complete</div>
        )}
      </header>
      <main className="app-main">
        <PointsTable />
        <MatchSchedule />
        <SpiritTracker />
      </main>
    </div>
  )
}
