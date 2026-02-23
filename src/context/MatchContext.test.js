import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from './MatchContext.jsx'
import { MAX_OVERS_PER_BOWLER, BALLS_PER_OVER, MAX_WICKETS } from '../lib/constants'
import { getBallClass, calculateOverRuns } from '../lib/ballDisplay'

// ─── Helpers ─────────────────────────────────────────────────

function setupMatch(overrides = {}) {
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
  return { ...state, ...overrides }
}

function scoreBall(state, action = {}) {
  return matchReducer(state, { type: 'SCORE_BALL', runs: 0, runType: 'bat', ...action })
}

function scoreNBalls(state, n, action = {}) {
  for (let i = 0; i < n; i++) {
    state = scoreBall(state, action)
  }
  return state
}

function completeOver(state, runs = 0) {
  return scoreNBalls(state, BALLS_PER_OVER, { runs })
}

// ─── Tests ───────────────────────────────────────────────────

describe('Match Setup', () => {
  it('should initialize to setup phase', () => {
    expect(initialState.phase).toBe('setup')
  })

  it('should set teams and transition to toss', () => {
    const state = matchReducer(initialState, {
      type: 'SET_TEAMS',
      team1: 'India',
      team2: 'Australia',
      oversPerInnings: 12,
      squad1: ['P1','P2','P3','P4','P5','P6','P7','P8'],
      squad2: ['P1','P2','P3','P4','P5','P6','P7','P8'],
    })
    expect(state.phase).toBe('toss')
    expect(state.team1).toBe('India')
    expect(state.team2).toBe('Australia')
  })

  it('should set toss and transition to select-xi', () => {
    let state = matchReducer(initialState, {
      type: 'SET_TEAMS', team1: 'A', team2: 'B', oversPerInnings: 12,
      squad1: ['P1','P2','P3','P4','P5','P6','P7','P8'],
      squad2: ['P1','P2','P3','P4','P5','P6','P7','P8'],
    })
    state = matchReducer(state, { type: 'SET_TOSS', winner: 'A', decision: 'bat' })
    expect(state.phase).toBe('select-xi')
    expect(state.inningsOrder[0]).toBe('A')
    expect(state.inningsOrder[1]).toBe('B')
  })

  it('should set innings order correctly when toss winner bowls', () => {
    let state = matchReducer(initialState, {
      type: 'SET_TEAMS', team1: 'A', team2: 'B', oversPerInnings: 12,
      squad1: ['P1','P2','P3','P4','P5','P6','P7','P8'],
      squad2: ['P1','P2','P3','P4','P5','P6','P7','P8'],
    })
    state = matchReducer(state, { type: 'SET_TOSS', winner: 'A', decision: 'bowl' })
    expect(state.inningsOrder[0]).toBe('B') // B bats first
    expect(state.inningsOrder[1]).toBe('A')
  })

  it('should set openers and transition to scoring', () => {
    const state = setupMatch()
    expect(state.phase).toBe('scoring')
    const inn = state.innings[0]
    expect(inn.batsmen.length).toBe(2)
    expect(inn.batsmen[0].name).toBe('A1')
    expect(inn.batsmen[1].name).toBe('A2')
    expect(inn.bowlers[0].name).toBe('B1')
  })

  it('should start innings timer on SET_OPENERS', () => {
    const state = setupMatch()
    expect(state.inningsTimers[0]).toBeDefined()
    expect(typeof state.inningsTimers[0]).toBe('number')
  })
})

describe('SCORE_BALL — Normal Runs', () => {
  it('should record dot ball', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 0 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(0)
    expect(inn.batsmen[0].runs).toBe(0)
    expect(inn.batsmen[0].balls).toBe(1)
    expect(inn.bowlers[0].runs).toBe(0)
    expect(inn.ballsInCurrentOver).toBe(1)
  })

  it('should record 1 run and rotate strike', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 1 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(1)
    expect(inn.batsmen[0].runs).toBe(1)
    // Strike should have rotated (odd runs)
    expect(inn.activeBatsmanIndex).toBe(1)
    expect(inn.nonStrikerIndex).toBe(0)
  })

  it('should record 2 runs without rotating strike', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 2 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(2)
    expect(inn.activeBatsmanIndex).toBe(0) // No rotation for even runs
  })

  it('should record 4 and track boundary', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 4 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(4)
    expect(inn.batsmen[0].fours).toBe(1)
    expect(inn.fours).toBe(1)
  })

  it('should record 6 and track six', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 6 })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(6)
    expect(inn.batsmen[0].sixes).toBe(1)
    expect(inn.sixes).toBe(1)
  })
})

