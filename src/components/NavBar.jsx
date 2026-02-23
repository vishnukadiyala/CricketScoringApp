import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth, signOut, isSpectatorMode } from '../lib/firebase'

export default function NavBar() {
  const location = useLocation()
  const { isAuthEnabled, isAuthenticated, isOrganizer } = useAuth()

  // Hide nav during active scoring
  if (location.pathname.endsWith('/score')) return null

  // Hide nav on login page
  if (location.pathname === '/login') return null

  // Hide nav when auth is enabled but user isn't authenticated (not spectator)
  if (!isSpectatorMode && isAuthEnabled && !isAuthenticated) return null

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch {
      // ignore
    }
  }

  return (
    <nav className="navbar">
      <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`} end>
        Home
      </NavLink>
      <NavLink to="/teams" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        Teams
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        Stats
      </NavLink>
      {!isSpectatorMode && (!isAuthEnabled || isOrganizer) && (
        <NavLink to="/admin" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          Admin
        </NavLink>
      )}
      {!isSpectatorMode && isAuthEnabled && isAuthenticated && (
        <button className="nav-tab nav-logout" onClick={handleLogout} type="button">
          Logout
        </button>
      )}
    </nav>
  )
}
