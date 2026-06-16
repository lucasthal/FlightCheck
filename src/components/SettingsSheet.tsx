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
  onSignIn?: () => void
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

export function SettingsSheet({ isOpen, onClose, onSignIn }: SettingsSheetProps) {
  const { user, signOut } = useAuth()
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

  const currentName = (user?.user_metadata?.full_name as string | undefined) ?? ''
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameStatus, setNameStatus] = useState<'saved' | 'error' | null>(null)

  useEffect(() => {
    if (isOpen) {
      setNameInput(currentName)
      setNameStatus(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id])

  const handleSaveName = async () => {
    const name = nameInput.trim()
    if (!name || name === currentName) return
    setSavingName(true)
    setNameStatus(null)
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
    setSavingName(false)
    setNameStatus(error ? 'error' : 'saved')
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.functions.invoke('delete-account')
    if (error) {
      setDeleting(false)
      setDeleteError('Account deletion failed. Please try again or contact support@flightcheckapp.com.')
      return
    }
    // Account is gone server-side; sign out locally (server signOut may 403 — ignore)
    await signOut().catch(() => {})
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
          {/* Sign in prompt for guests */}
          {!user && onSignIn && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-cockpit-text-primary">Account</p>
              <p className="text-xs text-cockpit-text-secondary">
                Sign in to sync your preferences, favorites, and checklist profiles across devices.
              </p>
              <button
                onClick={() => { onClose(); onSignIn() }}
                className="w-full py-2.5 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
                  hover:bg-amber-400 transition-colors"
              >
                Sign In or Create Account
              </button>
            </div>
          )}

          {/* Display name */}
          {user && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-cockpit-text-primary">Display name</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setNameStatus(null) }}
                placeholder="How should we address you?"
                maxLength={60}
                className="flex-1 bg-cockpit-card border border-cockpit-border rounded-lg px-3 py-2 text-cockpit-text-primary text-sm placeholder:text-cockpit-text-dim"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !nameInput.trim() || nameInput.trim() === currentName}
                className="rounded-lg bg-cockpit-amber px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
            {nameStatus === 'saved' && (
              <p className="text-xs text-green-400">Name updated</p>
            )}
            {nameStatus === 'error' && (
              <p className="text-xs text-red-400">Could not save name. Please try again.</p>
            )}
          </div>
          )}

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

          {/* Default aircraft — only for signed-in users */}
          {user && (
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
          )}

          {/* Danger zone — only for signed-in users */}
          {user && (
          <div className="space-y-2 border-t border-cockpit-border pt-4">
            <p className="text-xs text-red-400 uppercase tracking-wide">Danger zone</p>
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Delete account
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm font-medium text-cockpit-text-primary">
                  Permanently delete your account?
                </p>
                <p className="text-xs text-cockpit-text-secondary">
                  All your data — checklist profiles, custom items, favorites, and
                  preferences — will be permanently erased. This cannot be undone.
                </p>
                {isEntitled && source === 'stripe' && (
                  <p className="text-xs text-cockpit-text-secondary">
                    Your web subscription will be cancelled automatically.
                  </p>
                )}
                {isEntitled && source === 'apple' && (
                  <p className="text-xs text-cockpit-amber">
                    Your App Store subscription is billed by Apple and will not stop
                    when your account is deleted — cancel it in Settings → Apple ID →
                    Subscriptions.
                  </p>
                )}
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmingDelete(false); setDeleteError(null) }}
                    disabled={deleting}
                    className="flex-1 rounded-lg border border-cockpit-border bg-cockpit-card px-3 py-2 text-sm text-cockpit-text-primary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Permanently delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </>
  )
}
