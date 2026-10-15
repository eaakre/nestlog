import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChildren } from '../contexts/ChildContext'
import { useAuth } from '../contexts/AuthContext'

export default function Onboarding() {
  const { createChild, redeemInvite } = useChildren()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submitCreate = async () => {
    setBusy(true)
    setError(null)
    const { error } = await createChild(name, birthDate || null)
    setBusy(false)
    if (error) setError(error)
    else navigate('/', { replace: true })
  }

  const submitJoin = async () => {
    setBusy(true)
    setError(null)
    const { error } = await redeemInvite(code)
    setBusy(false)
    if (error) setError(error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl mb-1">Let's set up your little one</h1>
        <p className="text-parchment-300 mb-8">Add a child profile, or join the one your partner already made.</p>

        {mode === 'choose' && (
          <div className="flex flex-col gap-3">
            <button className="btn-primary" onClick={() => setMode('create')}>
              Add my child
            </button>
            <button className="btn-secondary" onClick={() => setMode('join')}>
              I have an invite code
            </button>
            <button className="btn-ghost text-sm mt-4" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Child's name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Birth date (optional)</label>
              <input className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            {error && <p className="text-dusk-500 text-sm">{error}</p>}
            <button className="btn-primary" onClick={submitCreate} disabled={busy || !name}>
              {busy ? 'Creating…' : 'Create child profile'}
            </button>
            <button className="btn-ghost text-sm" onClick={() => setMode('choose')}>
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Invite code</label>
              <input
                className="input uppercase tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 8K3PQZ"
              />
            </div>
            {error && <p className="text-dusk-500 text-sm">{error}</p>}
            <button className="btn-primary" onClick={submitJoin} disabled={busy || !code}>
              {busy ? 'Joining…' : 'Join child'}
            </button>
            <button className="btn-ghost text-sm" onClick={() => setMode('choose')}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
