import { expect, test } from '@playwright/test'
import { openReady, resetMock, signInAsAdmin } from './helpers'

// The app around every page: go-to shortcuts, the shortcut list, the offline notice and the skip link.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('g then a letter goes to that page, and ? lists the shortcuts', async ({ page }) => {
  await openReady(page, '/collections')
  await page.locator('#main-content').focus()
  await page.keyboard.press('g')
  await page.keyboard.press('v')
  await expect(page).toHaveURL(/\/videos$/)

  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toContainText('Go to Videos')
  await expect(dialog).toContainText('Go to Profile')
})

test('typing in a box does not trigger the shortcuts', async ({ page }) => {
  await openReady(page, '/videos')
  const box = page.getByRole('textbox').first()
  await box.click()
  await page.keyboard.type('gv')
  await expect(box).toHaveValue(/gv/)
  // Still on Videos (the search box is copied into the address), not taken anywhere by g v
  await expect(page).toHaveURL(/\/videos(\?|$)/)
})

test('going offline shows a notice, and coming back says so', async ({ page, context }) => {
  await openReady(page, '/videos')
  await context.setOffline(true)
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByTestId('offline-banner')).toHaveCount(0)
  await expect(page.getByText('Back online')).toBeVisible()
})

test('the first Tab offers Skip to content, which moves focus to the page', async ({ page }) => {
  await openReady(page, '/videos')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})
