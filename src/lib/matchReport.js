/**
 * Generate a shareable text match report from match state.
 */

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function topBatsman(innings) {
  if (!innings?.batsmen?.length) return null
  return innings.batsmen.reduce((top, b) => (b.runs > (top?.runs ?? -1) ? b : top), null)
}

function topBowler(innings) {
  if (!innings?.bowlers?.length) return null
  return innings.bowlers.reduce((top, b) => {
    if (b.wickets > (top?.wickets ?? -1)) return b
    if (b.wickets === (top?.wickets ?? -1) && b.runs < (top?.runs ?? Infinity)) return b
    return top
  }, null)
}

export function generateMatchReport(matchState) {
  if (!matchState) return ''

  const { innings, team1, team2, result, superOver,
    cumulativeScores, cumulativeBoundaries, followOnEnforced } = matchState

  const lines = []
  const divider = '━'.repeat(30)

  lines.push('🏏 MATCH REPORT')
  lines.push(`${team1} vs ${team2}`)
  lines.push(divider)

  // Result
  if (result) {
    lines.push(`📋 ${result}`)
    lines.push('')
  }

  // Innings summaries
  innings.forEach((inn, idx) => {
    if (!inn || !inn.batsmen || inn.batsmen.length === 0) return
    lines.push(`${getOrdinal(idx + 1)} Innings: ${inn.battingTeam}`)
    lines.push(`  ${inn.totalRuns}/${inn.wickets} (${inn.oversCompleted}.${inn.ballsInCurrentOver} ov)`)

    const top = topBatsman(inn)
    if (top && top.runs > 0) {
      lines.push(`  ⭐ ${top.name}: ${top.runs}(${top.balls}) [${top.fours}x4, ${top.sixes}x6]`)
    }

    const topB = topBowler(inn)
    if (topB && topB.wickets > 0) {
      lines.push(`  🎯 ${topB.name}: ${topB.wickets}/${topB.runs} (${topB.overs} ov)`)
    }

    lines.push('')
  })

  // Cumulative
  lines.push(divider)
  lines.push('CUMULATIVE TOTALS')
  lines.push(`  ${team1}: ${cumulativeScores?.team1 ?? 0}`)
  lines.push(`  ${team2}: ${cumulativeScores?.team2 ?? 0}`)

  // Boundaries
  if (cumulativeBoundaries) {
    lines.push('')
    lines.push('BOUNDARIES')
    const b1 = cumulativeBoundaries.team1 ?? { fours: 0, sixes: 0 }
    const b2 = cumulativeBoundaries.team2 ?? { fours: 0, sixes: 0 }
    lines.push(`  ${team1}: ${b1.fours} fours, ${b1.sixes} sixes`)
    lines.push(`  ${team2}: ${b2.fours} fours, ${b2.sixes} sixes`)
  }

  if (followOnEnforced) {
    lines.push('')
    lines.push('📌 Follow-on enforced')
  }

  // Super Over
  if (superOver) {
    lines.push('')
    lines.push('⚡ SUPER OVER')
    lines.push(`  ${superOver.battingFirst}: ${superOver.innings1?.runs ?? 0}/${superOver.innings1?.wickets ?? 0}`)
    lines.push(`  ${superOver.battingSecond}: ${superOver.innings2?.runs ?? 0}/${superOver.innings2?.wickets ?? 0}`)
  }

  // POTM candidates
  lines.push('')
  lines.push(divider)

  // Find overall best performers
  const allBatsmen = []
  const allBowlers = []
  innings.forEach(inn => {
    if (!inn) return
    inn.batsmen?.forEach(b => allBatsmen.push({ ...b, team: inn.battingTeam }))
    inn.bowlers?.forEach(b => allBowlers.push({ ...b, team: inn.bowlingTeam }))
  })

  const bestBat = allBatsmen.reduce((top, b) => (b.runs > (top?.runs ?? -1) ? b : top), null)
  const bestBowl = allBowlers.reduce((top, b) => {
    if (b.wickets > (top?.wickets ?? -1)) return b
    if (b.wickets === (top?.wickets ?? -1) && b.runs < (top?.runs ?? Infinity)) return b
    return top
  }, null)

  if (bestBat || bestBowl) {
    lines.push('KEY PERFORMERS')
    if (bestBat) {
      lines.push(`  🏆 ${bestBat.name} (${bestBat.team}): ${bestBat.runs} runs off ${bestBat.balls} balls`)
    }
    if (bestBowl && bestBowl.wickets > 0) {
      lines.push(`  🏆 ${bestBowl.name} (${bestBowl.team}): ${bestBowl.wickets}/${bestBowl.runs}`)
    }
  }

  lines.push('')
  lines.push('— NCC Cricket Scorer')

  return lines.join('\n')
}

export async function shareReport(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
