// A stand-in for the Java backend for the browser tests: the app's /api/** proxy points here
// (NUXT_BACKEND_BASE), so the pages run unchanged, server side and in the browser. It answers the
// calls the tested flows make, records what was sent (GET /__requests), and gives an empty answer
// to anything else so unrelated widgets on the page stay quiet.
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

// A 10 s, 320×180 clip for the editor (made with ffmpeg; see e2e/fixtures).
const SAMPLE = readFileSync(new URL('./fixtures/sample.mp4', import.meta.url))

const PORT = Number(process.env.MOCK_PORT || 8089)
const ok = (data) => ({ traceId: 'e2e', statusCode: 200, message: 'OK', data })
const page = (data) => ({ ...ok(data), metadata: { hasNext: false, hasPrev: false, totalPage: 1, currentPage: 1, limit: 100, totalCount: data.length } })
const rules = { maxCut: 2000, maxLines: 2, maxCharsPerLine: 42, minDurationMs: 800, maxDurationMs: 7000, maxCps: 17 }

/** What the next test wants different (POST /__config), e.g. an older server's waveform list. */
let config = {}
let requests = []
let uploads = 0
/** Videos made from audio in this test, by job id: the first succeeds, the others fail (and succeed once retried). */
let made = []

function clientSettings() {
  return {
    siteName: 'VideoLingo',
    maxTagsPerVideo: 10,
    maxCategoriesPerVideo: 10,
    requireCategory: false,
    statisticsDefaultDays: 30,
    maxVideoUploadMb: 2048,
    defaultTargetLanguages: [],
    blockPublishWithIssues: false,
    requireApprovalToPublish: false,
    maxUploadMb: 100,
    allowedUploadTypes: [],
    maxSubtitleUploadMb: 5,
    standardRules: rules,
    compactRules: rules,
    compactLanguages: [],
    mediaRules: {
      maxSegments: 20,
      maxQueuedEdits: 3,
      maxAudioClips: 50,
      maxMergeVideos: 10,
      maxMergeMs: 3 * 60 * 60 * 1000,
      maxSlides: 30,
      maxStrip: 120,
      waveforms: config.waveforms ?? [
        'NONE',
        'WAVES',
        'BARS',
        'SPIKES',
        'DOTS',
        'SPECTRUM',
        'PULSE',
        'BLOCKS',
        'FINE',
        'STRIPES',
        'REFLECT',
        'COLUMNS',
        'STEREO'
      ]
    }
  }
}

/** A "video from audio" job as the jobs API returns it. */
function job(entry) {
  const failed = entry.status === 'FAILED'
  return {
    id: entry.jobId,
    videoId: entry.videoId,
    videoTitle: entry.title,
    type: 'AUDIO_TO_VIDEO',
    status: entry.status,
    progress: entry.status === 'SUCCEEDED' ? 100 : 40,
    currentStep: null,
    parameters: JSON.stringify({ operation: 'AUDIO_TO_VIDEO' }),
    attempts: 1,
    maxAttempts: 3,
    errorMessage: failed ? 'ffmpeg could not read the audio' : null,
    createdAt: null,
    startedAt: null,
    finishedAt: null,
    updatedAt: null,
    durationSeconds: 3,
    logCount: 0,
    canRetry: failed,
    canCancel: false,
    canDelete: true
  }
}

/** A stored, 10-second video playing the sample clip. */
function video(id) {
  return {
    id,
    title: 'Sample lesson',
    description: null,
    ownerId: 1,
    ownerUsername: 'admin',
    language: 'en',
    videoUrl: '/api/__media/sample.mp4',
    storageKey: 'videos/sample.mp4',
    importedFrom: null,
    source: 'UPLOAD',
    externalId: null,
    sourceAuthor: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationSeconds: 10,
    width: 320,
    height: 180,
    fileSize: SAMPLE.length,
    mimeType: 'video/mp4',
    enabled: false,
    archived: false,
    archivedAt: null,
    visibility: 'PUBLIC',
    deleted: false,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    viewCount: 0,
    categories: [],
    tags: []
  }
}

/** The sample clip, with byte ranges so the player can seek. */
function sendMedia(req, res) {
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '')
  if (!range) {
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': SAMPLE.length, 'accept-ranges': 'bytes' })
    return res.end(SAMPLE)
  }
  const start = Number(range[1] || 0)
  const end = range[2] ? Math.min(Number(range[2]), SAMPLE.length - 1) : SAMPLE.length - 1
  res.writeHead(206, {
    'content-type': 'video/mp4',
    'content-length': end - start + 1,
    'content-range': `bytes ${start}-${end}/${SAMPLE.length}`,
    'accept-ranges': 'bytes'
  })
  res.end(SAMPLE.subarray(start, end + 1))
}

