import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER, MAX_WICKETS, FOLLOW_ON_THRESHOLD } from '../constants'

// ─── Helpers ─────────────────────────────────────────────────

function setupMatch() {
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
  return state
}

function scoreBall(state, action = {}) {
  return matchReducer(state, { type: 'SCORE_BALL', runs: 0, runType: 'bat', ...action })
}

function allOut(state) {
  const inn = state.innings[state.currentInnings]
  const team = inn.battingTeam
  const prefix = team === 'Team A' ? 'A' : 'B'
  for (let i = 3; i <= 11; i++) {
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `${prefix}${i}` })
  }
  // 10th wicket — no new batsman
  state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
  return state
}

function startNextInnings(state, batsman1, batsman2, bowler) {
  state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1, batsman2, bowler })
  return state
}

function completeOver(state, runsPerBall = 0) {
  for (let i = 0; i < BALLS_PER_OVER; i++) {
    state = scoreBall(state, { runs: runsPerBall })
  }
  return state
}

const teamBBowlers = ['B2', 'B3', 'B4', 'B1']
const teamABowlers = ['A2', 'A3', 'A4', 'A1']

function completeFullInnings(state, runsPerBall, bowlers) {
  for (let overNum = 0; overNum < 12; overNum++) {
    state = completeOver(state, runsPerBall)
    if (overNum < 11 && state.phase === 'new-bowler') {
      state = matchReducer(state, { type: 'SET_BOWLER', bowler: bowlers[overNum % bowlers.length] })
    }
  }
  return state
}

/**
 * Build a state at the start of the 4th innings (Team B batting, innings index 3).
 * Uses all-out to end each innings quickly, distributing runs via single ball + all-out.
 *
 * @param {number} inn0Runs - Runs Team A scores in innings 0
 * @param {number} inn1Runs - Runs Team B scores in innings 1
 * @param {number} inn2Runs - Runs Team A scores in innings 2
 * @returns state at the start of 4th innings (Team B batting)
 */
function setupFourthInnings(inn0Runs, inn1Runs, inn2Runs) {
  let state = setupMatch()

  // Innings 0: Team A bats, scores inn0Runs, then all out
  if (inn0Runs > 0) state = scoreBall(state, { runs: Math.min(inn0Runs, 6) })
  if (inn0Runs > 6) state = scoreBall(state, { runs: Math.min(inn0Runs - 6, 6) })
  if (inn0Runs > 12) state = scoreBall(state, { runs: Math.min(inn0Runs - 12, 6) })
  if (inn0Runs > 18) state = scoreBall(state, { runs: Math.min(inn0Runs - 18, 6) })
  if (inn0Runs > 24) state = scoreBall(state, { runs: Math.min(inn0Runs - 24, 6) })
  if (inn0Runs > 30) state = scoreBall(state, { runs: Math.min(inn0Runs - 30, 6) })
  if (inn0Runs > 36) state = scoreBall(state, { runs: Math.min(inn0Runs - 36, 6) })
  if (inn0Runs > 42) state = scoreBall(state, { runs: Math.min(inn0Runs - 42, 6) })
  if (inn0Runs > 48) state = scoreBall(state, { runs: Math.min(inn0Runs - 48, 6) })
  state = allOut(state)
  expect(state.innings[0].totalRuns).toBe(inn0Runs)
  expect(state.phase).toBe('innings-break')

  // Innings 1: Team B bats
  state = startNextInnings(state, 'B1', 'B2', 'A1')
  if (inn1Runs > 0) state = scoreBall(state, { runs: Math.min(inn1Runs, 6) })
  if (inn1Runs > 6) state = scoreBall(state, { runs: Math.min(inn1Runs - 6, 6) })
  if (inn1Runs > 12) state = scoreBall(state, { runs: Math.min(inn1Runs - 12, 6) })
  if (inn1Runs > 18) state = scoreBall(state, { runs: Math.min(inn1Runs - 18, 6) })
  if (inn1Runs > 24) state = scoreBall(state, { runs: Math.min(inn1Runs - 24, 6) })
  if (inn1Runs > 30) state = scoreBall(state, { runs: Math.min(inn1Runs - 30, 6) })
  if (inn1Runs > 36) state = scoreBall(state, { runs: Math.min(inn1Runs - 36, 6) })
  if (inn1Runs > 42) state = scoreBall(state, { runs: Math.min(inn1Runs - 42, 6) })
  if (inn1Runs > 48) state = scoreBall(state, { runs: Math.min(inn1Runs - 48, 6) })
  state = allOut(state)
  expect(state.innings[1].totalRuns).toBe(inn1Runs)

  // After innings 1: handle follow-on decision and squad rotation
  if (state.phase === 'follow-on-decision') {
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: false })
  }
  expect(state.phase).toBe('squad-rotation')
  state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

  // Innings 2: Team A bats again
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
  if (inn2Runs > 0) state = scoreBall(state, { runs: Math.min(inn2Runs, 6) })
  if (inn2Runs > 6) state = scoreBall(state, { runs: Math.min(inn2Runs - 6, 6) })
  if (inn2Runs > 12) state = scoreBall(state, { runs: Math.min(inn2Runs - 12, 6) })
  if (inn2Runs > 18) state = scoreBall(state, { runs: Math.min(inn2Runs - 18, 6) })
  if (inn2Runs > 24) state = scoreBall(state, { runs: Math.min(inn2Runs - 24, 6) })
  if (inn2Runs > 30) state = scoreBall(state, { runs: Math.min(inn2Runs - 30, 6) })
  if (inn2Runs > 36) state = scoreBall(state, { runs: Math.min(inn2Runs - 36, 6) })
  if (inn2Runs > 42) state = scoreBall(state, { runs: Math.min(inn2Runs - 42, 6) })
  if (inn2Runs > 48) state = scoreBall(state, { runs: Math.min(inn2Runs - 48, 6) })
  state = allOut(state)
  expect(state.innings[2].totalRuns).toBe(inn2Runs)
  expect(state.phase).toBe('innings-break')

  // Innings 3: Team B bats (4th innings — the chase)
  state = startNextInnings(state, 'B1', 'B2', 'A1')
  expect(state.currentInnings).toBe(3)
  expect(state.phase).toBe('scoring')

  return state
}

