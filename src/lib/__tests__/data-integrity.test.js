import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER, MAX_WICKETS } from '../constants'

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

// ─── Batting Total Consistency ──────────────────────────────────────────

describe('Batting Total Consistency', () => {
  it('totalRuns equals sum of all batter runs plus all extras after a mixed sequence', () => {
    let state = setupMatch()

    // Sequence:
    // 1. 4 runs (normal)         — A1 on strike, totalRuns=4
    state = scoreBall(state, { runs: 4 })
    // 2. 1 run (normal)          — A1 on strike (4 is even), totalRuns=5, strike rotates to A2
    state = scoreBall(state, { runs: 1 })
    // 3. dot ball                — A2 on strike, totalRuns=5
    state = scoreBall(state, { runs: 0 })
    // 4. W (bowled, A3 comes in) — A2 dismissed, totalRuns=5, wickets=1
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })
    // 5. 6 runs (normal)         — A3 on strike (replaced A2 at activeBatsmanIndex), totalRuns=11
    state = scoreBall(state, { runs: 6 })
    // 6. Wd (wide, 0 extra runs) — totalRuns += 1+0=1 => 12
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    // 7. Wd+2 (wide, 2 runs)     — totalRuns += 1+2=3 => 15
    state = scoreBall(state, { extraType: 'wide', runs: 2, runType: 'extra' })
    // 8. NB+3 (no-ball, 3 bat)   — totalRuns += 1+3=4 => 19, striker.runs += 3
    state = scoreBall(state, { extraType: 'noBall', runs: 3, runType: 'bat' })
    // 9. B1 (bye, 1 run)         — totalRuns += 1 => 20, striker.balls += 1
    state = scoreBall(state, { extraType: 'bye', runs: 1, runType: 'extra' })
    // 10. LB2 (leg-bye, 2 runs)  — totalRuns += 2 => 22, striker.balls += 1
    state = scoreBall(state, { extraType: 'legBye', runs: 2, runType: 'extra' })
    // 11. 2 runs (normal)        — totalRuns += 2 => 24
    state = scoreBall(state, { runs: 2 })
    // 12. dot ball               — totalRuns stays 24
    state = scoreBall(state, { runs: 0 })

    const inn = getInn(state)

    // Verify total runs
    expect(inn.totalRuns).toBe(24)

    // Sum of all batter runs
    const totalBatterRuns = inn.batsmen.reduce((sum, b) => sum + b.runs, 0)

    // Sum of all extras
    const totalExtras = inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes
    // wides: 2 wide deliveries = 2 in extras.wides
    // noBalls: 1 no-ball = 1 in extras.noBalls
    // byes: 1
    // legByes: 2
    // But totalRuns from wides = (1+0) + (1+2) = 4 runs added
    // totalRuns from noBalls = (1+3) = 4 runs added
    // The extras counters track differently from runs: wides counts deliveries, not runs
    // extras.wides = 2 (count of wide deliveries)
    // extras.noBalls = 1 (count of no-ball deliveries)
    // extras.byes = 1 (runs from byes)
    // extras.legByes = 2 (runs from leg-byes)
    // Total extras as runs = (1+0)+(1+2) from wides + (1+3) from NB + 1 bye + 2 LB
    // But extras.wides only counts the number of wides (2), not the total wide runs
    // So: total runs from extras = extras.wides (penalty only) + wide overthrows + extras.noBalls (penalty only) + NB bat runs + byes + legByes
    // Actually, re-reading code: extras.wides just counts 1 per wide. Runs from wides are:
    //   wide1: 1 + 0 = 1 total, 1 to extras.wides
    //   wide2: 1 + 2 = 3 total, 1 to extras.wides
    //   So extras.wides = 2, but actual wide runs added to totalRuns = 1 + 3 = 4
    // The extra runs on wides (the overthrows) go to bowler.runs but NOT to any batsman.
    // So: inn.totalRuns = batterRuns + (wideDeliveries * 1 + totalWideExtraRuns) + (noBallDeliveries * 1 + NB bat runs counted in batsmen) + byes + legByes
    // But NB bat runs are already in batterRuns! So:
    // inn.totalRuns = batterRuns + (extras.wides + wideExtraRuns) + extras.noBalls + extras.byes + extras.legByes
    // Hmm, let's just verify the fundamental identity:
    // totalRuns = sum(batter.runs) + extras_as_runs
    // where extras_as_runs = (all runs from wides) + (NB penalties only) + byes + legByes
    // Since NB bat runs go to batsman, extras_as_runs for NB is just the penalty (1 per NB).
    // Wide runs: penalty (1 per wide) + additional wide runs go to bowler but not batsman.
    // So: totalRuns = batterRuns + (1+0) + (1+2) + (1) + (1) + (2) = batterRuns + 1 + 3 + 1 + 1 + 2 = batterRuns + 8
    // A1: 4 + 1 = 5 (balls 1,2)
    // A2: 0 (balls 3,4 — got out on ball 4 with 0 runs)
    // A3: 6 + 3 = 9 (ball 5 = 6 runs, NB+3 = 3 bat runs)
    //   Plus A3 or A1 may have scored balls 9-12 depending on strike rotation
    //   Let me trace strike more carefully...

    // After ball 1 (4 runs, even): A1 stays on strike. Active=0(A1), NonStriker=1(A2)
    // After ball 2 (1 run, odd):   Strike rotates. Active=1(A2), NonStriker=0(A1). A1.runs=5
    // After ball 3 (0 runs):       A2 on strike, no rotation. A2.runs=0
    // After ball 4 (W bowled):     A2 dismissed. A3 replaces at activeBatsmanIndex. Active=2(A3), NonStriker=0(A1)
    // After ball 5 (6 runs, even): A3 stays on strike. A3.runs=6. Active=2(A3), NonStriker=0(A1)
    // After ball 6 (Wd, 0 runs):   0 is even, no rotation. Active=2(A3), NonStriker=0(A1)
    // After ball 7 (Wd+2):         2 is even... wait, code says `if (runsScored % 2 === 1)` for wides.
    //   runsScored=2, 2%2=0, no rotation. Active=2(A3), NonStriker=0(A1)
    // After ball 8 (NB+3 bat):     runsScored=3, 3%2=1, rotation. A3.runs += 3 = 9. Active=0(A1), NonStriker=2(A3)
    //   Also A3.balls += 1 (runType='bat' on NB)
    // After ball 9 (B1):           runsScored=1, 1%2=1, rotation. Active=2(A3), NonStriker=0(A1). A1.balls += 1
    // After ball 10 (LB2):         runsScored=2, 2%2=0, no rotation. Active=2(A3), NonStriker=0(A1). A3.balls += 1
    // After ball 11 (2 runs):      runsScored=2, 2%2=0, no rotation. Active=2(A3), NonStriker=0(A1). A3.runs += 2 = 11
    // After ball 12 (0 runs):      No rotation. A3.runs stays 11, A3.balls += 1

    // Final batter runs:
    // A1: 4 + 1 = 5
    // A2: 0
    // A3: 6 + 3 + 2 = 11
    // Total batter runs = 5 + 0 + 11 = 16

    expect(totalBatterRuns).toBe(16)

    // Extras breakdown:
    // extras.wides = 2 (two wide deliveries)
    // extras.noBalls = 1
    // extras.byes = 1
    // extras.legByes = 2
    expect(inn.extras.wides).toBe(2)
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.extras.byes).toBe(1)
    expect(inn.extras.legByes).toBe(2)

    // Total runs from extras:
    // Wides: (1+0) + (1+2) = 4 runs from wides
    // NoBalls: (1) penalty (the 3 bat runs are in batter totals) = 1
    // Byes: 1
    // LegByes: 2
    // Total extras runs = 4 + 1 + 1 + 2 = 8
    // totalRuns = batterRuns + extras_runs = 16 + 8 = 24
    // But how to compute extras_runs from the extras object?
    // Wide runs in totalRuns = extras.wides (penalty count) + wide overthrow runs (not tracked separately)
    // So we can verify: totalRuns = batterRuns + (totalRuns - batterRuns)
    // Better: verify inn.totalRuns === totalBatterRuns + (inn.totalRuns - totalBatterRuns)
    // The real invariant is:
    // inn.totalRuns - totalBatterRuns = all extras runs contributed to the total
    const extrasRunsContributed = inn.totalRuns - totalBatterRuns
    expect(extrasRunsContributed).toBe(8)

    // Verify bowler runs = runs charged to bowler (normal + wides + NB, NOT byes/legByes)
    const bowler = inn.bowlers[0]
    // bowler.runs: ball1(4) + ball2(1) + ball3(0) + ball4(0,W) + ball5(6) + ball6(1+0 wide) + ball7(1+2 wide) + ball8(1+3 NB) + ball9(0 bye) + ball10(0 LB) + ball11(2) + ball12(0)
    // = 4 + 1 + 0 + 0 + 6 + 1 + 3 + 4 + 0 + 0 + 2 + 0 = 21
    expect(bowler.runs).toBe(21)

    // Wickets count matches batsmen with isOut===true
    const outCount = inn.batsmen.filter(b => b.isOut).length
    expect(inn.wickets).toBe(outCount)
    expect(inn.wickets).toBe(1)

    // Fall of wickets length matches wickets count
    expect(inn.fallOfWickets.length).toBe(inn.wickets)
  })

  it('totalRuns identity holds after multiple wickets and extras interleaved', () => {
    let state = setupMatch()

    // Score: 2, W(caught, A3), Wd, 1, W(bowled, A4), NB+0, B2, 4, 0, 0
    state = scoreBall(state, { runs: 2 })
    state = scoreBall(state, { wicket: true, dismissalType: 'caught', newBatsman: 'A3' })
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 1 })
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A4' })
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    state = scoreBall(state, { extraType: 'bye', runs: 2, runType: 'extra' })
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })

    const inn = getInn(state)

    // Calculate expected totalRuns:
    // 2 + 0(W) + 1(Wd) + 1 + 0(W) + 1(NB) + 2(bye) + 4 + 0 + 0 = 11
    expect(inn.totalRuns).toBe(11)

    const totalBatterRuns = inn.batsmen.reduce((sum, b) => sum + b.runs, 0)
    const extrasRuns = inn.totalRuns - totalBatterRuns
    // Batter runs: A1=2, A2=0(out), A3=1(then out on next ball? Let me trace...)
    // Actually I need to trace strike:
    // Start: Active=0(A1), NonStriker=1(A2)
    // Ball 1 (2, even): A1.runs=2, no rotation. Active=0(A1)
    // Ball 2 (W caught): A1 dismissed (striker). A3 replaces at active. Active=2(A3), NonStriker=1(A2)
    // Ball 3 (Wd, 0): no rotation. Active=2(A3)
    // Ball 4 (1, odd): A3.runs=1, rotation. Active=1(A2), NonStriker=2(A3)
    // Ball 5 (W bowled): A2 dismissed (striker). A4 replaces. Active=3(A4), NonStriker=2(A3)
    // Ball 6 (NB+0 bat): A4.runs+=0, A4.balls+=1. No rotation (0 even). Active=3(A4)
    // Ball 7 (B2): A4.balls+=1. 2 is even, no rotation. Active=3(A4)
    // Ball 8 (4): A4.runs=4. Even, no rotation. Active=3(A4)
    // Ball 9 (0): Active=3(A4)
    // Ball 10 (0): Active=3(A4)
    // Batter runs: A1=2, A2=0, A3=1, A4=4. Total = 7
    expect(totalBatterRuns).toBe(7)
    expect(extrasRuns).toBe(4) // 1(wide) + 1(NB) + 2(bye) = 4

    expect(inn.extras.wides).toBe(1)
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.extras.byes).toBe(2)
    expect(inn.extras.legByes).toBe(0)

    // Wickets
    const outCount = inn.batsmen.filter(b => b.isOut).length
    expect(inn.wickets).toBe(2)
    expect(inn.wickets).toBe(outCount)
    expect(inn.fallOfWickets.length).toBe(2)
  })
})

