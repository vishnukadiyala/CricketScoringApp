import { describe, it, expect } from 'vitest'
import { extractTeamSummaries, computeNRR, computeStandings } from '../standings'
import { BALLS_PER_OVER, MAX_WICKETS, POINTS_WIN, POINTS_TIE, POINTS_LOSS } from '../constants'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatchState(team1, team2, innings, oversPerInnings = 12) {
  return { team1, team2, innings, oversPerInnings }
}

function makeInnings(battingTeam, bowlingTeam, totalRuns, wickets, oversCompleted, ballsInCurrentOver = 0) {
  return { battingTeam, bowlingTeam, totalRuns, wickets, oversCompleted, ballsInCurrentOver }
}

function makeMatch(id, num, t1Id, t2Id, winnerId, isTied, teamSummaries = {}) {
  return {
    id,
    matchNumber: num,
    type: 'league',
    status: 'completed',
    team1Id: t1Id,
    team2Id: t2Id,
    winnerId,
    isTied,
    teamSummaries,
  }
}

const teams = [
  { id: 't1', name: 'Alpha' },
  { id: 't2', name: 'Beta' },
  { id: 't3', name: 'Gamma' },
]

// ---------------------------------------------------------------------------
// GROUP: Points Table
// ---------------------------------------------------------------------------

