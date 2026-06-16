import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  getCurrentEntitlement,
  type EntitlementState,
  type EntitlementSource,
} from '../lib/revenuecat'
import { useAuth } from './useAuth'

interface UseEntitlementResult {
  isEntitled: boolean
  isLoading: boolean
  trialEndsAt: Date | null
  source: EntitlementSource
  refresh: () => Promise<void>
  apply: (next: EntitlementState) => void
}

const INITIAL: EntitlementState = {
  isEntitled: false,
  source: null,
  trialEndsAt: null,
}

/**
 * Returns the current user's entitlement state from RevenueCat. Refetches on
 * user change and when the page is shown after returning from Stripe Checkout
 * (visibility change). Exposes a manual refresh for components that need to
 * force-refresh after an in-app action.
 *
 * @param rcReady — pass true once RevenueCat is initialized (for anonymous
 *   iOS users who haven't logged in yet). Defaults to true so existing call
 *   sites (SettingsSheet) don't need changes.
 */
export function useEntitlement(rcReady = true): UseEntitlementResult {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<EntitlementState>(INITIAL)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = async () => {
    try {
      const next = await getCurrentEntitlement()
      setState(next)
    } catch (err) {
      console.error('[useEntitlement] refresh failed', err)
      setState(INITIAL)
    } finally {
      setIsLoading(false)
    }
  }

  const apply = (next: EntitlementState) => {
    setState(next)
    setIsLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    if (!user && !rcReady) {
      setState(INITIAL)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, rcReady])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (user || rcReady)) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, rcReady])

  return {
    isEntitled: state.isEntitled,
    isLoading,
    trialEndsAt: state.trialEndsAt,
    source: state.source,
    refresh,
    apply,
  }
}
