import { BALLS_PER_OVER, MAX_WICKETS } from './constants'
import { loadMatch } from './storage'
import { getActivePlayerNames, countActivePlayers } from './squadUtils'

// ─── Data Loading ───────────────────────────────────────────────

/**
 * Load all completed match states from localStorage.
 * Returns array of { matchMeta, matchState } objects.
 */
export function loadCompletedMatchData(matches) {
  return matches
    .filter(m => m.status === 'completed')
    .map(m => {
      const state = loadMatch(m.id)
      return state ? { matchMeta: m, matchState: state } : null
    })
    .filter(Boolean)
}

/**
 * Filter match data by stage (league/knockout/all) and team.
 */
export function filterMatchData(data, { stage = 'all', teamId = 'all' } = {}) {
  return data.filter(({ matchMeta }) => {
    if (stage === 'league' && matchMeta.type !== 'league') return false
    if (stage === 'knockout' && matchMeta.type === 'league') return false
    if (teamId !== 'all' && matchMeta.team1Id !== teamId && matchMeta.team2Id !== teamId) return false
    return true
  })
}

// ─── Helpers ────────────────────────────────────────────────────

function isBetterFigures(a, b) {
  const [aW, aR] = a.split('/').map(Number)
  const [bW, bR] = b.split('/').map(Number)
  if (aW !== bW) return aW > bW
  return aR < bR
}

function getTeamKey(matchState, teamName) {
  return teamName === matchState.team1 ? 'team1' : 'team2'
}

function getTeamNameFromId(matchMeta, teams, teamId) {
  const team = teams.find(t => t.id === teamId)
  return team ? team.name : teamId
}

function countDotBalls(allOvers) {
  let dots = 0
  if (!allOvers) return dots
  allOvers.forEach(over => {
    over.forEach(ball => {
      if (ball === '0') dots++
    })
  })
  return dots
}

function parseBallRuns(ball) {
  if (ball === 'W' || ball === '0') return 0
  if (ball.startsWith('Wd')) return 0
  if (ball.startsWith('NB')) return 0
  if (ball.startsWith('B') || ball.startsWith('LB')) return 0
  const n = parseInt(ball, 10)
  return isNaN(n) ? 0 : n
}

function overRunsFromBalls(balls) {
  let runs = 0
  balls.forEach(b => {
    if (b === 'W' || b === '0') return
    if (b.startsWith('Wd')) {
      runs += 1
      const extra = b.replace('Wd+', '').replace('Wd', '')
      if (extra) runs += parseInt(extra, 10) || 0
      return
    }
    if (b.startsWith('NB')) {
      runs += 1
      const extra = b.replace('NB+', '').replace('NB', '')
      if (extra) runs += parseInt(extra, 10) || 0
      return
    }
    if (b.startsWith('B')) {
      runs += parseInt(b.slice(1), 10) || 0
      return
    }
    if (b.startsWith('LB')) {
      runs += parseInt(b.slice(2), 10) || 0
      return
    }
    const n = parseInt(b, 10)
    if (!isNaN(n)) runs += n
  })
  return runs
}

// ─── Batting Stats ──────────────────────────────────────────────

/**
 * Aggregate individual batting stats across all completed matches.
 * Returns array of player batting stat objects.
 */
