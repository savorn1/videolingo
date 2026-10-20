// Before exporting for a platform (the Trim tab's built-in presets): what fits it and what may not — shape, size,
// length and the first seconds. The platforms' own limits change, so this is a guide, not a rule. Pure, so tested.

export interface PlatformCheck {
  ok: boolean
  text: string
}

export interface ExportFacts {
  /** The result's length, with speed changes, pauses and cards. */
  lengthMs: number
  /** The output size, or null when not known. */
  w: number | null
  h: number | null
  introMs: number
  fadeInMs: number
}

const fmt = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}`

function shape(f: ExportFacts, aspect: number, name: string): PlatformCheck {
  const ok = !!f.w && !!f.h && Math.abs(f.w / f.h - aspect) < 0.02
  return { ok, text: ok ? `${name} shape` : `Not the ${name} shape — turn on the preset's crop` }
}

function size(f: ExportFacts, minW: number, minH: number): PlatformCheck {
  const ok = !!f.w && !!f.h && f.w >= minW && f.h >= minH
  return { ok, text: ok ? `${f.w}×${f.h}` : `${f.w ?? '?'}×${f.h ?? '?'} is smaller than ${minW}×${minH} — it will look soft` }
}

/** The checks for a built-in preset ('youtube', 'shorts', 'square', 'twitter'); null for a preset of your own. */
export function platformChecks(preset: string, f: ExportFacts): PlatformCheck[] | null {
  switch (preset) {
    case 'shorts':
      return [
        shape(f, 9 / 16, '9:16'),
        size(f, 1080, 1920),
        f.lengthMs <= 180_000
          ? { ok: true, text: `${fmt(f.lengthMs)} long — fits Shorts, Reels and TikTok (up to 3 min)` }
          : {
              ok: false,
              text: `${fmt(f.lengthMs)} long — Shorts and Reels take up to 3 min${f.lengthMs <= 600_000 ? '; TikTok takes it' : ', TikTok up to 10 min'}`
            },
        f.introMs >= 2000
          ? { ok: false, text: `A ${f.introMs / 1000} s intro card — people swipe away in the first seconds; open with the content` }
          : { ok: true, text: 'Opens with the content' },
        f.fadeInMs > 0
          ? { ok: false, text: 'Starts from black — the first frame is what shows in the feed' }
          : { ok: true, text: 'The first frame is a picture, not black' }
      ]
    case 'youtube':
      return [
        shape(f, 16 / 9, '16:9'),
        size(f, 1920, 1080),
        f.lengthMs <= 180_000 && f.w && f.h && f.w < f.h
          ? { ok: false, text: 'Under 3 min and tall — YouTube treats it as a Short' }
          : { ok: true, text: `${fmt(f.lengthMs)} long` }
      ]
    case 'twitter':
      return [
        shape(f, 16 / 9, '16:9'),
        size(f, 1280, 720),
        f.lengthMs <= 140_000
          ? { ok: true, text: `${fmt(f.lengthMs)} long — within X's 2:20` }
          : { ok: false, text: `${fmt(f.lengthMs)} long — X takes up to 2:20 without Premium` }
      ]
    case 'square':
      return [shape(f, 1, '1:1'), size(f, 1080, 1080)]
    default:
      return null
  }
}
