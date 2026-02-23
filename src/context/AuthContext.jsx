import { createContext, useContext, useState, useEffect } from 'react'
import { isFirebaseConfigured, auth, onAuthStateChanged, db, ref, get } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [userName, setUserName] = useState(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured) return

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        try {
          const snapshot = await get(ref(db, `users/${firebaseUser.uid}`))
          if (snapshot.exists()) {
            const data = snapshot.val()
            setRole(data.role)
            setUserName(data.name)
          } else {
            setRole(null)
            setUserName(null)
          }
        } catch {
          setRole(null)
          setUserName(null)
        }
      } else {
        setUser(null)
        setRole(null)
        setUserName(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    user,
    role,
    userName,
    loading,
    isOwner: role === 'owner',
    isOrganizer: role === 'organizer' || role === 'owner',
    isPlayer: role === 'player',
    isAuthenticated: Boolean(user),
    isAuthEnabled: isFirebaseConfigured,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
