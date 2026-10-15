import { useSignedUrl } from '../lib/photos'
import Photo from './Photo'

export default function MilestonePhoto({
  path,
  className = '',
  fit = 'cover',
  zoom = false
}: {
  path: string | null
  className?: string
  fit?: 'cover' | 'contain'
  zoom?: boolean
}) {
  const url = useSignedUrl(path)
  if (!path) return null
  return url ? <Photo src={url} className={className} fit={fit} zoom={zoom} /> : <div className={`rounded-xl bg-night-950 ${className}`} />
}
