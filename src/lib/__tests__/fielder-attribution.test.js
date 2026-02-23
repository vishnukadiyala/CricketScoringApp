import { describe, it, expect } from 'vitest'
import { matchReducer, initialState, createBatsman } from '../../context/MatchContext.jsx'
import { formatDismissal } from '../dismissalText'
import { computeFieldingStats, computeTeamFieldingStats } from '../stats'

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

function undo(state) {
  return matchReducer(state, { type: 'UNDO_BALL' })
}

// ─── Dismissal String Generation ────────────────────────────

describe('formatDismissal', () => {
  it('formats caught with fielder != bowler', () => {
    const bat = { dismissal: 'caught', fielder: 'Smith', fielder2: null, isDirectHit: false }
    expect(formatDismissal(bat, 'Jones')).toBe('c Smith b Jones')
  })

  it('formats caught & bowled (fielder == bowler)', () => {
    const bat = { dismissal: 'caught', fielder: 'Jones', fielder2: null, isDirectHit: false }
    expect(formatDismissal(bat, 'Jones')).toBe('c & b Jones')
  })

  it('formats caught with no fielder (legacy)', () => {
    const bat = { dismissal: 'caught', fielder: null }
    expect(formatDismissal(bat, 'Jones')).toBe('c ? b Jones')
  })

  it('formats run out with fielder', () => {
    const bat = { dismissal: 'runOut', fielder: 'Smith', fielder2: null, isDirectHit: false }
    expect(formatDismissal(bat, 'Jones')).toBe('run out (Smith)')
  })

  it('formats run out with direct hit', () => {
    const bat = { dismissal: 'runOut', fielder: 'Smith', fielder2: null, isDirectHit: true }
    expect(formatDismissal(bat, 'Jones')).toBe('run out (Smith) [direct hit]')
  })

  it('formats run out with assist fielder', () => {
    const bat = { dismissal: 'runOut', fielder: 'Smith', fielder2: 'Brown', isDirectHit: false }
    expect(formatDismissal(bat, 'Jones')).toBe('run out (Smith / Brown)')
  })

  it('formats run out with no fielder (legacy)', () => {
    const bat = { dismissal: 'runOut' }
    expect(formatDismissal(bat, 'Jones')).toBe('run out (?)')
  })

  it('formats stumped with fielder', () => {
    const bat = { dismissal: 'stumped', fielder: 'WK' }
    expect(formatDismissal(bat, 'Jones')).toBe('st WK b Jones')
  })

  it('formats stumped with no fielder (legacy)', () => {
    const bat = { dismissal: 'stumped' }
    expect(formatDismissal(bat, 'Jones')).toBe('st ? b Jones')
  })

  it('formats bowled', () => {
    const bat = { dismissal: 'bowled' }
    expect(formatDismissal(bat, 'Jones')).toBe('b Jones')
  })

  it('formats lbw', () => {
    const bat = { dismissal: 'lbw' }
    expect(formatDismissal(bat, 'Jones')).toBe('lbw b Jones')
  })

  it('formats hitWicket', () => {
    const bat = { dismissal: 'hitWicket' }
    expect(formatDismissal(bat, 'Jones')).toBe('hit wicket b Jones')
  })

  it('returns empty string for no dismissal', () => {
    expect(formatDismissal({ dismissal: '' }, 'Jones')).toBe('')
    expect(formatDismissal(null, 'Jones')).toBe('')
  })

  it('handles missing bowler name gracefully', () => {
    const bat = { dismissal: 'bowled' }
    expect(formatDismissal(bat, null)).toBe('bowled')
  })
})

// ─── createBatsman defaults ─────────────────────────────────

describe('createBatsman fielder defaults', () => {
  it('has fielder: null', () => {
    const bat = createBatsman('Test')
    expect(bat.fielder).toBeNull()
  })

  it('has fielder2: null', () => {
    const bat = createBatsman('Test')
    expect(bat.fielder2).toBeNull()
  })

  it('has isDirectHit: false', () => {
    const bat = createBatsman('Test')
    expect(bat.isDirectHit).toBe(false)
  })
})

// ─── Reducer: fielder stored on SCORE_BALL wicket ───────────

