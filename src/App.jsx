import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import MatchPage from './pages/MatchPage'
import MatchScoringPage from './pages/MatchScoringPage'
import TeamsPage from './pages/TeamsPage'
import AdminPage from './pages/AdminPage'
import StatsPage from './pages/StatsPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/match/:id" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
        <Route path="/match/:id/score" element={<ProtectedRoute requiredRole="organizer"><MatchScoringPage /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requiredRole="organizer"><AdminPage /></ProtectedRoute>} />
      </Routes>
      <NavBar />
    </>
  )
}