/**
 * Score specific runs using multiple balls of max 6 each.
 * Does NOT cause all-out, just adds runs.
 */
function scoreRuns(state, totalRuns) {
  while (totalRuns > 0) {
    const r = Math.min(totalRuns, 6)
    state = scoreBall(state, { runs: r })
    totalRuns -= r
  }
  return state
}

/**
 * Bowl dots until we reach the last ball of the last over (ball 5 of over 11,
 * i.e., oversCompleted=11, ballsInCurrentOver=5). Handles new-bowler transitions.
 */
function advanceToLastBall(state) {
  const totalBallsNeeded = 12 * BALLS_PER_OVER - 1 // 71 balls to reach ball index 71 (last ball)
  const inn = state.innings[state.currentInnings]
  const ballsBowled = inn.oversCompleted * BALLS_PER_OVER + inn.ballsInCurrentOver
  const remaining = totalBallsNeeded - ballsBowled

  for (let i = 0; i < remaining; i++) {
    state = scoreBall(state, { runs: 0 })
    if (state.phase === 'new-bowler') {
      const innState = state.innings[state.currentInnings]
      const prevBowler = innState.bowlers[innState.currentBowlerIndex]?.name
      const bowlers = state.innings[state.currentInnings].bowlingTeam === 'Team A'
        ? ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11']
        : ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11']
      // Pick a bowler that's not the previous one and hasn't bowled 3 overs
      const available = bowlers.filter(b =>
        b !== prevBowler && (innState.bowlerOversMap[b] || 0) < 3
      )
      state = matchReducer(state, { type: 'SET_BOWLER', bowler: available[0] })
    }
  }

  // Verify we're at the last ball position
  const finalInn = state.innings[state.currentInnings]
  expect(finalInn.oversCompleted).toBe(11)
  expect(finalInn.ballsInCurrentOver).toBe(5)
  return state
}

// ─── Tests ───────────────────────────────────────────────────

