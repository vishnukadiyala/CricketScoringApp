/**
 * Returns a CSS class name for a ball display string.
 * Used by ScoreDisplay, OverSummary, and SuperOver components.
 */
export function getBallClass(ball) {
  if (ball === 'W') return 'wicket'
  if (ball === '4') return 'four'
  if (ball === '6') return 'six'
  if (ball === '0') return 'dot'
  if (ball.startsWith('Wd') || ball.startsWith('NB')) return 'extra'
  return ''
}

/**
 * Calculates total runs from an array of ball display strings (one over).
 *
 * Expected ball formats (produced by MatchContext SCORE_BALL):
 *   "0"-"6"  — normal runs off the bat
 *   "W"      — wicket (0 runs)
 *   "Wd"     — wide, no additional runs
 *   "Wd+N"   — wide with N additional runs
 *   "NB"     — no-ball, no additional runs
 *   "NB+N"   — no-ball with N additional runs
 *   "BN"     — bye with N runs  (e.g. "B2")
 *   "LBN"    — leg-bye with N runs (e.g. "LB3")
 */
export function calculateOverRuns(over) {
  return over.reduce((sum, ball) => {
    if (ball === 'W' || ball === '0') return sum

    // Wides: 1 penalty + optional additional runs after '+'
    if (ball.startsWith('Wd')) {
      const plusIdx = ball.indexOf('+')
      const extra = plusIdx !== -1 ? (parseInt(ball.slice(plusIdx + 1), 10) || 0) : 0
      return sum + 1 + extra
    }

    // No-balls: 1 penalty + optional additional runs after '+'
    if (ball.startsWith('NB')) {
      const plusIdx = ball.indexOf('+')
      const extra = plusIdx !== -1 ? (parseInt(ball.slice(plusIdx + 1), 10) || 0) : 0
      return sum + 1 + extra
    }

    // Leg-byes: strip "LB" prefix, parse remaining digits
    if (ball.startsWith('LB')) {
      return sum + (parseInt(ball.slice(2), 10) || 0)
    }

    // Byes: strip "B" prefix, parse remaining digits
    if (ball.startsWith('B')) {
      return sum + (parseInt(ball.slice(1), 10) || 0)
    }

    // Normal runs
    const num = parseInt(ball, 10)
    return sum + (isNaN(num) ? 0 : num)
  }, 0)
}