describe('SCORE_BALL — Extras', () => {
  it('should record a wide (1 run, not legal delivery)', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.wides).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0) // Not a legal delivery
    expect(inn.bowlers[0].runs).toBe(1)
  })

  it('should record a wide with extra runs', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 2, runType: 'extra' })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(3) // 1 + 2
    expect(inn.extras.wides).toBe(1)
  })

  it('should record a no-ball', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    expect(next.lastBallWasNoBall).toBe(true)
  })

  it('should track free hit after no-ball', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(next.lastBallWasNoBall).toBe(true)
    // Normal ball after clears it
    const next2 = scoreBall(next, { runs: 0 })
    expect(next2.lastBallWasNoBall).toBe(false)
  })

  it('should record a bye (legal delivery, runs not charged to bowler)', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'bye', runs: 2, runType: 'extra' })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(2)
    expect(inn.extras.byes).toBe(2)
    expect(inn.ballsInCurrentOver).toBe(1) // Legal delivery
    expect(inn.batsmen[0].balls).toBe(1)
    expect(inn.batsmen[0].runs).toBe(0) // Not credited to batter
  })

  it('should record a leg-bye', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'legBye', runs: 1, runType: 'extra' })
    const inn = next.innings[0]
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.legByes).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(1)
  })

  it('should swap strike on odd wide runs', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 1, runType: 'extra' })
    const inn = next.innings[0]
    // Wide + 1 = 2 total, but runs scored = 1, which is odd
    expect(inn.activeBatsmanIndex).toBe(1) // swapped
  })
})

describe('SCORE_BALL — Wickets', () => {
  it('should record a bowled dismissal', () => {
    const state = setupMatch()
    const next = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })
    const inn = next.innings[0]
    expect(inn.wickets).toBe(1)
    expect(inn.batsmen[0].isOut).toBe(true)
    expect(inn.batsmen[0].dismissal).toBe('bowled')
    expect(inn.bowlers[0].wickets).toBe(1)
    expect(inn.batsmen.length).toBe(3) // New batter added
    expect(inn.batsmen[2].name).toBe('A3')
  })

  it('should credit run out wicket to fielding but not bowler', () => {
    const state = setupMatch()
    const next = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', newBatsman: 'A3', runOutBatsman: 'striker',
    })
    const inn = next.innings[0]
    expect(inn.wickets).toBe(1)
    expect(inn.bowlers[0].wickets).toBe(0) // Run out not credited to bowler
  })

  it('should dismiss non-striker on run out', () => {
    const state = setupMatch()
    const next = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', newBatsman: 'A3', runOutBatsman: 'nonStriker',
    })
    const inn = next.innings[0]
    expect(inn.batsmen[1].isOut).toBe(true) // Non-striker was A2
    expect(inn.batsmen[1].dismissal).toBe('runOut')
  })

  it('should record fall of wicket with correct details', () => {
    const state = setupMatch()
    // Score 5 runs first
    let s = scoreBall(state, { runs: 4 })
    s = scoreBall(s, { runs: 1 })
    // Now take a wicket
    s = scoreBall(s, { wicket: true, dismissalType: 'caught', newBatsman: 'A3' })
    const fow = s.innings[0].fallOfWickets[0]
    expect(fow.wickets).toBe(1)
    expect(fow.runs).toBe(5) // Total runs at fall
  })

  it('should not add new batsman on 10th wicket', () => {
    let state = setupMatch()
    // Take 9 wickets
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, {
        wicket: true, dismissalType: 'bowled', newBatsman: `A${i}`,
      })
    }
    // 10th wicket — no new batsman
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.innings[0].wickets).toBe(MAX_WICKETS)
  })
})

