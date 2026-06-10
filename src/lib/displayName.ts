import type { User } from '@supabase/supabase-js'

/**
 * Best-available display name for a user, or null if none. Apple private-relay
 * emails have random local parts (e.g. xk3f9a2b@privaterelay.appleid.com), so
 * they are never used as a name fallback.
 */
export function getDisplayName(user: User | null | undefined): string | null {
  const metaName = (user?.user_metadata?.full_name as string | undefined)
    ?? (user?.user_metadata?.name as string | undefined)
  if (metaName) return metaName
  const email = user?.email
  if (email && !email.endsWith('@privaterelay.appleid.com')) {
    return email.split('@')[0]
  }
  return null
}
