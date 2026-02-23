import { BALLS_PER_OVER } from './constants'

/**
 * Convert total balls to cricket overs notation string (e.g., 3 → "0.3", 8 → "1.2", 12 → "2.0").
 * Cricket notation: X.Y where X = complete overs, Y = remaining balls (0–5).
 */
export function ballsToOvers(totalBalls) {
  const completeOvers = Math.floor(totalBalls / BALLS_PER_OVER)
  const remainingBalls = totalBalls % BALLS_PER_OVER
  return `${completeOvers}.${remainingBalls}`
}

/**
 * Convert cricket overs notation string back to total balls (e.g., "1.3" → 9, "2.0" → 12).
 */
export function oversToBalls(oversStr) {
  const parts = String(oversStr).split('.')
  const completeOvers = parseInt(parts[0], 10) || 0
  const remainingBalls = parseInt(parts[1], 10) || 0
  return completeOvers * BALLS_PER_OVER + remainingBalls
}

/**
 * Convert total balls to decimal overs for mathematical calculations (e.g., 8 → 1.333...).
 * Use this for economy rate, NRR, and other arithmetic — NOT for display.
 */
export function ballsToDecimalOvers(totalBalls) {
  if (totalBalls <= 0) return 0
  return totalBalls / BALLS_PER_OVER
}

/**
 * Format a bowler's overs from their overs (complete) and ballsInOver fields.
 * e.g., (2, 3) → "2.3", (0, 0) → "0.0"
 */
export function formatBowlerOvers(overs, ballsInOver) {
  return `${overs}.${ballsInOver || 0}`
}

/**
 * Compute economy rate from runs and total balls bowled.
 * Returns runs per over (6 balls). Returns 0 if no balls bowled.
 */
export function computeEconomy(runs, totalBalls) {
  const decimalOvers = ballsToDecimalOvers(totalBalls)
  return decimalOvers > 0 ? runs / decimalOvers : 0
}