describe('SCORE_BALL stores fielder data', () => {
  it('stores fielder on caught wicket', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'caught',
      fielder: 'B3', newBatsman: 'A3',
    })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.isOut)
    expect(dismissed.fielder).toBe('B3')
    expect(dismissed.fielder2).toBeNull()
    expect(dismissed.isDirectHit).toBe(false)
  })

  it('stores fielder and fielder2 on run out', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 1,
      runOutBatsman: 'striker',
      fielder: 'B4', fielder2: 'B5', newBatsman: 'A3',
    })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.isOut)
    expect(dismissed.fielder).toBe('B4')
    expect(dismissed.fielder2).toBe('B5')
  })

  it('stores isDirectHit on run out', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 0,
      runOutBatsman: 'striker',
      fielder: 'B4', isDirectHit: true, newBatsman: 'A3',
    })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.isOut)
    expect(dismissed.isDirectHit).toBe(true)
  })

  it('stores fielder on stumped wicket', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'stumped',
      fielder: 'B1', newBatsman: 'A3',
    })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.isOut)
    expect(dismissed.fielder).toBe('B1')
  })

  it('stores null fielder for bowled (no fielder passed)', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'bowled', newBatsman: 'A3',
    })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.isOut)
    expect(dismissed.fielder).toBeNull()
  })

  it('stores bowlerName in fallOfWickets', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'caught',
      fielder: 'B3', newBatsman: 'A3',
    })
    const inn = getInn(state)
    expect(inn.fallOfWickets[0].bowlerName).toBe('B1')
  })
})

// ─── Run out dismissed batter selection ─────────────────────

describe('Run out batter selection with fielder', () => {
  it('non-striker run out stores fielder on correct batsman', () => {
    let state = setupMatch()
    // With runs: 0, no strike swap, so nonStriker is still A2
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 0,
      runOutBatsman: 'nonStriker',
      fielder: 'B6', newBatsman: 'A3',
    })
    const inn = getInn(state)
    const nonStriker = inn.batsmen.find(b => b.name === 'A2')
    expect(nonStriker.isOut).toBe(true)
    expect(nonStriker.fielder).toBe('B6')
  })

  it('striker run out stores fielder on striker', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 0,
      runOutBatsman: 'striker',
      fielder: 'B7', newBatsman: 'A3',
    })
    const inn = getInn(state)
    const striker = inn.batsmen.find(b => b.name === 'A1')
    expect(striker.isOut).toBe(true)
    expect(striker.fielder).toBe('B7')
  })

  it('run out with runs preserves fielder data', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 2,
      runOutBatsman: 'striker',
      fielder: 'B3', fielder2: 'B4', isDirectHit: false,
      newBatsman: 'A3',
    })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.isOut)
    expect(dismissed.fielder).toBe('B3')
    expect(dismissed.fielder2).toBe('B4')
    expect(inn.totalRuns).toBe(2)
  })

  it('multiple run outs track different fielders', () => {
    let state = setupMatch()
    // First wicket: A1 (striker) run out, A3 comes in
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 0,
      runOutBatsman: 'striker', fielder: 'B3', newBatsman: 'A3',
    })
    // Now A3 is striker, A2 is non-striker
    // Second wicket: A3 (striker) run out, 0 runs
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 0,
      runOutBatsman: 'striker', fielder: 'B5', newBatsman: 'A4',
    })
    const inn = getInn(state)
    const dismissed1 = inn.batsmen.find(b => b.name === 'A1')
    const dismissed2 = inn.batsmen.find(b => b.name === 'A3')
    expect(dismissed1.fielder).toBe('B3')
    expect(dismissed2.fielder).toBe('B5')
  })
})

// ─── Undo with fielder data ─────────────────────────────────

