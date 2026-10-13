import { expect, test } from '@playwright/test'
import { configureMock, mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// "Make again" for a video made from audio: offered in the video's menu, asked to confirm, then queued.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('a video made from audio can be made again', async ({ page }) => {
  await openReady(page, '/videos/7')
  await page.getByRole('button', { name: 'More actions' }).click()
  const item = page.getByRole('menuitem', { name: /Make again/ })
  await expect(item).toContainText('Possible until')
  await item.click()
  await page.getByRole('button', { name: 'Make again', exact: true }).click()
  await expect(page.getByText('Making the video again').first()).toBeVisible()
  const posted = (await mockRequests()).find((r) => r.method === 'POST' && r.path === '/api/admin/videos/7/remake')
  expect(posted).toBeTruthy()
})

test('when the recording is gone it says why, and cannot be chosen', async ({ page }) => {
  await configureMock({
    remake: { available: false, reason: 'The recording or pictures it was made from are no longer kept (uploads are kept 72 hours)', keptUntil: null }
  })
  await openReady(page, '/videos/7')
  await page.getByRole('button', { name: 'More actions' }).click()
  const item = page.getByRole('menuitem', { name: /Make again/ })
  await expect(item).toContainText('no longer kept')
  await expect(item).toHaveAttribute('data-disabled', '')
})

test('a video not made from audio has no Make again', async ({ page }) => {
  await configureMock({ remake: { available: false, reason: 'Only a video made from audio can be made again', keptUntil: null } })
  await openReady(page, '/videos/7')
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Make again/ })).toHaveCount(0)
})
