import { ReactNode, useState } from 'react'
import Modal from './Modal'
import { useChildren } from '../contexts/ChildContext'

// Shared frame for the edit modals: Save, a two-tap Delete, and "saved by".
export default function EditorShell({
  title,
  onClose,
  onSave,
  onDelete,
  busy,
  saveDisabled,
  loggedBy,
  error,
  children
}: {
  title: string
  onClose: () => void
  onSave: () => void
  onDelete?: () => void
  busy: boolean
  saveDisabled?: boolean
  loggedBy?: string
  error?: string | null
  children: ReactNode
}) {
  const { members } = useChildren()
  const [confirming, setConfirming] = useState(false)
  const name = loggedBy ? members[loggedBy] : undefined

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {children}

        {error && <p className="text-sm text-dusk-400 break-words" role="alert">{error}</p>}

        <button className="btn-primary" onClick={onSave} disabled={busy || saveDisabled}>
          Save
        </button>

        {onDelete &&
          (confirming ? (
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirming(false)} disabled={busy}>
                Keep it
              </button>
              <button className="btn-secondary flex-1 !text-dusk-400" onClick={onDelete} disabled={busy}>
                Yes, delete
              </button>
            </div>
          ) : (
            <button className="btn-ghost !text-dusk-400" onClick={() => setConfirming(true)} disabled={busy}>
              Delete entry
            </button>
          ))}

        {name && <p className="text-center text-sm text-parchment-300">Activity saved by {name}</p>}
      </div>
    </Modal>
  )
}
