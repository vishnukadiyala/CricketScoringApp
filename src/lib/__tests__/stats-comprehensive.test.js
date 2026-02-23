import { describe, it, expect } from 'vitest'
import {
  computeBattingLeaderboard,
  getOrangeCapList,
  getBestStrikeRate,
  getBestBattingAverage,
  computeBowlingLeaderboard,
  getPurpleCapList,
  getBestEconomy,
  getBestBowlingAverage,
  getBestBowlingStrikeRate,
  computeParticipation,
} from '../stats'

// ─── Helpers ─────────────────────────────────────────────────

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

function makeMatchMeta(id, matchNumber, type, team1Id, team2Id) {
  return { id, matchNumber, type, team1Id, team2Id, status: 'completed', winnerId: null, isTied: false, result: '' }
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
  { id: 'team_1', name: 'Alpha', squad: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'] },
  { id: 'team_2', name: 'Beta', squad: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'] },
]

// ─── Tests ───────────────────────────────────────────────────

describe('Batting Leaderboards', () => {
  it('top run scorer calculated across all completed matches (2 matches, verify total)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 55, 35, 6, 2, false),
            makeBatsman('A2', 20, 15, 2, 0, true),
          ], []),
          makeInnings('Beta', 'Alpha', [
            makeBatsman('B1', 30, 20, 3, 1, true),
          ], []),
          null, null,
        ])
      ),
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 40, 25, 4, 1, true),
          ], []),
          makeInnings('Beta', 'Alpha', [
            makeBatsman('B1', 25, 18, 2, 0, false),
          ], []),
          null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const orange = getOrangeCapList(batting)

    // A1: 55 + 40 = 95 runs across 2 matches
    const a1 = orange.find(p => p.name === 'A1')
    expect(a1.runs).toBe(95)
    expect(a1.matches).toBe(2)
    expect(a1.innings).toBe(2)

    // B1: 30 + 25 = 55 runs across 2 matches
    const b1 = orange.find(p => p.name === 'B1')
    expect(b1.runs).toBe(55)
    expect(b1.matches).toBe(2)

    // A1 is top scorer
    expect(orange[0].name).toBe('A1')
  })

  it('runs from follow-on innings count (player bats in innings 0 and 2)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 20, 3, 1, false), // innings 0
          ], []),
          makeInnings('Beta', 'Alpha', [
            makeBatsman('B1', 10, 8, 1, 0, true),
          ], []),
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 25, 15, 2, 0, true), // innings 2 (follow-on scenario)
          ], []),
          makeInnings('Beta', 'Alpha', [], []),
        ], { followOnEnforced: true })
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const a1 = batting.find(p => p.name === 'A1')

    // 30 + 25 = 55 from innings 0 and 2
    expect(a1.runs).toBe(55)
    expect(a1.innings).toBe(2)
    expect(a1.fours).toBe(5) // 3 + 2
    expect(a1.sixes).toBe(1) // 1 + 0
  })

  it('inactive/released player historical stats are included', () => {
    // A player who played in match 1 but is not in the current squad anymore
    // Their stats from match 1 should still be visible in the leaderboard
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 45, 30, 5, 1, true),
            makeBatsman('A_RELEASED', 20, 15, 2, 0, true), // no longer in squad
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const released = batting.find(p => p.name === 'A_RELEASED')

    // Historical stats should still be present
    expect(released).toBeDefined()
    expect(released.runs).toBe(20)
    expect(released.innings).toBe(1)
  })

  it('most 4s counts across all innings', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 40, 25, 7, 0, false), // 7 fours in innings 0
          ], []),
          null,
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 20, 12, 4, 0, true), // 4 fours in innings 2
          ], []),
          null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const a1 = batting.find(p => p.name === 'A1')

    expect(a1.fours).toBe(11) // 7 + 4 across all innings
  })

  it('most 6s counts across all innings', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 50, 30, 2, 3, false), // 3 sixes
          ], []),
          null,
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 18, 1, 2, true), // 2 sixes
          ], []),
          null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const a1 = batting.find(p => p.name === 'A1')

    expect(a1.sixes).toBe(5) // 3 + 2 across all innings
  })
})

