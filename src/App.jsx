import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const MatchPage = lazy(() => import('./pages/MatchPage'))
const MatchScoringPage = lazy(() => import('./pages/MatchScoringPage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const CommentaryPage = lazy(() => import('./pages/CommentaryPage'))

function PageLoader() {
  return <div className="app"><main className="app-main"><div className="card" style={{ textAlign: 'center' }}>Loading...</div></main></div>
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/match/:id" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
          <Route path="/match/:id/score" element={<ProtectedRoute requiredRole="scorer"><MatchScoringPage /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="organizer"><AdminPage /></ProtectedRoute>} />
          <Route path="/match/:id/commentary" element={<ProtectedRoute><CommentaryPage /></ProtectedRoute>} />
        </Routes>
      </Suspense>
      <NavBar />
    </>
  )
}
