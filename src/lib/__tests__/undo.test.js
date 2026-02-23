import { describe, it, expect } from 'vitest'
import { matchReducer, initialState } from '../../context/MatchContext.jsx'
import { BALLS_PER_OVER, MAX_WICKETS } from '../constants'

// ─── Helpers ─────────────────────────────────────────────────

function setupMatch() {
  let state = { ...initialState }
  state = matchReducer(state, {
    type: 'SET_TEAMS', team1: 'Team A', team2: 'Team B', oversPerInnings: 12,
    squad1: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
    squad2: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
  })
  state = matchReducer(state, { type: 'SET_TOSS', winner: 'Team A', decision: 'bat' })
  state = matchReducer(state, {
    type: 'SET_PLAYING_XI',
    team1XI: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
    team2XI: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
  })
  state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
  return state
}

function scoreBall(state, action = {}) {
  return matchReducer(state, { type: 'SCORE_BALL', runs: 0, runType: 'bat', ...action })
}

function getInn(state) {
  return state.innings[state.currentInnings]
}

function getStriker(state) {
  const inn = getInn(state)
  return inn.batsmen[inn.activeBatsmanIndex].name
}

function undo(state) {
  return matchReducer(state, { type: 'UNDO_BALL' })
}

// ─── Tests ───────────────────────────────────────────────────

describe('Basic Undo', () => {
  it('dot ball then undo: totalRuns still 0, ballsInCurrentOver back to 0, ballHistory empty', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 0 })
    const inn = getInn(state)
    expect(inn.totalRuns).toBe(0)
    expect(inn.ballsInCurrentOver).toBe(1)
    expect(state.ballHistory.length).toBe(1)

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.totalRuns).toBe(0)
    expect(innAfter.ballsInCurrentOver).toBe(0)
    expect(state.ballHistory.length).toBe(0)
  })

  it('score 4 runs then undo: totalRuns back to 0, striker.runs back to 0, striker.fours back to 0', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 4 })
    expect(getInn(state).totalRuns).toBe(4)
    expect(getInn(state).batsmen[0].runs).toBe(4)
    expect(getInn(state).batsmen[0].fours).toBe(1)

    state = undo(state)
    expect(getInn(state).totalRuns).toBe(0)
    expect(getInn(state).batsmen[0].runs).toBe(0)
    expect(getInn(state).batsmen[0].fours).toBe(0)
  })

  it('score 6 then undo: six count decremented, totalRuns back', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 6 })
    expect(getInn(state).totalRuns).toBe(6)
    expect(getInn(state).batsmen[0].sixes).toBe(1)
    expect(getInn(state).sixes).toBe(1)

    state = undo(state)
    expect(getInn(state).totalRuns).toBe(0)
    expect(getInn(state).batsmen[0].sixes).toBe(0)
    expect(getInn(state).sixes).toBe(0)
  })

  it('single then undo: strike rotation is reversed (striker goes back to original)', () => {
    let state = setupMatch()
    expect(getStriker(state)).toBe('A1')

    state = scoreBall(state, { runs: 1 })
    // Odd runs rotate strike
    expect(getStriker(state)).toBe('A2')

    state = undo(state)
    expect(getStriker(state)).toBe('A1')
  })

  it('multiple consecutive undos: score 3 balls (1, 4, 6 = 11 total), undo 3 times, back to 0', () => {
    let state = setupMatch()
    state = scoreBall(state, { runs: 1 })
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 6 })
    expect(getInn(state).totalRuns).toBe(11)
    expect(state.ballHistory.length).toBe(3)

    state = undo(state)
    expect(getInn(state).totalRuns).toBe(5)
    expect(state.ballHistory.length).toBe(2)

    state = undo(state)
    expect(getInn(state).totalRuns).toBe(1)
    expect(state.ballHistory.length).toBe(1)

    state = undo(state)
    expect(getInn(state).totalRuns).toBe(0)
    expect(state.ballHistory.length).toBe(0)
  })
})

