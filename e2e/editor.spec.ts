import { expect, test } from '@playwright/test'
import { configureMock, mockRequests, openReady, resetMock, signInAsAdmin, wavFile } from './helpers'

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
  await expect(resize).toContainText('6× larger than the picture')
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
  await section.locator('input[type=file]').first().setInputFiles(wavFile('song.wav', 3))
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

test('Audio: an extra sound track and slow motion with the sound at normal speed are sent with the render', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Audio/ }).click()
  await page.getByRole('heading', { name: /Background music/ }).click()
  const tracks = page.getByTestId('sound-tracks')
  await tracks.locator('input[type=file]').setInputFiles(wavFile('door.wav', 1))
  await expect(tracks).toContainText('door.wav')
  await expect(page.getByTestId('track-lane')).toBeVisible()

  await page.getByRole('heading', { name: 'Speed & pitch' }).click()
  await page.getByLabel('Speed value').fill('0.5')
  await page.getByLabel('Speed value').press('Enter')
  await page.getByRole('switch', { name: 'Keep the sound at normal speed' }).click()
  await page.getByRole('button', { name: /Render video with this audio/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/audio')?.body)
    .toMatchObject({ speed: 0.5, keepSoundSpeed: true, tracks: [{ key: expect.stringMatching(/^uploads\//), volume: 1, loop: false, duck: false }] })
})

test('Audio: a volume curve drawn on the strip, a sound preset and the de-esser are sent with the render', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Audio/ }).click()
  // A point at the middle of the video, near the bottom of the lane (quiet).
  const lane = page.getByTestId('volume-curve')
  const box = (await lane.boundingBox())!
  await lane.click({ position: { x: box.width / 2, y: box.height * 0.85 } })
  await expect(page.getByTestId('curve-point')).toHaveCount(1)
  // ↑ lifts it by 5 %.
  const point = page.getByTestId('curve-point')
  await point.focus()
  const before = Number(await point.getAttribute('aria-valuenow'))
  await point.press('ArrowUp')
  await expect(point).toHaveAttribute('aria-valuenow', String(before + 5))

  await page.getByRole('heading', { name: 'Clean-up' }).click()
  await page.getByRole('radio', { name: 'Phone call' }).click()
  await page.getByRole('switch', { name: /Soften the/ }).click()
  await page.getByRole('button', { name: /Render video with this audio/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/audio')?.body)
    .toMatchObject({ preset: 'PHONE', deEss: true, volumeCurve: [{ atMs: expect.any(Number), gain: (before + 5) / 100 }] })
  const body = (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/audio')!.body
  expect(Math.abs(body.volumeCurve[0].atMs - 5000)).toBeLessThan(400)
})

test('Trim: crossing out sentences of the transcript cuts them, with the pause between', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Edit by transcript' }).click()
  const panel = page.getByTestId('transcript-cut')
  await panel.getByRole('button', { name: 'Um, let me find my notes.' }).click()
  await panel.getByRole('button', { name: 'Okay, sorry about that.' }).click()
  await expect(panel).toContainText('2 of 4 sentences cut')
  // One cut from the start of the first to the end of the second, under Cut out
  await expect(page.getByTestId('cut-row')).toHaveCount(1)
  await expect(page.getByTestId('cut-row').getByLabel('Cut 1 start')).toHaveValue(/0:02\.3/)
  await expect(page.getByTestId('cut-row').getByLabel('Cut 1 end')).toHaveValue(/0:06/)

  await panel.getByRole('button', { name: 'Um, let me find my notes.' }).click()
  await expect(panel).toContainText('1 of 4 sentences cut')
})

test('Trim: long pauses are found and added to Cut out', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Remove the pauses' }).click()
  const panel = page.getByTestId('pause-cut')
  await panel.getByRole('button', { name: 'Find the pauses' }).click()
  // Only the 2 s pause is longer than 1 s; 0.2 s of quiet stays on each side.
  await expect(page.getByTestId('pause-summary')).toContainText('1 pause to cut, saving 0:01.6')
  await panel.getByRole('button', { name: 'Cut 1 pause' }).click()
  await expect(page.getByTestId('cut-row')).toHaveCount(1)
  await expect(page.getByTestId('cut-row').getByLabel('Cut 1 start')).toHaveValue(/0:02\.2/)
  await expect(page.getByTestId('cut-row').getByLabel('Cut 1 end')).toHaveValue(/0:03\.8/)
})

test('Trim: [ ] move by sentence, and { } put the trim start and end at the sentence', async ({ page }) => {
  await openEditor(page)
  // The sample transcript's sentences: 0–2 s, 2.3–4 s, 4.5–6 s, 6.5–10 s.
  await page.keyboard.press(']')
  const start = page.locator('#trim-start')
  const end = page.locator('#trim-end')
  // The seek lands a moment later; { then takes the sentence playing.
  await expect
    .poll(async () => {
      await page.keyboard.press('{')
      return start.inputValue()
    })
    .toMatch(/0:02\.3/)
  await page.keyboard.press('}')
  await expect(end).toHaveValue(/0:04\.0/)
})

test('Trim: a pause after each sentence is placed from the transcript and sent', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Motion & effects' }).click()
  const pauses = page.getByTestId('sentence-pauses')
  await pauses.getByRole('button', { name: 'Add the pauses' }).click()
  await expect(pauses.getByRole('status')).toContainText('3 pauses of 2 s')
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body?.holds)
    .toEqual([
      { atMs: 2000, durationMs: 2000 },
      { atMs: 4000, durationMs: 2000 },
      { atMs: 6000, durationMs: 2000 }
    ])
})

test('Trim: two parts at other speeds are sent in time order', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Motion & effects' }).click()
  const speeds = page.getByTestId('speed-parts')
  await speeds.getByRole('button', { name: 'Add a part' }).click()
  await speeds.getByRole('button', { name: 'Add another part' }).click()
  await expect(speeds.getByTestId('speed-part')).toHaveCount(2)
  // The second starts where the first ends (they mustn't overlap).
  await expect(speeds.getByLabel('Part 2 from')).toHaveValue('2.1')
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body?.speeds)
    .toEqual([
      { startMs: 100, endMs: 2100, speed: 0.5 },
      { startMs: 2100, endMs: 4100, speed: 0.5 }
    ])
})

