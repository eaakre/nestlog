export type Profile = {
  id: string
  display_name: string | null
  created_at: string
}

export type Child = {
  id: string
  name: string
  birth_date: string | null
  created_by: string
  created_at: string
}

export type ChildMember = {
  child_id: string
  user_id: string
  role: 'parent' | 'caregiver'
  profile?: Profile
}

export type Invite = {
  id: string
  child_id: string
  code: string
  created_by: string
  created_at: string
  expires_at: string | null
  used_by: string | null
  used_at: string | null
}

export type SleepSession = {
  id: string
  child_id: string
  logged_by: string
  start_time: string
  end_time: string | null
  notes: string | null
  created_at: string
}

export type FeedingType = 'breast' | 'bottle' | 'solid'
export type Side = 'left' | 'right' | 'both'

export type Feeding = {
  id: string
  child_id: string
  logged_by: string
  type: FeedingType
  side: Side | null // for breast feeds, the LAST side used
  amount_ml: number | null
  duration_minutes: number | null // total across both sides, for breast feeds
  duration_left_minutes: number | null
  duration_right_minutes: number | null
  start_time: string
  end_time: string | null // null while a breastfeed session is still in progress; bottle/solid are set immediately
  notes: string | null
  created_at: string
}

export type DiaperType = 'wet' | 'dirty' | 'both' | 'dry'

export type Diaper = {
  id: string
  child_id: string
  logged_by: string
  type: DiaperType
  time: string
  notes: string | null
  created_at: string
}

export type PumpingSession = {
  id: string
  child_id: string | null
  logged_by: string
  side: Side | null
  amount_ml: number | null
  start_time: string
  end_time: string | null
  notes: string | null
  created_at: string
}

export type LogKind = 'sleep' | 'feeding' | 'diaper' | 'pumping'

export type TimelineEntry = {
  kind: LogKind
  id: string
  time: string
  data: SleepSession | Feeding | Diaper | PumpingSession
}
