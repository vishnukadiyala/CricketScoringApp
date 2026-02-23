import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthEnabled, isAuthenticated, role, loading } = useAuth()

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

  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />

  return children
}
