import { describe, it, expect } from 'vitest'
import { ballsToOvers, oversToBalls, ballsToDecimalOvers, formatBowlerOvers, computeEconomy } from '../overs'

describe('ballsToOvers', () => {
  it('0 balls → "0.0"', () => {
    expect(ballsToOvers(0)).toBe('0.0')
  })

  it('3 balls → "0.3"', () => {
    expect(ballsToOvers(3)).toBe('0.3')
  })

  it('6 balls → "1.0"', () => {
    expect(ballsToOvers(6)).toBe('1.0')
  })

  it('8 balls → "1.2"', () => {
    expect(ballsToOvers(8)).toBe('1.2')
  })

  it('12 balls → "2.0"', () => {
    expect(ballsToOvers(12)).toBe('2.0')
  })

  it('17 balls → "2.5"', () => {
    expect(ballsToOvers(17)).toBe('2.5')
  })

  it('72 balls → "12.0" (full match innings)', () => {
    expect(ballsToOvers(72)).toBe('12.0')
  })
})

describe('oversToBalls', () => {
  it('"0.0" → 0', () => {
    expect(oversToBalls('0.0')).toBe(0)
  })

  it('"0.3" → 3', () => {
    expect(oversToBalls('0.3')).toBe(3)
  })

  it('"1.0" → 6', () => {
    expect(oversToBalls('1.0')).toBe(6)
  })

  it('"1.2" → 8', () => {
    expect(oversToBalls('1.2')).toBe(8)
  })

  it('"2.5" → 17', () => {
    expect(oversToBalls('2.5')).toBe(17)
  })

  it('"12.0" → 72', () => {
    expect(oversToBalls('12.0')).toBe(72)
  })

  it('handles numeric input', () => {
    expect(oversToBalls(2)).toBe(12)
  })

  it('roundtrips with ballsToOvers', () => {
    for (let balls = 0; balls <= 72; balls++) {
      expect(oversToBalls(ballsToOvers(balls))).toBe(balls)
    }
  })
})

describe('ballsToDecimalOvers', () => {
  it('0 balls → 0', () => {
    expect(ballsToDecimalOvers(0)).toBe(0)
  })

  it('6 balls → 1.0', () => {
    expect(ballsToDecimalOvers(6)).toBe(1)
  })

  it('3 balls → 0.5', () => {
    expect(ballsToDecimalOvers(3)).toBe(0.5)
  })

  it('8 balls → 1.333...', () => {
    expect(ballsToDecimalOvers(8)).toBeCloseTo(1.3333, 3)
  })

  it('negative balls → 0', () => {
    expect(ballsToDecimalOvers(-5)).toBe(0)
  })

  it('72 balls → 12.0', () => {
    expect(ballsToDecimalOvers(72)).toBe(12)
  })
})

describe('formatBowlerOvers', () => {
  it('(0, 0) → "0.0"', () => {
    expect(formatBowlerOvers(0, 0)).toBe('0.0')
  })

  it('(0, 3) → "0.3"', () => {
    expect(formatBowlerOvers(0, 3)).toBe('0.3')
  })

  it('(2, 4) → "2.4"', () => {
    expect(formatBowlerOvers(2, 4)).toBe('2.4')
  })

  it('(3, 0) → "3.0"', () => {
    expect(formatBowlerOvers(3, 0)).toBe('3.0')
  })

  it('handles undefined ballsInOver as 0', () => {
    expect(formatBowlerOvers(1, undefined)).toBe('1.0')
  })
})

describe('computeEconomy', () => {
  it('0 balls → 0 economy', () => {
    expect(computeEconomy(10, 0)).toBe(0)
  })

  it('6 runs in 6 balls → economy 6.0', () => {
    expect(computeEconomy(6, 6)).toBe(6)
  })

  it('15 runs in 3 balls → economy 30.0', () => {
    expect(computeEconomy(15, 3)).toBe(30)
  })

  it('24 runs in 12 balls → economy 12.0', () => {
    expect(computeEconomy(24, 12)).toBe(12)
  })

  it('10 runs in 8 balls → economy 7.5', () => {
    expect(computeEconomy(10, 8)).toBeCloseTo(7.5, 3)
  })

  it('0 runs in 6 balls → economy 0', () => {
    expect(computeEconomy(0, 6)).toBe(0)
  })
})
