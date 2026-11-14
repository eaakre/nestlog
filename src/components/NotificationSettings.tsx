import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { currentSubscription, disablePush, enablePush, pushSupport } from '../lib/push'
import Toggle from './Toggle'

type Prefs = { partner_alerts: boolean; timer_reminders: boolean; timer_minutes: number; feed_reminders: boolean; feed_hours: number; nap_reminders: boolean; nap_lead_minutes: number; timezone: string }
const DEFAULTS: Prefs = { partner_alerts: true, timer_reminders: true, timer_minutes: 60, feed_reminders: false, feed_hours: 3, nap_reminders: true, nap_lead_minutes: 10, timezone: 'America/Chicago' }

export default function NotificationSettings() {
  const { user } = useAuth()
  const [support] = useState(pushSupport)
  const [enabled, setEnabled] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    currentSubscription().then((s) => setEnabled(!!s && Notification.permission === 'granted')).catch(() => {})
    supabase
      .from('notification_prefs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const loaded = { ...DEFAULTS, ...(data as Prefs) }
        setPrefs(loaded)
        // Keep the saved timezone in step with this device (the reminder job runs in UTC).
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (tz && tz !== loaded.timezone) {
          setPrefs({ ...loaded, timezone: tz })
          supabase.from('notification_prefs').update({ timezone: tz }).eq('user_id', user.id).then(() => {})
        }
      })
  }, [user])

  const savePrefs = async (next: Prefs) => {
    setPrefs(next)
    if (!user) return
    await supabase.from('notification_prefs').upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() })
  }

  const toggleDevice = async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    if (enabled) {
      await disablePush()
      setEnabled(false)
    } else {
      const { error } = await enablePush(user.id)
      if (error) setError(error)
      else {
        setEnabled(true)
        await savePrefs(prefs) // make sure a prefs row exists
      }
    }
    setBusy(false)
  }

  const notice =
    support === 'ios-needs-install'
      ? 'On iPhone, add Nestlog to your Home Screen first (Share → Add to Home Screen), then open it from there to turn notifications on.'
      : support === 'unsupported'
        ? "This browser doesn't support push notifications."
        : support === 'no-key'
          ? 'Push is not configured yet (missing VITE_VAPID_PUBLIC_KEY).'
          : null

  return (
    <div className="card mb-4 flex flex-col gap-4">
      <div>
        <p className="text-parchment-100">Notifications</p>
        <p className="text-parchment-300 text-sm">Alerts from your partner and timer reminders, on this device.</p>
      </div>

      {notice ? (
        <p className="text-parchment-300 text-sm">{notice}</p>
      ) : (
        <>
          <button className={enabled ? 'btn-secondary' : 'btn-primary'} onClick={toggleDevice} disabled={busy}>
            {enabled ? 'Turn off on this device' : 'Turn on notifications'}
          </button>
          {error && <p className="text-dusk-500 text-sm">{error}</p>}
        </>
      )}

      <div className={enabled ? 'flex flex-col gap-4' : 'flex flex-col gap-4 opacity-50 pointer-events-none'}>
        <Row label="Partner activity" hint="When your partner starts a sleep, feed, pump, or changes a diaper" checked={prefs.partner_alerts} onChange={(v) => savePrefs({ ...prefs, partner_alerts: v })} />

        <Row label="Timer still running" hint="Remind me about sleep, breastfeed, or pumping timers left on" checked={prefs.timer_reminders} onChange={(v) => savePrefs({ ...prefs, timer_reminders: v })} />
        {prefs.timer_reminders && (
          <Select
            label="Remind after"
            value={prefs.timer_minutes}
            options={[[30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'], [180, '3 hours']]}
            onChange={(v) => savePrefs({ ...prefs, timer_minutes: v })}
          />
        )}

        <Row label="Feeding reminder" hint="Nudge me when it's been a while since the last feeding" checked={prefs.feed_reminders} onChange={(v) => savePrefs({ ...prefs, feed_reminders: v })} />
        {prefs.feed_reminders && (
          <Select
            label="Remind after"
            value={prefs.feed_hours}
            options={[[2, '2 hours'], [2.5, '2.5 hours'], [3, '3 hours'], [3.5, '3.5 hours'], [4, '4 hours']]}
            onChange={(v) => savePrefs({ ...prefs, feed_hours: v })}
          />
        )}

        <Row label="Nap window reminder" hint="Nudge me shortly before it's time for a nap (or bedtime), based on wake windows" checked={prefs.nap_reminders} onChange={(v) => savePrefs({ ...prefs, nap_reminders: v })} />
        {prefs.nap_reminders && (
          <Select
            label="Notify me"
            value={prefs.nap_lead_minutes}
            options={[[0, 'When it opens'], [10, '10 min before'], [15, '15 min before'], [20, '20 min before'], [30, '30 min before']]}
            onChange={(v) => savePrefs({ ...prefs, nap_lead_minutes: v })}
          />
        )}
      </div>
    </div>
  )
}

function Row({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <Toggle label={label} checked={checked} onChange={onChange} />
      <p className="text-parchment-300 text-xs">{hint}</p>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: number; options: [number, string][]; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between text-sm text-parchment-300">
      {label}
      <select
        className="bg-night-950 border border-night-700 rounded-xl px-3 py-2 text-parchment-100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  )
}
