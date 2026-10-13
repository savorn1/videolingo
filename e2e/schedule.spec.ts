import { expect, test } from '@playwright/test'
import { mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// Scheduling a disabled video to be enabled by itself (the mock's video 7 is disabled).

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('a disabled video can be scheduled, and the schedule cancelled', async ({ page }) => {
  await openReady(page, '/videos/7')
  const banner = page.getByTestId('disabled-banner')
  await expect(banner).toContainText('This video is disabled')
  await banner.getByRole('button', { name: 'Schedule…' }).click()

  const modal = page.getByTestId('schedule-modal')
  await modal.getByRole('button', { name: 'Tomorrow 9:00' }).click()
  await page.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(banner).toContainText('Scheduled: enabled')

  const sent = (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/schedule')
  expect(sent?.method).toBe('PUT')
  expect(new Date(sent!.body.publishAt).getHours()).toBe(9)

  await banner.getByRole('button', { name: 'Change schedule' }).click()
  await page.getByRole('button', { name: 'Cancel the schedule' }).click()
  await expect(banner).toContainText('This video is disabled')
})
