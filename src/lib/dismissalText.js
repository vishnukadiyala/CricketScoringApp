/**
 * Format a batsman's dismissal into proper cricket notation.
 *
 * @param {object} batsman - Batsman object with dismissal, fielder, fielder2, isDirectHit
 * @param {string|null} bowlerName - Name of the bowler who took the wicket
 * @returns {string} Formatted dismissal string
 */
export function formatDismissal(batsman, bowlerName) {
  if (!batsman || !batsman.dismissal) return ''

  const type = batsman.dismissal
  const fielder = batsman.fielder || null
  const fielder2 = batsman.fielder2 || null
  const isDirectHit = batsman.isDirectHit || false

  switch (type) {
    case 'caught': {
      if (!fielder) return bowlerName ? `c ? b ${bowlerName}` : 'caught'
      if (fielder === bowlerName) return `c & b ${bowlerName}`
      return `c ${fielder} b ${bowlerName}`
    }

    case 'runOut': {
      if (!fielder) return 'run out (?)'
      if (fielder2) return `run out (${fielder} / ${fielder2})`
      if (isDirectHit) return `run out (${fielder}) [direct hit]`
      return `run out (${fielder})`
    }

    case 'stumped': {
      if (!fielder) return bowlerName ? `st ? b ${bowlerName}` : 'stumped'
      return `st ${fielder} b ${bowlerName}`
    }

    case 'bowled':
      return bowlerName ? `b ${bowlerName}` : 'bowled'

    case 'lbw':
      return bowlerName ? `lbw b ${bowlerName}` : 'lbw'

    case 'hitWicket':
      return bowlerName ? `hit wicket b ${bowlerName}` : 'hit wicket'

    default:
      return type
  }
}
