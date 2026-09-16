import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useChildren } from '../contexts/ChildContext'
import type { Profile } from '../types'

export default function Settings() {
  const { user, profile, signOut } = useAuth()
  const { activeChild, createInvite } = useChildren()
  const [members, setMembers] = useState<Profile[]>([])
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeChild) return
    supabase
      .from('child_members')
      .select('profiles(*)')
      .eq('child_id', activeChild.id)
      .then(({ data }) => {
        if (data) setMembers(data.map((row: any) => row.profiles).filter(Boolean))
      })
  }, [activeChild])

  const invite = async () => {
    if (!activeChild) return
    setError(null)
    const { code, error } = await createInvite(activeChild.id)
    if (error) setError(error)
    else setInviteCode(code)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="btn-ghost !px-3 !py-2" aria-label="Back">
          ←
        </Link>
        <h1 className="text-2xl">Settings</h1>
      </div>

      <div className="card mb-4">
        <p className="text-parchment-300 text-sm">Signed in as</p>
        <p className="text-lg">{profile?.display_name ?? user?.email}</p>
        <p className="text-parchment-300 text-sm">{user?.email}</p>
      </div>

      {activeChild && (
        <div className="card mb-4 flex flex-col gap-3">
          <p className="text-parchment-300 text-sm">Sharing {activeChild.name} with</p>
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li key={m.id} className="text-parchment-100">
                {m.display_name ?? 'Unnamed'} {m.id === user?.id && <span className="text-parchment-300">(you)</span>}
              </li>
            ))}
          </ul>
          {inviteCode ? (
            <div className="rounded-xl bg-night-950 border border-night-700 p-4 text-center">
              <p className="text-parchment-300 text-xs mb-1">Invite code — share with your partner</p>
              <p className="text-3xl font-display tracking-widest">{inviteCode}</p>
              <p className="text-parchment-300 text-xs mt-1">Expires in 7 days</p>
            </div>
          ) : (
            <button className="btn-secondary" onClick={invite}>
              Invite partner to {activeChild.name}
            </button>
          )}
          {error && <p className="text-dusk-500 text-sm">{error}</p>}
        </div>
      )}

      <Link to="/onboarding" className="btn-secondary w-full mb-4">
        Add another child
      </Link>

      <button className="btn-ghost w-full" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}
