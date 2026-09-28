// A signed-in learner's own playlists (/api/me/playlists/** — any signed-in
// account, no module grant needed): always-private collections they build up
// while watching. Viewing one uses the existing learner collection/player
// endpoints (useLearn) — a learner's own private collection is already
// visible there, so playlists need no endpoints of their own beyond CRUD.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { Collection } from './useCollections'

export function usePlaylists() {
  const api = useApi()
  const base = '/api/me/playlists'

  function mine(page = 1, size = 50) {
    return api<PageEnvelope<Collection>>(base, { query: { page, size } })
  }

  async function create(title: string) {
    return (await api<ApiEnvelope<Collection>>(base, { method: 'POST', body: { title } })).data
  }

  async function rename(id: number, title: string) {
    return (await api<ApiEnvelope<Collection>>(`${base}/${id}`, { method: 'PUT', body: { title } })).data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
  }

  async function addVideo(id: number, videoId: number) {
    return (await api<ApiEnvelope<Collection>>(`${base}/${id}/videos`, { method: 'POST', body: { videoId } })).data
  }

  async function removeVideo(id: number, videoId: number) {
    return (await api<ApiEnvelope<Collection>>(`${base}/${id}/videos/${videoId}`, { method: 'DELETE' })).data
  }

  return { mine, create, rename, remove, addVideo, removeVideo }
}