// ─── Bowler Figures Consistency ─────────────────────────────────────────

describe('Bowler Figures Consistency', () => {
  it('bowler overs, balls, and runs are consistent after 2 complete overs with extras', () => {
    let state = setupMatch()

    // Over 1 with B1: 0, 0, Wd, 0, 0, 0, 0 (6 legal + 1 wide = 7 deliveries)
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    // Over 1 complete: B1 has 1 over, 0 ballsInOver (reset)

    expect(state.phase).toBe('new-bowler')
    let inn = getInn(state)
    const b1AfterOver1 = inn.bowlers[0]
    expect(b1AfterOver1.overs).toBe(1)
    expect(b1AfterOver1.ballsInOver).toBe(0)
    // B1 runs: 0+0+1(Wd)+0+0+0+0 = 1
    expect(b1AfterOver1.runs).toBe(1)

    // Set new bowler B2
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })

    // Over 2 with B2: NB+1, 2, 0, 0, 1, B3, 0 (6 legal + 1 NB = 7 deliveries)
    state = scoreBall(state, { extraType: 'noBall', runs: 1, runType: 'bat' })
    state = scoreBall(state, { runs: 2 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 1 })
    state = scoreBall(state, { extraType: 'bye', runs: 3, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })
    // Over 2 complete: B2 has 1 over

    expect(state.phase).toBe('new-bowler')
    inn = getInn(state)
    const b2 = inn.bowlers[1]
    expect(b2.overs).toBe(1)
    expect(b2.ballsInOver).toBe(0)
    // B2 runs: (1+1 NB) + 2 + 0 + 0 + 1 + 0(bye not charged) + 0 = 2 + 2 + 1 = 5
    expect(b2.runs).toBe(5)

    // bowlerOversMap consistency
    expect(inn.bowlerOversMap['B1']).toBe(1)
    expect(inn.bowlerOversMap['B2']).toBe(1)
    expect(inn.bowlerOversMap['B1']).toBe(inn.bowlers[0].overs)
    expect(inn.bowlerOversMap['B2']).toBe(b2.overs)

    // Total legal balls across all bowlers = oversCompleted * BALLS_PER_OVER + ballsInCurrentOver
    expect(inn.oversCompleted).toBe(2)
    expect(inn.ballsInCurrentOver).toBe(0)
    const totalLegalBalls = inn.oversCompleted * BALLS_PER_OVER + inn.ballsInCurrentOver
    expect(totalLegalBalls).toBe(12)

    // Sum of individual bowler legal balls: (overs * BALLS_PER_OVER + ballsInOver) per bowler
    const bowlerLegalBalls = inn.bowlers.reduce(
      (sum, b) => sum + b.overs * BALLS_PER_OVER + b.ballsInOver, 0
    )
    expect(bowlerLegalBalls).toBe(totalLegalBalls)
  })

  it('bowler figures remain consistent across bowler changes', () => {
    let state = setupMatch()

    // Over 1 with B1: 6 dots
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })

    // Over 2 with B2: 6 ones
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 1 })
    }
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B1' })

    // Over 3 with B1: 3 twos + 3 dots
    for (let i = 0; i < 3; i++) {
      state = scoreBall(state, { runs: 2 })
    }
    for (let i = 0; i < 3; i++) {
      state = scoreBall(state, { runs: 0 })
    }

    const inn = getInn(state)
    const b1 = inn.bowlers[0]
    const b2 = inn.bowlers[1]

    // B1: 2 overs, 0 runs (over1) + 6 runs (over3) = 6 runs
    expect(b1.overs).toBe(2)
    expect(b1.runs).toBe(6)
    expect(b1.ballsInOver).toBe(0)
    expect(inn.bowlerOversMap['B1']).toBe(2)

    // B2: 1 over, 6 runs
    expect(b2.overs).toBe(1)
    expect(b2.runs).toBe(6)
    expect(b2.ballsInOver).toBe(0)
    expect(inn.bowlerOversMap['B2']).toBe(1)

    // Maiden: B1 over1 was all dots (maiden), over3 had runs (not maiden)
    expect(b1.maidens).toBe(1)
    expect(b2.maidens).toBe(0)
  })
})

