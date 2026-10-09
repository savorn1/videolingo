import { expect, test } from '@playwright/test'
import { mockRequests, openReady, resetMock, signInAsAdmin, wavFile } from './helpers'

// The editor (docs/editor-scenarios.md, Trim and Split) on a 10-second sample clip from the mock backend.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

async function openEditor(page: import('@playwright/test').Page) {
  await openReady(page, '/videos/7/editor')
  // The clip's length is known once the player has read it.
  await expect(page.getByText('of 0:10').first()).toBeVisible({ timeout: 20_000 })
}

test('Trim: moving the start queues a trim of that range', async ({ page }) => {
  await openEditor(page)
  const start = page.getByRole('slider').first()
  await start.focus()
  for (let i = 0; i < 20; i++) await start.press('ArrowRight') // 20 × 100 ms
  await expect(page.getByTestId('clip-length')).toHaveText(/0:08/)
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect.poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body).toMatchObject({ startMs: 2000 })
})

test('Trim: resize to 1080p keeps the shape, warns it is larger, and queues that size', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('switch', { name: 'Also resize the output' }).click()
  const resize = page.getByTestId('resize')
  await resize.getByRole('button', { name: /1080p/ }).click()
  await expect(resize).toContainText('From 320×180')
  await expect(resize).toContainText('bigger, not sharper')
  await expect(resize).not.toContainText('stretched')

  // With Keep shape on, typing the width works out the height
  await resize.getByLabel('Width').fill('1280')
  await expect(resize.getByLabel('Height')).toHaveValue('720')
  await resize.getByRole('button', { name: /720p/ }).click()
  await resize.getByRole('button', { name: /1080p/ }).click()
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body)
    .toMatchObject({ scale: { w: 1920, h: 1080 } })
})

test('Audio: music added in this visit plays along with the preview', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Audio/ }).click()
  await page.getByRole('heading', { name: 'Background music' }).click()
  const section = page.getByRole('group').filter({ has: page.getByRole('heading', { name: 'Background music' }) })
  await section.locator('input[type=file]').setInputFiles(wavFile('song.wav', 3))
  await expect(page.getByTestId('music-preview-note')).toContainText('Plays along with the preview')

  // It shows under the clips, and ←/→ move when it starts
  const lane = page.getByTestId('music-lane')
  await expect(lane).toHaveAttribute('aria-valuetext', /0:00/)
  await lane.focus()
  await lane.press('Shift+ArrowRight')
  await lane.press('Shift+ArrowRight')
  await expect(lane).toHaveAttribute('aria-valuenow', '2')

  // The fades are set from their handles on the strip too
  const fadeIn = page.getByTestId('fade-in-handle')
  await fadeIn.focus()
  await fadeIn.press('Shift+ArrowRight')
  await expect(fadeIn).toHaveAttribute('aria-valuetext', '1.0 s')
  await expect(page.getByTestId('fade-in')).toBeVisible()
  const fadeOut = page.getByTestId('fade-out-handle')
  await fadeOut.focus()
  await fadeOut.press('ArrowLeft')
  await expect(fadeOut).toHaveAttribute('aria-valuetext', '0.1 s')
})

test('Split: three even parts queue a split into three segments', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '3 parts' }).click()
  await page.getByRole('button', { name: /Start split/ }).click()

  await expect.poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/split')?.body?.segments?.length).toBe(3)
})

test('Split: dragging the cut between two segments moves it', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '3 parts' }).click()
  const end = page.getByLabel('Segment 1 end')
  const before = await end.inputValue()

  // The strip spans the whole clip, so 20 % of its width is 0:02.
  const strip = page.getByRole('button', { name: 'Segment 1', exact: true }).locator('..')
  const box = (await strip.boundingBox())!
  const handle = (await page.getByRole('button', { name: 'Move the cut between segments 1 and 2' }).boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.2, handle.y + handle.height / 2, { steps: 5 })
  await page.mouse.up()

  await expect(end).not.toHaveValue(before)
  await expect(end).toHaveValue(/^0:02/)
})

test('Results come into view once a trim is queued', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 })
  await openEditor(page)
  const start = page.getByRole('slider').first()
  await start.focus()
  await start.press('ArrowRight')
  const results = page.getByRole('heading', { name: /Results/ })
  await expect(results).not.toBeInViewport()
  await page.getByRole('button', { name: 'Start trim' }).click()
  await expect(results).toBeInViewport()
})
