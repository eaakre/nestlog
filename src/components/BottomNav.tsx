import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Activity', icon: '🏠', end: true },
  { to: '/history', label: 'History', icon: '🗓️' },
  { to: '/trends', label: 'Trends', icon: '📈' },
  { to: '/settings', label: 'Account', icon: '👤' }
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-night-900/95 backdrop-blur border-t border-night-700 pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <ul className="max-w-lg mx-auto grid grid-cols-4">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <NavLink
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-parchment-100' : 'text-parchment-300'}`
              }
            >
              <span className="text-xl leading-none" aria-hidden>{i.icon}</span>
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
