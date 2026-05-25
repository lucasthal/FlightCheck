import { useState } from 'react'
import type { Aircraft } from './types'
import { AircraftSelector } from './components/AircraftSelector'
import { ChecklistView } from './components/ChecklistView'
import { LoginScreen } from './components/LoginScreen'
import { SettingsSheet } from './components/SettingsSheet'
import { FeedbackButton } from './components/FeedbackButton'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { PreferencesProvider } from './hooks/usePreferences'

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <AppInner />
      </PreferencesProvider>
    </AuthProvider>
  )
}

function AppInner() {
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [activePhaseName, setActivePhaseName] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
        <div className="w-8 h-8 rounded-full border-2 border-cockpit-amber/30 border-t-cockpit-amber animate-spin" />
      </div>
    )
  }

  if (!user) {
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