describe('Over Completion', () => {
  it('should complete an over after 6 legal deliveries', () => {
    const state = setupMatch()
    const next = completeOver(state)
    const inn = next.innings[0]
    expect(inn.oversCompleted).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    expect(inn.allOvers.length).toBe(1)
    expect(inn.currentOver.length).toBe(0)
  })

  it('should require new bowler after over', () => {
    const state = setupMatch()
    const next = completeOver(state)
    expect(next.phase).toBe('new-bowler')
  })

  it('should rotate strike at end of over', () => {
    const state = setupMatch()
    const next = completeOver(state)
    const inn = next.innings[0]
    // After 6 dot balls: no run swaps, but end-of-over swap happens
    expect(inn.activeBatsmanIndex).toBe(1) // swapped
    expect(inn.nonStrikerIndex).toBe(0)
  })

  it('should detect maiden over (all dots)', () => {
    const state = setupMatch()
    const next = completeOver(state, 0)
    expect(next.innings[0].bowlers[0].maidens).toBe(1)
  })

  it('should NOT count byes as breaking maiden', () => {
    let state = setupMatch()
    // 5 dot balls
    state = scoreNBalls(state, 5, { runs: 0 })
    // 1 bye
    state = scoreBall(state, { extraType: 'bye', runs: 1, runType: 'extra' })
    expect(state.innings[0].bowlers[0].maidens).toBe(1)
  })

  it('should NOT count leg-byes as breaking maiden', () => {
    let state = setupMatch()
    state = scoreNBalls(state, 5, { runs: 0 })
    state = scoreBall(state, { extraType: 'legBye', runs: 2, runType: 'extra' })
    expect(state.innings[0].bowlers[0].maidens).toBe(1)
  })

  it('should NOT count wides as breaking maiden', () => {
    let state = setupMatch()
    state = scoreNBalls(state, 5, { runs: 0 })
    // Wide doesn't count as legal delivery, so we need one more ball
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 0 }) // 6th legal delivery
    expect(state.innings[0].bowlers[0].maidens).toBe(1)
  })

  it('should not count wides as legal deliveries', () => {
    let state = setupMatch()
    // 5 dots + 1 wide = still need 1 more legal ball
    state = scoreNBalls(state, 5)
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    expect(state.innings[0].ballsInCurrentOver).toBe(5) // Wide doesn't count
    expect(state.phase).toBe('scoring') // Not end of over yet
  })
})

describe('SET_BOWLER', () => {
  it('should set a new bowler', () => {
    let state = setupMatch()
    state = completeOver(state)
    expect(state.phase).toBe('new-bowler')
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })
    expect(state.phase).toBe('scoring')
    expect(state.innings[0].bowlers.length).toBe(2)
    expect(state.innings[0].bowlers[1].name).toBe('B2')
  })

  it('should reject bowler who reached over cap', () => {
    let state = setupMatch()
    // Bowl 3 overs with B1
    for (let o = 0; o < 3; o++) {
      state = completeOver(state)
      if (o < 2) {
        state = matchReducer(state, { type: 'SET_BOWLER', bowler: o === 0 ? 'B2' : 'B1' })
      }
    }
    // B1 has bowled 2 overs, B2 has bowled 1 over
    // Now try to set B1 who has bowled 2 overs — should still work
    // Actually let me trace: B1 bowls over 1, B2 bowls over 2, B1 bowls over 3
    // B1 now has 2 overs in bowlerOversMap
    // Let's complete 3 more overs to reach the cap
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' }) // Over 4
    state = completeOver(state)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' }) // Over 5
    state = completeOver(state)
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' }) // Over 6
    state = completeOver(state)
    // B1: 3 overs (cap reached), B2: 3 overs (cap reached)
    expect(state.innings[0].bowlerOversMap['B1']).toBe(MAX_OVERS_PER_BOWLER)
    // Trying to set B1 again should be rejected
    const rejected = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })
    expect(rejected.innings[0].currentBowlerIndex).toBe(state.innings[0].currentBowlerIndex)
  })

  it('should reuse existing bowler object', () => {
    let state = setupMatch()
    state = completeOver(state) // Over 1: B1
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })
    state = completeOver(state) // Over 2: B2
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })
    // B1 should still have stats from over 1
    const b1 = state.innings[0].bowlers.find(b => b.name === 'B1')
    expect(b1.overs).toBe(1)
    expect(state.innings[0].bowlers.length).toBe(2)
  })
})

