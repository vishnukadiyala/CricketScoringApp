import { describe, it, expect } from 'vitest'
import {
  filterMatchData,
  computeBattingLeaderboard,
  getOrangeCapList,
  getMostFours,
  getMostSixes,
  getBestStrikeRate,
  getBestBattingAverage,
  getHighestScores,
  getMostThirtyPlus,
  getMostDucks,
  computeBowlingLeaderboard,
  getPurpleCapList,
  getBestEconomy,
  getBestBowlingAverage,
  getBestBowlingStrikeRate,
  getBestBowlingFigures,
  getMostMaidens,
  computeFieldingStats,
  computeTeamFieldingStats,
  computeTeamStats,
  getHighestTeamTotals,
  getLowestTeamTotals,
  getBiggestWins,
  getHighestMatchAggregates,
  getClosestMatches,
  getMostExtrasInInnings,
  getFollowOnStats,
  computeParticipation,
} from './stats'

// ─── Test Helpers ───────────────────────────────────────────────

function makeBatsman(name, runs, balls, fours, sixes, isOut, dismissal = '') {
  return { name, runs, balls, fours, sixes, isOut, dismissal: isOut ? (dismissal || 'bowled') : '' }
}

function makeBowler(name, overs, maidens, runs, wickets) {
  return { name, overs, maidens, runs, wickets, ballsInOver: 0 }
}

function makeInnings(battingTeam, bowlingTeam, batsmen, bowlers, overrides = {}) {
  return {
    battingTeam,
    bowlingTeam,
    batsmen,
    bowlers,
    totalRuns: batsmen.reduce((s, b) => s + b.runs, 0) + (overrides.extraRuns || 0),
    wickets: batsmen.filter(b => b.isOut).length,
    oversCompleted: overrides.oversCompleted ?? bowlers.reduce((s, b) => s + b.overs, 0),
    ballsInCurrentOver: overrides.ballsInCurrentOver ?? 0,
    allOvers: overrides.allOvers || [],
    currentOver: overrides.currentOver || [],
    extras: overrides.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    fours: batsmen.reduce((s, b) => s + b.fours, 0),
    sixes: batsmen.reduce((s, b) => s + b.sixes, 0),
    fallOfWickets: overrides.fallOfWickets || [],
    bowlerOversMap: {},
    ...overrides,
  }
}

function makeMatchData(matchMeta, matchState) {
  return { matchMeta, matchState }
}

function makeMatchMeta(id, matchNumber, type, team1Id, team2Id, status = 'completed') {
  return { id, matchNumber, type, team1Id, team2Id, status, winnerId: null, isTied: false, result: '' }
}

function makeMatchState(team1, team2, innings, overrides = {}) {
  return {
    team1,
    team2,
    oversPerInnings: 12,
    innings,
    cumulativeScores: overrides.cumulativeScores || { team1: 0, team2: 0 },
    result: overrides.result || '',
    followOnEnforced: overrides.followOnEnforced || false,
    substitutions: overrides.substitutions || { team1: [], team2: [] },
    superOver: overrides.superOver || null,
  }
}

