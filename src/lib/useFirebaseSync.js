import { useEffect, useRef } from 'react'
import { db, isFirebaseConfigured, isSpectatorMode, ref, set, onValue, off } from './firebase'

export function useFirebaseSync(path, localState, onRemoteUpdate, options = {}) {
  const { enabled = true, debounceMs = 500, filterBeforeWrite } = options
  const isRemoteUpdateRef = useRef(false)
  const debounceTimerRef = useRef(null)
  const active = isFirebaseConfigured && enabled && path

  // Stable callback ref for remote updates
  const onRemoteUpdateRef = useRef(onRemoteUpdate)
  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate
  })

  // Read: listen for remote changes
  useEffect(() => {
    if (!active) return

    const dbRef = ref(db, path)
    const handler = (snapshot) => {
      const data = snapshot.val()
      if (data && onRemoteUpdateRef.current) {
        isRemoteUpdateRef.current = true
        onRemoteUpdateRef.current(data)
      }
    }

    onValue(dbRef, handler)

    return () => {
      off(dbRef, 'value', handler)
    }
  }, [active, path])

  // Write: debounced push to Firebase (disabled in spectator mode)
  useEffect(() => {
    if (!active || isSpectatorMode) return

    // Skip write if this state change came from a remote update
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const dbRef = ref(db, path)
      let dataToWrite = localState

      if (filterBeforeWrite) {
        dataToWrite = filterBeforeWrite(localState)
      }

      if (dataToWrite === null) {
        // null means delete the node
        set(dbRef, null)
      } else {
        set(dbRef, { ...dataToWrite, _lastWriteTime: Date.now() })
      }
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [active, path, localState, debounceMs, filterBeforeWrite])

  return { isRemoteUpdateRef }
}