test('Trim: motion and effects are sent with the trim', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Motion & effects' }).click()
  const panel = page.getByTestId('motion')
  await panel.getByRole('switch', { name: 'Hold a frame' }).click()
  await panel.getByRole('switch', { name: 'Play backwards' }).click()
  await panel.getByRole('switch', { name: 'Zoom into an area' }).click()
  await panel.getByRole('radio', { name: 'Zoom to the top right' }).click()
  await panel.getByRole('switch', { name: 'Replace a green screen' }).click()
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body)
    .toMatchObject({
      freeze: { durationMs: 2000 },
      reverse: true,
      zoomTo: { cx: 0.8, cy: 0.2, size: 0.5 },
      greenScreen: { keyColor: '#00ff00', similarity: 0.3, background: '#1e3a8a' }
    })
})

test('Text: a layer can move across the picture and grow over its time', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Text/ }).click()
  await page.getByRole('button', { name: 'Add text' }).click()
  await page.getByRole('heading', { name: 'Timing' }).click()
  const moves = page.getByTestId('layer-moves')
  await moves.getByRole('switch', { name: 'Moves over time' }).click()
  await expect(page.getByTestId('layer-end-ghost')).toBeVisible()
  await moves.getByLabel('Ends at size value').fill('200')
  await moves.getByLabel('Ends at size value').press('Enter')
  await page.getByRole('button', { name: /Render layers/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/overlay')?.body?.layers?.[0])
    .toMatchObject({ kind: 'TEXT', toScale: 2, toX: expect.any(Number), toY: expect.any(Number) })
})

