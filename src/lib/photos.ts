import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const BUCKET = 'milestone-photos'

/** Shrink a phone photo before upload (max 1600px, JPEG) so it's quick and small. */
export async function resizeToJpeg(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = URL.createObjectURL(file)
    })
  }
  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that image.'))), 'image/jpeg', quality)
  )
}

export async function uploadMilestonePhoto(childId: string, file: File): Promise<string> {
  const blob = await resizeToJpeg(file)
  const path = `${childId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return path
}

export async function removeMilestonePhoto(path: string) {
  await supabase.storage.from(BUCKET).remove([path])
}

const cache = new Map<string, { url: string; expires: number }>()

/** A short-lived signed link for a private photo (cached per path). */
export function useSignedUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? cache.get(path)?.url ?? null : null))
  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    const hit = cache.get(path)
    if (hit && hit.expires > Date.now()) {
      setUrl(hit.url)
      return
    }
    let cancelled = false
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (cancelled || !data) return
        cache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 })
        setUrl(data.signedUrl)
      })
    return () => {
      cancelled = true
    }
  }, [path])
  return url
}