describe('4th Innings Chase Completion Mid-Over', () => {
  // Setup: Team A cumulative = 50, Team B cumulative after inn1 = 48.
  // Inn 0: A scores 50, Inn 1: B scores 48, Inn 2: A scores 0.
  // Team A cumulative = 50+0 = 50, Team B cumulative so far = 48.
  // In inn 3 (4th innings), Team B needs cumulative > 50, i.e., inn3 totalRuns > 2 (need 3+ runs).

  it('should end match immediately when Team B hits a 4 to surpass cumulative target', () => {
    let state = setupFourthInnings(50, 48, 0)

    expect(state.cumulativeScores.team1).toBe(50) // A: 50+0
    expect(state.cumulativeScores.team2).toBe(48) // B: 48

    // Team B hits a 4: cumulative becomes 48+4=52 > 50
    state = scoreBall(state, { runs: 4 })
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team B')
    expect(state.result).toContain('won')
  })

  it('should end match when Team B scores exactly enough to surpass target by 1', () => {
    let state = setupFourthInnings(50, 48, 0)

    // Team B needs cumulative > 50. Currently at 48. Need 3 runs to reach 51.
    state = scoreBall(state, { runs: 3 })
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team B')
    expect(state.result).toContain('won')
    // Cumulative: B = 48 + 3 = 51 > A = 50
  })

  it('should continue match when Team B has not yet surpassed cumulative target', () => {
    let state = setupFourthInnings(50, 48, 0)

    // Team B scores 2: cumulative becomes 48+2=50, which equals but does NOT exceed 50
    state = scoreBall(state, { runs: 2 })
    expect(state.phase).toBe('scoring')
    expect(state.innings[3].totalRuns).toBe(2)
  })
})

describe('Last Ball of Last Over in 4th Innings', () => {
  // Team B trails by 2 heading into the last ball of the 4th innings.
  // Team A cumulative = 10, Team B cumulative after inn1 = 8, inn2 A adds 0.
  // So A=10, B(so far)=8. In inn3, we advance to last ball with 0 runs scored.
  // Team B needs cumulative > 10 to win, = 10 for tie/super-over, < 10 means A wins.

  it('should go to super-over when last ball ties the match (cumulative equal)', () => {
    // A cumulative = 5, B cumulative from inn1 = 3. Inn3 needs: B needs 3 to reach 5+1? No.
    // Let's set up: A=5 (inn0=5, inn2=0), B inn1=3. In inn3, B needs >5 to win, =5 for tie.
    // B needs 2 runs in inn3 to tie (3+2=5 = A's 5).
    // Score 1 run during innings, then advance to last ball, then hit 1 more.
    let state = setupFourthInnings(5, 3, 0)
    expect(state.cumulativeScores.team1).toBe(5)
    expect(state.cumulativeScores.team2).toBe(3)

    // Score 1 run first
    state = scoreBall(state, { runs: 1 })
    expect(state.phase).toBe('scoring') // 3+1=4, not enough

    // Advance to last ball of last over
    state = advanceToLastBall(state)

    // Last ball: hit 1 to tie (cumulative B = 3+1+1=5 = A's 5)
    state = scoreBall(state, { runs: 1 })

    // Innings ends (overs finished), cumulative tied => super-over
    expect(state.cumulativeScores.team1).toBe(5)
    expect(state.cumulativeScores.team2).toBe(5) // 3 + 2
    expect(state.phase).toBe('super-over')
  })

  it('should declare Team B wins when last ball surpasses cumulative target', () => {
    let state = setupFourthInnings(5, 3, 0)

    // Score 1 run, then advance to last ball
    state = scoreBall(state, { runs: 1 })
    state = advanceToLastBall(state)

    // Last ball: hit 2 to win (cumulative B = 3+1+2=6 > A's 5)
    state = scoreBall(state, { runs: 2 })

    // Target chased on last ball — match ends with Team B winning
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team B')
    expect(state.result).toContain('won')
  })

  it('should declare Team A wins when last ball leaves Team B short', () => {
    let state = setupFourthInnings(5, 3, 0)

    // Advance to last ball with 0 runs scored in inn3
    state = advanceToLastBall(state)

    // Last ball: dot ball (cumulative B = 3+0=3 < A's 5)
    state = scoreBall(state, { runs: 0 })

    // Overs exhausted, Team A ahead => Team A wins
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team A')
    expect(state.result).toContain('won')
    expect(state.result).toContain('2 runs') // 5 - 3 = 2
  })
})