test('Text: subtitles from the transcript can be burned in, without any layer', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Text/ }).click()
  await page.getByRole('heading', { name: 'Burned-in subtitles' }).click()
  await page.getByTestId('burned-captions').getByRole('switch', { name: 'Burn the subtitles into the picture' }).click()
  await page.getByRole('button', { name: /Render layers/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/overlay')?.body)
    .toMatchObject({ layers: [], captions: { transcriptId: 21, secondTranscriptId: null, style: 'BOX', position: 'BOTTOM', sizePct: 5 } })
})

test('Trim: a look can be compared before and after on the preview', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Look' }).click()
  await page.getByRole('switch', { name: 'Black & white' }).click()
  await page.getByRole('switch', { name: 'Compare before / after' }).click()
  const compare = page.getByTestId('look-compare')
  await expect(compare).toBeVisible()
  await expect(compare).toContainText('Before')
  const divider = compare.getByRole('slider', { name: 'Before and after divider' })
  await divider.focus()
  await divider.press('ArrowLeft')
  await expect(divider).toHaveAttribute('aria-valuenow', '45')
  if (process.env.SHOT) await page.locator('video').first().locator('..').screenshot({ path: process.env.SHOT })
})

test('Trim: blur areas, picture in picture and title cards are sent with the trim', async ({ page }) => {
  await configureMock({ videoList: true })
  await openEditor(page)
  await page.getByRole('heading', { name: 'Blur, picture in picture & cards' }).click()
  const panel = page.getByTestId('trim-extras')
  await panel.getByRole('button', { name: 'Add a blur area' }).click()
  await expect(page.getByTestId('blur-boxes')).toBeVisible()
  await expect(panel.getByTestId('blur-row')).toHaveCount(1)

  await panel.getByRole('switch', { name: 'Picture in picture' }).click()
  await panel.getByRole('button', { name: 'Video in the corner' }).click()
  await page.getByRole('option', { name: 'Teacher camera' }).click()
  await panel.getByRole('switch', { name: 'Title cards' }).click()
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body)
    .toMatchObject({
      blurs: [{ x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) }],
      pip: { videoId: 8, corner: 'BOTTOM_RIGHT', sizePct: 30 },
      cards: { intro: { text: 'Sample lesson', durationMs: 3000 }, outro: null, background: '#1e3a8a', color: '#ffffff' }
    })
})

test('J, K and L shuttle the preview: L faster each time, J slower, K pauses at normal speed', async ({ page }) => {
  await openEditor(page)
  const video = page.locator('video').first()
  const state = () => video.evaluate((v: HTMLVideoElement) => ({ paused: v.paused, rate: v.playbackRate }))
  await page.locator('body').press('l')
  await expect.poll(state).toEqual({ paused: false, rate: 1 })
  await page.locator('body').press('l')
  await page.locator('body').press('l')
  await expect.poll(state).toEqual({ paused: false, rate: 2 })
  await page.locator('body').press('j')
  await expect.poll(state).toEqual({ paused: false, rate: 1.5 })
  await page.locator('body').press('k')
  await expect.poll(state).toEqual({ paused: true, rate: 1 })
})

test('Trim: a 9:16 crop can follow the action instead of staying put', async ({ page }) => {
  await openEditor(page)
  await page
    .getByRole('button', { name: /Shorts/ })
    .first()
    .click()
  await page.getByRole('switch', { name: 'Follow the action' }).click()
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body)
    .toMatchObject({ crop: null, reframe: { aspect: 9 / 16 }, scale: { w: 1080, h: 1920 } })
})

test('Trim: single words and the filler words can be cut when the transcript has word timings', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Edit by transcript' }).click()
  const panel = page.getByTestId('transcript-cut')
  await panel.getByRole('switch', { name: 'Cut by word' }).click()
  await panel.getByRole('button', { name: 'Cut the filler words (1)' }).click()
  await expect(page.getByTestId('cut-row')).toHaveCount(1)
  await expect(page.getByTestId('cut-row').getByLabel('Cut 1 start')).toHaveValue(/0:02\.3/)
  await expect(panel.getByRole('button', { name: 'Um,' })).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('button', { name: 'notes.' }).click()
  await expect(page.getByTestId('cut-row')).toHaveCount(2)
})

