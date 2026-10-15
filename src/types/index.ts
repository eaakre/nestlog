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

export type DiaperTexture = 'runny' | 'mucousy' | 'mushy' | 'solid' | 'pebbles'
export type DiaperColor = 'black' | 'green' | 'yellow' | 'brown' | 'red' | 'gray'

export type Diaper = {
  id: string
  child_id: string
  logged_by: string
  wet: boolean
  dirty: boolean // "dry" is simply wet === false && dirty === false
  texture: DiaperTexture | null
  color: DiaperColor | null
  blowout: boolean
  diaper_rash: boolean
  time: string
  notes: string | null
  created_at: string
}

export type PumpingSession = {
  id: string
  child_id: string | null
  logged_by: string
  side: Side | null
  amount_ml: number | null // total of left + right
  amount_left_ml: number | null
  amount_right_ml: number | null
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

export type Milestone = {
  id: string
  child_id: string
  logged_by: string
  title: string
  notes: string | null
  happened_on: string // YYYY-MM-DD
  photo_path: string | null
  created_at: string
}

export type GrowthKind = 'weight' | 'height' | 'head'

export type GrowthMeasurement = {
  id: string
  child_id: string
  logged_by: string
  kind: GrowthKind
  value: number // grams for weight, cm for height/head
  measured_on: string // YYYY-MM-DD
  notes: string | null
  created_at: string
}
