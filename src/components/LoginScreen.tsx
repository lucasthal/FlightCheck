import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { hasSavedCredentials } from '../lib/biometric'

type Mode = 'signin' | 'signup' | 'reset'

export function LoginScreen() {
  const { signIn, signUp, signInWithGoogle, signInWithApple, signInWithBiometric, resetPassword, hasBiometric } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [signUpEmail, setSignUpEmail] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setResetSent(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (mode === 'reset') {
      const err = await resetPassword(email)
      setSubmitting(false)
      if (err) setError(err.message)
      else setResetSent(true)
      return
    }

    if (mode === 'signup') {
      const { error: err, needsConfirmation } = await signUp(email, password, displayName)
      setSubmitting(false)
      if (err) setError(err.message)
      else if (needsConfirmation) setSignUpEmail(email)
      // if !needsConfirmation, auto-confirm is on — onAuthStateChange will sign the user in automatically
      return
    }

    const err = await signIn(email, password)
    setSubmitting(false)
    if (err) setError(err.message)
  }

  const inputClass = `w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
    text-cockpit-text-primary text-sm placeholder-cockpit-text-dim
    focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
    transition-all duration-150`

  if (signUpEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cockpit-bg px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.06),transparent_60%)]" />
        <div className="relative w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center shadow-amber-glow">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                <path d="M 3.5 13 Q 5.5 15 8.5 18 Q 9.5 18 14.5 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path transform="translate(17.5 8) rotate(-50)" d="M2.5 0 L1.2 -0.45 L1.2 -2.2 L-0.2 -2.2 L-0.2 -0.45 L-2 -0.45 L-2.5 0 L-2 0.45 L-0.2 0.45 L-0.2 2.2 L1.2 2.2 L1.2 0.45 Z" fill="white"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-cockpit-text-primary tracking-tight">
              Flight<span className="text-cockpit-amber">Check</span>
            </h1>
          </div>
          <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 shadow-cockpit text-center">
            <div className="w-12 h-12 rounded-full bg-cockpit-amber/10 border border-cockpit-amber/30 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-cockpit-amber">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-cockpit-text-primary mb-2">Check your email</h2>
            <p className="text-sm text-cockpit-text-secondary mb-1">
              We sent a confirmation link to
            </p>
            <p className="text-sm font-medium text-cockpit-amber mb-4">{signUpEmail}</p>
            <p className="text-xs text-cockpit-text-dim mb-5">
              Click the link in the email to activate your account, then return here to sign in.
            </p>
            <button
              onClick={() => { setSignUpEmail(null); switchMode('signin') }}
              className="w-full py-2.5 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
                hover:bg-amber-400 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cockpit-bg px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.06),transparent_60%)]" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center shadow-amber-glow">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path d="M 3.5 13 Q 5.5 15 8.5 18 Q 9.5 18 14.5 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path transform="translate(17.5 8) rotate(-50)" d="M2.5 0 L1.2 -0.45 L1.2 -2.2 L-0.2 -2.2 L-0.2 -0.45 L-2 -0.45 L-2.5 0 L-2 0.45 L-0.2 0.45 L-0.2 2.2 L1.2 2.2 L1.2 0.45 Z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-cockpit-text-primary tracking-tight">
            Flight<span className="text-cockpit-amber">Check</span>
          </h1>
        </div>

        {/* Card */}
        <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 shadow-cockpit">
          <h2 className="text-lg font-semibold text-cockpit-text-primary mb-1">
            {mode === 'signin' && 'Sign in'}
            {mode === 'signup' && 'Create account'}
            {mode === 'reset' && 'Reset password'}
          </h2>
          <p className="text-xs text-cockpit-text-dim mb-5">
            {mode === 'signin' && 'Welcome back, pilot.'}
            {mode === 'signup' && 'Join FlightCheck to save your fleet.'}
            {mode === 'reset' && "We'll send a reset link to your email."}
          </p>

          {/* Social OAuth — sign in / sign up only */}
          {mode !== 'reset' && (
            <>
              {hasBiometric && hasSavedCredentials() && mode === 'signin' && (
                <button
                  onClick={async () => {
                    setError(null)
                    setSubmitting(true)
                    const err = await signInWithBiometric()
                    setSubmitting(false)
                    if (err) setError(err.message)
                  }}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                    bg-cockpit-amber text-black text-sm font-semibold
                    hover:bg-amber-400 transition-all duration-150 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {submitting ? 'Please wait…' : 'Sign in with Face ID'}
                </button>
              )}
              <button
                onClick={async () => {
                  setError(null)
                  setSubmitting(true)
                  const err = await signInWithApple()
                  setSubmitting(false)
                  if (err) setError(err.message)
                }}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-white text-black text-sm font-medium
                  hover:bg-gray-200 transition-all duration-150 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 384 512" className="w-4 h-4 flex-shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                {submitting ? 'Please wait…' : 'Continue with Apple'}
              </button>
              <button
                onClick={async () => {
                  setError(null)
                  setSubmitting(true)
                  const err = await signInWithGoogle()
                  setSubmitting(false)
                  if (err) setError(err.message)
                }}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-cockpit-card border border-cockpit-border text-cockpit-text-primary text-sm
                  hover:border-cockpit-amber/40 transition-all duration-150 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {submitting ? 'Please wait…' : 'Continue with Google'}
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-cockpit-border" />
                <span className="text-xs text-cockpit-text-dim">or</span>
                <div className="flex-1 h-px bg-cockpit-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs text-cockpit-text-dim mb-1">Display name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  required placeholder="Your name" className={inputClass} />
              </div>
            )}
            <div>
              <label className="block text-xs text-cockpit-text-dim mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="pilot@example.com" className={inputClass} />
            </div>
            {mode !== 'reset' && (
              <div>
                <label className="block text-xs text-cockpit-text-dim mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••" className={inputClass} />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}
            {resetSent && (
              <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                Reset link sent — check your email.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
                hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {submitting
                ? 'Please wait…'
                : mode === 'signin' ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-cockpit-text-dim">
            {mode === 'signin' && (
              <>
                <button onClick={() => switchMode('signup')} className="hover:text-cockpit-text-secondary transition-colors">
                  Create account
                </button>
                <button onClick={() => switchMode('reset')} className="hover:text-cockpit-text-secondary transition-colors">
                  Forgot password?
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => switchMode('signin')} className="hover:text-cockpit-text-secondary transition-colors">
                Already have an account? Sign in
              </button>
            )}
            {mode === 'reset' && (
              <button onClick={() => switchMode('signin')} className="hover:text-cockpit-text-secondary transition-colors">
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-cockpit-text-dim mt-4">
          For reference only — always verify against current POH/AFM
        </p>
      </div>
    </div>
  )
}
