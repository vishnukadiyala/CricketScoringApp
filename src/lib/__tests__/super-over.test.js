import { describe, it, expect } from 'vitest'
import { matchReducer, initialState, createBatsman } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER, SUPER_OVER_WICKETS } from '../constants'

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
 * Get to super-over phase with openers selected and batting-1 ready.
 * Sets cumulative scores to 100-100 and provides boundary data.
 */
function getToSuperOver() {
  let state = setupMatch()
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
  // battingFirst = Team B (inningsOrder[3]), so innings 1 uses Team B players
  state = matchReducer(state, {
    type: 'SET_SUPER_OVER_OPENERS',
    openerOnStrike: 'B1',
    openerNonStrike: 'B2',
    inningsNumber: 1,
  })
  return state
}

/** Get to batting-2 with openers selected */
function getToSuperOverInnings2(firstInningsRuns) {
  let state = getToSuperOver()
  // Score first innings
  for (let i = 0; i < BALLS_PER_OVER; i++) {
    state = scoreSuperOverBall(state, { runs: firstInningsRuns ? Math.floor(firstInningsRuns / BALLS_PER_OVER) : 0 })
  }
  // Transition through between-innings
  state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
  // Select openers for innings 2
  state = matchReducer(state, {
    type: 'SET_SUPER_OVER_OPENERS',
    openerOnStrike: 'B1',
    openerNonStrike: 'B2',
    inningsNumber: 2,
  })
  return state
}

function scoreSuperOverBall(state, action = {}) {
  return matchReducer(state, {
    type: 'SCORE_SUPER_OVER_BALL',
    runs: 0,
    runType: 'bat',
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
    expect(state.superOver.innings1).toBeNull()
    expect(state.superOver.innings2).toBeNull()
    expect(state.superOver.lastBallWasNoBall).toBe(false)
    expect(state.phase).toBe('super-over')
  })

  it('SET_SUPER_OVER_PLAYERS sets batsmen, bowlers, and phase=select-openers-1', () => {
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

    expect(state.superOver.phase).toBe('select-openers-1')
    expect(state.superOver.team1Batsmen).toEqual(['A1', 'A2', 'A3'])
    expect(state.superOver.team2Batsmen).toEqual(['B1', 'B2', 'B3'])
    expect(state.superOver.team1Bowler).toBe('A1')
    expect(state.superOver.team2Bowler).toBe('B1')
  })

  it('SET_SUPER_OVER_OPENERS creates innings with batsmen and transitions to batting-1', () => {
    let state = getToSuperOver()

    expect(state.superOver.phase).toBe('batting-1')
    expect(state.superOver.innings1).not.toBeNull()
    expect(state.superOver.innings1.batsmen.length).toBe(3)
    expect(state.superOver.innings1.batsmen[0].name).toBe('B1') // striker
    expect(state.superOver.innings1.batsmen[1].name).toBe('B2') // non-striker
    expect(state.superOver.innings1.batsmen[2].name).toBe('B3') // reserve
    expect(state.superOver.innings1.activeBatsmanIndex).toBe(0)
    expect(state.superOver.innings1.nonStrikerIndex).toBe(1)
    expect(state.superOver.innings1.bowlers.length).toBe(1)
    expect(state.superOver.innings1.bowlers[0].name).toBe('A1')
    expect(state.superOver.innings1.isSuperOver).toBe(true)
  })

  it('superOver.innings1 initialized with totalRuns=0, wickets=0', () => {
    let state = getToSuperOver()

    expect(state.superOver.innings1.totalRuns).toBe(0)
    expect(state.superOver.innings1.wickets).toBe(0)
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(0)
    expect(state.superOver.innings1.currentOver).toEqual([])
    expect(state.superOver.innings1.fours).toBe(0)
    expect(state.superOver.innings1.sixes).toBe(0)
    expect(state.superOver.innings1.extras).toEqual({ wides: 0, noBalls: 0, byes: 0, legByes: 0 })
  })
})

