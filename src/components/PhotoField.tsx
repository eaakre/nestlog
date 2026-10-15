import { useEffect, useRef, useState } from 'react'
import MilestonePhoto from './MilestonePhoto'
import Photo from './Photo'
import { removeMilestonePhoto, uploadMilestonePhoto } from '../lib/photos'

/**
 * Add / change / remove a photo on an entry. Call `resolve()` while saving to
 * get the path to store, then `cleanup(newPath)` once the row is saved.
 */
export function usePhotoField(childId: string, existing: string | null | undefined) {
  const [file, setFile] = useState<File | null>(null)
  const [removed, setRemoved] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const has = !!file || (!!existing && !removed)

  const resolve = async (): Promise<string | null> => {
    if (file) return uploadMilestonePhoto(childId, file)
    return removed ? null : existing ?? null
  }
  const cleanup = async (newPath: string | null) => {
    if (existing && existing !== newPath) await removeMilestonePhoto(existing)
  }

  const node = (
    <div className="flex flex-col gap-3">
      {has && (preview ? <Photo src={preview} fit="contain" zoom className="w-full max-h-72" /> : <MilestonePhoto path={existing ?? null} fit="contain" zoom className="w-full max-h-72" />)}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFile(f)
            setRemoved(false)
          }
          e.target.value = ''
        }}
      />
      <div className="flex gap-2 justify-center">
        <button type="button" className="btn-secondary" onClick={() => input.current?.click()}>
          {has ? 'Change photo' : 'Add Photo'}
        </button>
        {has && (
          <button type="button" className="btn-ghost !text-dusk-400" onClick={() => { setFile(null); setRemoved(true) }}>
            Remove
          </button>
        )}
      </div>
    </div>
  )
  return { node, resolve, cleanup }
}
