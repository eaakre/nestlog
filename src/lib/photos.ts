import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const BUCKET = 'milestone-photos'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('this browser could not decode the image'))
    }
    img.src = url
  })
}

/** Shrink a phone photo before upload (max 1600px, JPEG) so it's quick and small. */
export async function resizeToJpeg(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  // <img> honors EXIF rotation and handles iPhone HEIC; ImageBitmap is the fallback.
  let source: HTMLImageElement | ImageBitmap
  try {
    source = await loadImage(file)
  } catch {
    source = await createImageBitmap(file)
  }
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height
  if (!w || !h) throw new Error('image has no size')
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode JPEG'))), 'image/jpeg', quality)
  )
}

const step = (label: string, e: unknown) => new Error(`Photo ${label} failed: ${e instanceof Error ? e.message : String(e)}`)

/** Uploads a photo for any entry; returns its storage path. Errors name the step that failed. */
export async function uploadMilestonePhoto(childId: string, file: File): Promise<string> {
  let blob: Blob = file
  let type = 'image/jpeg'
  try {
    blob = await resizeToJpeg(file)
  } catch (e) {
    // Fall back to the original file when it is already a web-friendly format.
    if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
      blob = file
      type = file.type
    } else {
      throw step('processing', e)
    }
  }
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${childId}/${crypto.randomUUID()}.${ext}`
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type })
    if (error) throw error
  } catch (e) {
    throw step('upload', e && typeof e === 'object' && 'message' in e ? new Error(String((e as { message: unknown }).message)) : e)
  }
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
