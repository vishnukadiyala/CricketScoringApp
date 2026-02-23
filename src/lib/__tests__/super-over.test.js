import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER } from '../constants'

// ─── Helpers ─────────────────────────────────────────────────

function setupMatch() {
  let state = { ...initialState }
  state = matchReducer(state, {
    type: 'SET_TEAMS',
    team1: 'Team A',
    team2: 'Team B',
    oversPerInnings: 12,
    squad1: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
    squad2: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
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

/**
 * Get to super-over phase by manufacturing a tied match state.
 * Sets cumulative scores to 100-100 and provides boundary data.
 */
function getToSuperOver() {
  let state = setupMatch()
  // Manufacture a super-over scenario
  state = {
    ...state,
    phase: 'super-over',
    cumulativeScores: { team1: 100, team2: 100 },
    cumulativeBoundaries: { team1: { fours: 5, sixes: 2 }, team2: { fours: 4, sixes: 3 } },
  }
  state = matchReducer(state, { type: 'START_SUPER_OVER' })
  state = matchReducer(state, {
    type: 'SET_SUPER_OVER_PLAYERS',
    team1Batsmen: ['A1', 'A2', 'A3'],
    team2Batsmen: ['B1', 'B2', 'B3'],
    team1Bowler: 'A1',
    team2Bowler: 'B1',
  })
  return state
}

function scoreSuperOverBall(state, action = {}) {
  return matchReducer(state, {
    type: 'SCORE_SUPER_OVER_BALL',
    runs: 0,
    runType: 'bat',
    extraType: '',
    wicket: false,
    dismissalType: '',
    ...action,
  })
}

// ─── Tests ───────────────────────────────────────────────────

describe('Super Over Setup', () => {
  it('START_SUPER_OVER initializes superOver object with phase=select-players', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })

    expect(state.superOver).not.toBeNull()
    expect(state.superOver.phase).toBe('select-players')
    expect(state.superOver.team1Batsmen).toEqual([])
    expect(state.superOver.team2Batsmen).toEqual([])
    expect(state.superOver.team1Bowler).toBe('')
    expect(state.superOver.team2Bowler).toBe('')
    expect(state.phase).toBe('super-over')
  })

  it('SET_SUPER_OVER_PLAYERS sets batsmen, bowlers, and phase=batting-1', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A1',
      team2Bowler: 'B1',
    })

    expect(state.superOver.phase).toBe('batting-1')
    expect(state.superOver.team1Batsmen).toEqual(['A1', 'A2', 'A3'])
    expect(state.superOver.team2Batsmen).toEqual(['B1', 'B2', 'B3'])
    expect(state.superOver.team1Bowler).toBe('A1')
    expect(state.superOver.team2Bowler).toBe('B1')
  })

  it('superOver.innings1 initialized with runs=0, wickets=0, balls=0', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })

    expect(state.superOver.innings1.runs).toBe(0)
    expect(state.superOver.innings1.wickets).toBe(0)
    expect(state.superOver.innings1.balls).toBe(0)
    expect(state.superOver.innings1.ballLog).toEqual([])
    expect(state.superOver.innings1.fours).toBe(0)
    expect(state.superOver.innings1.sixes).toBe(0)
    expect(state.superOver.innings1.extras).toEqual({ wides: 0, noBalls: 0, byes: 0, legByes: 0 })
  })
})

describe('Super Over Scoring', () => {
  it('run recorded: superOver.innings1.runs increases', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })

    expect(state.superOver.innings1.runs).toBe(4)
  })

  it('wicket recorded: superOver.innings1.wickets increases', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, wicket: true })

    expect(state.superOver.innings1.wickets).toBe(1)
  })

  it('ball count increases on legal delivery', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 1 })

    expect(state.superOver.innings1.balls).toBe(1)

    state = scoreSuperOverBall(state, { runs: 2 })
    expect(state.superOver.innings1.balls).toBe(2)
  })

  it('wide adds 1 run and does NOT increment ball count', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'wide' })

    expect(state.superOver.innings1.runs).toBe(1)
    expect(state.superOver.innings1.balls).toBe(0) // not a legal delivery
    expect(state.superOver.innings1.extras.wides).toBe(1)
  })

  it('no-ball adds 1 run and does NOT increment ball count', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'noBall' })

    expect(state.superOver.innings1.runs).toBe(1)
    expect(state.superOver.innings1.balls).toBe(0) // not a legal delivery
    expect(state.superOver.innings1.extras.noBalls).toBe(1)
  })

  it('innings 1 ends after 6 balls, phase becomes batting-2, target set', () => {
    let state = getToSuperOver()
    // Score 2 runs per ball for 6 balls = 12 runs total
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreSuperOverBall(state, { runs: 2 })
    }

    expect(state.superOver.innings1.balls).toBe(6)
    expect(state.superOver.innings1.runs).toBe(12)
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.target).toBe(13) // 12 + 1
  })

  it('innings 1 ends after 3 wickets', () => {
    let state = getToSuperOver()
    // 3 wickets on legal deliveries
    state = scoreSuperOverBall(state, { runs: 0, wicket: true })
    state = scoreSuperOverBall(state, { runs: 0, wicket: true })
    state = scoreSuperOverBall(state, { runs: 0, wicket: true })

    expect(state.superOver.innings1.wickets).toBe(3)
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.target).toBe(1) // 0 + 1
  })

  it('innings 2 ends when target chased (runs >= target)', () => {
    let state = getToSuperOver()
    // First innings: 6 runs
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.target).toBe(7)

    // Second innings: chase target with a six + two = 8
    state = scoreSuperOverBall(state, { runs: 6 })
    expect(state.superOver.phase).toBe('batting-2') // 6 < 7, not done
    state = scoreSuperOverBall(state, { runs: 2 })
    expect(state.superOver.innings2.runs).toBe(8) // 8 >= 7
    expect(state.superOver.phase).toBe('result')
  })

  it('innings 2 ends after 6 balls', () => {
    let state = getToSuperOver()
    // First innings: 12 runs
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 })
    }
    expect(state.superOver.phase).toBe('batting-2')

    // Second innings: 6 dot balls (0 runs, cannot chase 13)
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 0 })
    }
    expect(state.superOver.innings2.balls).toBe(6)
    expect(state.superOver.phase).toBe('result')
  })
})

