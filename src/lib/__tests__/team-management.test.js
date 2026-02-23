import { describe, it, expect } from 'vitest'
import { tournamentReducer, initialTournamentState } from '../../context/TournamentContext.jsx'

// ─── Helpers ─────────────────────────────────────────────────

function setupTournament() {
  let state = { ...initialTournamentState }
  state = tournamentReducer(state, {
    type: 'ADD_TEAM',
    name: 'Alpha',
    squad: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
  })
  state = tournamentReducer(state, {
    type: 'ADD_TEAM',
    name: 'Beta',
    squad: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
  })
  return state
}

// ─── Tests ───────────────────────────────────────────────────

describe('Mid-Tournament Team Editing', () => {
  it('ADD_PLAYER adds a new player with status active to the team', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id

    state = tournamentReducer(state, {
      type: 'ADD_PLAYER',
      teamId,
      playerName: 'A9',
      reason: 'Injury replacement',
    })

    const team = state.teams.find(t => t.id === teamId)
    const newPlayer = team.squad.find(p => p.name === 'A9')
    expect(newPlayer).toBeDefined()
    expect(newPlayer.status).toBe('active')
  })

  it('ADD_PLAYER new player has a generated id starting with p_', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id

    state = tournamentReducer(state, {
      type: 'ADD_PLAYER',
      teamId,
      playerName: 'A9',
      reason: 'Squad expansion',
    })

    const team = state.teams.find(t => t.id === teamId)
    const newPlayer = team.squad.find(p => p.name === 'A9')
    expect(newPlayer.id).toMatch(/^p_/)
  })

  it('REMOVE_PLAYER sets player status to inactive', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const playerId = state.teams[0].squad[0].id

    state = tournamentReducer(state, {
      type: 'REMOVE_PLAYER',
      teamId,
      playerId,
      reason: 'Disciplinary',
    })

    const team = state.teams.find(t => t.id === teamId)
    const removedPlayer = team.squad.find(p => p.id === playerId)
    expect(removedPlayer.status).toBe('inactive')
  })

  it('REMOVE_PLAYER player remains in squad array (not deleted)', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const originalLength = state.teams[0].squad.length
    const playerId = state.teams[0].squad[0].id

    state = tournamentReducer(state, {
      type: 'REMOVE_PLAYER',
      teamId,
      playerId,
      reason: 'Injury',
    })

    const team = state.teams.find(t => t.id === teamId)
    expect(team.squad).toHaveLength(originalLength)
    expect(team.squad.find(p => p.id === playerId)).toBeDefined()
  })

  it('REPLACE_PLAYER old player inactive, new player active', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const outPlayerId = state.teams[0].squad[0].id
    const outPlayerName = state.teams[0].squad[0].name

    state = tournamentReducer(state, {
      type: 'REPLACE_PLAYER',
      teamId,
      playerId: outPlayerId,
      newPlayerName: 'A9',
      reason: 'Tactical change',
    })

    const team = state.teams.find(t => t.id === teamId)
    const oldPlayer = team.squad.find(p => p.id === outPlayerId)
    const newPlayer = team.squad.find(p => p.name === 'A9')

    expect(oldPlayer.status).toBe('inactive')
    expect(newPlayer).toBeDefined()
    expect(newPlayer.status).toBe('active')
    expect(newPlayer.id).toMatch(/^p_/)
  })

  it('EDIT_PLAYER updates player name, id unchanged', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const playerId = state.teams[0].squad[0].id
    const originalName = state.teams[0].squad[0].name

    state = tournamentReducer(state, {
      type: 'EDIT_PLAYER',
      teamId,
      playerId,
      newName: 'A1-Updated',
      reason: 'Name correction',
    })

    const team = state.teams.find(t => t.id === teamId)
    const editedPlayer = team.squad.find(p => p.id === playerId)

    expect(editedPlayer.name).toBe('A1-Updated')
    expect(editedPlayer.name).not.toBe(originalName)
    expect(editedPlayer.id).toBe(playerId)
  })
})

