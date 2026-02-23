import { Navigate } from 'react-router-dom'
import { useTournament } from '../context/TournamentContext'
import { useAuth } from '../context/AuthContext'
import { isSpectatorMode } from '../lib/firebase'
import PointsTable from '../components/PointsTable'
import MatchSchedule from '../components/MatchSchedule'
import SpiritTracker from '../components/SpiritTracker'
import SyncStatus from '../components/SyncStatus'

export default function Dashboard() {
  const { teams, name, phase } = useTournament()
  const { isAuthEnabled, isOrganizer } = useAuth()

  if (teams.length === 0) {
    // Spectators and non-organizers see a message
    if (isSpectatorMode || (isAuthEnabled && !isOrganizer)) {
      return (
        <div className="app">
          <header className="app-header">
            <h1>NCC Cricket</h1>
          </header>
          <main className="app-main" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <h2>Tournament Setup In Progress</h2>
              <p className="text-muted" style={{ marginTop: '8px' }}>
                The organizer hasn't set up the tournament yet. Check back soon!
              </p>
            </div>
          </main>
        </div>
      )
    }
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