describe('Super Over Scoring — Basic', () => {
  it('run recorded: innings.totalRuns increases, striker gets credit', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })

    expect(state.superOver.innings1.totalRuns).toBe(4)
    expect(state.superOver.innings1.batsmen[0].runs).toBe(4)
    expect(state.superOver.innings1.batsmen[0].fours).toBe(1)
    expect(state.superOver.innings1.batsmen[0].balls).toBe(1)
    expect(state.superOver.innings1.fours).toBe(1)
  })

  it('ball count increases on legal delivery', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 1 })
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(1)

    state = scoreSuperOverBall(state, { runs: 2 })
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(2)
  })

  it('bowler stats update on each delivery', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })

    const bowler = state.superOver.innings1.bowlers[0]
    expect(bowler.runs).toBe(4)
    expect(bowler.ballsInOver).toBe(1)
  })

  it('six recorded correctly', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 6 })

    expect(state.superOver.innings1.totalRuns).toBe(6)
    expect(state.superOver.innings1.batsmen[0].sixes).toBe(1)
    expect(state.superOver.innings1.sixes).toBe(1)
  })
})

describe('Super Over — Wicket Limit (Bug 1)', () => {
  it('SUPER_OVER_WICKETS constant is 2', () => {
    expect(SUPER_OVER_WICKETS).toBe(2)
  })

  it('1st wicket: new batter comes in, innings continues', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })

    expect(state.superOver.innings1.wickets).toBe(1)
    expect(state.superOver.innings1.batsmen[0].isOut).toBe(true) // B1 out
    // New active batsman should be B3 (reserve)
    const activeIdx = state.superOver.innings1.activeBatsmanIndex
    expect(state.superOver.innings1.batsmen[activeIdx].name).toBe('B3')
    // Innings should continue
    expect(state.superOver.phase).toBe('batting-1')
  })

  it('2nd wicket: innings ends immediately', () => {
    let state = getToSuperOver()
    // 1st wicket
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })
    // 2nd wicket — no new batsman needed
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'caught', fielder: 'A5',
    })

    expect(state.superOver.innings1.wickets).toBe(2)
    expect(state.superOver.phase).toBe('between-innings')
  })

  it('3rd batsman remains not out after 2 wickets', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'caught', fielder: 'A2',
    })

    // B2 (non-striker) should still be not out
    const inn = state.superOver.innings1
    const notOutBatsmen = inn.batsmen.filter(b => !b.isOut)
    expect(notOutBatsmen.length).toBe(1)
  })

  it('display shows X/2 format', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })
    expect(state.superOver.innings1.wickets).toBe(1)
    // After 2nd wicket
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled',
    })
    expect(state.superOver.innings1.wickets).toBe(2)
  })
})

describe('Super Over — Wicket Information (Bug 2)', () => {
  it('caught dismissal records fielder', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'caught', fielder: 'A5', newBatsman: 'B3',
    })

    const dismissed = state.superOver.innings1.batsmen[0]
    expect(dismissed.isOut).toBe(true)
    expect(dismissed.dismissal).toBe('caught')
    expect(dismissed.fielder).toBe('A5')
  })

  it('bowled dismissal recorded correctly', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })

    const dismissed = state.superOver.innings1.batsmen[0]
    expect(dismissed.dismissal).toBe('bowled')
    expect(dismissed.fielder).toBeNull()
  })

  it('run out of non-striker records correct batsman', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 1, wicket: true, dismissalType: 'runOut',
      runOutBatsman: 'nonStriker', fielder: 'A3', newBatsman: 'B3',
    })

    // Non-striker (B2) should be out
    const inn = state.superOver.innings1
    const b2 = inn.batsmen.find(b => b.name === 'B2')
    expect(b2.isOut).toBe(true)
    expect(b2.dismissal).toBe('runOut')
    expect(b2.fielder).toBe('A3')
  })

  it('run out records fielder, fielder2, and direct hit', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'runOut',
      fielder: 'A4', fielder2: 'A7', isDirectHit: true, newBatsman: 'B3',
    })

    const dismissed = state.superOver.innings1.batsmen[0]
    expect(dismissed.fielder).toBe('A4')
    expect(dismissed.fielder2).toBe('A7')
    expect(dismissed.isDirectHit).toBe(true)
  })

  it('LBW dismissal recorded correctly', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'lbw', newBatsman: 'B3',
    })

    expect(state.superOver.innings1.batsmen[0].dismissal).toBe('lbw')
  })

  it('stumped dismissal records keeper', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'stumped', fielder: 'A11', newBatsman: 'B3',
    })

    expect(state.superOver.innings1.batsmen[0].dismissal).toBe('stumped')
    expect(state.superOver.innings1.batsmen[0].fielder).toBe('A11')
  })

  it('fall of wickets is recorded', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })

    const fow = state.superOver.innings1.fallOfWickets
    expect(fow.length).toBe(1)
    expect(fow[0].batsmanName).toBe('B1') // striker was B1 after strike rotation (4 runs = no rotation)
    expect(fow[0].runs).toBe(4)
    expect(fow[0].wickets).toBe(1)
  })

  it('bowler gets wicket credit for non-runout dismissals', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })

    expect(state.superOver.innings1.bowlers[0].wickets).toBe(1)
  })

  it('bowler does NOT get wicket credit for run out', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'runOut', fielder: 'A3', newBatsman: 'B3',
    })

    expect(state.superOver.innings1.bowlers[0].wickets).toBe(0)
  })
})

