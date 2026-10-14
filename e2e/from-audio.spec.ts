import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { configureMock, mockRequests, openReady, resetMock, signInAsAdmin, wavFile } from './helpers'

// Scenarios V1, V4, V5 and the waveform list in docs/editor-scenarios.md ("Video from audio").

test.beforeEach(async ({ context }) => {
  await resetMock()
  await signInAsAdmin(context)
})

test('V4: says what is missing before anything is added', async ({ page }) => {
  await openReady(page, '/videos/from-audio')
  const bar = page.getByTestId('action-bar')
  await expect(bar).toContainText('Add an audio file to begin')
  await expect(bar.getByRole('button', { name: 'Make the video' })).toBeDisabled()
})

test('V4: a missing title is marked, and Show me puts the cursor in it', async ({ page }) => {
  await openReady(page, '/videos/from-audio')
  await page.getByLabel('Choose audio files').setInputFiles(wavFile('lesson-one.wav'))
  await expect(page.getByText('Uploaded')).toBeVisible()
  const title = page.getByLabel('Title for lesson-one.wav')
  await title.fill('')
  const bar = page.getByTestId('action-bar')
  await expect(bar).toContainText('Give the video a title')
  await expect(title).toHaveAttribute('aria-invalid', 'true')
  await bar.getByRole('button', { name: 'Show me' }).click()
  await expect(title).toBeFocused()
})

test('The steps beside the preview sum up the choices, and a dropped picture joins the slideshow', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await openReady(page, '/videos/from-audio')
  const nav = page.getByTestId('step-nav')
  await expect(nav).toContainText('No files yet')
  await page.getByLabel('Choose audio files').setInputFiles(wavFile('lesson-one.wav'))
  await expect(page.getByText('Uploaded')).toBeVisible()
  await expect(nav).toContainText('1 file')

  // A 1×1 PNG dropped anywhere on the page goes to the pictures, not the audio
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  const drop = await page.evaluateHandle((b64) => {
    const dt = new DataTransfer()
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'cover.png', { type: 'image/png' }))
    return dt
  }, png)
  await page.locator('form').dispatchEvent('drop', { dataTransfer: drop })
  await expect(page.getByRole('button', { name: 'Remove cover.png' })).toBeVisible()
  await expect(nav).toContainText('1 picture')

  await nav.getByRole('button', { name: /Details/ }).click()
  await expect(page.locator('#step-4')).toBeInViewport()
})

test('V1 + V5: uploads a recording, then makes the video with its title and look', async ({ page }) => {
  await openReady(page, '/videos/from-audio')
  await page.getByLabel('Choose audio files').setInputFiles(wavFile('lesson-one.wav'))
  await expect(page.getByText('Uploaded')).toBeVisible()
  await page.getByLabel('Title for lesson-one.wav').fill('Lesson one')
  await page.getByRole('button', { name: 'Make the video' }).click()

  await expect(page).toHaveURL(/\/videos\/42$/)
  const made = (await mockRequests()).find((r) => r.path === '/api/admin/videos/from-audio')
  expect(made?.body).toMatchObject({ audioKey: 'uploads/e2e-1', title: 'Lesson one', waveform: 'NONE', resolution: '720p' })
})

test('V1: several files can be reordered, and are made in that order', async ({ page }) => {
  await openReady(page, '/videos/from-audio')
  await page.getByLabel('Choose audio files').setInputFiles([wavFile('a.wav'), wavFile('b.wav')])
  await expect(page.getByText('Uploaded')).toHaveCount(2)
  await page.getByRole('button', { name: 'Move b.wav up' }).click()
  await page.getByRole('button', { name: 'Make 2 videos' }).click()

  await expect(page).toHaveURL(/\/videos\/made\?jobs=7(,|%2C)8$/)
  const titles = (await mockRequests()).filter((r) => r.path === '/api/admin/videos/from-audio').map((r) => r.body.title)
  expect(titles).toEqual(['B', 'A']) // titles come from the file names

  // The batch page follows both: one ready, one failed — and Retry brings it back.
  const jobs = page.getByTestId('batch-jobs')
  await expect(page.getByText('1 of 2 ready · 1 failed')).toBeVisible()
  await expect(jobs).toContainText('ffmpeg could not read the audio')
  await jobs.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText('All 2 ready')).toBeVisible()
})

test('V18: an older server that cannot draw Stereo is not offered it', async ({ page }) => {
  await resetMock({ waveforms: ['NONE', 'WAVES', 'BARS', 'COLUMNS'] })
  await openReady(page, '/videos/from-audio')
  const templates = page.getByRole('group', { name: 'Waveform templates' })
  await expect(templates.getByRole('button', { name: /Equaliser/ })).toBeVisible()
  await expect(templates.getByRole('button', { name: /Duet/ })).toHaveCount(0)
  await expect(templates.getByRole('button', { name: /Neon/ })).toBeVisible()
  await expect(templates.getByRole('button', { name: /Hairline/ })).toHaveCount(0)
})

