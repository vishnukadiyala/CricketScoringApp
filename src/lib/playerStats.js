/**
 * Aggregate player stats across completed matches for a given team.
 * Returns array of player stat objects.
 */
export function aggregatePlayerStats(teamId, teamName, completedMatchStates) {
  const playerMap = {}

  completedMatchStates.forEach(matchState => {
    if (!matchState || !matchState.innings) return

    // Determine if this team was team1 or team2 in this match
    const isTeam1 = matchState.team1 === teamName
    const isTeam2 = matchState.team2 === teamName
    if (!isTeam1 && !isTeam2) return

    const matchPlayers = new Set()

    matchState.innings.forEach(inn => {
      if (!inn) return

      // Batting stats: if this team was batting
      if (inn.battingTeam === teamName) {
        ;(inn.batsmen || []).forEach(bat => {
          if (!bat) return
          if (!playerMap[bat.name]) {
            playerMap[bat.name] = createEmptyStats(bat.name)
          }
          const p = playerMap[bat.name]
          matchPlayers.add(bat.name)

          p.batting.innings++
          p.batting.runs += bat.runs
          p.batting.balls += bat.balls
          p.batting.fours += bat.fours
          p.batting.sixes += bat.sixes
          if (!bat.isOut) p.batting.notOuts++
          if (bat.runs > p.batting.highScore) p.batting.highScore = bat.runs
        })
      }

      // Bowling stats: if this team was bowling
      if (inn.bowlingTeam === teamName) {
        ;(inn.bowlers || []).forEach(bowl => {
          if (!bowl) return
          if (!playerMap[bowl.name]) {
            playerMap[bowl.name] = createEmptyStats(bowl.name)
          }
          const p = playerMap[bowl.name]
          matchPlayers.add(bowl.name)

          p.bowling.innings++
          p.bowling.overs += bowl.overs
          p.bowling.ballsInOver = (p.bowling.ballsInOver || 0) + (bowl.ballsInOver || 0)
          // Carry over extra balls into complete overs
          if (p.bowling.ballsInOver >= 6) {
            p.bowling.overs += Math.floor(p.bowling.ballsInOver / 6)
            p.bowling.ballsInOver = p.bowling.ballsInOver % 6
          }
          p.bowling.maidens += bowl.maidens
          p.bowling.runs += bowl.runs
          p.bowling.wickets += bowl.wickets

          const figures = `${bowl.wickets}/${bowl.runs}`
          if (isBetterFigures(figures, p.bowling.bestFigures)) {
            p.bowling.bestFigures = figures
          }
        })
      }
    })

    // Count match participation
    matchPlayers.forEach(name => {
      playerMap[name].matches++
    })
  })

  // Compute derived stats
  return Object.values(playerMap).map(p => {
    const dismissals = p.batting.innings - p.batting.notOuts
    p.batting.average = dismissals > 0 ? (p.batting.runs / dismissals) : p.batting.runs
    p.batting.sr = p.batting.balls > 0 ? ((p.batting.runs / p.batting.balls) * 100) : 0

    const bowlingBalls = p.bowling.overs * 6 + (p.bowling.ballsInOver || 0)
    p.bowling.economy = bowlingBalls > 0 ? (p.bowling.runs / (bowlingBalls / 6)) : 0

    return p
  })
}

function createEmptyStats(name) {
  return {
    name,
    matches: 0,
    batting: {
      innings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      highScore: 0,
      notOuts: 0,
      average: 0,
      sr: 0,
    },
    bowling: {
      innings: 0,
      overs: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      economy: 0,
      bestFigures: '0/0',
    },
  }
}

function isBetterFigures(a, b) {
  const [aW, aR] = a.split('/').map(Number)
  const [bW, bR] = b.split('/').map(Number)
  if (aW !== bW) return aW > bW
  return aR < bR
}