describe('Undo Extras', () => {
  it('wide (0 additional) then undo: totalRuns back, extras.wides back, bowler.runs back, ballsInCurrentOver unchanged', () => {
    let state = setupMatch()
    state = scoreBall(state, { extraType: 'wide', runs: 0, runType: 'extra' })
    const inn = getInn(state)
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.wides).toBe(1)
    expect(inn.bowlers[0].runs).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(0) // wide is not legal

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.totalRuns).toBe(0)
    expect(innAfter.extras.wides).toBe(0)
    expect(innAfter.bowlers[0].runs).toBe(0)
    expect(innAfter.ballsInCurrentOver).toBe(0) // was 0 before the wide, still 0 after undo
  })

  it('no-ball then undo: totalRuns back, extras.noBalls back, lastBallWasNoBall back to false', () => {
    let state = setupMatch()
    expect(state.lastBallWasNoBall).toBe(false)

    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(getInn(state).totalRuns).toBe(1)
    expect(getInn(state).extras.noBalls).toBe(1)
    expect(state.lastBallWasNoBall).toBe(true)

    state = undo(state)
    expect(getInn(state).totalRuns).toBe(0)
    expect(getInn(state).extras.noBalls).toBe(0)
    expect(state.lastBallWasNoBall).toBe(false)
  })

  it('no-ball + 4 runs (bat) then undo: totalRuns -= 5, striker.runs -= 4, striker.fours -= 1', () => {
    let state = setupMatch()
    state = scoreBall(state, { extraType: 'noBall', runs: 4, runType: 'bat' })
    const inn = getInn(state)
    expect(inn.totalRuns).toBe(5) // 1 (no-ball) + 4 (bat)
    expect(inn.batsmen[0].runs).toBe(4)
    expect(inn.batsmen[0].fours).toBe(1)
    expect(inn.extras.noBalls).toBe(1)

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.totalRuns).toBe(0)
    expect(innAfter.batsmen[0].runs).toBe(0)
    expect(innAfter.batsmen[0].fours).toBe(0)
    expect(innAfter.extras.noBalls).toBe(0)
  })

  it('bye(1) then undo: totalRuns -= 1, extras.byes -= 1, striker.balls -= 1 (legal delivery undone)', () => {
    let state = setupMatch()
    state = scoreBall(state, { extraType: 'bye', runs: 1, runType: 'extra' })
    const inn = getInn(state)
    expect(inn.totalRuns).toBe(1)
    expect(inn.extras.byes).toBe(1)
    expect(inn.batsmen[0].balls).toBe(1)
    expect(inn.ballsInCurrentOver).toBe(1)

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.totalRuns).toBe(0)
    expect(innAfter.extras.byes).toBe(0)
    expect(innAfter.batsmen[0].balls).toBe(0) // legal delivery undone
    expect(innAfter.ballsInCurrentOver).toBe(0)
  })

  it('leg bye(2) then undo: totalRuns -= 2, extras.legByes -= 2, striker.balls -= 1', () => {
    let state = setupMatch()
    state = scoreBall(state, { extraType: 'legBye', runs: 2, runType: 'extra' })
    const inn = getInn(state)
    expect(inn.totalRuns).toBe(2)
    expect(inn.extras.legByes).toBe(2)
    expect(inn.batsmen[0].balls).toBe(1)

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.totalRuns).toBe(0)
    expect(innAfter.extras.legByes).toBe(0)
    expect(innAfter.batsmen[0].balls).toBe(0)
  })
})

describe('Undo Wickets', () => {
  it('bowled then undo: wickets back to 0, batsman restored (not out), bowler.wickets back to 0, fallOfWickets entry removed, new batsman removed', () => {
    let state = setupMatch()
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: 'A3' })
    const inn = getInn(state)
    expect(inn.wickets).toBe(1)
    expect(inn.batsmen[0].isOut).toBe(true)
    expect(inn.batsmen[0].dismissal).toBe('bowled')
    expect(inn.bowlers[0].wickets).toBe(1)
    expect(inn.fallOfWickets.length).toBe(1)
    expect(inn.batsmen.length).toBe(3) // A1, A2, A3

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.wickets).toBe(0)
    expect(innAfter.batsmen[0].isOut).toBe(false)
    expect(innAfter.batsmen[0].dismissal).toBe('')
    expect(innAfter.bowlers[0].wickets).toBe(0)
    expect(innAfter.fallOfWickets.length).toBe(0)
    expect(innAfter.batsmen.length).toBe(2) // A3 removed
  })

  it('caught then undo: same restoration', () => {
    let state = setupMatch()
    state = scoreBall(state, { wicket: true, dismissalType: 'caught', newBatsman: 'A3' })
    expect(getInn(state).wickets).toBe(1)
    expect(getInn(state).batsmen[0].isOut).toBe(true)
    expect(getInn(state).batsmen[0].dismissal).toBe('caught')
    expect(getInn(state).bowlers[0].wickets).toBe(1)

    state = undo(state)
    expect(getInn(state).wickets).toBe(0)
    expect(getInn(state).batsmen[0].isOut).toBe(false)
    expect(getInn(state).batsmen[0].dismissal).toBe('')
    expect(getInn(state).bowlers[0].wickets).toBe(0)
    expect(getInn(state).batsmen.length).toBe(2)
  })

  it('run out (striker) then undo: striker restored', () => {
    let state = setupMatch()
    const strikerBefore = getStriker(state)
    expect(strikerBefore).toBe('A1')

    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runOutBatsman: 'striker', newBatsman: 'A3',
    })
    const inn = getInn(state)
    expect(inn.wickets).toBe(1)
    expect(inn.batsmen[0].isOut).toBe(true) // A1 (striker) was dismissed
    expect(inn.batsmen[0].dismissal).toBe('runOut')

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.wickets).toBe(0)
    expect(innAfter.batsmen[0].isOut).toBe(false)
    expect(innAfter.batsmen[0].name).toBe('A1')
    expect(innAfter.batsmen.length).toBe(2)
  })

  it('run out (non-striker) then undo: non-striker restored, striker unchanged', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runOutBatsman: 'nonStriker', newBatsman: 'A3',
    })
    const inn = getInn(state)
    expect(inn.wickets).toBe(1)
    expect(inn.batsmen[1].isOut).toBe(true) // A2 (non-striker) was dismissed
    expect(inn.batsmen[1].dismissal).toBe('runOut')
    expect(inn.batsmen[0].isOut).toBe(false) // A1 (striker) unchanged

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.wickets).toBe(0)
    expect(innAfter.batsmen[1].isOut).toBe(false)
    expect(innAfter.batsmen[1].name).toBe('A2')
    expect(innAfter.batsmen[0].isOut).toBe(false)
    expect(innAfter.batsmen[0].name).toBe('A1')
    expect(innAfter.batsmen.length).toBe(2)
  })
})

