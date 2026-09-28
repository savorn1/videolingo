// Wraps the backend's VideoVersionController (/api/admin/videos/{id}/versions),
// gated as module "videos": GET = READ, the rest = WRITE. A video's file is
// versioned automatically — replacing it (upload, or promoting a trim/crop
// edit) keeps the previous file here instead of deleting it.

import type { ApiEnvelope } from '#shared/types'
import type { Video } from './useVideos'

export interface VideoVersion {
  id: number
  url: string
  fileSize: number | null
  mimeType: string | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  /** What produced this version, e.g. "Replaced by upload". */
  note: string | null
  createdBy: string | null
  createdAt: string
}

export function useVideoVersions() {
  const api = useApi()
  const base = (videoId: number) => `/api/admin/videos/${videoId}/versions`

  async function list(videoId: number) {
    return (await api<ApiEnvelope<VideoVersion[]>>(base(videoId))).data
  }

  /** Makes this version the video's current file again — the current file becomes a new version first. */
  async function restore(videoId: number, versionId: number) {
    return (await api<ApiEnvelope<Video>>(`${base(videoId)}/${versionId}/restore`, { method: 'POST' })).data
  }

  async function remove(videoId: number, versionId: number) {
    await api(`${base(videoId)}/${versionId}`, { method: 'DELETE' })
  }

  return { list, restore, remove }
}
