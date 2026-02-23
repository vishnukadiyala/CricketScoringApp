import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER, MAX_WICKETS } from '../constants'

// ─── Helpers ─────────────────────────────────────────────────

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

function getStriker(state) {
  const inn = state.innings[state.currentInnings]
  return inn.batsmen[inn.activeBatsmanIndex].name
}

function getNonStriker(state) {
  const inn = state.innings[state.currentInnings]
  return inn.batsmen[inn.nonStrikerIndex].name
}

// ─── Tests ───────────────────────────────────────────────────

describe('Strike Rotation — Normal Runs', () => {
  it('after 0 runs (dot ball): striker stays A1, non-striker stays A2', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 0 })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('after 1 run (single): striker becomes A2, non-striker becomes A1', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 1 })
    expect(getStriker(next)).toBe('A2')
    expect(getNonStriker(next)).toBe('A1')
  })

  it('after 2 runs (double): striker stays A1', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 2 })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('after 3 runs (triple): striker becomes A2, non-striker becomes A1', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 3 })
    expect(getStriker(next)).toBe('A2')
    expect(getNonStriker(next)).toBe('A1')
  })

  it('after 4 runs (boundary): striker stays A1', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 4 })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('after 6 runs (six): striker stays A1', () => {
    const state = setupMatch()
    const next = scoreBall(state, { runs: 6 })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })
})

describe('Strike Rotation — Extras', () => {
  it('wide + 0 additional runs: no strike change', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('wide + 1 additional run: strike changes', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 1, runType: 'extra' })
    expect(getStriker(next)).toBe('A2')
    expect(getNonStriker(next)).toBe('A1')
  })

  it('wide + 2 additional runs: no strike change', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'wide', runs: 2, runType: 'extra' })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('no-ball + 0 runs (bat): striker stays same', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('no-ball + 1 run (bat): strike changes', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'noBall', runs: 1, runType: 'bat' })
    expect(getStriker(next)).toBe('A2')
    expect(getNonStriker(next)).toBe('A1')
  })

  it('no-ball + 2 runs (bat): striker stays same', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'noBall', runs: 2, runType: 'bat' })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('bye (1 run): strike changes', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'bye', runs: 1, runType: 'extra' })
    expect(getStriker(next)).toBe('A2')
    expect(getNonStriker(next)).toBe('A1')
  })

  it('bye (2 runs): striker stays same', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'bye', runs: 2, runType: 'extra' })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('leg bye (1 run): strike changes', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'legBye', runs: 1, runType: 'extra' })
    expect(getStriker(next)).toBe('A2')
    expect(getNonStriker(next)).toBe('A1')
  })

  it('leg bye (2 runs): striker stays same', () => {
    const state = setupMatch()
    const next = scoreBall(state, { extraType: 'legBye', runs: 2, runType: 'extra' })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A2')
  })
})