test('Saved looks: a whole look is saved under a name and put back', async ({ page }) => {
  await openReady(page, '/videos/from-audio')
  await page.getByRole('radio', { name: /Tall/ }).click()
  await page.getByLabel('Strip text').fill('Weekly show')
  await page.getByRole('button', { name: /Saved looks/ }).click()
  await page.getByLabel('Name for this look').fill('Weekly')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.keyboard.press('Escape')

  await page.getByRole('radio', { name: /Wide/ }).click()
  await page.getByLabel('Strip text').fill('')
  await page.getByRole('button', { name: /Saved looks \(1\)/ }).click()
  await page
    .getByTestId('saved-looks')
    .getByRole('button', { name: /^Weekly/ })
    .click()

  await expect(page.getByRole('radio', { name: /Tall/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Strip text')).toHaveValue('Weekly show')
})

test('Large files go in parts; after a failure, Try again carries on from the parts already sent', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  // 70 MB of WAV (5 parts of 16 MiB): over the 64 MB line, and too big to hand Playwright as a buffer.
  const big = testInfo.outputPath('big.wav')
  const header = wavFile('x.wav', 1).buffer.subarray(0, 44)
  writeFileSync(big, Buffer.concat([header, Buffer.alloc(70 * 1024 * 1024)]))
  await configureMock({ failParts: [4] })

  await openReady(page, '/videos/from-audio')
  await page.getByLabel('Choose audio files').setInputFiles(big)
  await expect(page.getByText(/The upload stopped at \d+%/)).toBeVisible({ timeout: 60_000 })
  const firstTry = (await mockRequests()).filter((r) => r.path.startsWith('/api/__storage/part/')).map((r) => Number(r.path.split('/').pop()))
  expect(firstTry.filter((n) => n === 4)).toHaveLength(3) // part 4 was tried three times

  await configureMock({ failParts: [] })
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Uploaded')).toBeVisible({ timeout: 60_000 })

  const all = await mockRequests()
  const parts = all.filter((r) => r.path.startsWith('/api/__storage/part/')).map((r) => Number(r.path.split('/').pop()))
  const retried = parts.slice(firstTry.length)
  expect(retried).toContain(4)
  expect(retried).not.toContain(1) // already stored: not sent again
  expect(all.filter((r) => r.path === '/api/admin/videos/uploads/multipart')).toHaveLength(1) // the same upload, carried on
  expect(all.some((r) => r.path === '/api/admin/videos/uploads/multipart/complete')).toBe(true)
})

/** An MP3 whose ID3 tag has a title and two chapters (as podcast tools write them), then a few bytes of "sound". */
function mp3WithChapters(name: string) {
  const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
  const syncsafe = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]
  const frame = (id: string, data: Buffer) => Buffer.concat([Buffer.from(id), Buffer.from(be32(data.length)), Buffer.from([0, 0]), data])
  const text = (s: string) => Buffer.concat([Buffer.from([3]), Buffer.from(s)])
  const chap = (id: string, start: number, title: string) =>
    frame(
      'CHAP',
      Buffer.concat([
        Buffer.from(id + '\0'),
        Buffer.from([...be32(start), ...be32(start + 1000), ...be32(0xffffffff), ...be32(0xffffffff)]),
        frame('TIT2', text(title))
      ])
    )
  const body = Buffer.concat([frame('TIT2', text('Episode 7')), chap('c1', 0, 'Welcome'), chap('c2', 60_000, 'New words')])
  const tag = Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0]), Buffer.from(syncsafe(body.length)), body])
  return { name, mimeType: 'audio/mpeg', buffer: Buffer.concat([tag, Buffer.alloc(64)]) }
}

test('Chapters from the file, a progress bar, an intro card, music, a highlight clip and a schedule are sent', async ({ page }) => {
  await openReady(page, '/videos/from-audio')
  await page.getByLabel('Choose audio files').setInputFiles(mp3WithChapters('episode-7.mp3'))
  await expect(page.getByText('Uploaded')).toBeVisible()
  await expect(page.getByLabel('Title for episode-7.mp3')).toHaveValue('Episode 7')

  const onPicture = page.getByTestId('on-picture')
  await expect(onPicture.getByRole('switch', { name: 'Use the chapters in the files (2)' })).toBeChecked()
  await onPicture.getByRole('switch', { name: 'Progress bar' }).click()
  await onPicture.getByLabel('Intro card text').fill('Episode 7 — New words')
  await expect(page.getByTestId('preview-progress')).toBeVisible()

  await page.getByTestId('music').locator('input[type=file]').setInputFiles(wavFile('bed.wav', 1))
  await expect(page.getByTestId('music')).toContainText('bed.wav')

  await page.getByRole('switch', { name: 'Also make a highlight clip' }).click()
  await page.getByRole('radio', { name: 'About 30 s' }).click()
  await page.getByRole('switch', { name: 'Publish them on a schedule' }).click()
  await page.getByRole('button', { name: 'Make the video' }).click()

  await expect.poll(async () => (await mockRequests()).filter((r) => r.path === '/api/admin/videos/from-audio').length).toBe(2)
  const sent = await mockRequests()
  const [main, clip] = sent.filter((r) => r.path === '/api/admin/videos/from-audio').map((r) => r.body)
  expect(main).toMatchObject({
    title: 'Episode 7',
    progressBar: true,
    chapters: [
      { startMs: 0, title: 'Welcome' },
      { startMs: 60_000, title: 'New words' }
    ],
    intro: { text: 'Episode 7 — New words', durationMs: 3000 },
    music: { key: expect.stringMatching(/^uploads\//), volume: 0.15, loop: true, duck: true }
  })
  expect(main.outro).toBeUndefined()
  expect(sent.find((r) => r.path === '/api/admin/videos/from-audio/highlight')?.body).toEqual({ audioKey: main.audioKey, seconds: 30 })
  expect(clip).toMatchObject({ title: 'Episode 7 (highlight)', shape: 'TALL', audioStartMs: 30_000, audioEndMs: 74_500, progressBar: true })
  expect(clip.chapters).toBeUndefined()
  expect(clip.intro).toBeUndefined()
  // Only the main video is scheduled.
  const scheduled = sent.filter((r) => /\/schedule$/.test(r.path))
  expect(scheduled.map((r) => r.path)).toEqual(['/api/admin/videos/42/schedule'])
  expect(scheduled[0]!.body.publishAt).toBeTruthy()
})