describe('Super Over — Ball Counting (Bug 3)', () => {
  it('6 legal deliveries ends innings', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 })
    }

    expect(state.superOver.innings1.ballsInCurrentOver).toBe(0) // over completed
    expect(state.superOver.innings1.oversCompleted).toBe(1)
    expect(state.superOver.phase).toBe('between-innings')
  })

  it('5 legal + 2 wides + 1 NB = 8 deliveries, 5 legal → continues', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 1 }) // ball 1
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'wide' }) // not legal
    state = scoreSuperOverBall(state, { runs: 1 }) // ball 2
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'wide' }) // not legal
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'noBall' }) // not legal
    state = scoreSuperOverBall(state, { runs: 1 }) // ball 3
    state = scoreSuperOverBall(state, { runs: 1 }) // ball 4
    state = scoreSuperOverBall(state, { runs: 1 }) // ball 5

    expect(state.superOver.innings1.ballsInCurrentOver).toBe(5)
    expect(state.superOver.phase).toBe('batting-1') // still batting, need 1 more legal
  })

  it('no-ball followed by free hit — can\'t be out bowled on free hit', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'noBall' })

    expect(state.superOver.lastBallWasNoBall).toBe(true)
    // Free hit flag is set — UI uses this to restrict wicket types
  })

  it('free hit resets after legal delivery', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'noBall' })
    expect(state.superOver.lastBallWasNoBall).toBe(true)
    state = scoreSuperOverBall(state, { runs: 2 })
    expect(state.superOver.lastBallWasNoBall).toBe(false)
  })
})

describe('Super Over — Chase Logic', () => {
  it('innings 1 ends after 6 balls, target set correctly', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 })
    }

    expect(state.superOver.innings1.totalRuns).toBe(12)
    expect(state.superOver.phase).toBe('between-innings')

    // Set up innings 2
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    expect(state.superOver.innings2.target).toBe(13)
  })

  it('Team A 12, Team B hits enough on ball 3 → match ends early', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 }) // 12 runs
    }
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })

    // Ball 1: 6 runs
    state = scoreSuperOverBall(state, { runs: 6 })
    expect(state.superOver.phase).toBe('batting-2') // 6 < 13
    // Ball 2: 6 runs
    state = scoreSuperOverBall(state, { runs: 6 })
    expect(state.superOver.phase).toBe('batting-2') // 12 < 13
    // Ball 3: 4 runs → total 16 >= 13
    state = scoreSuperOverBall(state, { runs: 4 })
    expect(state.superOver.innings2.totalRuns).toBe(16)
    expect(state.superOver.phase).toBe('result')
  })

  it('innings 2 ends after 6 balls even if target not reached', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 }) // 12 runs
    }
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })

    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 0 })
    }
    expect(state.superOver.phase).toBe('result')
  })

  it('innings 1 ends after 2 wickets, target set from those runs', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'caught', fielder: 'A2',
    })

    expect(state.superOver.phase).toBe('between-innings')
    // Transition to innings 2
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    expect(state.superOver.innings2.target).toBe(5) // 4 + 1
  })
})