const teams = [
  { id: 'team_1', name: 'Alpha', squad: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11'] },
  { id: 'team_2', name: 'Beta', squad: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11'] },
  { id: 'team_3', name: 'Gamma', squad: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11'] },
]

// ─── Batting Tests ──────────────────────────────────────────────

describe('computeBattingLeaderboard', () => {
  it('computes top run scorer across multiple matches', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 50, 30, 6, 2, false),
            makeBatsman('A2', 20, 15, 2, 0, true),
          ], []),
          makeInnings('Beta', 'Alpha', [
            makeBatsman('B1', 40, 25, 4, 1, true),
          ], []),
          null, null,
        ])
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_3'),
        makeMatchState('Alpha', 'Gamma', [
          makeInnings('Alpha', 'Gamma', [
            makeBatsman('A1', 45, 28, 5, 1, true),
          ], []),
          makeInnings('Gamma', 'Alpha', [
            makeBatsman('G1', 30, 20, 3, 0, true),
          ], []),
          null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const orange = getOrangeCapList(batting)

    // A1: 50 + 45 = 95 runs across 2 matches
    expect(orange[0].name).toBe('A1')
    expect(orange[0].runs).toBe(95)
    expect(orange[0].matches).toBe(2)
    expect(orange[0].innings).toBe(2)
    expect(orange[0].fours).toBe(11)
    expect(orange[0].sixes).toBe(3)
  })

  it('computes batting average correctly (runs / dismissals)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 50, 30, 4, 2, false), // not out
          ], []),
          null, null, null,
        ])
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_3'),
        makeMatchState('Alpha', 'Gamma', [
          makeInnings('Alpha', 'Gamma', [
            makeBatsman('A1', 30, 20, 3, 0, true), // out
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestAvg = getBestBattingAverage(batting, 2)
    const a1 = bestAvg.find(p => p.name === 'A1')

    // 2 innings, 1 not out → average = 80 / 1 = 80
    expect(a1).toBeDefined()
    expect(a1.average).toBe(80)
    expect(a1.notOuts).toBe(1)
  })

  it('includes player with exactly 10 balls in SR leaderboard (new threshold)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 20, 10, 2, 0, true),   // SR 200, exactly 10 balls — should qualify
            makeBatsman('A2', 30, 25, 3, 1, false),   // SR 120, 25 balls
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestSR = getBestStrikeRate(batting) // default min 10 balls

    expect(bestSR.find(p => p.name === 'A1')).toBeDefined()
    expect(bestSR[0].name).toBe('A1')
    expect(bestSR[0].strikeRate).toBeCloseTo(200, 0)
  })

  it('excludes player with 9 balls from SR leaderboard', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 18, 9, 2, 0, true),    // SR 200, only 9 balls — should NOT qualify
            makeBatsman('A2', 30, 25, 3, 1, false),   // SR 120, 25 balls
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestSR = getBestStrikeRate(batting) // default min 10 balls

    expect(bestSR.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestSR[0].name).toBe('A2')
  })

  it('old threshold of 20 no longer applies — player with 15 balls qualifies', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 25, 15, 3, 0, true),   // SR 166.7, 15 balls — would fail old 20-ball threshold
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestSR = getBestStrikeRate(batting) // default min 10 balls

    // With old threshold of 20, this player would be excluded. Now they qualify.
    expect(bestSR.find(p => p.name === 'A1')).toBeDefined()
    expect(bestSR[0].strikeRate).toBeCloseTo(166.7, 0)
  })

  it('applies minimum innings filter for best average', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 100, 50, 10, 5, false), // 1 innings only
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestAvg = getBestBattingAverage(batting, 2) // min 2 innings

    // A1 only has 1 innings, should be filtered out
    expect(bestAvg.find(p => p.name === 'A1')).toBeUndefined()
  })

  it('counts boundary stats across all 4 innings including follow-on', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [makeBatsman('A1', 24, 12, 3, 1, false)], []),
          makeInnings('Beta', 'Alpha', [], []),
          makeInnings('Alpha', 'Beta', [makeBatsman('A1', 18, 9, 2, 1, true)], []),
          makeInnings('Beta', 'Alpha', [], []),
        ], { followOnEnforced: true })
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const fours = getMostFours(batting)
    const sixes = getMostSixes(batting)

    const a1Fours = fours.find(p => p.name === 'A1')
    const a1Sixes = sixes.find(p => p.name === 'A1')

    // 3 + 2 = 5 fours across both innings
    expect(a1Fours.fours).toBe(5)
    // 1 + 1 = 2 sixes
    expect(a1Sixes.sixes).toBe(2)
  })

  it('tracks substituted player stats from 1st innings even after being subbed out', () => {
    // Player A1 bats in innings 1, gets substituted, A12 comes in for innings 3
    // A1's stats from innings 1 should still count
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 40, 25, 4, 1, false),  // A1 plays innings 1
          ], []),
          makeInnings('Beta', 'Alpha', [], []),
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A12', 20, 15, 2, 0, true),  // A12 replaces A1 in innings 3
          ], []),
          null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)

    const a1 = batting.find(p => p.name === 'A1')
    expect(a1).toBeDefined()
    expect(a1.runs).toBe(40) // Stats from innings 1 preserved
    expect(a1.innings).toBe(1)
  })

  it('computes highest individual scores', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 78, 45, 8, 3, false),
            makeBatsman('A2', 35, 20, 4, 0, true),
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const scores = getHighestScores(batting)

    expect(scores[0].runs).toBe(78)
    expect(scores[0].isOut).toBe(false) // not out → shows as 78*
    expect(scores[0].name).toBe('A1')
  })

  it('counts 30+ scores', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 35, 25, 3, 1, true),
          ], []),
          null,
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 42, 30, 5, 0, false),
          ], []),
          null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const thirty = getMostThirtyPlus(batting)
    expect(thirty[0].name).toBe('A1')
    expect(thirty[0].thirtyPlus).toBe(2)
  })

  it('counts ducks correctly', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 0, 3, 0, 0, true), // duck
            makeBatsman('A2', 0, 0, 0, 0, false), // not out on 0, did not face — NOT a duck
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const ducks = getMostDucks(batting)
    expect(ducks.length).toBe(1)
    expect(ducks[0].name).toBe('A1')
  })
})

