import { POWERPLAY_OVERS, BALLS_PER_OVER } from './constants'

/**
 * Build a text prompt describing the current match situation for AI commentary.
 * Extracts score, batsmen, bowler, run rates, target info, and powerplay status.
 */
export function buildCommentaryContext(matchState) {
  if (!matchState) return ''

  const { innings, currentInnings, team1, team2, target, cumulativeScores, oversPerInnings } = matchState
  const inn = innings?.[currentInnings]
  if (!inn) return ''

  const lines = []

  // Innings header
  const inningsNum = currentInnings + 1
  lines.push(`${getOrdinal(inningsNum)} Innings: ${inn.battingTeam} batting vs ${inn.bowlingTeam}`)

  // Score
  const overs = `${inn.oversCompleted}.${inn.ballsInCurrentOver}`
  lines.push(`Score: ${inn.totalRuns}/${inn.wickets} (${overs} overs)`)

  // Batsmen
  const striker = inn.batsmen?.[inn.activeBatsmanIndex]
  const nonStriker = inn.batsmen?.[inn.nonStrikerIndex]
  if (striker) {
    lines.push(`Striker: ${striker.name} — ${striker.runs}(${striker.balls}) [${striker.fours}x4, ${striker.sixes}x6]`)
  }
  if (nonStriker) {
    lines.push(`Non-striker: ${nonStriker.name} — ${nonStriker.runs}(${nonStriker.balls})`)
  }

  // Bowler
  const bowler = inn.bowlers?.[inn.currentBowlerIndex]
  if (bowler) {
    lines.push(`Bowler: ${bowler.name} — ${bowler.wickets}/${bowler.runs} (${bowler.overs}.${bowler.ballsInOver} ov)`)
  }

  // Run rate
  const totalBalls = inn.oversCompleted * BALLS_PER_OVER + inn.ballsInCurrentOver
  if (totalBalls > 0) {
    const rr = ((inn.totalRuns / totalBalls) * BALLS_PER_OVER).toFixed(2)
    lines.push(`Run rate: ${rr}`)
  }

  // Powerplay
  if (inn.oversCompleted < POWERPLAY_OVERS) {
    lines.push(`Powerplay: ON (${POWERPLAY_OVERS - inn.oversCompleted} overs remaining)`)
  }

  // Target info (2nd+ innings)
  if (target) {
    const remaining = target - inn.totalRuns
    const ballsLeft = (oversPerInnings * BALLS_PER_OVER) - totalBalls
    if (remaining > 0 && ballsLeft > 0) {
      const rrr = ((remaining / ballsLeft) * BALLS_PER_OVER).toFixed(2)
      lines.push(`Target: ${target} — Need ${remaining} runs from ${ballsLeft} balls (RRR: ${rrr})`)
    } else if (remaining <= 0) {
      lines.push(`Target achieved!`)
    }
  }

  // Cumulative scores (multi-innings format)
  if (currentInnings >= 2 && cumulativeScores) {
    const t1Key = inn.battingTeam === team1 ? 'team1' : 'team2'
    const t2Key = t1Key === 'team1' ? 'team2' : 'team1'
    lines.push(`Cumulative: ${inn.battingTeam} ${cumulativeScores[t1Key]} — ${inn.bowlingTeam} ${cumulativeScores[t2Key]}`)
  }

  return lines.join('\n')
}

/**
 * Convert a SCORE_BALL action into natural language for the commentator.
 */
export function describeBallEvent(action) {
  if (!action) return ''

  const parts = []

  // Wicket
  if (action.wicket) {
    parts.push('WICKET!')
    const dismissal = action.dismissalType || 'unknown'
    const labels = {
      bowled: 'Bowled!',
      caught: action.fielder ? `Caught by ${action.fielder}!` : 'Caught!',
      lbw: 'LBW!',
      runOut: action.fielder ? `Run out by ${action.fielder}!` : 'Run out!',
      stumped: action.fielder ? `Stumped by ${action.fielder}!` : 'Stumped!',
      hitWicket: 'Hit wicket!',
    }
    parts.push(labels[dismissal] || dismissal)
    if (action.runs > 0) {
      parts.push(`${action.runs} run(s) scored on the ball.`)
    }
    return parts.join(' ')
  }

  // Extras
  if (action.extraType) {
    const extraLabels = { wide: 'Wide', noBall: 'No ball', bye: 'Bye', legBye: 'Leg bye' }
    const label = extraLabels[action.extraType] || action.extraType
    if (action.runs > 0) {
      parts.push(`${label} plus ${action.runs} additional run(s).`)
    } else {
      parts.push(`${label} bowled.`)
    }
    return parts.join(' ')
  }

  // Normal runs
  const runs = action.runs ?? 0
  if (runs === 0) {
    parts.push('Dot ball.')
  } else if (runs === 4) {
    parts.push('FOUR! Boundary!')
  } else if (runs === 6) {
    parts.push('SIX! Over the ropes!')
  } else if (runs === 1) {
    parts.push('Single taken.')
  } else if (runs === 2) {
    parts.push('Two runs.')
  } else if (runs === 3) {
    parts.push('Three runs! Good running.')
  } else {
    parts.push(`${runs} runs.`)
  }

  return parts.join(' ')
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
