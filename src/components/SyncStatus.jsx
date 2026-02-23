import { useState, useEffect } from 'react'
import { db, isFirebaseConfigured, ref, onValue, off } from '../lib/firebase'

export default function SyncStatus() {
  const [connected, setConnected] = useState(null) // null = unknown, true = online, false = offline

  useEffect(() => {
    if (!isFirebaseConfigured) return

    const connRef = ref(db, '.info/connected')
    const handler = (snapshot) => {
      setConnected(snapshot.val() === true)
    }

    onValue(connRef, handler)

    return () => {
      off(connRef, 'value', handler)
    }
  }, [])

  if (!isFirebaseConfigured) return null

  const status = connected === true ? 'live' : connected === false ? 'offline' : 'connecting'
  const label = connected === true ? 'Live' : connected === false ? 'Offline' : 'Connecting...'

  return (
    <div className={`sync-status sync-status--${status}`}>
      <span className="sync-status__dot" />
      <span className="sync-status__label">{label}</span>
    </div>
  )
}
