import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER, MAX_WICKETS } from '../constants'

// ─── Helpers ─────────────────────────────────────────────────

function setupMatch() {
  let state = { ...initialState }
  state = matchReducer(state, {
    type: 'SET_TEAMS',
    team1: 'Team A',
    team2: 'Team B',
    oversPerInnings: 12,
    squad1: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12','A13'],
    squad2: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13'],
  })
  state = matchReducer(state, { type: 'SET_TOSS', winner: 'Team A', decision: 'bat' })
  state = matchReducer(state, {
    type: 'SET_PLAYING_XI',
    team1XI: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
    team2XI: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
  })
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
  return state
}

function scoreBall(state, action = {}) {
  return matchReducer(state, { type: 'SCORE_BALL', runs: 0, runType: 'bat', ...action })
}

// All out the current innings (10 wickets)
function allOutCurrentInnings(state) {
  const inn = state.innings[state.currentInnings]
  const prefix = inn.battingTeam === 'Team A' ? 'A' : 'B'
  // Dismiss batsmen 3 through 11 (bring in new batsman each time)
  for (let i = 3; i <= 11; i++) {
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `${prefix}${i}` })
  }
  // 10th wicket — no new batsman
  state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
  return state
}

function getToSquadRotation(state) {
  // All out innings 0 (Team A bats, scores 0)
  state = allOutCurrentInnings(state)
  // Start innings 1
  state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
  // All out innings 1 (Team B bats, scores 0)
  // 0 < 0 * 0.5 is false, so phase goes to 'squad-rotation'
  state = allOutCurrentInnings(state)
  return state
}

// ─── Tests ───────────────────────────────────────────────────

describe('Substitution Application', () => {
  it('APPLY_SQUAD_ROTATION marks swapped-out player as substituted', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)
    expect(state.phase).toBe('squad-rotation')

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A11'],
      swapIn: ['A12'],
    })

    const a11 = state.activeRosters.team1.find(p => p.name === 'A11')
    expect(a11.substituted).toBe(true)
  })

  it('APPLY_SQUAD_ROTATION adds incoming player to active roster', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A11'],
      swapIn: ['A12'],
    })

    const a12 = state.activeRosters.team1.find(p => p.name === 'A12')
    expect(a12).toBeDefined()
    expect(a12.substituted).toBe(false)
  })

  it('substitution is recorded in state.substitutions', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A11'],
      swapIn: ['A12'],
    })

    expect(state.substitutions.team1).toHaveLength(1)
    expect(state.substitutions.team1[0]).toEqual({ out: 'A11', in: 'A12' })
  })

  it('multiple players can be swapped in one action', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team2',
      swapOut: ['B10', 'B11'],
      swapIn: ['B12', 'B13'],
    })

    const b10 = state.activeRosters.team2.find(p => p.name === 'B10')
    const b11 = state.activeRosters.team2.find(p => p.name === 'B11')
    const b12 = state.activeRosters.team2.find(p => p.name === 'B12')
    const b13 = state.activeRosters.team2.find(p => p.name === 'B13')

    expect(b10.substituted).toBe(true)
    expect(b11.substituted).toBe(true)
    expect(b12).toBeDefined()
    expect(b12.substituted).toBe(false)
    expect(b13).toBeDefined()
    expect(b13.substituted).toBe(false)

    expect(state.substitutions.team2).toHaveLength(2)
  })

  it('can apply rotation for team1 and team2 separately', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    // Rotate team1
    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A11'],
      swapIn: ['A12'],
    })

    // Rotate team2
    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team2',
      swapOut: ['B11'],
      swapIn: ['B12'],
    })

    expect(state.substitutions.team1).toHaveLength(1)
    expect(state.substitutions.team2).toHaveLength(1)
    expect(state.activeRosters.team1.find(p => p.name === 'A12')).toBeDefined()
    expect(state.activeRosters.team2.find(p => p.name === 'B12')).toBeDefined()
  })
})

