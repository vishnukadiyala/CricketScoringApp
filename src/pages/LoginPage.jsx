import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  auth,
  db,
  ref,
  set,
  get,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

const errorMessages = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Invalid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isFirstUser, setIsFirstUser] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
      return
    }
    // Check if any users exist
    get(ref(db, 'users')).then((snapshot) => {
      setIsFirstUser(!snapshot.exists())
    }).catch(() => {})
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (isRegister) {
        if (!name.trim()) {
          setError('Name is required.')
          setSubmitting(false)
          return
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        const role = isFirstUser ? 'organizer' : 'player'
        await set(ref(db, `users/${cred.user.uid}`), {
          name: name.trim(),
          email,
          role,
          createdAt: Date.now(),
        })
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      navigate('/', { replace: true })
    } catch (err) {
      const code = err.code || ''
      setError(errorMessages[code] || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app">
      <main className="app-main" style={{ justifyContent: 'center' }}>
        <div className="card auth-card">
          <h2>{isRegister ? 'Create Account' : 'Sign In'}</h2>
          {isRegister && isFirstUser && (
            <div className="auth-hint">
              First account gets <strong>Organizer</strong> access.
            </div>
          )}
          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting}
            >
              {submitting ? (isRegister ? 'Creating...' : 'Signing in...') : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>
          <button
            className="btn-auth-toggle"
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            type="button"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </main>
    </div>
  )
}