describe('Chase Completion via Extras', () => {
  it('should end match when a wide causes cumulative to exceed target in 4th innings', () => {
    // A cumulative = 5, B inn1 = 5. Inn3, B needs cumulative > 5, so needs 1 run.
    let state = setupFourthInnings(5, 5, 0)
    expect(state.cumulativeScores.team1).toBe(5)
    expect(state.cumulativeScores.team2).toBe(5)

    // Wide: adds 1 run to totalRuns => cumulative B = 5+1=6 > A's 5
    state = scoreBall(state, { extraType: 'wide', runs: 0 })
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team B')
    expect(state.result).toContain('won')
  })

  it('should end match when a no-ball causes cumulative to exceed target in 4th innings', () => {
    let state = setupFourthInnings(5, 5, 0)

    // No-ball: adds 1 run to totalRuns => cumulative B = 5+1=6 > A's 5
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team B')
    expect(state.result).toContain('won')
  })
})

describe('All Out in Any Innings', () => {
  it('should end innings 0 when all 10 wickets fall before overs are exhausted', () => {
    let state = setupMatch()

    // Score some runs then all out
    state = scoreBall(state, { runs: 4 })
    state = allOut(state)

    expect(state.innings[0].wickets).toBe(MAX_WICKETS)
    expect(state.innings[0].oversCompleted).toBeLessThan(12)
    expect(state.phase).toBe('innings-break')
  })

  it('should handle 10th wicket falling on the last ball of an over without double-triggering', () => {
    let state = setupMatch()
    const inn = () => state.innings[state.currentInnings]

    // Bowl 5 dots to get to ball 5 of over 0 (5 legal deliveries bowled)
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(inn().ballsInCurrentOver).toBe(5)

    // Now take 9 wickets on the first 5 balls, but we need to be more careful.
    // Reset approach: start fresh and take wickets gradually.
    state = setupMatch()

    // Take 9 wickets (batsmen A3-A11 come in, each gets bowled out)
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    expect(inn().wickets).toBe(9)

    // Now we need to get to ball 5 of the current over (last ball of that over).
    // Wickets so far consumed some balls. Current position:
    const ballsSoFar = inn().oversCompleted * BALLS_PER_OVER + inn().ballsInCurrentOver
    // We need to bowl dots until we're at ball 5 of some over (ballsInCurrentOver === 5)
    while (inn().ballsInCurrentOver !== 5) {
      state = scoreBall(state, { runs: 0 })
      // Handle new-bowler transitions
      if (state.phase === 'new-bowler') {
        const prevBowler = inn().bowlers[inn().currentBowlerIndex]?.name
        const available = ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11']
          .filter(b => b !== prevBowler && (inn().bowlerOversMap[b] || 0) < 3)
        state = matchReducer(state, { type: 'SET_BOWLER', bowler: available[0] })
      }
    }
    expect(inn().ballsInCurrentOver).toBe(5)
    expect(inn().wickets).toBe(9)

    // Take the 10th wicket on ball 6 of this over (last ball of over)
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    // Innings should end exactly once — phase should be innings-break
    expect(inn().wickets).toBe(MAX_WICKETS)
    expect(state.phase).toBe('innings-break')
  })

  it('should declare Team A wins when Team B is all out for 0 in the 4th innings', () => {
    // A cumulative = 6 (inn0=6, inn2=0), B inn1 = 4. B needs >6 in inn3.
    let state = setupFourthInnings(6, 4, 0)

    // All out for 0 in 4th innings
    state = allOut(state)

    expect(state.innings[3].totalRuns).toBe(0)
    expect(state.innings[3].wickets).toBe(MAX_WICKETS)
    expect(state.phase).toBe('match-over')
    expect(state.result).toContain('Team A')
    // A cumulative = 6, B cumulative = 4+0=4. Margin = 6-4=2.
    expect(state.result).toContain('2 runs')
  })
})

