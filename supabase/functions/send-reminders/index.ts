// Runs every few minutes on a schedule (see README). Sends:
//  - "timer still running" reminders for open sleep / breastfeed / pumping sessions
//  - "it's been N hours since the last feeding" reminders
// Each reminder is sent once per session / feeding thanks to sent_reminders.
import { adminClient, pushToUsers } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const admin = adminClient()
  const now = Date.now()
  let sent = 0

  const { data: prefs } = await admin.from('notification_prefs').select('*')
  for (const p of prefs ?? []) {
    const { data: memberships } = await admin.from('child_members').select('child_id').eq('user_id', p.user_id)
    const childIds = (memberships ?? []).map((m) => m.child_id as string)
    if (childIds.length === 0) continue
    const { data: kids } = await admin.from('children').select('id,name').in('id', childIds)
    const nameOf = new Map((kids ?? []).map((k) => [k.id as string, k.name as string]))

    const once = async (key: string, title: string, body: string, tag: string) => {
      const { error } = await admin.from('sent_reminders').insert({ key })
      if (error) return // already sent (primary key conflict)
      sent += await pushToUsers(admin, [p.user_id], { title, body, tag })
    }

    if (p.timer_reminders) {
      const cutoff = new Date(now - p.timer_minutes * 60000).toISOString()
      const [sleep, feeds, pumps] = await Promise.all([
        admin.from('sleep_sessions').select('id,child_id,start_time').in('child_id', childIds).is('end_time', null).lt('start_time', cutoff),
        admin.from('feedings').select('id,child_id,start_time').in('child_id', childIds).is('end_time', null).lt('start_time', cutoff),
        admin.from('pumping_sessions').select('id,start_time').eq('logged_by', p.user_id).is('end_time', null).lt('start_time', cutoff)
      ])
      const mins = (t: string) => Math.round((now - new Date(t).getTime()) / 60000)
      const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)
      for (const s of sleep.data ?? [])
        await once(`timer:sleep:${s.id}:${p.user_id}`, 'Sleep timer running', `${nameOf.get(s.child_id) ?? 'Baby'} has been sleeping for ${fmt(mins(s.start_time))}.`, 'timer-sleep')
      for (const f of feeds.data ?? [])
        await once(`timer:feed:${f.id}:${p.user_id}`, 'Feeding timer running', `A breastfeed has been open for ${fmt(mins(f.start_time))}. Forgot to stop it?`, 'timer-feed')
      for (const s of pumps.data ?? [])
        await once(`timer:pump:${s.id}:${p.user_id}`, 'Pumping timer running', `Pumping has been going for ${fmt(mins(s.start_time))}. Forgot to stop it?`, 'timer-pump')
    }

    if (p.feed_reminders) {
      for (const childId of childIds) {
        const { data: open } = await admin.from('feedings').select('id').eq('child_id', childId).is('end_time', null).limit(1)
        if (open && open.length) continue
        const { data: last } = await admin.from('feedings').select('id,start_time').eq('child_id', childId).order('start_time', { ascending: false }).limit(1).maybeSingle()
        if (!last) continue
        const hours = (now - new Date(last.start_time).getTime()) / 3600000
        if (hours >= p.feed_hours)
          await once(`feed:${last.id}:${p.user_id}`, 'Feeding reminder', `It's been ${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m since ${nameOf.get(childId) ?? 'baby'}'s last feeding.`, 'feed-reminder')
      }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
