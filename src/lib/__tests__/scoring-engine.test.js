import { describe, it, expect } from 'vitest'
import { matchReducer, initialState, createInnings } from '../../context/MatchContext.jsx'
import { MAX_OVERS_PER_BOWLER, MAX_WICKETS, BALLS_PER_OVER, FOLLOW_ON_THRESHOLD, SUPER_OVER_WICKETS } from '../constants'

// ─── Helpers ─────────────────────────────────────────────────

function setupMatch(overrides = {}) {
  let state = { ...initialState }
  state = matchReducer(state, {
    type: 'SET_TEAMS', team1: 'Team A', team2: 'Team B', oversPerInnings: 12,
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
  return { ...state, ...overrides }
}

function scoreBall(state, action = {}) {
  return matchReducer(state, { type: 'SCORE_BALL', runs: 0, runType: 'bat', ...action })
}

function allOut(state) {
  // Dismisses all remaining batsmen. Assumes current batsmen are at indices 0 and 1.
  // We need to add batsmen 3 through 11 (9 more wickets after opener pair).
  for (let i = 3; i <= 11; i++) {
    const batter = state.innings[state.currentInnings].battingTeam === 'Team A' ? `A${i}` : `B${i}`
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: batter })
  }
  // 10th wicket — no new batsman
  state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
  return state
}

function completeOver(state, runsPerBall = 0) {
  for (let i = 0; i < BALLS_PER_OVER; i++) {
    state = scoreBall(state, { runs: runsPerBall })
  }
  return state
}

function startNextInnings(state, batsman1, batsman2, bowler) {
  state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1, batsman2, bowler })
  return state
}

// Complete a full innings (all 12 overs) with a given runs-per-ball
function completeFullInnings(state, runsPerBall, bowlers) {
  // 12 overs = 4 bowlers x 3 overs each
  for (let overNum = 0; overNum < 12; overNum++) {
    state = completeOver(state, runsPerBall)
    if (overNum < 11 && state.phase === 'new-bowler') {
      state = matchReducer(state, { type: 'SET_BOWLER', bowler: bowlers[overNum % bowlers.length] })
    }
  }
  return state
}

// ─── Tests ───────────────────────────────────────────────────

