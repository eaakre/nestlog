// Called by the app right after someone logs something. Tells the *other*
// members of the child (who have partner alerts on) what happened.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, pushToUsers, cors } from '../_shared/push.ts'

type Evt = 'sleep_start' | 'sleep_end' | 'feed_breast' | 'feed_bottle' | 'feed_solid' | 'diaper' | 'pump_start'

const TEXT: Record<Evt, (n: string, c: string, d?: string) => string> = {
  sleep_start: (n, c) => `${n} put ${c} down to sleep`,
  sleep_end: (n, c, d) => `${c} woke up${d ? ` after ${d}` : ''} (logged by ${n})`,
  feed_breast: (n, c) => `${n} started a breastfeed for ${c}`,
  feed_bottle: (n, c, d) => `${n} gave ${c} a bottle${d ? ` (${d})` : ''}`,
  feed_solid: (n, c) => `${n} fed ${c} solids`,
  diaper: (n, c, d) => `${n} changed ${c}'s diaper${d ? ` (${d})` : ''}`,
  pump_start: (n) => `${n} started pumping`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: u } = await userClient.auth.getUser()
    const me = u.user
    if (!me) return new Response('unauthorized', { status: 401, headers: cors })

    const { childId, event, detail } = (await req.json()) as { childId: string; event: Evt; detail?: string }
    if (!TEXT[event]) return new Response('bad event', { status: 400, headers: cors })

    const admin = adminClient()
    const { data: members } = await admin.from('child_members').select('user_id').eq('child_id', childId)
    const ids = (members ?? []).map((m) => m.user_id as string)
    if (!ids.includes(me.id)) return new Response('forbidden', { status: 403, headers: cors })

    const others = ids.filter((id) => id !== me.id)
    // Default is ON, so only exclude people who explicitly turned alerts off.
    const { data: off } = await admin.from('notification_prefs').select('user_id').in('user_id', others).eq('partner_alerts', false)
    const offSet = new Set((off ?? []).map((o) => o.user_id as string))
    const targets = others.filter((id) => !offSet.has(id))

    const [{ data: profile }, { data: child }] = await Promise.all([
      admin.from('profiles').select('display_name').eq('id', me.id).maybeSingle(),
      admin.from('children').select('name').eq('id', childId).maybeSingle()
    ])
    const name = profile?.display_name ?? 'Your partner'
    const childName = child?.name ?? 'baby'

    const sent = await pushToUsers(admin, targets, {
      title: 'Nestlog',
      body: TEXT[event](name, childName, detail),
      tag: `partner-${event}`
    })
    return new Response(JSON.stringify({ sent }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(String(e), { status: 500, headers: cors })
  }
})
