import { expect, test } from '@playwright/test'
import { configureMock, mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// Edits queued on selected videos from the Videos list: a saved recipe (one edit per part), and removing the pauses.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
  // A recipe saved earlier in the editor: a 9:16 crop at 1080×1920, louder, and one text layer.
  await context.addInitScript(() => {
    const recipe = {
      frame: { aspect: 9 / 16, w: 1080, h: 1920 },
      audio: { volume: 1.5 },
      layers: [{ id: 'l1', kind: 'TEXT', text: 'Lesson', startMs: 0, endMs: 3000 }]
    }
    localStorage.setItem('videolingo:edit-recipes', JSON.stringify([{ id: 'r1', name: 'Shorts', savedAt: 1, data: recipe }]))
  })
})

test('a recipe queues a picture, a sound and a layers edit on each selected video', async ({ page }) => {
  await configureMock({ videoList: true })
  await openReady(page, '/videos')
  await page.getByRole('checkbox', { name: 'Select row' }).first().click({ force: true })
  await page.getByRole('button', { name: 'Apply a recipe' }).click()
  await page.getByRole('combobox').filter({ hasText: 'Choose a recipe' }).click()
  await page.getByRole('option', { name: 'Shorts' }).click()
  await expect(page.getByRole('dialog')).toContainText('Crop 9:16')
  await page.getByRole('dialog').getByRole('button', { name: 'Apply a recipe' }).click()
  await expect(page.getByText('Apply a recipe: 1 done').first()).toBeVisible()

  const sent = await mockRequests()
  const trim = sent.find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body
  expect(trim).toMatchObject({ startMs: 0, endMs: null, scale: { w: 1080, h: 1920 } })
  expect(sent.find((r) => r.path === '/api/admin/videos/7/edits/audio')?.body).toMatchObject({ volume: 1.5, clips: [], music: null })
  expect(sent.find((r) => r.path === '/api/admin/videos/7/edits/overlay')?.body).toMatchObject({ layers: [{ kind: 'TEXT', text: 'Lesson' }] })
})

test('Remove the pauses queues a cut of the long pauses on each selected video', async ({ page }) => {
  await configureMock({ videoList: true })
  await openReady(page, '/videos')
  await page.getByRole('checkbox', { name: 'Select row' }).first().click({ force: true })
  await page.getByRole('button', { name: 'Remove the pauses' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove the pauses' }).click()
  await expect(page.getByText('Remove the pauses: 1 done').first()).toBeVisible()

  const sent = await mockRequests()
  expect(sent.find((r) => r.path === '/api/admin/videos/7/edits/cut')?.body).toMatchObject({ cuts: [{ startMs: 2200, endMs: 3800 }] })
})
