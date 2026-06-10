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
 */
export function useEntitlement(): UseEntitlementResult {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<EntitlementState>(INITIAL)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = async () => {
    if (!user) {
      setState(INITIAL)
      setIsLoading(false)
      return
    }
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

  // Set entitlement state directly from a just-completed purchase result,
  // bypassing the customer-info fetch (which can lag a fresh purchase).
  const apply = (next: EntitlementState) => {
    setState(next)
    setIsLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    setIsLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  // Refetch when the page becomes visible again — covers Stripe Checkout
  // return on web, and resume-from-background on iOS.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return // iOS handled via app state events
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return {
    isEntitled: state.isEntitled,
    isLoading,
    trialEndsAt: state.trialEndsAt,
    source: state.source,
    refresh,
    apply,
  }
}