export function computeBattingLeaderboard(matchData, teams) {
  const playerMap = {}

  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return

    const matchPlayers = new Set()

    matchState.innings.forEach((inn, innIdx) => {
      if (!inn) return

      const battingTeamKey = getTeamKey(matchState, inn.battingTeam)
      const battingTeamId = matchMeta[`${battingTeamKey}Id`]
      const bowlingTeamId = battingTeamKey === 'team1' ? matchMeta.team2Id : matchMeta.team1Id

      ;(inn.batsmen || []).forEach(bat => {
        if (!bat) return
        const key = `${battingTeamId}::${bat.name}`
        if (!playerMap[key]) {
          playerMap[key] = {
            name: bat.name,
            teamId: battingTeamId,
            team: inn.battingTeam,
            matches: 0,
            innings: 0,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            notOuts: 0,
            highScore: 0,
            highScoreNotOut: false,
            thirtyPlus: 0,
            ducks: 0,
            inningsList: [],
          }
        }
        const p = playerMap[key]
        matchPlayers.add(key)

        p.innings++
        p.runs += bat.runs
        p.balls += bat.balls
        p.fours += bat.fours
        p.sixes += bat.sixes
        if (!bat.isOut) p.notOuts++
        if (bat.runs >= 30) p.thirtyPlus++
        if (bat.runs === 0 && bat.isOut && bat.balls > 0) p.ducks++

        if (bat.runs > p.highScore || (bat.runs === p.highScore && !bat.isOut && p.highScoreNotOut === false)) {
          p.highScore = bat.runs
          p.highScoreNotOut = !bat.isOut
        }

        p.inningsList.push({
          runs: bat.runs,
          balls: bat.balls,
          fours: bat.fours,
          sixes: bat.sixes,
          isOut: bat.isOut,
          dismissal: bat.dismissal,
          vs: inn.bowlingTeam,
          matchId: matchMeta.id,
          matchNumber: matchMeta.matchNumber,
          matchType: matchMeta.type,
          inningsNumber: innIdx + 1,
        })
      })
    })

    matchPlayers.forEach(key => {
      playerMap[key].matches++
    })
  })

  return Object.values(playerMap).map(p => {
    const dismissals = p.innings - p.notOuts
    p.average = dismissals > 0 ? p.runs / dismissals : (p.runs > 0 ? Infinity : 0)
    p.strikeRate = p.balls > 0 ? (p.runs / p.balls) * 100 : 0
    return p
  })
}

/**
 * Top run scorers sorted by runs desc, SR desc.
 */
export function getOrangeCapList(battingStats) {
  return [...battingStats].sort((a, b) => {
    if (b.runs !== a.runs) return b.runs - a.runs
    return b.strikeRate - a.strikeRate
  })
}

/**
 * Most fours.
 */
export function getMostFours(battingStats) {
  return [...battingStats].filter(p => p.fours > 0).sort((a, b) => b.fours - a.fours)
}

/**
 * Most sixes.
 */
export function getMostSixes(battingStats) {
  return [...battingStats].filter(p => p.sixes > 0).sort((a, b) => b.sixes - a.sixes)
}

/**
 * Best strike rate (min 10 balls).
 */
export function getBestStrikeRate(battingStats, minBalls = 10) {
  return [...battingStats]
    .filter(p => p.balls >= minBalls)
    .sort((a, b) => b.strikeRate - a.strikeRate)
}

/**
 * Best batting average (min 2 innings).
 */
export function getBestBattingAverage(battingStats, minInnings = 2) {
  return [...battingStats]
    .filter(p => p.innings >= minInnings && p.average > 0)
    .sort((a, b) => {
      if (b.average === Infinity && a.average === Infinity) return b.runs - a.runs
      if (b.average === Infinity) return 1
      if (a.average === Infinity) return -1
      return b.average - a.average
    })
}

/**
 * Highest individual scores.
 */
export function getHighestScores(battingStats) {
  const scores = []
  battingStats.forEach(p => {
    p.inningsList.forEach(inn => {
      scores.push({
        name: p.name,
        team: p.team,
        teamId: p.teamId,
        runs: inn.runs,
        balls: inn.balls,
        fours: inn.fours,
        sixes: inn.sixes,
        isOut: inn.isOut,
        vs: inn.vs,
        matchNumber: inn.matchNumber,
        matchType: inn.matchType,
      })
    })
  })
  return scores.sort((a, b) => {
    if (b.runs !== a.runs) return b.runs - a.runs
    return a.balls - b.balls // fewer balls is better
  })
}

/**
 * Most 30+ scores.
 */
export function getMostThirtyPlus(battingStats) {
  return [...battingStats].filter(p => p.thirtyPlus > 0).sort((a, b) => b.thirtyPlus - a.thirtyPlus)
}

/**
 * Most ducks.
 */
export function getMostDucks(battingStats) {
  return [...battingStats].filter(p => p.ducks > 0).sort((a, b) => b.ducks - a.ducks)
}

// ─── Bowling Stats ──────────────────────────────────────────────

