// Date + time as two native inputs. Mobile browsers handle separate date and
// time pickers far more reliably than a single datetime-local field.
// Value format matches datetime-local: "YYYY-MM-DDTHH:mm" (local time).
export default function DateTimeInput({
  value,
  onChange,
  className = ''
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [date = '', time = ''] = value ? value.split('T') : []
  const emit = (d: string, t: string) => onChange(d ? `${d}T${t || '00:00'}` : '')

  const field = 'input !text-base min-w-0 [color-scheme:dark]'
  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        className={`${field} flex-[3]`}
        type="date"
        value={date}
        onChange={(e) => emit(e.target.value, time)}
        aria-label="Date"
      />
      <input
        className={`${field} flex-[2]`}
        type="time"
        value={time}
        onChange={(e) => emit(date, e.target.value)}
        aria-label="Time"
      />
    </div>
  )
}
