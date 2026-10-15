import { useSignedUrl } from '../lib/photos'

export default function MilestonePhoto({ path, className = '' }: { path: string | null; className?: string }) {
  const url = useSignedUrl(path)
  if (!path) return null
  return url ? (
    <img src={url} alt="" loading="lazy" className={`rounded-xl object-cover ${className}`} />
  ) : (
    <div className={`rounded-xl bg-night-950 ${className}`} />
  )
}
