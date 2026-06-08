import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { usePreferences } from '../hooks/usePreferences'
import type { Theme, TextSize } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useEntitlement } from '../hooks/useEntitlement'
import { supabase } from '../lib/supabase'

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark',  label: 'Default' },
  { value: 'night', label: 'Night' },
  { value: 'day',   label: 'Day' },
]

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: 'sm', label: 'Sm' },
  { value: 'md', label: 'Md' },
  { value: 'lg', label: 'Lg' },
  { value: 'xl', label: 'Xl' },
]

export function SettingsSheet({ isOpen, onClose }: SettingsSheetProps) {
  const { user } = useAuth()
  const { preferences, updatePreference } = usePreferences()
  const { source, trialEndsAt, isEntitled } = useEntitlement()
  const [profileList, setProfileList] = useState<{ id: string; name: string }[]>([])

  const handleManageStripe = async () => {
    try {
      const { Purchases } = await import('@revenuecat/purchases-js')
      const info = await Purchases.getSharedInstance().getCustomerInfo()
      const url = (info as { managementURL?: string | null }).managementURL
      if (url) window.open(url, '_blank')
    } catch (err) {
      console.error('[Settings] manage subscription failed', err)
    }
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('checklist_profiles')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data, error }) => {
        if (!error && data) setProfileList(data as { id: string; name: string }[])
      })
  }, [user?.id])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-cockpit-bg transition-transform ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-cockpit-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-semibold text-cockpit-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-cockpit-text-primary hover:bg-cockpit-card"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-6">
          {/* Subscription */}
          {isEntitled && source && (
            <div className="space-y-1">
              <p className="text-xs text-cockpit-text-dim uppercase tracking-wide">
                Subscription
              </p>
              {source === 'apple' && (
                <>
                  <p className="text-sm text-cockpit-text-primary">Subscribed via App Store</p>
                  <p className="text-xs text-cockpit-text-dim">
                    Manage in Settings → Apple ID → Subscriptions
                  </p>
                </>
              )}
              {source === 'stripe' && (
                <>
                  <p className="text-sm text-cockpit-text-primary">Subscribed via Web</p>
                  {Capacitor.isNativePlatform() ? (
                    <p className="text-xs text-cockpit-text-dim">
                      Manage your subscription at flightcheckapp.com
                    </p>
                  ) : (
                    <button
                      onClick={handleManageStripe}
                      className="text-xs text-cockpit-amber hover:underline"
                    >
                      Manage subscription →
                    </button>
                  )}
                </>
              )}
              {trialEndsAt && (
                <p className="text-xs text-cockpit-amber">
                  Trial ends {trialEndsAt.toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Theme */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-cockpit-text-primary">Theme</p>
            <div className="flex gap-2">
              {THEMES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updatePreference('theme', value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    preferences.theme === value
                      ? 'bg-cockpit-amber text-black'
                      : 'bg-cockpit-card text-cockpit-text-primary border border-cockpit-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Text size */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-cockpit-text-primary">Text size</p>
            <div className="flex gap-2">
              {TEXT_SIZES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updatePreference('text_size', value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    preferences.text_size === value
                      ? 'bg-cockpit-amber text-black'
                      : 'bg-cockpit-card text-cockpit-text-primary border border-cockpit-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Keep screen awake */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-cockpit-text-primary">Keep screen awake</p>
            <button
              onClick={() => updatePreference('keep_screen_awake', !preferences.keep_screen_awake)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.keep_screen_awake ? 'bg-cockpit-amber' : 'bg-cockpit-border'
              }`}
              aria-label="Toggle keep screen awake"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.keep_screen_awake ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Auto-scroll to next item */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-cockpit-text-primary">Auto-scroll to next item</p>
            <button
              onClick={() => updatePreference('autoscroll', !preferences.autoscroll)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.autoscroll ? 'bg-cockpit-amber' : 'bg-cockpit-border'
              }`}
              aria-label="Toggle auto-scroll to next item"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.autoscroll ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Default aircraft */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-cockpit-text-primary">Default aircraft</p>
            <select
              value={preferences.default_aircraft_id ?? ''}
              onChange={e => updatePreference('default_aircraft_id', e.target.value || null)}
              className="w-full bg-cockpit-card border border-cockpit-border rounded-lg px-3 py-2 text-cockpit-text-primary text-sm"
            >
              <option value="">None</option>
              {profileList.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  )
}
