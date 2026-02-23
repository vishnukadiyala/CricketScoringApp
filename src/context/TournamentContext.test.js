import { describe, it, expect } from 'vitest'
import { tournamentReducer, initialTournamentState } from './TournamentContext'

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

  it('auto-generates league schedule when 3rd team added', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'Alpha', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'Beta', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'Gamma', squad: [] })

    expect(state.teams).toHaveLength(3)
    expect(state.matches).toHaveLength(3)
    expect(state.phase).toBe('league')

    expect(state.matches[0].team1Id).toBe('team_1')
    expect(state.matches[0].team2Id).toBe('team_2')
    expect(state.matches[1].team1Id).toBe('team_1')
    expect(state.matches[1].team2Id).toBe('team_3')
    expect(state.matches[2].team1Id).toBe('team_2')
    expect(state.matches[2].team2Id).toBe('team_3')
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
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })
    expect(state.matches).toHaveLength(3)

    state = tournamentReducer(state, { type: 'REMOVE_TEAM', teamId: 'team_2' })
    expect(state.teams).toHaveLength(2)
    expect(state.matches).toHaveLength(0)
    expect(state.phase).toBe('setup')
  })

  it('starts a match', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })

    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_1' })
    expect(state.activeMatchId).toBe('match_1')
    expect(state.matches[0].status).toBe('live')
  })

  it('completes a match and records result', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })
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

  it('auto-creates eliminator after all league matches complete', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })

    // Complete all 3 league matches: A wins all, B beats C
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_1' })
    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH', matchId: 'match_1', winnerId: 'team_1', isTied: false,
      result: 'A won', teamSummaries: {
        team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
        team_2: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      },
    })

    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_2' })
    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH', matchId: 'match_2', winnerId: 'team_1', isTied: false,
      result: 'A won', teamSummaries: {
        team_1: { runsScored: 110, oversFaced: 12, runsConceded: 70, oversBowled: 12 },
        team_3: { runsScored: 70, oversFaced: 12, runsConceded: 110, oversBowled: 12 },
      },
    })

    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_3' })
    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH', matchId: 'match_3', winnerId: 'team_2', isTied: false,
      result: 'B won', teamSummaries: {
        team_2: { runsScored: 90, oversFaced: 12, runsConceded: 60, oversBowled: 12 },
        team_3: { runsScored: 60, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
      },
    })

    expect(state.matches).toHaveLength(4)
    const eliminator = state.matches[3]
    expect(eliminator.type).toBe('eliminator')
    expect(eliminator.team1Id).toBe('team_2') // 2nd place
    expect(eliminator.team2Id).toBe('team_3') // 3rd place
    expect(state.phase).toBe('eliminator')
  })

  it('auto-creates final after eliminator completes', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })

    // Complete all league (A wins all)
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_1' })
    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH', matchId: 'match_1', winnerId: 'team_1', isTied: false,
      result: '', teamSummaries: {
        team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
        team_2: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      },
    })
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_2' })
    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH', matchId: 'match_2', winnerId: 'team_1', isTied: false,
      result: '', teamSummaries: {
        team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
        team_3: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      },
    })
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_3' })
    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH', matchId: 'match_3', winnerId: 'team_2', isTied: false,
      result: '', teamSummaries: {
        team_2: { runsScored: 90, oversFaced: 12, runsConceded: 60, oversBowled: 12 },
        team_3: { runsScored: 60, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
      },
    })

    // Complete eliminator
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_4' })
    state = tournamentReducer(state, {
      type: 'COMPLETE_MATCH', matchId: 'match_4', winnerId: 'team_2', isTied: false,
      result: 'B won', teamSummaries: {},
    })

    expect(state.matches).toHaveLength(5)
    const final_ = state.matches[4]
    expect(final_.type).toBe('final')
    expect(final_.team1Id).toBe('team_1') // 1st place
    expect(final_.team2Id).toBe('team_2') // eliminator winner
    expect(state.phase).toBe('final')
  })

  it('sets phase to completed after final', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'B', squad: [] })
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'C', squad: [] })

    // Fast-complete all matches
    const ts = { team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
                 team_2: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 } }
    const ts2 = { team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
                  team_3: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 } }
    const ts3 = { team_2: { runsScored: 90, oversFaced: 12, runsConceded: 60, oversBowled: 12 },
                  team_3: { runsScored: 60, oversFaced: 12, runsConceded: 90, oversBowled: 12 } }

    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_1' })
    state = tournamentReducer(state, { type: 'COMPLETE_MATCH', matchId: 'match_1', winnerId: 'team_1', isTied: false, result: '', teamSummaries: ts })
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_2' })
    state = tournamentReducer(state, { type: 'COMPLETE_MATCH', matchId: 'match_2', winnerId: 'team_1', isTied: false, result: '', teamSummaries: ts2 })
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_3' })
    state = tournamentReducer(state, { type: 'COMPLETE_MATCH', matchId: 'match_3', winnerId: 'team_2', isTied: false, result: '', teamSummaries: ts3 })
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_4' })
    state = tournamentReducer(state, { type: 'COMPLETE_MATCH', matchId: 'match_4', winnerId: 'team_2', isTied: false, result: '', teamSummaries: {} })
    state = tournamentReducer(state, { type: 'START_MATCH', matchId: 'match_5' })
    state = tournamentReducer(state, { type: 'COMPLETE_MATCH', matchId: 'match_5', winnerId: 'team_1', isTied: false, result: '', teamSummaries: {} })

    expect(state.phase).toBe('completed')
  })

  it('resets tournament', () => {
    let state = initialTournamentState
    state = tournamentReducer(state, { type: 'ADD_TEAM', name: 'A', squad: [] })
    state = tournamentReducer(state, { type: 'RESET_TOURNAMENT' })
    expect(state).toEqual(initialTournamentState)
  })
})