/**
 * Aggregate bowling stats across all completed matches.
 */
export function computeBowlingLeaderboard(matchData) {
  const playerMap = {}

  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return

    const matchPlayers = new Set()

    matchState.innings.forEach((inn, innIdx) => {
      if (!inn) return

      const bowlingTeamKey = getTeamKey(matchState, inn.bowlingTeam)
      const bowlingTeamId = matchMeta[`${bowlingTeamKey}Id`]

      ;(inn.bowlers || []).forEach(bowl => {
        if (!bowl) return
        const key = `${bowlingTeamId}::${bowl.name}`
        if (!playerMap[key]) {
          playerMap[key] = {
            name: bowl.name,
            teamId: bowlingTeamId,
            team: inn.bowlingTeam,
            matches: 0,
            inningsBowled: 0,
            overs: 0,
            balls: 0,
            maidens: 0,
            runs: 0,
            wickets: 0,
            dotBalls: 0,
            bestFigures: '0/0',
            bestFiguresVs: '',
            bestFiguresMatch: 0,
            wides: 0,
            noBalls: 0,
            figuresList: [],
          }
        }
        const p = playerMap[key]
        matchPlayers.add(key)

        p.inningsBowled++
        p.overs += bowl.overs
        p.balls += bowl.overs * BALLS_PER_OVER + bowl.ballsInOver
        p.maidens += bowl.maidens
        p.runs += bowl.runs
        p.wickets += bowl.wickets

        const figures = `${bowl.wickets}/${bowl.runs}`
        if (isBetterFigures(figures, p.bestFigures)) {
          p.bestFigures = figures
          p.bestFiguresVs = inn.battingTeam
          p.bestFiguresMatch = matchMeta.matchNumber
        }

        p.figuresList.push({
          figures,
          overs: bowl.overs,
          maidens: bowl.maidens,
          runs: bowl.runs,
          wickets: bowl.wickets,
          vs: inn.battingTeam,
          matchId: matchMeta.id,
          matchNumber: matchMeta.matchNumber,
          matchType: matchMeta.type,
          inningsNumber: innIdx + 1,
        })
      })

      // Count dot balls from allOvers for bowlers on this team
      // We attribute dots at innings level since we can't link overs to specific bowlers
      // from allOvers alone — instead track at bowler level from ball display
    })

    // Count dot balls per bowler from allOvers data
    matchState.innings.forEach(inn => {
      if (!inn || !inn.allOvers) return
      const bowlingTeamKey = getTeamKey(matchState, inn.bowlingTeam)
      const bowlingTeamId = matchMeta[`${bowlingTeamKey}Id`]

      // We can't easily map individual over balls to specific bowlers from allOvers,
      // so we count total dots per innings and attribute proportionally to overs bowled.
      // Better approach: count from bowler's overs directly using bowlerOversMap and allOvers order.
      // For now, use allOvers total.
    })

    matchPlayers.forEach(key => {
      playerMap[key].matches++
    })
  })

  // Count dot balls and extras from allOvers at innings level
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return
    matchState.innings.forEach(inn => {
      if (!inn) return
      const bowlingTeamKey = getTeamKey(matchState, inn.bowlingTeam)
      const bowlingTeamId = matchMeta[`${bowlingTeamKey}Id`]

      // Aggregate extras for all bowlers on this team
      // We can distribute wides/noBalls from inn.extras
      // But we can't attribute per-bowler from here — use bowler-level data if available
    })
  })

  // For dot balls, count from allOvers per innings total and assign to the team's bowlers
  // Simple approach: count dots and extras at innings level
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return
    matchState.innings.forEach(inn => {
      if (!inn || !inn.allOvers) return
      const bowlingTeamKey = getTeamKey(matchState, inn.bowlingTeam)
      const bowlingTeamId = matchMeta[`${bowlingTeamKey}Id`]

      let totalDots = 0
      let totalWides = 0
      let totalNoBalls = 0
      inn.allOvers.forEach(over => {
        over.forEach(ball => {
          if (ball === '0') totalDots++
          if (ball.startsWith('Wd')) totalWides++
          if (ball.startsWith('NB')) totalNoBalls++
        })
      })
      // Also count current over
      if (inn.currentOver) {
        inn.currentOver.forEach(ball => {
          if (ball === '0') totalDots++
          if (ball.startsWith('Wd')) totalWides++
          if (ball.startsWith('NB')) totalNoBalls++
        })
      }

      // Distribute dots proportionally by overs bowled
      const bowlersOnTeam = (inn.bowlers || []).filter(Boolean)
      const totalOvers = bowlersOnTeam.reduce((s, b) => s + b.overs, 0)
      bowlersOnTeam.forEach(bowl => {
        const key = `${bowlingTeamId}::${bowl.name}`
        const p = playerMap[key]
        if (!p) return
        // Proportional dot balls
        if (totalOvers > 0) {
          p.dotBalls += Math.round(totalDots * (bowl.overs / totalOvers))
        }
      })

      // Extras: wides and no-balls from inn.extras (more accurate)
      if (inn.extras) {
        // We can't attribute extras per-bowler, so distribute evenly as a team stat
        // For individual leaderboards, use innings extras total per team
      }
    })
  })

  return Object.values(playerMap).map(p => {
    p.economy = p.overs > 0 ? p.runs / p.overs : 0
    p.bowlingAverage = p.wickets > 0 ? p.runs / p.wickets : Infinity
    p.bowlingStrikeRate = p.wickets > 0 ? p.balls / p.wickets : Infinity
    return p
  })
}