describe('Points Table', () => {
  it('1. Win = 2 points, tie = 1, loss = 0', () => {
    expect(POINTS_WIN).toBe(2)
    expect(POINTS_TIE).toBe(1)
    expect(POINTS_LOSS).toBe(0)

    // Verify via computeStandings: one win, one loss
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
        t2: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      }),
    ]
    const standings = computeStandings(teams, matches)
    const alpha = standings.find(s => s.teamId === 't1')
    const beta = standings.find(s => s.teamId === 't2')

    expect(alpha.won).toBe(1)
    expect(alpha.points).toBe(POINTS_WIN)
    expect(beta.lost).toBe(1)
    expect(beta.points).toBe(POINTS_LOSS)
  })

  it('1b. Tied match gives 1 point to each team', () => {
    const matches = [
      makeMatch('m1', 1, 't1', 't2', null, true, {
        t1: { runsScored: 100, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        t2: { runsScored: 100, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      }),
    ]
    const standings = computeStandings(teams, matches)
    const alpha = standings.find(s => s.teamId === 't1')
    const beta = standings.find(s => s.teamId === 't2')

    expect(alpha.tied).toBe(1)
    expect(alpha.points).toBe(POINTS_TIE)
    expect(beta.tied).toBe(1)
    expect(beta.points).toBe(POINTS_TIE)
  })

  it('2. 3-team round robin: team with most wins ranks first', () => {
    // t1 beats t2, t1 beats t3, t2 beats t3
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 120, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        t2: { runsScored: 100, oversFaced: 12, runsConceded: 120, oversBowled: 12 },
      }),
      makeMatch('m2', 2, 't1', 't3', 't1', false, {
        t1: { runsScored: 130, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
        t3: { runsScored: 90, oversFaced: 12, runsConceded: 130, oversBowled: 12 },
      }),
      makeMatch('m3', 3, 't2', 't3', 't2', false, {
        t2: { runsScored: 110, oversFaced: 12, runsConceded: 95, oversBowled: 12 },
        t3: { runsScored: 95, oversFaced: 12, runsConceded: 110, oversBowled: 12 },
      }),
    ]
    const standings = computeStandings(teams, matches)
    expect(standings[0].teamId).toBe('t1')
    expect(standings[0].won).toBe(2)
    expect(standings[0].points).toBe(4)
  })

  it('3. Tiebreaker: when points are equal, higher NRR ranks higher', () => {
    // t1 and t2 both win 1, lose 1; but t1 has higher NRR
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 150, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
        t2: { runsScored: 80, oversFaced: 12, runsConceded: 150, oversBowled: 12 },
      }),
      makeMatch('m2', 2, 't2', 't3', 't2', false, {
        t2: { runsScored: 100, oversFaced: 12, runsConceded: 99, oversBowled: 12 },
        t3: { runsScored: 99, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      }),
      makeMatch('m3', 3, 't1', 't3', 't3', false, {
        t1: { runsScored: 90, oversFaced: 12, runsConceded: 91, oversBowled: 12 },
        t3: { runsScored: 91, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
      }),
    ]
    const standings = computeStandings(teams, matches)
    // t1 and t2 both have 1 win = 2 points
    const t1 = standings.find(s => s.teamId === 't1')
    const t2 = standings.find(s => s.teamId === 't2')
    expect(t1.points).toBe(2)
    expect(t2.points).toBe(2)

    // t1 NRR: (150+90)/(12+12) - (80+91)/(12+12) = 240/24 - 171/24 = 10 - 7.125 = 2.875
    // t2 NRR: (80+100)/(12+12) - (150+99)/(12+12) = 180/24 - 249/24 = 7.5 - 10.375 = -2.875
    // t1 should rank higher
    expect(t1.nrr).toBeGreaterThan(t2.nrr)
    expect(standings.indexOf(t1)).toBeLessThan(standings.indexOf(t2))
  })

  it('4. Verify position assignment (1, 2, 3)', () => {
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 120, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        t2: { runsScored: 100, oversFaced: 12, runsConceded: 120, oversBowled: 12 },
      }),
      makeMatch('m2', 2, 't1', 't3', 't1', false, {
        t1: { runsScored: 130, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
        t3: { runsScored: 90, oversFaced: 12, runsConceded: 130, oversBowled: 12 },
      }),
      makeMatch('m3', 3, 't2', 't3', 't2', false, {
        t2: { runsScored: 110, oversFaced: 12, runsConceded: 95, oversBowled: 12 },
        t3: { runsScored: 95, oversFaced: 12, runsConceded: 110, oversBowled: 12 },
      }),
    ]
    const standings = computeStandings(teams, matches)
    expect(standings[0].position).toBe(1)
    expect(standings[1].position).toBe(2)
    expect(standings[2].position).toBe(3)
    // Verify each team has a unique position
    const positions = standings.map(s => s.position)
    expect(new Set(positions).size).toBe(3)
  })

  it('5. Non-league matches (type "eliminator" or "final") are NOT counted in standings', () => {
    const matches = [
      // League match: t1 beats t2
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 120, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        t2: { runsScored: 100, oversFaced: 12, runsConceded: 120, oversBowled: 12 },
      }),
      // Eliminator: t2 beats t1 — should NOT count
      {
        ...makeMatch('m2', 2, 't2', 't1', 't2', false, {
          t2: { runsScored: 150, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
          t1: { runsScored: 80, oversFaced: 12, runsConceded: 150, oversBowled: 12 },
        }),
        type: 'eliminator',
      },
      // Final: t3 beats t1 — should NOT count
      {
        ...makeMatch('m3', 3, 't3', 't1', 't3', false, {
          t3: { runsScored: 110, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
          t1: { runsScored: 90, oversFaced: 12, runsConceded: 110, oversBowled: 12 },
        }),
        type: 'final',
      },
    ]
    const standings = computeStandings(teams, matches)
    const alpha = standings.find(s => s.teamId === 't1')
    // Only the league match should count
    expect(alpha.played).toBe(1)
    expect(alpha.won).toBe(1)
    expect(alpha.lost).toBe(0)
    expect(alpha.points).toBe(2)
  })

  it('6. Only "completed" matches are counted (not "upcoming" or "live")', () => {
    const matches = [
      // Completed: t1 beats t2
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 100, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
        t2: { runsScored: 90, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      }),
      // Upcoming: should NOT count
      {
        ...makeMatch('m2', 2, 't1', 't3', null, false),
        status: 'upcoming',
      },
      // Live: should NOT count
      {
        ...makeMatch('m3', 3, 't2', 't3', null, false),
        status: 'live',
      },
    ]
    const standings = computeStandings(teams, matches)
    const alpha = standings.find(s => s.teamId === 't1')
    const beta = standings.find(s => s.teamId === 't2')
    const gamma = standings.find(s => s.teamId === 't3')

    expect(alpha.played).toBe(1)
    expect(beta.played).toBe(1)
    expect(gamma.played).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// GROUP: NRR Calculation
// ---------------------------------------------------------------------------

describe('NRR Calculation', () => {
  it('7. Basic NRR: (runs scored / overs faced) - (runs conceded / overs bowled)', () => {
    // Scored 120 in 12 overs, conceded 100 in 12 overs
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 120, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        t2: { runsScored: 100, oversFaced: 12, runsConceded: 120, oversBowled: 12 },
      }),
    ]
    const nrr = computeNRR('t1', matches)
    // NRR = (120/12) - (100/12) = 10 - 8.333... = 1.6666...
    expect(nrr).toBeCloseTo(1.6667, 3)
  })

  it('8. All out counts as FULL 12 overs for NRR, not actual overs', () => {
    // Team all out in 8.3 overs (8 + 3/6 = 8.5) scored 80
    // For NRR, uses full 12 overs
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 80, MAX_WICKETS, 8, 3), // all out at 8.3
      makeInnings('Beta', 'Alpha', 120, 4, 12, 0),          // batted full 12
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    // Alpha was all out -> oversFaced should be full 12, NOT 8.5
    expect(summaries.t1.runsScored).toBe(80)
    expect(summaries.t1.oversFaced).toBe(12)
  })

  it('9. Team bats full 12 overs: NRR uses 12.0 overs (normal)', () => {
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 120, 5, 12, 0), // batted full 12 overs, 5 wkts
      makeInnings('Beta', 'Alpha', 100, 7, 12, 0),  // batted full 12 overs, 7 wkts
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    expect(summaries.t1.oversFaced).toBe(12)
    expect(summaries.t2.oversFaced).toBe(12)
  })

  it('10. NRR across multiple matches: cumulative totals', () => {
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 120, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
      }),
      makeMatch('m2', 2, 't1', 't3', 't1', false, {
        t1: { runsScored: 150, oversFaced: 12, runsConceded: 110, oversBowled: 12 },
      }),
    ]
    const nrr = computeNRR('t1', matches)
    // totalRunsScored = 120 + 150 = 270, totalOversFaced = 12 + 12 = 24
    // totalRunsConceded = 100 + 110 = 210, totalOversBowled = 12 + 12 = 24
    // NRR = (270/24) - (210/24) = 11.25 - 8.75 = 2.5
    expect(nrr).toBeCloseTo(2.5, 5)
  })

  it('11. Edge case: team scores 0, all out -> 0/12 = 0.00 run rate', () => {
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 0, MAX_WICKETS, 5, 2), // all out for 0
      makeInnings('Beta', 'Alpha', 50, 3, 12, 0),
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    expect(summaries.t1.runsScored).toBe(0)
    expect(summaries.t1.oversFaced).toBe(12) // all out = full overs

    // NRR for Alpha: (0/12) - (50/12) = -4.1667
    const matches = [makeMatch('m1', 1, 't1', 't2', 't2', false, summaries)]
    const nrr = computeNRR('t1', matches)
    expect(nrr).toBeCloseTo(-50 / 12, 4)
  })

  it('12. Edge case: 0 overs faced returns NRR 0 (no division by zero)', () => {
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 100, oversFaced: 0, runsConceded: 80, oversBowled: 12 },
      }),
    ]
    const nrr = computeNRR('t1', matches)
    expect(nrr).toBe(0)
  })

  it('12b. Edge case: 0 overs bowled returns NRR 0 (no division by zero)', () => {
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 0 },
      }),
    ]
    const nrr = computeNRR('t1', matches)
    expect(nrr).toBe(0)
  })

  it('13. Non-finite NRR returns 0', () => {
    // If somehow oversFaced and oversBowled are both 0 => 0
    const matches = [
      makeMatch('m1', 1, 't1', 't2', 't1', false, {
        t1: { runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 },
      }),
    ]
    const nrr = computeNRR('t1', matches)
    expect(nrr).toBe(0)

    // No matches at all
    const nrr2 = computeNRR('t1', [])
    expect(nrr2).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// GROUP: extractTeamSummaries
// ---------------------------------------------------------------------------

describe('extractTeamSummaries', () => {
  it('14. Basic extraction: runs and overs for both teams across multiple innings', () => {
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 100, 6, 12, 0),
      makeInnings('Beta', 'Alpha', 90, 8, 12, 0),
      makeInnings('Alpha', 'Beta', 80, 5, 12, 0),
      makeInnings('Beta', 'Alpha', 70, 4, 12, 0),
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    // Alpha batted in innings 0 and 2: scored 100 + 80 = 180, faced 12 + 12 = 24 overs
    expect(summaries.t1.runsScored).toBe(180)
    expect(summaries.t1.oversFaced).toBe(24)

    // Alpha bowled in innings 1 and 3: conceded 90 + 70 = 160, bowled 12 + 12 = 24 overs
    expect(summaries.t1.runsConceded).toBe(160)
    expect(summaries.t1.oversBowled).toBe(24)

    // Beta batted in innings 1 and 3: scored 90 + 70 = 160
    expect(summaries.t2.runsScored).toBe(160)
    expect(summaries.t2.oversFaced).toBe(24)

    // Beta bowled in innings 0 and 2: conceded 100 + 80 = 180
    expect(summaries.t2.runsConceded).toBe(180)
    expect(summaries.t2.oversBowled).toBe(24)
  })

  it('15. All-out innings uses full overs (oversPerInnings) not actual overs', () => {
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 60, MAX_WICKETS, 7, 2), // all out at 7.2
      makeInnings('Beta', 'Alpha', 120, 3, 12, 0),
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    // All out: oversFaced = oversPerInnings = 12, NOT 7 + 2/6 = 7.333
    expect(summaries.t1.oversFaced).toBe(12)
    // Beta bowled that innings, so their oversBowled should also be 12
    expect(summaries.t2.oversBowled).toBe(12)
  })

  it('16. Partial innings: 5.3 overs = 5 + 3/6 = 5.5 overs faced', () => {
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 45, 3, 5, 3), // 5 overs + 3 balls, NOT all out
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    // oversFaced = 5 + 3/6 = 5.5
    expect(summaries.t1.oversFaced).toBeCloseTo(5.5, 10)
    expect(summaries.t1.runsScored).toBe(45)
  })

  it('17. Null innings are skipped (no crash)', () => {
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 100, 6, 12, 0),
      null,
      null,
      null,
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    expect(summaries.t1.runsScored).toBe(100)
    expect(summaries.t1.oversFaced).toBe(12)
    // No errors thrown
  })

  it('17b. Empty innings array does not crash', () => {
    const ms = makeMatchState('Alpha', 'Beta', [], 12)
    const summaries = extractTeamSummaries(ms, 't1', 't2')

    expect(summaries.t1.runsScored).toBe(0)
    expect(summaries.t1.oversFaced).toBe(0)
    expect(summaries.t2.runsScored).toBe(0)
  })

  it('17c. Undefined innings property does not crash', () => {
    const ms = { team1: 'Alpha', team2: 'Beta', oversPerInnings: 12 }
    const summaries = extractTeamSummaries(ms, 't1', 't2')

    expect(summaries.t1.runsScored).toBe(0)
    expect(summaries.t2.runsScored).toBe(0)
  })

  it('18. Follow-on match: same team bats in innings 0 and 2 — both counted', () => {
    // In a follow-on, the same team bats in two different innings slots.
    // Example: Alpha bats innings 0, Beta bats innings 1,
    // follow-on enforced: Beta bats innings 2, Alpha bats innings 3.
    const ms = makeMatchState('Alpha', 'Beta', [
      makeInnings('Alpha', 'Beta', 150, 6, 12, 0), // innings 0: Alpha bats
      makeInnings('Beta', 'Alpha', 60, MAX_WICKETS, 9, 0),  // innings 1: Beta bats (all out)
      makeInnings('Beta', 'Alpha', 110, 8, 12, 0), // innings 2: Beta bats again (follow-on)
      makeInnings('Alpha', 'Beta', 25, 2, 5, 0),   // innings 3: Alpha chases
    ], 12)

    const summaries = extractTeamSummaries(ms, 't1', 't2')

    // Alpha batted innings 0 and 3: scored 150 + 25 = 175
    expect(summaries.t1.runsScored).toBe(175)
    // Alpha faced: innings 0 = 12 overs, innings 3 = 5 overs
    expect(summaries.t1.oversFaced).toBe(17)

    // Beta batted innings 1 and 2: scored 60 + 110 = 170
    expect(summaries.t2.runsScored).toBe(170)
    // Beta innings 1: all out = full 12 overs, innings 2: 12 overs
    expect(summaries.t2.oversFaced).toBe(24)

    // Alpha bowled innings 1 and 2: conceded 60 + 110 = 170
    expect(summaries.t1.runsConceded).toBe(170)
    // Alpha bowled: innings 1 all out = 12, innings 2 = 12
    expect(summaries.t1.oversBowled).toBe(24)
  })
})

