import { memo, useRef, useEffect, useState } from 'react'
import { useMatch } from '../context/MatchContext'
import { getBallClass } from '../lib/ballDisplay'

const BallHistoryTimeline = memo(function BallHistoryTimeline({ isSuper = false }) {
  const {
    phase, dispatch,
    currentInningsSnapshots, superOverSnapshots,
  } = useMatch()

  const snapshots = isSuper ? (superOverSnapshots || []) : currentInningsSnapshots
  const stripRef = useRef(null)
  const [selectedSeq, setSelectedSeq] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Auto-scroll to the right when new balls are added
  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth
    }
  }, [snapshots.length])

  // Clear selection if snapshots change (e.g. after undo)
  useEffect(() => {
    setSelectedSeq(null)
  }, [snapshots.length])

  // Only show during scoring and new-bowler phases
  if (!isSuper && phase !== 'scoring' && phase !== 'new-bowler') return null
  if (isSuper && phase !== 'super-over') return null
  if (snapshots.length === 0) return null

  const undoAction = isSuper ? 'UNDO_TO_SUPER_OVER_SNAPSHOT' : 'UNDO_TO_SNAPSHOT'
  const lastSnap = snapshots[snapshots.length - 1]

  function handleChipClick(snap) {
    if (isProcessing) return

    // Tapping the last chip = immediate undo (no confirmation)
    if (snap.sequence === lastSnap.sequence) {
      setIsProcessing(true)
      dispatch({ type: undoAction, sequence: snap.sequence })
      setTimeout(() => setIsProcessing(false), 150)
      return
    }

    // Tapping an earlier chip = toggle selection for confirmation
    setSelectedSeq(prev => prev === snap.sequence ? null : snap.sequence)
  }

  function handleConfirm() {
    if (isProcessing || selectedSeq === null) return
    setIsProcessing(true)
    dispatch({ type: undoAction, sequence: selectedSeq })
    setSelectedSeq(null)
    setTimeout(() => setIsProcessing(false), 150)
  }

  function handleCancel() {
    setSelectedSeq(null)
  }

  // Count how many balls will be undone
  const selectedIdx = selectedSeq !== null
    ? snapshots.findIndex(s => s.sequence === selectedSeq)
    : -1
  const ballsToUndo = selectedIdx !== -1 ? snapshots.length - selectedIdx : 0

  return (
    <div className="ball-timeline">
      <div className="ball-timeline-strip" ref={stripRef}>
        {snapshots.map((snap) => {
          const display = snap.ball_data?.display || '?'
          const cssClass = getBallClass(display)
          const isSelected = snap.sequence === selectedSeq
          const willUndo = selectedIdx !== -1 && snapshots.indexOf(snap) >= selectedIdx

          return (
            <button
              key={snap.sequence}
              className={
                `ball-badge ball-timeline-chip ${cssClass}` +
                (isSelected ? ' timeline-selected' : '') +
                (willUndo ? ' timeline-will-undo' : '')
              }
              onClick={() => handleChipClick(snap)}
              disabled={isProcessing}
              title={`Ball ${snap.sequence}`}
            >
              {display}
            </button>
          )
        })}
      </div>

      {selectedSeq !== null && ballsToUndo > 0 && (
        <div className="ball-timeline-confirm">
          <span>Undo {ballsToUndo} ball{ballsToUndo > 1 ? 's' : ''}?</span>
          <button className="btn btn-sm btn-danger" onClick={handleConfirm} disabled={isProcessing}>
            Confirm
          </button>
          <button className="btn btn-sm btn-outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
})

export default BallHistoryTimeline
