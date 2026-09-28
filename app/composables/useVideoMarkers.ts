// Wraps the backend's VideoMarkerController (/api/admin/videos/{id}/markers),
// gated as module "videos": GET = READ, the rest = WRITE. Named timestamps on
// a video's timeline, shown as flags on the ruler.

import type { ApiEnvelope } from '#shared/types'

export interface VideoMarker {
  id: number
  atMs: number
  label: string
  color: string | null
  createdBy: string | null
  createdAt: string
}

export function useVideoMarkers() {
  const api = useApi()
  const base = (videoId: number) => `/api/admin/videos/${videoId}/markers`

  async function list(videoId: number) {
    return (await api<ApiEnvelope<VideoMarker[]>>(base(videoId))).data
  }

  async function create(videoId: number, body: { atMs: number; label: string; color?: string }) {
    return (await api<ApiEnvelope<VideoMarker>>(base(videoId), { method: 'POST', body })).data
  }

  async function update(videoId: number, markerId: number, body: { atMs: number; label: string; color?: string }) {
    return (await api<ApiEnvelope<VideoMarker>>(`${base(videoId)}/${markerId}`, { method: 'PUT', body })).data
  }

  async function remove(videoId: number, markerId: number) {
    await api(`${base(videoId)}/${markerId}`, { method: 'DELETE' })
  }

  return { list, create, update, remove }
}
