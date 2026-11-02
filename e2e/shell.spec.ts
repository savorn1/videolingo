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

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the header, the page and its menus are at least 44 px to tap', async ({ page }) => {
    const small = () =>
      page.evaluate(() =>
        [...document.querySelectorAll(':is(button, a[href], summary, select):not([role=switch], [role=checkbox], [role=radio], .sr-only)')]
          .filter((el) => getComputedStyle(el).display !== 'inline')
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width && Math.min(r.width, r.height) < 44)
          .map(({ el }) => el.getAttribute('aria-label') || (el as HTMLElement).innerText.trim())
      )
    await openReady(page, '/videos')
    expect(await small()).toEqual([])
    await page.getByRole('button', { name: /Account/ }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished))) // the menu scales in
    expect(await small()).toEqual([])
  })
})

// main.css darkens Nuxt UI's colours in light mode and lightens them in dark (HIG Accessibility: 4.5:1 for text,
// in both appearances). This works the real colours out in the browser, color-mix() and all.
test('theme colours: coloured, muted and placeholder text reach 4.5:1 in light and dark', async ({ page }) => {
  await openReady(page, '/videos')
  for (const scheme of ['light', 'dark']) {
    const low = await page.evaluate((s) => {
      document.documentElement.classList.toggle('dark', s === 'dark')
      document.documentElement.classList.toggle('light', s === 'light')
      const cv = document.createElement('canvas')
      cv.width = cv.height = 1
      const ctx = cv.getContext('2d', { willReadFrequently: true })!
      const rgb = (c: string) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const lum = (c: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!)
      }
      const ratio = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
        return (x! + 0.05) / (y! + 0.05)
      }
      const root = getComputedStyle(document.documentElement)
      const v = (name: string) => rgb(root.getPropertyValue(name).trim())
      const bg = v('--ui-bg')
      const tint = (c: number[]) => c.map((x, i) => x * 0.1 + bg[i]! * 0.9)
      const out: string[] = []
      for (const n of ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'cancelled']) {
        const c = v(`--ui-${n}`)
        for (const [where, r] of [
          ['page', ratio(c, bg)],
          ['its tint', ratio(c, tint(c))]
        ] as const)
          if (r < 4.5) out.push(`${s} ${n} on ${where}: ${r.toFixed(2)}`)
      }
      for (const [n, on] of [
        ['--ui-text-muted', '--ui-bg'],
        ['--ui-text-muted', '--ui-bg-elevated'],
        ['--ui-text-dimmed', '--ui-bg']
      ]) {
        const r = ratio(v(n!), v(on!))
        if (r < 4.5) out.push(`${s} ${n} on ${on}: ${r.toFixed(2)}`)
      }
      return out
    }, scheme)
    expect(low).toEqual([])
  }
})
