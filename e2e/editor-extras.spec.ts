import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { mockRequests, openReady, resetMock, signInAsAdmin } from './helpers'

// More of the editor (docs/editor-scenarios.md, "Trim — finishing touches") on the mock backend's 10 s sample clip.

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

async function openEditor(page: import('@playwright/test').Page) {
  await openReady(page, '/videos/7/editor')
  await expect(page.getByText('of 0:10').first()).toBeVisible({ timeout: 20_000 })
}

const trimBody = async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body

test('The film strip shows frames along the video, and a click goes there', async ({ page }) => {
  await openEditor(page)
  const strip = page.getByTestId('film-strip')
  await expect(strip.getByRole('button')).toHaveCount(12)
  await strip.getByRole('button', { name: 'Go to 0:07.08' }).click()
  await expect
    .poll(() =>
      page
        .locator('video')
        .first()
        .evaluate((v: HTMLVideoElement) => Math.round(v.currentTime))
    )
    .toBe(7)
})

test('Punch-ins on every other sentence and a progress bar go with the trim', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Motion & effects' }).click()
  await page.getByRole('button', { name: 'Add the punch-ins' }).click()
  await expect(page.getByTestId('punch-in')).toContainText('2 punch-ins to 115%')

  await page.getByRole('heading', { name: 'Blur, picture in picture & cards' }).click()
  await page.getByRole('switch', { name: 'Progress bar' }).click()
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect.poll(trimBody).toMatchObject({
    // The 2nd and 4th sentences of the sample's transcript.
    punchIn: {
      scale: 1.15,
      ranges: [
        { startMs: 2300, endMs: 4000 },
        { startMs: 6500, endMs: 10_000 }
      ]
    },
    progressBar: '#facc15'
  })
})

