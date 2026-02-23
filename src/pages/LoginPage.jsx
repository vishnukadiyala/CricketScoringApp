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
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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
  'auth/invalid-action-code': 'This sign-in link has expired or already been used.',
}

const EMAIL_LINK_KEY = 'emailForSignIn'

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [mode, setMode] = useState('signin') // 'signin' | 'register' | 'emaillink'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isFirstUser, setIsFirstUser] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

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

  // Handle email link sign-in callback
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return

    let storedEmail = window.localStorage.getItem(EMAIL_LINK_KEY)
    if (!storedEmail) {
      storedEmail = window.prompt('Please enter your email to confirm sign-in:')
    }
    if (!storedEmail) return

    setSubmitting(true)
    signInWithEmailLink(auth, storedEmail, window.location.href)
      .then(async (cred) => {
        window.localStorage.removeItem(EMAIL_LINK_KEY)
        // Create user record if first time
        const snapshot = await get(ref(db, `users/${cred.user.uid}`))
        if (!snapshot.exists()) {
          const usersSnapshot = await get(ref(db, 'users'))
          const role = !usersSnapshot.exists() ? 'organizer' : 'player'
          await set(ref(db, `users/${cred.user.uid}`), {
            name: storedEmail.split('@')[0],
            email: storedEmail,
            role,
            createdAt: Date.now(),
          })
        }
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname)
        navigate('/', { replace: true })
      })
      .catch((err) => {
        const code = err.code || ''
        setError(errorMessages[code] || 'Sign-in link failed. Please try again.')
        setSubmitting(false)
      })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'emaillink') {
        const actionCodeSettings = {
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        }
        await sendSignInLinkToEmail(auth, email, actionCodeSettings)
        window.localStorage.setItem(EMAIL_LINK_KEY, email)
        setLinkSent(true)
        setSubmitting(false)
        return
      }

      if (mode === 'register') {
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

  if (linkSent) {
    return (
      <div className="app">
        <main className="app-main" style={{ justifyContent: 'center' }}>
          <div className="card auth-card">
            <h2>Check Your Email</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              We sent a sign-in link to <strong>{email}</strong>. Click the link in your email to sign in.
            </p>
            <button
              className="btn-auth-toggle"
              onClick={() => { setLinkSent(false); setError('') }}
              type="button"
            >
              Use a different email
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <main className="app-main" style={{ justifyContent: 'center' }}>
        <div className="card auth-card">
          <h2>
            {mode === 'register' ? 'Create Account' : mode === 'emaillink' ? 'Sign In with Email Link' : 'Sign In'}
          </h2>
          {mode === 'register' && isFirstUser && (
            <div className="auth-hint">
              First account gets <strong>Organizer</strong> access.
            </div>
          )}
          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
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
            {mode !== 'emaillink' && (
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                />
              </div>
            )}
            {error && <div className="error-msg">{error}</div>}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting}
            >
              {submitting
                ? (mode === 'register' ? 'Creating...' : mode === 'emaillink' ? 'Sending...' : 'Signing in...')
                : (mode === 'register' ? 'Create Account' : mode === 'emaillink' ? 'Send Sign-In Link' : 'Sign In')
              }
            </button>
          </form>

          <div className="auth-toggle-group">
            {mode === 'emaillink' ? (
              <button
                className="btn-auth-toggle"
                onClick={() => { setMode('signin'); setError('') }}
                type="button"
              >
                Sign in with password instead
              </button>
            ) : (
              <button
                className="btn-auth-toggle"
                onClick={() => { setMode('emaillink'); setError('') }}
                type="button"
              >
                Sign in with email link (no password)
              </button>
            )}
            <button
              className="btn-auth-toggle"
              onClick={() => { setMode(mode === 'register' ? 'signin' : 'register'); setError('') }}
              type="button"
            >
              {mode === 'register' ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
