import { expect, test } from '@playwright/test'
import { mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// The Edit results page: every video's waiting results, several added as new videos at once.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('results of several videos are listed and can become new videos together', async ({ page }) => {
  await openReady(page, '/videos/edit-results')
  const list = page.getByTestId('edit-results')
  await expect(list).toContainText('Trim · 0:00 – 0:05')
  await expect(list).toContainText('Segment 2')
  await expect(list).toContainText('Old lesson')
  // A sound file can only be downloaded, so "Select all" leaves it out.
  await page.getByRole('checkbox', { name: 'Select all' }).click()
  await expect(page.getByText('2 selected')).toBeVisible()
  await page.getByRole('button', { name: 'Add as new videos' }).click()
  await expect(page.getByText('2 new videos made').first()).toBeVisible()

  const promoted = (await mockRequests()).filter((r) => r.path.endsWith('/promote'))
  expect(promoted.map((r) => r.path)).toEqual(['/api/admin/videos/7/edits/301/promote', '/api/admin/videos/8/edits/303/promote'])
  expect(promoted[1]!.body).toMatchObject({ asNew: true, title: 'Old lesson — Part 2' })
})
