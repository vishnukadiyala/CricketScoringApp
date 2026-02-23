import { BALLS_PER_OVER, MAX_WICKETS, POINTS_WIN, POINTS_TIE, POINTS_LOSS } from './constants'

/**
 * Extract per-team run/over summaries from a completed match state.
 * Returns { [teamId]: { runsScored, oversFaced, runsConceded, oversBowled } }
 */
export function extractTeamSummaries(matchState, team1Id, team2Id) {
  const summaries = {
    [team1Id]: { runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 },
    [team2Id]: { runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 },
  }

  const teamNameToId = {
    [matchState.team1]: team1Id,
    [matchState.team2]: team2Id,
  }

  const oversPerInnings = matchState.oversPerInnings || 12

  ;(matchState.innings || []).forEach(inn => {
    if (!inn || inn.totalRuns === undefined) return

    const completedOvers = inn.oversCompleted + inn.ballsInCurrentOver / BALLS_PER_OVER
    // All-out counts as full overs faced
    const oversFaced = inn.wickets >= MAX_WICKETS ? oversPerInnings : completedOvers

    const battingId = teamNameToId[inn.battingTeam]
    const bowlingId = teamNameToId[inn.bowlingTeam]

    if (battingId && summaries[battingId]) {
      summaries[battingId].runsScored += inn.totalRuns
      summaries[battingId].oversFaced += oversFaced
    }
    if (bowlingId && summaries[bowlingId]) {
      summaries[bowlingId].runsConceded += inn.totalRuns
      summaries[bowlingId].oversBowled += oversFaced
    }
  })

  return summaries
}

/**
 * Compute NRR for a team across multiple completed matches.
 * NRR = (totalRunsScored / totalOversFaced) - (totalRunsConceded / totalOversBowled)
 */
export function computeNRR(teamId, completedMatches) {
  let totalRunsScored = 0
  let totalOversFaced = 0
  let totalRunsConceded = 0
  let totalOversBowled = 0

  completedMatches.forEach(match => {
    const summary = match.teamSummaries?.[teamId]
    if (!summary) return
    totalRunsScored += summary.runsScored
    totalOversFaced += summary.oversFaced
    totalRunsConceded += summary.runsConceded
    totalOversBowled += summary.oversBowled
  })

  if (totalOversFaced === 0 || totalOversBowled === 0) return 0
  const nrr = (totalRunsScored / totalOversFaced) - (totalRunsConceded / totalOversBowled)
  if (!isFinite(nrr)) return 0
  return nrr
}

/**
 * Compute standings table from teams and matches arrays.
 * Returns sorted array: [{ teamId, teamName, played, won, lost, tied, points, nrr, position }]
 */
export function computeStandings(teams, matches) {
  const completedMatches = matches.filter(m => m.status === 'completed')

  const standings = teams.map(team => {
    let played = 0, won = 0, lost = 0, tied = 0

    completedMatches.forEach(match => {
      const isInvolved = match.team1Id === team.id || match.team2Id === team.id
      if (!isInvolved) return
      // Only count league matches for standings
      if (match.type !== 'league') return

      played++
      if (match.isTied) {
        tied++
      } else if (match.winnerId === team.id) {
        won++
      } else {
        lost++
      }
    })

    const leagueCompleted = completedMatches.filter(m => m.type === 'league')
    const nrr = computeNRR(team.id, leagueCompleted.filter(
      m => m.team1Id === team.id || m.team2Id === team.id
    ))

    return {
      teamId: team.id,
      teamName: team.name,
      played,
      won,
      lost,
      tied,
      points: won * POINTS_WIN + tied * POINTS_TIE + lost * POINTS_LOSS,
      nrr,
    }
  })

  // Sort: points desc, then NRR desc
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.nrr - a.nrr
  })

  // Assign positions
  standings.forEach((s, i) => { s.position = i + 1 })

  return standings
}
