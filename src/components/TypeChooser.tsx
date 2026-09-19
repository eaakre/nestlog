import Modal from './Modal'

type Option = {
  key: string
  label: string
  icon: string
  onSelect: () => void
}

export default function TypeChooser({ title, options, onClose }: { title: string; options: Option[]; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-1 -mx-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={opt.onSelect}
            className="flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-night-700 text-left"
          >
            <span className="text-3xl">{opt.icon}</span>
            <span className="font-display text-2xl text-parchment-100">{opt.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