test('Trim: a warm, sharpened look is sent whole (warmth and sharpen included)', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Look' }).click()
  await page.getByRole('button', { name: 'Warm', exact: true }).click()
  await page.getByRole('switch', { name: 'Sharpen' }).click()
  await page.getByRole('button', { name: 'Start trim' }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/trim')?.body?.look)
    .toEqual({ brightness: 0, contrast: 1, saturation: 1.1, blur: 0, grayscale: false, sepia: false, vignette: false, warmth: 0.4, sharpen: true })
})

test('Audio: a spoken line is added as a sound track and sent with the render', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Audio/ }).click()
  await page.getByRole('heading', { name: /Background music/ }).click()
  const box = page.getByTestId('narration')
  await box.getByLabel('Line to speak').fill('Listen, then repeat after me.')
  await box.getByRole('button', { name: 'Speak and add' }).click()
  await expect(page.getByTestId('sound-tracks')).toContainText('Spoken: “Listen, then repeat after me.”')
  const spoken = (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/narration')
  expect(spoken?.body).toEqual({ text: 'Listen, then repeat after me.', voice: 'nova', rate: 1 })

  await page.getByRole('button', { name: /Render video with this audio/ }).click()
  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/audio')?.body?.tracks)
    .toEqual([{ key: 'audio-uploads/narration-1.wav', volume: 1, loop: false, duck: false, startMs: 0 }])
})

test('Text: burned-in subtitles can have a look of their own', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Text/ }).click()
  await page.getByRole('heading', { name: 'Burned-in subtitles' }).click()
  await page.getByRole('switch', { name: 'Burn the subtitles into the picture' }).click()
  const look = page.getByTestId('caption-look')
  await look.getByRole('switch', { name: 'Customise the look' }).click()
  // The BOX style's look to start from; take the box away and make it plain.
  await look.getByRole('switch', { name: 'Box behind' }).click()
  await look.getByRole('switch', { name: 'Bold' }).click()
  await expect(page.getByTestId('caption-sample')).toContainText('The spoken words appear here')
  await page.getByRole('button', { name: /Render layers/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/overlay')?.body?.captions?.look)
    .toEqual({ color: '#ffffff', secondColor: '#ffff99', edgeColor: '#000000', box: false, boxOpacity: 0.5, bold: false })
})

test('History lists the steps by name, and a click goes back to one', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('heading', { name: 'Look' }).click()
  await page.getByRole('button', { name: 'Warm', exact: true }).click()
  await page.waitForTimeout(600) // a step is recorded once changes settle
  await page.getByRole('switch', { name: 'Sharpen' }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'History' }).click()
  const list = page.getByTestId('history-list')
  await expect(list.getByRole('button')).toHaveText([/Look/, /Look/, /Start/])
  await list.getByRole('button', { name: /Start/ }).click()
  await expect(page.getByRole('switch', { name: 'Sharpen' })).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Warm', exact: true })).toHaveAttribute('aria-pressed', 'false')
})

test('Split: three even parts queue a split into three segments', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '3 parts', exact: true }).click()
  await page.getByRole('button', { name: /Start split/ }).click()

  await expect.poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/split')?.body?.segments?.length).toBe(3)
})

test('Split: dragging the cut between two segments moves it', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '3 parts', exact: true }).click()
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

