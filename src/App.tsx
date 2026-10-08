import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ChildProvider, useChildren } from './contexts/ChildContext'
import { UnitProvider } from './lib/units'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

function Splash() {
  return (
    <div className="min-h-full flex items-center justify-center">
      <p className="text-parchment-300">Loading…</p>
    </div>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  return children
}

function RequireChild({ children }: { children: JSX.Element }) {
  const { children_, loading } = useChildren()
  if (loading) return <Splash />
  if (children_.length === 0) return <Navigate to="/onboarding" replace />
  return children
}

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) return <Splash />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={session ? <Navigate to="/" replace /> : <Signup />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <RequireChild>
              <Dashboard />
            </RequireChild>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <RequireChild>
              <Settings />
            </RequireChild>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ChildProvider>
        <UnitProvider>
          <AppRoutes />
        </UnitProvider>
      </ChildProvider>
    </AuthProvider>
  )
}
