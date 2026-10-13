// Wraps the backend's VideoNoteController (/api/admin/videos/{id}/notes): review notes on a video between
// the people who work on it. Module "videos": reading needs READ; writing, resolving and deleting WRITE
// (deleting also needs to be the author or an admin).
import type { ApiEnvelope } from '#shared/types'

export interface VideoNote {
  id: number
  videoId: number
  body: string
  author: string
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string | null
}

export function useVideoNotes() {
  const api = useApi()
  const base = (videoId: number) => `/api/admin/videos/${videoId}/notes`

  async function list(videoId: number) {
    return (await api<ApiEnvelope<VideoNote[]>>(base(videoId))).data
  }
  async function add(videoId: number, body: string) {
    return (await api<ApiEnvelope<VideoNote>>(base(videoId), { method: 'POST', body: { body } })).data
  }
  async function setResolved(videoId: number, noteId: number, resolved: boolean) {
    return (await api<ApiEnvelope<VideoNote>>(`${base(videoId)}/${noteId}`, { method: 'PUT', body: { resolved } })).data
  }
  async function remove(videoId: number, noteId: number) {
    await api(`${base(videoId)}/${noteId}`, { method: 'DELETE' })
  }

  return { list, add, setResolved, remove }
}
