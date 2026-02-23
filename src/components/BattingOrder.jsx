import { useState } from 'react'
import { useMatch } from '../context/MatchContext'

export default function BattingOrder() {
  const { phase, innings, currentInnings, activeRosters, team1, getOrdinal, dispatch } = useMatch()
  const [batsman1, setBatsman1] = useState('')
  const [batsman2, setBatsman2] = useState('')
  const [bowler, setBowler] = useState('')
  const [error, setError] = useState('')

  if (phase !== 'batting-order') return null

  const inn = innings[currentInnings]
  if (!inn) return null

  const battingKey = inn.battingTeam === team1 ? 'team1' : 'team2'
  const bowlingKey = inn.bowlingTeam === team1 ? 'team1' : 'team2'

  const battingPlayers = activeRosters[battingKey].filter(p => !p.substituted).map(p => p.name)
  const bowlingPlayers = activeRosters[bowlingKey].filter(p => !p.substituted).map(p => p.name)

  const ordinal = getOrdinal(currentInnings + 1)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!batsman1) {
      setError('Please select a striker')
      return
    }
    if (!batsman2) {
      setError('Please select a non-striker')
      return
    }
    if (!bowler) {
      setError('Please select an opening bowler')
      return
    }
    if (batsman1 === batsman2) {
      setError('Striker and non-striker must be different players')
      return
    }
    dispatch({
      type: 'SET_OPENERS',
      batsman1,
      batsman2,
      bowler,
    })
    setBatsman1('')
    setBatsman2('')
    setBowler('')
  }

  return (
    <div className="setup-container">
      <div className="card">
        <h2>{inn.battingTeam} — {ordinal} Innings</h2>
        <p className="subtitle">vs {inn.bowlingTeam}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Striker</label>
            <select
              value={batsman1}
              onChange={(e) => { setBatsman1(e.target.value); setError('') }}
              required
              className="form-select"
            >
              <option value="">Select striker</option>
              {battingPlayers.filter(p => p !== batsman2).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Non-Striker</label>
            <select
              value={batsman2}
              onChange={(e) => { setBatsman2(e.target.value); setError('') }}
              required
              className="form-select"
            >
              <option value="">Select non-striker</option>
              {battingPlayers.filter(p => p !== batsman1).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Opening Bowler ({inn.bowlingTeam})</label>
            <select
              value={bowler}
              onChange={(e) => { setBowler(e.target.value); setError('') }}
              required
              className="form-select"
            >
              <option value="">Select bowler</option>
              {bowlingPlayers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block">Start Innings</button>
        </form>
      </div>
    </div>
  )
}
