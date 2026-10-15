import { useEffect, useRef, useState } from 'react'

// Measures an element's width so SVG charts can draw at real pixel size.
export function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth || fallback)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || fallback))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fallback])
  return { ref, width }
}