// ─── Ball Count Consistency ─────────────────────────────────────────────

describe('Ball Count Consistency', () => {
  it('ball counts are correct after N legal + M illegal deliveries', () => {
    let state = setupMatch()

    // Bowl 8 legal deliveries + 3 wides = 11 total deliveries
    // That's 1 complete over (6 legal) + 2 balls into second over
    // The 3 wides happen during the sequence

    // Over 1: dot, Wd, dot, dot, Wd, dot, dot, dot (6 legal + 2 wides = 8 deliveries)
    state = scoreBall(state, { runs: 0 })                                    // legal 1
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' }) // illegal 1
    state = scoreBall(state, { runs: 0 })                                    // legal 2
    state = scoreBall(state, { runs: 0 })                                    // legal 3
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' }) // illegal 2
    state = scoreBall(state, { runs: 0 })                                    // legal 4
    state = scoreBall(state, { runs: 0 })                                    // legal 5
    state = scoreBall(state, { runs: 0 })                                    // legal 6 — over complete

    let inn = getInn(state)
    // After over 1: 6 legal + 2 wides = 8 deliveries in allOvers[0]
    expect(inn.oversCompleted).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    expect(inn.allOvers[0].length).toBe(8)
    expect(inn.currentOver.length).toBe(0)

    // Set new bowler for over 2
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })

    // Start over 2: Wd, dot, dot (1 illegal + 2 legal = 3 deliveries so far in this over)
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' }) // illegal 3
    state = scoreBall(state, { runs: 0 })                                    // legal 7
    state = scoreBall(state, { runs: 0 })                                    // legal 8

    inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(2) // 8 % 6... no: 2 legal balls in this over
    expect(inn.currentOver.length).toBe(3) // 1 wide + 2 dots in current over

    // Total deliveries across all overs and current over
    const totalDeliveries = inn.allOvers.reduce((sum, o) => sum + o.length, 0) + inn.currentOver.length
    // 8 in allOvers[0] + 3 in currentOver = 11
    expect(totalDeliveries).toBe(11)
  })

  it('an over with 2 wides then 6 legal balls produces 8 entries in allOvers', () => {
    let state = setupMatch()

    // Wd, Wd, 0, 0, 0, 0, 0, 0
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    expect(inn.allOvers.length).toBe(1)
    expect(inn.allOvers[0].length).toBe(8) // 2 wides + 6 dots
    expect(inn.currentOver.length).toBe(0)
    expect(inn.allOvers[0]).toEqual(['Wd', 'Wd', '0', '0', '0', '0', '0', '0'])
  })

  it('no-balls do not count as legal deliveries in ball count', () => {
    let state = setupMatch()

    // NB, NB, 0, 0, 0, 0, 0, 0 (2 NB + 6 legal = 8 deliveries, 1 complete over)
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0)
    expect(inn.allOvers[0].length).toBe(8) // 2 NB + 6 dots
    expect(inn.currentOver.length).toBe(0)
  })

  it('mixed extras in an over produce correct currentOver tracking', () => {
    let state = setupMatch()

    // Wd, NB+2, B1, LB1, 0, 0, 0, 0 (2 illegal + 6 legal = 8 deliveries)
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { extraType: 'noBall', runs: 2, runType: 'bat' })
    state = scoreBall(state, { extraType: 'bye', runs: 1, runType: 'extra' })
    state = scoreBall(state, { extraType: 'legBye', runs: 1, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })

    const inn = getInn(state)
    expect(inn.oversCompleted).toBe(1)
    expect(inn.allOvers[0]).toEqual(['Wd', 'NB+2', 'B1', 'LB1', '0', '0', '0', '0'])
    expect(inn.allOvers[0].length).toBe(8)
  })
})

