import { expect, test } from '@playwright/test'
import { mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// Chapters on the learner's watch page: listed under the player, the playing one marked, and a click jumps there.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('the chapters are listed and jump the video there', async ({ page }) => {
  await openReady(page, '/learn/watch/7')
  const card = page.getByTestId('chapters')
  await expect(card).toContainText('Greetings')
  await expect(card).toContainText('Practice')
  await expect(card.getByRole('button', { name: /Greetings/ })).toHaveAttribute('aria-current', 'step')
  await card.getByRole('button', { name: /Practice/ }).click()
  await expect(card.getByRole('button', { name: /Practice/ })).toHaveAttribute('aria-current', 'step')
  await expect
    .poll(() =>
      page
        .locator('video')
        .first()
        .evaluate((v: HTMLVideoElement) => Math.round(v.currentTime))
    )
    .toBe(5)
})

test('the AI chapters of a video become chapter markers in one click', async ({ page }) => {
  await openReady(page, '/videos/7?tab=timeline')
  await page.getByRole('button', { name: 'Add AI chapters as markers' }).click()
  await expect(page.getByText('2 chapter markers added').first()).toBeVisible()
  const added = (await mockRequests()).filter((r) => r.method === 'POST' && r.path === '/api/admin/videos/7/markers').map((r) => r.body)
  expect(added).toEqual([
    { atMs: 0, label: 'Greetings', chapter: true },
    { atMs: 5000, label: 'Practice', chapter: true }
  ])
  // Again: nothing new to add.
  await page.getByRole('button', { name: 'Add AI chapters as markers' }).click()
  await expect(page.getByText('Every AI chapter is already a chapter marker').first()).toBeVisible()
})