describe('Innings End', () => {
  it('should end innings when all out', () => {
    let state = setupMatch()
    // Take 10 wickets
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' }) // 10th
    expect(state.innings[0].wickets).toBe(MAX_WICKETS)
    expect(state.phase).toBe('innings-break')
  })

  it('should end innings when overs exhausted', () => {
    let state = setupMatch()
    // Bowl 12 complete overs
    for (let o = 0; o < 12; o++) {
      state = completeOver(state)
      if (o < 11 && state.phase === 'new-bowler') {
        // Alternate bowlers
        const bowlerName = o % 2 === 0 ? 'B2' : 'B3'
        state = matchReducer(state, { type: 'SET_BOWLER', bowler: bowlerName })
      }
    }
    expect(state.innings[0].oversCompleted).toBe(12)
    expect(state.phase).toBe('innings-break')
  })

  it('should update cumulative scores after innings', () => {
    let state = setupMatch()
    // Score some runs then end innings
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 6 })
    // Take 10 wickets
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.cumulativeScores.team1).toBe(10)
  })
})

describe('UNDO_LAST_BALL', () => {
  it('should undo the last ball', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 4 })
    expect(state.innings[0].totalRuns).toBe(4)
    expect(state.inningsSnapshots.length).toBe(1)

    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].totalRuns).toBe(0)
    expect(state.inningsSnapshots.length).toBe(0)
  })

  it('should undo multiple balls', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 1 })
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 6 })
    expect(state.innings[0].totalRuns).toBe(11)

    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].totalRuns).toBe(5)

    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].totalRuns).toBe(1)
  })

  it('should undo a wicket', () => {
    let state = setupMatch()
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })
    expect(state.innings[0].wickets).toBe(1)

    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.innings[0].wickets).toBe(0)
    expect(state.innings[0].batsmen.length).toBe(2) // A3 removed
  })

  it('should restore lastBallWasNoBall on undo', () => {
    let state = setupMatch()
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)
    state = scoreBall(state, { runs: 0 })
    expect(state.lastBallWasNoBall).toBe(false)

    state = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(state.lastBallWasNoBall).toBe(true)
  })

  it('should do nothing when no history', () => {
    const state = setupMatch()
    const next = matchReducer(state, { type: 'UNDO_LAST_BALL' })
    expect(next).toBe(state)
  })
})

describe('Ball History', () => {
  it('should save snapshot before each SCORE_BALL', () => {
    let state = setupMatch()
    expect(state.inningsSnapshots.length).toBe(0)
    state = scoreBall(state, { runs: 1 })
    expect(state.inningsSnapshots.length).toBe(1)
    state = scoreBall(state, { runs: 2 })
    expect(state.inningsSnapshots.length).toBe(2)
  })
})