describe('Undo Over Boundaries', () => {
  it('complete an over (6 dots), phase goes to new-bowler; undo restores scoring phase and all over state', () => {
    let state = setupMatch()

    // Score 5 dot balls first
    for (let i = 0; i < 5; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(getInn(state).ballsInCurrentOver).toBe(5)
    expect(getInn(state).oversCompleted).toBe(0)
    expect(state.phase).toBe('scoring')

    // Score the 6th dot ball — over completes
    state = scoreBall(state, { runs: 0 })
    expect(getInn(state).oversCompleted).toBe(1)
    expect(getInn(state).ballsInCurrentOver).toBe(0)
    expect(getInn(state).allOvers.length).toBe(1)
    expect(getInn(state).currentOver.length).toBe(0)
    expect(state.phase).toBe('new-bowler')
    expect(getInn(state).bowlers[0].overs).toBe(1)
    expect(getInn(state).bowlers[0].ballsInOver).toBe(0)

    // Undo the 6th ball — should reverse ALL of the over completion
    state = undo(state)
    expect(getInn(state).oversCompleted).toBe(0)
    expect(getInn(state).ballsInCurrentOver).toBe(5)
    expect(getInn(state).allOvers.length).toBe(0)
    expect(getInn(state).currentOver.length).toBe(5)
    expect(state.phase).toBe('scoring')
    expect(getInn(state).bowlers[0].overs).toBe(0)
    expect(getInn(state).bowlers[0].ballsInOver).toBe(5)
  })

  it('undo after over completion restores currentOver content', () => {
    let state = setupMatch()

    // Score diverse deliveries: 0, 1, 0, 4, 0, 0
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 1 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 0 })
    state = scoreBall(state, { runs: 0 })

    // Over is complete
    expect(state.phase).toBe('new-bowler')
    expect(getInn(state).allOvers.length).toBe(1)

    // Undo the last ball
    state = undo(state)
    expect(state.phase).toBe('scoring')
    expect(getInn(state).currentOver.length).toBe(5)
    expect(getInn(state).ballsInCurrentOver).toBe(5)
    // The 5 balls before the 6th were: 0, 1, 0, 4, 0
    expect(getInn(state).currentOver).toEqual(['0', '1', '0', '4', '0'])
  })
})

describe('Undo Free Hit', () => {
  it('no-ball sets lastBallWasNoBall=true, dot ball on free hit sets it false, undo restores true', () => {
    let state = setupMatch()
    expect(state.lastBallWasNoBall).toBe(false)

    // No-ball
    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)

    // Free hit: dot ball (legal delivery, sets lastBallWasNoBall to false)
    state = scoreBall(state, { runs: 0 })
    expect(state.lastBallWasNoBall).toBe(false)

    // Undo the free hit dot ball
    state = undo(state)
    expect(state.lastBallWasNoBall).toBe(true)
  })

  it('no-ball then undo the no-ball: lastBallWasNoBall back to false', () => {
    let state = setupMatch()
    expect(state.lastBallWasNoBall).toBe(false)

    state = scoreBall(state, { extraType: 'noBall', runs: 0, runType: 'bat' })
    expect(state.lastBallWasNoBall).toBe(true)

    state = undo(state)
    expect(state.lastBallWasNoBall).toBe(false)
  })
})