describe('Super Over — Extras', () => {
  it('wide adds 1 run and does NOT increment ball count', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'wide' })

    expect(state.superOver.innings1.totalRuns).toBe(1)
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(0)
    expect(state.superOver.innings1.extras.wides).toBe(1)
    expect(state.superOver.innings1.bowlers[0].runs).toBe(1)
  })

  it('wide with extra runs adds 1 + runs', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 2, extraType: 'wide' })

    expect(state.superOver.innings1.totalRuns).toBe(3) // 1 wide + 2
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(0)
    expect(state.superOver.innings1.extras.wides).toBe(1)
    expect(state.superOver.innings1.currentOver).toEqual(['Wd+2'])
  })

  it('no-ball adds 1 run and does NOT increment ball count', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'noBall' })

    expect(state.superOver.innings1.totalRuns).toBe(1)
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(0)
    expect(state.superOver.innings1.extras.noBalls).toBe(1)
  })

  it('no-ball with batted boundary counts fours/sixes for striker and innings', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 6, extraType: 'noBall', runType: 'bat' })

    expect(state.superOver.innings1.totalRuns).toBe(7) // 1 NB + 6
    expect(state.superOver.innings1.sixes).toBe(1)
    expect(state.superOver.innings1.batsmen[0].sixes).toBe(1)
    expect(state.superOver.innings1.batsmen[0].runs).toBe(6)
    expect(state.superOver.innings1.batsmen[0].balls).toBe(1)
  })

  it('byes are legal deliveries with runs added', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 3, extraType: 'bye' })

    expect(state.superOver.innings1.totalRuns).toBe(3)
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(1) // legal
    expect(state.superOver.innings1.extras.byes).toBe(3)
    expect(state.superOver.innings1.currentOver).toEqual(['B3'])
    // Striker ball count increases but NOT runs
    expect(state.superOver.innings1.batsmen[0].balls).toBe(1)
    expect(state.superOver.innings1.batsmen[0].runs).toBe(0)
  })

  it('leg-byes are legal deliveries with runs added', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 2, extraType: 'legBye' })

    expect(state.superOver.innings1.totalRuns).toBe(2)
    expect(state.superOver.innings1.ballsInCurrentOver).toBe(1)
    expect(state.superOver.innings1.extras.legByes).toBe(2)
    expect(state.superOver.innings1.currentOver).toEqual(['LB2'])
  })

  it('all extras charged correctly to bowler', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 2, extraType: 'wide' })
    state = scoreSuperOverBall(state, { runs: 4, extraType: 'noBall', runType: 'bat' })

    const bowler = state.superOver.innings1.bowlers[0]
    expect(bowler.runs).toBe(3 + 5) // (1+2) + (1+4)
  })
})

describe('Super Over — Striker Tracking', () => {
  it('single → rotate strike', () => {
    let state = getToSuperOver()
    expect(state.superOver.innings1.activeBatsmanIndex).toBe(0) // A1

    state = scoreSuperOverBall(state, { runs: 1 })
    expect(state.superOver.innings1.activeBatsmanIndex).toBe(1) // A2
    expect(state.superOver.innings1.nonStrikerIndex).toBe(0) // A1
  })

  it('double → stay at same end', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 2 })
    expect(state.superOver.innings1.activeBatsmanIndex).toBe(0) // still A1
  })

  it('triple → rotate', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 3 })
    expect(state.superOver.innings1.activeBatsmanIndex).toBe(1) // A2
  })

  it('wide → stay (no rotation for 0 extra runs on wide)', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 0, extraType: 'wide' })
    expect(state.superOver.innings1.activeBatsmanIndex).toBe(0) // still A1
  })

  it('wide + 1 bye → rotate', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 1, extraType: 'wide' })
    expect(state.superOver.innings1.activeBatsmanIndex).toBe(1) // rotated
  })

  it('no strike rotation at end of over (super over = single over)', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 })
    }
    // After completing the over, no additional rotation should happen
    // (The over is complete, innings is done)
    expect(state.superOver.innings1.oversCompleted).toBe(1)
  })

  it('wicket + 1 run on run out → correct rotation', () => {
    let state = getToSuperOver()
    // B1 on strike, B2 non-striker, run out with 1 run scored
    state = scoreSuperOverBall(state, {
      runs: 1, wicket: true, dismissalType: 'runOut',
      runOutBatsman: 'nonStriker', fielder: 'A3', newBatsman: 'B3',
    })

    const inn = state.superOver.innings1
    // 1 run scored → strike rotates first, then non-striker (A2) is run out
    // A2 is replaced by A3
    expect(inn.totalRuns).toBe(1)
    expect(inn.wickets).toBe(1)
  })
})