/**
 * Top wicket takers: wickets desc, economy asc.
 */
export function getPurpleCapList(bowlingStats) {
  return [...bowlingStats].sort((a, b) => {
    if (b.wickets !== a.wickets) return b.wickets - a.wickets
    return a.economy - b.economy
  })
}

/**
 * Best economy (min 6 overs).
 */
export function getBestEconomy(bowlingStats, minOvers = 6) {
  return [...bowlingStats]
    .filter(p => p.overs >= minOvers)
    .sort((a, b) => a.economy - b.economy)
}

/**
 * Best bowling figures in an innings.
 */
export function getBestBowlingFigures(bowlingStats) {
  const figures = []
  bowlingStats.forEach(p => {
    p.figuresList.forEach(f => {
      figures.push({
        name: p.name,
        team: p.team,
        teamId: p.teamId,
        figures: f.figures,
        wickets: f.wickets,
        runs: f.runs,
        overs: f.overs,
        vs: f.vs,
        matchNumber: f.matchNumber,
        matchType: f.matchType,
      })
    })
  })
  return figures.sort((a, b) => {
    if (b.wickets !== a.wickets) return b.wickets - a.wickets
    return a.runs - b.runs
  })
}

/**
 * Most dot balls.
 */
export function getMostDotBalls(bowlingStats) {
  return [...bowlingStats].filter(p => p.dotBalls > 0).sort((a, b) => b.dotBalls - a.dotBalls)
}

/**
 * Most maidens.
 */
export function getMostMaidens(bowlingStats) {
  return [...bowlingStats].filter(p => p.maidens > 0).sort((a, b) => b.maidens - a.maidens)
}

/**
 * Most expensive over across all matches.
 */
export function getMostExpensiveOvers(matchData) {
  const overs = []
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return
    matchState.innings.forEach(inn => {
      if (!inn || !inn.allOvers) return
      inn.allOvers.forEach((overBalls, overIdx) => {
        const runs = overRunsFromBalls(overBalls)
        overs.push({
          bowlingTeam: inn.bowlingTeam,
          vs: inn.battingTeam,
          overNumber: overIdx + 1,
          runs,
          balls: overBalls.join(' '),
          matchNumber: matchMeta.matchNumber,
          matchType: matchMeta.type,
        })
      })
    })
  })
  return overs.sort((a, b) => b.runs - a.runs)
}

// ─── Fielding Stats ─────────────────────────────────────────────

/**
 * Compute fielding stats from fall-of-wickets dismissal data.
 * NOTE: Current data model only stores dismissal type, not fielder name.
 * We can count dismissal types per innings but can't attribute to fielders.
 * This returns team-level fielding stats.
 */