// ─── Cumulative Scores ─────────────────────────────────────────────────

describe('Cumulative Scores', () => {
  it('cumulative scores are { team1: 0, team2: 0 } before any innings ends', () => {
    let state = setupMatch()
    // Score some runs but do not finish the innings
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 6 })

    expect(state.cumulativeScores.team1).toBe(0)
    expect(state.cumulativeScores.team2).toBe(0)
  })

  it('cumulative scores update correctly when innings 0 ends via all-out', () => {
    let state = setupMatch()

    // Score some runs: 4 + 6 + 1 = 11, then get all out
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 6 })
    state = scoreBall(state, { runs: 1 })

    // Take 10 wickets to end innings
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' }) // 10th wicket

    const inn = state.innings[0]
    expect(inn.totalRuns).toBe(11)
    expect(inn.wickets).toBe(MAX_WICKETS)

    // Team A batted in innings 0 (toss winner batting first)
    expect(state.cumulativeScores.team1).toBe(inn.totalRuns)
    expect(state.cumulativeScores.team2).toBe(0)
  })

  it('cumulative scores reflect both teams after two innings end', () => {
    let state = setupMatch()

    // Innings 0: Team A scores 5, then all out
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 1 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.cumulativeScores.team1).toBe(5)

    // Innings 1: Team B bats
    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    state = scoreBall(state, { runs: 6 })
    state = scoreBall(state, { runs: 2 })
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `B${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })

    expect(state.cumulativeScores.team1).toBe(5)
    expect(state.cumulativeScores.team2).toBe(8)
  })
})

// ─── Fall of Wickets Format ────────────────────────────────────────────

describe('Fall of Wickets Format', () => {
  it('each fow entry has correct batsmanName, runs, wickets, and overs', () => {
    let state = setupMatch()

    // Score 4, then take wicket on ball 2
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })

    const inn = getInn(state)
    expect(inn.fallOfWickets.length).toBe(1)

    const fow = inn.fallOfWickets[0]
    expect(fow.batsmanName).toBe('A1') // Striker A1 was on strike (4 is even, no rotation)
    // Wait — after ball 1 (4 runs, even), A1 stays on strike. Ball 2 is W, A1 is dismissed.
    // Actually: active=0(A1) after setup. Ball 1: 4 runs, even, no rotation. Active still 0(A1).
    // Ball 2: wicket, striker=A1 dismissed.
    expect(fow.batsmanName).toBe('A1')
    expect(fow.runs).toBe(4) // totalRuns at fall = 4 (wicket adds 0)
    expect(fow.wickets).toBe(1)
    // overs: oversCompleted=0, ballsInCurrentOver was 1 before this ball, isLegalDelivery=true => 0 + 1 + 1 = 0.2
    expect(fow.overs).toBe('0.2')
  })

  it('multiple wickets produce fow entries in order with increasing wicket count', () => {
    let state = setupMatch()

    // Ball 1: 2 runs
    state = scoreBall(state, { runs: 2 })
    // Ball 2: W (A1 out, A3 in)
    state = scoreBall(state, { wicket: true, dismissalType: 'caught', newBatsman: 'A3' })
    // Ball 3: 1 run
    state = scoreBall(state, { runs: 1 })
    // Ball 4: W (striker out, A4 in)
    state = scoreBall(state, { wicket: true, dismissalType: 'lbw', newBatsman: 'A4' })

    const inn = getInn(state)
    expect(inn.fallOfWickets.length).toBe(2)

    // First wicket
    expect(inn.fallOfWickets[0].wickets).toBe(1)
    expect(inn.fallOfWickets[0].runs).toBe(2) // totalRuns at first wicket
    expect(inn.fallOfWickets[0].overs).toBe('0.2')

    // Second wicket
    expect(inn.fallOfWickets[1].wickets).toBe(2)
    expect(inn.fallOfWickets[1].runs).toBe(3) // 2 + 1 = 3 at second wicket
    expect(inn.fallOfWickets[1].overs).toBe('0.4')

    // Verify ordering
    expect(inn.fallOfWickets[0].wickets).toBeLessThan(inn.fallOfWickets[1].wickets)
  })

  it('wicket on a no-ball run-out does not increment the ball in overs string', () => {
    let state = setupMatch()

    // Score 2 legal deliveries first
    state = scoreBall(state, { runs: 0 }) // ball 1
    state = scoreBall(state, { runs: 0 }) // ball 2

    // No-ball with run-out (non-striker run out)
    state = scoreBall(state, {
      extraType: 'noBall', runs: 0, runType: 'bat',
      wicket: true, dismissalType: 'runOut', newBatsman: 'A3',
      runOutBatsman: 'nonStriker',
    })

    const inn = getInn(state)
    expect(inn.fallOfWickets.length).toBe(1)
    const fow = inn.fallOfWickets[0]

    // isLegalDelivery is false for no-ball, so overs = `${oversCompleted}.${ballsInCurrentOver + 0}`
    // ballsInCurrentOver was 2 before this delivery (not incremented for illegal delivery)
    // So overs = "0.2" (not "0.3")
    expect(fow.overs).toBe('0.2')
    expect(fow.batsmanName).toBe('A2') // non-striker was dismissed

    // Confirm ballsInCurrentOver is still 2 (no-ball doesn't count)
    expect(inn.ballsInCurrentOver).toBe(2)
  })

  it('wicket on a legal delivery increments the ball in overs string', () => {
    let state = setupMatch()

    // 3 dot balls then a wicket
    state = scoreBall(state, { runs: 0 }) // ball 1
    state = scoreBall(state, { runs: 0 }) // ball 2
    state = scoreBall(state, { runs: 0 }) // ball 3
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' }) // ball 4

    const inn = getInn(state)
    const fow = inn.fallOfWickets[0]
    // isLegalDelivery = true, so overs = `${0}.${3 + 1}` = "0.4"
    expect(fow.overs).toBe('0.4')
    expect(inn.ballsInCurrentOver).toBe(4)
  })

  it('fow overs string is correct for a wicket on the first ball of the match', () => {
    let state = setupMatch()

    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })

    const inn = getInn(state)
    const fow = inn.fallOfWickets[0]
    // oversCompleted=0, ballsInCurrentOver was 0, isLegal=true => "0.1"
    expect(fow.overs).toBe('0.1')
    expect(fow.runs).toBe(0)
    expect(fow.wickets).toBe(1)
  })
})

// ─── Extras Not Credited to Batter ─────────────────────────────────────

describe('Extras Not Credited to Batter', () => {
  it('wide does not credit runs or balls to the striker', () => {
    let state = setupMatch()
    const innBefore = getInn(state)
    const strikerBefore = innBefore.batsmen[innBefore.activeBatsmanIndex]
    const runsBefore = strikerBefore.runs
    const ballsBefore = strikerBefore.balls

    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })

    const inn = getInn(state)
    const striker = inn.batsmen[0] // A1 was on strike, wide with 0 runs (even) doesn't rotate
    expect(striker.runs).toBe(runsBefore)
    expect(striker.balls).toBe(ballsBefore) // wide is not a ball faced
  })

  it('wide with extra runs does not credit runs or balls to the striker', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'wide', runs: 3, runType: 'extra' })

    const inn = getInn(state)
    // Wide + 3 (odd) rotates strike, so original striker A1 is now at nonStrikerIndex
    // A1 should have 0 runs, 0 balls
    const a1 = inn.batsmen[0]
    expect(a1.runs).toBe(0)
    expect(a1.balls).toBe(0)
    expect(inn.totalRuns).toBe(4) // 1 + 3
  })

  it('bye credits balls but not runs to the striker', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'bye', runs: 3, runType: 'extra' })

    const inn = getInn(state)
    // Bye 3 (odd) rotates strike: A1 was striker, now at nonStrikerIndex
    const a1 = inn.batsmen[0]
    expect(a1.runs).toBe(0)
    expect(a1.balls).toBe(1) // legal delivery, ball counted
    expect(inn.totalRuns).toBe(3)
    expect(inn.extras.byes).toBe(3)
  })

  it('leg-bye credits balls but not runs to the striker', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'legBye', runs: 2, runType: 'extra' })

    const inn = getInn(state)
    const a1 = inn.batsmen[0]
    expect(a1.runs).toBe(0)
    expect(a1.balls).toBe(1) // legal delivery, ball counted
    expect(inn.totalRuns).toBe(2)
    expect(inn.extras.legByes).toBe(2)
  })

  it('no-ball with runType bat and 0 runs credits ball but not runs to striker', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })

    const inn = getInn(state)
    const a1 = inn.batsmen[0]
    expect(a1.runs).toBe(0)
    expect(a1.balls).toBe(1) // NB with runType 'bat' counts as a ball faced
    expect(inn.totalRuns).toBe(1) // just the NB penalty
    expect(inn.extras.noBalls).toBe(1)
  })

  it('no-ball with runType bat and runs credits both runs and ball to striker', () => {
    let state = setupMatch()

    state = scoreBall(state, { extraType: 'noBall', runs: 4, runType: 'bat' })

    const inn = getInn(state)
    const a1 = inn.batsmen[0]
    expect(a1.runs).toBe(4) // bat runs credited to striker
    expect(a1.balls).toBe(1)
    expect(a1.fours).toBe(1) // boundary tracked
    expect(inn.totalRuns).toBe(5) // 1 penalty + 4 bat
    expect(inn.extras.noBalls).toBe(1)
  })

  it('sum of batter runs equals totalRuns minus total extras-as-runs across a mixed sequence', () => {
    let state = setupMatch()

    // Mixed sequence: Wd, B2, LB1, NB+0(bat), 4, 1, Wd+1, 0
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    state = scoreBall(state, { extraType: 'bye', runs: 2, runType: 'extra' })
    state = scoreBall(state, { extraType: 'legBye', runs: 1, runType: 'extra' })
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 1 })
    state = scoreBall(state, { extraType: 'wide', runs: 1, runType: 'extra' })
    state = scoreBall(state, { runs: 0 })

    const inn = getInn(state)

    // Trace totalRuns:
    // Wd(0): +1 = 1
    // B2: +2 = 3
    // LB1: +1 = 4
    // NB+0(bat): +1 = 5
    // 4: +4 = 9
    // 1: +1 = 10
    // Wd+1: +(1+1) = 12
    // 0: +0 = 12
    expect(inn.totalRuns).toBe(12)

    // Trace batter runs:
    // Need to track strike carefully:
    // Start: Active=0(A1), NonStriker=1(A2)
    // Wd(0): 0 even, no rotation. Active=0(A1). No batter runs/balls.
    // B2: striker=A1, A1.balls+=1, 2 even no rotation. Active=0(A1).
    // LB1: striker=A1, A1.balls+=1, 1 odd rotation. Active=1(A2).
    // NB+0(bat): striker=A2, A2.runs+=0, A2.balls+=1, 0 even no rotation. Active=1(A2).
    // 4: striker=A2, A2.runs+=4, A2.balls+=1, 4 even no rotation. Active=1(A2).
    // 1: striker=A2, A2.runs+=1, A2.balls+=1, 1 odd rotation. Active=0(A1).
    // Wd+1: 1 odd, rotation. Active=1(A2). No batter runs/balls.
    // 0: striker=A2, A2.runs+=0, A2.balls+=1. Active=1(A2).
    // A1.runs = 0, A2.runs = 0+4+1+0 = 5
    const totalBatterRuns = inn.batsmen.reduce((sum, b) => sum + b.runs, 0)
    expect(totalBatterRuns).toBe(5)

    // Extras runs contributed: wide penalties (2) + wide overthrows (0+1) + NB penalty (1) + byes (2) + legByes (1) = 7
    // totalRuns - batterRuns = 12 - 5 = 7
    const extrasRunsContributed = inn.totalRuns - totalBatterRuns
    expect(extrasRunsContributed).toBe(7)

    // Verify extras breakdown
    expect(inn.extras.wides).toBe(2)
    expect(inn.extras.noBalls).toBe(1)
    expect(inn.extras.byes).toBe(2)
    expect(inn.extras.legByes).toBe(1)
  })
})
