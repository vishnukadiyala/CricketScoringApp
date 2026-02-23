import { useState } from 'react'
import { useMatch } from '../context/MatchContext'
import { MIN_SQUAD_SIZE, MAX_SQUAD_SIZE, PLAYING_XI, DEFAULT_OVERS_PER_INNINGS } from '../lib/constants'

export default function MatchSetup() {
  const { phase, team1, team2, squads, dispatch } = useMatch()
  const [formData, setFormData] = useState({ team1: '', team2: '', overs: DEFAULT_OVERS_PER_INNINGS })
  const [squad1Text, setSquad1Text] = useState('')
  const [squad2Text, setSquad2Text] = useState('')
  const [squadError, setSquadError] = useState('')
  const [tossWinner, setTossWinner] = useState('')
  const [tossDecision, setTossDecision] = useState('')
  const [team1XI, setTeam1XI] = useState([])
  const [team2XI, setTeam2XI] = useState([])
  const [xiError, setXiError] = useState('')

  // If teams are already pre-populated (from tournament), skip the setup form
  if (phase === 'setup' && team1 && team2 && squads.team1?.length > 0 && squads.team2?.length > 0) {
    return null // toss phase is already set via initialConfig; MatchContext starts at 'toss'
  }

  if (phase === 'setup') {
    const parseSquad = (text) => {
      return text
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    }

    const validateSquad = (names, teamLabel) => {
      const unique = [...new Set(names)]
      const dupes = names.length - unique.length
      if (dupes > 0) {
        return `${teamLabel} has ${dupes} duplicate name${dupes > 1 ? 's' : ''} (removed). ${unique.length} unique players.`
      }
      if (unique.length < MIN_SQUAD_SIZE || unique.length > MAX_SQUAD_SIZE) {
        return `${teamLabel} must have ${MIN_SQUAD_SIZE}-${MAX_SQUAD_SIZE} unique players (got ${unique.length})`
      }
      return null
    }

    const handleSubmit = (e) => {
      e.preventDefault()
      setSquadError('')

      const t1Name = formData.team1.trim()
      const t2Name = formData.team2.trim()
      if (!t1Name || !t2Name) {
        setSquadError('Both team names are required')
        return
      }
      if (t1Name.toLowerCase() === t2Name.toLowerCase()) {
        setSquadError('Team names must be different')
        return
      }

      const overs = parseInt(formData.overs, 10)
      if (!overs || overs < 1 || overs > 50) {
        setSquadError('Overs must be between 1 and 50')
        return
      }

      const s1 = parseSquad(squad1Text)
      const s2 = parseSquad(squad2Text)
      const s1Unique = [...new Set(s1)]
      const s2Unique = [...new Set(s2)]

      const err1 = validateSquad(s1, t1Name)
      if (err1) {
        setSquadError(err1)
        return
      }
      const err2 = validateSquad(s2, t2Name)
      if (err2) {
        setSquadError(err2)
        return
      }

      dispatch({
        type: 'SET_TEAMS',
        team1: t1Name,
        team2: t2Name,
        oversPerInnings: overs,
        squad1: s1Unique,
        squad2: s2Unique,
      })
    }

    return (
      <div className="setup-container">
        <div className="card">
          <h2>New Match</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Team 1</label>
              <input
                type="text"
                placeholder="e.g. India"
                value={formData.team1}
                onChange={(e) => setFormData({ ...formData, team1: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Team 2</label>
              <input
                type="text"
                placeholder="e.g. Australia"
                value={formData.team2}
                onChange={(e) => setFormData({ ...formData, team2: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Overs per Innings</label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.overs}
                onChange={(e) => setFormData({ ...formData, overs: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>{formData.team1 || 'Team 1'} Squad (8-15 players, one per line)</label>
              <textarea
                className="squad-textarea"
                rows={8}
                placeholder={"Player 1\nPlayer 2\n....\nPlayer 15"}
                value={squad1Text}
                onChange={(e) => setSquad1Text(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>{formData.team2 || 'Team 2'} Squad (8-15 players, one per line)</label>
              <textarea
                className="squad-textarea"
                rows={8}
                placeholder={"Player 1\nPlayer 2\n....\nPlayer 15"}
                value={squad2Text}
                onChange={(e) => setSquad2Text(e.target.value)}
                required
              />
            </div>
            {squadError && <div className="error-msg">{squadError}</div>}
            <button type="submit" className="btn btn-primary btn-block">Start Match</button>
          </form>
        </div>
      </div>
    )
  }

  if (phase === 'toss') {
    return (
      <div className="setup-container">
        <div className="card">
          <h2>Toss</h2>
          <div className="form-group">
            <label>Who won the toss?</label>
            <div className="btn-group">
              <button
                className={`btn ${tossWinner === team1 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTossWinner(team1)}
              >
                {team1}
              </button>
              <button
                className={`btn ${tossWinner === team2 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTossWinner(team2)}
              >
                {team2}
              </button>
            </div>
          </div>
          {tossWinner && (
            <div className="form-group">
              <label>{tossWinner} chose to...</label>
              <div className="btn-group">
                <button
                  className={`btn ${tossDecision === 'bat' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setTossDecision('bat')}
                >
                  Bat
                </button>
                <button
                  className={`btn ${tossDecision === 'bowl' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setTossDecision('bowl')}
                >
                  Bowl
                </button>
              </div>
            </div>
          )}
          {tossWinner && tossDecision && (
            <button
              className="btn btn-primary btn-block"
              onClick={() => dispatch({ type: 'SET_TOSS', winner: tossWinner, decision: tossDecision })}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'select-xi') {
    const s1Size = squads.team1.length
    const s2Size = squads.team2.length
    const maxXI = PLAYING_XI
    const t1Max = Math.min(maxXI, s1Size)
    const t2Max = Math.min(maxXI, s2Size)
    const t1NeedsSelection = s1Size > maxXI
    const t2NeedsSelection = s2Size > maxXI

    // Auto-select all players if squad <= 11
    const effectiveT1XI = t1NeedsSelection ? team1XI : squads.team1
    const effectiveT2XI = t2NeedsSelection ? team2XI : squads.team2

    const togglePlayer = (player, team) => {
      const max = team === 1 ? t1Max : t2Max
      if (team === 1) {
        setTeam1XI(prev =>
          prev.includes(player) ? prev.filter(p => p !== player) : prev.length < max ? [...prev, player] : prev
        )
      } else {
        setTeam2XI(prev =>
          prev.includes(player) ? prev.filter(p => p !== player) : prev.length < max ? [...prev, player] : prev
        )
      }
    }

    const handleConfirm = () => {
      if (effectiveT1XI.length !== t1Max) {
        setXiError(`${team1} must have exactly ${t1Max} players selected (got ${effectiveT1XI.length})`)
        return
      }
      if (effectiveT2XI.length !== t2Max) {
        setXiError(`${team2} must have exactly ${t2Max} players selected (got ${effectiveT2XI.length})`)
        return
      }
      setXiError('')
      dispatch({ type: 'SET_PLAYING_XI', team1XI: effectiveT1XI, team2XI: effectiveT2XI })
    }

    const ready = effectiveT1XI.length === t1Max && effectiveT2XI.length === t2Max

    return (
      <div className="setup-container">
        <div className="card">
          <h2>Select Playing XI</h2>
          <p className="subtitle">
            {t1NeedsSelection || t2NeedsSelection
              ? 'Choose up to 11 players from each squad'
              : 'All squad members will play'}
          </p>

          <div className="form-group">
            <label>{team1} — {effectiveT1XI.length}/{t1Max} selected</label>
            {t1NeedsSelection ? (
              <div className="xi-grid">
                {squads.team1.map(player => (
                  <button
                    key={player}
                    className={`chip ${team1XI.includes(player) ? 'active' : ''}`}
                    onClick={() => togglePlayer(player, 1)}
                  >
                    {player}
                  </button>
                ))}
              </div>
            ) : (
              <div className="xi-grid">
                {squads.team1.map(player => (
                  <span key={player} className="chip active">{player}</span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>{team2} — {effectiveT2XI.length}/{t2Max} selected</label>
            {t2NeedsSelection ? (
              <div className="xi-grid">
                {squads.team2.map(player => (
                  <button
                    key={player}
                    className={`chip ${team2XI.includes(player) ? 'active' : ''}`}
                    onClick={() => togglePlayer(player, 2)}
                  >
                    {player}
                  </button>
                ))}
              </div>
            ) : (
              <div className="xi-grid">
                {squads.team2.map(player => (
                  <span key={player} className="chip active">{player}</span>
                ))}
              </div>
            )}
          </div>

          {xiError && <div className="error-msg">{xiError}</div>}
          <button
            className="btn btn-primary btn-block"
            onClick={handleConfirm}
            disabled={!ready}
          >
            Confirm Playing XI
          </button>
        </div>
      </div>
    )
  }

  return null
}
