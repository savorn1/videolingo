import { expect, test } from '@playwright/test'
import { openReady, resetMock, signInAsAdmin } from './helpers'

// The player's sound mix while a voice-over plays (the mock's video 7 has one Khmer voice-over).

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('a voice-over can keep some of the original sound underneath, remembered next time', async ({ page }) => {
  await openReady(page, '/videos/7')
  const video = page.locator('video').first()
  const original = () => video.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, volume: v.volume }))

  await page.getByRole('combobox').filter({ hasText: 'Original' }).click()
  await page.getByRole('option', { name: /Khmer voice-over/ }).click()
  // The voice-over alone at first: the original is off
  await expect.poll(original).toEqual({ muted: true, volume: 0 })

  await page.getByTestId('dub-mix-button').click()
  const mix = page.getByTestId('dub-mix')
  await mix.getByRole('button', { name: 'Original underneath' }).click()
  await expect.poll(original).toEqual({ muted: false, volume: 0.2 })
  await expect(mix).toContainText('20%')

  // Back to the original sound only: it plays at full again
  await page.keyboard.press('Escape')
  await page.getByRole('combobox').filter({ hasText: 'voice-over' }).click()
  await page.getByRole('option', { name: /^Original/ }).click()
  await expect.poll(original).toEqual({ muted: false, volume: 1 })

  // The mix is kept in this browser
  await page.reload()
  await page.getByRole('combobox').filter({ hasText: 'Original' }).click()
  await page.getByRole('option', { name: /Khmer voice-over/ }).click()
  await expect.poll(original).toEqual({ muted: false, volume: 0.2 })
})
