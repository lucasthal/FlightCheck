import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Aircraft } from './types'
import type { EntitlementState } from './lib/revenuecat'
import { AircraftSelector } from './components/AircraftSelector'
import { ChecklistView } from './components/ChecklistView'
import { LoginScreen } from './components/LoginScreen'
import { Paywall } from './components/Paywall'
import { WelcomeScreen } from './components/WelcomeScreen'
import { SettingsSheet } from './components/SettingsSheet'
import { FeedbackButton } from './components/FeedbackButton'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useEntitlement } from './hooks/useEntitlement'
import { PreferencesProvider } from './hooks/usePreferences'
import { initRevenueCatAnonymous } from './lib/revenuecat'

const isNative = Capacitor.isNativePlatform()

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <AppInner />
      </PreferencesProvider>
    </AuthProvider>
  )
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
      <div className="w-8 h-8 rounded-full border-2 border-cockpit-amber/30 border-t-cockpit-amber animate-spin" />
    </div>
  )
}

const HAS_ACCOUNT_KEY = 'flightcheck-has-account'

function AppInner() {
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [activePhaseName, setActivePhaseName] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { user, loading } = useAuth()

  // Track whether this device has ever had a signed-in user.
  // Returning users (signed out) see LoginScreen; brand-new users see Paywall.
  const [hasAccount, setHasAccount] = useState(() => !!localStorage.getItem(HAS_ACCOUNT_KEY))
  useEffect(() => {
    if (user) {
      localStorage.setItem(HAS_ACCOUNT_KEY, '1')
      setHasAccount(true)
    }
  }, [user])

  // On iOS, init RevenueCat anonymously when no user so the paywall can
  // appear without requiring login (Apple guideline 5.1.1(v)).
  const [rcReady, setRcReady] = useState(false)
  useEffect(() => {
    if (loading) return
    if (user) {
      setRcReady(true)
      return
    }
    if (isNative) {
      initRevenueCatAnonymous()
        .then(() => setRcReady(true))
        .catch((err) => {
          console.error('[App] anonymous RC init failed', err)
          setRcReady(true)
        })
    }
  }, [user, loading])

  const [showLogin, setShowLogin] = useState(false)
  const [pendingEntitlement, setPendingEntitlement] = useState<EntitlementState | null>(null)
  const { isEntitled, isLoading: entLoading, apply } = useEntitlement(rcReady)

  if (loading) return <Spinner />

  // Web: RC SDK requires a user ID — login is still required
  if (!user && !isNative) return <LoginScreen />

  // Native: returning user who signed out — go to login, not paywall
  if (!user && isNative && hasAccount) return <LoginScreen />

  // Native without user: wait for anonymous RC init
  if (!user && !rcReady) return <Spinner />

  // Just purchased/restored without an account — confirm and require sign-in
  if (!user && pendingEntitlement) {
    return (
      <WelcomeScreen
        isRestore={pendingEntitlement.source === 'apple'}
        onSignIn={() => {
          apply(pendingEntitlement)
          setPendingEntitlement(null)
        }}
      />
    )
  }

  if (entLoading) return <Spinner />

  // Not entitled — show paywall (purchase doesn't require sign-in)
  if (!isEntitled) {
    return (
      <Paywall
        onPurchased={user ? apply : (state) => setPendingEntitlement(state)}
        onSignIn={!user ? () => setShowLogin(true) : undefined}
      />
    )
  }

  // Entitled but not signed in — must sign in to use the app
  if (!user || showLogin) {
    return <LoginScreen />
  }

  const handleSelectAircraft = (aircraft: Aircraft) => {
    setSelectedAircraft(aircraft)
    setActivePhaseName(null)
  }

  const handleBack = () => {
    setSelectedAircraft(null)
    setActivePhaseName(null)
  }

  return (
    <>
      {selectedAircraft ? (
        <ChecklistView
          aircraft={selectedAircraft}
          onBack={handleBack}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onPhaseChange={setActivePhaseName}
        />
      ) : (
        <AircraftSelector onSelect={handleSelectAircraft} onOpenSettings={() => setIsSettingsOpen(true)} />
      )}

      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {selectedAircraft && (
        <FeedbackButton aircraft={selectedAircraft} phaseName={activePhaseName} />
      )}
    </>
  )
}