describe('Follow-On', () => {
  it('should trigger follow-on decision when inn2 < threshold of inn1', () => {
    let state = setupMatch()
    // Complete innings 0 with 100 runs
    state = scoreBall(state, { runs: 4 })
    // Just all-out quickly for simplicity: put 100 in the innings manually
    // Actually let's just test the reducer logic at the boundary
    // Fast-forward: complete innings 0 by all out
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    // Inn 0: 4 runs, all out
    expect(state.phase).toBe('innings-break')

    // Start innings 1
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    // Score 1 run (less than 50% of 4 = 2), then all out
    state = scoreBall(state, { runs: 1 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    // 1 < 4 * 0.5 = 2, so follow-on should be offered
    expect(state.phase).toBe('follow-on-decision')
  })

  it('should NOT trigger follow-on when inn2 >= threshold', () => {
    let state = setupMatch()
    // All out with 4 runs
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    // Innings 0: 0 runs

    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    // All out with 0 runs (0 is NOT < 0 * 0.5 = 0)
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    // 0 < 0 * 0.5 is false, so should go to squad-rotation
    expect(state.phase).toBe('squad-rotation')
  })

  it('should swap innings order when follow-on is enforced', () => {
    let state = setupMatch()
    // Manufacture a follow-on scenario using just the DECIDE_FOLLOW_ON action
    // We need to be in follow-on-decision phase
    state = { ...state, phase: 'follow-on-decision' }
    const orderBefore = [...state.inningsOrder]
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })

    expect(state.followOnEnforced).toBe(true)
    expect(state.inningsOrder[2]).toBe(orderBefore[3])
    expect(state.inningsOrder[3]).toBe(orderBefore[2])
    expect(state.phase).toBe('squad-rotation')
  })

  it('should award innings victory when follow-on team still trails after 3rd innings', () => {
    // Simulate: Team A scores big, Team B scores low (follow-on),
    // Team B bats again but combined total < Team A
    let state = setupMatch()
    // Inn 0: Team A scores 4 runs then all out
    state = scoreBall(state, { runs: 4 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('innings-break')
    expect(state.cumulativeScores.team1).toBe(4) // Team A = 4

    // Inn 1: Team B scores 1 run then all out (1 < 4 * 0.5 = 2 → follow-on)
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 1 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('follow-on-decision')
    expect(state.cumulativeScores.team2).toBe(1) // Team B = 1

    // Enforce follow-on
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    expect(state.followOnEnforced).toBe(true)

    // Skip squad rotation
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team B bats again (follow-on), scores 2 runs then all out
    // Team B combined: 1 + 2 = 3, Team A: 4 → innings victory
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 2 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    expect(state.phase).toBe('match-over')
    expect(state.result).toBe('Team A won by an innings and 1 run')
  })

  it('should proceed to 4th innings when follow-on team surpasses enforcing team', () => {
    let state = setupMatch()
    // Inn 0: Team A scores 4 runs then all out
    state = scoreBall(state, { runs: 4 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    // Inn 1: Team B scores 1 run then all out → follow-on
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 1 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('follow-on-decision')

    // Enforce follow-on
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team B scores 4 runs (combined 1+4=5 > Team A's 4) → no innings victory
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 4 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    // Should go to innings-break for 4th innings, NOT match-over
    expect(state.phase).toBe('innings-break')
    expect(state.result).toBeFalsy()
  })

  it('should proceed to 4th innings when follow-on team exactly ties', () => {
    let state = setupMatch()
    // Inn 0: Team A scores 4 runs then all out
    state = scoreBall(state, { runs: 4 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    // Inn 1: Team B scores 1 run then all out → follow-on
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 1 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('follow-on-decision')

    // Enforce follow-on
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: Team B scores 3 runs (combined 1+3=4 = Team A's 4) → exact tie
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 3 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    // Exact tie → 4th innings still happens (enforcing team needs 1 run)
    expect(state.phase).toBe('innings-break')
    expect(state.result).toBeFalsy()
  })

  it('should not check innings victory when follow-on is NOT enforced', () => {
    let state = setupMatch()
    // Complete 3 innings without follow-on
    // Inn 0: all out with 0 runs
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('innings-break')

    // Inn 1: all out with 0 runs (0 is NOT < 0 * 0.5, so no follow-on)
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('squad-rotation')

    // Skip squad rotation
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Inn 2: all out with 0 runs — normal match, always goes to innings-break
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    // Without follow-on, should always go to innings-break
    expect(state.phase).toBe('innings-break')
  })
})

describe('Squad Rotation', () => {
  it('should apply squad rotation', () => {
    let state = setupMatch()
    state = { ...state, phase: 'squad-rotation' }
    state = matchReducer(state, {
      type: 'APPLY_SQUAD_ROTATION',
      teamKey: 'team1',
      swapOut: ['A1', 'A2'],
      swapIn: ['A12', 'A13'],
    })
    const team1Roster = state.activeRosters.team1
    expect(team1Roster.find(p => p.name === 'A1').substituted).toBe(true)
    expect(team1Roster.find(p => p.name === 'A2').substituted).toBe(true)
    expect(team1Roster.find(p => p.name === 'A12')).toBeDefined()
  })

  it('should finish squad rotation and move to batting-order', () => {
    let state = setupMatch()
    state = { ...state, phase: 'squad-rotation' }
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })
    expect(state.phase).toBe('batting-order')
    expect(state.currentInnings).toBe(2)
  })
})

describe('Super Over', () => {
  it('should start super over when match tied', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    expect(state.superOver).not.toBeNull()
    expect(state.superOver.phase).toBe('select-players')
  })

  it('should score super over balls', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'],
      team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'],
      team2Bowler: 'B4',
    })
    expect(state.superOver.phase).toBe('batting-1')
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 4 })
    expect(state.superOver.innings1.runs).toBe(4)
    expect(state.superOver.innings1.fours).toBe(1)
  })

  it('should end super over innings after 6 balls', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.target).toBe(7) // 6 + 1
  })

  it('should end super over innings after 3 wickets', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    // 3 wickets should end the innings
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 0, wicket: true })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 0, wicket: true })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 0, wicket: true })
    expect(state.superOver.innings1.wickets).toBe(3)
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.target).toBe(1) // 0 + 1
  })

  it('should handle extras in super over (wide)', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    // Wide with 2 extra runs
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 2, extraType: 'wide' })
    expect(state.superOver.innings1.runs).toBe(3) // 1 + 2
    expect(state.superOver.innings1.extras.wides).toBe(1)
    expect(state.superOver.innings1.balls).toBe(0) // Wide is not a legal delivery
    expect(state.superOver.innings1.ballLog).toEqual(['Wd+2'])
  })

  it('should handle no-ball in super over', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 4, extraType: 'noBall', runType: 'bat' })
    expect(state.superOver.innings1.runs).toBe(5) // 1 + 4
    expect(state.superOver.innings1.extras.noBalls).toBe(1)
    expect(state.superOver.innings1.fours).toBe(1) // batted boundary on no-ball
    expect(state.superOver.innings1.balls).toBe(0) // no-ball not legal
  })

  it('should handle byes and leg-byes in super over', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 2, extraType: 'bye' })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1, extraType: 'legBye' })
    expect(state.superOver.innings1.runs).toBe(3)
    expect(state.superOver.innings1.extras.byes).toBe(2)
    expect(state.superOver.innings1.extras.legByes).toBe(1)
    expect(state.superOver.innings1.balls).toBe(2) // both are legal deliveries
    expect(state.superOver.innings1.ballLog).toEqual(['B2', 'LB1'])
  })

  it('should chase target early in second innings', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    // First innings: 6 runs (1 per ball)
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.target).toBe(7)

    // Second innings: hit a six + two = 8 in 2 balls, chasing 7
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 6 })
    expect(state.superOver.phase).toBe('batting-2') // not done yet (6 < 7)
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 2 })
    expect(state.superOver.innings2.runs).toBe(8)
    expect(state.superOver.phase).toBe('result') // target chased
  })

  it('should determine winner — first innings team wins', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    // First innings: 12 runs
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 2 })
    }
    // Second innings: 6 runs (can't reach 13)
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('won in Super Over')
    expect(state.result).toContain('12 vs 6')
  })

  it('should determine winner — second innings team wins', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    // First innings: 6 runs
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    // Second innings: chase 7, score 8
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 4 })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 4 })
    // Target chased — move to result
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('won in Super Over')
  })

  it('should use boundary count tiebreaker when super over tied', () => {
    let state = setupMatch()
    // Set some boundaries in the regular innings
    state = {
      ...state,
      phase: 'super-over',
      cumulativeBoundaries: {
        team1: { fours: 10, sixes: 2 },
        team2: { fours: 8, sixes: 1 },
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    // Both score exactly 6 runs, no boundaries in super over
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    // Result: tied super over, boundary count decides
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('boundary count')
    expect(state.result).toContain('Team A') // Team A had 12 boundaries vs Team B's 9
  })

  it('should flag another Super Over when boundary count also tied', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeBoundaries: {
        team1: { fours: 5, sixes: 2 },
        team2: { fours: 5, sixes: 2 },
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    // Both score 6 with no boundaries
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    // Should NOT be match-over — should stay in super-over with tied-again phase
    expect(state.phase).toBe('super-over')
    expect(state.superOver.phase).toBe('tied-again')
    expect(state.result).toContain('another Super Over')
  })

  it('should restart super over after tied-again', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeBoundaries: {
        team1: { fours: 5, sixes: 2 },
        team2: { fours: 5, sixes: 2 },
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    for (let i = 0; i < 12; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    expect(state.superOver.phase).toBe('tied-again')

    // Restart
    state = matchReducer(state, { type: 'RESTART_SUPER_OVER' })
    expect(state.superOver.phase).toBe('select-players')
    expect(state.superOver.innings1.runs).toBe(0)
    expect(state.superOver.innings2.runs).toBe(0)
    expect(state.result).toBe('')
  })

  it('should end as tie if organizer declines another Super Over', () => {
    let state = setupMatch()
    state = {
      ...state,
      phase: 'super-over',
      cumulativeBoundaries: {
        team1: { fours: 5, sixes: 2 },
        team2: { fours: 5, sixes: 2 },
      },
    }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    for (let i = 0; i < 12; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    state = matchReducer(state, { type: 'END_AS_TIE' })
    expect(state.phase).toBe('match-over')
  })

  it('should undo super over balls', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: ['A1','A2','A3'], team1Bowler: 'A4',
      team2Batsmen: ['B1','B2','B3'], team2Bowler: 'B4',
    })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 4 })
    state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 6 })
    expect(state.superOver.innings1.runs).toBe(10)
    expect(state.superOverSnapshots.length).toBe(2)

    state = matchReducer(state, { type: 'UNDO_LAST_SUPER_OVER_BALL' })
    expect(state.superOver.innings1.runs).toBe(4)
    expect(state.superOverSnapshots.length).toBe(1)

    state = matchReducer(state, { type: 'UNDO_LAST_SUPER_OVER_BALL' })
    expect(state.superOver.innings1.runs).toBe(0)
    expect(state.superOverSnapshots.length).toBe(0)
  })

  it('should initialize super over innings with extras tracking', () => {
    let state = setupMatch()
    state = { ...state, phase: 'super-over' }
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    expect(state.superOver.innings1.extras).toEqual({ wides: 0, noBalls: 0, byes: 0, legByes: 0 })
    expect(state.superOver.innings2.extras).toEqual({ wides: 0, noBalls: 0, byes: 0, legByes: 0 })
  })
})