function route(method, path, body) {
  if (method === 'GET' && path === '/api/settings/client') return ok(clientSettings())
  if (path === '/api/me/preferences') return ok(method === 'GET' ? {} : body)
  if (method === 'GET' && path === '/api/admin/collections') return page([{ id: 5, title: 'Season one' }])
  if (method === 'POST' && path === '/api/admin/videos/uploads') {
    const key = `uploads/e2e-${++uploads}`
    return ok({
      key,
      uploadUrl: `/api/__storage/${key}`,
      method: 'PUT',
      headers: {},
      expiresAt: new Date(Date.now() + 3600e3).toISOString(),
      publicUrl: `/${key}`,
      contentType: 'audio/wav'
    })
  }
  if (method === 'PUT' && path.startsWith('/api/__storage/')) return ok(null)
  // Large files in parts: 16 MiB each, signed one at a time, put together at the end.
  if (method === 'POST' && path === '/api/admin/videos/uploads/multipart') {
    const partSize = 16 * 1024 * 1024
    return ok({
      key: `uploads/e2e-big-${++uploads}`,
      uploadId: 'up-1',
      partSize,
      partCount: Math.ceil(body.size / partSize),
      publicUrl: '/big',
      contentType: 'audio/wav'
    })
  }
  if (method === 'POST' && path === '/api/admin/videos/uploads/multipart/part') {
    return ok({ partNumber: body.partNumber, url: `/api/__storage/part/${body.partNumber}`, length: 0, expiresAt: new Date(Date.now() + 3600e3).toISOString() })
  }
  if (method === 'POST' && /^\/api\/admin\/videos\/uploads\/multipart\/(complete|abort)$/.test(path)) return ok(null)
  if (method === 'POST' && path === '/api/admin/videos/from-audio') {
    const entry = { videoId: 42 + made.length, jobId: 7 + made.length, title: body?.title, status: made.length === 0 ? 'SUCCEEDED' : 'FAILED' }
    made.push(entry)
    return ok({ video: { id: entry.videoId, title: entry.title }, job: { id: entry.jobId, status: 'QUEUED' } })
  }
  const jobMatch = /^\/api\/admin\/processing-jobs\/(\d+)(\/retry)?$/.exec(path)
  if (jobMatch) {
    const entry = made.find((m) => m.jobId === Number(jobMatch[1]))
    if (!entry) return null
    if (method === 'POST' && jobMatch[2]) entry.status = 'SUCCEEDED'
    return ok(job(entry))
  }
  if (method === 'GET' && /^\/api\/admin\/videos\/\d+$/.test(path)) return ok(video(Number(path.split('/').pop())))
  if (method === 'GET' && /^\/api\/admin\/videos\/\d+\/edits$/.test(path)) return ok({ clips: [], jobs: [] })
  if (method === 'POST' && /^\/api\/admin\/videos\/\d+\/edits\/(trim|split|audio|overlay|cut)$/.test(path)) {
    return ok({
      id: 100 + requests.length,
      type: 'EDIT',
      status: 'QUEUED',
      progress: 0,
      parameters: JSON.stringify({ operation: path.split('/').pop().toUpperCase() })
    })
  }
  return null
}

createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const url = new URL(req.url, 'http://mock')
    const raw = Buffer.concat(chunks)
    let body = null
    if (raw.length && (req.headers['content-type'] || '').includes('json')) {
      try {
        body = JSON.parse(raw.toString())
      } catch {
        // Not JSON after all: recorded without a body.
      }
    }
    const send = (status, json) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(json))
    }
    if (url.pathname === '/__requests') return send(200, requests)
    if (url.pathname === '/api/__media/sample.mp4') return sendMedia(req, res)
    if (url.pathname === '/__config') {
      config = { ...config, ...(body ?? {}) }
      return send(200, { ok: true })
    }
    // A part storage refuses (config.failParts), to test carrying on after a failure.
    const part = /^\/api\/__storage\/part\/(\d+)$/.exec(url.pathname)
    if (part) {
      requests.push({ method: req.method, path: url.pathname, body: null })
      if ((config.failParts ?? []).includes(Number(part[1]))) return send(500, { message: 'storage is down' })
    }
    if (url.pathname === '/__reset') {
      requests = []
      uploads = 0
      made = []
      config = body ?? {}
      return send(200, { ok: true })
    }
    if (!url.pathname.startsWith('/api/__storage/')) requests.push({ method: req.method, path: url.pathname, body })
    const answer = route(req.method, url.pathname, body)
    if (answer) return send(200, answer)
    // Anything else: an empty list or nothing, so pages and widgets don't fall over.
    send(200, req.method === 'GET' ? page([]) : ok(null))
  })
}).listen(PORT, () => console.log(`mock backend on ${PORT}`))
