import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { todayISO } from '../../lib/age'
import { uploadMilestonePhoto, removeMilestonePhoto } from '../../lib/photos'
import EditorShell from '../EditorShell'
import DateInput from '../DateInput'
import MilestonePhoto from '../MilestonePhoto'
import type { Milestone } from '../../types'

const IDEAS = ['First smile', 'Laughed', 'Rolled over', 'Sat up', 'First tooth', 'Crawling', 'Pulled up to stand', 'First solid food', 'First words', 'First steps']

// Create (no entry) or edit/delete a Baby First.
export default function MilestoneEditor({
  childId,
  entry,
  onClose,
  onChanged
}: {
  childId: string
  entry?: Milestone
  onClose: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [date, setDate] = useState(entry?.happened_on ?? todayISO())
  const [title, setTitle] = useState(entry?.title ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removeExisting, setRemoveExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const hasPhoto = !!file || (!!entry?.photo_path && !removeExisting)

  const save = async () => {
    if (!user || !title.trim() || !date) return
    setBusy(true)
    setError(null)
    try {
      let photo_path = removeExisting ? null : entry?.photo_path ?? null
      if (file) photo_path = await uploadMilestonePhoto(childId, file)

      const fields = { title: title.trim(), notes: notes.trim() || null, happened_on: date, photo_path }
      const { error } = entry
        ? await supabase.from('milestones').update(fields).eq('id', entry.id)
        : await supabase.from('milestones').insert({ child_id: childId, logged_by: user.id, ...fields })
      if (error) throw new Error(error.message)

      // Clean up an old photo that was replaced or removed.
      if (entry?.photo_path && entry.photo_path !== photo_path) await removeMilestonePhoto(entry.photo_path)
      onChanged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!entry) return
    setBusy(true)
    const { error } = await supabase.from('milestones').delete().eq('id', entry.id)
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    if (entry.photo_path) await removeMilestonePhoto(entry.photo_path)
    onChanged()
    onClose()
  }

  return (
    <EditorShell
      title="Baby First"
      onClose={onClose}
      onSave={save}
      onDelete={entry ? remove : undefined}
      busy={busy}
      saveDisabled={!title.trim() || !date}
      loggedBy={entry?.logged_by}
    >
      <div>
        <label className="label">Date</label>
        <DateInput value={date} onChange={setDate} />
      </div>

      <div>
        <label className="label">Baby First</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened?" />
        {!entry && !title && (
          <div className="flex flex-wrap gap-2 mt-2">
            {IDEAS.map((idea) => (
              <button key={idea} type="button" className="btn-secondary !px-3 !py-1 text-sm" onClick={() => setTitle(idea)}>
                {idea}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>

      {hasPhoto && (
        <div className="relative">
          {preview ? (
            <img src={preview} alt="" className="w-full max-h-64 rounded-xl object-cover" />
          ) : (
            <MilestonePhoto path={entry?.photo_path ?? null} className="w-full max-h-64 h-48" />
          )}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFile(f)
            setRemoveExisting(false)
          }
          e.target.value = ''
        }}
      />
      <div className="flex gap-2 justify-center">
        <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          {hasPhoto ? 'Change photo' : 'Add Photo'}
        </button>
        {hasPhoto && (
          <button
            type="button"
            className="btn-ghost !text-dusk-400"
            onClick={() => {
              setFile(null)
              setRemoveExisting(true)
            }}
            disabled={busy}
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-dusk-500 text-sm">{error}</p>}
    </EditorShell>
  )
}