describe('NEW_MATCH', () => {
  it('should reset all state', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 4 })
    state = matchReducer(state, { type: 'NEW_MATCH' })
    expect(state.phase).toBe('setup')
    expect(state.team1).toBe('')
    expect(state.innings).toEqual([null, null, null, null])
    expect(state.inningsSnapshots).toEqual([])
  })
})

describe('ballDisplay utilities', () => {
  it('should classify ball types', () => {
    expect(getBallClass('W')).toBe('wicket')
    expect(getBallClass('4')).toBe('four')
    expect(getBallClass('6')).toBe('six')
    expect(getBallClass('0')).toBe('dot')
    expect(getBallClass('Wd')).toBe('extra')
    expect(getBallClass('NB')).toBe('extra')
    expect(getBallClass('1')).toBe('')
  })

  it('should calculate over runs correctly', () => {
    expect(calculateOverRuns(['0', '1', '4', 'W', '0', '2'])).toBe(7)
    expect(calculateOverRuns(['Wd', '0', '0', '0', '0', '0', '0'])).toBe(1)
    expect(calculateOverRuns(['NB+2', '0', '0', '0', '0', '0', '0'])).toBe(3)
    expect(calculateOverRuns(['B1', 'LB2', '0', '0', '0', '0'])).toBe(3)
    expect(calculateOverRuns(['Wd+3', '0', '0', '0', '0', '0', '0'])).toBe(4)
  })

  it('should handle malformed ball strings safely', () => {
    expect(calculateOverRuns(['Wd+', '0'])).toBe(1) // Wd+ with nothing after +
    expect(calculateOverRuns(['NB+abc', '0'])).toBe(1) // NaN after +
    expect(calculateOverRuns(['xyz', '0'])).toBe(0) // Totally unknown
  })
})
