import { ReactNode } from 'react'

export default function Modal({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-night-950/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-night-800 border border-night-700 rounded-t-3xl sm:rounded-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-parchment-300 hover:text-parchment-100 text-2xl leading-none" aria-label="Close">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
