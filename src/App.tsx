import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Aircraft } from './types'
import { AircraftSelector } from './components/AircraftSelector'
import { ChecklistView } from './components/ChecklistView'
import { LoginScreen } from './components/LoginScreen'
import { Paywall } from './components/Paywall'
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

function AppInner() {
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [activePhaseName, setActivePhaseName] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { user, loading } = useAuth()

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
  const { isEntitled, isLoading: entLoading, apply } = useEntitlement(rcReady)

  if (loading) return <Spinner />

  // Web: RC SDK requires a user ID — login is still required
  if (!user && !isNative) return <LoginScreen />

  // Native without user: wait for anonymous RC init
  if (!user && !rcReady) return <Spinner />

  // Guest requested sign-in from settings/profile menu
  if (!user && showLogin) {
    return <LoginScreen onBack={() => setShowLogin(false)} />
  }

  if (entLoading) return <Spinner />

  if (!isEntitled) {
    return <Paywall onPurchased={apply} isGuest={!user} />
  }

  const handleSelectAircraft = (aircraft: Aircraft) => {
    setSelectedAircraft(aircraft)
    setActivePhaseName(null)
  }

  const handleBack = () => {
    setSelectedAircraft(null)
    setActivePhaseName(null)
  }

  const handleSignIn = () => setShowLogin(true)

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
        <AircraftSelector onSelect={handleSelectAircraft} onOpenSettings={() => setIsSettingsOpen(true)} onSignIn={!user ? handleSignIn : undefined} />
      )}

      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSignIn={!user ? handleSignIn : undefined}
      />

      {selectedAircraft && (
        <FeedbackButton aircraft={selectedAircraft} phaseName={activePhaseName} />
      )}
    </>
  )
}