// ─── Bowling Tests ──────────────────────────────────────────────

describe('computeBowlingLeaderboard', () => {
  it('computes top wicket taker across matches', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 1, 15, 2),
          ]),
          null, null, null,
        ])
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_3'),
        makeMatchState('Alpha', 'Gamma', [
          makeInnings('Gamma', 'Alpha', [], [
            makeBowler('A1', 3, 0, 20, 3),
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const purple = getPurpleCapList(bowling)

    expect(purple[0].name).toBe('A1')
    expect(purple[0].wickets).toBe(5)
    expect(purple[0].overs).toBe(6)
    expect(purple[0].runs).toBe(35)
    expect(purple[0].matches).toBe(2)
    expect(purple[0].bestFigures).toBe('3/20')
  })

  it('includes bowler with exactly 2 overs in economy leaderboard (new threshold)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 2, 0, 5, 1),  // 2 overs, econ 2.5 — qualifies at new min 2
            makeBowler('A2', 6, 1, 20, 2), // 6 overs, econ 3.33
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestEcon = getBestEconomy(bowling) // default min 2 overs

    expect(bestEcon.find(p => p.name === 'A1')).toBeDefined()
    expect(bestEcon[0].name).toBe('A1') // 2.5 < 3.33
  })

  it('excludes bowler with 1.5 overs from economy leaderboard', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 1, 0, 3, 0),  // 1 over — below min 2
            makeBowler('A2', 3, 0, 15, 1), // 3 overs, econ 5.0
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestEcon = getBestEconomy(bowling) // default min 2 overs

    expect(bestEcon.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestEcon[0].name).toBe('A2')
  })

  it('computes best bowling average with min 2 wickets', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 10, 1),  // 1 wicket — below min
            makeBowler('A2', 3, 0, 20, 3),  // 3 wickets, avg 6.67
            makeBowler('A3', 3, 0, 30, 2),  // 2 wickets, avg 15.0
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestAvg = getBestBowlingAverage(bowling)

    expect(bestAvg.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestAvg[0].name).toBe('A2') // 6.67 < 15.0
    expect(bestAvg[0].bowlingAverage).toBeCloseTo(6.67, 1)
    expect(bestAvg[1].name).toBe('A3')
  })

  it('computes best bowling strike rate with min 2 wickets', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 10, 1),  // 1 wicket — below min
            makeBowler('A2', 2, 0, 12, 2),  // 2 wickets, SR = 12/2 = 6.0
            makeBowler('A3', 3, 0, 25, 3),  // 3 wickets, SR = 18/3 = 6.0
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestSR = getBestBowlingStrikeRate(bowling)

    expect(bestSR.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestSR.length).toBe(2) // Only A2 and A3 qualify
  })

  it('computes best bowling figures', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 1, 12, 4),
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const figures = getBestBowlingFigures(bowling)

    expect(figures[0].name).toBe('A1')
    expect(figures[0].figures).toBe('4/12')
    expect(figures[0].vs).toBe('Beta')
  })

  it('computes most maidens', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 2, 8, 1),
            makeBowler('A2', 3, 0, 25, 0),
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const maidens = getMostMaidens(bowling)

    expect(maidens[0].name).toBe('A1')
    expect(maidens[0].maidens).toBe(2)
  })
})

