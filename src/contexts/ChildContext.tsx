import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Child } from '../types'

type ChildContextValue = {
  children_: Child[]
  activeChild: Child | null
  setActiveChildId: (id: string) => void
  loading: boolean
  members: Record<string, string>
  createChild: (name: string, birthDate: string | null) => Promise<{ error: string | null; child: Child | null }>
  createInvite: (childId: string) => Promise<{ code: string | null; error: string | null }>
  redeemInvite: (code: string) => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

const ChildContext = createContext<ChildContextValue | undefined>(undefined)

const ACTIVE_CHILD_KEY = 'nestlog:activeChildId'

export function ChildProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [childList, setChildList] = useState<Child[]>([])
  const [activeChildId, setActiveChildIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_CHILD_KEY)
  )
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setChildList([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('child_members')
      .select('children(*)')
      .eq('user_id', user.id)

    if (!error && data) {
      const list = data.map((row: any) => row.children).filter(Boolean) as Child[]
      setChildList(list)
      if (!activeChildId && list.length > 0) {
        setActiveChildIdState(list[0].id)
        localStorage.setItem(ACTIVE_CHILD_KEY, list[0].id)
      }
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setActiveChildId = (id: string) => {
    setActiveChildIdState(id)
    localStorage.setItem(ACTIVE_CHILD_KEY, id)
  }

  const createChild = async (name: string, birthDate: string | null) => {
    if (!user) return { error: 'Not signed in', child: null }
    // Generate the id here and don't ask for the row back: the creator isn't a
    // member yet, so a RETURNING/select on the new row would fail row-level security.
    const id = crypto.randomUUID()
    const { error } = await supabase.from('children').insert({ id, name, birth_date: birthDate, created_by: user.id })
    if (error) return { error: error.message, child: null }

    const { error: memberError } = await supabase.from('child_members').insert({ child_id: id, user_id: user.id, role: 'parent' })
    if (memberError) return { error: memberError.message, child: null }
    await refresh()
    setActiveChildId(id)
    return { error: null, child: { id, name, birth_date: birthDate, created_by: user.id } as Child }
  }

  const createInvite = async (childId: string) => {
    if (!user) return { code: null, error: 'Not signed in' }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const { error } = await supabase.from('invites').insert({
      child_id: childId,
      code,
      created_by: user.id,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
    })
    if (error) return { code: null, error: error.message }
    return { code, error: null }
  }

  const redeemInvite = async (code: string) => {
    if (!user) return { error: 'Not signed in' }
    const { data: invite, error: findError } = await supabase
      .from('invites')
      .select('*')
      .eq('code', code.toUpperCase())
      .is('used_by', null)
      .single()

    if (findError || !invite) return { error: 'Invite code not found or already used' }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { error: 'This invite has expired' }
    }

    const { error: joinError } = await supabase
      .from('child_members')
      .insert({ child_id: invite.child_id, user_id: user.id, role: 'parent' })
    if (joinError) return { error: joinError.message }

    await supabase.from('invites').update({ used_by: user.id, used_at: new Date().toISOString() }).eq('id', invite.id)
    await refresh()
    setActiveChildId(invite.child_id)
    return { error: null }
  }

  const activeChild = childList.find((c) => c.id === activeChildId) ?? null

  // user id -> display name, for "saved by" labels
  const [members, setMembers] = useState<Record<string, string>>({})
  const activeId = activeChild?.id ?? null
  useEffect(() => {
    if (!activeId) {
      setMembers({})
      return
    }
    supabase
      .from('child_members')
      .select('user_id, profiles(display_name)')
      .eq('child_id', activeId)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((row: any) => {
          map[row.user_id] = row.profiles?.display_name ?? 'Someone'
        })
        setMembers(map)
      })
  }, [activeId])

  return (
    <ChildContext.Provider
      value={{
        children_: childList,
        activeChild,
        setActiveChildId,
        loading,
        members,
        createChild,
        createInvite,
        redeemInvite,
        refresh
      }}
    >
      {children}
    </ChildContext.Provider>
  )
}

export function useChildren() {
  const ctx = useContext(ChildContext)
  if (!ctx) throw new Error('useChildren must be used within ChildProvider')
  return ctx
}
