import { describe, it, expect } from 'vitest'
import { tournamentReducer, initialTournamentState } from './TournamentContext'
import { migrateSquad } from '../lib/squadUtils'

// Helper: complete a match in the tournament
function completeMatch(state, matchId, winnerId, teamSummaries = {}) {
  state = tournamentReducer(state, { type: 'START_MATCH', matchId })
  state = tournamentReducer(state, {
    type: 'COMPLETE_MATCH', matchId, winnerId, isTied: false,
    result: `${winnerId} won`, teamSummaries,
  })
  return state
}

// Helper: set up 3 teams (generates 6 league matches)
function setupLeague() {
  let state = initialTournamentState
  state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
  state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
  state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })
  return state
}

// Helper: complete all 6 league matches (A wins all, B beats C twice)
function completeAllLeague(state) {
  const ts = (t1, t2, r1 = 100, r2 = 80) => ({
    [t1]: { runsScored: r1, oversFaced: 12, runsConceded: r2, oversBowled: 12 },
    [t2]: { runsScored: r2, oversFaced: 12, runsConceded: r1, oversBowled: 12 },
  })
  // Match 1: A vs B → A wins
  state = completeMatch(state, 'match_1', 'team_1', ts('team_1', 'team_2'))
  // Match 2: A vs C → A wins
  state = completeMatch(state, 'match_2', 'team_1', ts('team_1', 'team_3', 110, 70))
  // Match 3: B vs C → B wins
  state = completeMatch(state, 'match_3', 'team_2', ts('team_2', 'team_3', 90, 60))
  // Match 4: B vs A → A wins
  state = completeMatch(state, 'match_4', 'team_1', ts('team_1', 'team_2', 105, 85))
  // Match 5: C vs A → A wins
  state = completeMatch(state, 'match_5', 'team_1', ts('team_1', 'team_3', 115, 65))
  // Match 6: C vs B → B wins
  state = completeMatch(state, 'match_6', 'team_2', ts('team_2', 'team_3', 95, 55))
  return state
}

describe('tournamentReducer', () => {
  it('creates a tournament', () => {
    const state = tournamentReducer(initialTournamentState, {
      type: 'CREATE_TOURNAMENT',
      name: 'Test Cup',
      oversPerInnings: 10,
    })
    expect(state.name).toBe('Test Cup')
    expect(state.oversPerInnings).toBe(10)
  })

  it('adds teams', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'Alpha', squad: ['P1', 'P2'] })
    expect(state.teams).toHaveLength(1)
    expect(state.teams[0].name).toBe('Alpha')
    expect(state.teams[0].id).toBe('team_1')
    expect(state.matches).toHaveLength(0)
  })

  it('auto-generates league schedule with 6 matches when 3rd team added', () => {
    const state = setupLeague()

    expect(state.teams).toHaveLength(3)
    expect(state.matches).toHaveLength(6)
    expect(state.phase).toBe('league')

    // First leg
    expect(state.matches[0].team1Id).toBe('team_1')
    expect(state.matches[0].team2Id).toBe('team_2')
    expect(state.matches[1].team1Id).toBe('team_1')
    expect(state.matches[1].team2Id).toBe('team_3')
    expect(state.matches[2].team1Id).toBe('team_2')
    expect(state.matches[2].team2Id).toBe('team_3')

    // Second leg (reversed home/away)
    expect(state.matches[3].team1Id).toBe('team_2')
    expect(state.matches[3].team2Id).toBe('team_1')
    expect(state.matches[4].team1Id).toBe('team_3')
    expect(state.matches[4].team2Id).toBe('team_1')
    expect(state.matches[5].team1Id).toBe('team_3')
    expect(state.matches[5].team2Id).toBe('team_2')
  })

  it('does not add more than 3 teams', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'D', squad: [] })
    expect(state.teams).toHaveLength(3)
  })

  it('edits a team', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'Alpha', squad: [] })
    state = tournamentReducer(state, { type: 'EDIT_TEAM', teamId: 'team_1', name: 'Alpha Updated' })
    expect(state.teams[0].name).toBe('Alpha Updated')
  })

  it('removes a team and resets matches', () => {
    let state = setupLeague()
    expect(state.matches).toHaveLength(6)

    state = tournamentReducer(state, { type: 'REMOVE_TEAM', teamId: 'team_2' })
    expect(state.teams).toHaveLength(2)
    expect(state.matches).toHaveLength(0)
    expect(state.phase).toBe('setup')
  })

  it('starts a match', () => {
    let state = setupLeague()

    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_1' })
    expect(state.activeMatchId).toBe('match_1')
    expect(state.matches[0].status).toBe('live')
  })

  it('completes a match and records result', () => {
    let state = setupLeague()
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_1' })

    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH',
      matchId: 'match_1',
      winnerId: 'team_1',
      isTied: false,
      result: 'A won by 20 runs',
      teamSummaries: {
        team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
        team_2: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      },
    })

    expect(state.matches[0].status).toBe('completed')
    expect(state.matches[0].winnerId).toBe('team_1')
    expect(state.activeMatchId).toBeNull()
  })

  it('auto-creates eliminator after all 6 league matches complete', () => {
    let state = setupLeague()
    state = completeAllLeague(state)

    expect(state.matches).toHaveLength(7)
    const eliminator = state.matches[6]
    expect(eliminator.type).toBe('eliminator')
    expect(eliminator.id).toBe('match_7')
    expect(eliminator.team1Id).toBe('team_2') // 2nd place
    expect(eliminator.team2Id).toBe('team_3') // 3rd place
    expect(state.phase).toBe('eliminator')
  })

  it('auto-creates final after eliminator completes', () => {
    let state = setupLeague()
    state = completeAllLeague(state)

    // Complete eliminator (B wins)
    state = completeMatch(state, 'match_7', 'team_2')

    expect(state.matches).toHaveLength(8)
    const final_ = state.matches[7]
    expect(final_.type).toBe('final')
    expect(final_.id).toBe('match_8')
    expect(final_.team1Id).toBe('team_1') // 1st place
    expect(final_.team2Id).toBe('team_2') // eliminator winner
    expect(state.phase).toBe('final')
  })

  it('sets phase to completed after final', () => {
    let state = setupLeague()
    state = completeAllLeague(state)

    // Eliminator + final
    state = completeMatch(state, 'match_7', 'team_2')
    state = completeMatch(state, 'match_8', 'team_1')

    expect(state.phase).toBe('completed')
  })

  it('resets tournament', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'RESET_TOURNAMENT' })
    expect(state).toEqual(initialTournamentState)
  })
})

