import { useState } from 'react'
import { useTournament } from '../context/TournamentContext'
import { computeRotationDiversity } from '../lib/spirit'

export default function SpiritTracker() {
  const { teams, matches, spiritNotes, dispatch, getTeamName } = useTournament()
  const [editingMatch, setEditingMatch] = useState(null)
  const [noteText, setNoteText] = useState('')

  const completedMatches = matches.filter(m => m.status === 'completed')

  if (completedMatches.length === 0) return null

  const diversity = computeRotationDiversity(teams, matches)

  function startEditing(matchId) {
    setEditingMatch(matchId)
    setNoteText(spiritNotes?.[matchId] || '')
  }

  function saveNote(matchId) {
    dispatch({ type: 'SET_SPIRIT_NOTE', matchId, note: noteText.trim() })
    setEditingMatch(null)
    setNoteText('')
  }

  return (
    <div className="spirit-tracker">
      <h3>Spirit of NCC</h3>

      {/* Rotation diversity */}
      <div className="spirit-section">
        <h4>Squad Rotation</h4>
        <div className="spirit-diversity">
          {teams.map(team => {
            const d = diversity[team.id]
            if (!d || d.matchesPlayed === 0) return null
            return (
              <div key={team.id} className="diversity-row">
                <span className="diversity-team">{team.name}</span>
                <div className="diversity-bar-container">
                  <div
                    className="diversity-bar"
                    style={{ width: `${Math.min(d.diversityPct, 100)}%` }}
                  />
                </div>
                <span className="diversity-stat">
                  {d.uniquePlayers}/{d.squadSize} ({d.diversityPct}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sportsmanship notes per match */}
      <div className="spirit-section">
        <h4>Sportsmanship Notes</h4>
        {completedMatches.map(match => (
          <div key={match.id} className="spirit-note-card">
            <div className="spirit-note-header">
              <span className="spirit-match-label">
                Match {match.matchNumber}: {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}
              </span>
            </div>

            {editingMatch === match.id ? (
              <div className="spirit-note-edit">
                <textarea
                  className="spirit-textarea"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add sportsmanship notes..."
                  rows={3}
                />
                <div className="spirit-note-actions">
                  <button className="btn btn-small btn-primary" onClick={() => saveNote(match.id)}>
                    Save
                  </button>
                  <button className="btn btn-small btn-outline" onClick={() => setEditingMatch(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="spirit-note-display" onClick={() => startEditing(match.id)}>
                {spiritNotes?.[match.id]
                  ? <p className="spirit-note-text">{spiritNotes[match.id]}</p>
                  : <p className="spirit-note-placeholder">Tap to add notes...</p>
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
