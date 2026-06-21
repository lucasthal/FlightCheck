import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Loader2 } from 'lucide-react'
import { startCheckout, restorePurchases, presentRedemptionSheet, onEntitlementActivated, waitForEntitlement, type EntitlementState } from '../lib/revenuecat'
import { useAuth } from '../hooks/useAuth'

const PRIVACY_URL = 'https://lucasthal.github.io/FlightCheck/privacy.html'
const TERMS_URL = 'https://lucasthal.github.io/FlightCheck/terms.html'

interface Props {
  priceLabel?: string
  isReturningUser?: boolean
  onPurchased: (state: EntitlementState) => void
  onSignIn?: () => void
}

export function Paywall({ priceLabel, isReturningUser, onPurchased, onSignIn }: Props) {
  const { signOut } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async () => {
    setError(null)
    setSubmitting(true)
    try {
      let state = await startCheckout()
      if (!state.isEntitled) {
        setActivating(true)
        state = await waitForEntitlement()
      }
      if (state.isEntitled) {
        onPurchased(state)
        return
      }
      setError(
        'Your purchase succeeded but is taking longer than usual to activate. '
        + 'Please reload in a minute, or contact support@flightcheckapp.com.',
      )
    } catch (err) {
      console.error('[Paywall] startCheckout failed', err)
      const msg = err instanceof Error ? err.message : 'Checkout failed'
      if (/already active/i.test(msg)) {
        setActivating(true)
        const state = await waitForEntitlement()
        if (state.isEntitled) {
          onPurchased(state)
          return
        }
        setError(
          'Your subscription is active but not syncing. Please reload the page, '
          + 'or contact support@flightcheckapp.com.',
        )
      } else if (!/cancel/i.test(msg)) {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
      setActivating(false)
    }
  }

  const handleRestore = async () => {
    setError(null)
    setRestoring(true)
    try {
      const state = await restorePurchases()
      if (state.isEntitled) {
        onPurchased(state)
        return
      }
      setError('No active subscription found. If you believe this is an error, contact support@flightcheckapp.com.')
    } catch (err) {
      console.error('[Paywall] restore failed', err)
      setError('Could not restore purchases. Please try again.')
    } finally {
      setRestoring(false)
    }
  }

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener')
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

        <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 shadow-cockpit">
          <h2 className="text-lg font-semibold text-cockpit-text-primary mb-1 text-center">
            FlightCheck Pro
          </h2>
          <p className="text-sm text-cockpit-text-secondary mb-5 text-center">
            {isReturningUser
              ? `${priceLabel ?? '$5.99/month or $49.99/year'}. Auto-renewable subscription. Cancel anytime.`
              : `7-day free trial, then ${priceLabel ?? '$5.99/month or $49.99/year'}. Auto-renewable subscription. Cancel anytime.`}
          </p>

          <ul className="text-sm text-cockpit-text-secondary space-y-2 mb-6">
            <li>• 19 aircraft with full POH reference data</li>
            <li>• Phase-by-phase checklists with auto-advance</li>
            <li>• Cross-device sync of preferences and notes</li>
            <li>• V-speeds, performance tables, emergency procedures</li>
          </ul>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={submitting || restoring}
            className="w-full py-3 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
              hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {activating ? 'Activating subscription…' : submitting ? 'Opening checkout…' : isReturningUser ? 'Subscribe' : 'Start free trial'}
          </button>

          <p className="text-xs text-cockpit-text-dim mt-5 mb-2 text-center">
            Already subscribed on this Apple ID?
          </p>
          <button
            onClick={handleRestore}
            disabled={submitting || restoring}
            className="w-full py-2.5 rounded-xl bg-cockpit-card border border-cockpit-border
              text-cockpit-text-primary text-sm font-medium
              hover:border-cockpit-amber/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {restoring && <Loader2 className="w-4 h-4 animate-spin" />}
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </button>

          {Capacitor.isNativePlatform() && (
            <button
              onClick={async () => {
                const removeListener = await onEntitlementActivated((state) => {
                  removeListener()
                  onPurchased(state)
                })
                await presentRedemptionSheet()
              }}
              disabled={submitting || restoring}
              className="w-full mt-3 py-2.5 rounded-xl bg-cockpit-card border border-cockpit-border
                text-cockpit-text-secondary text-sm
                hover:border-cockpit-amber/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Redeem Code
            </button>
          )}

          {!Capacitor.isNativePlatform() && (
            <p className="text-center text-xs text-cockpit-text-dim mt-4">
              Already subscribed on iOS? Sign in with the same email
              and access unlocks automatically.
            </p>
          )}

          {/* Legal links */}
          <div className="flex items-center justify-center gap-3 mt-4 text-xs text-cockpit-text-dim">
            <button onClick={() => openLink(TERMS_URL)} className="hover:text-cockpit-text-secondary transition-colors underline">
              Terms of Use
            </button>
            <span>•</span>
            <button onClick={() => openLink(PRIVACY_URL)} className="hover:text-cockpit-text-secondary transition-colors underline">
              Privacy Policy
            </button>
          </div>
        </div>

        {onSignIn ? (
          <button
            onClick={onSignIn}
            className="w-full mt-4 text-center text-xs text-cockpit-amber hover:text-amber-400 transition-colors"
          >
            Already have an account? Sign in
          </button>
        ) : (
          <button
            onClick={() => { signOut() }}
            className="w-full mt-4 text-center text-xs text-cockpit-text-dim hover:text-cockpit-text-secondary transition-colors"
          >
            Sign out
          </button>
        )}

        <p className="text-center text-xs text-cockpit-text-dim mt-3">
          For reference only — always verify against current POH/AFM
        </p>
      </div>
    </div>
  )
}