export function computeFieldingStats(matchData) {
  const teamMap = {}

  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return

    matchState.innings.forEach(inn => {
      if (!inn) return
      const bowlingTeamKey = getTeamKey(matchState, inn.bowlingTeam)
      const bowlingTeamId = matchMeta[`${bowlingTeamKey}Id`]

      if (!teamMap[bowlingTeamId]) {
        teamMap[bowlingTeamId] = {
          teamId: bowlingTeamId,
          team: inn.bowlingTeam,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
          bowled: 0,
          lbw: 0,
        }
      }

      const t = teamMap[bowlingTeamId]
      ;(inn.batsmen || []).forEach(bat => {
        if (!bat || !bat.isOut) return
        switch (bat.dismissal) {
          case 'caught': t.catches++; break
          case 'runOut': t.runOuts++; break
          case 'stumped': t.stumpings++; break
          case 'bowled': t.bowled++; break
          case 'lbw': t.lbw++; break
        }
      })
    })
  })

  return Object.values(teamMap)
}

// ─── Team Stats ─────────────────────────────────────────────────

/**
 * Compute team-level batting and bowling stats.
 */
export function computeTeamStats(matchData, teams) {
  const teamMap = {}

  teams.forEach(team => {
    teamMap[team.id] = {
      teamId: team.id,
      team: team.name,
      matches: 0,
      // Batting
      totalRuns: 0,
      totalInnings: 0,
      highestTotal: { runs: 0, overs: '', vs: '', matchNumber: 0, wickets: 0 },
      lowestTotal: { runs: Infinity, overs: '', vs: '', matchNumber: 0, wickets: 0 },
      totalFours: 0,
      totalSixes: 0,
      // Bowling
      totalWicketsTaken: 0,
      totalBowlingInnings: 0,
      bestBowlingInnings: { wickets: 0, runs: 0, vs: '', matchNumber: 0 },
      totalDotBalls: 0,
      // Extras
      totalWides: 0,
      totalNoBalls: 0,
      totalByes: 0,
      totalLegByes: 0,
    }
  })

  const matchesPlayed = new Set()

  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return

    // Track matches per team
    ;[matchMeta.team1Id, matchMeta.team2Id].forEach(tid => {
      const key = `${tid}::${matchMeta.id}`
      if (!matchesPlayed.has(key) && teamMap[tid]) {
        matchesPlayed.add(key)
        teamMap[tid].matches++
      }
    })

    matchState.innings.forEach(inn => {
      if (!inn) return

      const battingTeamKey = getTeamKey(matchState, inn.battingTeam)
      const battingTeamId = matchMeta[`${battingTeamKey}Id`]
      const bowlingTeamKey = getTeamKey(matchState, inn.bowlingTeam)
      const bowlingTeamId = matchMeta[`${bowlingTeamKey}Id`]

      // Batting stats for batting team
      const bt = teamMap[battingTeamId]
      if (bt) {
        bt.totalRuns += inn.totalRuns
        bt.totalInnings++
        bt.totalFours += inn.fours || 0
        bt.totalSixes += inn.sixes || 0

        const oversStr = `${inn.oversCompleted}.${inn.ballsInCurrentOver}`
        if (inn.totalRuns > bt.highestTotal.runs) {
          bt.highestTotal = { runs: inn.totalRuns, overs: oversStr, vs: inn.bowlingTeam, matchNumber: matchMeta.matchNumber, wickets: inn.wickets }
        }
        if (inn.totalRuns < bt.lowestTotal.runs) {
          bt.lowestTotal = { runs: inn.totalRuns, overs: oversStr, vs: inn.bowlingTeam, matchNumber: matchMeta.matchNumber, wickets: inn.wickets }
        }
      }

      // Bowling stats for bowling team
      const bwt = teamMap[bowlingTeamId]
      if (bwt) {
        bwt.totalWicketsTaken += inn.wickets
        bwt.totalBowlingInnings++

        if (inn.wickets > bwt.bestBowlingInnings.wickets ||
            (inn.wickets === bwt.bestBowlingInnings.wickets && inn.totalRuns < bwt.bestBowlingInnings.runs)) {
          bwt.bestBowlingInnings = { wickets: inn.wickets, runs: inn.totalRuns, vs: inn.battingTeam, matchNumber: matchMeta.matchNumber }
        }

        // Dot balls
        if (inn.allOvers) {
          inn.allOvers.forEach(over => {
            over.forEach(ball => { if (ball === '0') bwt.totalDotBalls++ })
          })
        }

        // Extras conceded by bowling team
        if (inn.extras) {
          bwt.totalWides += inn.extras.wides || 0
          bwt.totalNoBalls += inn.extras.noBalls || 0
          bwt.totalByes += inn.extras.byes || 0
          bwt.totalLegByes += inn.extras.legByes || 0
        }
      }
    })
  })

  // Compute averages
  return Object.values(teamMap).map(t => {
    t.battingAvgPerInnings = t.totalInnings > 0 ? (t.totalRuns / t.totalInnings) : 0
    t.bowlingAvgPerInnings = t.totalBowlingInnings > 0 ? (t.totalWicketsTaken / t.totalBowlingInnings) : 0
    if (t.lowestTotal.runs === Infinity) {
      t.lowestTotal = { runs: 0, overs: '0.0', vs: '-', matchNumber: 0, wickets: 0 }
    }
    return t
  })
}

