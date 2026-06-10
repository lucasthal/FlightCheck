import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Loader2 } from 'lucide-react'
import { startCheckout, waitForEntitlement, type EntitlementState } from '../lib/revenuecat'
import { useAuth } from '../hooks/useAuth'

interface Props {
  priceLabel?: string // e.g. "$4.99/mo" — falls back to generic copy if absent
  onPurchased: (state: EntitlementState) => void
}

/**
 * Full-screen paywall. Rendered when the authenticated user has no active
 * entitlement. Single CTA initiates platform-appropriate checkout.
 */
export function Paywall({ priceLabel, onPurchased }: Props) {
  const { signOut } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async () => {
    setError(null)
    setSubmitting(true)
    try {
      let state = await startCheckout()
      if (!state.isEntitled) {
        // Purchase completed but the entitlement hasn't propagated yet
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
      // User closing the checkout sheet is not an error worth surfacing
      if (!/cancel/i.test(msg)) setError(msg)
    } finally {
      setSubmitting(false)
      setActivating(false)
    }
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
            Start your free trial
          </h2>
          <p className="text-sm text-cockpit-text-secondary mb-5 text-center">
            7 days free, then {priceLabel ?? 'subscription pricing'}.
            Cancel anytime before the trial ends.
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
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
              hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {activating ? 'Activating subscription…' : submitting ? 'Opening checkout…' : 'Start free trial'}
          </button>

          {!Capacitor.isNativePlatform() && (
            <p className="text-center text-xs text-cockpit-text-dim mt-4">
              Already subscribed on iOS? Sign in with the same email
              and access unlocks automatically.
            </p>
          )}
        </div>

        <button
          onClick={() => { signOut() }}
          className="w-full mt-4 text-center text-xs text-cockpit-text-dim hover:text-cockpit-text-secondary transition-colors"
        >
          Sign out
        </button>

        <p className="text-center text-xs text-cockpit-text-dim mt-3">
          For reference only — always verify against current POH/AFM
        </p>
      </div>
    </div>
  )
}