describe('Undo with fielder data', () => {
  it('undo restores batsman without fielder data', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'caught',
      fielder: 'B3', newBatsman: 'A3',
    })
    const innBefore = getInn(state)
    expect(innBefore.wickets).toBe(1)
    expect(innBefore.batsmen.find(b => b.name === 'A1').fielder).toBe('B3')

    state = undo(state)
    const innAfter = getInn(state)
    expect(innAfter.wickets).toBe(0)
    expect(innAfter.batsmen.find(b => b.name === 'A1').isOut).toBe(false)
    expect(innAfter.batsmen.find(b => b.name === 'A1').fielder).toBeNull()
  })

  it('undo restores run out with fielder2', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 0,
      runOutBatsman: 'striker',
      fielder: 'B4', fielder2: 'B5', isDirectHit: true,
      newBatsman: 'A3',
    })
    state = undo(state)
    const inn = getInn(state)
    const bat = inn.batsmen.find(b => b.name === 'A1')
    expect(bat.isOut).toBe(false)
    expect(bat.fielder).toBeNull()
    expect(bat.fielder2).toBeNull()
    expect(bat.isDirectHit).toBe(false)
  })

  it('undo after two wickets restores second correctly', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'caught', fielder: 'B3', newBatsman: 'A3',
    })
    state = scoreBall(state, {
      wicket: true, dismissalType: 'stumped', fielder: 'B2', newBatsman: 'A4',
    })
    state = undo(state)
    const inn = getInn(state)
    expect(inn.wickets).toBe(1)
    // First wicket still exists with fielder
    expect(inn.batsmen.find(b => b.name === 'A1').fielder).toBe('B3')
    // A2 should not be out anymore (was the one undone)
    expect(inn.batsmen.find(b => b.name === 'A2').isOut).toBe(false)
  })

  it('undo clears fallOfWickets bowlerName', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'bowled', newBatsman: 'A3',
    })
    expect(getInn(state).fallOfWickets[0].bowlerName).toBe('B1')
    state = undo(state)
    expect(getInn(state).fallOfWickets.length).toBe(0)
  })

  it('multiple undos clear all fielder data', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'caught', fielder: 'B3', newBatsman: 'A3',
    })
    state = scoreBall(state, {
      wicket: true, dismissalType: 'runOut', runs: 0,
      runOutBatsman: 'striker', fielder: 'B5', newBatsman: 'A4',
    })
    state = undo(state)
    state = undo(state)
    const inn = getInn(state)
    expect(inn.wickets).toBe(0)
    expect(inn.batsmen.every(b => b.fielder === null)).toBe(true)
  })
})

// ─── Fielding stats calculation ─────────────────────────────

describe('computeFieldingStats player-level', () => {
  function makeMatchData(batsmen) {
    return [{
      matchMeta: { id: '1', matchNumber: 1, type: 'league', team1Id: 'ta', team2Id: 'tb' },
      matchState: {
        team1: 'Team A', team2: 'Team B',
        innings: [{
          battingTeam: 'Team A', bowlingTeam: 'Team B',
          batsmen,
          bowlers: [{ name: 'B1', overs: 2, ballsInOver: 0, maidens: 0, runs: 10, wickets: 1 }],
          totalRuns: 50, wickets: batsmen.filter(b => b.isOut).length,
          oversCompleted: 12, ballsInCurrentOver: 0,
          currentOver: [], allOvers: [], extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          fallOfWickets: [], bowlerOversMap: {},
        }, null, null, null],
      },
    }]
  }

  it('credits catch to fielder', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 10, balls: 8, fours: 1, sixes: 0, isOut: true, dismissal: 'caught', fielder: 'B3', fielder2: null, isDirectHit: false },
    ])
    const stats = computeFieldingStats(data)
    expect(stats.length).toBe(1)
    expect(stats[0].name).toBe('B3')
    expect(stats[0].catches).toBe(1)
    expect(stats[0].totalDismissals).toBe(1)
  })

  it('credits run out to fielder and assist', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 5, balls: 4, fours: 0, sixes: 0, isOut: true, dismissal: 'runOut', fielder: 'B4', fielder2: 'B5', isDirectHit: false },
    ])
    const stats = computeFieldingStats(data)
    expect(stats.length).toBe(2)
    const b4 = stats.find(s => s.name === 'B4')
    const b5 = stats.find(s => s.name === 'B5')
    expect(b4.runOuts).toBe(1)
    expect(b5.runOuts).toBe(1)
  })

  it('tracks direct hit run outs', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 0, balls: 1, fours: 0, sixes: 0, isOut: true, dismissal: 'runOut', fielder: 'B6', fielder2: null, isDirectHit: true },
    ])
    const stats = computeFieldingStats(data)
    expect(stats[0].directHitRunOuts).toBe(1)
  })

  it('credits stumping to keeper', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 3, balls: 5, fours: 0, sixes: 0, isOut: true, dismissal: 'stumped', fielder: 'B1', fielder2: null, isDirectHit: false },
    ])
    const stats = computeFieldingStats(data)
    expect(stats[0].stumpings).toBe(1)
  })

  it('ignores bowled/lbw (no fielder)', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 0, balls: 1, fours: 0, sixes: 0, isOut: true, dismissal: 'bowled', fielder: null },
      { name: 'A2', runs: 5, balls: 3, fours: 1, sixes: 0, isOut: true, dismissal: 'lbw', fielder: null },
    ])
    const stats = computeFieldingStats(data)
    expect(stats.length).toBe(0)
  })

  it('ignores dismissed batsmen without fielder (legacy)', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 10, balls: 8, fours: 1, sixes: 0, isOut: true, dismissal: 'caught' },
    ])
    const stats = computeFieldingStats(data)
    expect(stats.length).toBe(0)
  })

  it('aggregates multiple dismissals for same fielder', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 10, balls: 8, fours: 1, sixes: 0, isOut: true, dismissal: 'caught', fielder: 'B3', fielder2: null, isDirectHit: false },
      { name: 'A2', runs: 5, balls: 4, fours: 0, sixes: 0, isOut: true, dismissal: 'caught', fielder: 'B3', fielder2: null, isDirectHit: false },
    ])
    const stats = computeFieldingStats(data)
    expect(stats.length).toBe(1)
    expect(stats[0].catches).toBe(2)
    expect(stats[0].totalDismissals).toBe(2)
  })

  it('sorts by totalDismissals descending', () => {
    const data = makeMatchData([
      { name: 'A1', runs: 10, balls: 8, fours: 1, sixes: 0, isOut: true, dismissal: 'caught', fielder: 'B3', fielder2: null, isDirectHit: false },
      { name: 'A2', runs: 5, balls: 4, fours: 0, sixes: 0, isOut: true, dismissal: 'caught', fielder: 'B3', fielder2: null, isDirectHit: false },
      { name: 'A3', runs: 0, balls: 1, fours: 0, sixes: 0, isOut: true, dismissal: 'runOut', fielder: 'B7', fielder2: null, isDirectHit: true },
    ])
    const stats = computeFieldingStats(data)
    expect(stats[0].name).toBe('B3')
    expect(stats[0].totalDismissals).toBe(2)
    expect(stats[1].name).toBe('B7')
    expect(stats[1].totalDismissals).toBe(1)
  })
})