/**
 * Highest team totals.
 */
export function getHighestTeamTotals(matchData) {
  const totals = []
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return
    matchState.innings.forEach(inn => {
      if (!inn) return
      totals.push({
        team: inn.battingTeam,
        runs: inn.totalRuns,
        wickets: inn.wickets,
        overs: `${inn.oversCompleted}.${inn.ballsInCurrentOver}`,
        vs: inn.bowlingTeam,
        matchNumber: matchMeta.matchNumber,
        matchType: matchMeta.type,
      })
    })
  })
  return totals.sort((a, b) => b.runs - a.runs)
}

/**
 * Lowest team totals.
 */
export function getLowestTeamTotals(matchData) {
  const totals = getHighestTeamTotals(matchData)
  return totals.sort((a, b) => a.runs - b.runs)
}

/**
 * Biggest wins by runs (cumulative margin).
 */
export function getBiggestWins(matchData, teams) {
  const wins = []
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.result) return
    // Extract margin from result string
    const runMatch = matchState.result.match(/won by (\d+) run/)
    if (runMatch) {
      const margin = parseInt(runMatch[1], 10)
      const winnerName = matchState.result.split(' won')[0]
      wins.push({
        winner: winnerName,
        margin,
        vs: winnerName === matchState.team1 ? matchState.team2 : matchState.team1,
        matchNumber: matchMeta.matchNumber,
        matchType: matchMeta.type,
        result: matchState.result,
      })
    }
  })
  return wins.sort((a, b) => b.margin - a.margin)
}

// ─── Match & Tournament Records ─────────────────────────────────

/**
 * Highest match aggregate (all 4 innings combined).
 */
export function getHighestMatchAggregates(matchData) {
  return matchData.map(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return null
    const totalRuns = matchState.innings.reduce((sum, inn) => sum + (inn ? inn.totalRuns : 0), 0)
    return {
      team1: matchState.team1,
      team2: matchState.team2,
      totalRuns,
      matchNumber: matchMeta.matchNumber,
      matchType: matchMeta.type,
    }
  }).filter(Boolean).sort((a, b) => b.totalRuns - a.totalRuns)
}

/**
 * Closest matches (smallest winning margin).
 */
export function getClosestMatches(matchData) {
  const results = []
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.result) return
    const runMatch = matchState.result.match(/won by (\d+) run/)
    if (runMatch) {
      results.push({
        team1: matchState.team1,
        team2: matchState.team2,
        margin: parseInt(runMatch[1], 10),
        result: matchState.result,
        matchNumber: matchMeta.matchNumber,
        matchType: matchMeta.type,
      })
    }
    if (matchState.result.includes('Super Over') || matchState.result.includes('boundary count')) {
      results.push({
        team1: matchState.team1,
        team2: matchState.team2,
        margin: 0,
        result: matchState.result,
        matchNumber: matchMeta.matchNumber,
        matchType: matchMeta.type,
      })
    }
  })
  return results.sort((a, b) => a.margin - b.margin)
}

