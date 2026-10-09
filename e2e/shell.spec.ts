import { expect, test } from '@playwright/test'
import { configureMock, mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

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
  await expect(page.getByText('Back online').first()).toBeVisible()
})

test('the first Tab offers Skip to content, which moves focus to the page', async ({ page }) => {
  await openReady(page, '/videos')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})

test('archiving a video can be undone from the toast', async ({ page }) => {
  await openReady(page, '/videos/7')
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Archive' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Back in the library').first()).toBeVisible()
  const paths = (await mockRequests()).filter((r) => r.method === 'POST').map((r) => r.path)
  expect(paths).toEqual(expect.arrayContaining(['/api/admin/videos/7/archive', '/api/admin/videos/7/unarchive']))
})

test('the search offers the pages opened lately, by name', async ({ page }) => {
  await openReady(page, '/videos/7')
  await expect(page.getByRole('heading', { name: 'Sample lesson' }).first()).toBeVisible()
  await openReady(page, '/collections')
  await page
    .getByRole('button', { name: /Search/ })
    .first()
    .click()
  const recent = page.getByRole('group', { name: 'Recent' })
  await expect(recent).toContainText('Sample lesson')
  await recent.getByText('Sample lesson').click()
  await expect(page).toHaveURL(/\/videos\/7$/)
})

test('a running job shows in the tab title, and its end is announced on any page', async ({ page }) => {
  const running = { jobId: 31, videoId: 7, title: 'Sample lesson', status: 'RUNNING' }
  await configureMock({ running: [running], jobs: [running] })
  await openReady(page, '/collections')
  await expect(page).toHaveTitle(/^\(1\) /)

  await configureMock({ running: [], jobs: [{ ...running, status: 'SUCCEEDED' }] })
  await expect(page.getByText(/finished/).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Sample lesson').first()).toBeVisible()
  await expect(page).not.toHaveTitle(/^\(\d+\) /, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Open' }).first().click()
  await expect(page).toHaveURL(/\/processing-jobs\/31$/)
})
