import { useState } from 'react'
import { useMatch } from '../context/MatchContext'
import { useCommentary } from '../context/CommentaryContext'
import { MAX_OVERS_PER_BOWLER, MAX_WICKETS } from '../lib/constants'
import { formatDismissal } from '../lib/dismissalText'

export default function Scoring() {
  const matchState = useMatch()
  const {
    phase, innings, currentInnings, activeRosters, team1,
    lastBallWasNoBall, canUndo, dispatch,
  } = matchState
  const commentary = useCommentary()
  const [showExtras, setShowExtras] = useState(false)
  const [showWicket, setShowWicket] = useState(false)
  const [wicketType, setWicketType] = useState('')
  const [newBatsman, setNewBatsman] = useState('')
  const [runOutTarget, setRunOutTarget] = useState('striker')
  const [runOutRuns, setRunOutRuns] = useState(0)
  const [extraType, setExtraType] = useState('')
  const [extraRuns, setExtraRuns] = useState(0)
  const [newBowlerName, setNewBowlerName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [fielder, setFielder] = useState('')
  const [fielder2, setFielder2] = useState('')
  const [isDirectHit, setIsDirectHit] = useState(false)
  const [wicketStep, setWicketStep] = useState(1)
  const [customFielder, setCustomFielder] = useState('')
  const [showCustomFielder, setShowCustomFielder] = useState(false)
  const [customFielder2, setCustomFielder2] = useState('')
  const [showCustomFielder2, setShowCustomFielder2] = useState(false)

  const inn = innings?.[currentInnings]
  if (!inn) return null

  const battingKey = inn.battingTeam === team1 ? 'team1' : 'team2'
  const bowlingKey = inn.bowlingTeam === team1 ? 'team1' : 'team2'

  // New bowler selection screen
  if (phase === 'new-bowler') {
    const previousBowler = (inn.bowlers || [])[inn.currentBowlerIndex]?.name
    const bowlingPlayers = (activeRosters[bowlingKey] || [])
      .filter(p => !p.substituted)
      .map(p => p.name)

    const maxOvers = MAX_OVERS_PER_BOWLER
    const availableBowlers = bowlingPlayers.filter(name => {
      if (name === previousBowler) return false
      return (inn.bowlerOversMap?.[name] || 0) < maxOvers
    })

    const previousBowlers = (inn.bowlers || []).filter(b => b.name !== previousBowler)

    return (
      <div className="scoring-panel">
        <div className="card">
          <h3>Over {inn.oversCompleted + 1} — Select Bowler</h3>
          <p className="subtitle">Previous: {previousBowler}</p>

          <div className="bowler-select-grid">
            {availableBowlers.map(name => {
              const overs = inn.bowlerOversMap?.[name] || 0
              const bowlerObj = inn.bowlers.find(b => b.name === name)
              return (
                <button
                  key={name}
                  className={`bowler-select-btn ${newBowlerName === name ? 'selected' : ''}`}
                  onClick={() => setNewBowlerName(name)}
                >
                  <span className="bowler-select-name">{name}</span>
                  <span className="bowler-select-stats">
                    {bowlerObj ? `${bowlerObj.overs}.${bowlerObj.ballsInOver}-${bowlerObj.maidens}-${bowlerObj.runs}-${bowlerObj.wickets}` : 'New'}
                  </span>
                  <span className="bowler-select-cap">{overs}/{maxOvers} overs</span>
                </button>
              )
            })}
          </div>

          {previousBowlers.length > 0 && (
            <div className="previous-bowlers">
              <label>Previous bowlers:</label>
              <div className="bowler-chips">
                {previousBowlers.map((b) => {
                  const overs = inn.bowlerOversMap?.[b.name] || 0
                  const atCap = overs >= maxOvers
                  return (
                    <button
                      key={b.name}
                      className={`chip ${newBowlerName === b.name ? 'active' : ''} ${atCap ? 'disabled' : ''}`}
                      onClick={() => !atCap && setNewBowlerName(b.name)}
                      disabled={atCap}
                    >
                      {b.name} ({b.overs}-{b.maidens}-{b.runs}-{b.wickets}) [{overs}/{maxOvers}]
                      {atCap && <span className="done-badge">DONE</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            disabled={!newBowlerName.trim()}
            onClick={() => {
              dispatch({ type: 'SET_BOWLER', bowler: newBowlerName.trim() })
              setNewBowlerName('')
            }}
          >
            Start Over
          </button>

          <div className="scoring-footer">
            <button
              type="button"
              className="btn btn-undo"
              aria-label="Undo last ball"
              onClick={() => {
                if (!canUndo || isProcessing) return
                setIsProcessing(true)
                dispatch({ type: 'UNDO_LAST_BALL' })
                setNewBowlerName('')
                setTimeout(() => setIsProcessing(false), 150)
              }}
              disabled={!canUndo || isProcessing}
            >
              Undo Last Ball
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase !== 'scoring') return null

  const handleAction = (actionFn) => {
    if (isProcessing) return
    setIsProcessing(true)
    actionFn()
    setTimeout(() => setIsProcessing(false), 150)
  }

  const scoreBall = (runs) => {
    handleAction(() => {
      const action = { type: 'SCORE_BALL', runs, runType: 'bat' }
      dispatch(action)
      commentary.requestCommentary(matchState, action)
    })
  }

  const scoreExtra = () => {
    if (!extraType) return
    handleAction(() => {
      const action = {
        type: 'SCORE_BALL',
        runs: extraRuns,
        extraType,
        runType: extraType === 'noBall' ? 'bat' : 'extra',
      }
      dispatch(action)
      commentary.requestCommentary(matchState, action)
      setShowExtras(false)
      setExtraType('')
      setExtraRuns(0)
    })
  }

  const resetWicketState = () => {
    setShowWicket(false)
    setWicketType('')
    setNewBatsman('')
    setRunOutTarget('striker')
    setRunOutRuns(0)
    setFielder('')
    setFielder2('')
    setIsDirectHit(false)
    setWicketStep(1)
    setCustomFielder('')
    setShowCustomFielder(false)
    setCustomFielder2('')
    setShowCustomFielder2(false)
  }

  const scoreWicket = () => {
    if (!wicketType) return
    if (inn.wickets < MAX_WICKETS - 1 && !newBatsman) return
    handleAction(() => {
      const action = {
        type: 'SCORE_BALL',
        runs: wicketType === 'runOut' ? runOutRuns : 0,
        wicket: true,
        dismissalType: wicketType,
        newBatsman: inn.wickets < MAX_WICKETS - 1 ? newBatsman : null,
        runOutBatsman: wicketType === 'runOut' ? runOutTarget : undefined,
        fielder: fielder || undefined,
        fielder2: fielder2 || undefined,
        isDirectHit: isDirectHit || undefined,
      }
      dispatch(action)
      commentary.requestCommentary(matchState, action)
      resetWicketState()
    })
  }

  const needsFielder = (type) => ['caught', 'runOut', 'stumped'].includes(type)

  const getFieldingXI = () => {
    return (activeRosters[bowlingKey] || [])
      .filter(p => !p.substituted)
      .map(p => p.name)
  }

  const handleUndo = () => {
    if (!canUndo || isProcessing) return
    handleAction(() => {
      dispatch({ type: 'UNDO_LAST_BALL' })
    })
  }

  // Get available new batsmen from roster
  const getAvailableBatsmen = () => {
    const battingPlayers = (activeRosters[battingKey] || [])
      .filter(p => !p.substituted)
      .map(p => p.name)
    const dismissed = (inn.batsmen || []).filter(b => b.isOut).map(b => b.name)
    const currentlyBatting = [
      (inn.batsmen || [])[inn.activeBatsmanIndex]?.name,
      (inn.batsmen || [])[inn.nonStrikerIndex]?.name,
    ].filter(Boolean)
    return battingPlayers.filter(name =>
      !dismissed.includes(name) && !currentlyBatting.includes(name)
    )
  }

  // Wicket types available on free hit: only run out
  const wicketTypes = lastBallWasNoBall
    ? ['runOut']
    : ['bowled', 'caught', 'lbw', 'runOut', 'stumped', 'hitWicket']

  const wicketTypeLabels = {
    bowled: 'Bowled',
    caught: 'Caught',
    lbw: 'LBW',
    runOut: 'Run Out',
    stumped: 'Stumped',
    hitWicket: 'Hit Wicket',
  }

  // Extras modal
  if (showExtras) {
    return (
      <div className="scoring-panel">
        <div className="card">
          <h3>Extras</h3>
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
                  {[0, 1, 2, 3, 4, 6].map((r) => (
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

  // Wicket modal — step-based flow
  if (showWicket) {
    const availableBatsmen = getAvailableBatsmen()
    const fieldingXI = getFieldingXI()
    const bowler = inn.bowlers[inn.currentBowlerIndex]
    const bowlerName = bowler?.name || ''
    const totalSteps = needsFielder(wicketType) ? 4 : (wicketType === 'runOut' ? 3 : 2)
    const isLastWicket = inn.wickets >= MAX_WICKETS - 1

    // Step navigation helpers
    const advanceAfterType = (type) => {
      setWicketType(type)
      if (type === 'runOut') {
        setWicketStep(2) // run out batter selection
      } else if (needsFielder(type)) {
        setWicketStep(3) // fielder selection
      } else {
        setWicketStep(4) // confirm (bowled/lbw/hitWicket skip fielder)
      }
    }

    // Build summary text for confirmation
    const getSummaryText = () => {
      if (!wicketType) return ''
      const dismissedName = wicketType === 'runOut'
        ? (runOutTarget === 'nonStriker' ? inn.batsmen[inn.nonStrikerIndex]?.name : inn.batsmen[inn.activeBatsmanIndex]?.name)
        : inn.batsmen[inn.activeBatsmanIndex]?.name
      const fakeBatsman = { dismissal: wicketType, fielder: fielder || null, fielder2: fielder2 || null, isDirectHit }
      return `${dismissedName} — ${formatDismissal(fakeBatsman, bowlerName)}`
    }

    return (
      <div className="scoring-panel">
        <div className="card wicket-card">
          <h3>Wicket!</h3>

          {/* Step indicator */}
          <div className="wicket-step-indicator">
            {[1, 2, 3, 4].slice(0, wicketType === 'runOut' ? 4 : (needsFielder(wicketType) ? 4 : (wicketType ? 2 : 1))).map(s => (
              <span key={s} className={`step-dot ${wicketStep >= s ? 'active' : ''} ${wicketStep === s ? 'current' : ''}`} />
            ))}
          </div>

          {lastBallWasNoBall && (
            <div className="free-hit-notice">
              FREE HIT — Only Run Out is allowed
            </div>
          )}

          {/* Step 1: Dismissal type */}
          {wicketStep === 1 && (
            <div className="form-group">
              <label>Dismissal Type</label>
              <div className="btn-group wicket-types">
                {wicketTypes.map((type) => (
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

          {/* Step 2: Run out batter selection (only for runOut) */}
          {wicketStep === 2 && wicketType === 'runOut' && (
            <>
              <div className="form-group">
                <label>Who was run out?</label>
                <div className="btn-group">
                  <button
                    className={`btn ${runOutTarget === 'striker' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRunOutTarget('striker')}
                  >
                    {inn.batsmen[inn.activeBatsmanIndex]?.name} (Striker)
                  </button>
                  <button
                    className={`btn ${runOutTarget === 'nonStriker' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRunOutTarget('nonStriker')}
                  >
                    {inn.batsmen[inn.nonStrikerIndex]?.name} (Non-Striker)
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
              <button
                className="btn btn-primary btn-block"
                onClick={() => setWicketStep(3)}
              >
                Next — Select Fielder
              </button>
            </>
          )}

          {/* Step 3: Fielder selection (caught/runOut/stumped) */}
          {wicketStep === 3 && needsFielder(wicketType) && (
            <>
              {wicketType === 'caught' && (
                <div className="form-group">
                  <label>Who took the catch?</label>
                  <div className="fielder-grid">
                    {fieldingXI.map(name => (
                      <button
                        key={name}
                        className={`fielder-btn ${fielder === name && !showCustomFielder ? 'selected' : ''}`}
                        onClick={() => { setFielder(name); setShowCustomFielder(false); setCustomFielder('') }}
                      >
                        {name}
                        {name === bowlerName && <span className="fielder-label">(c & b)</span>}
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
              )}

              {wicketType === 'runOut' && (
                <>
                  <div className="form-group">
                    <label>Fielder who effected the run out</label>
                    <div className="fielder-grid">
                      {fieldingXI.map(name => (
                        <button
                          key={name}
                          className={`fielder-btn ${fielder === name && !showCustomFielder ? 'selected' : ''}`}
                          onClick={() => {
                            setFielder(name)
                            setShowCustomFielder(false)
                            setCustomFielder('')
                            if (fielder2 === name) setFielder2('')
                          }}
                        >
                          {name}
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
                        onChange={e => {
                          setCustomFielder(e.target.value)
                          setFielder(e.target.value)
                          if (fielder2 === e.target.value) setFielder2('')
                        }}
                      />
                    )}
                  </div>
                  {fielder && (
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
                            className={`fielder-btn ${fielder2 === '' && !showCustomFielder2 ? 'selected' : ''}`}
                            onClick={() => { setFielder2(''); setShowCustomFielder2(false); setCustomFielder2('') }}
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
                            placeholder="Type assist fielder name..."
                            value={customFielder2}
                            autoFocus
                            onChange={e => { setCustomFielder2(e.target.value); setFielder2(e.target.value) }}
                          />
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {wicketType === 'stumped' && (
                <div className="form-group">
                  <label>Select the wicketkeeper who made the stumping</label>
                  <div className="fielder-grid">
                    {fieldingXI.map(name => (
                      <button
                        key={name}
                        className={`fielder-btn ${fielder === name && !showCustomFielder ? 'selected' : ''}`}
                        onClick={() => { setFielder(name); setShowCustomFielder(false); setCustomFielder('') }}
                      >
                        {name}
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
              )}

              <button
                className="btn btn-primary btn-block"
                disabled={!fielder}
                onClick={() => setWicketStep(4)}
              >
                Next — Confirm
              </button>
            </>
          )}

          {/* Step 4: Confirm + New batsman */}
          {wicketStep === 4 && (
            <>
              <div className="wicket-summary">
                <div className="wicket-summary-label">OUT</div>
                <div className="wicket-summary-text">{getSummaryText()}</div>
              </div>

              {!isLastWicket && (
                <div className="form-group">
                  <label>New Batsman</label>
                  <div className="new-batsman-grid">
                    {availableBatsmen.map(name => (
                      <button
                        key={name}
                        className={`chip ${newBatsman === name ? 'active' : ''}`}
                        onClick={() => setNewBatsman(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="btn btn-danger btn-block"
                onClick={scoreWicket}
                disabled={(!isLastWicket && !newBatsman) || isProcessing}
              >
                Confirm Wicket
              </button>
            </>
          )}

          {/* Back / Cancel buttons */}
          <div className="btn-group" style={{ marginTop: 8 }}>
            {wicketStep > 1 && (
              <button className="btn btn-outline btn-block" onClick={() => {
                if (wicketStep === 4 && !needsFielder(wicketType) && wicketType !== 'runOut') {
                  setWicketStep(1)
                } else {
                  setWicketStep(wicketStep - 1)
                }
              }}>
                Back
              </button>
            )}
            <button className="btn btn-outline btn-block" onClick={resetWicketState}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main scoring panel
  return (
    <div className="scoring-panel">
      {lastBallWasNoBall && (
        <div className="free-hit-banner">
          FREE HIT
        </div>
      )}

      <div className="run-buttons-grid">
        {[0, 1, 2, 3, 4, 6].map((r) => (
          <button
            key={r}
            className={`btn btn-run btn-large ${r === 4 ? 'four' : r === 6 ? 'six' : ''}`}
            onClick={() => scoreBall(r)}
            disabled={isProcessing}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="extras-row">
        <button type="button" aria-label="Score a wide" className="btn btn-outline btn-extra" onClick={() => {
          setExtraType('wide')
          setExtraRuns(0)
          setShowExtras(true)
        }} disabled={isProcessing}>
          Wide
        </button>
        <button type="button" aria-label="Score a no ball" className="btn btn-outline btn-extra" onClick={() => {
          setExtraType('noBall')
          setExtraRuns(0)
          setShowExtras(true)
        }} disabled={isProcessing}>
          No Ball
        </button>
        <button type="button" aria-label="Score a bye" className="btn btn-outline btn-extra" onClick={() => {
          setExtraType('bye')
          setExtraRuns(1)
          setShowExtras(true)
        }} disabled={isProcessing}>
          Bye
        </button>
        <button type="button" aria-label="Score a leg bye" className="btn btn-outline btn-extra" onClick={() => {
          setExtraType('legBye')
          setExtraRuns(1)
          setShowExtras(true)
        }} disabled={isProcessing}>
          Leg Bye
        </button>
      </div>

      <button
        type="button"
        className="btn btn-danger btn-wicket"
        aria-label="Record a wicket"
        onClick={() => setShowWicket(true)}
        disabled={isProcessing}
      >
        WICKET
      </button>

      <div className="scoring-footer">
        <button
          type="button"
          className="btn btn-undo"
          aria-label="Undo last ball"
          onClick={handleUndo}
          disabled={!canUndo || isProcessing}
        >
          Undo
        </button>
      </div>
    </div>
  )
}