/**
 * Most extras in an innings.
 */
export function getMostExtrasInInnings(matchData) {
  const results = []
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.innings) return
    matchState.innings.forEach(inn => {
      if (!inn || !inn.extras) return
      const total = (inn.extras.wides || 0) + (inn.extras.noBalls || 0) +
                    (inn.extras.byes || 0) + (inn.extras.legByes || 0)
      results.push({
        bowlingTeam: inn.bowlingTeam,
        battingTeam: inn.battingTeam,
        total,
        wides: inn.extras.wides || 0,
        noBalls: inn.extras.noBalls || 0,
        byes: inn.extras.byes || 0,
        legByes: inn.extras.legByes || 0,
        matchNumber: matchMeta.matchNumber,
        matchType: matchMeta.type,
      })
    })
  })
  return results.sort((a, b) => b.total - a.total)
}

/**
 * Follow-on stats.
 */
export function getFollowOnStats(matchData) {
  let total = 0
  const details = []
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState) return
    if (matchState.followOnEnforced) {
      total++
      details.push({
        team1: matchState.team1,
        team2: matchState.team2,
        result: matchState.result,
        matchNumber: matchMeta.matchNumber,
      })
    }
  })
  return { total, details }
}

/**
 * Super over records.
 */
export function getSuperOverRecords(matchData) {
  const records = []
  matchData.forEach(({ matchMeta, matchState }) => {
    if (!matchState || !matchState.superOver) return
    const so = matchState.superOver
    records.push({
      team1: matchState.team1,
      team2: matchState.team2,
      battingFirst: so.battingFirst,
      battingSecond: so.battingSecond,
      innings1Runs: so.innings1?.runs ?? 0,
      innings2Runs: so.innings2?.runs ?? 0,
      result: matchState.result,
      matchNumber: matchMeta.matchNumber,
    })
  })
  return records
}

// ─── Participation Tracker ──────────────────────────────────────

/**
 * Compute participation per player per team.
 */
export function computeParticipation(matchData, teams) {
  const result = {}

  teams.forEach(team => {
    const totalMatches = matchData.filter(({ matchMeta }) =>
      matchMeta.team1Id === team.id || matchMeta.team2Id === team.id
    ).length

    const playerMatches = {}
    const activeNames = getActivePlayerNames(team.squad)
    activeNames.forEach(name => {
      playerMatches[name] = 0
    })

    matchData.forEach(({ matchMeta, matchState }) => {
      if (!matchState || !matchState.innings) return
      const isTeam1 = matchMeta.team1Id === team.id
      const isTeam2 = matchMeta.team2Id === team.id
      if (!isTeam1 && !isTeam2) return

      const played = new Set()
      matchState.innings.forEach(inn => {
        if (!inn) return
        if (inn.battingTeam === team.name) {
          ;(inn.batsmen || []).forEach(b => { if (b) played.add(b.name) })
        }
        if (inn.bowlingTeam === team.name) {
          ;(inn.bowlers || []).forEach(b => { if (b) played.add(b.name) })
        }
      })

      played.forEach(name => {
        if (playerMatches[name] !== undefined) {
          playerMatches[name]++
        } else {
          playerMatches[name] = 1
        }
      })
    })

    const uniquePlayers = Object.values(playerMatches).filter(v => v > 0).length
    const avgSubs = matchData.filter(({ matchMeta }) =>
      matchMeta.team1Id === team.id || matchMeta.team2Id === team.id
    ).reduce((sum, { matchState }) => {
      if (!matchState || !matchState.substitutions) return sum
      const teamKey = matchState.team1 === team.name ? 'team1' : 'team2'
      return sum + (matchState.substitutions[teamKey]?.length || 0)
    }, 0) / (totalMatches || 1)

    const activeCount = countActivePlayers(team.squad)
    result[team.id] = {
      teamId: team.id,
      team: team.name,
      totalMatches,
      squad: activeNames,
      playerMatches,
      uniquePlayers,
      squadUtilization: activeCount > 0 ? (uniquePlayers / activeCount) * 100 : 0,
      avgSubstitutionsPerMatch: avgSubs,
    }
  })

  return result
}
