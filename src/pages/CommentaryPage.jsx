import { useParams, useNavigate } from 'react-router-dom'
import { useRef, useEffect, useState } from 'react'
import { CommentaryProvider, useCommentary } from '../context/CommentaryContext'
import { getBallClass } from '../lib/ballDisplay'
import { playLPCMAudio } from '../lib/audioPlayback'

function CommentaryLog() {
  const { entries, isEnabled, isGenerating, error, toggleEnabled, clearError } = useCommentary()
  const scrollRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  const handlePlay = async (entry) => {
    if (!entry.audioBase64 || playingId) return
    setPlayingId(entry.id)
    try {
      await playLPCMAudio(entry.audioBase64)
    } catch { /* ignore playback errors */ }
    setPlayingId(null)
  }

  // Group entries by innings
  const grouped = entries.reduce((acc, entry) => {
    const key = entry.inningsIndex ?? 0
    if (!acc[key]) acc[key] = []
    acc[key].push(entry)
    return acc
  }, {})

  return (
    <div className="commentary-page">
      <div className="commentary-header">
        <h2>AI Commentary</h2>
        <button
          className={`btn btn-sm ${isEnabled ? 'btn-primary' : 'btn-outline'}`}
          onClick={toggleEnabled}
        >
          {isEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {error && (
        <div className="commentary-error" onClick={clearError}>
          {error} <span className="dismiss">(tap to dismiss)</span>
        </div>
      )}

      {entries.length === 0 && (
        <div className="commentary-empty">
          {isEnabled
            ? 'Commentary will appear here as balls are scored...'
            : 'Enable AI commentary to get ball-by-ball analysis.'}
        </div>
      )}

      <div className="commentary-log" ref={scrollRef}>
        {Object.entries(grouped).map(([inningsIdx, inningsEntries]) => (
          <div key={inningsIdx}>
            <div className="commentary-innings-label">
              Innings {Number(inningsIdx) + 1}
            </div>
            {inningsEntries.map((entry) => (
              <div key={entry.id} className={`commentary-entry ${entry.status}`}>
                <div className="commentary-ball-info">
                  <span className={`ball-badge ${getBallClass(entry.ballDisplay || '')}`}>
                    {entry.ballDisplay || '?'}
                  </span>
                  <span className="commentary-over">
                    {entry.overNumber}.{entry.ballNumber}
                  </span>
                </div>
                <div className="commentary-text">
                  {entry.status === 'generating' && !entry.text
                    ? 'Generating...'
                    : entry.text || '(no commentary)'}
                </div>
                {entry.audioBase64 && (
                  <button
                    className="commentary-play-btn"
                    onClick={() => handlePlay(entry)}
                    disabled={!!playingId}
                    title="Play audio commentary"
                  >
                    {playingId === entry.id ? '...' : '\u25B6'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

        {isGenerating && (
          <div className="commentary-generating">
            <span className="commentary-pulse" />
            Listening & generating...
          </div>
        )}
      </div>
    </div>
  )
}

export default function CommentaryPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cricket Scorer — NCC Ed. 5</h1>
      </header>
      <main className="app-main">
        <CommentaryProvider matchId={id}>
          <CommentaryLog />
        </CommentaryProvider>
        <button
          className="btn btn-outline btn-block"
          style={{ marginTop: 12 }}
          onClick={() => navigate(`/match/${id}/score`)}
        >
          Back to Scoring
        </button>
      </main>
    </div>
  )
}
