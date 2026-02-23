import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER } from '../constants'

function setupMatch() {
  let state = { ...initialState }
  state = matchReducer(state, {
    type: 'SET_TEAMS', team1: 'Team A', team2: 'Team B', oversPerInnings: 12,
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

function getInn(state) {
  return state.innings[state.currentInnings]
}

// ---------------------------------------------------------------------------
// GROUP: Consecutive Extras
// ---------------------------------------------------------------------------

describe('Consecutive Extras', () => {
  it('3 consecutive wides then a dot ball', () => {
    let state = setupMatch()

    // Wide 1
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    let inn = getInn(state)
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.wides).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)

    // Wide 2
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    inn = getInn(state)
    expect(inn.totalRuns).toBe(2)
    expect(inn.extras.wides).toBe(2)
    expect(inn.ballsInCurrentOver).toBe(0)

    // Wide 3
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    inn = getInn(state)
    expect(inn.totalRuns).toBe(3)
    expect(inn.extras.wides).toBe(3)
    expect(inn.ballsInCurrentOver).toBe(0)

    // Dot ball (first legal delivery)
    state = scoreBall(state, { runs: 0 })
    inn = getInn(state)
    expect(inn.totalRuns).toBe(3)
    expect(inn.ballsInCurrentOver).toBe(1)

    // Bowler runs should include all 3 wides
    const bowler = inn.bowlers[inn.currentBowlerIndex]
    expect(bowler.runs).toBe(3)
  })

  it('no-ball then dot on free hit then another normal ball', () => {
    let state = setupMatch()

    // No-ball (0 runs off the bat)
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    let inn = getInn(state)
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.noBalls).toBe(1)
    expect(state.lastBallWasNoBall).toBe(true)
    expect(inn.ballsInCurrentOver).toBe(0)

    // Dot on free hit (legal delivery, 0 runs)
    state = scoreBall(state, { runs: 0 })
    inn = getInn(state)
    expect(inn.totalRuns).toBe(1)
    expect(state.lastBallWasNoBall).toBe(false)
    expect(inn.ballsInCurrentOver).toBe(1)

    // Another normal ball (single)
    state = scoreBall(state, { runs: 1 })
    inn = getInn(state)
    expect(inn.totalRuns).toBe(2)
    expect(state.lastBallWasNoBall).toBe(false)
    expect(inn.ballsInCurrentOver).toBe(2)
  })

  it('wide with 4 additional runs (byes off a wide)', () => {
    let state = setupMatch()

    const strikerBefore = getInn(state).batsmen[getInn(state).activeBatsmanIndex]
    const strikerRunsBefore = strikerBefore.runs

    state = scoreBall(state, { extraType: 'wide', runs: 4, runType: 'extra' })
    const inn = getInn(state)

    // 1 (wide penalty) + 4 (additional runs) = 5
    expect(inn.totalRuns).toBe(5)
    expect(inn.extras.wides).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0) // Not a legal delivery

    // All 5 runs charged to the bowler
    const bowler = inn.bowlers[inn.currentBowlerIndex]
    expect(bowler.runs).toBe(5)

    // Batter runs unchanged (wide: striker stats not touched)
    const striker = inn.batsmen[0] // A1 was striker
    expect(striker.runs).toBe(strikerRunsBefore)

    // runs=4, 4%2=0 → no strike change
    expect(inn.activeBatsmanIndex).toBe(0)
    expect(inn.nonStrikerIndex).toBe(1)
  })

  it('no-ball + batter hits 6', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'noBall', runs: 6, runType: 'bat' })
    const inn = getInn(state)

    // 1 (NB penalty) + 6 = 7
    expect(inn.totalRuns).toBe(7)
    expect(inn.extras.noBalls).toBe(1)

    // Striker credited with 6 runs and a six
    const striker = inn.batsmen[0]
    expect(striker.runs).toBe(6)
    expect(striker.sixes).toBe(1)
    expect(striker.balls).toBe(1)

    // Innings-level six count
    expect(inn.sixes).toBe(1)

    // Bowler charged with all 7 runs
    const bowler = inn.bowlers[inn.currentBowlerIndex]
    expect(bowler.runs).toBe(7)

    // 6%2=0 → no strike change
    expect(inn.activeBatsmanIndex).toBe(0)
    expect(inn.nonStrikerIndex).toBe(1)

    // Free hit flag set
    expect(state.lastBallWasNoBall).toBe(true)

    // Not a legal delivery
    expect(inn.ballsInCurrentOver).toBe(0)
  })

  it('no-ball + batter runs 3', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'noBall', runs: 3, runType: 'bat' })
    const inn = getInn(state)

    // 1 (NB penalty) + 3 = 4
    expect(inn.totalRuns).toBe(4)
    expect(inn.extras.noBalls).toBe(1)

    // Striker credited with 3 runs
    const striker = inn.batsmen[0]
    expect(striker.runs).toBe(3)
    expect(striker.balls).toBe(1)

    // Bowler charged with all 4 runs
    const bowler = inn.bowlers[inn.currentBowlerIndex]
    expect(bowler.runs).toBe(4)

    // 3%2=1 → strike changes
    expect(inn.activeBatsmanIndex).toBe(1)
    expect(inn.nonStrikerIndex).toBe(0)

    // Free hit flag set
    expect(state.lastBallWasNoBall).toBe(true)

    // Not a legal delivery
    expect(inn.ballsInCurrentOver).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// GROUP: Free Hit Chaining