describe('squad management actions', () => {
  function setupWithSquad() {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'Alpha', squad: ['P1', 'P2', 'P3'] })
    return state
  }

  it('ADD_TEAM migrates string[] squad to objects', () => {
    const state = setupWithSquad()
    const squad = state.teams[0].squad
    expect(squad).toHaveLength(3)
    expect(squad[0]).toHaveProperty('id')
    expect(squad[0]).toHaveProperty('name', 'P1')
    expect(squad[0]).toHaveProperty('status', 'active')
  })

  it('EDIT_TEAM migrates string[] squad', () => {
    let state = setupWithSquad()
    state = tournamentReducer(state, { type: 'EDIT_TEAM', teamId: 'team_1', squad: ['X1', 'X2'] })
    const squad = state.teams[0].squad
    expect(squad).toHaveLength(2)
    expect(squad[0].name).toBe('X1')
    expect(squad[0].status).toBe('active')
    expect(squad[0].id).toMatch(/^p_/)
  })

  it('ADD_PLAYER appends a new active player and creates audit log', () => {
    let state = setupWithSquad()
    state = tournamentReducer(state, {
      type: 'ADD_PLAYER', teamId: 'team_1', playerName: 'P4', reason: 'New signing', changedBy: 'Admin',
    })
    const squad = state.teams[0].squad
    expect(squad).toHaveLength(4)
    expect(squad[3].name).toBe('P4')
    expect(squad[3].status).toBe('active')

    expect(state.squadChanges).toHaveLength(1)
    expect(state.squadChanges[0].action).toBe('add')
    expect(state.squadChanges[0].playerIn).toBe('P4')
    expect(state.squadChanges[0].changedBy).toBe('Admin')
  })

  it('REMOVE_PLAYER sets status to inactive and creates audit log', () => {
    let state = setupWithSquad()
    const playerId = state.teams[0].squad[1].id
    state = tournamentReducer(state, {
      type: 'REMOVE_PLAYER', teamId: 'team_1', playerId, reason: 'Unavailable',
    })
    const squad = state.teams[0].squad
    expect(squad).toHaveLength(3) // still in array
    expect(squad[1].status).toBe('inactive')

    expect(state.squadChanges).toHaveLength(1)
    expect(state.squadChanges[0].action).toBe('remove')
    expect(state.squadChanges[0].playerOut).toBe('P2')
  })

  it('REPLACE_PLAYER marks old inactive, adds new active, creates audit log', () => {
    let state = setupWithSquad()
    const playerId = state.teams[0].squad[0].id
    state = tournamentReducer(state, {
      type: 'REPLACE_PLAYER', teamId: 'team_1', playerId, newPlayerName: 'P1-replacement',
    })
    const squad = state.teams[0].squad
    expect(squad).toHaveLength(4) // 3 original + 1 new
    expect(squad[0].status).toBe('inactive') // old player
    expect(squad[3].name).toBe('P1-replacement')
    expect(squad[3].status).toBe('active')

    expect(state.squadChanges).toHaveLength(1)
    expect(state.squadChanges[0].action).toBe('replace')
    expect(state.squadChanges[0].playerOut).toBe('P1')
    expect(state.squadChanges[0].playerIn).toBe('P1-replacement')
  })

  it('EDIT_PLAYER updates name and creates audit log', () => {
    let state = setupWithSquad()
    const playerId = state.teams[0].squad[2].id
    state = tournamentReducer(state, {
      type: 'EDIT_PLAYER', teamId: 'team_1', playerId, newName: 'P3-fixed', reason: 'Typo fix',
    })
    expect(state.teams[0].squad[2].name).toBe('P3-fixed')

    expect(state.squadChanges).toHaveLength(1)
    expect(state.squadChanges[0].action).toBe('edit')
    expect(state.squadChanges[0].playerOut).toBe('P3')
    expect(state.squadChanges[0].playerIn).toBe('P3-fixed')
  })

  it('SYNC_FROM_REMOTE migrates remote squads', () => {
    const remote = {
      teams: [
        { id: 'team_1', name: 'Alpha', squad: ['X1', 'X2'] },
      ],
      matches: [],
      phase: 'setup',
    }
    const state = tournamentReducer(initialTournamentState, { type: 'SYNC_FROM_REMOTE', payload: remote })
    expect(state.teams[0].squad[0]).toHaveProperty('id')
    expect(state.teams[0].squad[0].name).toBe('X1')
    expect(state.teams[0].squad[0].status).toBe('active')
  })

  it('multiple squad changes accumulate in audit log', () => {
    let state = setupWithSquad()
    state = tournamentReducer(state, {
      type: 'ADD_PLAYER', teamId: 'team_1', playerName: 'P4',
    })
    state = tournamentReducer(state, {
      type: 'ADD_PLAYER', teamId: 'team_1', playerName: 'P5',
    })
    expect(state.squadChanges).toHaveLength(2)
  })
})
