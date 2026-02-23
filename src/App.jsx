import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import MatchPage from './pages/MatchPage'
import MatchScoringPage from './pages/MatchScoringPage'
import TeamsPage from './pages/TeamsPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/match/:id" element={<MatchPage />} />
        <Route path="/match/:id/score" element={<MatchScoringPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <NavBar />
    </>
  )
}
