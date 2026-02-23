/**
 * Spirit of NCC — sportsmanship and rotation diversity tracking.
 */

import { loadMatch } from './storage'
import { countActivePlayers } from './squadUtils'

/**
 * Compute rotation diversity for each team.
 * Returns { teamId: { uniquePlayers: Set<string>, totalSlots: number, diversityPct: number } }
 */
export function computeRotationDiversity(teams, matches) {
  const result = {}

  for (const team of teams) {
    const uniquePlayers = new Set()
    let totalSlots = 0

    const teamMatches = matches.filter(
      m => m.status === 'completed' && (m.team1Id === team.id || m.team2Id === team.id)
    )

    for (const match of teamMatches) {
      const matchState = loadMatch(match.id)
      if (!matchState) continue

      const isTeam1 = match.team1Id === team.id
      const teamKey = isTeam1 ? 'team1' : 'team2'
      const teamName = isTeam1 ? matchState.team1 : matchState.team2

      // Check playing XI from innings data
      const playedNames = new Set()

      for (const inn of (matchState.innings || [])) {
        if (!inn) continue
        if (inn.battingTeam === teamName) {
          inn.batsmen?.forEach(b => playedNames.add(b.name))
        }
        if (inn.bowlingTeam === teamName) {
          inn.bowlers?.forEach(b => playedNames.add(b.name))
        }
      }

      // Also check playingXI if stored
      const xi = matchState.playingXI?.[teamKey]
      if (xi) {
        xi.forEach(name => playedNames.add(name))
      }

      playedNames.forEach(name => uniquePlayers.add(name))
      totalSlots += playedNames.size
    }

    const squadSize = countActivePlayers(team.squad)
    const diversityPct = squadSize > 0
      ? Math.round((uniquePlayers.size / squadSize) * 100)
      : 0

    result[team.id] = {
      uniquePlayers: uniquePlayers.size,
      squadSize,
      matchesPlayed: teamMatches.length,
      diversityPct,
    }
  }

  return result
}
