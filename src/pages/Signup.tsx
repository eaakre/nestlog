import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmNotice, setConfirmNotice] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signUp(email, password, name)
    setBusy(false)
    if (error) setError(error)
    else {
      setConfirmNotice(true)
      setTimeout(() => navigate('/'), 1500)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl mb-1">Create your account</h1>
        <p className="text-parchment-300 mb-8">You and your partner each get your own login, sharing one child.</p>
        {confirmNotice ? (
          <p className="text-sage-500">Account created. Taking you in…</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label">Your name</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-dusk-500 text-sm">{error}</p>}
            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
        )}
        <p className="text-parchment-300 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-dusk-400 hover:text-dusk-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
