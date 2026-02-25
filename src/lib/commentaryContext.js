import { POWERPLAY_OVERS, BALLS_PER_OVER } from './constants'

/**
 * Build a rich text prompt describing the full match situation for AI commentary.
 * Includes: score, players, over history, partnership, milestones, momentum, and target info.
 *
 * NOTE: matchState reflects the state BEFORE the current ball (React dispatch is async).
 * The `action` parameter describes what just happened on this ball.
 */
export function buildCommentaryContext(matchState, action) {
  if (!matchState) return ''

  const { innings, currentInnings, team1, team2, target, cumulativeScores, oversPerInnings, lastBallWasNoBall } = matchState
  const inn = innings?.[currentInnings]
  if (!inn) return ''

  const lines = []

  // ── Innings header ──
  const inningsNum = currentInnings + 1
  lines.push(`${getOrdinal(inningsNum)} Innings: ${inn.battingTeam} batting vs ${inn.bowlingTeam}`)

  // ── Score (before this ball) ──
  const overs = `${inn.oversCompleted}.${inn.ballsInCurrentOver}`
  lines.push(`Score: ${inn.totalRuns}/${inn.wickets} (${overs} overs)`)

  // ── Current batsmen ──
  const striker = inn.batsmen?.[inn.activeBatsmanIndex]
  const nonStriker = inn.batsmen?.[inn.nonStrikerIndex]
  if (striker) {
    lines.push(`Striker: ${striker.name} — ${striker.runs}(${striker.balls}) [${striker.fours}x4, ${striker.sixes}x6]`)
  }
  if (nonStriker) {
    lines.push(`Non-striker: ${nonStriker.name} — ${nonStriker.runs}(${nonStriker.balls}) [${nonStriker.fours}x4, ${nonStriker.sixes}x6]`)
  }

  // ── Current bowler ──
  const bowler = inn.bowlers?.[inn.currentBowlerIndex]
  if (bowler) {
    const econ = (bowler.overs + bowler.ballsInOver / 6) > 0
      ? (bowler.runs / (bowler.overs + bowler.ballsInOver / 6)).toFixed(1)
      : '0.0'
    lines.push(`Bowler: ${bowler.name} — ${bowler.wickets}/${bowler.runs} (${bowler.overs}.${bowler.ballsInOver} ov, econ ${econ})`)
  }

  // ── Run rate ──
  const totalBalls = inn.oversCompleted * BALLS_PER_OVER + inn.ballsInCurrentOver
  if (totalBalls > 0) {
    const rr = ((inn.totalRuns / totalBalls) * BALLS_PER_OVER).toFixed(2)
    lines.push(`Run rate: ${rr}`)
  }

  // ── Powerplay ──
  if (inn.oversCompleted < POWERPLAY_OVERS) {
    lines.push(`Powerplay: ON (${POWERPLAY_OVERS - inn.oversCompleted} overs remaining)`)
  }

  // ── Free hit ──
  if (lastBallWasNoBall) {
    lines.push('FREE HIT on this delivery!')
  }

  // ── Target info (2nd+ innings) ──
  if (target) {
    const remaining = target - inn.totalRuns
    const ballsLeft = (oversPerInnings * BALLS_PER_OVER) - totalBalls
    if (remaining > 0 && ballsLeft > 0) {
      const rrr = ((remaining / ballsLeft) * BALLS_PER_OVER).toFixed(2)
      lines.push(`Target: ${target} — Need ${remaining} from ${ballsLeft} balls (RRR: ${rrr})`)
    } else if (remaining <= 0) {
      lines.push('Target achieved!')
    }
  }

  // ── Cumulative scores (multi-innings format) ──
  if (currentInnings >= 2 && cumulativeScores) {
    const t1Key = inn.battingTeam === team1 ? 'team1' : 'team2'
    const t2Key = t1Key === 'team1' ? 'team2' : 'team1'
    lines.push(`Cumulative: ${inn.battingTeam} ${cumulativeScores[t1Key]} — ${inn.bowlingTeam} ${cumulativeScores[t2Key]}`)
  }

  // ── This over so far ──
  if (inn.currentOver && inn.currentOver.length > 0) {
    lines.push(`This over so far: [${inn.currentOver.join(', ')}]`)
  } else if (inn.ballsInCurrentOver === 0) {
    lines.push('New over starting.')
  }

  // ── Previous over summary ──
  if (inn.allOvers && inn.allOvers.length > 0) {
    const lastOver = inn.allOvers[inn.allOvers.length - 1]
    const overRuns = sumOverRuns(lastOver)
    const prevBowlerIdx = inn.allOvers.length <= inn.bowlers?.length ? inn.allOvers.length - 1 : null
    lines.push(`Last over: [${lastOver.join(', ')}] = ${overRuns} runs`)
  }

  // ── Partnership ──
  const partnershipRuns = computePartnership(inn)
  if (partnershipRuns > 0 && striker && nonStriker) {
    lines.push(`Partnership: ${striker.name} & ${nonStriker.name} — ${partnershipRuns} runs`)
  }

  // ── Milestone proximity (computed AFTER this ball) ──
  if (striker && action) {
    const runsAfterBall = action.wicket ? striker.runs : striker.runs + (action.runType === 'bat' ? (action.runs || 0) : 0)
    const milestone = nextMilestone(runsAfterBall)
    if (milestone) {
      const away = milestone - runsAfterBall
      if (away === 0) {
        lines.push(`MILESTONE: ${striker.name} reaches ${milestone}!`)
      } else if (away <= 10) {
        lines.push(`${striker.name} is ${away} away from ${milestone}.`)
      }
    }
  }

  // ── Momentum indicators ──
  const momentum = computeMomentum(inn)
  if (momentum) {
    lines.push(momentum)
  }

  // ── Fall of wickets (recent) ──
  if (inn.fallOfWickets && inn.fallOfWickets.length > 0) {
    const recent = inn.fallOfWickets.slice(-2)
    const fowStr = recent.map(f => `${f.batsmanName} at ${f.runs}/${f.wickets} (${f.overs} ov)`).join('; ')
    lines.push(`Recent wickets: ${fowStr}`)
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

// ── Helpers ──────────────────────────────────────────────────

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Compute current partnership runs:
 * Total runs minus the score at the last fall of wicket.
 */
function computePartnership(inn) {
  if (!inn.fallOfWickets || inn.fallOfWickets.length === 0) {
    return inn.totalRuns // no wickets fallen = opening partnership
  }
  const lastFOW = inn.fallOfWickets[inn.fallOfWickets.length - 1]
  return inn.totalRuns - lastFOW.runs
}

/**
 * Find the next milestone (25, 50, 75, 100, 150, 200) the batsman is approaching.
 */
function nextMilestone(runs) {
  const milestones = [25, 50, 75, 100, 150, 200]
  for (const m of milestones) {
    if (runs <= m) return m
  }
  return null
}

/**
 * Compute momentum string from recent ball history.
 */
function computeMomentum(inn) {
  // Gather recent balls: current over + last completed over
  const recentBalls = []
  if (inn.allOvers && inn.allOvers.length > 0) {
    recentBalls.push(...inn.allOvers[inn.allOvers.length - 1])
  }
  if (inn.currentOver) {
    recentBalls.push(...inn.currentOver)
  }

  if (recentBalls.length < 2) return null

  // Count consecutive dots at the end
  let dotsInARow = 0
  for (let i = recentBalls.length - 1; i >= 0; i--) {
    if (recentBalls[i] === '0') dotsInARow++
    else break
  }
  if (dotsInARow >= 3) {
    return `Pressure: ${dotsInARow} dot balls in a row.`
  }

  // Count boundaries in the current over
  const overBalls = inn.currentOver || []
  const boundaries = overBalls.filter(b => b === '4' || b === '6').length
  if (boundaries >= 2) {
    return `Momentum: ${boundaries} boundaries already in this over!`
  }

  // Runs off last 6 legal balls
  const last6 = recentBalls.slice(-6)
  const runsLast6 = sumOverRuns(last6)
  if (runsLast6 >= 15) {
    return `Momentum: ${runsLast6} runs off the last ${last6.length} balls — big hitting!`
  } else if (runsLast6 <= 2 && last6.length >= 6) {
    return `Pressure: Only ${runsLast6} runs off the last ${last6.length} balls — tight bowling.`
  }

  return null
}

/**
 * Sum runs from an array of ball display strings.
 */
function sumOverRuns(balls) {
  let total = 0
  for (const b of balls) {
    if (b === 'W') total += 0
    else if (b === 'Wd') total += 1
    else if (b.startsWith('Wd+')) total += 1 + parseInt(b.slice(3), 10)
    else if (b === 'NB') total += 1
    else if (b.startsWith('NB+')) total += 1 + parseInt(b.slice(3), 10)
    else if (b.startsWith('B')) total += parseInt(b.slice(1), 10) || 0
    else if (b.startsWith('LB')) total += parseInt(b.slice(2), 10) || 0
    else total += parseInt(b, 10) || 0
  }
  return total
}

// ── Analysis context builders ────────────────────────────────

/**
 * Build context for the over that just ended.
 * Includes ball-by-ball, bowler stats, and batsmen who batted in the over.
 */
export function buildOverSummaryContext(matchState) {
  if (!matchState) return ''
  const inn = matchState.innings?.[matchState.currentInnings]
  if (!inn) return ''

  const lines = []
  const inningsNum = matchState.currentInnings + 1
  lines.push(`${getOrdinal(inningsNum)} Innings: ${inn.battingTeam} vs ${inn.bowlingTeam}`)
  lines.push(`Score after this over: ${inn.totalRuns}/${inn.wickets} (${inn.oversCompleted} overs)`)

  // The over that just ended is the last in allOvers
  const lastOver = inn.allOvers?.[inn.allOvers.length - 1]
  if (lastOver) {
    const overRuns = sumOverRuns(lastOver)
    lines.push(`Over ${inn.oversCompleted}: [${lastOver.join(', ')}] = ${overRuns} runs`)
  }

  // Bowler for this over
  const bowler = inn.bowlers?.[inn.currentBowlerIndex]
  if (bowler) {
    const econ = (bowler.overs + bowler.ballsInOver / 6) > 0
      ? (bowler.runs / (bowler.overs + bowler.ballsInOver / 6)).toFixed(1) : '0.0'
    lines.push(`Bowler: ${bowler.name} — ${bowler.wickets}/${bowler.runs} (${bowler.overs}.${bowler.ballsInOver} ov, econ ${econ})`)
  }

  // Current batsmen
  const striker = inn.batsmen?.[inn.activeBatsmanIndex]
  const nonStriker = inn.batsmen?.[inn.nonStrikerIndex]
  if (striker) lines.push(`Striker: ${striker.name} — ${striker.runs}(${striker.balls}) [${striker.fours}x4, ${striker.sixes}x6]`)
  if (nonStriker) lines.push(`Non-striker: ${nonStriker.name} — ${nonStriker.runs}(${nonStriker.balls})`)

  // Run rate
  const totalBalls = inn.oversCompleted * BALLS_PER_OVER
  if (totalBalls > 0) {
    lines.push(`Run rate: ${((inn.totalRuns / totalBalls) * BALLS_PER_OVER).toFixed(2)}`)
  }

  // Target info
  if (matchState.target) {
    const remaining = matchState.target - inn.totalRuns
    const ballsLeft = (matchState.oversPerInnings * BALLS_PER_OVER) - totalBalls
    if (remaining > 0 && ballsLeft > 0) {
      lines.push(`Target: ${matchState.target} — Need ${remaining} from ${ballsLeft} balls (RRR: ${((remaining / ballsLeft) * BALLS_PER_OVER).toFixed(2)})`)
    }
  }

  return lines.join('\n')
}

/**
 * Build comprehensive innings context for innings/match reports.
 * Includes all batsmen, all bowlers, FOW, extras, over-by-over progression.
 */
export function buildFullInningsContext(matchState, inningsIndex) {
  if (!matchState) return ''
  const inn = matchState.innings?.[inningsIndex]
  if (!inn) return ''

  const lines = []
  const inningsNum = inningsIndex + 1
  lines.push(`=== ${getOrdinal(inningsNum)} Innings: ${inn.battingTeam} vs ${inn.bowlingTeam} ===`)
  lines.push(`Total: ${inn.totalRuns}/${inn.wickets} (${inn.oversCompleted}.${inn.ballsInCurrentOver} overs)`)
  lines.push(`Fours: ${inn.fours}, Sixes: ${inn.sixes}`)

  // All batsmen
  lines.push('\nBatting:')
  for (const b of (inn.batsmen || [])) {
    const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '0'
    const status = b.isOut ? `out (${b.dismissal})` : 'not out'
    lines.push(`  ${b.name}: ${b.runs}(${b.balls}) [${b.fours}x4, ${b.sixes}x6] SR ${sr} — ${status}`)
  }

  // All bowlers
  lines.push('\nBowling:')
  for (const b of (inn.bowlers || [])) {
    const econ = (b.overs + b.ballsInOver / 6) > 0
      ? (b.runs / (b.overs + b.ballsInOver / 6)).toFixed(1) : '0.0'
    lines.push(`  ${b.name}: ${b.wickets}/${b.runs} (${b.overs}.${b.ballsInOver} ov) econ ${econ}, maidens ${b.maidens}`)
  }

  // Fall of wickets
  if (inn.fallOfWickets?.length > 0) {
    lines.push('\nFall of wickets:')
    for (const f of inn.fallOfWickets) {
      lines.push(`  ${f.wickets}/${f.runs} — ${f.batsmanName} (${f.overs} ov, bowler: ${f.bowlerName})`)
    }
  }

  // Extras
  if (inn.extras) {
    const e = inn.extras
    const total = (e.wides || 0) + (e.noBalls || 0) + (e.byes || 0) + (e.legByes || 0)
    if (total > 0) {
      lines.push(`\nExtras: ${total} (W ${e.wides}, NB ${e.noBalls}, B ${e.byes}, LB ${e.legByes})`)
    }
  }

  // Over-by-over scoring
  if (inn.allOvers?.length > 0) {
    lines.push('\nOver-by-over:')
    inn.allOvers.forEach((over, i) => {
      lines.push(`  Over ${i + 1}: [${over.join(', ')}] = ${sumOverRuns(over)} runs`)
    })
  }

  return lines.join('\n')
}

/**
 * Build context for full match report (all innings).
 */
export function buildMatchReportContext(matchState) {
  if (!matchState) return ''

  const lines = []
  lines.push(`Match: ${matchState.team1} vs ${matchState.team2}`)
  lines.push(`Format: ${matchState.oversPerInnings} overs per innings`)
  if (matchState.result) lines.push(`Result: ${matchState.result}`)
  lines.push('')

  // Include all played innings
  for (let i = 0; i <= matchState.currentInnings; i++) {
    if (matchState.innings[i]) {
      lines.push(buildFullInningsContext(matchState, i))
      lines.push('')
    }
  }

  // Cumulative scores if applicable
  if (matchState.cumulativeScores) {
    lines.push(`Cumulative: ${matchState.team1} ${matchState.cumulativeScores.team1} — ${matchState.team2} ${matchState.cumulativeScores.team2}`)
  }

  return lines.join('\n')
}