// ─── Team Stats Tests ───────────────────────────────────────────

describe('computeTeamStats', () => {
  it('computes team batting stats', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 50, 30, 6, 2, false),
          ], [], { totalRuns: 80 }),
          makeInnings('Beta', 'Alpha', [
            makeBatsman('B1', 40, 25, 4, 1, true),
          ], [], { totalRuns: 60 }),
          null, null,
        ])
      ),
    ]

    const teamStats = computeTeamStats(data, teams)
    const alpha = teamStats.find(t => t.teamId === 'team_1')
    expect(alpha.totalRuns).toBe(80)
    expect(alpha.matches).toBe(1)
  })

  it('finds highest and lowest team totals', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [], [], { totalRuns: 120, oversCompleted: 12, ballsInCurrentOver: 0, wickets: 5 }),
          makeInnings('Beta', 'Alpha', [], [], { totalRuns: 45, oversCompleted: 10, ballsInCurrentOver: 3, wickets: 10 }),
          null, null,
        ])
      ),
    ]

    const highest = getHighestTeamTotals(data)
    const lowest = getLowestTeamTotals(data)

    expect(highest[0].runs).toBe(120)
    expect(highest[0].team).toBe('Alpha')
    expect(lowest[0].runs).toBe(45)
    expect(lowest[0].team).toBe('Beta')
  })

  it('finds biggest wins', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [null, null, null, null], {
          result: 'Alpha won by 45 runs (cumulative)',
        })
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_3'),
        makeMatchState('Alpha', 'Gamma', [null, null, null, null], {
          result: 'Gamma won by 12 runs (cumulative)',
        })
      ),
    ]

    const wins = getBiggestWins(data, teams)
    expect(wins[0].margin).toBe(45)
    expect(wins[0].winner).toBe('Alpha')
    expect(wins[1].margin).toBe(12)
  })
})

// ─── Records Tests ──────────────────────────────────────────────

describe('Match & Tournament Records', () => {
  it('computes highest match aggregate', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [], [], { totalRuns: 80 }),
          makeInnings('Beta', 'Alpha', [], [], { totalRuns: 60 }),
          makeInnings('Alpha', 'Beta', [], [], { totalRuns: 70 }),
          makeInnings('Beta', 'Alpha', [], [], { totalRuns: 50 }),
        ])
      ),
    ]

    const aggregates = getHighestMatchAggregates(data)
    expect(aggregates[0].totalRuns).toBe(260) // 80+60+70+50
  })

  it('finds closest matches', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [null, null, null, null], {
          result: 'Alpha won by 2 runs (cumulative)',
        })
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_3'),
        makeMatchState('Alpha', 'Gamma', [null, null, null, null], {
          result: 'Alpha won in Super Over (8 vs 6)',
        })
      ),
    ]

    const closest = getClosestMatches(data)
    // Super over has margin 0, should be first
    expect(closest[0].margin).toBe(0)
    expect(closest[1].margin).toBe(2)
  })

  it('computes most extras in an innings', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [], [], {
            totalRuns: 50,
            extras: { wides: 5, noBalls: 3, byes: 2, legByes: 1 },
          }),
          makeInnings('Beta', 'Alpha', [], [], {
            totalRuns: 40,
            extras: { wides: 1, noBalls: 0, byes: 0, legByes: 0 },
          }),
          null, null,
        ])
      ),
    ]

    const extras = getMostExtrasInInnings(data)
    expect(extras[0].total).toBe(11) // 5+3+2+1
    expect(extras[0].bowlingTeam).toBe('Beta')
  })

  it('tracks follow-on stats', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [null, null, null, null], {
          followOnEnforced: true,
          result: 'Alpha won by 30 runs (cumulative)',
        })
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_3'),
        makeMatchState('Alpha', 'Gamma', [null, null, null, null], {
          followOnEnforced: false,
        })
      ),
    ]

    const followOn = getFollowOnStats(data)
    expect(followOn.total).toBe(1)
    expect(followOn.details[0].matchNumber).toBe(1)
  })
})

