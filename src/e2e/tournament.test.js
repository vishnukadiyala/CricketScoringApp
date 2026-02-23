/**
 * Full E2E tournament simulation test.
 *
 * Creates 3 teams with 15 players each, simulates all league matches,
 * an eliminator, and a final. Verifies standings, NRR, and match progression
 * at every step — all via pure reducer calls (no DOM rendering).
 */

import { describe, it, expect } from 'vitest'
import { tournamentReducer, initialTournamentState } from '../context/TournamentContext'
import { matchReducer, initialState as matchInitialState } from '../context/MatchContext'
import { computeStandings } from '../lib/standings'
import { aggregatePlayerStats } from '../lib/playerStats'
import { generateMatchReport } from '../lib/matchReport'
import { BALLS_PER_OVER } from '../lib/constants'

// ─── Helpers ─────────────────────────────────────────────────

const makeSquad = (prefix, count = 15) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`)

const TEAM_A_SQUAD = makeSquad('A')
const TEAM_B_SQUAD = makeSquad('B')
const TEAM_C_SQUAD = makeSquad('C')

function setupAndStartMatch(team1, team2, squad1, squad2, oversPerInnings = 12) {
  const xi1 = squad1.slice(0, 11)
  const xi2 = squad2.slice(0, 11)

  let state = { ...matchInitialState }
  state = matchReducer(state, {
    type: 'SET_TEAMS', team1, team2, oversPerInnings,
    squad1, squad2,
  })
  state = matchReducer(state, { type: 'SET_TOSS', winner: team1, decision: 'bat' })
  state = matchReducer(state, { type: 'SET_PLAYING_XI', team1XI: xi1, team2XI: xi2 })
  state = matchReducer(state, {
    type: 'SET_OPENERS',
    batsman1: xi1[0], batsman2: xi1[1], bowler: xi2[0],
  })
  return state
}

function scoreBall(state, action = {}) {
  return matchReducer(state, { type: 'SCORE_BALL', runs: 0, runType: 'bat', ...action })
}

function setBowler(state, bowlerName) {
  return matchReducer(state, { type: 'SET_BOWLER', bowler: bowlerName })
}

/**
 * Quickly score an innings of N overs with configurable runs per ball.
 * Handles new-bowler phases automatically, rotating through bowlers.
 * Returns state after innings ends (should be at innings-break or follow-on-decision or match-over).
 */
function scoreInnings(state, runsPerBall, bowlers) {
  const oversPerInnings = state.oversPerInnings
  let bowlerIdx = 0

  for (let over = 0; over < oversPerInnings; over++) {
    for (let ball = 0; ball < BALLS_PER_OVER; ball++) {
      state = scoreBall(state, { runs: runsPerBall })
    }
    // After each over, if we're in new-bowler phase, set the next bowler
    if (state.phase === 'new-bowler') {
      bowlerIdx = (bowlerIdx + 1) % bowlers.length
      state = setBowler(state, bowlers[bowlerIdx])
    }
  }

  return state
}

/**
 * Transition through innings-break to the next innings and set up openers.
 */
function startNextInnings(state, batsman1, batsman2, bowler) {
  state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
  expect(state.phase).toBe('batting-order')
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1, batsman2, bowler })
  return state
}

/**
 * Extract team summaries for NRR from a completed match state.
 */
function extractTeamSummaries(matchState, team1Id, team2Id) {
  const result = {}
  result[team1Id] = { runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 }
  result[team2Id] = { runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 }

  for (const inn of matchState.innings) {
    if (!inn || !inn.batsmen || inn.batsmen.length === 0) continue
    const battingTeam = inn.battingTeam === matchState.team1 ? team1Id : team2Id
    const bowlingTeam = inn.battingTeam === matchState.team1 ? team2Id : team1Id
    const overs = inn.oversCompleted + inn.ballsInCurrentOver / BALLS_PER_OVER
    result[battingTeam].runsScored += inn.totalRuns
    result[battingTeam].oversFaced += overs
    result[bowlingTeam].runsConceded += inn.totalRuns
    result[bowlingTeam].oversBowled += overs
  }

  return result
}

/**
 * Play a complete 4-innings match with specified runs per ball for each innings.
 * Returns the final match state.
 */
function playMatch(team1, team2, squad1, squad2, inningsScores, oversPerInnings = 12) {
  const xi1 = squad1.slice(0, 11)
  const xi2 = squad2.slice(0, 11)

  let state = setupAndStartMatch(team1, team2, squad1, squad2, oversPerInnings)

  // Innings 1: team1 bats
  const bowlers1 = [xi2[0], xi2[1], xi2[2], xi2[3]]
  state = scoreInnings(state, inningsScores[0], bowlers1)
  expect(['innings-break']).toContain(state.phase)

  // Innings 2: team2 bats
  state = startNextInnings(state, xi2[0], xi2[1], xi1[0])
  const bowlers2 = [xi1[0], xi1[1], xi1[2], xi1[3]]
  state = scoreInnings(state, inningsScores[1], bowlers2)

  // After innings 2 — could be follow-on-decision or squad-rotation
  if (state.phase === 'follow-on-decision') {
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: false })
  }
  expect(state.phase).toBe('squad-rotation')
  state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

  // Innings 3: team1 bats again
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1: xi1[0], batsman2: xi1[1], bowler: xi2[0] })
  state = scoreInnings(state, inningsScores[2], bowlers1)
  expect(state.phase).toBe('innings-break')

  // Innings 4: team2 bats
  state = startNextInnings(state, xi2[0], xi2[1], xi1[0])
  state = scoreInnings(state, inningsScores[3], bowlers2)

  return state
}

// ─── Tests ───────────────────────────────────────────────────

describe('Full E2E Tournament Simulation', () => {

  it('should create tournament with 3 teams and auto-generate 6 league matches', () => {
    let tState = initialTournamentState
    tState = tournamentReducer(tState, { type: 'CREATE_TOURNAMENT', name: 'NCC Edition 5 Test', oversPerInnings: 12 })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Alpha', squad: TEAM_A_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Beta', squad: TEAM_B_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Gamma', squad: TEAM_C_SQUAD })

    expect(tState.teams).toHaveLength(3)
    expect(tState.matches).toHaveLength(6)
    expect(tState.phase).toBe('league')
    expect(tState.teams[0].squad).toHaveLength(15)
    expect(tState.teams[1].squad).toHaveLength(15)
    expect(tState.teams[2].squad).toHaveLength(15)
  })

  it('should simulate a complete league phase (6 matches) and verify standings', () => {
    let tState = initialTournamentState
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Alpha', squad: TEAM_A_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Beta', squad: TEAM_B_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Gamma', squad: TEAM_C_SQUAD })

    // Helper to complete a tournament match
    const completeTMatch = (matchId, team1, team2, squad1, squad2, t1Id, t2Id, scores) => {
      tState = tournamentReducer(tState, { type: 'START_MATCH', matchId })
      const ms = playMatch(team1, team2, squad1, squad2, scores)
      const ts = extractTeamSummaries(ms, t1Id, t2Id)
      const winnerId = ms.cumulativeScores.team1 > ms.cumulativeScores.team2 ? t1Id : t2Id
      tState = tournamentReducer(tState, {
        type: 'COMPLETE_MATCH', matchId, winnerId,
        isTied: false, result: ms.result, teamSummaries: ts,
      })
    }

    // 6 league matches: Alpha wins all, Beta beats Gamma twice
    completeTMatch('match_1', 'Alpha', 'Beta', TEAM_A_SQUAD, TEAM_B_SQUAD, 'team_1', 'team_2', [2, 1, 2, 1])
    completeTMatch('match_2', 'Alpha', 'Gamma', TEAM_A_SQUAD, TEAM_C_SQUAD, 'team_1', 'team_3', [2, 1, 2, 1])
    completeTMatch('match_3', 'Beta', 'Gamma', TEAM_B_SQUAD, TEAM_C_SQUAD, 'team_2', 'team_3', [2, 1, 2, 1])
    completeTMatch('match_4', 'Beta', 'Alpha', TEAM_B_SQUAD, TEAM_A_SQUAD, 'team_2', 'team_1', [1, 2, 1, 2])
    completeTMatch('match_5', 'Gamma', 'Alpha', TEAM_C_SQUAD, TEAM_A_SQUAD, 'team_3', 'team_1', [1, 2, 1, 2])
    completeTMatch('match_6', 'Gamma', 'Beta', TEAM_C_SQUAD, TEAM_B_SQUAD, 'team_3', 'team_2', [1, 2, 1, 2])

    // After all 6 league matches, eliminator should be auto-created
    expect(tState.matches).toHaveLength(7)
    expect(tState.phase).toBe('eliminator')

    // Verify standings: Alpha 1st (8 pts, won 4), Beta 2nd (4 pts, won 2), Gamma 3rd (0 pts)
    const standings = computeStandings(tState.teams, tState.matches)
    expect(standings[0].teamName).toBe('Alpha')
    expect(standings[0].won).toBe(4)
    expect(standings[1].teamName).toBe('Beta')
    expect(standings[1].won).toBe(2)
    expect(standings[2].teamName).toBe('Gamma')
    expect(standings[2].won).toBe(0)

    // Verify NRR: All teams should have valid NRR values
    standings.forEach(s => {
      expect(typeof s.nrr).toBe('number')
      expect(isFinite(s.nrr)).toBe(true)
    })

    // Eliminator: Beta vs Gamma
    const eliminator = tState.matches[6]
    expect(eliminator.type).toBe('eliminator')
    expect(eliminator.team1Id).toBe('team_2')
    expect(eliminator.team2Id).toBe('team_3')
  })

  it('should complete full tournament through eliminator and final', () => {
    let tState = initialTournamentState
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Alpha', squad: TEAM_A_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Beta', squad: TEAM_B_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Gamma', squad: TEAM_C_SQUAD })

    // Helper to complete a tournament match quickly
    const completeTMatch = (matchId, team1, team2, squad1, squad2, t1Id, t2Id, scores) => {
      tState = tournamentReducer(tState, { type: 'START_MATCH', matchId })
      const ms = playMatch(team1, team2, squad1, squad2, scores)
      const ts = extractTeamSummaries(ms, t1Id, t2Id)
      const winnerId = ms.cumulativeScores.team1 > ms.cumulativeScores.team2 ? t1Id : t2Id
      tState = tournamentReducer(tState, {
        type: 'COMPLETE_MATCH', matchId, winnerId,
        isTied: false, result: ms.result, teamSummaries: ts,
      })
      return ms
    }

    // 6 League matches
    completeTMatch('match_1', 'Alpha', 'Beta', TEAM_A_SQUAD, TEAM_B_SQUAD, 'team_1', 'team_2', [2, 1, 2, 1])
    completeTMatch('match_2', 'Alpha', 'Gamma', TEAM_A_SQUAD, TEAM_C_SQUAD, 'team_1', 'team_3', [2, 1, 2, 1])
    completeTMatch('match_3', 'Beta', 'Gamma', TEAM_B_SQUAD, TEAM_C_SQUAD, 'team_2', 'team_3', [2, 1, 2, 1])
    completeTMatch('match_4', 'Beta', 'Alpha', TEAM_B_SQUAD, TEAM_A_SQUAD, 'team_2', 'team_1', [1, 2, 1, 2])
    completeTMatch('match_5', 'Gamma', 'Alpha', TEAM_C_SQUAD, TEAM_A_SQUAD, 'team_3', 'team_1', [1, 2, 1, 2])
    completeTMatch('match_6', 'Gamma', 'Beta', TEAM_C_SQUAD, TEAM_B_SQUAD, 'team_3', 'team_2', [1, 2, 1, 2])

    expect(tState.phase).toBe('eliminator')
    expect(tState.matches).toHaveLength(7)

    // Eliminator: Beta (2nd) vs Gamma (3rd)
    completeTMatch('match_7', 'Beta', 'Gamma', TEAM_B_SQUAD, TEAM_C_SQUAD, 'team_2', 'team_3', [2, 1, 2, 1])

    expect(tState.phase).toBe('final')
    expect(tState.matches).toHaveLength(8)

    const final_ = tState.matches[7]
    expect(final_.type).toBe('final')
    expect(final_.team1Id).toBe('team_1') // Alpha (1st place)
    expect(final_.team2Id).toBe('team_2') // Beta (eliminator winner)

    // Final: Alpha vs Beta
    completeTMatch('match_8', 'Alpha', 'Beta', TEAM_A_SQUAD, TEAM_B_SQUAD, 'team_1', 'team_2', [3, 1, 3, 1])

    expect(tState.phase).toBe('completed')
    expect(tState.matches[7].status).toBe('completed')
    expect(tState.matches[7].winnerId).toBe('team_1') // Alpha wins final
  })

  it('should produce valid match reports for completed matches', () => {
    const matchState = playMatch('Team X', 'Team Y', makeSquad('X'), makeSquad('Y'), [2, 1, 2, 1])
    expect(matchState.phase).toBe('match-over')

    const report = generateMatchReport(matchState)
    expect(report).toContain('MATCH REPORT')
    expect(report).toContain('Team X')
    expect(report).toContain('Team Y')
    expect(report).toContain('CUMULATIVE TOTALS')
    expect(report).toContain('KEY PERFORMERS')
    expect(report).toContain('NCC Cricket Scorer')
  })

  it('should aggregate player stats across matches', () => {
    const match1State = playMatch('Alpha', 'Beta', TEAM_A_SQUAD, TEAM_B_SQUAD, [2, 1, 2, 1])
    const match2State = playMatch('Alpha', 'Gamma', TEAM_A_SQUAD, TEAM_C_SQUAD, [3, 1, 3, 1])

    const alphaStats = aggregatePlayerStats('team_1', 'Alpha', [match1State, match2State])

    // Should have stats for players who batted or bowled
    expect(alphaStats.length).toBeGreaterThan(0)

    // Check that A1 (opener) has batting stats across 2 matches
    const a1 = alphaStats.find(p => p.name === 'A1')
    expect(a1).toBeTruthy()
    expect(a1.batting.innings).toBeGreaterThanOrEqual(2) // batted at least in 2 matches
    expect(a1.batting.runs).toBeGreaterThan(0)
  })

  it('should handle follow-on scenario correctly', () => {
    // Set up where team2 scores very low in innings 2 (< 50% of innings 1)
    // innings 1: team1 scores 2/ball = 144 total
    // innings 2: team2 scores 0/ball = 0 total → follow-on eligible
    let state = setupAndStartMatch('Alpha', 'Beta', TEAM_A_SQUAD, TEAM_B_SQUAD, 12)

    const xi1 = TEAM_A_SQUAD.slice(0, 11)
    const xi2 = TEAM_B_SQUAD.slice(0, 11)
    const bowlers1 = [xi2[0], xi2[1], xi2[2], xi2[3]]
    const bowlers2 = [xi1[0], xi1[1], xi1[2], xi1[3]]

    // Innings 1: Alpha scores 2/ball
    state = scoreInnings(state, 2, bowlers1)
    expect(state.phase).toBe('innings-break')

    // Innings 2: Beta scores 0/ball
    state = startNextInnings(state, xi2[0], xi2[1], xi1[0])
    state = scoreInnings(state, 0, bowlers2)

    // Should be in follow-on-decision since 0 < 144 * 0.5
    expect(state.phase).toBe('follow-on-decision')

    // Enforce follow-on
    state = matchReducer(state, { type: 'DECIDE_FOLLOW_ON', enforce: true })
    expect(state.followOnEnforced).toBe(true)
    expect(state.phase).toBe('squad-rotation')

    // Finish rotation and continue
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Innings 3: Beta bats again (follow-on enforced)
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: xi2[0], batsman2: xi2[1], bowler: xi1[0] })
    state = scoreInnings(state, 1, bowlers2)
    expect(state.phase).toBe('innings-break')

    // Innings 4: Alpha bats again
    state = startNextInnings(state, xi1[0], xi1[1], xi2[0])
    state = scoreInnings(state, 1, bowlers1)

    expect(state.phase).toBe('match-over')
    expect(state.followOnEnforced).toBe(true)
  })

  it('should handle tied match leading to super over', () => {
    // Both teams score the same in all 4 innings → tie → super over
    let state = setupAndStartMatch('Alpha', 'Beta', TEAM_A_SQUAD, TEAM_B_SQUAD, 12)

    const xi1 = TEAM_A_SQUAD.slice(0, 11)
    const xi2 = TEAM_B_SQUAD.slice(0, 11)
    const bowlers1 = [xi2[0], xi2[1], xi2[2], xi2[3]]
    const bowlers2 = [xi1[0], xi1[1], xi1[2], xi1[3]]

    // All 4 innings score 1/ball = 72 each innings
    // Innings 1
    state = scoreInnings(state, 1, bowlers1)
    expect(state.phase).toBe('innings-break')

    // Innings 2
    state = startNextInnings(state, xi2[0], xi2[1], xi1[0])
    state = scoreInnings(state, 1, bowlers2)

    // No follow-on since scores are equal
    expect(state.phase).toBe('squad-rotation')
    state = matchReducer(state, { type: 'FINISH_SQUAD_ROTATION' })

    // Innings 3
    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: xi1[0], batsman2: xi1[1], bowler: xi2[0] })
    state = scoreInnings(state, 1, bowlers1)
    expect(state.phase).toBe('innings-break')

    // Innings 4
    state = startNextInnings(state, xi2[0], xi2[1], xi1[0])
    state = scoreInnings(state, 1, bowlers2)

    // Cumulative scores are tied (72*2 = 144 each) → super over
    expect(state.phase).toBe('super-over')
    expect(state.cumulativeScores.team1).toBe(state.cumulativeScores.team2)

    // Set up super over players
    state = matchReducer(state, { type: 'START_SUPER_OVER' })
    state = matchReducer(state, {
      type: 'SET_SUPER_OVER_PLAYERS',
      team1Batsmen: [xi1[0], xi1[1], xi1[2]],
      team1Bowler: xi1[3],
      team2Batsmen: [xi2[0], xi2[1], xi2[2]],
      team2Bowler: xi2[3],
    })

    expect(state.superOver.phase).toBe('batting-1')

    // Super over innings 1: score 2 per ball for 6 balls = 12
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 2 })
    }
    expect(state.superOver.innings1.runs).toBe(12)
    expect(state.superOver.phase).toBe('batting-2')
    expect(state.superOver.innings2.target).toBe(13)

    // Super over innings 2: score 1 per ball for 6 balls = 6 (loses)
    for (let i = 0; i < 6; i++) {
      state = matchReducer(state, { type: 'SCORE_SUPER_OVER_BALL', runs: 1 })
    }

    // Result should be determined
    state = matchReducer(state, { type: 'SUPER_OVER_RESULT' })
    expect(state.phase).toBe('match-over')
    expect(state.result).toBeTruthy()
  })

  it('should handle spirit notes in tournament context', () => {
    let tState = initialTournamentState
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Alpha', squad: TEAM_A_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Beta', squad: TEAM_B_SQUAD })
    tState = tournamentReducer(tState, { type: 'ADD_TEAM', name: 'Gamma', squad: TEAM_C_SQUAD })

    tState = tournamentReducer(tState, {
      type: 'SET_SPIRIT_NOTE',
      matchId: 'match_1',
      note: 'Great sportsmanship from both teams',
    })

    expect(tState.spiritNotes.match_1).toBe('Great sportsmanship from both teams')

    tState = tournamentReducer(tState, {
      type: 'SET_SPIRIT_NOTE',
      matchId: 'match_2',
      note: 'Fair play throughout',
    })

    expect(tState.spiritNotes.match_2).toBe('Fair play throughout')
  })
})