// ---------------------------------------------------------------------------

describe('Free Hit Chaining', () => {
  it('no-ball → free hit ball is another no-ball → another free hit → dot', () => {
    let state = setupMatch()

    // Ball 1: No-ball (0 runs off bat)
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)
    let inn = getInn(state)
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)

    // Ball 2: Another no-ball on the free hit delivery
    // The free hit status doesn't prevent it from being a no-ball
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true) // Stays true — another NB
    inn = getInn(state)
    expect(inn.totalRuns).toBe(2)
    expect(inn.extras.noBalls).toBe(2)
    expect(inn.ballsInCurrentOver).toBe(0) // Still no legal deliveries

    // Ball 3: Dot ball — this is the free hit from ball 2's no-ball
    state = scoreBall(state, { runs: 0 })
    expect(state.lastBallWasNoBall).toBe(false) // Cleared
    inn = getInn(state)
    expect(inn.totalRuns).toBe(2)
    expect(inn.extras.noBalls).toBe(2)
    expect(inn.ballsInCurrentOver).toBe(1) // Only ball 3 was legal
  })

  it('no-ball → free hit scored for 4 → lastBallWasNoBall resets', () => {
    let state = setupMatch()

    // No-ball
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)

    // Free hit: batter smashes 4 (normal delivery — legal ball)
    state = scoreBall(state, { runs: 4 })
    expect(state.lastBallWasNoBall).toBe(false)

    const inn = getInn(state)
    expect(inn.totalRuns).toBe(5) // 1 (NB) + 4
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(1) // Only the 4 was legal

    const striker = inn.batsmen[0]
    expect(striker.runs).toBe(4)
    expect(striker.fours).toBe(1)
  })

  it('triple chained no-balls then a legal delivery', () => {
    let state = setupMatch()

    // NB 1
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)

    // NB 2 (free hit was another NB)
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)

    // NB 3 (free hit was yet another NB)
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)

    let inn = getInn(state)
    expect(inn.totalRuns).toBe(3)
    expect(inn.extras.noBalls).toBe(3)
    expect(inn.ballsInCurrentOver).toBe(0)

    // Finally a legal delivery — dot ball
    state = scoreBall(state, { runs: 0 })
    expect(state.lastBallWasNoBall).toBe(false)
    inn = getInn(state)
    expect(inn.totalRuns).toBe(3)
    expect(inn.ballsInCurrentOver).toBe(1)

    // currentOver should have 4 entries: NB, NB, NB, 0
    expect(inn.currentOver).toEqual(['NB', 'NB', 'NB', '0'])
  })
})

// ---------------------------------------------------------------------------
// GROUP: Extras Don't Count as Batter Runs
// ---------------------------------------------------------------------------

describe("Extras Don't Count as Batter Runs", () => {
  it('wide: 0 runs to batter, 0 balls faced', () => {
    let state = setupMatch()

    const strikerIdx = getInn(state).activeBatsmanIndex
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    const inn = getInn(state)
    const striker = inn.batsmen[strikerIdx]

    // Striker gets no runs and no balls counted for a wide
    expect(striker.runs).toBe(0)
    expect(striker.balls).toBe(0)
  })

  it('bye: 0 runs to batter, 1 ball faced (legal delivery)', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'bye', runs: 2, runType: 'extra' })
    const inn = getInn(state)
    const striker = inn.batsmen[0] // A1 was on strike

    // Batter faces the delivery but gets no credit for runs
    expect(striker.runs).toBe(0)
    expect(striker.balls).toBe(1)

    // Runs go to extras
    expect(inn.extras.byes).toBe(2)
    expect(inn.totalRuns).toBe(2)
  })

  it('leg bye: 0 runs to batter, 1 ball faced (legal delivery)', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'legBye', runs: 3, runType: 'extra' })
    const inn = getInn(state)
    const striker = inn.batsmen[0]

    expect(striker.runs).toBe(0)
    expect(striker.balls).toBe(1)

    expect(inn.extras.legByes).toBe(3)
    expect(inn.totalRuns).toBe(3)
  })

  it('no-ball with runType=bat and runs=4: 4 runs to batter', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'noBall', runs: 4, runType: 'bat' })
    const inn = getInn(state)
    const striker = inn.batsmen[0]

    // Batter is credited with runs when runType is 'bat'
    expect(striker.runs).toBe(4)
    expect(striker.balls).toBe(1)
    expect(striker.fours).toBe(1)

    // The NB penalty (1) is extra, batted runs (4) go to striker
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.totalRuns).toBe(5)
  })

  it('no-ball with runType=extra and runs=0: 0 runs to batter, 0 balls faced', () => {
    let state = setupMatch()

    // When runType is not 'bat', the striker gets nothing
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'extra' })
    const inn = getInn(state)
    const striker = inn.batsmen[0]

    expect(striker.runs).toBe(0)
    expect(striker.balls).toBe(0) // Not 'bat' runType → striker.balls not incremented

    expect(inn.extras.noBalls).toBe(1)
    expect(inn.totalRuns).toBe(1) // Just the NB penalty
  })

  it('no-ball with runType=extra and runs=2 (leg byes off NB): 0 runs to batter', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'noBall', runs: 2, runType: 'extra' })
    const inn = getInn(state)
    const striker = inn.batsmen[0]

    // No batter credit when runType is not 'bat'
    expect(striker.runs).toBe(0)
    expect(striker.balls).toBe(0)

    // Total is 1 (NB) + 2 (extra runs) = 3
    expect(inn.totalRuns).toBe(3)
    expect(inn.extras.noBalls).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// GROUP: Maiden Over With Extras
