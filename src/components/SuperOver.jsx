import { useState } from 'react'
import { useMatch } from '../context/MatchContext'
import { getBallClass } from '../lib/ballDisplay'
import { SUPER_OVER_BATSMEN, SUPER_OVER_BALLS, SUPER_OVER_WICKETS } from '../lib/constants'
import BallHistoryTimeline from './BallHistoryTimeline'

export default function SuperOver() {
  const {
    phase, superOver, canUndoSuperOver, team1, team2,
    activeRosters, cumulativeBoundaries, dispatch,
  } = useMatch()

  const [t1Batsmen, setT1Batsmen] = useState([])
  const [t1Bowler, setT1Bowler] = useState('')
  const [t2Batsmen, setT2Batsmen] = useState([])
  const [t2Bowler, setT2Bowler] = useState('')
  const [error, setError] = useState('')
  const [showExtras, setShowExtras] = useState(false)
  const [extraType, setExtraType] = useState('')
  const [extraRuns, setExtraRuns] = useState(0)
  const [showWicket, setShowWicket] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  if (phase !== 'super-over') return null

  // Initial trigger — match just tied
  if (!superOver) {
    return (
      <div className="setup-container">
        <div className="card">
          <h2>Match Tied!</h2>
          <p className="subtitle">Cumulative scores are level — Super Over required</p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'START_SUPER_OVER' })}
          >
            Start Super Over
          </button>
        </div>
      </div>
    )
  }

  // Tied-again phase — boundary count also equal
  if (superOver.phase === 'tied-again') {
    return (
      <div className="setup-container">
        <div className="card">
          <h2>Super Over Also Tied!</h2>
          <p className="subtitle">Boundary count is also equal across all innings and the Super Over.</p>

          <BoundaryCountBreakdown
            superOver={superOver}
            team1={team1}
            team2={team2}
            cumulativeBoundaries={cumulativeBoundaries}
          />

          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              setT1Batsmen([])
              setT1Bowler('')
              setT2Batsmen([])
              setT2Bowler('')
              dispatch({ type: 'RESTART_SUPER_OVER' })
            }}
          >
            Another Super Over
          </button>
          <button
            className="btn btn-outline btn-block"
            style={{ marginTop: '8px' }}
            onClick={() => dispatch({ type: 'END_AS_TIE' })}
          >
            End as Tie
          </button>
        </div>
      </div>
    )
  }

  // Player selection phase
  if (superOver.phase === 'select-players') {
    const team1Key = superOver.battingFirst === team1 ? 'team1' : 'team2'
    const team2Key = team1Key === 'team1' ? 'team2' : 'team1'
    const t1Name = superOver.battingFirst
    const t2Name = superOver.battingSecond

    const t1Players = activeRosters[team1Key].filter(p => !p.substituted).map(p => p.name)
    const t2Players = activeRosters[team2Key].filter(p => !p.substituted).map(p => p.name)

    const toggleBatsman = (name, team) => {
      if (team === 1) {
        setT1Batsmen(prev =>
          prev.includes(name) ? prev.filter(n => n !== name) : prev.length < SUPER_OVER_BATSMEN ? [...prev, name] : prev
        )
      } else {
        setT2Batsmen(prev =>
          prev.includes(name) ? prev.filter(n => n !== name) : prev.length < SUPER_OVER_BATSMEN ? [...prev, name] : prev
        )
      }
    }

    const handleConfirm = () => {
      setError('')
      if (t1Batsmen.length !== SUPER_OVER_BATSMEN) {
        setError(`${t1Name} must select exactly ${SUPER_OVER_BATSMEN} batsmen`)
        return
      }
      if (!t2Bowler) {
        setError(`Select a bowler to bowl to ${t1Name}`)
        return
      }
      if (t2Batsmen.length !== SUPER_OVER_BATSMEN) {
        setError(`${t2Name} must select exactly ${SUPER_OVER_BATSMEN} batsmen`)
        return
      }
      if (!t1Bowler) {
        setError(`Select a bowler to bowl to ${t2Name}`)
        return
      }
      dispatch({
        type: 'SET_SUPER_OVER_PLAYERS',
        team1Batsmen: t1Batsmen,
        team1Bowler: t1Bowler,
        team2Batsmen: t2Batsmen,
        team2Bowler: t2Bowler,
      })
    }

    return (
      <div className="setup-container">
        <div className="card">
          <h2>Super Over — Select Players</h2>

          {/* Team batting first: select batsmen */}
          <div className="form-group">
            <label>{t1Name} — {SUPER_OVER_BATSMEN} Batsmen ({t1Batsmen.length}/{SUPER_OVER_BATSMEN})</label>
            <div className="xi-grid">
              {t1Players.map(name => (
                <button
                  key={name}
                  className={`chip ${t1Batsmen.includes(name) ? 'active' : ''}`}
                  onClick={() => toggleBatsman(name, 1)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Team 2 bowler (bowls to team 1) */}
          <div className="form-group">
            <label>{t2Name} — Bowler (bowls to {t1Name})</label>
            <select
              className="form-select"
              value={t2Bowler}
              onChange={(e) => setT2Bowler(e.target.value)}
            >
              <option value="">Select bowler</option>
              {t2Players.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <hr className="rotation-divider" />

          {/* Team batting second: select batsmen */}
          <div className="form-group">
            <label>{t2Name} — {SUPER_OVER_BATSMEN} Batsmen ({t2Batsmen.length}/{SUPER_OVER_BATSMEN})</label>
            <div className="xi-grid">
              {t2Players.map(name => (
                <button
                  key={name}
                  className={`chip ${t2Batsmen.includes(name) ? 'active' : ''}`}
                  onClick={() => toggleBatsman(name, 2)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Team 1 bowler (bowls to team 2) */}
          <div className="form-group">
            <label>{t1Name} — Bowler (bowls to {t2Name})</label>
            <select
              className="form-select"
              value={t1Bowler}
              onChange={(e) => setT1Bowler(e.target.value)}
            >
              <option value="">Select bowler</option>
              {t1Players.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary btn-block" onClick={handleConfirm}>
            Start Super Over
          </button>
        </div>
      </div>
    )
  }

  // Batting phases (batting-1 or batting-2)
  if (superOver.phase === 'batting-1' || superOver.phase === 'batting-2') {
    const isFirst = superOver.phase === 'batting-1'
    const battingTeam = isFirst ? superOver.battingFirst : superOver.battingSecond
    const inn = isFirst ? superOver.innings1 : superOver.innings2
    const bowlerName = isFirst ? superOver.team2Bowler : superOver.team1Bowler
    const inningsOver = inn.balls >= SUPER_OVER_BALLS || inn.wickets >= SUPER_OVER_WICKETS
    const targetReached = !isFirst && inn.target > 0 && inn.runs >= inn.target
    const canScore = !inningsOver && !targetReached

    const handleAction = (actionFn) => {
      if (isProcessing) return
      setIsProcessing(true)
      actionFn()
      setTimeout(() => setIsProcessing(false), 150)
    }

    const scoreBall = (runs) => {
      handleAction(() => {
        dispatch({ type: 'SCORE_SUPER_OVER_BALL', runs })
      })
    }

    const scoreExtra = () => {
      if (!extraType) return
      handleAction(() => {
        dispatch({
          type: 'SCORE_SUPER_OVER_BALL',
          runs: extraRuns,
          extraType,
          runType: extraType === 'noBall' ? 'bat' : 'extra',
        })
        setShowExtras(false)
        setExtraType('')
        setExtraRuns(0)
      })
    }

    const scoreWicket = () => {
      handleAction(() => {
        dispatch({ type: 'SCORE_SUPER_OVER_BALL', runs: 0, wicket: true })
        setShowWicket(false)
      })
    }

    const handleUndo = () => {
      if (!canUndoSuperOver || isProcessing) return
      handleAction(() => {
        dispatch({ type: 'UNDO_LAST_SUPER_OVER_BALL' })
      })
    }

    // Extras panel
    if (showExtras) {
      return (
        <div className="setup-container">
          <div className="card">
            <h3>Extras — Super Over</h3>
            <div className="btn-group extras-type">
              {['wide', 'noBall', 'bye', 'legBye'].map((type) => (
                <button
                  key={type}
                  className={`btn ${extraType === type ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setExtraType(type); setExtraRuns(type === 'wide' || type === 'noBall' ? 0 : 1) }}
                >
                  {type === 'noBall' ? 'No Ball' : type === 'legBye' ? 'Leg Bye' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            {extraType && (
              <>
                <div className="form-group">
                  <label>{extraType === 'wide' || extraType === 'noBall' ? 'Additional runs' : 'Runs'}</label>
                  <div className="run-buttons">
                    {[0, 1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        className={`btn btn-run-small ${extraRuns === r ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setExtraRuns(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary btn-block" onClick={scoreExtra} disabled={isProcessing}>
                  Confirm
                </button>
              </>
            )}
            <button className="btn btn-outline btn-block" onClick={() => { setShowExtras(false); setExtraType(''); setExtraRuns(0) }}>
              Cancel
            </button>
          </div>
        </div>
      )
    }

    // Wicket confirmation
    if (showWicket) {
      return (
        <div className="setup-container">
          <div className="card wicket-card">
            <h3>Wicket — Super Over</h3>
            <p className="subtitle">
              {inn.wickets + 1} of {SUPER_OVER_WICKETS} wickets
            </p>
            <button className="btn btn-danger btn-block" onClick={scoreWicket} disabled={isProcessing}>
              Confirm Wicket
            </button>
            <button className="btn btn-outline btn-block" onClick={() => setShowWicket(false)}>
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="setup-container">
        <div className="card">
          <h2>Super Over — {battingTeam}</h2>
          <p className="subtitle">Bowler: {bowlerName}</p>

          {/* Running comparison */}
          <RunningComparison superOver={superOver} isFirst={isFirst} />

          {/* Current innings score */}
          <div className="super-over-score">
            <span className="score">{inn.runs}/{inn.wickets}</span>
            <span className="overs">({inn.balls}/{SUPER_OVER_BALLS} balls)</span>
          </div>

          {!isFirst && inn.target > 0 && (
            <div className="super-over-target">
              {targetReached
                ? <span className="success-text">Target reached!</span>
                : `Need ${inn.target - inn.runs} from ${SUPER_OVER_BALLS - inn.balls} balls`
              }
            </div>
          )}

          {/* Ball log */}
          <div className="super-over-log">
            {inn.ballLog.map((ball, i) => (
              <span key={i} className={`ball-badge ${getBallClass(ball)}`}>{ball}</span>
            ))}
          </div>

          {/* Ball history timeline for multi-ball undo */}
          <BallHistoryTimeline isSuper />

          {/* Scoring panel */}
          {canScore && (
            <div className="super-over-buttons">
              <div className="run-buttons-grid">
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <button
                    key={r}
                    className={`btn btn-run ${r === 4 ? 'four' : r === 6 ? 'six' : ''}`}
                    onClick={() => scoreBall(r)}
                    disabled={isProcessing}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="extras-row">
                <button type="button" className="btn btn-outline btn-extra" onClick={() => { setExtraType('wide'); setExtraRuns(0); setShowExtras(true) }} disabled={isProcessing}>
                  Wide
                </button>
                <button type="button" className="btn btn-outline btn-extra" onClick={() => { setExtraType('noBall'); setExtraRuns(0); setShowExtras(true) }} disabled={isProcessing}>
                  No Ball
                </button>
                <button type="button" className="btn btn-outline btn-extra" onClick={() => { setExtraType('bye'); setExtraRuns(1); setShowExtras(true) }} disabled={isProcessing}>
                  Bye
                </button>
                <button type="button" className="btn btn-outline btn-extra" onClick={() => { setExtraType('legBye'); setExtraRuns(1); setShowExtras(true) }} disabled={isProcessing}>
                  Leg Bye
                </button>
              </div>

              <button
                type="button"
                className="btn btn-danger btn-wicket"
                onClick={() => setShowWicket(true)}
                disabled={isProcessing}
              >
                WICKET
              </button>

              <div className="scoring-footer">
                <button
                  type="button"
                  className="btn btn-undo"
                  onClick={handleUndo}
                  disabled={!canUndoSuperOver || isProcessing}
                >
                  Undo
                </button>
              </div>
            </div>
          )}

          {/* Innings over — transition button */}
          {!canScore && (
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                if (!isFirst) {
                  dispatch({ type: 'SUPER_OVER_RESULT' })
                }
                // When isFirst, reducer already transitioned to batting-2
              }}
              style={{ marginTop: '16px' }}
            >
              {isFirst ? 'Next Innings' : 'See Result'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Result phase
  if (superOver.phase === 'result') {
    return (
      <div className="setup-container">
        <div className="card">
          <h2>Super Over Complete</h2>
          <div className="super-over-final">
            <div>{superOver.battingFirst}: {superOver.innings1.runs}/{superOver.innings1.wickets} ({superOver.innings1.balls} balls)</div>
            <div>{superOver.battingSecond}: {superOver.innings2.runs}/{superOver.innings2.wickets} ({superOver.innings2.balls} balls)</div>
          </div>

          <div className="super-over-log-summary">
            <div className="so-log-team">
              <span className="so-log-label">{superOver.battingFirst}:</span>
              <span className="super-over-log">
                {superOver.innings1.ballLog.map((ball, i) => (
                  <span key={i} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                ))}
              </span>
            </div>
            <div className="so-log-team">
              <span className="so-log-label">{superOver.battingSecond}:</span>
              <span className="super-over-log">
                {superOver.innings2.ballLog.map((ball, i) => (
                  <span key={i} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                ))}
              </span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'SUPER_OVER_RESULT' })}
          >
            See Final Result
          </button>
        </div>
      </div>
    )
  }

  return null
}

// Running comparison between the two super over innings
function RunningComparison({ superOver, isFirst }) {
  const inn1 = superOver.innings1
  const inn2 = superOver.innings2

  if (isFirst && inn1.balls === 0) return null

  return (
    <div className="so-comparison">
      <div className="so-comparison-row">
        <span className="so-comparison-team">{superOver.battingFirst}</span>
        <span className="so-comparison-score">{inn1.runs}/{inn1.wickets}</span>
        <span className="so-comparison-balls">({inn1.balls}b)</span>
      </div>
      {!isFirst && (
        <div className="so-comparison-row so-comparison-chasing">
          <span className="so-comparison-team">{superOver.battingSecond}</span>
          <span className="so-comparison-score">{inn2.runs}/{inn2.wickets}</span>
          <span className="so-comparison-balls">({inn2.balls}b)</span>
        </div>
      )}
    </div>
  )
}

// Boundary count breakdown for tied-again scenario
function BoundaryCountBreakdown({ superOver, team1, team2, cumulativeBoundaries }) {
  const team1IsFirst = superOver.battingFirst === team1
  const soFours1 = team1IsFirst ? superOver.innings1.fours : superOver.innings2.fours
  const soSixes1 = team1IsFirst ? superOver.innings1.sixes : superOver.innings2.sixes
  const soFours2 = team1IsFirst ? superOver.innings2.fours : superOver.innings1.fours
  const soSixes2 = team1IsFirst ? superOver.innings2.sixes : superOver.innings1.sixes

  const t1Total = cumulativeBoundaries.team1.fours + cumulativeBoundaries.team1.sixes + soFours1 + soSixes1
  const t2Total = cumulativeBoundaries.team2.fours + cumulativeBoundaries.team2.sixes + soFours2 + soSixes2

  return (
    <div className="boundary-breakdown">
      <h4>Boundary Count</h4>
      <div className="cumulative-row">
        <span>{team1}</span>
        <span>{cumulativeBoundaries.team1.fours + soFours1} fours + {cumulativeBoundaries.team1.sixes + soSixes1} sixes = <strong>{t1Total}</strong></span>
      </div>
      <div className="cumulative-row">
        <span>{team2}</span>
        <span>{cumulativeBoundaries.team2.fours + soFours2} fours + {cumulativeBoundaries.team2.sixes + soSixes2} sixes = <strong>{t2Total}</strong></span>
      </div>
    </div>
  )
}
