import { Link } from 'react-router-dom'
import { useChildren } from '../contexts/ChildContext'
import SleepCard from '../components/SleepCard'
import FeedingCard from '../components/FeedingCard'
import DiaperCard from '../components/DiaperCard'
import PumpingCard from '../components/PumpingCard'
import Timeline from '../components/Timeline'

export default function Dashboard() {
  const { activeChild, children_, setActiveChildId } = useChildren()

  if (!activeChild) return null

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-parchment-300 text-sm">Tracking</p>
          {children_.length > 1 ? (
            <select
              className="bg-transparent text-2xl font-display -ml-1"
              value={activeChild.id}
              onChange={(e) => setActiveChildId(e.target.value)}
            >
              {children_.map((c) => (
                <option key={c.id} value={c.id} className="bg-night-800">
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="text-2xl">{activeChild.name}</h1>
          )}
        </div>
        <Link to="/settings" className="btn-ghost !px-3 !py-2 text-xl" aria-label="Settings">
          ⚙️
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <SleepCard childId={activeChild.id} />
        <PumpingCard childId={activeChild.id} />
        <FeedingCard childId={activeChild.id} />
        <DiaperCard childId={activeChild.id} />
      </div>

      <h2 className="text-lg mb-3">Today</h2>
      <Timeline childId={activeChild.id} />
    </div>
  )
}
