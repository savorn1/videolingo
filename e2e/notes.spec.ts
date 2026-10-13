import { expect, test } from '@playwright/test'
import { mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// Review notes on a video: write one, resolve it (it folds away), bring it back, delete it with Undo available.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('a note can be tied to a moment, and its time plays the video from there', async ({ page }) => {
  await openReady(page, '/videos/7')
  const panel = page.getByTestId('video-notes')
  await panel.getByLabel('New note').fill('Sound drops here')
  await panel.getByRole('checkbox', { name: /^At / }).check()
  await panel.getByRole('button', { name: 'Add note' }).click()
  const time = panel.getByRole('button', { name: '0:00.00' })
  await expect(time).toBeVisible()
  await time.click()
  const sent = (await mockRequests()).find((r) => r.method === 'POST' && r.path === '/api/admin/videos/7/notes')
  expect(sent?.body).toMatchObject({ body: 'Sound drops here', atMs: 0 })
})

test('a note can be written, resolved, shown again and deleted', async ({ page }) => {
  await openReady(page, '/videos/7')
  const panel = page.getByTestId('video-notes')
  await expect(panel).toContainText('No notes yet')

  await panel.getByLabel('New note').fill('The intro music is too loud')
  await panel.getByRole('button', { name: 'Add note' }).click()
  await expect(panel).toContainText('The intro music is too loud')
  await expect(panel).toContainText('1 open')

  await panel.getByRole('button', { name: 'Resolve note' }).click()
  await expect(panel).not.toContainText('The intro music is too loud')
  await panel.getByRole('button', { name: 'Show 1 resolved' }).click()
  await expect(panel).toContainText('resolved by admin')

  await panel.getByRole('button', { name: 'Delete note' }).click()
  await expect(panel).not.toContainText('The intro music is too loud')
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
})