describe('Strike Rotation — End of Over', () => {
  it('end of over (6 dot balls): striker and non-striker swap', () => {
    let state = setupMatch()
    // Bowl 6 dot balls to complete the over
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // No mid-over swaps (all dots), but end-of-over swap happens
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('single off last ball of over: single swaps, then end-of-over swaps back to original', () => {
    let state = setupMatch()
    // Bowl 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Verify striker is still A1 before the last ball
    expect(getStriker(state)).toBe('A1')
    expect(getNonStriker(state)).toBe('A2')

    // Ball 6: single
    // Single swaps: A2 striker, A1 non-striker
    // End of over swaps: A1 striker, A2 non-striker (back to original)
    state = scoreBall(state, { runs: 1 })
    expect(getStriker(state)).toBe('A1')
    expect(getNonStriker(state)).toBe('A2')
  })

  it('4 off last ball of over: boundary does not swap, but end-of-over does', () => {
    let state = setupMatch()
    // Bowl 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Ball 6: boundary (4 runs, even, no mid-ball swap)
    // End of over swaps: A2 becomes striker, A1 becomes non-striker
    state = scoreBall(state, { runs: 4 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('3 off last ball of over: triple swaps, then end-of-over swaps back to original', () => {
    let state = setupMatch()
    // Bowl 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Ball 6: 3 runs (odd, swaps mid-ball → A2 striker, A1 non-striker)
    // End of over swaps: A1 striker, A2 non-striker (back to original)
    state = scoreBall(state, { runs: 3 })
    expect(getStriker(state)).toBe('A1')
    expect(getNonStriker(state)).toBe('A2')
  })

  it('6 off last ball of over: six does not swap mid-ball, end-of-over swaps', () => {
    let state = setupMatch()
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Ball 6: six (even, no mid-ball swap)
    // End of over swaps: A2 striker, A1 non-striker
    state = scoreBall(state, { runs: 6 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('wide on ball 5 does not complete over, only 6th legal ball does', () => {
    let state = setupMatch()
    // Bowl 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Wide — not a legal delivery, over not complete yet
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    expect(getStriker(state)).toBe('A1') // No end-of-over swap yet
    expect(getNonStriker(state)).toBe('A2')

    // 6th legal ball (dot) completes the over — end-of-over swap happens
    state = scoreBall(state, { runs: 0 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('maintains correct strike across two consecutive overs', () => {
    let state = setupMatch()
    // Over 1: 6 dot balls → end-of-over swap → A2 striker, A1 non-striker
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')

    // New bowler for over 2
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })

    // Over 2: 6 dot balls → end-of-over swap → A1 striker, A2 non-striker (back to original)
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(getStriker(state)).toBe('A1')
    expect(getNonStriker(state)).toBe('A2')
  })
})

describe('Strike Rotation — Wickets', () => {
  it('wicket (bowled, striker out): new batsman replaces striker at striker end', () => {
    const state = setupMatch()
    // A1 is on strike, gets bowled. A3 comes in at the striker end.
    const next = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })
    expect(getStriker(next)).toBe('A3')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('run out of non-striker: non-striker replaced, striker stays', () => {
    const state = setupMatch()
    // A1 on strike, A2 run out at non-striker end
    const next = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runOutBatsman: 'nonStriker', newBatsman: 'A3',
    })
    expect(getStriker(next)).toBe('A1')
    expect(getNonStriker(next)).toBe('A3')
  })

  it('run out of striker (0 runs): striker replaced, non-striker stays', () => {
    const state = setupMatch()
    // A1 on strike, run out at striker end, 0 runs scored
    const next = scoreBall(state, {
      runs: 0, wicket: true, dismissalType: 'runOut', runOutBatsman: 'striker', newBatsman: 'A3',
    })
    expect(getStriker(next)).toBe('A3')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('caught dismissal: striker out, replaced at striker end', () => {
    const state = setupMatch()
    const next = scoreBall(state, { wicket: true, dismissalType: 'caught', newBatsman: 'A3' })
    expect(getStriker(next)).toBe('A3')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('LBW dismissal: striker out, replaced at striker end', () => {
    const state = setupMatch()
    const next = scoreBall(state, { wicket: true, dismissalType: 'lbw', newBatsman: 'A3' })
    expect(getStriker(next)).toBe('A3')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('stumped dismissal: striker out, replaced at striker end', () => {
    const state = setupMatch()
    const next = scoreBall(state, { wicket: true, dismissalType: 'stumped', newBatsman: 'A3' })
    expect(getStriker(next)).toBe('A3')
    expect(getNonStriker(next)).toBe('A2')
  })

  it('wicket with 1 run: strike swaps first, then striker (now original non-striker) is dismissed', () => {
    const state = setupMatch()
    // A1 on strike. 1 run scored → strike swaps (A2 now activeBatsmanIndex, A1 now nonStrikerIndex).
    // Then wicket with runOutBatsman='striker' dismisses whoever is NOW at activeBatsmanIndex = A2.
    const next = scoreBall(state, {
      runs: 1, wicket: true, dismissalType: 'runOut', runOutBatsman: 'striker', newBatsman: 'A3',
    })
    // After 1 run swap: activeBatsmanIndex pointed to A2, nonStrikerIndex pointed to A1.
    // Dismissed activeBatsmanIndex (A2), replaced with A3.
    expect(getStriker(next)).toBe('A3')
    expect(getNonStriker(next)).toBe('A1')
    // Verify A2 is dismissed
    const inn = next.innings[next.currentInnings]
    const a2 = inn.batsmen.find(b => b.name === 'A2')
    expect(a2.isOut).toBe(true)
  })

  it('wicket with 1 run, non-striker run out: after swap, non-striker (original striker) is dismissed', () => {
    const state = setupMatch()
    // A1 on strike. 1 run scored → strike swaps (A2 now activeBatsmanIndex, A1 now nonStrikerIndex).
    // runOutBatsman='nonStriker' dismisses whoever is NOW at nonStrikerIndex = A1.
    const next = scoreBall(state, {
      runs: 1, wicket: true, dismissalType: 'runOut', runOutBatsman: 'nonStriker', newBatsman: 'A3',
    })
    // After 1 run swap: nonStrikerIndex pointed to A1 → A1 dismissed, replaced with A3.
    expect(getStriker(next)).toBe('A2')
    expect(getNonStriker(next)).toBe('A3')
    // Verify A1 is dismissed
    const inn = next.innings[next.currentInnings]
    const a1 = inn.batsmen.find(b => b.name === 'A1')
    expect(a1.isOut).toBe(true)
  })

  it('multiple wickets track correct batsman positions', () => {
    let state = setupMatch()
    // A1 on strike, gets bowled. A3 replaces at striker end.
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })
    expect(getStriker(state)).toBe('A3')
    expect(getNonStriker(state)).toBe('A2')

    // A3 on strike, scores a single → A2 on strike, A3 non-striker
    state = scoreBall(state, { runs: 1 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A3')

    // A2 on strike, gets caught. A4 replaces at striker end.
    state = scoreBall(state, { wicket: true, dismissalType: 'caught', newBatsman: 'A4' })
    expect(getStriker(state)).toBe('A4')
    expect(getNonStriker(state)).toBe('A3')
  })

  it('wicket on last ball of over: dismissal happens, then end-of-over swap occurs', () => {
    let state = setupMatch()
    // Bowl 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(getStriker(state)).toBe('A1')
    expect(getNonStriker(state)).toBe('A2')

    // Ball 6: bowled. A1 dismissed, A3 replaces at striker end.
    // Before end-of-over: A3 striker, A2 non-striker
    // End-of-over swap: A2 striker, A3 non-striker
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A3')
  })

  it('non-striker run out on last ball of over: end-of-over swap still occurs', () => {
    let state = setupMatch()
    // Bowl 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Ball 6: non-striker (A2) run out, A3 replaces at non-striker end.
    // Before end-of-over: A1 striker, A3 non-striker
    // End-of-over swap: A3 striker, A1 non-striker
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runOutBatsman: 'nonStriker', newBatsman: 'A3',
    })
    expect(getStriker(state)).toBe('A3')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('10th wicket (all out): no end-of-over swap attempted', () => {
    let state = setupMatch()
    // Take 9 wickets
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    expect(state.innings[0].wickets).toBe(9)

    // Record the batsman positions before the 10th wicket
    const strikerBefore = getStriker(state)

    // 10th wicket — all out, no new batsman
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.innings[0].wickets).toBe(MAX_WICKETS)
    // Phase should transition to innings-break (innings ended)
    expect(state.phase).toBe('innings-break')
  })
})

describe('Strike Rotation — Compound Scenarios', () => {
  it('alternating singles keep swapping strike correctly', () => {
    let state = setupMatch()
    // Ball 1: single → A2 striker, A1 non-striker
    state = scoreBall(state, { runs: 1 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')

    // Ball 2: single → A1 striker, A2 non-striker
    state = scoreBall(state, { runs: 1 })
    expect(getStriker(state)).toBe('A1')
    expect(getNonStriker(state)).toBe('A2')

    // Ball 3: single → A2 striker, A1 non-striker
    state = scoreBall(state, { runs: 1 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('no-ball does not advance over count, so no end-of-over swap on 6th delivery if it is a no-ball', () => {
    let state = setupMatch()
    // Bowl 5 legal dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // 6th delivery is a no-ball — NOT a legal delivery, over not complete
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.innings[0].ballsInCurrentOver).toBe(5) // Still 5 legal balls
    expect(getStriker(state)).toBe('A1') // No swap
    expect(getNonStriker(state)).toBe('A2')

    // 7th delivery (6th legal) is a dot — completes the over, end-of-over swap
    state = scoreBall(state, { runs: 0 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('single on a no-ball: strike changes from the run but no over completion', () => {
    let state = setupMatch()
    // No-ball with 1 run off the bat → runsScored=1 (odd) → swap
    state = scoreBall(state, { extraType: 'noBall', runs: 1, runType: 'bat' })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
    // Ball count unchanged (no-ball is not legal delivery)
    expect(state.innings[0].ballsInCurrentOver).toBe(0)
  })

  it('wide then single then dot keeps tracking correctly', () => {
    let state = setupMatch()
    // Wide + 0: no swap
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    expect(getStriker(state)).toBe('A1')

    // Single (legal): swap
    state = scoreBall(state, { runs: 1 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')

    // Dot (legal): no swap
    state = scoreBall(state, { runs: 0 })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })

  it('bye on last ball of over: odd bye swaps, then end-of-over swaps back', () => {
    let state = setupMatch()
    // 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Ball 6: 1 bye (odd, swaps mid-ball → A2 striker)
    // End of over swaps → A1 striker again
    state = scoreBall(state, { extraType: 'bye', runs: 1, runType: 'extra' })
    expect(getStriker(state)).toBe('A1')
    expect(getNonStriker(state)).toBe('A2')
  })

  it('leg bye on last ball of over: even leg bye no swap, end-of-over swaps', () => {
    let state = setupMatch()
    // 5 dot balls
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    // Ball 6: 2 leg byes (even, no mid-ball swap)
    // End of over swaps → A2 striker, A1 non-striker
    state = scoreBall(state, { extraType: 'legBye', runs: 2, runType: 'extra' })
    expect(getStriker(state)).toBe('A2')
    expect(getNonStriker(state)).toBe('A1')
  })
})
