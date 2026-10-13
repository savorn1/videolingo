import { expect, test } from '@playwright/test'
import { openReady, resetMock, signInAsAdmin } from './helpers'

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
