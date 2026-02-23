import { NavLink, useLocation } from 'react-router-dom'

export default function NavBar() {
  const location = useLocation()

  // Hide nav during active scoring
  if (location.pathname.endsWith('/score')) return null

  return (
    <nav className="navbar">
      <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`} end>
        Home
      </NavLink>
      <NavLink to="/teams" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        Teams
      </NavLink>
      <NavLink to="/admin" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        Admin
      </NavLink>
    </nav>
  )
}