describe('Qualifier Thresholds', () => {
  // ─── Best Strike Rate ──────────────────────────────────────

  it('Best Strike Rate: player with exactly 10 balls IS included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 20, 10, 2, 0, true), // SR 200, exactly 10 balls
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestSR = getBestStrikeRate(batting) // default min 10 balls

    expect(bestSR.find(p => p.name === 'A1')).toBeDefined()
    expect(bestSR[0].strikeRate).toBeCloseTo(200, 0)
  })

  it('Best Strike Rate: player with 9 balls is NOT included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 18, 9, 2, 0, true),    // 9 balls -- below threshold
            makeBatsman('A2', 30, 25, 3, 1, false),   // 25 balls -- qualifies
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestSR = getBestStrikeRate(batting)

    expect(bestSR.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestSR[0].name).toBe('A2')
  })

  it('Best Strike Rate: player with 50 balls IS included (well above threshold)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 75, 50, 8, 3, true), // SR 150, 50 balls
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestSR = getBestStrikeRate(batting)

    expect(bestSR.find(p => p.name === 'A1')).toBeDefined()
    expect(bestSR[0].strikeRate).toBeCloseTo(150, 0)
  })

  // ─── Best Batting Average ──────────────────────────────────

  it('Best Batting Average: player with 2 innings IS included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 50, 30, 4, 2, true), // innings 1
          ], []),
          null,
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 20, 3, 0, true), // innings 2
          ], []),
          null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestAvg = getBestBattingAverage(batting) // default min 2 innings

    const a1 = bestAvg.find(p => p.name === 'A1')
    expect(a1).toBeDefined()
    // 80 runs, 2 innings, 0 not outs => average = 80/2 = 40
    expect(a1.average).toBe(40)
  })

  it('Best Batting Average: player with 1 innings is NOT included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 100, 50, 10, 5, true), // 1 innings only
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestAvg = getBestBattingAverage(batting) // min 2 innings

    expect(bestAvg.find(p => p.name === 'A1')).toBeUndefined()
  })

  // ─── Best Economy Rate ─────────────────────────────────────

  it('Best Economy Rate: player with 2 overs IS included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 2, 0, 5, 1), // 2 overs, economy 2.5
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestEcon = getBestEconomy(bowling) // default min 2 overs

    expect(bestEcon.find(p => p.name === 'A1')).toBeDefined()
    expect(bestEcon[0].economy).toBeCloseTo(2.5, 1)
  })

  it('Best Economy Rate: player with 1 over is NOT included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 1, 0, 3, 0), // 1 over -- below threshold
            makeBowler('A2', 3, 0, 12, 1), // 3 overs -- qualifies
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestEcon = getBestEconomy(bowling)

    expect(bestEcon.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestEcon[0].name).toBe('A2')
  })

  // ─── Best Bowling Average ─────────────────────────────────

  it('Best Bowling Average: player with 2 wickets IS included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 20, 2), // 2 wickets, avg 10.0
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestAvg = getBestBowlingAverage(bowling) // default min 2 wickets

    expect(bestAvg.find(p => p.name === 'A1')).toBeDefined()
    expect(bestAvg[0].bowlingAverage).toBe(10)
  })

  it('Best Bowling Average: player with 1 wicket is NOT included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 10, 1), // 1 wicket -- below threshold
            makeBowler('A2', 3, 0, 18, 3), // 3 wickets -- qualifies
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestAvg = getBestBowlingAverage(bowling)

    expect(bestAvg.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestAvg[0].name).toBe('A2')
  })

  // ─── Best Bowling Strike Rate ─────────────────────────────

  it('Best Bowling Strike Rate: player with 2 wickets IS included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 2, 0, 12, 2), // 2 wickets, SR = 12/2 = 6.0
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestSR = getBestBowlingStrikeRate(bowling) // default min 2 wickets

    expect(bestSR.find(p => p.name === 'A1')).toBeDefined()
    expect(bestSR[0].bowlingStrikeRate).toBe(6)
  })

  it('Best Bowling Strike Rate: player with 1 wicket is NOT included', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 15, 1), // 1 wicket -- below threshold
            makeBowler('A2', 3, 0, 20, 3), // 3 wickets -- qualifies
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const bestSR = getBestBowlingStrikeRate(bowling)

    expect(bestSR.find(p => p.name === 'A1')).toBeUndefined()
    expect(bestSR[0].name).toBe('A2')
  })
})