describe('Super Over — Tied Super Over', () => {
  it('both score equal → SUPER_OVER_RESULT checks boundary count', () => {
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
    // Openers for innings 1
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'B1', openerNonStrike: 'B2', inningsNumber: 1,
    })
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('boundary count')
    expect(state.result).toContain('Team A')
  })

  it('when boundaries also tied → tied-again phase', () => {
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
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'B1', openerNonStrike: 'B2', inningsNumber: 1,
    })
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('super-over')
    expect(state.superOver.phase).toBe('tied-again')
    expect(state.result).toContain('another Super Over')
  })

  it('RESTART_SUPER_OVER resets for another attempt', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
      cumulativeBoundaries: { team1: { fours: 5, sixes: 2 }, team2: { fours: 5, sixes: 2 } },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A4',
      team2Bowler: 'B4',
    })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'B1', openerNonStrike: 'B2', inningsNumber: 1,
    })
    for (let i = 0; i < 6; i++) state = scoreSuperOverBall(state, { runs: 1 })
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    for (let i = 0; i < 6; i++) state = scoreSuperOverBall(state, { runs: 1 })
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    expect(state.superOver.phase).toBe('tied-again')

    state = matchReducer(state, { type: 'RESTART_SUPER_OVER' })
    expect(state.superOver.phase).toBe('select-players')
    expect(state.superOver.innings1).toBeNull()
    expect(state.superOver.innings2).toBeNull()
    expect(state.result).toBe('')
    expect(state.superOverSnapshots).toEqual([])
  })

  it('END_AS_TIE moves phase to match-over', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
      cumulativeBoundaries: { team1: { fours: 5, sixes: 2 }, team2: { fours: 5, sixes: 2 } },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A4',
      team2Bowler: 'B4',
    })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'B1', openerNonStrike: 'B2', inningsNumber: 1,
    })
    for (let i = 0; i < 6; i++) state = scoreSuperOverBall(state, { runs: 1 })
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    for (let i = 0; i < 6; i++) state = scoreSuperOverBall(state, { runs: 1 })
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    state = matchReducer(state, { type: 'END_AS_TIE' })

    expect(state.phase).toBe('match-over')
  })
})

describe('Super Over Result', () => {
  it('team batting second wins when they surpass target', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    state = scoreSuperOverBall(state, { runs: 4 })
    state = scoreSuperOverBall(state, { runs: 4 })
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('won in Super Over')
    expect(state.result).toContain(state.superOver.battingSecond)
  })

  it('team batting first wins when team 2 falls short', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 2 }) // 12 runs
    }
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 1 }) // 6 runs
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('won in Super Over')
    expect(state.result).toContain(state.superOver.battingFirst)
    expect(state.result).toContain('12 vs 6')
  })

  it('result string includes "Super Over"', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 5; i++) state = scoreSuperOverBall(state, { runs: 2 })
    state = scoreSuperOverBall(state, { runs: 0 })
    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    for (let i = 0; i < 4; i++) state = scoreSuperOverBall(state, { runs: 1 })
    state = scoreSuperOverBall(state, { runs: 0 })
    state = scoreSuperOverBall(state, { runs: 0 })
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })

    expect(state.result).toMatch(/Super Over/)
  })
})