// ---------------------------------------------------------------------------

describe('Maiden Over With Extras', () => {
  it('6 dot balls = maiden', () => {
    let state = setupMatch()

    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.bowlers[0].maidens).toBe(1)
  })

  it('5 dots + 1 single = NOT a maiden', () => {
    let state = setupMatch()

    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    state = scoreBall(state, { runs: 1 })

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.bowlers[0].maidens).toBe(0)
  })

  it('6 dots + 2 wides mixed in (8 deliveries, 6 legal) = maiden', () => {
    let state = setupMatch()

    // Dot, Wide, Dot, Dot, Wide, Dot, Dot, Dot
    state = scoreBall(state, { runs: 0 })                                    // legal 1
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' }) // illegal
    state = scoreBall(state, { runs: 0 })                                    // legal 2
    state = scoreBall(state, { runs: 0 })                                    // legal 3
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' }) // illegal
    state = scoreBall(state, { runs: 0 })                                    // legal 4
    state = scoreBall(state, { runs: 0 })                                    // legal 5
    state = scoreBall(state, { runs: 0 })                                    // legal 6

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    // Wides do NOT break a maiden
    expect(inn.bowlers[0].maidens).toBe(1)
    // But the bowler is charged 2 runs for the wides
    expect(inn.bowlers[0].runs).toBe(2)
    expect(inn.totalRuns).toBe(2)
  })

  it('5 dots + 1 bye(1) = maiden (byes do not break maidens)', () => {
    let state = setupMatch()

    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    state = scoreBall(state, { extraType: 'bye', runs: 1, runType: 'extra' })

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    // Byes do NOT break a maiden
    expect(inn.bowlers[0].maidens).toBe(1)
    // Byes are not charged to the bowler
    expect(inn.bowlers[0].runs).toBe(0)
    // But runs count towards the innings total
    expect(inn.totalRuns).toBe(1)
  })

  it('5 dots + 1 leg bye(2) = maiden (leg byes do not break maidens)', () => {
    let state = setupMatch()

    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    state = scoreBall(state, { extraType: 'legBye', runs: 2, runType: 'extra' })

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.bowlers[0].maidens).toBe(1)
    expect(inn.bowlers[0].runs).toBe(0)
    expect(inn.totalRuns).toBe(2)
  })

  it('6 dots + 1 no-ball mixed in (7 deliveries, 6 legal) = maiden', () => {
    let state = setupMatch()

    state = scoreBall(state, { runs: 0 })                                      // legal 1
    state = scoreBall(state, { runs: 0 })                                      // legal 2
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' }) // illegal
    state = scoreBall(state, { runs: 0 })                                      // legal 3
    state = scoreBall(state, { runs: 0 })                                      // legal 4
    state = scoreBall(state, { runs: 0 })                                      // legal 5
    state = scoreBall(state, { runs: 0 })                                      // legal 6

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    // No-balls do NOT break a maiden
    expect(inn.bowlers[0].maidens).toBe(1)
    // But the bowler is charged 1 run for the no-ball
    expect(inn.bowlers[0].runs).toBe(1)
    expect(inn.totalRuns).toBe(1)
  })

  it('5 dots + 1 four = NOT a maiden (bat runs break it)', () => {
    let state = setupMatch()

    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    state = scoreBall(state, { runs: 4 })

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.bowlers[0].maidens).toBe(0)
  })

  it('all extras over: 4 wides + 6 dots = maiden despite many deliveries', () => {
    let state = setupMatch()

    // 4 wides scattered among 6 dots
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })                                      // legal 1
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })                                      // legal 2
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })                                      // legal 3
    state = scoreBall(state, { runs: 0 })                                      // legal 4
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })                                      // legal 5
    state = scoreBall(state, { runs: 0 })                                      // legal 6

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.bowlers[0].maidens).toBe(1)
    expect(inn.totalRuns).toBe(4)
    expect(inn.bowlers[0].runs).toBe(4)

    // currentOver should have been archived to allOvers
    expect(inn.allOvers.length).toBe(1)
    expect(inn.allOvers[0]).toEqual(['Wd', '0', 'Wd', '0', 'Wd', '0', '0', 'Wd', '0', '0'])
  })
})