describe('Stat Calculations', () => {
  it('Batting Average = Runs / (Innings - Not Outs), verify with 1 not-out', () => {
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
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 20, 3, 0, true), // out
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const a1 = batting.find(p => p.name === 'A1')

    // 2 innings, 1 not out => dismissals = 1
    // Average = 80 / 1 = 80
    expect(a1.average).toBe(80)
    expect(a1.notOuts).toBe(1)
    expect(a1.innings).toBe(2)
  })

  it('Strike Rate = (Runs / Balls) x 100, verify to 1 decimal', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 45, 30, 5, 1, true), // SR = (45/30)*100 = 150.0
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const a1 = batting.find(p => p.name === 'A1')

    expect(a1.strikeRate).toBeCloseTo(150.0, 1)
  })

  it('Bowling Economy = Runs / Overs', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 21, 1), // Economy = 21/3 = 7.0
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const a1 = bowling.find(p => p.name === 'A1')

    expect(a1.economy).toBe(7)
  })

  it('Bowling Average = Runs / Wickets', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 24, 3), // Avg = 24/3 = 8.0
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const a1 = bowling.find(p => p.name === 'A1')

    expect(a1.bowlingAverage).toBe(8)
  })

  it('Bowling Strike Rate = Balls / Wickets (balls = overs * 6 + ballsInOver)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            // 3 completed overs + 0 balls in current over = 18 balls, 2 wickets
            makeBowler('A1', 3, 0, 20, 2),
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const a1 = bowling.find(p => p.name === 'A1')

    // balls = 3 * 6 + 0 = 18, SR = 18/2 = 9.0
    expect(a1.balls).toBe(18)
    expect(a1.bowlingStrikeRate).toBe(9)
  })
})

describe('Edge Cases', () => {
  it('Player with 0 runs, 10 balls: SR = 0.0 (qualifies, shows on SR leaderboard)', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 0, 10, 0, 0, true),    // SR = 0.0, exactly 10 balls
            makeBatsman('A2', 20, 15, 2, 0, false),   // SR = 133.3
          ], []),
          null, null, null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const bestSR = getBestStrikeRate(batting)

    // A1 qualifies (10 balls >= 10) but has SR 0
    const a1 = bestSR.find(p => p.name === 'A1')
    expect(a1).toBeDefined()
    expect(a1.strikeRate).toBe(0)

    // A2 should be first (higher SR)
    expect(bestSR[0].name).toBe('A2')
    // A1 should appear after A2
    const a1Idx = bestSR.findIndex(p => p.name === 'A1')
    const a2Idx = bestSR.findIndex(p => p.name === 'A2')
    expect(a1Idx).toBeGreaterThan(a2Idx)
  })

  it('Player with 0 wickets: bowlingAverage = Infinity, excluded from bowling avg leaderboard', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A1', 3, 0, 20, 0), // 0 wickets
            makeBowler('A2', 3, 0, 15, 2), // 2 wickets
          ]),
          null, null, null,
        ])
      ),
    ]

    const bowling = computeBowlingLeaderboard(data)
    const a1 = bowling.find(p => p.name === 'A1')

    expect(a1.bowlingAverage).toBe(Infinity)

    // Should be excluded from best bowling average (requires min 2 wickets)
    const bestAvg = getBestBowlingAverage(bowling)
    expect(bestAvg.find(p => p.name === 'A1')).toBeUndefined()
  })

  it('Player with all not-out innings: batting average = Infinity, sorted to top by runs', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 50, 30, 5, 2, false), // not out
          ], []),
          null,
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 40, 25, 4, 1, false), // not out
          ], []),
          null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const a1 = batting.find(p => p.name === 'A1')

    // 2 innings, 2 not outs => 0 dismissals => average = Infinity (runs > 0)
    expect(a1.average).toBe(Infinity)
    expect(a1.innings).toBe(2)
    expect(a1.notOuts).toBe(2)

    // Should be included in best average (average > 0 and innings >= 2)
    const bestAvg = getBestBattingAverage(batting)
    expect(bestAvg.find(p => p.name === 'A1')).toBeDefined()
  })

  it('Player with 0 runs, all not-out: average = 0, excluded from best average', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 0, 5, 0, 0, false), // not out, 0 runs
          ], []),
          null,
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 0, 3, 0, 0, false), // not out, 0 runs
          ], []),
          null,
        ])
      ),
    ]

    const batting = computeBattingLeaderboard(data, teams)
    const a1 = batting.find(p => p.name === 'A1')

    // 0 runs, all not out => average = 0 (since runs === 0)
    expect(a1.average).toBe(0)

    // Should be excluded from best average (filter requires average > 0)
    const bestAvg = getBestBattingAverage(batting)
    expect(bestAvg.find(p => p.name === 'A1')).toBeUndefined()
  })
})