// ---------------------------------------------------------------------------
// GROUP: Match Result Types
// ---------------------------------------------------------------------------

describe('Match Result Types', () => {
  // These tests import the matchReducer to verify result strings.
  // We dynamically import to keep the test focused.

  it('19. Result string for run win: contains "won by X run(s)"', async () => {
    const { matchReducer, initialState, createInnings } = await import('../../context/MatchContext.jsx')

    // Set up a match at the end of the 4th innings where team1 wins by runs.
    // We simulate a state just before the last ball of the 4th innings.
    const team1 = 'Alpha'
    const team2 = 'Beta'

    // Build innings manually using createInnings then patching totals.
    const inn0 = createInnings(team1, team2, 1)
    inn0.totalRuns = 100; inn0.wickets = 6; inn0.oversCompleted = 12; inn0.ballsInCurrentOver = 0

    const inn1 = createInnings(team2, team1, 2)
    inn1.totalRuns = 80; inn1.wickets = 8; inn1.oversCompleted = 12; inn1.ballsInCurrentOver = 0

    const inn2 = createInnings(team1, team2, 3)
    inn2.totalRuns = 90; inn2.wickets = 5; inn2.oversCompleted = 12; inn2.ballsInCurrentOver = 0

    // 4th innings: Beta batting, needs cumulative to beat Alpha cumulative (100+90=190).
    // Beta cumulative from inn1 = 80. Beta needs > 110 more. Set beta at 100 after 11.5 overs.
    const inn3 = createInnings(team2, team1, 4)
    inn3.totalRuns = 100; inn3.wickets = 7; inn3.oversCompleted = 11; inn3.ballsInCurrentOver = 5
    inn3.batsmen = [
      { name: 'P1', runs: 50, balls: 30, fours: 5, sixes: 1, isOut: false, dismissal: '' },
      { name: 'P2', runs: 30, balls: 25, fours: 3, sixes: 0, isOut: false, dismissal: '' },
    ]
    inn3.bowlers = [
      { name: 'B1', overs: 3, ballsInOver: 5, maidens: 0, runs: 40, wickets: 2 },
    ]
    inn3.currentBowlerIndex = 0
    inn3.activeBatsmanIndex = 0
    inn3.nonStrikerIndex = 1
    inn3.currentOver = ['1', '0', '2', '0', '4']

    const state = {
      ...initialState,
      team1,
      team2,
      oversPerInnings: 12,
      innings: [inn0, inn1, inn2, inn3],
      currentInnings: 3,
      inningsOrder: [team1, team2, team1, team2],
      phase: 'scoring',
      cumulativeScores: { team1: 190, team2: 80 },
      cumulativeBoundaries: {
        team1: { fours: 0, sixes: 0 },
        team2: { fours: 0, sixes: 0 },
      },
    }

    // Score last ball: dot ball to finish the innings (oversFinished: 12 overs)
    const nextState = matchReducer(state, {
      type: 'SCORE_BALL',
      runType: 'bat',
      runs: 0,
    })

    // Beta cumulative = 80 + 100 = 180, Alpha cumulative = 190
    // Alpha wins by 190 - 180 = 10 runs
    expect(nextState.phase).toBe('match-over')
    expect(nextState.result).toContain('won by')
    expect(nextState.result).toMatch(/won by \d+ run/)
    expect(nextState.result).toContain('Alpha')
  })

  it('20. Result string for innings victory: contains "won by an innings and X runs"', async () => {
    const { matchReducer, initialState, createInnings } = await import('../../context/MatchContext.jsx')

    const team1 = 'Alpha'
    const team2 = 'Beta'

    // Follow-on scenario: Alpha scored 150, Beta scored 50 (follow-on enforced).
    // Innings order after follow-on: [Alpha, Beta, Beta, Alpha]
    // Beta bats innings 2 (follow-on): scores 80. Beta cumulative = 50 + 80 = 130 < Alpha 150.
    // => Alpha wins by an innings and (150 - 130) = 20 runs.

    const inn0 = createInnings(team1, team2, 1)
    inn0.totalRuns = 150; inn0.wickets = 6; inn0.oversCompleted = 12; inn0.ballsInCurrentOver = 0

    const inn1 = createInnings(team2, team1, 2)
    inn1.totalRuns = 50; inn1.wickets = 10; inn1.oversCompleted = 8; inn1.ballsInCurrentOver = 0

    // Innings 2: Beta bats again (follow-on), about to get all out
    const inn2 = createInnings(team2, team1, 3)
    inn2.totalRuns = 79; inn2.wickets = 9; inn2.oversCompleted = 11; inn2.ballsInCurrentOver = 5
    inn2.batsmen = [
      { name: 'P1', runs: 40, balls: 35, fours: 4, sixes: 0, isOut: false, dismissal: '' },
      { name: 'P2', runs: 20, balls: 15, fours: 2, sixes: 0, isOut: false, dismissal: '' },
    ]
    inn2.bowlers = [
      { name: 'B1', overs: 3, ballsInOver: 5, maidens: 0, runs: 30, wickets: 3 },
    ]
    inn2.currentBowlerIndex = 0
    inn2.activeBatsmanIndex = 0
    inn2.nonStrikerIndex = 1
    inn2.currentOver = ['0', '1', 'W', '0', '2']

    const inn3 = createInnings(team1, team2, 4) // not played yet

    const state = {
      ...initialState,
      team1,
      team2,
      oversPerInnings: 12,
      innings: [inn0, inn1, inn2, inn3],
      currentInnings: 2,
      inningsOrder: [team1, team2, team2, team1],
      followOnEnforced: true,
      phase: 'scoring',
      cumulativeScores: { team1: 150, team2: 50 },
      cumulativeBoundaries: {
        team1: { fours: 0, sixes: 0 },
        team2: { fours: 0, sixes: 0 },
      },
    }

    // Take the last wicket: Beta all out at 80 (79 + 1 run off bat, then wicket on next ball)
    // Actually let's just take a wicket on this ball (10th wicket) scoring 0.
    const nextState = matchReducer(state, {
      type: 'SCORE_BALL',
      runType: 'bat',
      runs: 0,
      wicket: true,
      dismissalType: 'bowled',
      newBatsman: null,
    })

    // Beta cumulative = 50 + 79 = 129; Alpha = 150; margin = 150 - 129 = 21
    expect(nextState.phase).toBe('match-over')
    expect(nextState.result).toContain('won by an innings and')
    expect(nextState.result).toMatch(/won by an innings and \d+ run/)
    expect(nextState.result).toContain('Alpha')
  })

  it('21. Tied match -> phase becomes super-over (no result string yet)', async () => {
    const { matchReducer, initialState, createInnings } = await import('../../context/MatchContext.jsx')

    const team1 = 'Alpha'
    const team2 = 'Beta'

    const inn0 = createInnings(team1, team2, 1)
    inn0.totalRuns = 100; inn0.wickets = 5; inn0.oversCompleted = 12; inn0.ballsInCurrentOver = 0

    const inn1 = createInnings(team2, team1, 2)
    inn1.totalRuns = 90; inn1.wickets = 7; inn1.oversCompleted = 12; inn1.ballsInCurrentOver = 0

    const inn2 = createInnings(team1, team2, 3)
    inn2.totalRuns = 80; inn2.wickets = 4; inn2.oversCompleted = 12; inn2.ballsInCurrentOver = 0

    // 4th innings: Beta needs cumulative > Alpha cumulative to win.
    // Alpha cumulative = 100 + 80 = 180. Beta from inn1 = 90.
    // Beta needs exactly 90 more to tie (cumulative 180).
    // Set Beta at 89, about to score 1 to tie at exactly 180.
    const inn3 = createInnings(team2, team1, 4)
    inn3.totalRuns = 89; inn3.wickets = 8; inn3.oversCompleted = 11; inn3.ballsInCurrentOver = 5
    inn3.batsmen = [
      { name: 'P1', runs: 45, balls: 30, fours: 3, sixes: 1, isOut: false, dismissal: '' },
      { name: 'P2', runs: 20, balls: 20, fours: 1, sixes: 0, isOut: false, dismissal: '' },
    ]
    inn3.bowlers = [
      { name: 'B1', overs: 3, ballsInOver: 5, maidens: 0, runs: 30, wickets: 2 },
    ]
    inn3.currentBowlerIndex = 0
    inn3.activeBatsmanIndex = 0
    inn3.nonStrikerIndex = 1
    inn3.currentOver = ['0', '1', '2', '0', '4']

    const state = {
      ...initialState,
      team1,
      team2,
      oversPerInnings: 12,
      innings: [inn0, inn1, inn2, inn3],
      currentInnings: 3,
      inningsOrder: [team1, team2, team1, team2],
      phase: 'scoring',
      cumulativeScores: { team1: 180, team2: 90 },
      cumulativeBoundaries: {
        team1: { fours: 0, sixes: 0 },
        team2: { fours: 0, sixes: 0 },
      },
    }

    // Score 1 run to tie: Beta cumulative = 90 + 90 = 180 = Alpha cumulative
    const nextState = matchReducer(state, {
      type: 'SCORE_BALL',
      runType: 'bat',
      runs: 1,
    })

    // Innings is over (12 overs done) and scores are tied => super-over
    expect(nextState.phase).toBe('super-over')
    // Result string should not be set yet (match not decided)
    expect(nextState.result).toBe('')
  })
})
