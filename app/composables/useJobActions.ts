// Confirm-then-run flow for a job's retry/cancel/delete, shared by the job
// list and detail pages. A page renders one ConfirmModal bound to `dialog`
// and calls request(job, action) from its buttons.

import type { ProcessingJob } from './useProcessingJobs'

export type JobAction = 'retry' | 'cancel' | 'delete'

const COPY: Record<JobAction, { title: string; confirmLabel: string; color: 'primary' | 'warning' | 'error'; success: string; failure: string }> = {
  retry: { title: 'Retry job', confirmLabel: 'Retry', color: 'primary', success: 'Job re-queued', failure: 'Could not retry job' },
  cancel: { title: 'Cancel job', confirmLabel: 'Cancel job', color: 'warning', success: 'Job cancelled', failure: 'Could not cancel job' },
  delete: { title: 'Delete job', confirmLabel: 'Delete', color: 'error', success: 'Job deleted', failure: 'Could not delete job' }
}

function describe(job: ProcessingJob, action: JobAction): string {
  const name = `job #${job.id} (${jobTypeMeta(job.type).label}${job.videoTitle ? ` · ${job.videoTitle}` : ''})`
  switch (action) {
    case 'retry':
      return `Put ${name} back in the queue? Progress and the last error are cleared; its logs are kept.`
    case 'cancel':
      return job.status === 'RUNNING'
        ? `Cancel ${name}? It's running now — the worker stops at its next checkpoint, so a little more work may finish first.`
        : `Cancel ${name}? It hasn't started yet, so nothing will run.`
    case 'delete':
      return `Delete ${name} and all of its logs? This cannot be undone.`
  }
}

export function useJobActions(onDone: (action: JobAction, job: ProcessingJob, result: ProcessingJob | null) => void | Promise<void>) {
  const { retry, cancel, remove } = useProcessingJobs()
  const toast = useToast()

  const pending = ref<{ job: ProcessingJob; action: JobAction } | null>(null)
  const busy = ref(false)

  function request(job: ProcessingJob, action: JobAction) {
    pending.value = { job, action }
  }

  const dialog = computed(() => {
    const p = pending.value
    if (!p) return { open: false, title: '', description: '', confirmLabel: '', color: 'primary' as const }
    const copy = COPY[p.action]
    return { open: true, title: copy.title, description: describe(p.job, p.action), confirmLabel: copy.confirmLabel, color: copy.color }
  })

  function close(open: boolean) {
    if (!open && !busy.value) pending.value = null
  }

  async function confirm() {
    const p = pending.value
    if (!p) return
    busy.value = true
    try {
      const result = p.action === 'retry' ? await retry(p.job.id) : p.action === 'cancel' ? await cancel(p.job.id) : (await remove(p.job.id), null)
      toast.add({ title: COPY[p.action].success, color: 'success' })
      pending.value = null
      await onDone(p.action, p.job, result)
    } catch (err) {
      toast.add({ title: COPY[p.action].failure, description: apiErrorMessage(err), color: 'error' })
    } finally {
      busy.value = false
    }
  }

  return { pending, busy, dialog, request, close, confirm }
}
