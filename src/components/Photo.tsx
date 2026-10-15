import { useEffect, useState } from 'react'

/** An image that, when `zoom` is set, opens full-screen (uncropped) on tap. */
export default function Photo({
  src,
  className = '',
  fit = 'cover',
  zoom = false
}: {
  src: string
  className?: string
  fit?: 'cover' | 'contain'
  zoom?: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const img = (
    <img
      src={src}
      alt=""
      className={`rounded-xl ${fit === 'contain' ? 'object-contain bg-night-950' : 'object-cover'} ${className}`}
    />
  )
  if (!zoom) return img
  return (
    <>
      <button type="button" className="block w-full" onClick={() => setOpen(true)} aria-label="View full photo">
        {img}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-2"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Photo"
        >
          <img src={src} alt="" className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            className="absolute top-3 right-4 text-3xl leading-none text-parchment-100"
            onClick={() => setOpen(false)}
            aria-label="Close photo"
          >
            &times;
          </button>
        </div>
      )}
    </>
  )
}