// ─── Filter Tests ───────────────────────────────────────────────

describe('filterMatchData', () => {
  it('filters by stage', () => {
    const data = [
      makeMatchData(makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'), {}),
      makeMatchData(makeMatchMeta('m2', 2, 'eliminator', 'team_2', 'team_3'), {}),
      makeMatchData(makeMatchMeta('m3', 3, 'final', 'team_1', 'team_3'), {}),
    ]

    expect(filterMatchData(data, { stage: 'league' }).length).toBe(1)
    expect(filterMatchData(data, { stage: 'knockout' }).length).toBe(2)
    expect(filterMatchData(data, { stage: 'all' }).length).toBe(3)
  })

  it('filters by team', () => {
    const data = [
      makeMatchData(makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'), {}),
      makeMatchData(makeMatchMeta('m2', 2, 'league', 'team_2', 'team_3'), {}),
    ]

    expect(filterMatchData(data, { teamId: 'team_1' }).length).toBe(1)
    expect(filterMatchData(data, { teamId: 'team_2' }).length).toBe(2)
    expect(filterMatchData(data, { teamId: 'team_3' }).length).toBe(1)
  })
})

// ─── Participation Tests ────────────────────────────────────────

describe('computeParticipation', () => {
  it('tracks participation per player', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 20, 3, 0, true),
            makeBatsman('A2', 10, 8, 1, 0, false),
          ], []),
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A3', 3, 0, 20, 1),
          ]),
          null, null,
        ])
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_3'),
        makeMatchState('Alpha', 'Gamma', [
          makeInnings('Alpha', 'Gamma', [
            makeBatsman('A1', 40, 25, 4, 1, false),
          ], []),
          null, null, null,
        ])
      ),
    ]

    const participation = computeParticipation(data, teams)
    const alpha = participation['team_1']

    expect(alpha.totalMatches).toBe(2)
    expect(alpha.playerMatches['A1']).toBe(2)
    expect(alpha.playerMatches['A2']).toBe(1)
    expect(alpha.playerMatches['A3']).toBe(1)
    expect(alpha.playerMatches['A4']).toBe(0)  // not played
    expect(alpha.uniquePlayers).toBe(3)
  })

  it('computes squad utilization percentage', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 20, 3, 0, true),
          ], []),
          null, null, null,
        ])
      ),
    ]

    const participation = computeParticipation(data, teams)
    const alpha = participation['team_1']

    // 1 player used out of 11 squad members = 9.09%
    expect(alpha.squadUtilization).toBeCloseTo(9.09, 0)
  })
})

// ─── Fielding Tests ─────────────────────────────────────────────

describe('computeTeamFieldingStats', () => {
  it('counts dismissal types per team', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 20, 3, 0, true, 'caught'),
            makeBatsman('A2', 10, 8, 1, 0, true, 'runOut'),
            makeBatsman('A3', 0, 2, 0, 0, true, 'bowled'),
          ], []),
          null, null, null,
        ])
      ),
    ]

    const fielding = computeTeamFieldingStats(data)
    const beta = fielding.find(f => f.teamId === 'team_2')

    expect(beta.catches).toBe(1)
    expect(beta.runOuts).toBe(1)
    expect(beta.bowled).toBe(1)
  })
})
