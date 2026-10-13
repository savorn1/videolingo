import { expect, test } from '@playwright/test'
import { configureMock, mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// Scheduling several disabled videos at once from the Videos list, a day apart.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('selected videos are scheduled one after another', async ({ page }) => {
  await configureMock({ videoList: true })
  await openReady(page, '/videos')
  await page.getByRole('checkbox', { name: 'Select this page' }).click({ force: true })
  await page.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(page.getByTestId('schedule-plan').locator('li')).toHaveCount(2)
  await page.getByRole('dialog').getByRole('button', { name: 'Schedule videos' }).click()
  await expect(page.getByText('Schedule videos: 2 done').first()).toBeVisible()

  const sent = (await mockRequests()).filter((r) => r.path.endsWith('/schedule'))
  expect(sent.map((r) => r.path)).toEqual(['/api/admin/videos/7/schedule', '/api/admin/videos/8/schedule'])
  const [a, b] = sent.map((r) => new Date(r.body.publishAt).getTime())
  expect(b! - a!).toBe(24 * 60 * 60 * 1000)
})
