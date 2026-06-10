import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !user) return json(401, { error: 'Unauthorized' })

  // 1. Billing first: deleting the RevenueCat customer cancels active Web
  // Billing (Stripe) subscriptions immediately. App Store subscriptions are
  // managed by Apple and unaffected (the UI warns those users). 404 means the
  // customer never purchased anything — safe to continue. Any other failure
  // aborts so we never delete an account that still has live billing.
  const rcRes = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RC_SECRET_API_KEY')}`,
        'Content-Type': 'application/json',
      },
    },
  )
  if (!rcRes.ok && rcRes.status !== 404) {
    console.error('[delete-account] RC deletion failed', rcRes.status, await rcRes.text())
    return json(502, { error: 'Subscription cancellation failed' })
  }

  // 2. Data rows, child-first (profile_items/profile_phases have no user_id)
  const { data: profiles, error: profilesError } = await admin
    .from('checklist_profiles')
    .select('id')
    .eq('user_id', user.id)
  if (profilesError) return json(500, { error: 'Data deletion failed' })

  const profileIds = (profiles ?? []).map((p) => p.id)
  if (profileIds.length > 0) {
    const { data: phases, error: phasesError } = await admin
      .from('profile_phases')
      .select('id')
      .in('profile_id', profileIds)
    if (phasesError) return json(500, { error: 'Data deletion failed' })

    const phaseIds = (phases ?? []).map((p) => p.id)
    if (phaseIds.length > 0) {
      const { error } = await admin.from('profile_items').delete().in('phase_id', phaseIds)
      if (error) return json(500, { error: 'Data deletion failed' })
    }
    const { error: phasesDeleteError } = await admin
      .from('profile_phases')
      .delete()
      .in('profile_id', profileIds)
    if (phasesDeleteError) return json(500, { error: 'Data deletion failed' })
  }

  for (const table of ['checklist_profiles', 'favorites', 'user_preferences', 'feedback']) {
    const { error } = await admin.from(table).delete().eq('user_id', user.id)
    if (error) return json(500, { error: 'Data deletion failed' })
  }

  // 3. Auth user last
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    console.error('[delete-account] auth deletion failed', deleteUserError)
    return json(500, { error: 'Account deletion failed' })
  }

  return json(200, { success: true })
})