describe('Super Over Result', () => {
  it('team batting second wins when they surpass target', () => {
    let state = getToSuperOver()
    // First innings: 6 runs
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    // Second innings: score 8 (chases 7)
    state = scoreSuperOverBall(state, { runs: 4 })
    state = scoreSuperOverBall(state, { runs: 4 })
    // Result
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('won in Super Over')
    // The batting second team should be the winner
    expect(state.result).toContain(state.superOver.battingSecond)
  })

  it('team batting first wins when team 2 falls short', () => {
    let state = getToSuperOver()
    // First innings: 12 runs
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 })
    }
    // Second innings: 6 runs (falls short of 13)
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('won in Super Over')
    expect(state.result).toContain(state.superOver.battingFirst)
    expect(state.result).toContain('12 vs 6')
  })

  it('if super over itself is tied, boundary count comparison is used', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
      cumulativeBoundaries: {
        team1: { fours: 10, sixes: 2 }, // 12 boundaries
        team2: { fours: 8, sixes: 1 },  // 9 boundaries
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A4',
      team2Bowler: 'B4',
    })
    // Both score 6, no boundaries in super over
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('boundary count')
    // Team A had 12 cumulative boundaries vs Team B's 9
    expect(state.result).toContain('Team A')
  })

  it('result string includes "Super Over" for super over wins', () => {
    let state = getToSuperOver()
    // First innings: 10 runs
    for (let i = 0; i < 5; i++) {
      state = scoreSuperOverBall(state, { runs: 2 })
    }
    state = scoreSuperOverBall(state, { runs: 0 })
    // Second innings: 4 runs
    for (let i = 0; i < 4; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = scoreSuperOverBall(state, { runs: 0 })
    state = scoreSuperOverBall(state, { runs: 0 })
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.result).toMatch(/Super Over/)
  })
})

describe('Super Over Undo', () => {
  it('UNDO_SUPER_OVER_BALL restores previous super over state', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })
    state = scoreSuperOverBall(state, { runs: 6 })

    expect(state.superOver.innings1.runs).toBe(10)
    expect(state.superOver.innings1.fours).toBe(1)
    expect(state.superOver.innings1.sixes).toBe(1)
    expect(state.superOverHistory.length).toBe(2)

    // Undo the six
    state = matchReducer(state, { type: 'UNDO_SUPER_OVER_BALL' })
    expect(state.superOver.innings1.runs).toBe(4)
    expect(state.superOver.innings1.fours).toBe(1)
    expect(state.superOver.innings1.sixes).toBe(0)
    expect(state.superOverHistory.length).toBe(1)

    // Undo the four
    state = matchReducer(state, { type: 'UNDO_SUPER_OVER_BALL' })
    expect(state.superOver.innings1.runs).toBe(0)
    expect(state.superOver.innings1.fours).toBe(0)
    expect(state.superOverHistory.length).toBe(0)
  })

  it('UNDO_SUPER_OVER_BALL does nothing when history is empty', () => {
    let state = getToSuperOver()
    const before = state
    state = matchReducer(state, { type: 'UNDO_SUPER_OVER_BALL' })
    // Should return same state reference when no history
    expect(state).toBe(before)
  })

  it('UNDO_SUPER_OVER_BALL can restore across innings boundary', () => {
    let state = getToSuperOver()
    // Score 6 balls in first innings (6 runs)
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    expect(state.superOver.phase).toBe('batting-2')

    // Score 1 ball in second innings
    state = scoreSuperOverBall(state, { runs: 2 })
    expect(state.superOver.innings2.runs).toBe(2)

    // Undo the ball in innings 2 -- restores to end of innings 1
    state = matchReducer(state, { type: 'UNDO_SUPER_OVER_BALL' })
    // The snapshot captured before the ball in innings 2 was scored
    // had phase = 'batting-2' and innings2.runs = 0
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.runs).toBe(0)
  })
})