describe('Follow-On Edge Cases', () => {
  it('should NOT trigger follow-on when B is exactly 50% of A (A=100, B=50)', () => {
    let state = setupMatch()

    // Inn 0: Team A scores 100 (use full innings to get enough runs)
    // Score 100 runs: bowl many 6s and dots across 12 overs
    // Easier: use completeFullInnings with runsPerBall then adjust, or just score via balls.
    // Actually, let's score 100 by doing: 16 sixes = 96 + 4 = 100, but that's too many balls.
    // Use a mix: hit a few sixes and fours. Simpler: just score via completeFullInnings.
    // runsPerBall=1 for 12 overs = 72 runs. Not enough.
    // runsPerBall=2 for 12 overs = 144. Too much.
    // Instead, let's all-out with specific runs to keep it simple.
    // Score 100 in <= 10 balls (before all-out): 6*16=96, but only 10 balls before wicket 10.
    // Actually, with 11 batsmen we get up to ~10 legal deliveries before all out (one per wicket pair).
    // Let's take a different approach: score runs, THEN all out.

    // Score 6 runs * some balls, then fill rest with wickets.
    // We have batsmen A1, A2 already. Can bowl runs to them.
    // Let's score runs first then take wickets.
    // Score ~100 runs from balls before all out:
    // Score 16 sixes (96) + 1 four (4) = 100. That's 17 balls to A1/A2.
    for (let i = 0; i < 16; i++) state = scoreBall(state, { runs: 6 })
    state = scoreBall(state, { runs: 4 })
    expect(state.innings[0].totalRuns).toBe(100)
    state = allOut(state)
    expect(state.phase).toBe('innings-break')

    // Inn 1: Team B scores 50 (exactly 50% of 100)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    for (let i = 0; i < 8; i++) state = scoreBall(state, { runs: 6 })
    state = scoreBall(state, { runs: 2 })
    expect(state.innings[1].totalRuns).toBe(50) // 8*6 + 2 = 50
    state = allOut(state)

    // 50 is NOT < 100 * 0.5 = 50 (not strictly less), so no follow-on
    expect(state.phase).toBe('squad-rotation')
  })

  it('should trigger follow-on when B is strictly below 50% of A (A=100, B=49)', () => {
    let state = setupMatch()

    // Inn 0: Team A scores 100
    for (let i = 0; i < 16; i++) state = scoreBall(state, { runs: 6 })
    state = scoreBall(state, { runs: 4 })
    expect(state.innings[0].totalRuns).toBe(100)
    state = allOut(state)

    // Inn 1: Team B scores 49
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    for (let i = 0; i < 8; i++) state = scoreBall(state, { runs: 6 })
    state = scoreBall(state, { runs: 1 })
    expect(state.innings[1].totalRuns).toBe(49) // 8*6 + 1 = 49
    state = allOut(state)

    // 49 < 100 * 0.5 = 50 → eligible for follow-on
    expect(state.phase).toBe('follow-on-decision')
  })

  it('should trigger follow-on when A=1, B=0 (0 < 0.5)', () => {
    let state = setupMatch()

    // Inn 0: Team A scores 1
    state = scoreBall(state, { runs: 1 })
    state = allOut(state)
    expect(state.innings[0].totalRuns).toBe(1)

    // Inn 1: Team B scores 0
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = allOut(state)
    expect(state.innings[1].totalRuns).toBe(0)

    // 0 < 1 * 0.5 = 0.5 → eligible for follow-on
    expect(state.phase).toBe('follow-on-decision')
  })

  it('should NOT trigger follow-on when both teams score 0 (A=0, B=0)', () => {
    let state = setupMatch()

    // Inn 0: Team A scores 0 (all out)
    state = allOut(state)
    expect(state.innings[0].totalRuns).toBe(0)

    // Inn 1: Team B scores 0 (all out)
    state = startNextInnings(state, 'B1', 'B2', 'A1')
    state = allOut(state)
    expect(state.innings[1].totalRuns).toBe(0)

    // 0 < 0 * 0.5 = 0 → 0 is NOT < 0 → NOT eligible
    expect(state.phase).toBe('squad-rotation')
  })
})
