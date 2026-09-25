// Player helpers for VideoPlayer: the embed address to load (privacy mode,
// player API, autoplay), YouTube's error codes in plain words, and when a
// saved position is worth resuming from. Pure so they can be tested directly.

export interface EmbedOptions {
  /** Page origin — YouTube's player API only talks to the origin named here. */
  origin?: string
  /** Start playing as soon as it loads (the viewer already clicked play). */
  autoplay?: boolean
}

const YOUTUBE_EMBED = /^(https?:\/\/)(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//i

export function isYouTubeEmbed(url: string | null | undefined): boolean {
  return !!url && YOUTUBE_EMBED.test(url)
}

export function isVimeoEmbed(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\/player\.vimeo\.com\//i.test(url)
}

/**
 * The address the player iframe loads. YouTube goes through
 * youtube-nocookie.com (no tracking cookies until the video plays) with its
 * JS API switched on; `autoplay` is added for YouTube, Vimeo and Facebook.
 */
export function playerEmbedUrl(embedUrl: string, options: EmbedOptions = {}): string {
  let url: URL
  try {
    url = new URL(embedUrl)
  } catch {
    return embedUrl
  }
  if (isYouTubeEmbed(embedUrl)) {
    url.hostname = 'www.youtube-nocookie.com'
    url.searchParams.set('enablejsapi', '1')
    if (options.origin) url.searchParams.set('origin', options.origin)
    if (options.autoplay) url.searchParams.set('autoplay', '1')
  } else if (isVimeoEmbed(embedUrl)) {
    if (options.autoplay) url.searchParams.set('autoplay', '1')
  } else if (/facebook\.com$/i.test(url.hostname)) {
    if (options.autoplay) url.searchParams.set('autoplay', 'true')
  }
  return url.toString()
}

/** YouTube's still image for an embed link, for the click-to-play cover. */
export function youTubeThumbnail(embedUrl: string | null | undefined): string | null {
  if (!isYouTubeEmbed(embedUrl)) return null
  const id = /\/embed\/([\w-]{6,})/.exec(embedUrl!)?.[1]
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

/** What went wrong, from the code YouTube's player reports in onError. */
export function youTubeErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return 'The video link is invalid.'
    case 5:
      return "This video can't be played in this browser."
    case 100:
      return 'This video was removed or made private.'
    case 101:
    case 150:
      return "The owner doesn't allow this video to be played on other sites."
    default:
      return "YouTube couldn't play this video."
  }
}

/** Positions this close to the start or end aren't worth resuming from. */
export const RESUME_MARGIN_SECONDS = 10

/**
 * Where to pick up from a saved position, or null to start from the
 * beginning — too early to matter, or so close to the end the video was
 * effectively finished. The duration may be unknown (0/null).
 */
export function resumePosition(savedSeconds: number | null | undefined, durationSeconds?: number | null): number | null {
  if (!savedSeconds || !Number.isFinite(savedSeconds) || savedSeconds < RESUME_MARGIN_SECONDS) return null
  if (durationSeconds && savedSeconds > durationSeconds - RESUME_MARGIN_SECONDS) return null
  return savedSeconds
}