describe('Playing XI Tracking', () => {
  it('after FINISH_SQUAD_ROTATION, currentInnings becomes 2', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A10', 'A11'],
      swapIn: ['A12', 'A13'],
    })
    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team2',
      swapOut: ['B10', 'B11'],
      swapIn: ['B12', 'B13'],
    })

    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    expect(state.currentInnings).toBe(2)
  })

  it('after FINISH_SQUAD_ROTATION, phase becomes batting-order', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A10', 'A11'],
      swapIn: ['A12', 'A13'],
    })

    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    expect(state.phase).toBe('batting-order')
  })

  it('substituted players have substituted=true in activeRosters', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A10', 'A11'],
      swapIn: ['A12', 'A13'],
    })

    const substitutedPlayers = state.activeRosters.team1.filter(p => p.substituted === true)
    expect(substitutedPlayers.map(p => p.name)).toContain('A10')
    expect(substitutedPlayers.map(p => p.name)).toContain('A11')
  })

  it('incoming players have substituted=false', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A10'],
      swapIn: ['A12'],
    })

    const a12 = state.activeRosters.team1.find(p => p.name === 'A12')
    expect(a12.substituted).toBe(false)
  })
})

describe('Rotation Window', () => {
  it('rotation occurs after 2nd innings (phase is squad-rotation)', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    // After innings 0 and innings 1, phase should be squad-rotation
    expect(state.phase).toBe('squad-rotation')
    expect(state.currentInnings).toBe(1)
  })

  it('with follow-on: rotation occurs after follow-on decision', () => {
    let state = setupMatch()

    // Innings 0: Team A scores some runs (e.g. 20)
    for (let i = 0; i < 20; i++) {
      state = scoreBall(state, { runs: 1 })
    }
    // All out innings 0
    state = allOutCurrentInnings(state)

    // Start innings 1
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })

    // Team B scores 0 — all out (0 < 20 * 0.5 = 10 → follow-on eligible)
    state = allOutCurrentInnings(state)
    expect(state.phase).toBe('follow-on-decision')

    // Decline follow-on → squad-rotation
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: false })
    expect(state.phase).toBe('squad-rotation')
  })

  it('with follow-on enforced: DECIDE_FOLLOW_ON leads to squad-rotation', () => {
    let state = setupMatch()

    // Innings 0: Team A scores 20
    for (let i = 0; i < 20; i++) {
      state = scoreBall(state, { runs: 1 })
    }
    state = allOutCurrentInnings(state)

    // Start innings 1
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })

    // Team B scores 0 → follow-on eligible
    state = allOutCurrentInnings(state)
    expect(state.phase).toBe('follow-on-decision')

    // Enforce follow-on
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    expect(state.phase).toBe('squad-rotation')
    expect(state.followOnEnforced).toBe(true)
  })

  it('FINISH_SQUAD_ROTATION recreates innings 2 and 3 with correct batting order', () => {
    let state = setupMatch()
    state = getToSquadRotation(state)

    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A10', 'A11'],
      swapIn: ['A12', 'A13'],
    })

    // Capture inningsOrder before finishing
    const order = state.inningsOrder

    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Innings 2 and 3 should be freshly created
    const inn2 = state.innings[2]
    const inn3 = state.innings[3]

    expect(inn2).not.toBeNull()
    expect(inn3).not.toBeNull()

    // Innings 2 batting team should match inningsOrder[2]
    expect(inn2.battingTeam).toBe(order[2])
    expect(inn2.bowlingTeam).toBe(order[3])
    expect(inn2.inningsNumber).toBe(3)

    // Innings 3 batting team should match inningsOrder[3]
    expect(inn3.battingTeam).toBe(order[3])
    expect(inn3.bowlingTeam).toBe(order[2])
    expect(inn3.inningsNumber).toBe(4)

    // Fresh innings should have empty state
    expect(inn2.totalRuns).toBe(0)
    expect(inn2.wickets).toBe(0)
    expect(inn2.batsmen).toHaveLength(0)
    expect(inn3.totalRuns).toBe(0)
    expect(inn3.wickets).toBe(0)
    expect(inn3.batsmen).toHaveLength(0)
  })
})
