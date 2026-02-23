import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSpectatorMode } from '../lib/firebase'

export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthEnabled, isAuthenticated, role, loading } = useAuth()

  // Spectator mode: allow public pages, block organizer-only pages
  if (isSpectatorMode) {
    if (requiredRole) return <Navigate to="/" replace />
    return children
  }

  if (!isAuthEnabled) return children

  if (loading) {
    return (
      <div className="app">
        <main className="app-main" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="auth-loading">Loading...</div>
        </main>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (requiredRole === 'organizer' && role !== 'organizer' && role !== 'owner') return <Navigate to="/" replace />
  if (requiredRole && requiredRole !== 'organizer' && role !== requiredRole) return <Navigate to="/" replace />

  return children
}