describe('Basic Innings Flow', () => {
  it('should record runs 0-6 correctly to batsman and total', () => {
    for (const runs of [0, 1, 2, 3, 4, 5, 6]) {
      const state = setupMatch()
      const next = scoreBall(state, { runs })
      const inn = next.innings[0]
      expect(inn.totalRuns).toBe(runs)
      // Striker is at activeBatsmanIndex=0 initially
      expect(inn.batsmen[0].runs).toBe(runs)
      expect(inn.batsmen[0].balls).toBe(1)
    }
  })

  it('should add wide as 1 run to team total and extras.wides, NOT a legal delivery', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 0 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.wides).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    // Batsman should NOT get balls faced on a wide
    expect(inn.batsmen[0].balls).toBe(0)
  })

  it('should add wide with extra runs: wide + 2 runs = 3 total', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 2 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(3) // 1 penalty + 2 additional
    expect(inn.extras.wides).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
  })

  it('should add no-ball as 1 run to team total and extras.noBalls, NOT a legal delivery, sets lastBallWasNoBall', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    expect(next.lastBallWasNoBall).toBe(true)
  })

  it('should add bye runs to team totalRuns and extras.byes but NOT to batsman.runs', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'bye', runs: 3 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(3)
    expect(inn.extras.byes).toBe(3)
    expect(inn.batsmen[0].runs).toBe(0) // NOT credited to batsman
    expect(inn.batsmen[0].balls).toBe(1) // IS a legal delivery
    expect(inn.ballsInCurrentOver).toBe(1)
  })

  it('should add leg-bye runs to team totalRuns and extras.legByes but NOT to batsman.runs', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'legBye', runs: 2 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(2)
    expect(inn.extras.legByes).toBe(2)
    expect(inn.batsmen[0].runs).toBe(0) // NOT credited to batsman
    expect(inn.batsmen[0].balls).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(1)
  })

  it('should mark batsman isOut, set dismissal, add new batsman, update fallOfWickets on wicket', () => {
    const state = setupMatch()
    // Score a run first so fall-of-wicket total is non-zero
    let s = scoreBall(state, { runs: 4 })
    s = scoreBall(s, { wicket: true, dismissalType: 'caught', newBatsman: 'A3' })
    const inn = s.innings[0]
    expect(inn.wickets).toBe(1)
    expect(inn.batsmen[0].isOut).toBe(true)
    expect(inn.batsmen[0].dismissal).toBe('caught')
    expect(inn.batsmen.length).toBe(3) // A1, A2, A3
    expect(inn.batsmen[2].name).toBe('A3')
    expect(inn.fallOfWickets.length).toBe(1)
    expect(inn.fallOfWickets[0].runs).toBe(4)
    expect(inn.fallOfWickets[0].wickets).toBe(1)
    expect(inn.fallOfWickets[0].batsmanName).toBe('A1')
  })

  it('should end innings when all out (10 wickets) and phase becomes innings-break', () => {
    let state = setupMatch()
    state = allOut(state)
    expect(state.innings[0].wickets).toBe(MAX_WICKETS)
    expect(state.phase).toBe('innings-break')
  })

  it('should end innings when overs exhausted (12 overs) and phase changes', () => {
    let state = setupMatch()
    // Need to rotate bowlers across 12 overs. 4 bowlers x 3 overs each.
    const bowlers = ['B2', 'B3', 'B4', 'B1']
    state = completeFullInnings(state, 0, bowlers)
    expect(state.innings[0].oversCompleted).toBe(12)
    // Phase should be innings-break after first innings exhausted overs
    expect(state.phase).toBe('innings-break')
  })

  it('should NOT count wides and no-balls as legal deliveries (ball count does not increase)', () => {
    let state = setupMatch()
    // Bowl a wide
    state = scoreBall(state, { extraType: 'wide', runs: 0 })
    expect(state.innings[0].ballsInCurrentOver).toBe(0)
    // Bowl a no-ball
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.innings[0].ballsInCurrentOver).toBe(0)
    // Bowl a legal ball
    state = scoreBall(state, { runs: 0 })
    expect(state.innings[0].ballsInCurrentOver).toBe(1)
  })

  it('should increment over after 6 legal deliveries and phase becomes new-bowler', () => {
    let state = setupMatch()
    state = completeOver(state, 0)
    const inn = state.innings[0]
    expect(inn.oversCompleted).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    expect(inn.allOvers.length).toBe(1)
    expect(inn.currentOver.length).toBe(0)
    expect(state.phase).toBe('new-bowler')
  })

  it('should rotate strike on odd runs (1, 3)', () => {
    // Test with 1 run
    let state = setupMatch()
    let next = scoreBall(state, { runs: 1 })
    expect(next.innings[0].activeBatsmanIndex).toBe(1)
    expect(next.innings[0].nonStrikerIndex).toBe(0)

    // Test with 3 runs
    state = setupMatch()
    next = scoreBall(state, { runs: 3 })
    expect(next.innings[0].activeBatsmanIndex).toBe(1)
    expect(next.innings[0].nonStrikerIndex).toBe(0)
  })

  it('should NOT rotate strike on even runs (0, 2, 4, 6)', () => {
    for (const runs of [0, 2, 4, 6]) {
      const state = setupMatch()
      const next = scoreBall(state, { runs })
      expect(next.innings[0].activeBatsmanIndex).toBe(0)
      expect(next.innings[0].nonStrikerIndex).toBe(1)
    }
  })

  it('should rotate strike at end of over', () => {
    let state = setupMatch()
    // 6 dot balls
    state = completeOver(state, 0)
    const inn = state.innings[0]
    // End-of-over swap: active and non-striker should be swapped
    expect(inn.activeBatsmanIndex).toBe(1)
    expect(inn.nonStrikerIndex).toBe(0)
  })
})

