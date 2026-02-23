import { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import {
  MAX_OVERS_PER_BOWLER, MAX_WICKETS, BALLS_PER_OVER,
  FOLLOW_ON_THRESHOLD, MAX_UNDO_HISTORY,
  SUPER_OVER_WICKETS,
} from '../lib/constants'

const MatchContext = createContext()

const createBatsman = (name) => ({
  name,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  isOut: false,
  dismissal: '',
})

const createBowler = (name) => ({
  name,
  overs: 0,
  ballsInOver: 0,
  maidens: 0,
  runs: 0,
  wickets: 0,
})

const createInnings = (battingTeam, bowlingTeam, inningsNumber) => ({
  battingTeam,
  bowlingTeam,
  inningsNumber,
  totalRuns: 0,
  wickets: 0,
  oversCompleted: 0,
  ballsInCurrentOver: 0,
  currentOver: [],
  allOvers: [],
  batsmen: [],
  activeBatsmanIndex: 0,
  nonStrikerIndex: 1,
  bowlers: [],
  currentBowlerIndex: -1,
  extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
  fallOfWickets: [],
  fours: 0,
  sixes: 0,
  bowlerOversMap: {},
})

const initialState = {
  phase: 'setup',
  // setup | toss | select-xi | batting-order | scoring | new-bowler
  // innings-break | follow-on-decision | squad-rotation | match-over | super-over
  team1: '',
  team2: '',
  oversPerInnings: 12,
  tossWinner: '',
  tossDecision: '',
  innings: [null, null, null, null],
  currentInnings: 0,
  inningsOrder: [],
  squads: { team1: [], team2: [] },
  activeRosters: { team1: [], team2: [] },
  cumulativeScores: { team1: 0, team2: 0 },
  cumulativeBoundaries: {
    team1: { fours: 0, sixes: 0 },
    team2: { fours: 0, sixes: 0 },
  },
  followOnEnforced: false,
  superOver: null,
  superOverHistory: [],
  substitutions: { team1: [], team2: [] },
  target: null,
  result: '',
  // Ball history for undo — stores snapshots before each SCORE_BALL
  ballHistory: [],
  // Track last ball as no-ball for free hit
  lastBallWasNoBall: false,
  // Innings timer: { [inningsIndex]: startTime }
  inningsTimers: {},
}

function getTeamKey(state, teamName) {
  return teamName === state.team1 ? 'team1' : 'team2'
}

function getRunRate(runs, overs, balls) {
  const totalBalls = overs * BALLS_PER_OVER + balls
  if (totalBalls === 0) return '0.00'
  return ((runs / totalBalls) * BALLS_PER_OVER).toFixed(2)
}

function getRequiredRunRate(target, currentRuns, totalOvers, oversCompleted, ballsInOver) {
  const remainingRuns = target - currentRuns
  if (remainingRuns <= 0) return null // target already chased
  const totalBallsRemaining = (totalOvers * BALLS_PER_OVER) - (oversCompleted * BALLS_PER_OVER + ballsInOver)
  if (totalBallsRemaining <= 0) return null // overs finished
  return ((remainingRuns / totalBallsRemaining) * BALLS_PER_OVER).toFixed(2)
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Exported for testing
export { initialState, createBatsman, createBowler, createInnings, getRunRate, getRequiredRunRate }

export function matchReducer(state, action) {
  switch (action.type) {
    case 'SET_TEAMS': {
      return {
        ...state,
        team1: action.team1,
        team2: action.team2,
        oversPerInnings: action.oversPerInnings,
        squads: {
          team1: action.squad1,
          team2: action.squad2,
        },
        phase: 'toss',
      }
    }

    case 'SET_TOSS': {
      const { winner, decision } = action
      const battingFirst = decision === 'bat' ? winner : (winner === state.team1 ? state.team2 : state.team1)
      const bowlingFirst = battingFirst === state.team1 ? state.team2 : state.team1
      const inningsOrder = [battingFirst, bowlingFirst, battingFirst, bowlingFirst]
      return {
        ...state,
        tossWinner: winner,
        tossDecision: decision,
        inningsOrder,
        phase: 'select-xi',
      }
    }

    case 'SET_PLAYING_XI': {
      const { team1XI, team2XI } = action
      const inningsOrder = state.inningsOrder
      return {
        ...state,
        activeRosters: {
          team1: team1XI.map(name => ({ name, substituted: false })),
          team2: team2XI.map(name => ({ name, substituted: false })),
        },
        innings: [
          createInnings(inningsOrder[0], inningsOrder[1], 1),
          createInnings(inningsOrder[1], inningsOrder[0], 2),
          createInnings(inningsOrder[2], inningsOrder[3], 3),
          createInnings(inningsOrder[3], inningsOrder[2], 4),
        ],
        currentInnings: 0,
        phase: 'batting-order',
      }
    }

    case 'SET_OPENERS': {
      const { batsman1, batsman2, bowler } = action
      const newInnings = [...state.innings]
      const inn = { ...newInnings[state.currentInnings] }
      inn.batsmen = [createBatsman(batsman1), createBatsman(batsman2)]
      inn.bowlers = [createBowler(bowler)]
      inn.currentBowlerIndex = 0
      inn.activeBatsmanIndex = 0
      inn.nonStrikerIndex = 1
      newInnings[state.currentInnings] = inn
      return {
        ...state,
        innings: newInnings,
        phase: 'scoring',
        inningsTimers: {
          ...state.inningsTimers,
          [state.currentInnings]: state.inningsTimers[state.currentInnings] || Date.now(),
        },
        lastBallWasNoBall: false,
      }
    }

    case 'SCORE_BALL': {
      // eslint-disable-next-line no-unused-vars
      const { runType, runs, extraType, wicket, dismissalType, newBatsman } = action
      // Save snapshot for undo (keep last 20 max)
      const snapshot = {
        innings: structuredClone(state.innings),
        phase: state.phase,
        cumulativeScores: { ...state.cumulativeScores },
        cumulativeBoundaries: structuredClone(state.cumulativeBoundaries),
        target: state.target,
        result: state.result,
        lastBallWasNoBall: state.lastBallWasNoBall,
      }
      const newHistory = [...state.ballHistory, snapshot].slice(-MAX_UNDO_HISTORY)
      const newInnings = [...state.innings]
      let inn = structuredClone(newInnings[state.currentInnings])
      const striker = inn.batsmen[inn.activeBatsmanIndex]
      const bowler = inn.bowlers[inn.currentBowlerIndex]
      let isLegalDelivery = true
      let ballDisplay = ''
      let runsScored = runs || 0

      // Handle extras
      if (extraType === 'wide') {
        isLegalDelivery = false
        inn.totalRuns += 1 + runsScored
        inn.extras.wides += 1
        bowler.runs += 1 + runsScored
        ballDisplay = runsScored > 0 ? `Wd+${runsScored}` : 'Wd'
        if (runsScored % 2 === 1) {
          [inn.activeBatsmanIndex, inn.nonStrikerIndex] = [inn.nonStrikerIndex, inn.activeBatsmanIndex]
        }
      } else if (extraType === 'noBall') {
        isLegalDelivery = false
        inn.totalRuns += 1 + runsScored
        inn.extras.noBalls += 1
        bowler.runs += 1 + runsScored
        if (runType === 'bat') {
          striker.runs += runsScored
          striker.balls += 1
          if (runsScored === 4) { striker.fours++; inn.fours++ }
          if (runsScored === 6) { striker.sixes++; inn.sixes++ }
        }
        ballDisplay = runsScored > 0 ? `NB+${runsScored}` : 'NB'
        if (runsScored % 2 === 1) {
          [inn.activeBatsmanIndex, inn.nonStrikerIndex] = [inn.nonStrikerIndex, inn.activeBatsmanIndex]
        }
      } else if (extraType === 'bye') {
        inn.totalRuns += runsScored
        inn.extras.byes += runsScored
        striker.balls += 1
        ballDisplay = `B${runsScored}`
        if (runsScored % 2 === 1) {
          [inn.activeBatsmanIndex, inn.nonStrikerIndex] = [inn.nonStrikerIndex, inn.activeBatsmanIndex]
        }
      } else if (extraType === 'legBye') {
        inn.totalRuns += runsScored
        inn.extras.legByes += runsScored
        striker.balls += 1
        ballDisplay = `LB${runsScored}`
        if (runsScored % 2 === 1) {
          [inn.activeBatsmanIndex, inn.nonStrikerIndex] = [inn.nonStrikerIndex, inn.activeBatsmanIndex]
        }
      } else {
        // Normal runs
        inn.totalRuns += runsScored
        striker.runs += runsScored
        striker.balls += 1
        bowler.runs += runsScored
        if (runsScored === 4) { striker.fours++; inn.fours++ }
        if (runsScored === 6) { striker.sixes++; inn.sixes++ }
        ballDisplay = runsScored.toString()
        if (runsScored % 2 === 1) {
          [inn.activeBatsmanIndex, inn.nonStrikerIndex] = [inn.nonStrikerIndex, inn.activeBatsmanIndex]
        }
      }

      // Handle wicket
      if (wicket) {
        inn.wickets += 1
        bowler.wickets += (dismissalType !== 'runOut' ? 1 : 0)
        const isNonStrikerOut = dismissalType === 'runOut' && action.runOutBatsman === 'nonStriker'
        const dismissedIdx = isNonStrikerOut ? inn.nonStrikerIndex : inn.activeBatsmanIndex
        const dismissedBatsman = inn.batsmen[dismissedIdx]
        dismissedBatsman.isOut = true
        dismissedBatsman.dismissal = dismissalType
        ballDisplay = 'W'

        inn.fallOfWickets.push({
          batsmanName: dismissedBatsman.name,
          runs: inn.totalRuns,
          wickets: inn.wickets,
          overs: `${inn.oversCompleted}.${inn.ballsInCurrentOver + (isLegalDelivery ? 1 : 0)}`,
        })

        if (inn.wickets < MAX_WICKETS && newBatsman) {
          const newBatsmanObj = createBatsman(newBatsman)
          inn.batsmen.push(newBatsmanObj)
          const newIdx = inn.batsmen.length - 1
          if (dismissedIdx === inn.activeBatsmanIndex) {
            inn.activeBatsmanIndex = newIdx
          } else {
            inn.nonStrikerIndex = newIdx
          }
        }
      }

      // Track the ball in the current over
      inn.currentOver.push(ballDisplay)

      // Handle legal delivery — update over count
      if (isLegalDelivery) {
        inn.ballsInCurrentOver += 1
        bowler.ballsInOver += 1

        // End of over
        if (inn.ballsInCurrentOver === BALLS_PER_OVER) {
          inn.oversCompleted += 1
          bowler.overs += 1

          // Track bowler overs map
          inn.bowlerOversMap[bowler.name] = (inn.bowlerOversMap[bowler.name] || 0) + 1

          // Check for maiden — only runs off the bat break a maiden.
          // Wides, no-balls, byes, and leg-byes do NOT break a maiden
          // (they are extras, not charged as runs off the bat).
          const maidenBroken = inn.currentOver.some(b => {
            if (b === 'W' || b === '0') return false
            if (b.startsWith('Wd') || b.startsWith('NB')) return false // extras don't break maiden
            if (b.startsWith('B') || b.startsWith('LB')) return false // byes/leg-byes don't
            const num = parseInt(b, 10)
            return !isNaN(num) && num > 0 // runs off bat break maiden
          })
          if (!maidenBroken) {
            bowler.maidens += 1
          }

          inn.allOvers.push([...inn.currentOver])
          inn.currentOver = []
          inn.ballsInCurrentOver = 0
          bowler.ballsInOver = 0

          // Rotate strike at end of over (skip if all out — no valid batters left)
          if (inn.wickets < MAX_WICKETS) {
            [inn.activeBatsmanIndex, inn.nonStrikerIndex] = [inn.nonStrikerIndex, inn.activeBatsmanIndex]
          }
        }
      }

      newInnings[state.currentInnings] = inn

      // Check if innings is over
      let newPhase = state.phase
      let result = state.result
      let target = state.target
      let newCumulativeScores = { ...state.cumulativeScores }
      let newCumulativeBoundaries = structuredClone(state.cumulativeBoundaries)

      const allOut = inn.wickets >= MAX_WICKETS
      const oversFinished = inn.oversCompleted >= state.oversPerInnings
      const battingTeamKey = getTeamKey(state, inn.battingTeam)
      const bowlingTeamKey = getTeamKey(state, inn.bowlingTeam)

      // 4th innings early finish: batting team's cumulative > fielding team's cumulative
      const liveCumulativeBatting = state.cumulativeScores[battingTeamKey] + inn.totalRuns
      const fieldingCumulative = state.cumulativeScores[bowlingTeamKey]
      const isFourthInnings = state.currentInnings === 3
      const targetChased4th = isFourthInnings && liveCumulativeBatting > fieldingCumulative

      // If over just ended and match continues, need new bowler
      if (isLegalDelivery && inn.ballsInCurrentOver === 0 && inn.oversCompleted > 0
          && !allOut && !oversFinished && !targetChased4th) {
        newPhase = 'new-bowler'
      }

      const inningsEnded = allOut || oversFinished || targetChased4th

      if (inningsEnded) {
        // Update cumulative scores and boundaries
        newCumulativeScores[battingTeamKey] = state.cumulativeScores[battingTeamKey] + inn.totalRuns
        newCumulativeBoundaries[battingTeamKey] = {
          fours: state.cumulativeBoundaries[battingTeamKey].fours + inn.fours,
          sixes: state.cumulativeBoundaries[battingTeamKey].sixes + inn.sixes,
        }

        if (state.currentInnings === 0) {
          // After innings 0 → innings-break
          newPhase = 'innings-break'
        } else if (state.currentInnings === 1) {
          // After innings 1 → check follow-on eligibility
          // Also update cumulative for bowling team of innings 0 (already done in innings 0 end)
          const inn0 = newInnings[0]
          const inn1Runs = inn.totalRuns
          const inn0Runs = inn0.totalRuns
          if (inn1Runs < inn0Runs * FOLLOW_ON_THRESHOLD) {
            newPhase = 'follow-on-decision'
          } else {
            newPhase = 'squad-rotation'
          }
        } else if (state.currentInnings === 2) {
          // After innings 2 → innings-break
          newPhase = 'innings-break'
        } else if (state.currentInnings === 3) {
          // After innings 3 → compare cumulative totals
          const team1Total = newCumulativeScores.team1
          const team2Total = newCumulativeScores.team2

          if (team1Total > team2Total) {
            result = `${state.team1} won by ${team1Total - team2Total} run${team1Total - team2Total !== 1 ? 's' : ''} (cumulative)`
            newPhase = 'match-over'
          } else if (team2Total > team1Total) {
            result = `${state.team2} won by ${team2Total - team1Total} run${team2Total - team1Total !== 1 ? 's' : ''} (cumulative)`
            newPhase = 'match-over'
          } else {
            // Tied → super over
            newPhase = 'super-over'
          }
        }
      }

      return {
        ...state,
        innings: newInnings,
        phase: newPhase,
        target,
        result,
        cumulativeScores: newCumulativeScores,
        cumulativeBoundaries: newCumulativeBoundaries,
        ballHistory: newHistory,
        lastBallWasNoBall: extraType === 'noBall',
      }
    }

    case 'SET_BOWLER': {
      const newInnings = [...state.innings]
      const inn = structuredClone(newInnings[state.currentInnings])
      const bowlerName = action.bowler

      // Check bowling cap: max 3 overs per bowler per innings
      if (inn.bowlerOversMap[bowlerName] >= MAX_OVERS_PER_BOWLER) {
        return state // Reject — bowler has reached cap
      }

      const existingIdx = inn.bowlers.findIndex(b => b.name === bowlerName)
      if (existingIdx >= 0) {
        inn.currentBowlerIndex = existingIdx
      } else {
        inn.bowlers.push(createBowler(bowlerName))
        inn.currentBowlerIndex = inn.bowlers.length - 1
      }
      newInnings[state.currentInnings] = inn
      return { ...state, innings: newInnings, phase: 'scoring' }
    }

    case 'START_NEXT_INNINGS': {
      return {
        ...state,
        currentInnings: state.currentInnings + 1,
        phase: 'batting-order',
      }
    }

    case 'DECIDE_FOLLOW_ON': {
      const enforce = action.enforce
      if (enforce) {
        // Swap innings order [2] and [3], recreate those innings
        const newOrder = [...state.inningsOrder]
        const temp = newOrder[2]
        newOrder[2] = newOrder[3]
        newOrder[3] = temp
        const newInnings = [...state.innings]
        newInnings[2] = createInnings(newOrder[2], newOrder[3], 3)
        newInnings[3] = createInnings(newOrder[3], newOrder[2], 4)
        return {
          ...state,
          inningsOrder: newOrder,
          innings: newInnings,
          followOnEnforced: true,
          phase: 'squad-rotation',
        }
      }
      return { ...state, phase: 'squad-rotation' }
    }

    case 'APPLY_SQUAD_ROTATION': {
      const { teamKey, swapOut, swapIn } = action
      const newRosters = structuredClone(state.activeRosters)
      const newSubs = structuredClone(state.substitutions)

      // Mark swapped-out players
      swapOut.forEach(name => {
        const player = newRosters[teamKey].find(p => p.name === name)
        if (player) player.substituted = true
      })

      // Add bench players
      swapIn.forEach(name => {
        newRosters[teamKey].push({ name, substituted: false })
      })

      newSubs[teamKey].push(...swapOut.map((name, idx) => ({ out: name, in: swapIn[idx] || '' })))

      return { ...state, activeRosters: newRosters, substitutions: newSubs }
    }

    case 'FINISH_SQUAD_ROTATION': {
      // Recreate innings 2 and 3 with potentially swapped teams (follow-on may have changed order)
      const newInnings = [...state.innings]
      const order = state.inningsOrder
      newInnings[2] = createInnings(order[2], order[3], 3)
      newInnings[3] = createInnings(order[3], order[2], 4)
      return {
        ...state,
        innings: newInnings,
        currentInnings: 2,
        phase: 'batting-order',
      }
    }

    case 'START_SUPER_OVER': {
      const createSOInnings = () => ({
        runs: 0, wickets: 0, balls: 0, ballLog: [], fours: 0, sixes: 0,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      })
      return {
        ...state,
        superOver: {
          phase: 'select-players', // select-players | batting-1 | batting-2 | result
          team1Batsmen: [],
          team1Bowler: '',
          team2Batsmen: [],
          team2Bowler: '',
          battingFirst: state.inningsOrder[3], // team that bowled last bats first in super over
          battingSecond: state.inningsOrder[2],
          innings1: createSOInnings(),
          innings2: { ...createSOInnings(), target: 0 },
        },
        phase: 'super-over',
      }
    }

    case 'SET_SUPER_OVER_PLAYERS': {
      const so = { ...state.superOver }
      so.team1Batsmen = action.team1Batsmen
      so.team1Bowler = action.team1Bowler
      so.team2Batsmen = action.team2Batsmen
      so.team2Bowler = action.team2Bowler
      so.phase = 'batting-1'
      return { ...state, superOver: so }
    }

    // Super over scoring — supports extras (wides, no-balls, byes, leg-byes)
    case 'SCORE_SUPER_OVER_BALL': {
      const so = structuredClone(state.superOver)
      const isFirst = so.phase === 'batting-1'
      const inn = isFirst ? so.innings1 : so.innings2

      // Save snapshot for undo before mutating
      const soSnapshot = structuredClone(state.superOver)

      const runsScored = action.runs || 0
      const isWicket = action.wicket || false
      const extraType = action.extraType || null
      const runType = action.runType || 'bat'
      let isLegalDelivery = true
      let ballDisplay = ''

      if (extraType === 'wide') {
        isLegalDelivery = false
        inn.runs += 1 + runsScored
        inn.extras.wides += 1
        ballDisplay = runsScored > 0 ? `Wd+${runsScored}` : 'Wd'
      } else if (extraType === 'noBall') {
        isLegalDelivery = false
        inn.runs += 1 + runsScored
        inn.extras.noBalls += 1
        if (runType === 'bat' && runsScored === 4) inn.fours++
        if (runType === 'bat' && runsScored === 6) inn.sixes++
        ballDisplay = runsScored > 0 ? `NB+${runsScored}` : 'NB'
      } else if (extraType === 'bye') {
        inn.runs += runsScored
        inn.extras.byes += runsScored
        ballDisplay = `B${runsScored}`
      } else if (extraType === 'legBye') {
        inn.runs += runsScored
        inn.extras.legByes += runsScored
        ballDisplay = `LB${runsScored}`
      } else {
        // Normal runs
        inn.runs += runsScored
        if (runsScored === 4) inn.fours++
        if (runsScored === 6) inn.sixes++
        ballDisplay = isWicket ? 'W' : runsScored.toString()
      }

      if (isWicket) {
        inn.wickets++
        ballDisplay = 'W'
      }

      if (isLegalDelivery) {
        inn.balls += 1
      }

      inn.ballLog.push(ballDisplay)

      // Check end of super over innings
      const inningsOver = inn.balls >= BALLS_PER_OVER || inn.wickets >= SUPER_OVER_WICKETS

      if (isFirst && inningsOver) {
        so.innings2.target = inn.runs + 1
        so.phase = 'batting-2'
      } else if (!isFirst) {
        // Check if target chased
        if (inn.runs >= so.innings2.target) {
          so.phase = 'result'
        } else if (inningsOver) {
          so.phase = 'result'
        }
      }

      return {
        ...state,
        superOver: so,
        superOverHistory: [...(state.superOverHistory || []).slice(-(MAX_UNDO_HISTORY - 1)), soSnapshot],
      }
    }

    case 'UNDO_SUPER_OVER_BALL': {
      const history = state.superOverHistory || []
      if (history.length === 0) return state
      const prev = history[history.length - 1]
      return {
        ...state,
        superOver: prev,
        superOverHistory: history.slice(0, -1),
      }
    }

    case 'SUPER_OVER_RESULT': {
      const so = state.superOver
      const team1IsFirst = so.battingFirst === state.team1
      const firstRuns = so.innings1.runs
      const secondRuns = so.innings2.runs
      let result = ''

      if (firstRuns > secondRuns) {
        result = `${so.battingFirst} won in Super Over (${firstRuns} vs ${secondRuns})`
      } else if (secondRuns > firstRuns) {
        result = `${so.battingSecond} won in Super Over (${secondRuns} vs ${firstRuns})`
      } else {
        // Tied super over — boundary count tiebreaker (cumulative across all innings + super over)
        const soFours1 = team1IsFirst ? so.innings1.fours : so.innings2.fours
        const soSixes1 = team1IsFirst ? so.innings1.sixes : so.innings2.sixes
        const soFours2 = team1IsFirst ? so.innings2.fours : so.innings1.fours
        const soSixes2 = team1IsFirst ? so.innings2.sixes : so.innings1.sixes
        const t1Boundaries = state.cumulativeBoundaries.team1.fours + state.cumulativeBoundaries.team1.sixes + soFours1 + soSixes1
        const t2Boundaries = state.cumulativeBoundaries.team2.fours + state.cumulativeBoundaries.team2.sixes + soFours2 + soSixes2

        if (t1Boundaries > t2Boundaries) {
          result = `${state.team1} won on boundary count (${t1Boundaries} vs ${t2Boundaries})`
        } else if (t2Boundaries > t1Boundaries) {
          result = `${state.team2} won on boundary count (${t2Boundaries} vs ${t1Boundaries})`
        } else {
          // Boundary count also equal — flag for another Super Over
          result = 'Match Tied! (boundary count also equal — another Super Over at organizer discretion)'
          return { ...state, result, superOver: { ...so, phase: 'tied-again' }, phase: 'super-over' }
        }
      }

      return { ...state, result, phase: 'match-over' }
    }

    case 'RESTART_SUPER_OVER': {
      // Another Super Over after boundary count tie
      const createSOInnings = () => ({
        runs: 0, wickets: 0, balls: 0, ballLog: [], fours: 0, sixes: 0,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      })
      return {
        ...state,
        superOver: {
          phase: 'select-players',
          team1Batsmen: [],
          team1Bowler: '',
          team2Batsmen: [],
          team2Bowler: '',
          battingFirst: state.superOver.battingFirst,
          battingSecond: state.superOver.battingSecond,
          innings1: createSOInnings(),
          innings2: { ...createSOInnings(), target: 0 },
        },
        superOverHistory: [],
        result: '',
      }
    }

    case 'END_AS_TIE': {
      // Organizer decides not to do another Super Over
      return { ...state, phase: 'match-over' }
    }

    case 'UNDO_BALL': {
      if (state.ballHistory.length === 0) return state
      const prev = state.ballHistory[state.ballHistory.length - 1]
      const remainingHistory = state.ballHistory.slice(0, -1)
      return {
        ...state,
        innings: prev.innings,
        phase: prev.phase,
        cumulativeScores: prev.cumulativeScores,
        cumulativeBoundaries: prev.cumulativeBoundaries,
        target: prev.target,
        result: prev.result,
        lastBallWasNoBall: prev.lastBallWasNoBall,
        ballHistory: remainingHistory,
      }
    }

    case 'SET_INNINGS_TIMER': {
      return {
        ...state,
        inningsTimers: {
          ...state.inningsTimers,
          [action.inningsIndex]: action.startTime,
        },
      }
    }

    case 'NEW_MATCH': {
      return { ...initialState }
    }

    default:
      return state
  }
}

const LEGACY_KEY = 'ncc_match_state'

function getStorageKey(matchId) {
  return matchId ? `ncc_match_${matchId}` : LEGACY_KEY
}

function loadSavedState(key) {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    // Validate it has the expected shape
    if (parsed && parsed.phase && parsed.innings) {
      // Restore ballHistory as empty (don't persist undo history)
      return { ...initialState, ...parsed, ballHistory: [] }
    }
  } catch {
    // Corrupted data — ignore
  }
  return null
}

function saveState(state, key) {
  try {
    // Don't save if in setup phase (nothing to resume)
    if (state.phase === 'setup') {
      localStorage.removeItem(key)
      return
    }
    // Omit ballHistory from persistence (large, transient)
    // eslint-disable-next-line no-unused-vars
    const { ballHistory, superOverHistory, ...toSave } = state
    localStorage.setItem(key, JSON.stringify(toSave))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function clearSavedMatch(matchId) {
  localStorage.removeItem(getStorageKey(matchId))
}

export function hasSavedMatch(matchId) {
  try {
    const saved = localStorage.getItem(getStorageKey(matchId))
    if (!saved) return false
    const parsed = JSON.parse(saved)
    return parsed && parsed.phase && parsed.phase !== 'setup'
  } catch {
    return false
  }
}

function buildInitialState(initialConfig) {
  if (!initialConfig) return initialState
  const { team1, team2, oversPerInnings, squad1, squad2 } = initialConfig
  if (!team1 || !team2 || !squad1?.length || !squad2?.length) return initialState
  return {
    ...initialState,
    team1,
    team2,
    oversPerInnings: oversPerInnings || initialState.oversPerInnings,
    squads: { team1: squad1, team2: squad2 },
    phase: 'toss',
  }
}

export function MatchProvider({ children, matchId, onMatchComplete, initialConfig }) {
  const storageKey = getStorageKey(matchId)
  const onMatchCompleteRef = useRef(onMatchComplete)
  onMatchCompleteRef.current = onMatchComplete

  const [state, dispatch] = useReducer(matchReducer, initialState, () => {
    const saved = loadSavedState(storageKey)
    if (saved) return saved
    return buildInitialState(initialConfig) || initialState
  })

  // Persist state to localStorage on every change
  useEffect(() => {
    saveState(state, storageKey)
  }, [state, storageKey])

  // Fire onMatchComplete when match ends
  const completeFiredRef = useRef(false)
  useEffect(() => {
    if (state.phase === 'match-over' && onMatchCompleteRef.current && !completeFiredRef.current) {
      completeFiredRef.current = true
      onMatchCompleteRef.current(state)
    }
  }, [state, state.phase])

  const value = {
    ...state,
    dispatch,
    canUndo: state.ballHistory.length > 0,
    canUndoSuperOver: (state.superOverHistory || []).length > 0,
    getRunRate: () => {
      const inn = state.innings[state.currentInnings]
      if (!inn) return '0.00'
      return getRunRate(inn.totalRuns, inn.oversCompleted, inn.ballsInCurrentOver)
    },
    getRequiredRunRate: () => {
      // In 4th innings, target is based on cumulative
      if (state.currentInnings !== 3) return null
      const inn = state.innings[3]
      if (!inn) return null
      const battingKey = getTeamKey(state, inn.battingTeam)
      const bowlingKey = getTeamKey(state, inn.bowlingTeam)
      const target = state.cumulativeScores[bowlingKey] + 1 - state.cumulativeScores[battingKey]
      if (target <= 0) return null
      return getRequiredRunRate(target, inn.totalRuns, state.oversPerInnings, inn.oversCompleted, inn.ballsInCurrentOver)
    },
    getCumulativeTarget: () => {
      if (state.currentInnings !== 3) return null
      const inn = state.innings[3]
      if (!inn) return null
      const bowlingKey = getTeamKey(state, inn.bowlingTeam)
      const battingKey = getTeamKey(state, inn.battingTeam)
      return state.cumulativeScores[bowlingKey] + 1 - state.cumulativeScores[battingKey]
    },
    getLiveCumulative: () => {
      const inn = state.innings[state.currentInnings]
      if (!inn) return 0
      const battingKey = getTeamKey(state, inn.battingTeam)
      return state.cumulativeScores[battingKey] + inn.totalRuns
    },
    getNRR: (teamKey) => {
      // NRR = (runs scored / overs faced) - (runs conceded / overs bowled)
      let runsScored = 0, oversFaced = 0
      let runsConceded = 0, oversBowled = 0
      const teamName = teamKey === 'team1' ? state.team1 : state.team2
      state.innings.forEach(inn => {
        if (!inn || inn.totalRuns === undefined) return
        const completedOvers = inn.oversCompleted + inn.ballsInCurrentOver / BALLS_PER_OVER
        if (inn.battingTeam === teamName) {
          runsScored += inn.totalRuns
          oversFaced += inn.wickets >= MAX_WICKETS ? state.oversPerInnings : completedOvers
        } else if (inn.bowlingTeam === teamName) {
          runsConceded += inn.totalRuns
          oversBowled += inn.wickets >= MAX_WICKETS ? state.oversPerInnings : completedOvers
        }
      })
      if (oversFaced === 0 || oversBowled === 0) return '0.000'
      const nrr = (runsScored / oversFaced) - (runsConceded / oversBowled)
      if (!isFinite(nrr)) return '0.000'
      return nrr.toFixed(3)
    },
    getTeamKey,
    getOrdinal,
  }

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
}

export function useMatch() {
  const context = useContext(MatchContext)
  if (!context) throw new Error('useMatch must be used within MatchProvider')
  return context
}
