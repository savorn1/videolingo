// The storage report (backend StorageController, /api/admin/videos/storage): what each video's files take, and
// the clean-up of old versions. Gated as module "videos": the report is READ, the clean-up WRITE.
import type { ApiEnvelope } from '#shared/types'

export interface StorageRow {
  videoId: number
  title: string
  deleted: boolean
  fileBytes: number
  versions: number
  versionBytes: number
  results: number
  resultBytes: number
  dubBytes: number
  exportBytes: number
}

export interface StorageReport {
  totals: { files: number; versions: number; results: number; dubs: number; exports: number }
  totalBytes: number
  videoCount: number
  /** The videos taking the most space, biggest first (up to 50). */
  biggest: StorageRow[]
}

export function useStorageReport() {
  const api = useApi()
  const base = '/api/admin/videos/storage'

  async function report() {
    return (await api<ApiEnvelope<StorageReport>>(base)).data
  }

  /** Removes all but the newest `keepLatest` versions of every video, of those only ones older than `olderThanDays`. */
  async function pruneVersions(keepLatest: number, olderThanDays: number) {
    return (await api<ApiEnvelope<{ removed: number; freedBytes: number }>>(`${base}/prune-versions`, { method: 'POST', body: { keepLatest, olderThanDays } }))
      .data
  }

  return { report, pruneVersions }
}