describe('Cumulative Scoring - Normal Match', () => {
  it('should update cumulative totals after each innings', () => {
    let state = setupMatch()

    // Innings 0: Team A scores 4 runs, all out
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)
    expect(state.cumulativeScores.team1).toBe(4)
    expect(state.cumulativeScores.team2).toBe(0)

    // Innings 1: Team B scores 6 runs, all out
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 6 })
    state = allOut(state)
    // B scored 6, which is NOT < 4*0.5=2, so no follow-on. Phase is squad-rotation.
    expect(state.cumulativeScores.team1).toBe(4)
    expect(state.cumulativeScores.team2).toBe(6)

    // Skip squad rotation
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Innings 2: Team A scores 5 runs, all out
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
    state = scoreBall(state, { runs: 5 })
    state = allOut(state)
    expect(state.cumulativeScores.team1).toBe(9) // 4 + 5
    expect(state.cumulativeScores.team2).toBe(6)
    expect(state.phase).toBe('innings-break') // No follow-on enforced, always innings-break after inn 2

    // Innings 3: Team B scores 2 runs, all out
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 2 })
    state = allOut(state)
    expect(state.cumulativeScores.team1).toBe(9)
    expect(state.cumulativeScores.team2).toBe(8) // 6 + 2
  })

  it('should declare Team B wins when B chases cumulative target in 4th innings', () => {
    let state = setupMatch()

    // Innings 0: Team A scores 4 runs, all out
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    // Innings 1: Team B scores 6 runs, all out (no follow-on: 6 >= 4*0.5)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 6 })
    state = allOut(state)
    expect(state.phase).toBe('squad-rotation')

    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Innings 2: Team A scores 3 runs, all out (cumulative A: 4+3=7)
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
    state = scoreBall(state, { runs: 3 })
    state = allOut(state)
    expect(state.phase).toBe('innings-break')

    // Innings 3: Team B needs cumulative > 7 (currently at 6). Need 2+ runs.
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    // Score 2 runs to reach cumulative 8 > 7
    state = scoreBall(state, { runs: 2 })
    // When batting team's live cumulative (6+2=8) > bowling team's cumulative (7),
    // the 4th innings ends early with target chased.
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team B')
    expect(state.result).toContain('won')
  })

  it('should declare Team A wins by run margin when Team B falls short in 4th innings', () => {
    let state = setupMatch()

    // Innings 0: Team A scores 6 runs, all out
    state = scoreBall(state, { runs: 6 })
    state = allOut(state)

    // Innings 1: Team B scores 6 runs, all out (no follow-on: 6 >= 6*0.5=3)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 6 })
    state = allOut(state)
    expect(state.phase).toBe('squad-rotation')

    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Innings 2: Team A scores 4 runs, all out (cumulative A: 6+4=10)
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)
    expect(state.phase).toBe('innings-break')

    // Innings 3: Team B all out with 2 runs (cumulative B: 6+2=8, A: 10). A wins by 2.
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 2 })
    state = allOut(state)
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team A')
    expect(state.result).toContain('2 runs')
  })

  it('should go to super-over when both teams are tied after 4 innings', () => {
    let state = setupMatch()

    // Innings 0: Team A scores 5 runs, all out
    state = scoreBall(state, { runs: 5 })
    state = allOut(state)

    // Innings 1: Team B scores 5 runs, all out (no follow-on: 5 >= 5*0.5=2.5)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 5 })
    state = allOut(state)
    expect(state.phase).toBe('squad-rotation')

    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Innings 2: Team A scores 3 runs, all out (cumulative A: 5+3=8)
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
    state = scoreBall(state, { runs: 3 })
    state = allOut(state)
    expect(state.phase).toBe('innings-break')

    // Innings 3: Team B scores 3 runs, all out (cumulative B: 5+3=8). Tied!
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 3 })
    state = allOut(state)
    expect(state.cumulativeScores.team1).toBe(8)
    expect(state.cumulativeScores.team2).toBe(8)
    expect(state.phase).toBe('super-over')
  })
})

describe('Cumulative Scoring - Follow-On Match', () => {
  it('should trigger follow-on when B < 50% of A', () => {
    let state = setupMatch()
    // Inn 0: Team A scores 4 runs, all out
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)
    expect(state.phase).toBe('innings-break')

    // Inn 1: Team B scores 1 run (1 < 4*0.5=2), all out
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')
  })

  it('should NOT trigger follow-on when B is exactly 50% of A (not strictly less)', () => {
    let state = setupMatch()
    // Inn 0: Team A scores 4 runs, all out
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    // Inn 1: Team B scores 2 runs (2 is NOT < 4*0.5=2), all out
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 2 })
    state = allOut(state)
    expect(state.phase).toBe('squad-rotation') // NOT follow-on-decision
  })

  it('should NOT trigger follow-on when B > 50% of A', () => {
    let state = setupMatch()
    // Inn 0: Team A scores 4 runs, all out
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    // Inn 1: Team B scores 3 runs (3 > 4*0.5=2), all out
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 3 })
    state = allOut(state)
    expect(state.phase).toBe('squad-rotation') // NOT follow-on-decision
  })

  it('should handle low-scoring edge: A=4, B=1 (1 < 4*0.5=2) triggers follow-on', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')
  })

  it('should NOT trigger follow-on at boundary case: A=4, B=2 (2 is NOT < 2)', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 2 })
    state = allOut(state)
    expect(state.phase).toBe('squad-rotation')
  })

  it('should swap inningsOrder[2] and [3] and set followOnEnforced=true after DECIDE_FOLLOW_ON enforce', () => {
    let state = setupMatch()
    // Build up to follow-on-decision phase
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')

    const orderBefore = [...state.inningsOrder]
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })

    expect(state.followOnEnforced).toBe(true)
    expect(state.inningsOrder[2]).toBe(orderBefore[3]) // swapped
    expect(state.inningsOrder[3]).toBe(orderBefore[2]) // swapped
    expect(state.phase).toBe('squad-rotation')
  })

  it('should leave inningsOrder unchanged and followOnEnforced false after DECIDE_FOLLOW_ON decline', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')

    const orderBefore = [...state.inningsOrder]
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: false })

    expect(state.followOnEnforced).toBe(false)
    expect(state.inningsOrder[0]).toBe(orderBefore[0])
    expect(state.inningsOrder[1]).toBe(orderBefore[1])
    expect(state.inningsOrder[2]).toBe(orderBefore[2])
    expect(state.inningsOrder[3]).toBe(orderBefore[3])
    expect(state.phase).toBe('squad-rotation')
  })
})

