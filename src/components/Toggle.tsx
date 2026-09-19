export default function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-1"
    >
      <span className="text-parchment-100">{label}</span>
      <span
        className={`relative w-12 h-7 rounded-full transition-colors ${checked ? 'bg-dusk-500' : 'bg-night-700'}`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-parchment-100 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