describe('Participation Tracker', () => {
  it('tracks matches played per player', () => {
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
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 40, 25, 4, 1, false),
            makeBatsman('A3', 15, 10, 1, 0, true),
          ], []),
          null, null, null,
        ])
      ),
    ]

    const participation = computeParticipation(data, teams)
    const alpha = participation['team_1']

    expect(alpha.playerMatches['A1']).toBe(2)
    expect(alpha.playerMatches['A2']).toBe(1)
    expect(alpha.playerMatches['A3']).toBe(2) // bowled in match 1, batted in match 2
  })

  it('player who never batted or bowled shows 0 matches', () => {
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

    // A4 is in the squad but never played
    expect(alpha.playerMatches['A4']).toBe(0)
    expect(alpha.playerMatches['A5']).toBe(0)
    expect(alpha.playerMatches['A11']).toBe(0)
  })

  it('player who played all matches shows count matching total matches', () => {
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
      makeMatchData(
        makeMatchMeta('m2', 2, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 25, 18, 2, 0, false),
          ], []),
          null, null, null,
        ])
      ),
      makeMatchData(
        makeMatchMeta('m3', 3, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 40, 30, 4, 1, true),
          ], []),
          null, null, null,
        ])
      ),
    ]

    const participation = computeParticipation(data, teams)
    const alpha = participation['team_1']

    expect(alpha.totalMatches).toBe(3)
    expect(alpha.playerMatches['A1']).toBe(3)
  })

  it('squad utilization percentage calculated correctly', () => {
    const data = [
      makeMatchData(
        makeMatchMeta('m1', 1, 'league', 'team_1', 'team_2'),
        makeMatchState('Alpha', 'Beta', [
          makeInnings('Alpha', 'Beta', [
            makeBatsman('A1', 30, 20, 3, 0, true),
            makeBatsman('A2', 15, 12, 1, 0, false),
          ], []),
          makeInnings('Beta', 'Alpha', [], [
            makeBowler('A3', 3, 0, 18, 1),
            makeBowler('A4', 2, 0, 12, 0),
          ]),
          null, null,
        ])
      ),
    ]

    const participation = computeParticipation(data, teams)
    const alpha = participation['team_1']

    // 4 unique players (A1, A2, A3, A4) out of 11 squad members
    expect(alpha.uniquePlayers).toBe(4)
    // Utilization = (4 / 11) * 100 = 36.36%
    expect(alpha.squadUtilization).toBeCloseTo(36.36, 0)
  })
})
