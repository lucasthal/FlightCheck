import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, AuthError } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from '../lib/supabase'
import { initRevenueCat, logOutRevenueCat } from '../lib/revenuecat'
import { isBiometricAvailable, saveToken, getToken, deleteCredentials } from '../lib/biometric'

const isNative = Capacitor.isNativePlatform()
const NATIVE_REDIRECT_URL = 'com.flightcheck.app://auth-callback'

interface SignUpResult {
  error: AuthError | null
  needsConfirmation: boolean  // true = email sent, user must confirm before signing in
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  hasBiometric: boolean
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<AuthError | null>
  signInWithApple: () => Promise<AuthError | null>
  signInWithBiometric: () => Promise<AuthError | null>
  resetPassword: (email: string) => Promise<AuthError | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasBiometric, setHasBiometric] = useState(false)

  useEffect(() => {
    isBiometricAvailable().then(setHasBiometric)
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        initRevenueCat(session.user.id).catch(err =>
          console.error('[RC] init failed', err),
        )
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session.refresh_token && isNative) {
          saveToken(session.refresh_token).catch(err =>
            console.error('[Auth] failed to save biometric token', err),
          )
        }
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isNative) return
    const handlePromise = App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT_URL)) return

      // Supabase OAuth can return either PKCE (?code=) or implicit (#access_token=)
      const queryString = url.split('?')[1]?.split('#')[0] ?? ''
      const fragment = url.split('#')[1] ?? ''
      const queryParams = new URLSearchParams(queryString)
      const fragmentParams = new URLSearchParams(fragment)

      const code = queryParams.get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      } else {
        const access_token = fragmentParams.get('access_token')
        const refresh_token = fragmentParams.get('refresh_token')
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token })
        }
      }

      await Browser.close().catch(() => {})
    })
    return () => { handlePromise.then(h => h.remove()) }
  }, [])

  const signIn = async (email: string, password: string): Promise<AuthError | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  const signInWithBiometric = async (): Promise<AuthError | null> => {
    const token = await getToken()
    if (!token) return { name: 'AuthApiError', message: 'Biometric authentication cancelled' } as AuthError
    const { error } = await supabase.auth.refreshSession({ refresh_token: token })
    if (error) {
      deleteCredentials().catch(err =>
        console.error('[Auth] failed to clear stale biometric token', err),
      )
    }
    return error
  }

  const signUp = async (email: string, password: string, displayName: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    })
    // session is null when email confirmation is required; non-null means auto-confirm is on
    return { error, needsConfirmation: !error && !data.session }
  }

  const signOut = async () => {
    await logOutRevenueCat().catch(err => console.error('[RC] logout failed', err))
    await supabase.auth.signOut({ scope: 'local' })
  }

  const signInWithGoogle = async (): Promise<AuthError | null> => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: isNative ? NATIVE_REDIRECT_URL : window.location.origin,
        skipBrowserRedirect: isNative,
      },
    })
    if (isNative && !error && data?.url) {
      await Browser.open({ url: data.url })
    }
    return error
  }

  const signInWithApple = async (): Promise<AuthError | null> => {
    if (isNative) {
      try {
        // Apple requires the nonce in the request to be the SHA-256 hash of
        // the nonce Supabase verifies against the identity token.
        const rawNonce = crypto.randomUUID() + crypto.randomUUID()
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce))
        const hashedNonce = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')

        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
        const result = await SignInWithApple.authorize({
          clientId: 'com.flightcheck.app',
          redirectURI: `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback`,
          scopes: 'email name',
          nonce: hashedNonce,
        })

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.response.identityToken,
          nonce: rawNonce,
        })
        if (error) return error

        if (data.session?.refresh_token) {
          saveToken(data.session.refresh_token).catch(err =>
            console.error('[Auth] failed to save biometric token after Apple sign-in', err),
          )
        }

        // Apple only provides the name on FIRST authorization — persist it
        if (result.response.givenName) {
          const fullName = [result.response.givenName, result.response.familyName]
            .filter(Boolean)
            .join(' ')
          await supabase.auth.updateUser({ data: { full_name: fullName } })
        }
        return null
      } catch (err) {
        // Native sheet dismissed by the user — not an error
        if (err instanceof Error && /cancel/i.test(err.message)) return null
        return { name: 'AuthApiError', message: 'Apple sign-in failed' } as AuthError
      }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    })
    return error
  }

  const resetPassword = async (email: string): Promise<AuthError | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    return error
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasBiometric, signIn, signUp, signOut, signInWithGoogle, signInWithApple, signInWithBiometric, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
