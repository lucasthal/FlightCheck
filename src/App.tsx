import { useState } from 'react'
import type { Aircraft } from './types'
import { AircraftSelector } from './components/AircraftSelector'
import { ChecklistView } from './components/ChecklistView'
import { LoginScreen } from './components/LoginScreen'
import { SettingsSheet } from './components/SettingsSheet'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePreferences } from './hooks/usePreferences'

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

function AppInner() {
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { user, loading } = useAuth()
  usePreferences(user)

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

  return (
    <>
      {selectedAircraft ? (
        <ChecklistView
          aircraft={selectedAircraft}
          onBack={() => setSelectedAircraft(null)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      ) : (
        <AircraftSelector onSelect={setSelectedAircraft} onOpenSettings={() => setIsSettingsOpen(true)} />
      )}

      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  )
}