test('Split: at the markers, chapters only', async ({ page }) => {
  const marker = { color: null, createdBy: 'admin', createdAt: '2026-10-13T09:00:00' }
  await resetMock({
    markers: [
      { ...marker, id: 1, atMs: 3000, label: 'Intro done', chapter: true },
      { ...marker, id: 2, atMs: 5000, label: 'Check this', chapter: false },
      { ...marker, id: 3, atMs: 7000, label: 'Practice', chapter: true }
    ]
  })
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: 'Split at markers (4 parts)' }).click()
  await expect(page.getByLabel('Segment 2 start')).toHaveValue(/^0:03/)

  await page.getByRole('checkbox', { name: 'Chapters only' }).click()
  await page.getByRole('button', { name: 'Split at chapters (3 parts)' }).click()
  await expect(page.getByLabel('Segment 3 start')).toHaveValue(/^0:07/)
  await page.getByRole('button', { name: /Start split/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/split')?.body?.segments)
    .toEqual([
      { startMs: 0, endMs: 3000 },
      { startMs: 3000, endMs: 7000, label: 'Intro done' },
      { startMs: 7000, endMs: null, label: 'Practice' }
    ])
})

test('Split: cuts move to the nearest break between sentences', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '2 parts', exact: true }).click()
  // 0:05 is inside "Okay, sorry about that." (4.5–6 s); the nearest pause is 4–4.5 s.
  await page.getByRole('button', { name: 'Move cuts to sentence breaks' }).click()
  await expect(page.getByText('Moved 1 cut to a break between sentences', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Segment 1 end')).toHaveValue(/^0:04\.2/)
})

test('Split: at long pauses, at AI chapters, and parts of about N seconds between sentences', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()

  // The sample's sound is quiet 2–4 s; at pauses of 2 s or more, the cut is in its middle.
  await page.getByRole('button', { name: 'Split at pauses' }).click()
  await expect(page.getByLabel('Segment 2 start')).toHaveValue('0:03.00')

  // The AI chapters start at 0 s and 5 s.
  await page.getByRole('button', { name: 'Split at AI chapters (2 parts)' }).click()
  await expect(page.getByLabel('Segment 2 start')).toHaveValue('0:05.00')

  // About 2 s each, each cut in the nearest pause between sentences (2.0–2.3 s, 4.0–4.5 s, 6.0–6.5 s).
  await page.getByLabel('Seconds per part, cut between sentences').fill('2')
  await page.getByTestId('split-near').getByRole('button', { name: 'Split between sentences' }).click()
  await expect(page.getByLabel('Segment 2 start')).toHaveValue('0:02.15')
  await expect(page.getByLabel('Segment 3 start')).toHaveValue('0:04.25')
  // What each part says shows under its row.
  await expect(page.getByText('“Hello and welcome.”')).toBeVisible()
})

test('Split: a part can be named and given its own shape', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '2 parts', exact: true }).click()
  await page.getByLabel('Segment 1 name').fill('Welcome')
  await page.getByRole('combobox', { name: 'Segment 2 shape' }).click()
  await page.getByRole('option', { name: '9:16' }).click()
  await page.getByRole('button', { name: /Start split/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/split')?.body?.segments)
    .toEqual([
      { startMs: 0, endMs: 5000, label: 'Welcome' },
      { startMs: 5000, endMs: null, aspect: 9 / 16 }
    ])
})

test('Split: a segment plays on its own and stops at its end', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '10 parts', exact: true }).click()
  await page.getByRole('button', { name: 'Play segment 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop segment 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play segment 1', exact: true })).toBeVisible({ timeout: 5000 })
  const at = await page
    .locator('video')
    .first()
    .evaluate((v: HTMLVideoElement) => v.currentTime)
  expect(at).toBeGreaterThanOrEqual(0.9)
  expect(at).toBeLessThan(1.5)
})

