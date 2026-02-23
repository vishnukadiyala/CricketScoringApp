import { useState } from 'react'
import { useMatch } from '../context/MatchContext'
import { MIN_SUBSTITUTIONS, MAX_SUBSTITUTIONS } from '../lib/constants'

export default function SquadRotation() {
  const { phase, team1, team2, squads, activeRosters, dispatch } = useMatch()

  const [team1SwapOut, setTeam1SwapOut] = useState([])
  const [team1SwapIn, setTeam1SwapIn] = useState([])
  const [team2SwapOut, setTeam2SwapOut] = useState([])
  const [team2SwapIn, setTeam2SwapIn] = useState([])
  const [error, setError] = useState('')
  // team1Done state reserved for future per-team submission tracking

  if (phase !== 'squad-rotation') return null

  const getActivePlayers = (teamKey) =>
    (activeRosters[teamKey] || []).filter(p => !p.substituted).map(p => p.name)

  const getBench = (teamKey) => {
    const active = (activeRosters[teamKey] || []).map(p => p.name)
    const squad = squads[teamKey] || []
    return squad.filter(name => !active.includes(name))
  }

  const toggleSwapOut = (name, team) => {
    if (team === 1) {
      setTeam1SwapOut(prev =>
        prev.includes(name) ? prev.filter(n => n !== name) : prev.length < MAX_SUBSTITUTIONS ? [...prev, name] : prev
      )
    } else {
      setTeam2SwapOut(prev =>
        prev.includes(name) ? prev.filter(n => n !== name) : prev.length < MAX_SUBSTITUTIONS ? [...prev, name] : prev
      )
    }
  }

  const toggleSwapIn = (name, team) => {
    if (team === 1) {
      setTeam1SwapIn(prev =>
        prev.includes(name) ? prev.filter(n => n !== name) : prev.length < MAX_SUBSTITUTIONS ? [...prev, name] : prev
      )
    } else {
      setTeam2SwapIn(prev =>
        prev.includes(name) ? prev.filter(n => n !== name) : prev.length < MAX_SUBSTITUTIONS ? [...prev, name] : prev
      )
    }
  }

  const handleConfirm = () => {
    setError('')
    // Validate swap counts match (2-4 each, or 0 for skip)
    if (team1SwapOut.length !== team1SwapIn.length) {
      setError(`${team1}: Must swap equal number of players in and out`)
      return
    }
    if (team2SwapOut.length !== team2SwapIn.length) {
      setError(`${team2}: Must swap equal number of players in and out`)
      return
    }
    if (team1SwapOut.length > 0 && (team1SwapOut.length < MIN_SUBSTITUTIONS || team1SwapOut.length > MAX_SUBSTITUTIONS)) {
      setError(`${team1}: Must swap ${MIN_SUBSTITUTIONS}-${MAX_SUBSTITUTIONS} players (or skip)`)
      return
    }
    if (team2SwapOut.length > 0 && (team2SwapOut.length < MIN_SUBSTITUTIONS || team2SwapOut.length > MAX_SUBSTITUTIONS)) {
      setError(`${team2}: Must swap ${MIN_SUBSTITUTIONS}-${MAX_SUBSTITUTIONS} players (or skip)`)
      return
    }

    // Apply rotations
    if (team1SwapOut.length > 0) {
      dispatch({
        type: 'APPLY_SQUAD_ROTATION',
        teamKey: 'team1',
        swapOut: team1SwapOut,
        swapIn: team1SwapIn,
      })
    }
    if (team2SwapOut.length > 0) {
      dispatch({
        type: 'APPLY_SQUAD_ROTATION',
        teamKey: 'team2',
        swapOut: team2SwapOut,
        swapIn: team2SwapIn,
      })
    }
    dispatch({ type: 'FINISH_SQUAD_ROTATION' })
  }

  const renderTeamRotation = (teamName, teamKey, teamNum) => {
    const active = getActivePlayers(teamKey)
    const bench = getBench(teamKey)
    const swapOut = teamNum === 1 ? team1SwapOut : team2SwapOut
    const swapIn = teamNum === 1 ? team1SwapIn : team2SwapIn

    return (
      <div className="rotation-team">
        <h3>{teamName}</h3>

        <div className="form-group">
          <label>Active XI — Select players to swap OUT ({swapOut.length} selected)</label>
          <div className="xi-grid">
            {active.map(name => (
              <button
                key={name}
                className={`chip ${swapOut.includes(name) ? 'danger' : ''}`}
                onClick={() => toggleSwapOut(name, teamNum)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Bench — Select players to swap IN ({swapIn.length} selected)</label>
          <div className="xi-grid">
            {bench.map(name => (
              <button
                key={name}
                className={`chip ${swapIn.includes(name) ? 'active' : ''}`}
                onClick={() => toggleSwapIn(name, teamNum)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="setup-container">
      <div className="card">
        <h2>Squad Rotation</h2>
        <p className="subtitle">After 2nd innings — swap 2-4 players per team, or skip</p>

        {renderTeamRotation(team1, 'team1', 1)}
        <hr className="rotation-divider" />
        {renderTeamRotation(team2, 'team2', 2)}

        {error && <div className="error-msg">{error}</div>}

        <button className="btn btn-primary btn-block" onClick={handleConfirm}>
          Confirm Rotation & Start 3rd Innings
        </button>
        <button
          className="btn btn-outline btn-block"
          onClick={() => dispatch({ type: 'FINISH_SQUAD_ROTATION' })}
        >
          Skip Rotation
        </button>
      </div>
    </div>
  )
}