describe('Super Over Undo', () => {
  it('UNDO_LAST_SUPER_OVER_BALL restores previous super over state', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })
    state = scoreSuperOverBall(state, { runs: 6 })

    expect(state.superOver.innings1.totalRuns).toBe(10)
    expect(state.superOver.innings1.fours).toBe(1)
    expect(state.superOver.innings1.sixes).toBe(1)
    expect(state.superOverSnapshots.length).toBe(2)

    // Undo the six
    state = matchReducer(state, { type: 'UNDO_LAST_SUPER_OVER_BALL' })
    expect(state.superOver.innings1.totalRuns).toBe(4)
    expect(state.superOver.innings1.fours).toBe(1)
    expect(state.superOver.innings1.sixes).toBe(0)
    expect(state.superOverSnapshots.length).toBe(1)

    // Undo the four
    state = matchReducer(state, { type: 'UNDO_LAST_SUPER_OVER_BALL' })
    expect(state.superOver.innings1.totalRuns).toBe(0)
    expect(state.superOver.innings1.fours).toBe(0)
    expect(state.superOverSnapshots.length).toBe(0)
  })

  it('UNDO_LAST_SUPER_OVER_BALL does nothing when history is empty', () => {
    let state = getToSuperOver()
    const before = state
    state = matchReducer(state, { type: 'UNDO_LAST_SUPER_OVER_BALL' })
    expect(state).toBe(before)
  })

  it('undo restores wicket — batter is restored', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, {
      runs: 0, wicket: true, dismissalType: 'bowled', newBatsman: 'B3',
    })
    expect(state.superOver.innings1.wickets).toBe(1)
    expect(state.superOver.innings1.batsmen[0].isOut).toBe(true)

    state = matchReducer(state, { type: 'UNDO_LAST_SUPER_OVER_BALL' })
    expect(state.superOver.innings1.wickets).toBe(0)
    expect(state.superOver.innings1.batsmen[0].isOut).toBe(false)
  })

  it('UNDO_TO_SUPER_OVER_SNAPSHOT restores to specific point', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 1 })
    state = scoreSuperOverBall(state, { runs: 2 })
    state = scoreSuperOverBall(state, { runs: 4 })

    expect(state.superOver.innings1.totalRuns).toBe(7)
    expect(state.superOverSnapshots.length).toBe(3)

    // Undo to after first ball (sequence 1)
    state = matchReducer(state, { type: 'UNDO_TO_SUPER_OVER_SNAPSHOT', sequence: 1 })
    expect(state.superOver.innings1.totalRuns).toBe(0)
    expect(state.superOverSnapshots.length).toBe(0)
  })
})

describe('Super Over — Phase Transitions', () => {
  it('select-players → select-openers-1 → batting-1', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over', cumulativeScores: { team1: 100, team2: 100 } }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    expect(state.superOver.phase).toBe('select-players')

    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1', 'A2', 'A3'],
      team2Batsmen: ['B1', 'B2', 'B3'],
      team1Bowler: 'A1',
      team2Bowler: 'B1',
    })
    expect(state.superOver.phase).toBe('select-openers-1')

    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'B1', openerNonStrike: 'B2', inningsNumber: 1,
    })
    expect(state.superOver.phase).toBe('batting-1')
  })

  it('batting-1 → between-innings → select-openers-2 → batting-2 → result', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) state = scoreSuperOverBall(state, { runs: 1 })
    expect(state.superOver.phase).toBe('between-innings')

    state = matchReducer(state, { type: 'SO_NEXT_INNINGS' })
    expect(state.superOver.phase).toBe('select-openers-2')

    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_OPENERS',
      openerOnStrike: 'A1', openerNonStrike: 'A2', inningsNumber: 2,
    })
    expect(state.superOver.phase).toBe('batting-2')

    for (let i = 0; i < 6; i++) state = scoreSuperOverBall(state, { runs: 0 })
    expect(state.superOver.phase).toBe('result')
  })
})

describe('Super Over — battingFirst assignment', () => {
  it('battingFirst is inningsOrder[3]', () => {
    let state = setupMatch()
    const lastBowlingTeam = state.inningsOrder[3]
    state = {
      ...state,
      phase: 'super-over',
      cumulativeScores: { team1: 100, team2: 100 },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })

    expect(state.superOver.battingFirst).toBe(lastBowlingTeam)
    expect(state.superOver.battingSecond).toBe(state.inningsOrder[2])
  })
})

describe('Super Over — Over Completion', () => {
  it('maiden over detected when all dots', () => {
    let state = getToSuperOver()
    for (let i = 0; i < 6; i++) {
      state = scoreSuperOverBall(state, { runs: 0 })
    }

    const bowler = state.superOver.innings1.bowlers[0]
    expect(bowler.maidens).toBe(1)
    expect(bowler.overs).toBe(1)
    expect(state.superOver.innings1.allOvers.length).toBe(1)
  })

  it('non-maiden detected when runs scored', () => {
    let state = getToSuperOver()
    state = scoreSuperOverBall(state, { runs: 4 })
    for (let i = 0; i < 5; i++) {
      state = scoreSuperOverBall(state, { runs: 0 })
    }

    const bowler = state.superOver.innings1.bowlers[0]
    expect(bowler.maidens).toBe(0)
  })
})
