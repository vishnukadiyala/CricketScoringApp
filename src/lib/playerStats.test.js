import { describe, it, expect } from 'vitest'
import { aggregatePlayerStats } from './playerStats'

function makeMatchState(team1, team2, innings) {
  return { team1, team2, oversPerInnings: 12, innings }
}

function makeInnings(battingTeam, bowlingTeam, batsmen, bowlers) {
  return { battingTeam, bowlingTeam, batsmen, bowlers, totalRuns: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0 }
}

function makeBatsman(name, runs, balls, fours, sixes, isOut) {
  return { name, runs, balls, fours, sixes, isOut, dismissal: isOut ? 'bowled' : '' }
}

function makeBowler(name, overs, maidens, runs, wickets) {
  return { name, overs, maidens, runs, wickets, ballsInOver: 0 }
}

describe('aggregatePlayerStats', () => {
  it('aggregates batting stats across matches', () => {
    const matches = [
      makeMatchState('Alpha', 'Beta', [
        makeInnings('Alpha', 'Beta', [
          makeBatsman('Player A', 50, 30, 6, 2, false),
          makeBatsman('Player B', 20, 15, 2, 0, true),
        ], []),
        makeInnings('Beta', 'Alpha', [], []),
        null, null,
      ]),
      makeMatchState('Alpha', 'Gamma', [
        makeInnings('Alpha', 'Gamma', [
          makeBatsman('Player A', 30, 25, 3, 1, true),
        ], []),
        null, null, null,
      ]),
    ]
    const stats = aggregatePlayerStats('team_1', 'Alpha', matches)

    const playerA = stats.find(p => p.name === 'Player A')
    expect(playerA).toBeDefined()
    expect(playerA.matches).toBe(2)
    expect(playerA.batting.innings).toBe(2)
    expect(playerA.batting.runs).toBe(80)
    expect(playerA.batting.balls).toBe(55)
    expect(playerA.batting.fours).toBe(9)
    expect(playerA.batting.sixes).toBe(3)
    expect(playerA.batting.highScore).toBe(50)
    expect(playerA.batting.notOuts).toBe(1)
    // average = 80 / 1 dismissal = 80
    expect(playerA.batting.average).toBe(80)
  })

  it('aggregates bowling stats', () => {
    const matches = [
      makeMatchState('Alpha', 'Beta', [
        makeInnings('Beta', 'Alpha', [], [
          makeBowler('Bowler X', 3, 1, 15, 2),
        ]),
        null, null, null,
      ]),
    ]
    const stats = aggregatePlayerStats('team_1', 'Alpha', matches)

    const bowlerX = stats.find(p => p.name === 'Bowler X')
    expect(bowlerX).toBeDefined()
    expect(bowlerX.bowling.innings).toBe(1)
    expect(bowlerX.bowling.overs).toBe(3)
    expect(bowlerX.bowling.maidens).toBe(1)
    expect(bowlerX.bowling.runs).toBe(15)
    expect(bowlerX.bowling.wickets).toBe(2)
    expect(bowlerX.bowling.economy).toBe(5) // 15/3
    expect(bowlerX.bowling.bestFigures).toBe('2/15')
  })

  it('handles empty match list', () => {
    const stats = aggregatePlayerStats('team_1', 'Alpha', [])
    expect(stats).toEqual([])
  })

  it('computes strike rate correctly', () => {
    const matches = [
      makeMatchState('Alpha', 'Beta', [
        makeInnings('Alpha', 'Beta', [
          makeBatsman('Player C', 60, 40, 5, 3, false),
        ], []),
        null, null, null,
      ]),
    ]
    const stats = aggregatePlayerStats('team_1', 'Alpha', matches)
    const playerC = stats.find(p => p.name === 'Player C')
    expect(playerC.batting.sr).toBeCloseTo(150, 1)
  })

  it('tracks best bowling figures across matches', () => {
    const matches = [
      makeMatchState('Alpha', 'Beta', [
        makeInnings('Beta', 'Alpha', [], [
          makeBowler('Bowler Y', 3, 0, 30, 1),
        ]),
        null, null, null,
      ]),
      makeMatchState('Alpha', 'Gamma', [
        makeInnings('Gamma', 'Alpha', [], [
          makeBowler('Bowler Y', 3, 0, 20, 3),
        ]),
        null, null, null,
      ]),
    ]
    const stats = aggregatePlayerStats('team_1', 'Alpha', matches)
    const bowlerY = stats.find(p => p.name === 'Bowler Y')
    expect(bowlerY.bowling.bestFigures).toBe('3/20')
  })
})
