import { expect, test } from '@playwright/test'
import { configureMock, mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// The storage report and removing old versions; and the failed jobs grouped by why, with a retry.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('Storage: totals by kind, the biggest videos, and removing old versions', async ({ page }) => {
  await openReady(page, '/videos/storage')
  await expect(page.getByTestId('storage-totals')).toContainText('All files')
  const biggest = page.getByTestId('storage-biggest').getByRole('listitem')
  await expect(biggest).toHaveCount(2)
  await expect(biggest.first()).toContainText('Sample lesson')
  await expect(biggest.first()).toContainText('2 versions')

  await page.getByTestId('storage-cleanup').getByRole('button', { name: 'Remove old versions' }).click()
  await page.getByRole('button', { name: 'Remove them' }).click()
  await expect(page.getByText('2 old versions removed').first()).toBeVisible()
  expect((await mockRequests()).find((r) => r.path === '/api/admin/videos/storage/prune-versions')?.body).toEqual({ keepLatest: 1, olderThanDays: 30 })
})

test('Failed jobs are grouped by reason, and one reason is retried at once', async ({ page }) => {
  await configureMock({
    jobs: [
      { jobId: 31, videoId: 7, title: 'Sample lesson', status: 'FAILED', error: 'Speech-to-text is not reachable' },
      { jobId: 32, videoId: 8, title: 'Teacher camera', status: 'FAILED', error: 'Speech-to-text is not reachable' },
      { jobId: 33, videoId: 8, title: 'Teacher camera', status: 'FAILED', error: 'Video #8 has no sound' }
    ]
  })
  await openReady(page, '/processing-jobs')
  await page
    .getByRole('button', { name: /Failed/ })
    .first()
    .click()
  const reasons = page.getByTestId('failed-reason')
  await expect(reasons).toHaveCount(2)
  await expect(reasons.first()).toContainText('2')
  await expect(reasons.first()).toContainText('Speech-to-text is not reachable')
  await reasons.first().getByRole('button', { name: 'Retry these (2)' }).click()
  await expect(page.getByText('2 jobs queued again').first()).toBeVisible()
  const retried = (await mockRequests()).filter((r) => r.path.endsWith('/retry')).map((r) => r.path)
  expect(retried).toEqual(['/api/admin/processing-jobs/31/retry', '/api/admin/processing-jobs/32/retry'])
})