describe('Audit Trail', () => {
  it('ADD_PLAYER creates a squadChanges entry with action add', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id

    state = tournamentReducer(state, {
      type: 'ADD_PLAYER',
      teamId,
      playerName: 'A9',
      reason: 'Reinforcement',
    })

    expect(state.squadChanges).toHaveLength(1)
    const entry = state.squadChanges[0]
    expect(entry.action).toBe('add')
    expect(entry.teamId).toBe(teamId)
    expect(entry.playerIn).toBe('A9')
    expect(entry.reason).toBe('Reinforcement')
  })

  it('REMOVE_PLAYER creates a squadChanges entry with action remove', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const playerId = state.teams[0].squad[0].id
    const playerName = state.teams[0].squad[0].name

    state = tournamentReducer(state, {
      type: 'REMOVE_PLAYER',
      teamId,
      playerId,
      reason: 'Dropped',
    })

    expect(state.squadChanges).toHaveLength(1)
    const entry = state.squadChanges[0]
    expect(entry.action).toBe('remove')
    expect(entry.teamId).toBe(teamId)
    expect(entry.playerOut).toBe(playerName)
    expect(entry.reason).toBe('Dropped')
  })

  it('REPLACE_PLAYER creates a squadChanges entry with action replace', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const outPlayerId = state.teams[0].squad[0].id
    const outPlayerName = state.teams[0].squad[0].name

    state = tournamentReducer(state, {
      type: 'REPLACE_PLAYER',
      teamId,
      playerId: outPlayerId,
      newPlayerName: 'A9',
      reason: 'Injury swap',
    })

    expect(state.squadChanges).toHaveLength(1)
    const entry = state.squadChanges[0]
    expect(entry.action).toBe('replace')
    expect(entry.teamId).toBe(teamId)
    expect(entry.playerIn).toBe('A9')
    expect(entry.playerOut).toBe(outPlayerName)
    expect(entry.reason).toBe('Injury swap')
  })

  it('EDIT_PLAYER creates a squadChanges entry with action edit', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const playerId = state.teams[0].squad[0].id
    const originalName = state.teams[0].squad[0].name

    state = tournamentReducer(state, {
      type: 'EDIT_PLAYER',
      teamId,
      playerId,
      newName: 'A1-Fixed',
      reason: 'Typo fix',
    })

    expect(state.squadChanges).toHaveLength(1)
    const entry = state.squadChanges[0]
    expect(entry.action).toBe('edit')
    expect(entry.teamId).toBe(teamId)
    expect(entry.playerIn).toBe('A1-Fixed')
    expect(entry.playerOut).toBe(originalName)
    expect(entry.reason).toBe('Typo fix')
  })

  it('each squadChanges entry has a timestamp', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id

    const before = Date.now()
    state = tournamentReducer(state, {
      type: 'ADD_PLAYER',
      teamId,
      playerName: 'A9',
      reason: 'New signing',
    })
    const after = Date.now()

    const entry = state.squadChanges[0]
    expect(entry.timestamp).toBeGreaterThanOrEqual(before)
    expect(entry.timestamp).toBeLessThanOrEqual(after)
  })

  it('multiple changes accumulate in squadChanges array', () => {
    let state = setupTournament()
    const teamId = state.teams[0].id
    const playerId = state.teams[0].squad[1].id

    // First change: add a player
    state = tournamentReducer(state, {
      type: 'ADD_PLAYER',
      teamId,
      playerName: 'A9',
      reason: 'Addition',
    })

    // Second change: remove a player
    state = tournamentReducer(state, {
      type: 'REMOVE_PLAYER',
      teamId,
      playerId,
      reason: 'Dropped',
    })

    // Third change: edit a player
    state = tournamentReducer(state, {
      type: 'EDIT_PLAYER',
      teamId,
      playerId: state.teams[0].squad[2].id,
      newName: 'A3-Renamed',
      reason: 'Correction',
    })

    expect(state.squadChanges).toHaveLength(3)
    expect(state.squadChanges[0].action).toBe('add')
    expect(state.squadChanges[1].action).toBe('remove')
    expect(state.squadChanges[2].action).toBe('edit')
  })
})