describe('Innings Victory', () => {
  it('should award innings victory when follow-on team still trails after 3rd innings', () => {
    // A=4 (all out), B=1 (follow-on enforced), B=2 (follow-on innings).
    // B cumulative = 1+2 = 3 < A = 4. Result: 'Team A won by an innings and 1 run'.
    let state = setupMatch()

    // Inn 0: Team A scores 4 runs, all out
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)
    expect(state.cumulativeScores.team1).toBe(4)

    // Inn 1: Team B scores 1 run, all out (1 < 4*0.5=2 → follow-on)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')
    expect(state.cumulativeScores.team2).toBe(1)

    // Enforce follow-on
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team B (follow-on) scores 2 runs, all out. B cumulative = 1+2 = 3 < A = 4.
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 2 })
    state = allOut(state)

    expect(state.phase).toBe('match-over')
    expect(state.result).toBe('Team A won by an innings and 1 run')
  })

  it('should proceed to 4th innings when follow-on team surpasses enforcing team', () => {
    // A=4, B=1 (follow-on), B=4. B cumulative = 1+4 = 5 > A = 4. Go to innings-break.
    let state = setupMatch()

    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')

    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team B scores 4 runs, all out. B cumulative = 1+4 = 5 > A = 4.
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    expect(state.phase).toBe('innings-break')
    expect(state.result).toBeFalsy()
  })

  it('should proceed to 4th innings when follow-on team exactly ties after 3rd innings', () => {
    // A=4, B=1 (follow-on), B=3. B cumulative = 1+3 = 4 = A = 4. Not less, so innings-break.
    let state = setupMatch()

    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')

    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team B scores 3 runs, all out. B cumulative = 1+3 = 4 = A = 4.
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 3 })
    state = allOut(state)

    expect(state.phase).toBe('innings-break')
    expect(state.result).toBeFalsy()
  })

  it('should always go to innings-break after 3rd innings in a normal match (no follow-on)', () => {
    let state = setupMatch()

    // Inn 0: Team A scores 0 runs, all out
    state = allOut(state)
    expect(state.phase).toBe('innings-break')

    // Inn 1: Team B scores 0 runs, all out (0 is NOT < 0*0.5=0, no follow-on)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = allOut(state)
    expect(state.phase).toBe('squad-rotation')

    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team A scores 0 runs, all out
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
    state = allOut(state)

    // Without follow-on enforced, always goes to innings-break
    expect(state.phase).toBe('innings-break')
    expect(state.result).toBeFalsy()
  })

  it('should calculate correct innings victory margin: A=6, B=1 (follow-on), B=2. Margin=6-3=3.', () => {
    let state = setupMatch()

    // Inn 0: Team A scores 6
    state = scoreBall(state, { runs: 6 })
    state = allOut(state)

    // Inn 1: Team B scores 1 (1 < 6*0.5=3 → follow-on)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.phase).toBe('follow-on-decision')

    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team B scores 2. B cumulative = 1+2 = 3. A = 6. Margin = 6-3 = 3.
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 2 })
    state = allOut(state)

    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('innings and 3 runs')
  })
})

