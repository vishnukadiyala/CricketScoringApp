import { useState } from 'react'
import { useTournament } from '../context/TournamentContext'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_OVERS_PER_INNINGS, MIN_SQUAD_SIZE, MAX_SQUAD_SIZE } from '../lib/constants'
import { clearTournament } from '../lib/storage'

export default function AdminPage() {
  const { teams, matches, name, oversPerInnings, dispatch, getTeamName } = useTournament()
  const navigate = useNavigate()

  const [tournamentName, setTournamentName] = useState(name || 'NCC Edition 5')
  const [overs, setOvers] = useState(oversPerInnings || DEFAULT_OVERS_PER_INNINGS)
  const [teamName, setTeamName] = useState('')
  const [squadText, setSquadText] = useState('')
  const [error, setError] = useState('')
  const [editingTeam, setEditingTeam] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSquadText, setEditSquadText] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleCreateTournament = (e) => {
    e.preventDefault()
    if (!tournamentName.trim()) {
      setError('Tournament name is required')
      return
    }
    dispatch({
      type: 'CREATE_TOURNAMENT',
      name: tournamentName.trim(),
      oversPerInnings: parseInt(overs, 10) || DEFAULT_OVERS_PER_INNINGS,
    })
    setError('')
  }

  const handleAddTeam = (e) => {
    e.preventDefault()
    setError('')

    const tName = teamName.trim()
    if (!tName) {
      setError('Team name is required')
      return
    }

    if (teams.some(t => t.name.toLowerCase() === tName.toLowerCase())) {
      setError('Team name already exists')
      return
    }

    const squad = squadText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    const uniqueSquad = [...new Set(squad)]

    if (uniqueSquad.length < MIN_SQUAD_SIZE || uniqueSquad.length > MAX_SQUAD_SIZE) {
      setError(`Squad must have ${MIN_SQUAD_SIZE}-${MAX_SQUAD_SIZE} unique players (got ${uniqueSquad.length})`)
      return
    }

    dispatch({ type: 'ADD_TEAM', name: tName, squad: uniqueSquad })
    setTeamName('')
    setSquadText('')
  }

  const handleEditTeam = (team) => {
    setEditingTeam(team.id)
    setEditName(team.name)
    setEditSquadText(team.squad.join('\n'))
  }

  const handleSaveEdit = (teamId) => {
    setError('')
    const tName = editName.trim()
    if (!tName) {
      setError('Team name is required')
      return
    }

    const squad = editSquadText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    const uniqueSquad = [...new Set(squad)]

    if (uniqueSquad.length < MIN_SQUAD_SIZE || uniqueSquad.length > MAX_SQUAD_SIZE) {
      setError(`Squad must have ${MIN_SQUAD_SIZE}-${MAX_SQUAD_SIZE} unique players (got ${uniqueSquad.length})`)
      return
    }

    dispatch({ type: 'EDIT_TEAM', teamId, name: tName, squad: uniqueSquad })
    setEditingTeam(null)
  }

  const handleReset = () => {
    dispatch({ type: 'RESET_TOURNAMENT' })
    clearTournament()
    setShowResetConfirm(false)
    setTeamName('')
    setSquadText('')
  }

  const hasLiveMatch = matches.some(m => m.status === 'live')

  return (
    <div className="app">
      <header className="app-header">
        <h1>Admin</h1>
      </header>
      <main className="app-main">
        {/* Tournament Settings */}
        <div className="card">
          <h2>Tournament Settings</h2>
          <form onSubmit={handleCreateTournament}>
            <div className="form-group">
              <label>Tournament Name</label>
              <input
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="NCC Edition 5"
              />
            </div>
            <div className="form-group">
              <label>Overs per Innings</label>
              <input
                type="number"
                min="1"
                max="50"
                value={overs}
                onChange={(e) => setOvers(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Save Settings</button>
          </form>
        </div>

        {/* Teams */}
        <div className="card">
          <h2>Teams ({teams.length}/3)</h2>

          {teams.map(team => (
            <div key={team.id} className="admin-team-card">
              {editingTeam === team.id ? (
                <>
                  <div className="form-group">
                    <label>Team Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Squad (one per line)</label>
                    <textarea
                      className="squad-textarea"
                      rows={8}
                      value={editSquadText}
                      onChange={(e) => setEditSquadText(e.target.value)}
                    />
                  </div>
                  <div className="btn-group">
                    <button className="btn btn-primary" onClick={() => handleSaveEdit(team.id)}>Save</button>
                    <button className="btn btn-outline" onClick={() => setEditingTeam(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-team-header">
                    <h3>{team.name}</h3>
                    <span className="admin-squad-count">{team.squad.length} players</span>
                  </div>
                  <div className="admin-squad-list">
                    {team.squad.map((p, i) => (
                      <span key={i} className="chip active">{p}</span>
                    ))}
                  </div>
                  {!hasLiveMatch && matches.every(m => m.status === 'upcoming') && (
                    <div className="btn-group" style={{ marginTop: '12px' }}>
                      <button className="btn btn-outline" onClick={() => handleEditTeam(team)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => dispatch({ type: 'REMOVE_TEAM', teamId: team.id })}>Remove</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {teams.length < 3 && (
            <form onSubmit={handleAddTeam} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label>Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                />
              </div>
              <div className="form-group">
                <label>Squad ({MIN_SQUAD_SIZE}-{MAX_SQUAD_SIZE} players, one per line)</label>
                <textarea
                  className="squad-textarea"
                  rows={8}
                  placeholder={"Player 1\nPlayer 2\n...\nPlayer 15"}
                  value={squadText}
                  onChange={(e) => setSquadText(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Add Team</button>
            </form>
          )}

          {error && <div className="error-msg">{error}</div>}
        </div>

        {/* Schedule Preview */}
        {matches.length > 0 && (
          <div className="card">
            <h2>Schedule</h2>
            <div className="schedule-list">
              {matches.map(match => (
                <div key={match.id} className="admin-schedule-row">
                  <span className="match-type-label">{match.type === 'league' ? 'League' : match.type === 'eliminator' ? 'Eliminator' : 'Final'}</span>
                  <span>{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</span>
                  <span className={`status-badge ${match.status}`}>{match.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        {teams.length === 3 && (
          <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
            Go to Dashboard
          </button>
        )}

        {/* Reset */}
        <div className="card" style={{ marginTop: '16px' }}>
          {!showResetConfirm ? (
            <button
              className="btn btn-danger btn-block"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset Tournament
            </button>
          ) : (
            <>
              <p style={{ textAlign: 'center', marginBottom: '12px', color: 'var(--danger)' }}>
                Are you sure? This will delete all tournament data.
              </p>
              <div className="btn-group">
                <button className="btn btn-danger" onClick={handleReset}>Yes, Reset</button>
                <button className="btn btn-outline" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
