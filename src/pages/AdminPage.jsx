import { useState, useEffect } from 'react'
import { useTournament } from '../context/TournamentContext'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_OVERS_PER_INNINGS, MIN_SQUAD_SIZE, MAX_SQUAD_SIZE } from '../lib/constants'
import { clearTournament, loadMatch } from '../lib/storage'
import { db, ref, set, onValue, off } from '../lib/firebase'
import { getActivePlayerNames, countActivePlayers } from '../lib/squadUtils'

export default function AdminPage() {
  const { teams, matches, name, oversPerInnings, squadChanges, dispatch, getTeamName } = useTournament()
  const { isAuthEnabled, isOwner, userName, user } = useAuth()
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
  const [registeredUsers, setRegisteredUsers] = useState([])

  // Per-player management state
  const [addPlayerTeamId, setAddPlayerTeamId] = useState(null)
  const [addPlayerName, setAddPlayerName] = useState('')
  const [addPlayerReason, setAddPlayerReason] = useState('')
  const [editingPlayer, setEditingPlayer] = useState(null) // { teamId, playerId }
  const [editPlayerName, setEditPlayerName] = useState('')
  const [editPlayerReason, setEditPlayerReason] = useState('')
  const [replacingPlayer, setReplacingPlayer] = useState(null) // { teamId, playerId, oldName }
  const [replacePlayerName, setReplacePlayerName] = useState('')
  const [replacePlayerReason, setReplacePlayerReason] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(null) // { teamId, playerId, name }
  const [removeReason, setRemoveReason] = useState('')
  const [showChangeLog, setShowChangeLog] = useState(false)

  useEffect(() => {
    if (!isAuthEnabled) return
    const usersRef = ref(db, 'users')
    onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const list = Object.entries(data).map(([uid, u]) => ({
          uid,
          name: u.name,
          email: u.email,
          role: u.role,
        }))
        setRegisteredUsers(list)
      } else {
        setRegisteredUsers([])
      }
    })
    return () => off(usersRef)
  }, [isAuthEnabled])

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
    setEditSquadText(getActivePlayerNames(team.squad).join('\n'))
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

  // Check if a player is in a live match XI
  const isPlayerInLiveXI = (playerName) => {
    const liveMatch = matches.find(m => m.status === 'live')
    if (!liveMatch) return false
    const matchState = loadMatch(liveMatch.id)
    if (!matchState) return false
    // Check playing XI and innings data
    const allPlayers = new Set()
    if (matchState.playingXI) {
      matchState.playingXI.team1?.forEach(n => allPlayers.add(n))
      matchState.playingXI.team2?.forEach(n => allPlayers.add(n))
    }
    matchState.innings?.forEach(inn => {
      if (!inn) return
      inn.batsmen?.forEach(b => { if (b) allPlayers.add(b.name) })
      inn.bowlers?.forEach(b => { if (b) allPlayers.add(b.name) })
    })
    return allPlayers.has(playerName)
  }

  // Check if a name is on another team's active squad
  const isNameOnAnotherTeam = (name, excludeTeamId) => {
    return teams.some(t => {
      if (t.id === excludeTeamId) return false
      return getActivePlayerNames(t.squad).some(n => n.toLowerCase() === name.toLowerCase())
    })
  }

  // Check if name is duplicate in same team
  const isDuplicateInTeam = (name, teamId, excludePlayerId = null) => {
    const team = teams.find(t => t.id === teamId)
    if (!team) return false
    return team.squad.some(p =>
      p.status === 'active' && p.name.toLowerCase() === name.toLowerCase() && p.id !== excludePlayerId
    )
  }

  const handleAddPlayer = (teamId) => {
    setError('')
    const pName = addPlayerName.trim()
    if (!pName) {
      setError('Player name is required')
      return
    }
    if (isDuplicateInTeam(pName, teamId)) {
      setError('Player name already exists in this team')
      return
    }
    if (isNameOnAnotherTeam(pName, teamId)) {
      setError('Player is on another team\'s active squad')
      return
    }
    const team = teams.find(t => t.id === teamId)
    if (team && countActivePlayers(team.squad) >= MAX_SQUAD_SIZE) {
      setError(`Cannot exceed ${MAX_SQUAD_SIZE} active players`)
      return
    }
    dispatch({
      type: 'ADD_PLAYER', teamId, playerName: pName,
      reason: addPlayerReason.trim(), changedBy: userName || '',
    })
    setAddPlayerName('')
    setAddPlayerReason('')
    setAddPlayerTeamId(null)
  }

  const handleRemovePlayer = () => {
    if (!confirmRemove) return
    const { teamId, playerId } = confirmRemove
    const team = teams.find(t => t.id === teamId)
    if (team && countActivePlayers(team.squad) <= MIN_SQUAD_SIZE) {
      setError(`Cannot go below ${MIN_SQUAD_SIZE} active players`)
      setConfirmRemove(null)
      return
    }
    if (isPlayerInLiveXI(confirmRemove.name)) {
      setError('Cannot remove a player in a live match XI')
      setConfirmRemove(null)
      return
    }
    dispatch({
      type: 'REMOVE_PLAYER', teamId, playerId,
      reason: removeReason.trim(), changedBy: userName || '',
    })
    setConfirmRemove(null)
    setRemoveReason('')
  }

  const handleReplacePlayer = () => {
    if (!replacingPlayer) return
    setError('')
    const pName = replacePlayerName.trim()
    if (!pName) {
      setError('Replacement name is required')
      return
    }
    if (isDuplicateInTeam(pName, replacingPlayer.teamId)) {
      setError('Player name already exists in this team')
      return
    }
    if (isNameOnAnotherTeam(pName, replacingPlayer.teamId)) {
      setError('Player is on another team\'s active squad')
      return
    }
    if (isPlayerInLiveXI(replacingPlayer.oldName)) {
      setError('Cannot replace a player in a live match XI')
      return
    }
    dispatch({
      type: 'REPLACE_PLAYER', teamId: replacingPlayer.teamId, playerId: replacingPlayer.playerId,
      newPlayerName: pName, reason: replacePlayerReason.trim(), changedBy: userName || '',
    })
    setReplacingPlayer(null)
    setReplacePlayerName('')
    setReplacePlayerReason('')
  }

  const handleEditPlayer = () => {
    if (!editingPlayer) return
    setError('')
    const pName = editPlayerName.trim()
    if (!pName) {
      setError('Player name is required')
      return
    }
    if (isDuplicateInTeam(pName, editingPlayer.teamId, editingPlayer.playerId)) {
      setError('Player name already exists in this team')
      return
    }
    dispatch({
      type: 'EDIT_PLAYER', teamId: editingPlayer.teamId, playerId: editingPlayer.playerId,
      newName: pName, reason: editPlayerReason.trim(), changedBy: userName || '',
    })
    setEditingPlayer(null)
    setEditPlayerName('')
    setEditPlayerReason('')
  }

  const hasLiveMatch = matches.some(m => m.status === 'live')
  const hasStartedMatches = matches.some(m => m.status !== 'upcoming')
  const changeLog = (squadChanges || []).slice().reverse()

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

          {teams.map(team => {
            const activePlayers = team.squad.filter(p => p.status === 'active')
            const inactivePlayers = team.squad.filter(p => p.status === 'inactive')

            return (
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
                      <span className="admin-squad-count">{countActivePlayers(team.squad)} players</span>
                    </div>

                    {/* Active players with action buttons */}
                    <div className="squad-player-list">
                      {activePlayers.map(p => (
                        <div key={p.id} className="squad-player-row">
                          <span className="squad-player-name">{p.name}</span>
                          <div className="squad-player-btns">
                            <button
                              className="btn-icon"
                              title="Edit name"
                              onClick={() => {
                                setEditingPlayer({ teamId: team.id, playerId: p.id })
                                setEditPlayerName(p.name)
                                setEditPlayerReason('')
                                setError('')
                              }}
                            >
                              &#9998;
                            </button>
                            <button
                              className="btn-icon"
                              title="Replace"
                              onClick={() => {
                                setReplacingPlayer({ teamId: team.id, playerId: p.id, oldName: p.name })
                                setReplacePlayerName('')
                                setReplacePlayerReason('')
                                setError('')
                              }}
                            >
                              &#8644;
                            </button>
                            <button
                              className="btn-icon btn-icon-danger"
                              title="Remove"
                              onClick={() => {
                                setConfirmRemove({ teamId: team.id, playerId: p.id, name: p.name })
                                setRemoveReason('')
                                setError('')
                              }}
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Inline edit player form */}
                    {editingPlayer && editingPlayer.teamId === team.id && (
                      <div className="squad-edit-inline">
                        <div className="form-group">
                          <label>Edit Player Name</label>
                          <input
                            type="text"
                            value={editPlayerName}
                            onChange={(e) => setEditPlayerName(e.target.value)}
                            placeholder="Corrected name"
                          />
                        </div>
                        <div className="form-group">
                          <label>Reason (optional)</label>
                          <input
                            type="text"
                            value={editPlayerReason}
                            onChange={(e) => setEditPlayerReason(e.target.value)}
                            placeholder="e.g. Typo fix"
                          />
                        </div>
                        <div className="btn-group">
                          <button className="btn btn-primary btn-sm" onClick={handleEditPlayer}>Save</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingPlayer(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Inline replace player form */}
                    {replacingPlayer && replacingPlayer.teamId === team.id && (
                      <div className="squad-edit-inline">
                        <div className="form-group">
                          <label>Replace {replacingPlayer.oldName} with</label>
                          <input
                            type="text"
                            value={replacePlayerName}
                            onChange={(e) => setReplacePlayerName(e.target.value)}
                            placeholder="New player name"
                          />
                        </div>
                        <div className="form-group">
                          <label>Reason (optional)</label>
                          <input
                            type="text"
                            value={replacePlayerReason}
                            onChange={(e) => setReplacePlayerReason(e.target.value)}
                            placeholder="e.g. Injury replacement"
                          />
                        </div>
                        <div className="btn-group">
                          <button className="btn btn-primary btn-sm" onClick={handleReplacePlayer}>Replace</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setReplacingPlayer(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Confirm remove modal */}
                    {confirmRemove && confirmRemove.teamId === team.id && (
                      <div className="squad-edit-inline" style={{ borderColor: 'var(--danger)' }}>
                        <p style={{ marginBottom: '8px', color: 'var(--danger)', fontWeight: 600 }}>
                          Remove {confirmRemove.name}?
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          Stats will be preserved in scorecards and leaderboards.
                        </p>
                        <div className="form-group">
                          <label>Reason (optional)</label>
                          <input
                            type="text"
                            value={removeReason}
                            onChange={(e) => setRemoveReason(e.target.value)}
                            placeholder="e.g. Left tournament"
                          />
                        </div>
                        <div className="btn-group">
                          <button className="btn btn-danger btn-sm" onClick={handleRemovePlayer}>Confirm Remove</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setConfirmRemove(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Inactive (released) players */}
                    {inactivePlayers.length > 0 && (
                      <div className="squad-inactive-section">
                        {inactivePlayers.map(p => (
                          <div key={p.id} className="squad-player-row squad-player-inactive">
                            <span className="squad-player-name">{p.name}</span>
                            <span className="released-badge">Released</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Player */}
                    {addPlayerTeamId === team.id ? (
                      <div className="squad-add-form">
                        <div className="form-group">
                          <label>New Player Name</label>
                          <input
                            type="text"
                            value={addPlayerName}
                            onChange={(e) => setAddPlayerName(e.target.value)}
                            placeholder="Player name"
                          />
                        </div>
                        <div className="form-group">
                          <label>Reason (optional)</label>
                          <input
                            type="text"
                            value={addPlayerReason}
                            onChange={(e) => setAddPlayerReason(e.target.value)}
                            placeholder="e.g. New signing"
                          />
                        </div>
                        <div className="btn-group">
                          <button className="btn btn-primary btn-sm" onClick={() => handleAddPlayer(team.id)}>Add</button>
                          <button className="btn btn-outline btn-sm" onClick={() => { setAddPlayerTeamId(null); setAddPlayerName(''); setAddPlayerReason('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ marginTop: '8px' }}
                        onClick={() => { setAddPlayerTeamId(team.id); setError('') }}
                      >
                        + Add Player
                      </button>
                    )}

                    {/* Team-level actions (only before matches start) */}
                    {!hasStartedMatches && (
                      <div className="btn-group" style={{ marginTop: '12px' }}>
                        <button className="btn btn-outline" onClick={() => handleEditTeam(team)}>Bulk Edit</button>
                        <button className="btn btn-danger" onClick={() => dispatch({ type: 'REMOVE_TEAM', teamId: team.id })}>Remove Team</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

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

        {/* Squad Change Log */}
        {changeLog.length > 0 && (
          <div className="card">
            <button
              className="btn btn-outline btn-block"
              onClick={() => setShowChangeLog(!showChangeLog)}
            >
              Squad Change Log ({changeLog.length}) {showChangeLog ? '\u25B2' : '\u25BC'}
            </button>
            {showChangeLog && (
              <div className="squad-change-log">
                {changeLog.map(entry => (
                  <div key={entry.id} className="squad-change-entry">
                    <div className="squad-change-header">
                      <span className={`squad-change-action squad-change-${entry.action}`}>
                        {entry.action}
                      </span>
                      <span className="squad-change-team">{getTeamName(entry.teamId)}</span>
                      <span className="squad-change-time">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="squad-change-detail">
                      {entry.action === 'add' && <span>Added {entry.playerIn}</span>}
                      {entry.action === 'remove' && <span>Removed {entry.playerOut}</span>}
                      {entry.action === 'replace' && <span>{entry.playerOut} &rarr; {entry.playerIn}</span>}
                      {entry.action === 'edit' && <span>{entry.playerOut} &rarr; {entry.playerIn}</span>}
                      {entry.reason && <span className="squad-change-reason"> &mdash; {entry.reason}</span>}
                    </div>
                    {entry.changedBy && (
                      <div className="squad-change-by">by {entry.changedBy}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* Registered Players & Role Management */}
        {isAuthEnabled && registeredUsers.length > 0 && (
          <div className="card">
            <h2>Registered Accounts</h2>
            <div className="player-account-list">
              {registeredUsers.map(u => {
                const isSelf = user && u.uid === user.uid
                const isUserOwner = u.role === 'owner'
                const canChangeRole = isOwner && !isSelf && !isUserOwner
                return (
                  <div key={u.uid} className="player-account-row">
                    <div className="player-account-info">
                      <span className="player-account-name">{u.name}{isSelf ? ' (you)' : ''}</span>
                      <span className="player-account-email">{u.email}</span>
                    </div>
                    <div className="player-account-actions">
                      {canChangeRole ? (
                        <select
                          className="role-select"
                          value={u.role}
                          onChange={(e) => {
                            set(ref(db, `users/${u.uid}/role`), e.target.value)
                          }}
                        >
                          <option value="player">player</option>
                          <option value="organizer">organizer</option>
                        </select>
                      ) : (
                        <span className={`status-badge ${isUserOwner ? 'completed' : u.role === 'organizer' ? 'live' : 'upcoming'}`}>
                          {u.role}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Reset — owner only */}
        {(!isAuthEnabled || isOwner) && <div className="card" style={{ marginTop: '16px' }}>
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
        </div>}
      </main>
    </div>
  )
}
