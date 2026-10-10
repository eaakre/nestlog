import { supabase } from './supabase'

export type PartnerEvent = 'sleep_start' | 'sleep_end' | 'feed_breast' | 'feed_bottle' | 'feed_solid' | 'diaper' | 'pump_start'

// Fire-and-forget: tell the other parent what just happened. Never blocks or breaks logging.
export function notifyPartner(childId: string, event: PartnerEvent, detail?: string) {
  supabase.functions.invoke('notify-partner', { body: { childId, event, detail } }).catch(() => {})
}