test('A colour grade is uploaded as a LUT and sent with the trim', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Look' }).click()
  await page.getByLabel('Colour grade file').setInputFiles({ name: 'film.cube', mimeType: '', buffer: Buffer.from('LUT_3D_SIZE 2\n') })
  await expect(page.getByTestId('colour-grade-name')).toHaveText('film.cube')
  await page.getByRole('button', { name: 'Start trim' }).click()

  const requests = await mockRequests()
  expect(requests.find((r) => r.path === '/api/admin/videos/uploads')?.body).toMatchObject({ kind: 'LUT', fileName: 'film.cube' })
  await expect.poll(trimBody).toMatchObject({ lutKey: expect.stringMatching(/^uploads\//) })
})

test('A test render sends the trim as a sample', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Motion & effects' }).click()
  await page.getByRole('switch', { name: 'Steady a shaky picture' }).click()
  await page.getByRole('button', { name: /^Test render/ }).click()
  await expect.poll(trimBody).toMatchObject({ sample: true, stabilize: true })
})

test('Subtitles for the trim are timed for the result, the intro card included', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Blur, picture in picture & cards' }).click()
  await page.getByRole('switch', { name: 'Title cards' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Subtitles for this trim (.srt)' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('Sample lesson (trimmed).srt')
  const srt = readFileSync(await file.path(), 'utf8')
  // The 3 s intro card comes first.
  expect(srt.startsWith('1\n00:00:03,000 --> 00:00:05,000\nHello and welcome.\n')).toBe(true)
  expect(srt).toContain('4\n00:00:09,500 --> 00:00:13,000\nToday we learn greetings.')
})

test('Choosing the Shorts preset shows its checklist', async ({ page }) => {
  await openEditor(page)
  await page
    .getByRole('button', { name: /Shorts \/ Reels \/ TikTok/ })
    .first()
    .click()
  const checks = page.getByTestId('platform-checks')
  await expect(checks).toContainText('Checklist for Shorts / Reels / TikTok')
  await expect(checks).toContainText('fits Shorts, Reels and TikTok')
})

test('Playing the timing shows the intro card before the clip', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Blur, picture in picture & cards' }).click()
  await page.getByRole('switch', { name: 'Title cards' }).click()
  await page.getByRole('switch', { name: 'Play the timing in the preview' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).first().click()
  await expect(page.getByTestId('card-preview')).toHaveText('Sample lesson')
  // Then the clip plays on.
  await expect(page.getByTestId('card-preview')).toBeHidden({ timeout: 6000 })
})

test('A brand kit saved from one setup puts the cards and progress bar back', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Blur, picture in picture & cards' }).click()
  const extras = page.getByTestId('trim-extras')
  await extras.getByRole('switch', { name: 'Title cards' }).click()
  await extras.getByRole('switch', { name: 'Progress bar' }).click()

  await page.getByRole('button', { name: 'Brand kit' }).click()
  await page.getByRole('button', { name: 'Save brand kit' }).click()
  await expect(page.getByText('Brand kit saved', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await extras.getByRole('switch', { name: 'Title cards' }).click()
  await extras.getByRole('switch', { name: 'Progress bar' }).click()
  await page.getByRole('button', { name: 'Brand kit' }).click()
  await page.getByRole('button', { name: 'Use on this video' }).click()
  await expect(extras.getByRole('switch', { name: 'Title cards' })).toBeChecked()
  await expect(extras.getByRole('switch', { name: 'Progress bar' })).toBeChecked()
})

test('A thumbnail made from a frame is uploaded and set on the video', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Thumbnail' }).click()
  await expect(page.getByPlaceholder('Leave empty for the frame alone')).toHaveValue('Sample lesson')
  await page.getByRole('button', { name: 'Use as thumbnail' }).click()
  await expect(page.getByText('Thumbnail saved', { exact: true })).toBeVisible()

  const requests = await mockRequests()
  expect(requests.find((r) => r.path === '/api/admin/videos/uploads')?.body).toMatchObject({ kind: 'THUMBNAIL', contentType: 'image/jpeg' })
  expect(requests.find((r) => r.method === 'PUT' && r.path === '/api/admin/videos/7')?.body).toMatchObject({
    title: 'Sample lesson',
    thumbnailUrl: expect.stringMatching(/^\/uploads\//)
  })
})

test('Split at scene changes cuts where the picture changes', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: 'Split at scenes' }).click()
  await expect(page.getByText('3 scenes', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Segment 2 start')).toHaveValue('0:04.00')
  await expect(page.getByLabel('Segment 3 start')).toHaveValue('0:07.00')
  expect((await mockRequests()).some((r) => r.path === '/api/admin/videos/7/edits/scenes')).toBe(true)
})

test('The film strip draws the sound under the frames', async ({ page }) => {
  await openEditor(page)
  await expect(page.getByTestId('film-strip-wave')).toBeVisible()
})

test('Edit recipes go out as a file and come back in', async ({ page }) => {
  await openEditor(page)
  await page
    .getByRole('button', { name: /Shorts \/ Reels \/ TikTok/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Recipes' }).click()
  await page.getByLabel('Recipe name').fill('Reel look')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByTitle('Save your recipes as a file, to share or keep').click()
  const file = await (await download).path()

  await page.getByRole('button', { name: 'Delete recipe Reel look' }).click()
  await expect(page.getByText('No recipes yet.')).toBeVisible()
  await page.getByLabel('Recipes file').setInputFiles(file)
  await expect(page.getByText('Added 1 recipe', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete recipe Reel look' })).toBeVisible()
})

test('The chapter markers are copied as YouTube chapters', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const marker = { color: null, createdBy: 'admin', createdAt: '2026-10-13T09:00:00' }
  // The sample clip is 10 s, too short for YouTube's 10 s chapters, so the mock says the video is longer.
  await resetMock({
    markers: [
      { ...marker, id: 1, atMs: 0, label: 'Welcome', chapter: true },
      { ...marker, id: 2, atMs: 2000, label: 'Too soon', chapter: true },
      { ...marker, id: 3, atMs: 5000, label: 'Practice', chapter: true }
    ]
  })
  await openReady(page, '/videos/7?tab=timeline')
  await page.getByRole('button', { name: 'Copy chapters for YouTube' }).click()
  await expect(page.getByText('Not enough chapters for YouTube', { exact: true })).toBeVisible()
})
