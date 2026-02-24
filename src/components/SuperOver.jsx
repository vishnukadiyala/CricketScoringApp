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

  // Opener selection state
  const [selectedOpeners, setSelectedOpeners] = useState([])
  const [strikerChoice, setStrikerChoice] = useState('')

  // Wicket modal state
  const [wicketStep, setWicketStep] = useState(1)
  const [wicketType, setWicketType] = useState('')
  const [runOutTarget, setRunOutTarget] = useState('striker')
  const [runOutRuns, setRunOutRuns] = useState(0)
  const [fielder, setFielder] = useState('')
  const [fielder2, setFielder2] = useState('')
  const [isDirectHit, setIsDirectHit] = useState(false)
  const [showCustomFielder, setShowCustomFielder] = useState(false)
  const [customFielder, setCustomFielder] = useState('')
  const [showCustomFielder2, setShowCustomFielder2] = useState(false)
  const [customFielder2, setCustomFielder2] = useState('')
  const [newBatsman, setNewBatsman] = useState('')

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
      setSelectedOpeners([])
      setStrikerChoice('')
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
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Opener selection phases
  if (superOver.phase === 'select-openers-1' || superOver.phase === 'select-openers-2') {
    const isFirst = superOver.phase === 'select-openers-1'
    const battingTeam = isFirst ? superOver.battingFirst : superOver.battingSecond
    const battingTeamKey = battingTeam === team1 ? 'team1' : 'team2'
    const nominees = superOver[`${battingTeamKey}Batsmen`]

    const toggleOpener = (name) => {
      setSelectedOpeners(prev =>
        prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 2 ? [...prev, name] : prev
      )
      // Reset striker if deselecting
      if (selectedOpeners.includes(name)) {
        if (strikerChoice === name) setStrikerChoice('')
      }
    }

    const handleOpenerConfirm = () => {
      setError('')
      if (selectedOpeners.length !== 2) {
        setError('Select exactly 2 openers')
        return
      }
      if (!strikerChoice) {
        setError('Select who takes strike')
        return
      }
      const nonStriker = selectedOpeners.find(n => n !== strikerChoice)
      dispatch({
        type: 'SET_SUPER_OVER_OPENERS',
        openerOnStrike: strikerChoice,
        openerNonStrike: nonStriker,
        inningsNumber: isFirst ? 1 : 2,
      })
      setSelectedOpeners([])
      setStrikerChoice('')
      setError('')
    }

    return (
      <div className="setup-container">
        <div className="card">
          <h2>Super Over — {battingTeam}</h2>
          <p className="subtitle">Select 2 openers from {SUPER_OVER_BATSMEN} nominees</p>

          <div className="form-group">
            <label>Openers ({selectedOpeners.length}/2)</label>
            <div className="xi-grid">
              {nominees.map(name => (
                <button
                  key={name}
                  className={`chip ${selectedOpeners.includes(name) ? 'active' : ''}`}
                  onClick={() => toggleOpener(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {selectedOpeners.length === 2 && (
            <div className="form-group">
              <label>Who takes strike?</label>
              <div className="btn-group">
                {selectedOpeners.map(name => (
                  <button
                    key={name}
                    className={`btn ${strikerChoice === name ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setStrikerChoice(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}
          <button
            className="btn btn-primary btn-block"
            onClick={handleOpenerConfirm}
            disabled={selectedOpeners.length !== 2 || !strikerChoice}
          >
            Start Innings
          </button>
        </div>
      </div>
    )
  }

  // Between innings
  if (superOver.phase === 'between-innings') {
    const inn1 = superOver.innings1
    return (
      <div className="setup-container">
        <div className="card innings-break">
          <h2>End of {superOver.battingFirst} Innings</h2>
          <div className="innings-summary">
            <span className="team-name">{superOver.battingFirst}</span>
            <span className="final-score">{inn1.totalRuns}/{inn1.wickets}</span>
            <span className="overs">({inn1.oversCompleted}.{inn1.ballsInCurrentOver} ov)</span>
          </div>

          {/* Batsmen summary */}
          <div className="so-between-batsmen">
            {inn1.batsmen.filter(b => b.balls > 0 || b.runs > 0).map((b, i) => (
              <div key={i} className="so-between-batsman-row">
                <span>{b.name}{b.isOut ? '' : '*'}</span>
                <span>{b.runs} ({b.balls})</span>
              </div>
            ))}
          </div>

          <div className="target-info">
            <span className="target-label">Target for {superOver.battingSecond}</span>
            <span className="target-score">{inn1.totalRuns + 1}</span>
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              setSelectedOpeners([])
              setStrikerChoice('')
              dispatch({ type: 'SO_NEXT_INNINGS' })
            }}
          >
            Start {superOver.battingSecond} Innings
          </button>
        </div>
      </div>
    )
  }

  // Batting phases (batting-1 or batting-2)
  if (superOver.phase === 'batting-1' || superOver.phase === 'batting-2') {
    const isFirst = superOver.phase === 'batting-1'
    const battingTeam = isFirst ? superOver.battingFirst : superOver.battingSecond
    const bowlingTeam = isFirst ? superOver.battingSecond : superOver.battingFirst
    const inn = isFirst ? superOver.innings1 : superOver.innings2
    if (!inn) return null

    const bowlingTeamKey = bowlingTeam === team1 ? 'team1' : 'team2'
    const fieldingXI = activeRosters[bowlingTeamKey].filter(p => !p.substituted).map(p => p.name)

    const striker = inn.batsmen[inn.activeBatsmanIndex]
    const nonStriker = inn.batsmen[inn.nonStrikerIndex]
    const bowler = inn.bowlers[inn.currentBowlerIndex]

    const inningsOver = inn.ballsInCurrentOver >= SUPER_OVER_BALLS || inn.wickets >= SUPER_OVER_WICKETS
    const targetReached = !isFirst && inn.target > 0 && inn.totalRuns >= inn.target
    const canScore = !inningsOver && !targetReached
    const ballsRemaining = SUPER_OVER_BALLS - inn.ballsInCurrentOver
    const isFreeHit = superOver.lastBallWasNoBall

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

    const handleUndo = () => {
      if (!canUndoSuperOver || isProcessing) return
      handleAction(() => {
        dispatch({ type: 'UNDO_LAST_SUPER_OVER_BALL' })
      })
    }

    // Reset wicket state
    const resetWicketState = () => {
      setShowWicket(false)
      setWicketStep(1)
      setWicketType('')
      setRunOutTarget('striker')
      setRunOutRuns(0)
      setFielder('')
      setFielder2('')
      setIsDirectHit(false)
      setShowCustomFielder(false)
      setCustomFielder('')
      setShowCustomFielder2(false)
      setCustomFielder2('')
      setNewBatsman('')
    }

    const needsFielder = (type) => ['caught', 'runOut', 'stumped'].includes(type)

    const wicketTypeLabels = {
      caught: 'Caught',
      bowled: 'Bowled',
      runOut: 'Run Out',
      lbw: 'LBW',
      stumped: 'Stumped',
      hitWicket: 'Hit Wicket',
    }

    // On free hit, only run out is allowed
    const availableWicketTypes = isFreeHit
      ? ['runOut']
      : ['caught', 'bowled', 'runOut', 'lbw', 'stumped', 'hitWicket']

    const advanceAfterType = (type) => {
      setWicketType(type)
      if (type === 'runOut') {
        setWicketStep(2)
      } else if (needsFielder(type)) {
        setWicketStep(3)
      } else {
        // bowled, lbw, hitWicket → skip to confirmation
        setWicketStep(4)
      }
    }

    const isLastWicket = inn.wickets + 1 >= SUPER_OVER_WICKETS

    const getReserveBatsman = () => {
      return inn.batsmen.find(b => !b.isOut &&
        inn.batsmen.indexOf(b) !== inn.activeBatsmanIndex &&
        inn.batsmen.indexOf(b) !== inn.nonStrikerIndex)
    }

    const getSummaryText = () => {
      const dismissedName = wicketType === 'runOut' && runOutTarget === 'nonStriker'
        ? nonStriker?.name : striker?.name
      if (wicketType === 'caught') return `c ${fielder} b ${bowler?.name} — ${dismissedName}`
      if (wicketType === 'bowled') return `b ${bowler?.name} — ${dismissedName}`
      if (wicketType === 'lbw') return `lbw b ${bowler?.name} — ${dismissedName}`
      if (wicketType === 'stumped') return `st ${fielder} b ${bowler?.name} — ${dismissedName}`
      if (wicketType === 'hitWicket') return `hit wicket b ${bowler?.name} — ${dismissedName}`
      if (wicketType === 'runOut') {
        const parts = ['run out']
        if (fielder) parts.push(`(${fielder}${fielder2 ? '/' + fielder2 : ''}${isDirectHit ? ' direct' : ''})`)
        return `${parts.join(' ')} — ${dismissedName}${runOutRuns > 0 ? ` (${runOutRuns} run${runOutRuns > 1 ? 's' : ''} scored)` : ''}`
      }
      return ''
    }

    const scoreWicket = () => {
      handleAction(() => {
        const reserve = getReserveBatsman()
        dispatch({
          type: 'SCORE_SUPER_OVER_BALL',
          runs: wicketType === 'runOut' ? runOutRuns : 0,
          wicket: true,
          dismissalType: wicketType,
          runOutBatsman: wicketType === 'runOut' ? runOutTarget : undefined,
          fielder: fielder || undefined,
          fielder2: fielder2 || undefined,
          isDirectHit: isDirectHit || undefined,
          newBatsman: !isLastWicket && reserve ? reserve.name : undefined,
        })
        resetWicketState()
      })
    }

    // Wicket modal
    if (showWicket) {
      const totalSteps = wicketType === 'runOut' ? 4 : (needsFielder(wicketType) ? 4 : (wicketType ? 2 : 1))
      return (
        <div className="setup-container">
          <div className="card wicket-card">
            <h3>Wicket — Super Over</h3>
            <p className="subtitle">{inn.wickets + 1} of {SUPER_OVER_WICKETS} wickets</p>

            <div className="wicket-step-indicator">
              {[1, 2, 3, 4].slice(0, totalSteps).map(s => (
                <span key={s} className={`step-dot ${wicketStep >= s ? 'active' : ''} ${wicketStep === s ? 'current' : ''}`} />
              ))}
            </div>

            {/* Step 1: Dismissal type */}
            {wicketStep === 1 && (
              <div className="form-group">
                <label>Dismissal Type</label>
                {isFreeHit && <div className="free-hit-notice">FREE HIT — Only Run Out is possible</div>}
                <div className="btn-group wicket-types">
                  {availableWicketTypes.map((type) => (
                    <button
                      key={type}
                      className={`btn ${wicketType === type ? 'btn-danger' : 'btn-outline'}`}
                      onClick={() => advanceAfterType(type)}
                    >
                      {wicketTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Run out details */}
            {wicketStep === 2 && wicketType === 'runOut' && (
              <>
                <div className="form-group">
                  <label>Who was run out?</label>
                  <div className="btn-group">
                    <button
                      className={`btn ${runOutTarget === 'striker' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setRunOutTarget('striker')}
                    >
                      {striker?.name} (Striker)
                    </button>
                    <button
                      className={`btn ${runOutTarget === 'nonStriker' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setRunOutTarget('nonStriker')}
                    >
                      {nonStriker?.name} (Non-Striker)
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Runs scored on this ball</label>
                  <div className="run-buttons">
                    {[0, 1, 2, 3].map((r) => (
                      <button
                        key={r}
                        className={`btn btn-run-small ${runOutRuns === r ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setRunOutRuns(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary btn-block" onClick={() => setWicketStep(3)}>
                  Next
                </button>
              </>
            )}

            {/* Step 3: Fielder selection */}
            {wicketStep === 3 && needsFielder(wicketType) && (
              <>
                <div className="form-group">
                  <label>
                    {wicketType === 'caught' ? 'Caught by' :
                     wicketType === 'stumped' ? 'Stumped by' :
                     'Fielder'}
                  </label>
                  <div className="fielder-grid">
                    {fieldingXI.map(name => (
                      <button
                        key={name}
                        className={`fielder-btn ${fielder === name && !showCustomFielder ? 'selected' : ''}`}
                        onClick={() => { setFielder(name); setShowCustomFielder(false); setCustomFielder('') }}
                      >
                        {name}
                        {wicketType === 'caught' && name === bowler?.name && <span className="fielder-label">(c & b)</span>}
                      </button>
                    ))}
                    <button
                      className={`fielder-btn fielder-btn-custom ${showCustomFielder ? 'selected' : ''}`}
                      onClick={() => { setShowCustomFielder(true); setFielder(customFielder) }}
                    >
                      Emergency Sub
                    </button>
                  </div>
                  {showCustomFielder && (
                    <input
                      type="text"
                      className="custom-fielder-input"
                      placeholder="Type fielder name..."
                      value={customFielder}
                      autoFocus
                      onChange={e => { setCustomFielder(e.target.value); setFielder(e.target.value) }}
                    />
                  )}
                </div>

                {/* Run out: direct hit + assist */}
                {wicketType === 'runOut' && fielder && (
                  <>
                    <div className="form-group">
                      <label className="direct-hit-toggle">
                        <input
                          type="checkbox"
                          checked={isDirectHit}
                          onChange={e => setIsDirectHit(e.target.checked)}
                        />
                        <span>Direct hit</span>
                      </label>
                    </div>
                    <div className="form-group">
                      <label>Assist fielder (optional)</label>
                      <div className="fielder-grid">
                        <button
                          className={`fielder-btn ${!fielder2 && !showCustomFielder2 ? 'selected' : ''}`}
                          onClick={() => { setFielder2(''); setShowCustomFielder2(false) }}
                        >
                          None
                        </button>
                        {fieldingXI.filter(n => n !== fielder).map(name => (
                          <button
                            key={name}
                            className={`fielder-btn ${fielder2 === name && !showCustomFielder2 ? 'selected' : ''}`}
                            onClick={() => { setFielder2(name); setShowCustomFielder2(false); setCustomFielder2('') }}
                          >
                            {name}
                          </button>
                        ))}
                        <button
                          className={`fielder-btn fielder-btn-custom ${showCustomFielder2 ? 'selected' : ''}`}
                          onClick={() => { setShowCustomFielder2(true); setFielder2(customFielder2) }}
                        >
                          Emergency Sub
                        </button>
                      </div>
                      {showCustomFielder2 && (
                        <input
                          type="text"
                          className="custom-fielder-input"
                          placeholder="Type fielder name..."
                          value={customFielder2}
                          autoFocus
                          onChange={e => { setCustomFielder2(e.target.value); setFielder2(e.target.value) }}
                        />
                      )}
                    </div>
                  </>
                )}

                {fielder && (
                  <button className="btn btn-primary btn-block" onClick={() => setWicketStep(4)}>
                    Next
                  </button>
                )}
              </>
            )}

            {/* Step 4: Confirmation + new batsman */}
            {wicketStep === 4 && (
              <>
                <div className="wicket-summary">
                  <div className="wicket-summary-label">OUT</div>
                  <div className="wicket-summary-text">{getSummaryText()}</div>
                </div>

                {!isLastWicket && (
                  <div className="form-group">
                    <label>New Batsman</label>
                    {getReserveBatsman() ? (
                      <div className="new-batsman-grid">
                        <button className="chip active">
                          {getReserveBatsman().name}
                        </button>
                      </div>
                    ) : (
                      <p className="text-muted">No reserve batsman available</p>
                    )}
                  </div>
                )}

                {isLastWicket && (
                  <div className="form-group">
                    <p className="subtitle" style={{ marginTop: 0 }}>Innings Over — {SUPER_OVER_WICKETS} wickets down</p>
                  </div>
                )}

                <button
                  className="btn btn-danger btn-block"
                  onClick={scoreWicket}
                  disabled={isProcessing}
                >
                  Confirm Wicket
                </button>
              </>
            )}

            <button className="btn btn-outline btn-block" onClick={resetWicketState}>
              Cancel
            </button>
          </div>
        </div>
      )
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

    // Main scoring view
    return (
      <div className="setup-container">
        <div className="card">
          <h2>SUPER OVER — {battingTeam} batting</h2>

          {/* Free hit banner */}
          {isFreeHit && canScore && (
            <div className="free-hit-banner">FREE HIT</div>
          )}

          {/* Scoreboard */}
          <div className="so-scoreboard">
            <div className="so-scoreboard-main">
              <span className="so-scoreboard-score">{inn.totalRuns}/{inn.wickets}</span>
              <span className="so-scoreboard-balls">({inn.ballsInCurrentOver} ball{inn.ballsInCurrentOver !== 1 ? 's' : ''})</span>
            </div>

            {/* Batsmen */}
            <div className="so-scoreboard-batsmen">
              {striker && (
                <div className="so-batsman-row">
                  <span className="so-batsman-indicator">*</span>
                  <span className="so-batsman-name">{striker.name}</span>
                  <span className="so-batsman-stats">{striker.runs} ({striker.balls})</span>
                </div>
              )}
              {nonStriker && (
                <div className="so-batsman-row">
                  <span className="so-batsman-indicator"> </span>
                  <span className="so-batsman-name">{nonStriker.name}</span>
                  <span className="so-batsman-stats">{nonStriker.runs} ({nonStriker.balls})</span>
                </div>
              )}
            </div>

            {/* Bowler */}
            {bowler && (
              <div className="so-scoreboard-bowler">
                <span className="so-bowler-label">Bowling:</span>
                <span className="so-bowler-name">{bowler.name}</span>
                <span className="so-bowler-figures">{bowler.overs}.{bowler.ballsInOver}-{bowler.maidens}-{bowler.runs}-{bowler.wickets}</span>
              </div>
            )}

            {/* Target / balls remaining */}
            <div className="so-scoreboard-footer">
              {!isFirst && inn.target > 0 && (
                <span className="so-target-info">
                  {targetReached
                    ? <span className="success-text">Target reached!</span>
                    : `Need ${inn.target - inn.totalRuns} from ${ballsRemaining} ball${ballsRemaining !== 1 ? 's' : ''}`
                  }
                </span>
              )}
              {isFirst && (
                <span className="so-balls-remaining">Balls remaining: {ballsRemaining}</span>
              )}
            </div>
          </div>

          {/* Running comparison */}
          <RunningComparison superOver={superOver} isFirst={isFirst} />

          {/* Ball log */}
          <div className="super-over-log">
            {inn.currentOver.map((ball, i) => (
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
                // When isFirst and between-innings, the reducer already transitioned
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
    const inn1 = superOver.innings1
    const inn2 = superOver.innings2

    return (
      <div className="setup-container">
        <div className="card">
          <h2>Super Over Complete</h2>

          {/* Innings 1 scorecard */}
          {inn1 && (
            <div className="so-scorecard-innings">
              <div className="so-scorecard-header">
                <span className="so-scorecard-team">{superOver.battingFirst}</span>
                <span className="so-scorecard-score">{inn1.totalRuns}/{inn1.wickets}</span>
              </div>
              <div className="so-scorecard-batsmen">
                {inn1.batsmen.filter(b => b.balls > 0 || b.runs > 0).map((b, i) => (
                  <span key={i}>{b.name} {b.runs}({b.balls}){b.isOut ? '' : '*'}  </span>
                ))}
              </div>
              <div className="so-scorecard-bowler">
                Bowling: {inn1.bowlers[0]?.name} {inn1.bowlers[0]?.overs}.{inn1.bowlers[0]?.ballsInOver}-{inn1.bowlers[0]?.maidens}-{inn1.bowlers[0]?.runs}-{inn1.bowlers[0]?.wickets}
              </div>
            </div>
          )}

          {/* Innings 2 scorecard */}
          {inn2 && (
            <div className="so-scorecard-innings">
              <div className="so-scorecard-header">
                <span className="so-scorecard-team">{superOver.battingSecond}</span>
                <span className="so-scorecard-score">{inn2.totalRuns}/{inn2.wickets}</span>
              </div>
              <div className="so-scorecard-batsmen">
                {inn2.batsmen.filter(b => b.balls > 0 || b.runs > 0).map((b, i) => (
                  <span key={i}>{b.name} {b.runs}({b.balls}){b.isOut ? '' : '*'}  </span>
                ))}
              </div>
              <div className="so-scorecard-bowler">
                Bowling: {inn2.bowlers[0]?.name} {inn2.bowlers[0]?.overs}.{inn2.bowlers[0]?.ballsInOver}-{inn2.bowlers[0]?.maidens}-{inn2.bowlers[0]?.runs}-{inn2.bowlers[0]?.wickets}
              </div>
              {inn2.target > 0 && (
                <div className="so-scorecard-target">Target: {inn2.target}</div>
              )}
            </div>
          )}

          {/* Ball logs */}
          <div className="super-over-log-summary">
            {inn1 && (
              <div className="so-log-team">
                <span className="so-log-label">{superOver.battingFirst}:</span>
                <span className="super-over-log">
                  {[...(inn1.allOvers?.[0] || []), ...inn1.currentOver].map((ball, i) => (
                    <span key={i} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                  ))}
                </span>
              </div>
            )}
            {inn2 && (
              <div className="so-log-team">
                <span className="so-log-label">{superOver.battingSecond}:</span>
                <span className="super-over-log">
                  {[...(inn2.allOvers?.[0] || []), ...inn2.currentOver].map((ball, i) => (
                    <span key={i} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                  ))}
                </span>
              </div>
            )}
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

  if (!inn1 || (isFirst && inn1.ballsInCurrentOver === 0)) return null

  return (
    <div className="so-comparison">
      <div className="so-comparison-row">
        <span className="so-comparison-team">{superOver.battingFirst}</span>
        <span className="so-comparison-score">{inn1.totalRuns}/{inn1.wickets}</span>
        <span className="so-comparison-balls">({inn1.ballsInCurrentOver}b)</span>
      </div>
      {!isFirst && inn2 && (
        <div className="so-comparison-row so-comparison-chasing">
          <span className="so-comparison-team">{superOver.battingSecond}</span>
          <span className="so-comparison-score">{inn2.totalRuns}/{inn2.wickets}</span>
          <span className="so-comparison-balls">({inn2.ballsInCurrentOver}b)</span>
        </div>
      )}
    </div>
  )
}

// Boundary count breakdown for tied-again scenario
function BoundaryCountBreakdown({ superOver, team1, team2, cumulativeBoundaries }) {
  const team1IsFirst = superOver.battingFirst === team1
  const soFours1 = team1IsFirst ? (superOver.innings1?.fours || 0) : (superOver.innings2?.fours || 0)
  const soSixes1 = team1IsFirst ? (superOver.innings1?.sixes || 0) : (superOver.innings2?.sixes || 0)
  const soFours2 = team1IsFirst ? (superOver.innings2?.fours || 0) : (superOver.innings1?.fours || 0)
  const soSixes2 = team1IsFirst ? (superOver.innings2?.sixes || 0) : (superOver.innings1?.sixes || 0)

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