test('Split: the cuts are saved as markers', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()
  await page.getByRole('button', { name: '3 parts', exact: true }).click()
  await page.getByRole('button', { name: 'Save the cuts as markers (2)' }).click()
  await expect(page.getByText('Added 2 markers', { exact: true })).toBeVisible()

  const posted = (await mockRequests()).filter((r) => r.method === 'POST' && r.path === '/api/admin/videos/7/markers').map((r) => r.body)
  expect(posted).toEqual([
    { atMs: 3330, label: 'Part 2' },
    { atMs: 6670, label: 'Part 3' }
  ])
  // Now marked, so there is nothing left to save, and Split at markers gives the same parts.
  await expect(page.getByRole('button', { name: 'Save the cuts as markers' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Split at markers (3 parts)' })).toBeVisible()
})

test('Trim: start and end move to breaks between sentences', async ({ page }) => {
  await openEditor(page)
  const start = page.getByRole('slider').first()
  await start.focus()
  for (let i = 0; i < 15; i++) await start.press('ArrowRight') // 1.5 s, inside "Hello and welcome."
  await page.getByRole('button', { name: 'Start and end between sentences' }).click()
  await expect(page.locator('#trim-start')).toHaveValue('0:02.15')
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

test('Split: at a pasted list, parts named from what they say, and copied as a list', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openEditor(page)
  await page.getByRole('tab', { name: /Split/ }).click()

  // A pasted list cuts at its times and names each part after its line; a line without a time is left out.
  const list = page.getByTestId('split-list')
  await list.getByText('Split at a pasted list').click()
  await list.getByLabel('List of times').fill('Chapters\n0:00 Intro\n0:06.5 Practice')
  await list.getByRole('button', { name: 'Split at these (2 parts)' }).click()
  await expect(page.getByLabel('Segment 2 start')).toHaveValue('0:06.50')
  await expect(page.getByLabel('Segment 2 name')).toHaveValue('Practice')

  // Even parts have no names; each takes the first words of its speech (0–2 s "Hello and welcome.", 4.5–6 s "Okay, sorry about that.").
  await page.getByRole('button', { name: '2 parts', exact: true }).click()
  await page.getByRole('button', { name: 'Name the parts from what they say' }).click()
  await expect(page.getByLabel('Segment 1 name')).toHaveValue('Hello and welcome')
  await expect(page.getByLabel('Segment 2 name')).toHaveValue('Okay, sorry about that')

  await page.getByRole('button', { name: 'Copy the parts as a list' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('0:00 Hello and welcome\n0:05 Okay, sorry about that')
})

test('Audio: words typed are muted wherever the transcript hears them', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: /Audio/ }).click()
  const form = page.getByTestId('mute-words')
  // "notes." is said at 3.55–4 s in the sample's transcript; "zebra" never is.
  await form.getByLabel('Words to mute').fill('zebra')
  await form.getByRole('button', { name: 'Mute words' }).click()
  await expect(page.getByText('None of those words is said', { exact: true })).toBeVisible()
  await form.getByLabel('Words to mute').fill('Notes, zeb*')
  await form.getByRole('button', { name: 'Mute words' }).click()
  await expect(page.getByText('Muted 1 word', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unmute 0:03.49' })).toBeVisible()
  await page.getByRole('button', { name: /Render video with this audio/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/audio')?.body?.mutes)
    .toEqual([{ startMs: 3490, endMs: 4060 }])
})

test('Text: a title on the picture as each chapter marker starts', async ({ page }) => {
  const marker = { color: null, createdBy: 'admin', createdAt: '2026-10-13T09:00:00' }
  await resetMock({
    markers: [
      { ...marker, id: 1, atMs: 0, label: 'Welcome', chapter: true },
      { ...marker, id: 2, atMs: 1000, label: 'A note', chapter: false },
      { ...marker, id: 3, atMs: 6000, label: 'Practice', chapter: true }
    ]
  })
  await openEditor(page)
  await page.getByRole('tab', { name: /Text/ }).click()
  await page.getByRole('button', { name: 'Chapter titles' }).click()
  await expect(page.getByText('2 chapter titles added', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Render layers/ }).click()

  await expect
    .poll(async () => (await mockRequests()).find((r) => r.path === '/api/admin/videos/7/edits/overlay')?.body?.layers)
    .toMatchObject([
      { kind: 'TEXT', text: 'Welcome', startMs: 0, endMs: 4000, animation: 'SLIDE_LEFT' },
      { kind: 'TEXT', text: 'Practice', startMs: 6000, endMs: 10_000 }
    ])
})
