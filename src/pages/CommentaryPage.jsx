import { useParams, useNavigate } from 'react-router-dom'
import { useRef, useEffect, useState } from 'react'
import { CommentaryProvider, useCommentary } from '../context/CommentaryContext'
import { getBallClass } from '../lib/ballDisplay'
import { playMP3Audio } from '../lib/audioPlayback'
import WinProbability from '../components/WinProbability'

function CommentaryLog() {
  const {
    entries, isEnabled, isAudioEnabled, isGenerating, error,
    toggleEnabled, toggleAudio, clearError,
    overSummaries, inningsReports, matchReport, winProbability,
  } = useCommentary()
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
      await playMP3Audio(entry.audioBase64)
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
      </div>

      {error && (
        <div className="commentary-error" onClick={clearError}>
          {error} <span className="dismiss">(tap to dismiss)</span>
        </div>
      )}

      <WinProbability />

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
            Generating commentary...
          </div>
        )}
      </div>

      {/* Over Summaries */}
      {overSummaries.length > 0 && (
        <div className="analysis-section">
          <h3 className="analysis-section-title">Over Summaries</h3>
          {overSummaries.map((os, i) => (
            <div key={i} className="analysis-card">
              <div className="analysis-card-header">
                Over {os.overNumber} — Innings {(os.inningsIndex ?? 0) + 1}
              </div>
              <div className="analysis-card-text">{os.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Innings Reports */}
      {inningsReports.length > 0 && (
        <div className="analysis-section">
          <h3 className="analysis-section-title">Innings Reports</h3>
          {inningsReports.map((ir, i) => (
            <div key={i} className="analysis-card innings-report-card">
              <div className="analysis-card-header">
                Innings {(ir.inningsIndex ?? 0) + 1} Report
              </div>
              <div className="analysis-card-text">{ir.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Match Report */}
      {matchReport && (
        <div className="analysis-section">
          <h3 className="analysis-section-title">Match Report</h3>
          <div className="analysis-card match-report-card">
            <div className="analysis-card-text">{matchReport}</div>
          </div>
        </div>
      )}
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