// ─── Legacy team-level fielding stats ───────────────────────

describe('computeTeamFieldingStats (legacy)', () => {
  it('returns team-level totals', () => {
    const data = [{
      matchMeta: { id: '1', matchNumber: 1, type: 'league', team1Id: 'ta', team2Id: 'tb' },
      matchState: {
        team1: 'Team A', team2: 'Team B',
        innings: [{
          battingTeam: 'Team A', bowlingTeam: 'Team B',
          batsmen: [
            { name: 'A1', isOut: true, dismissal: 'caught', fielder: 'B3' },
            { name: 'A2', isOut: true, dismissal: 'bowled' },
          ],
          bowlers: [], totalRuns: 20, wickets: 2,
          oversCompleted: 5, ballsInCurrentOver: 0,
          currentOver: [], allOvers: [], extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          fallOfWickets: [], bowlerOversMap: {},
        }, null, null, null],
      },
    }]
    const stats = computeTeamFieldingStats(data)
    expect(stats.length).toBe(1)
    expect(stats[0].catches).toBe(1)
    expect(stats[0].bowled).toBe(1)
  })
})

// ─── Edge cases ─────────────────────────────────────────────

describe('Edge cases', () => {
  it('fielder data not lost on normal ball after wicket', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'caught', fielder: 'B3', newBatsman: 'A3',
    })
    // Score a normal ball
    state = scoreBall(state, { runs: 4 })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.name === 'A1')
    expect(dismissed.fielder).toBe('B3')
  })

  it('wicket without fielder fields default to null/false', () => {
    let state = setupMatch()
    state = scoreBall(state, {
      wicket: true, dismissalType: 'bowled', newBatsman: 'A3',
    })
    const inn = getInn(state)
    const dismissed = inn.batsmen.find(b => b.isOut)
    expect(dismissed.fielder).toBeNull()
    expect(dismissed.fielder2).toBeNull()
    expect(dismissed.isDirectHit).toBe(false)
  })

  it('formatDismissal handles unknown dismissal type', () => {
    const bat = { dismissal: 'retiredHurt' }
    expect(formatDismissal(bat, 'Jones')).toBe('retiredHurt')
  })

  it('caught with no bowlerName falls back gracefully', () => {
    const bat = { dismissal: 'caught', fielder: 'Smith' }
    expect(formatDismissal(bat, null)).toBe('c Smith b null')
  })
})