describe('Undo With Empty History', () => {
  it('undo with 0 balls bowled: returns same state (no crash)', () => {
    const state = setupMatch()
    expect(state.ballHistory.length).toBe(0)
    const next = undo(state)
    // Should not crash and should return the same state
    expect(next.phase).toBe('scoring')
    expect(next.innings[0].totalRuns).toBe(0)
  })

  it('ballHistory.length is 0: state reference unchanged (identity check)', () => {
    const state = setupMatch()
    const next = undo(state)
    expect(next).toBe(state) // exact same reference
  })
})

describe('Undo Innings End', () => {
  // Helper: take wickets with proper over-boundary handling.
  // Each wicket is a legal delivery, so after every 6 deliveries an over
  // completes and we need to set a new bowler before continuing.
  // allOut=true means the last wicket in this batch is the 10th (no newBatsman).
  function takeWicketsWithOverBoundaries(state, count, startPlayerIndex, allOut = false) {
    const bowlers = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']
    let bowlerIdx = 0
    for (let i = 0; i < count; i++) {
      const playerNum = startPlayerIndex + i
      const isAllOutWicket = allOut && (i === count - 1)
      if (isAllOutWicket) {
        state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
      } else {
        state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${playerNum}` })
      }
      // If over completed (phase = new-bowler) and innings hasn't ended, set next bowler
      if (state.phase === 'new-bowler') {
        bowlerIdx = (bowlerIdx + 1) % bowlers.length
        state = matchReducer(state, { type: 'SET_BOWLER', bowler: bowlers[bowlerIdx] })
      }
    }
    return state
  }

  it('all out (10 wickets): phase changes to innings-break; undo restores scoring with 9 wickets', () => {
    let state = setupMatch()

    // Take 9 wickets (need newBatsman for each), handling over boundaries
    state = takeWicketsWithOverBoundaries(state, 9, 3)
    expect(getInn(state).wickets).toBe(9)
    expect(state.phase).toBe('scoring')

    // Take the 10th wicket (no newBatsman since all out)
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(getInn(state).wickets).toBe(MAX_WICKETS)
    expect(state.phase).toBe('innings-break')

    // Undo: should restore to 9 wickets, phase=scoring
    state = undo(state)
    expect(getInn(state).wickets).toBe(9)
    expect(state.phase).toBe('scoring')
    // After 9 wickets: batsmen = [A1, A2, A3, ..., A11] (11 batsmen total)
    expect(getInn(state).batsmen.length).toBe(11)
  })

  it('undo after all-out restores fallOfWickets to 9 entries', () => {
    let state = setupMatch()

    state = takeWicketsWithOverBoundaries(state, 9, 3)
    expect(getInn(state).fallOfWickets.length).toBe(9)

    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(getInn(state).fallOfWickets.length).toBe(10)
    expect(state.phase).toBe('innings-break')

    state = undo(state)
    expect(getInn(state).fallOfWickets.length).toBe(9)
    expect(state.phase).toBe('scoring')
  })

  it('undo after all-out restores cumulativeScores to pre-innings-end values', () => {
    let state = setupMatch()
    // Score some runs before all out
    state = scoreBall(state, { runs: 4 })
    state = scoreBall(state, { runs: 6 })

    // Take 9 wickets, handling over boundaries (2 runs already counted as legal deliveries)
    state = takeWicketsWithOverBoundaries(state, 9, 3)

    // Take the 10th wicket
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    // Innings ended: cumulative should be updated
    expect(state.cumulativeScores.team1).toBe(10)
    expect(state.phase).toBe('innings-break')

    // Undo the 10th wicket
    state = undo(state)
    // Cumulative should be back to 0 (innings hasn't ended yet)
    expect(state.cumulativeScores.team1).toBe(0)
    expect(state.phase).toBe('scoring')
  })
})

describe('State Machine — Phase Transitions', () => {
  it('initial state: phase = setup', () => {
    expect(initialState.phase).toBe('setup')
  })

  it('after SET_TEAMS: phase = toss', () => {
    let state = { ...initialState }
    state = matchReducer(state, {
      type: 'SET_TEAMS', team1: 'Team A', team2: 'Team B', oversPerInnings: 12,
      squad1: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
      squad2: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
    })
    expect(state.phase).toBe('toss')
  })

  it('after SET_TOSS: phase = select-xi', () => {
    let state = { ...initialState }
    state = matchReducer(state, {
      type: 'SET_TEAMS', team1: 'Team A', team2: 'Team B', oversPerInnings: 12,
      squad1: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
      squad2: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
    })
    state = matchReducer(state, { type: 'SET_TOSS', winner: 'Team A', decision: 'bat' })
    expect(state.phase).toBe('select-xi')
  })

  it('after SET_PLAYING_XI: phase = batting-order', () => {
    let state = { ...initialState }
    state = matchReducer(state, {
      type: 'SET_TEAMS', team1: 'Team A', team2: 'Team B', oversPerInnings: 12,
      squad1: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
      squad2: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
    })
    state = matchReducer(state, { type: 'SET_TOSS', winner: 'Team A', decision: 'bat' })
    state = matchReducer(state, {
      type: 'SET_PLAYING_XI',
      team1XI: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
      team2XI: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
    })
    expect(state.phase).toBe('batting-order')
  })

  it('after SET_OPENERS: phase = scoring', () => {
    const state = setupMatch()
    expect(state.phase).toBe('scoring')
  })

  it('after 6 legal balls: phase = new-bowler (over complete, innings not done)', () => {
    let state = setupMatch()
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(state.phase).toBe('new-bowler')
  })

  it('after SET_BOWLER: phase = scoring', () => {
    let state = setupMatch()
    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(state.phase).toBe('new-bowler')
    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })
    expect(state.phase).toBe('scoring')
  })

  it('after innings ends (all out): phase = innings-break', () => {
    let state = setupMatch()
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('innings-break')
  })

  it('after START_NEXT_INNINGS: currentInnings incremented, phase = batting-order', () => {
    let state = setupMatch()
    // End innings 0 by all out
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('innings-break')
    expect(state.currentInnings).toBe(0)

    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    expect(state.currentInnings).toBe(1)
    expect(state.phase).toBe('batting-order')
  })

  it('SCORE_BALL during innings-break does not crash and state remains consistent', () => {
    let state = setupMatch()
    // End innings 0 by all out
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('innings-break')

    // Try scoring a ball during innings-break — the reducer processes it
    // but the UI prevents this. Verify no crash and state is still valid.
    const before = state
    const after = scoreBall(state, { runs: 1 })
    // State should still have valid innings data (no crash)
    expect(after.innings).toBeDefined()
    expect(after.innings[0]).toBeDefined()
    // The reducer will process the ball on the current (completed) innings
    // This is technically invalid, but should not throw
  })

  it('full phase transition chain: setup -> toss -> select-xi -> batting-order -> scoring -> new-bowler -> scoring', () => {
    let state = { ...initialState }
    expect(state.phase).toBe('setup')

    state = matchReducer(state, {
      type: 'SET_TEAMS', team1: 'Team A', team2: 'Team B', oversPerInnings: 12,
      squad1: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
      squad2: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
    })
    expect(state.phase).toBe('toss')

    state = matchReducer(state, { type: 'SET_TOSS', winner: 'Team A', decision: 'bat' })
    expect(state.phase).toBe('select-xi')

    state = matchReducer(state, {
      type: 'SET_PLAYING_XI',
      team1XI: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],
      team2XI: ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11'],
    })
    expect(state.phase).toBe('batting-order')

    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'A1', batsman2: 'A2', bowler: 'B1' })
    expect(state.phase).toBe('scoring')

    for (let i = 0; i < BALLS_PER_OVER; i++) {
      state = scoreBall(state, { runs: 0 })
    }
    expect(state.phase).toBe('new-bowler')

    state = matchReducer(state, { type: 'SET_BOWLER', bowler: 'B2' })
    expect(state.phase).toBe('scoring')
  })

  it('complete first innings transition: scoring -> innings-break -> batting-order (via START_NEXT_INNINGS + SET_OPENERS)', () => {
    let state = setupMatch()
    // All out
    for (let i = 3; i <= 11; i++) {
      state = scoreBall(state, { wicket: true, dismissalType: 'bowled', newBatsman: `A${i}` })
    }
    state = scoreBall(state, { wicket: true, dismissalType: 'bowled' })
    expect(state.phase).toBe('innings-break')

    state = matchReducer(state, { type: 'START_NEXT_INNINGS' })
    expect(state.phase).toBe('batting-order')
    expect(state.currentInnings).toBe(1)

    state = matchReducer(state, { type: 'SET_OPENERS', batsman1: 'B1', batsman2: 'B2', bowler: 'A1' })
    expect(state.phase).toBe('scoring')
    expect(getInn(state).battingTeam).toBe('Team B')
  })
})
