import { describe, it, expect } from 'vitest'
import { computeStandings, computeNRR, extractTeamSummaries } from './standings'

const makeMatchState = (team1, team2, oversPerInnings = 12, inningsData = []) => ({
  team1,
  team2,
  oversPerInnings,
  innings: inningsData,
})

const makeInnings = (battingTeam, bowlingTeam, totalRuns, wickets, oversCompleted, ballsInCurrentOver = 0) => ({
  battingTeam,
  bowlingTeam,
  totalRuns,
  wickets,
  oversCompleted,
  ballsInCurrentOver,
  batsmen: [],
  bowlers: [],
})

describe('extractTeamSummaries', () => {
  it('extracts run/over summaries from a completed match', () => {
    const state = makeMatchState('Alpha', 'Beta', 12, [
      makeInnings('Alpha', 'Beta', 100, 5, 12, 0),
      makeInnings('Beta', 'Alpha', 80, 10, 10, 0), // all out -> 12 overs
      makeInnings('Alpha', 'Beta', 90, 8, 12, 0),
      makeInnings('Beta', 'Alpha', 70, 6, 12, 0),
    ])
    const summaries = extractTeamSummaries(state, 'team_1', 'team_2')
    expect(summaries.team_1.runsScored).toBe(190) // 100 + 90
    expect(summaries.team_1.oversFaced).toBe(24)   // 12 + 12
    expect(summaries.team_2.runsScored).toBe(150)  // 80 + 70
    expect(summaries.team_2.oversFaced).toBe(24)    // all-out=12 + 12
  })

  it('counts all-out innings as full overs', () => {
    const state = makeMatchState('Alpha', 'Beta', 12, [
      makeInnings('Alpha', 'Beta', 50, 10, 8, 3), // all out at 8.3 -> counts as 12
      null, null, null,
    ])
    const summaries = extractTeamSummaries(state, 'team_1', 'team_2')
    expect(summaries.team_1.oversFaced).toBe(12)
  })

  it('handles null innings gracefully', () => {
    const state = makeMatchState('Alpha', 'Beta', 12, [null, null, null, null])
    const summaries = extractTeamSummaries(state, 'team_1', 'team_2')
    expect(summaries.team_1.runsScored).toBe(0)
  })
})

describe('computeNRR', () => {
  it('computes NRR from match summaries', () => {
    const matches = [
      {
        teamSummaries: {
          team_1: { runsScored: 120, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
        },
      },
    ]
    const nrr = computeNRR('team_1', matches)
    // (120/12) - (90/12) = 10 - 7.5 = 2.5
    expect(nrr).toBeCloseTo(2.5)
  })

  it('returns 0 when no matches', () => {
    expect(computeNRR('team_1', [])).toBe(0)
  })

  it('aggregates across multiple matches', () => {
    const matches = [
      {
        teamSummaries: {
          team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
        },
      },
      {
        teamSummaries: {
          team_1: { runsScored: 120, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        },
      },
    ]
    const nrr = computeNRR('team_1', matches)
    // (220/24) - (180/24) = 9.1667 - 7.5 = 1.6667
    expect(nrr).toBeCloseTo(1.6667, 3)
  })
})

describe('computeStandings', () => {
  const teams = [
    { id: 'team_1', name: 'Alpha' },
    { id: 'team_2', name: 'Beta' },
    { id: 'team_3', name: 'Gamma' },
  ]

  it('returns all teams with zero stats when no matches completed', () => {
    const standings = computeStandings(teams, [])
    expect(standings).toHaveLength(3)
    standings.forEach(s => {
      expect(s.played).toBe(0)
      expect(s.points).toBe(0)
    })
  })

  it('awards 2 points for a win', () => {
    const matches = [
      {
        id: 'match_1', type: 'league', status: 'completed',
        team1Id: 'team_1', team2Id: 'team_2',
        winnerId: 'team_1', isTied: false,
        teamSummaries: {
          team_1: { runsScored: 100, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
          team_2: { runsScored: 80, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        },
      },
    ]
    const standings = computeStandings(teams, matches)
    const t1 = standings.find(s => s.teamId === 'team_1')
    const t2 = standings.find(s => s.teamId === 'team_2')
    expect(t1.won).toBe(1)
    expect(t1.points).toBe(2)
    expect(t2.lost).toBe(1)
    expect(t2.points).toBe(0)
  })

  it('awards 1 point for a tie', () => {
    const matches = [
      {
        id: 'match_1', type: 'league', status: 'completed',
        team1Id: 'team_1', team2Id: 'team_2',
        winnerId: null, isTied: true,
        teamSummaries: {
          team_1: { runsScored: 100, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
          team_2: { runsScored: 100, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        },
      },
    ]
    const standings = computeStandings(teams, matches)
    const t1 = standings.find(s => s.teamId === 'team_1')
    expect(t1.tied).toBe(1)
    expect(t1.points).toBe(1)
  })

  it('sorts by points then NRR', () => {
    const matches = [
      {
        id: 'match_1', type: 'league', status: 'completed',
        team1Id: 'team_1', team2Id: 'team_2',
        winnerId: 'team_1', isTied: false,
        teamSummaries: {
          team_1: { runsScored: 150, oversFaced: 12, runsConceded: 80, oversBowled: 12 },
          team_2: { runsScored: 80, oversFaced: 12, runsConceded: 150, oversBowled: 12 },
        },
      },
      {
        id: 'match_2', type: 'league', status: 'completed',
        team1Id: 'team_1', team2Id: 'team_3',
        winnerId: 'team_1', isTied: false,
        teamSummaries: {
          team_1: { runsScored: 120, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
          team_3: { runsScored: 90, oversFaced: 12, runsConceded: 120, oversBowled: 12 },
        },
      },
      {
        id: 'match_3', type: 'league', status: 'completed',
        team1Id: 'team_2', team2Id: 'team_3',
        winnerId: 'team_2', isTied: false,
        teamSummaries: {
          team_2: { runsScored: 100, oversFaced: 12, runsConceded: 90, oversBowled: 12 },
          team_3: { runsScored: 90, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
        },
      },
    ]
    const standings = computeStandings(teams, matches)
    expect(standings[0].teamId).toBe('team_1') // 4 pts
    expect(standings[1].teamId).toBe('team_2') // 2 pts
    expect(standings[2].teamId).toBe('team_3') // 0 pts
    expect(standings[0].position).toBe(1)
    expect(standings[1].position).toBe(2)
    expect(standings[2].position).toBe(3)
  })

  it('does not count eliminator/final matches in standings', () => {
    const matches = [
      {
        id: 'match_4', type: 'eliminator', status: 'completed',
        team1Id: 'team_2', team2Id: 'team_3',
        winnerId: 'team_2', isTied: false,
        teamSummaries: {},
      },
    ]
    const standings = computeStandings(teams, matches)
    standings.forEach(s => {
      expect(s.played).toBe(0)
      expect(s.points).toBe(0)
    })
  })
})
