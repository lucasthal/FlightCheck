import { Capacitor } from '@capacitor/core'

let initialized = false

export function isRevenueCatInitialized(): boolean {
  return initialized
}

/**
 * Initialize RevenueCat with the current Supabase user_id. Idempotent: if
 * already initialized, switches identity to the new user_id.
 *
 * Web path uses @revenuecat/purchases-js (Stripe-backed checkout).
 * Native (iOS) path uses @revenuecat/purchases-capacitor → native StoreKit.
 */
export async function initRevenueCat(userId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    if (initialized) {
      await Purchases.logIn({ appUserID: userId })
    } else {
      await Purchases.configure({
        apiKey: import.meta.env.VITE_REVENUECAT_IOS_KEY,
        appUserID: userId,
      })
      initialized = true
    }
  } else {
    const { Purchases } = await import('@revenuecat/purchases-js')
    if (initialized) {
      await Purchases.getSharedInstance().changeUser(userId)
    } else {
      Purchases.configure(import.meta.env.VITE_REVENUECAT_WEB_KEY, userId)
      initialized = true
    }
  }
}

export async function initRevenueCatAnonymous(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return
  const { Purchases } = await import('@revenuecat/purchases-capacitor')
  await Purchases.configure({
    apiKey: import.meta.env.VITE_REVENUECAT_IOS_KEY,
  })
  initialized = true
}

/**
 * Logs the current user out of RevenueCat. Call on Supabase signOut so the
 * next user gets a clean slate.
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!initialized) return
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    await Purchases.logOut()
  } else {
    // purchases-js has no logOut(); reset our flag so the next initRevenueCat
    // call re-configures the SDK with the new user id.
    initialized = false
  }
}

export type EntitlementSource = 'stripe' | 'apple' | 'google' | null

export interface EntitlementState {
  isEntitled: boolean
  source: EntitlementSource
  trialEndsAt: Date | null
}

/**
 * Returns the active entitlement source for the current user, or null if
 * no active entitlement.
 */
export async function getCurrentEntitlement(): Promise<EntitlementState> {
  if (!initialized) {
    return { isEntitled: false, source: null, trialEndsAt: null }
  }
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    const info = await Purchases.getCustomerInfo()
    return parseEntitlement(info.customerInfo)
  } else {
    const { Purchases } = await import('@revenuecat/purchases-js')
    const info = await Purchases.getSharedInstance().getCustomerInfo()
    return parseEntitlement(info)
  }
}

/**
 * Initiates checkout for the "premium" entitlement on the current platform.
 * Web: purchases-js renders its checkout in-page and resolves when the
 * purchase completes. iOS: presents the native StoreKit sheet. Both SDKs
 * resolve with fresh customer info, which is parsed and returned so the
 * caller can unlock immediately without re-fetching (RC's API can lag a
 * just-completed purchase by minutes).
 */
export async function startCheckout(): Promise<EntitlementState> {
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    const offerings = await Purchases.getOfferings()
    const pkg = offerings.current?.availablePackages[0]
    if (!pkg) throw new Error('No subscription package available')
    const result = await Purchases.purchasePackage({ aPackage: pkg })
    return parseEntitlement(result.customerInfo)
  } else {
    const { Purchases } = await import('@revenuecat/purchases-js')
    const offerings = await Purchases.getSharedInstance().getOfferings()
    const pkg = offerings.current?.availablePackages[0]
    if (!pkg) throw new Error('No subscription package available')
    const result = await Purchases.getSharedInstance().purchase({ rcPackage: pkg })
    return parseEntitlement((result as { customerInfo?: unknown }).customerInfo)
  }
}

/**
 * Polls until the entitlement becomes active or the timeout elapses. Fallback
 * for the rare case where a completed purchase hasn't propagated to the
 * customer-info endpoint yet.
 */
export async function waitForEntitlement(
  timeoutMs = 90_000,
  intervalMs = 3_000,
): Promise<EntitlementState> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const state = await getCurrentEntitlement()
    if (state.isEntitled || Date.now() >= deadline) return state
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

export async function restorePurchases(): Promise<EntitlementState> {
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    const info = await Purchases.restorePurchases()
    return parseEntitlement(info.customerInfo)
  } else {
    return getCurrentEntitlement()
  }
}

function parseEntitlement(customerInfo: unknown): EntitlementState {
  const info = customerInfo as {
    entitlements?: {
      active?: {
        premium?: {
          store?: string
          periodType?: string
          expirationDate?: string
        }
      }
    }
  }
  const ent = info?.entitlements?.active?.premium
  if (!ent) return { isEntitled: false, source: null, trialEndsAt: null }
  const store = ent.store?.toLowerCase()
  const source: EntitlementSource =
    store === 'app_store' ? 'apple'
    : store === 'play_store' ? 'google'
    : store === 'stripe' || store === 'rc_billing' ? 'stripe'
    : null
  const trialEndsAt =
    ent.periodType?.toLowerCase() === 'trial' && ent.expirationDate
      ? new Date(ent.expirationDate)
      : null
  return { isEntitled: true, source, trialEndsAt }
}