describe('Super Over Extras Handling', () => {
  it('wide with extra runs adds 1 + runs, does not count as legal delivery', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 2, extraType: 'wide' })

    expect(state.superOver.innings1.runs).toBe(3) // 1 wide + 2 extra
    expect(state.superOver.innings1.balls).toBe(0)
    expect(state.superOver.innings1.extras.wides).toBe(1)
    expect(state.superOver.innings1.ballLog).toEqual(['Wd+2'])
  })

  it('no-ball with batted boundary counts fours/sixes', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 6, extraType: 'noBall', runType: 'bat' })

    expect(state.superOver.innings1.runs).toBe(7) // 1 NB + 6
    expect(state.superOver.innings1.balls).toBe(0)
    expect(state.superOver.innings1.extras.noBalls).toBe(1)
    expect(state.superOver.innings1.sixes).toBe(1)
  })

  it('byes are legal deliveries with runs added', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 3, extraType: 'bye' })

    expect(state.superOver.innings1.runs).toBe(3)
    expect(state.superOver.innings1.balls).toBe(1) // legal delivery
    expect(state.superOver.innings1.extras.byes).toBe(3)
    expect(state.superOver.innings1.ballLog).toEqual(['B3'])
  })

  it('leg-byes are legal deliveries with runs added', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 2, extraType: 'legBye' })

    expect(state.superOver.innings1.runs).toBe(2)
    expect(state.superOver.innings1.balls).toBe(1) // legal delivery
    expect(state.superOver.innings1.extras.legByes).toBe(2)
    expect(state.superOver.innings1.ballLog).toEqual(['LB2'])
  })
})

describe('Super Over Boundary Tiebreaker', () => {
  it('boundary count includes super over boundaries', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
      cumulativeBoundaries: {
        team1: { fours: 5, sixes: 2 }, // 7 boundaries
        team2: { fours: 5, sixes: 2 }, // 7 boundaries
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A4',
      team2Bowler: 'B4',
    })

    // Batting first team (inningsOrder[3]) hits a four in innings1
    // Both score 6 runs but first team has a boundary
    state = scoreSuperOverBall(state, { runs: 4 }) // four
    state = scoreSuperOverBall(state, { runs: 2 })
    state = scoreSuperOverBall(state, { runs: 0 })
    state = scoreSuperOverBall(state, { runs: 0 })
    state = scoreSuperOverBall(state, { runs: 0 })
    state = scoreSuperOverBall(state, { runs: 0 })

    // Second batting team scores exactly 6 with singles
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }

    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    // Super over tied at 6-6, but first innings batting team has 1 extra four
    expect(state.result).toContain('boundary count')
  })

  it('when boundaries also tied, phase stays at super-over with tied-again', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
      cumulativeBoundaries: {
        team1: { fours: 5, sixes: 2 },
        team2: { fours: 5, sixes: 2 },
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A4',
      team2Bowler: 'B4',
    })

    // Both score 6 with no boundaries
    for (let i = 0; i < 12; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('super-over')
    expect(state.superOver.phase).toBe('tied-again')
    expect(state.result).toContain('another Super Over')
  })

  it('RESTART_SUPER_OVER resets super over state for another attempt', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
      cumulativeBoundaries: {
        team1: { fours: 5, sixes: 2 },
        team2: { fours: 5, sixes: 2 },
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A4',
      team2Bowler: 'B4',
    })
    for (let i = 0; i < 12; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    expect(state.superOver.phase).toBe('tied-again')

    // Restart
    state = matchReducer(state, { type: 'RESTART_SUPER_OVER' })
    expect(state.superOver.phase).toBe('select-players')
    expect(state.superOver.innings1.runs).toBe(0)
    expect(state.superOver.innings1.wickets).toBe(0)
    expect(state.superOver.innings1.balls).toBe(0)
    expect(state.superOver.innings2.runs).toBe(0)
    expect(state.superOver.innings2.target).toBe(0)
    expect(state.result).toBe('')
    expect(state.superOverHistory).toEqual([])
  })

  it('END_AS_TIE moves phase to match-over', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
      cumulativeBoundaries: {
        team1: { fours: 5, sixes: 2 },
        team2: { fours: 5, sixes: 2 },
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A4',
      team2Bowler: 'B4',
    })
    for (let i = 0; i < 12; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    state = matchReducer(state, { type: 'END_AS_TIE' })

    expect(state.phase).toBe('match-over')
  })
})

describe('Super Over battingFirst assignment', () => {
  it('battingFirst in super over is inningsOrder[3] (team that bowled last bats first in SO)', () => {
    let state = setupMatch()
    const lastBowlingTeam = state.inningsOrder[3]
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })

    // inningsOrder[3] bats first in super over
    expect(state.superOver.battingFirst).toBe(lastBowlingTeam)
    // inningsOrder[2] bats second
    expect(state.superOver.battingSecond).toBe(state.inningsOrder[2])
  })
})