describe('Bowler Limits', () => {
  it('should reject SET_BOWLER when bowler has reached MAX_OVERS_PER_BOWLER (3 overs)', () => {
    let state = setupMatch()

    // B1 bowls over 1
    state = completeOver(state, 0)
    expect(state.phase).toBe('new-bowler')
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })

    // B2 bowls over 2
    state = completeOver(state, 0)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })

    // B1 bowls over 3
    state = completeOver(state, 0)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })

    // B2 bowls over 4
    state = completeOver(state, 0)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })

    // B1 bowls over 5 (B1 now has 3 overs)
    state = completeOver(state, 0)
    expect(state.innings[0].bowlerOversMap['B1']).toBe(MAX_OVERS_PER_BOWLER)

    // Trying to set B1 again should be rejected (returns same state)
    const beforeReject = state
    const afterReject = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })
    expect(afterReject).toBe(beforeReject) // Exact same reference — rejected
  })

  it('should allow bowler with 2 overs bowled to bowl 1 more', () => {
    let state = setupMatch()

    // B1 bowls over 1
    state = completeOver(state, 0)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })

    // B2 bowls over 2
    state = completeOver(state, 0)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })

    // B1 bowls over 3 (B1 now has 2 overs)
    state = completeOver(state, 0)
    expect(state.innings[0].bowlerOversMap['B1']).toBe(2)

    // B1 should still be allowed to bowl (has 1 remaining)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })
    state = completeOver(state, 0)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })
    // If accepted, phase should become 'scoring'
    expect(state.phase).toBe('scoring')
  })

  it('should rotate multiple bowlers correctly across an innings', () => {
    let state = setupMatch()
    const bowlers = ['B2', 'B3', 'B4', 'B1']

    // Bowl 12 overs: B1, B2, B3, B4, B1, B2, B3, B4, B1, B2, B3, B4
    // Each bowler gets exactly 3 overs
    state = completeFullInnings(state, 0, bowlers)

    const inn = state.innings[0]
    expect(inn.oversCompleted).toBe(12)
    expect(inn.bowlerOversMap['B1']).toBe(MAX_OVERS_PER_BOWLER)
    expect(inn.bowlerOversMap['B2']).toBe(MAX_OVERS_PER_BOWLER)
    expect(inn.bowlerOversMap['B3']).toBe(MAX_OVERS_PER_BOWLER)
    expect(inn.bowlerOversMap['B4']).toBe(MAX_OVERS_PER_BOWLER)
  })
})

describe('Free Hit', () => {
  it('should set lastBallWasNoBall to true after a no-ball', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(next.lastBallWasNoBall).toBe(true)
  })

  it('should set lastBallWasNoBall to false after a legal delivery', () => {
    let state = setupMatch()
    // First a no-ball to set the flag
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)
    // Then a normal legal delivery
    state = scoreBall(state, { runs: 0 })
    expect(state.lastBallWasNoBall).toBe(false)
  })

  it('should keep lastBallWasNoBall true when no-ball followed by another no-ball', () => {
    let state = setupMatch()
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)
  })

  it('should set lastBallWasNoBall to false when a wide follows a no-ball', () => {
    let state = setupMatch()
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)
    state = scoreBall(state, { extraType: 'wide', runs: 0 })
    expect(state.lastBallWasNoBall).toBe(false)
  })
})

describe('Undo', () => {
  it('should restore previous state exactly on UNDO_LAST_BALL', () => {
    let state = setupMatch()
    const before = state
    state = scoreBall(state, { runs: 4 })
    expect(state.innings[0].totalRuns).toBe(4)
    expect(state.inningsSnapshots.length).toBe(1)

    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].totalRuns).toBe(0)
    expect(state.innings[0].batsmen[0].runs).toBe(0)
    expect(state.innings[0].batsmen[0].balls).toBe(0)
    expect(state.inningsSnapshots.length).toBe(0)
    expect(state.phase).toBe(before.phase)
  })

  it('should do nothing when UNDO_LAST_BALL with no history', () => {
    const state = setupMatch()
    expect(state.inningsSnapshots.length).toBe(0)
    const next = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(next).toBe(state) // Exact same reference
  })

  it('should support multiple undos in sequence', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 1 })
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 6 })
    expect(state.innings[0].totalRuns).toBe(11)
    expect(state.inningsSnapshots.length).toBe(3)

    // Undo the 6
    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].totalRuns).toBe(5)
    expect(state.inningsSnapshots.length).toBe(2)

    // Undo the 4
    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].totalRuns).toBe(1)
    expect(state.inningsSnapshots.length).toBe(1)

    // Undo the 1
    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].totalRuns).toBe(0)
    expect(state.inningsSnapshots.length).toBe(0)
  })
})
