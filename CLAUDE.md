# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # dev server (port from NUXT_PORT, default 3000)
npm test               # vitest run (all unit tests)
npx vitest run shared/utils/videoEdit.spec.ts   # one test file
npx vitest run -t "splitEvenlyRows"             # tests by name
npm run typecheck      # nuxt prepare + vue-tsc (CI runs this)
npm run format:check   # prettier check (CI runs this); `npm run format` to fix
npm run gen:api        # regenerate shared/api.generated.d.ts from the backend's /v3/api-docs
```

CI (`.github/workflows/ci.yml`) runs format:check, typecheck and tests on every push/PR — all three must pass. Prettier: no semicolons, single quotes, 160 columns, no trailing commas.

## Architecture

Nuxt 4 + Nuxt UI 4 admin/learning app for a video-learning platform. It is only a frontend: the Java backend is a separate service.

**Backend access.** The backend has no CORS config, so the browser never calls it directly. All calls go to this app's own `/api/**`, which Nitro `routeRules` proxy to `NUXT_BACKEND_BASE` (default `http://localhost:8080`, see `.env.example`). Don't call the backend origin from client code. Nuxt Icon's local endpoint is moved to `/_nuxt_icon` so it doesn't hit that proxy.

**Data layer.** Every backend call goes through `useApi()` (`app/composables/useApi.ts`): it attaches the Bearer token, and on a 401 refreshes once and retries, then redirects to `/login` (hence `experimental.asyncContext` in `nuxt.config.ts`). One `use<Feature>.ts` composable per backend area wraps it; responses are typed with the `ApiEnvelope<T>` / `PageEnvelope<T>` shapes in `shared/types.ts`.

**Polling.** Anything that re-asks the server on a timer uses `usePolling(tick, { intervalMs, active, immediate })` (`app/composables/usePolling.ts`, rule in `shared/utils/polling.ts`), not `setInterval`: it never overlaps calls, pauses while the tab is hidden or the browser is offline (and runs at once when either comes back), and backs off after failures (a tick that throws), up to 60 s. Let errors reach it rather than swallowing them. The shared job counts in the header use their own timer (`useJobActivity`). `ConnectionBanner` in the default layout says when the browser is offline.

**Media links.** Links to stored files (`videoUrl`, `thumbnailUrl`, result/version/voice-over `url`s, upload tickets' `publicUrl`) arrive signed and expire (backend `MediaUrls`, `media.url-ttl-minutes`, default 180; a link is reused for a third of that, so any link lasts ≥ 2 h). The same file can come back with a different query string, so compare files with `mediaKey(url)` (`shared/utils/mediaUrl.ts`), never whole links — the player's `:key`, the editor's reset and its draft check do. Sending a signed link back (e.g. a thumbnail in a form) is fine: the backend saves it without the signature. Links in browser storage (overlay templates, recipes, drafts) can expire; files are re-read by `key` on the server. The learner player hides the download button and `media-guard.client.ts` blocks the right-click menu on all video/audio — deterrents only.

**Permissions.** `useAuth().can(module, 'READ' | 'WRITE' | 'APPROVE')` gates UI (admins pass everything). Routes are guarded by `auth.global.ts` and `admin.ts`; learners with no permissions land on `/learn`. When adding a button for a backend action, find which of READ/WRITE/APPROVE the backend requires (noted at the top of the composables, e.g. `useProcessingJobs.ts`: cancel = APPROVE).

**`shared/utils/` holds the logic, components hold the UI.** Pure functions (validation, arithmetic, sanitising storage data) live in `shared/utils/*.ts` with a `.spec.ts` next to them, imported as `#shared/utils/...`. Components and composables only wire them to state. New behaviour should follow this: write the pure function and test, then use it from the component. Tests run in jsdom (`vitest.config.ts`); note `import.meta.url` isn't a `file:` URL there, so use `process.cwd()` for file paths (see `tabAccent.spec.ts`).

**Auto-imports clash.** Every exported function/const in `shared/utils` and `app/composables` is auto-imported by name. `shared/utils/codebase.spec.ts` fails if two files export the same name, and also if an icon-only button lacks an `aria-label` or `title`.

**Browser-side persistence.** Per-user conveniences (export presets, overlay templates, edit recipes, editor drafts, last-used tab) are kept in `localStorage` through `NamedEntry` lists (`shared/utils/namedList.ts`: unique names, cap of 30). Always wrap storage access in try/catch. Export presets and a few settings also sync to the user's server-side preferences via `useLearnerPrefs`.

### The video editor (the largest feature)

`app/pages/videos/[id]/editor.vue` mounts `app/components/VideoClipEditor.vue` (very large). Its tabs — Trim, Split, Audio (`AudioEditPanel`), Text (`OverlayPanel`), Join (`JoinPanel`) — each build a request for a backend job (`useVideoEdits`: `startTrim`, `startSplit`, `startAudio`, `startOverlay`, …). Things that span files:

- **Jobs and results.** Starting an edit queues a processing job; the editor polls `overview()` every 3 s while any job is active (`usePolling`). Finished jobs appear as clips under "Results", which can be promoted (`Replace original`, which keeps the old file under Versions, or `Add as new video`) or discarded. The single-edit buttons are disabled while any job is active (`busy`), but the server accepts up to `MAX_QUEUED_EDITS` (3) queued/running edits per video (409 beyond that; they run one at a time), which multi-format export uses.
- **Undo/redo and drafts.** `useEditorHistory` snapshots `takeState()` / restores with `applyState()` in `VideoClipEditor.vue`. Any new editor state that should be undoable and survive in a draft must be added to both functions.
- **Per-tab colours.** `shared/utils/tabAccent.ts` holds the Tailwind class strings for each tab's colour; `app/assets/css/main.css` holds the matching `.tab-scope-<colour>` rules that recolour Nuxt UI's `primary` inside a tab. `tabAccent.spec.ts` checks the two stay in sync. Use full literal class names (Tailwind can't see built-up strings).
- **Units.** Trim ranges are in ms; the Split tab's rows are in seconds with `endMsSeconds: null` meaning "to the end". `MAX_SEGMENTS` (20) and `MIN_TRIM_MS` (500) in `shared/utils/videoEdit.ts` mirror backend rules, which stay the authority.
- **Related pages.** `app/pages/videos/from-audio.vue` (make videos from audio files) and `MergeVideosModal.vue` (join videos) reuse the same accents and helpers (`shared/utils/audioVideo.ts`, `mergeVideos.ts`).

### Video editor business rules

These are what a change to the editor must not break. The backend re-checks every one (Java `VideoEditRules`, `AudioEditRules`, `MergeRules`) and is the authority; the frontend copies exist for inline validation and disabled states, so keep the numbers in step with the backend.

**Operations and what happens to the result** (`replacesOriginal` in `shared/utils/videoEdit.ts`)

- Operations: `TRIM`, `SPLIT`, `AUDIO`, `OVERLAY`, `EXTRACT` (audio file only), plus merge and audio-to-video jobs created elsewhere.
- `TRIM`, `AUDIO` and `OVERLAY` results can **replace the original** video's file (the old file is kept under Versions) or be added as a **new video**. `SPLIT` results can only become new videos. `EXTRACT` results (MP3/WAV) are download-only.
- A new video made from a result is created **disabled** (hidden) until someone reviews and enables it. Results expire (`expiresAt`) if not promoted or discarded.
- Default new-video titles come from `suggestedNewTitle`: "— Part N" for splits, "(trimmed)", "(edited audio)", "(with text & overlays)"; mirrors the server's own default and is capped at 200 characters (`MAX_VIDEO_TITLE`).
- Each edit is one background job. The server allows at most 3 queued or running edits per video (`VideoEditService.MAX_QUEUED_EDITS_PER_VIDEO`, mirrored as `MAX_QUEUED_EDITS`), so multi-format export can queue only the free slots. On the backend (`../java/videolingo`) jobs run in two lanes — MEDIA (edits, joins, downloads) and AI (transcribe, translate, dub) — one job at a time per lane unless `pipeline.media-concurrency` / `pipeline.ai-concurrency` (1–4) are raised; queued/running jobs interrupted by a restart are re-queued until their attempts run out; expired results (72 h) are deleted hourly. Cancelling a job needs the APPROVE permission on `processing-jobs`.

**Trim**

- Range in ms, at least `MIN_TRIM_MS` (500) long, start ≥ 0, end ≤ duration; `endMs: null` means "to the end".
- Optional crop (inside the frame, positive size, from a chosen shape such as 16:9) and optional resize (both sides positive). "Export for" presets set crop shape and output size together; a preset counts as chosen only while both still match.
- Extend (`extend` in the trim request, `MAX_EXTEND_MS` = 5 min): with the switch on, the end may run past the video's end; the result holds the last frame and is silent there. Needs an end time. Multi-format export passes it on to every trim.
- Optional filter (the old "look"; `videoLook.ts`, `LookPanel.vue`; backend `VideoEditRules.Look`): brightness −100…100 %, contrast 0…200 %, colour 0…300 %, warmth −100…100 % (cool to warm), blur 0…20, black & white / sepia (not both), dark corners, sharpen. Applied after crop, turn and resize. The presets are picked from tiles showing the video's thumbnail with each filter. The preview is a CSS filter plus layers for warmth and dark corners (close, not exact; no sharpening). A plain look is not sent. Multi-format export applies it to every trim.
- Optional effect and transition (`videoEffects.ts`, `ClipEffectsPanel.vue`; backend `VideoEditRules.EFFECTS` / `Fade`): one effect — `ZOOM_IN` / `ZOOM_OUT` (slow 20 % push-in / pull-back over the clip), `GLITCH`, `OLD_FILM` — and a fade in / fade out of 0–5 s each through black or white (together not longer than the clip; picture, sound and any added audio fade together). Filter order on the server: crop, turn, resize, filter, effect, held end, zoom, fade. The preview shows the zooms (not while cropping), the fades and old film (with its dark corners); not the glitch. None/zero is not sent. Multi-format export carries both.
- Optional freeze frame (`ClipFreeze` in `videoEdit.ts`, `FreezeFramePanel.vue`; backend `VideoEditRules.Freeze`, `MediaTools.freeze`): one frame held for 0.5–10 s at a point inside the clip (on the trimmed clip's timeline, from its start), the sound pausing (silence) for as long; rendered after the trim pass and before the added-audio pass, so added audio is timed on the longer clip. Undoable, in drafts, carried by multi-format export.
- Save as GIF or picture (`FrameExportPanel.vue`; `POST /edits/gif`, `/edits/still`): a looping GIF of the trim range (at most `MAX_GIF_MS` 15 s; 320/480/640 px wide, 12 fps, own palette) or a JPG of the frame at the playhead. Results of type `GIF` / `STILL` are download-only like `EXTRACT` (`isDownloadOnly`): shown as an image with Download, not selectable for bulk actions.
- More optional parts (`clipExtras.ts`; backend `VideoEditRules.BlurBox / SpeedRange / Pip / Cards`), all undoable, kept in drafts and carried by multi-format export:
  - Blurred areas (`BlurAreasPanel.vue`): up to `MAX_BLURS` (5) boxes in the original picture's pixels, blurred for the whole clip, applied first (before the crop). The box being edited is drawn by `CropOverlay` with `variant="blur"` (the crop box hides meanwhile); the rest by `ClipExtrasLayer` (CSS backdrop blur — the preview).
  - Slow motion / speed up (`SpeedRampPanel.vue`): one part (on the trimmed clip's timeline, ≥ 0.5 s) at 0.25/0.5/0.75/1.5/2/4×, the sound keeping its pitch; not previewed live. A freeze frame is moved along by it on the server (`rampedMs`).
  - Picture in picture (`PipPanel.vue`): another stored video (not a link or trashed) in a corner, 15–50 % of the width, muted; it starts with the clip and disappears if it ends first. Previewed as its thumbnail.
  - Intro & outro cards (`CardsPanel.vue`): text (≤ 120 chars) on a colour, 1–6 s each, optional uploaded logo above the text, fading in and out, silent; joined on last (after the added audio), at the clip's size.
  - Server order: blur → crop/turn/resize → filter/effect → held end → zoom → fade (one pass); then speed part, freeze, picture in picture, added audio, cards (each a pass on the result).
- Optional added audio (`trimAudio.ts`, `TrimAudioPanel.vue`): an uploaded file mixed into the trimmed result (volume 0–200 %, start, loop, duck) or used instead of its sound. The backend renders the trim, then the audio pass on the result (`audio` in the trim request); times are on the trimmed result's timeline. Multi-format export carries it on every trim.
- Multi-format export queues one trim per ticked preset, each with `centeredCrop` of that shape and the preset's size, using the current range.

**Cut out** (Trim tab, `shared/utils/cutOut.ts`, `CutOutPanel.vue`; backend `VideoEditRules.validateCuts`, `POST /edits/cut`)

- Remove pauses (`pauseCuts` in `transcriptCuts.ts`): from the transcript, cuts every pause longer than 0.7/1/1.5/2 s, keeping `PAUSE_KEEP_MS` (200) next to speech; never cuts speech, keeps the longest pauses when there are more than 20, skips a cut that would leave a piece under `MIN_KEPT_MS`. Replaces the current cuts (undoable).
- Up to `MAX_CUTS` (20) ranges taken out of the video (ms); overlapping or touching ranges are merged. What is left must not be empty, and no piece around or between cuts may be shorter than `MIN_KEPT_MS` (500). The result is a single TRIM-style clip (replace the original or add as a new video); picture and sound are cut together. The preview skips cut ranges while playing.

**Split**

- 1 to `MAX_SEGMENTS` (20) segments, each a valid trim range; each segment becomes its own new video. Gaps are allowed (time left out is shown), overlaps are shown but valid. Segment order is the output order.
- Helpers: split at playhead (the segment the playhead is inside, not within 0.1 s of an edge), split evenly (N parts, each ≥ `MIN_TRIM_MS`, N ≤ 20), split every N seconds (a remainder shorter than `MIN_TRIM_MS` folds into the previous part), and moving a boundary shared by two touching segments (both stay ≥ `MIN_TRIM_MS`).
- Split by sentences (`shared/utils/transcriptCuts.ts`, needs READ on `transcripts`): uses the video's transcript (its own spoken language first, else the first one) and cuts midway through the pauses between lines — one part per line, or lines grouped evenly by count when there are more than 20; a cut that would leave a part under `MIN_TRIM_MS` is skipped. The Trim tab uses the same lines to warn when the start or end cuts through a line, and **Fit to sentences** moves that edge out to the line (with up to `LINE_PAD_MS` (150) of room, never into the next line).

**Audio** (`useAudioEdit`, `shared/utils/audioEdit.ts`)

- Source is the video's own sound or an uploaded replacement. The sound is a list of clips (pieces of the source placed on the video's timeline): at most `MAX_AUDIO_CLIPS` (50), pieces at least `MIN_CLIP_MS` (50), none starting at or after the video's end. An untouched single clip needn't be sent (`isIdentityClips`).
- Speed for learners: one-click `LEARNER_SPEEDS` (1×, 0.85×, 0.75×, 0.5×) set the speed and put the pitch back to normal (the picture follows the speed; the voice keeps its pitch).
- Other settings: muted ranges (overlaps merge), volume 0–400 %, fade in/out (together not longer than the output), normalize, denoise `OFF|LIGHT|STRONG`, enhance voice, background music (own volume, start, loop, "duck" under speech), speed 0.5–2×, pitch ±12 semitones, balance, channels `KEEP|MONO|STEREO`.
- Cannot render when: nothing changed, an upload is chosen but missing, or every clip is deleted with no music (silence is Volume 0 %, not deleting clips).
- The live preview only plays volume (up to 100 %) and muted ranges; everything else is audible only in the rendered result.

**Text & overlays** (`useOverlayEdit`)

- Layers are `TEXT` or `IMAGE`, drawn in list order (later on top), with position (centre kept within 0.1–0.9 × 0.08–0.92 of the frame), size, colour, background, opacity, animation, start/end time. Layers snap to centres and edges (`layerSnap`, tolerance 0.015). Templates and recipes copy layers with fresh ids and clamp times into the video.
- Subtitles (`burnedCaptions.ts`, `CaptionsSection.vue`, `useCaptionSource`; backend `OverlayRules.Captions` + `CaptionRules`): burn one of the video's transcripts into the picture, optionally with a second transcript (a translation) as a smaller line under each (paired by overlap, same rule both sides). Style `CLASSIC|BOX|YELLOW`, `BOTTOM|TOP`, size 3–10 % of the height. Part of the overlay request (`captions`); a render may be subtitles only. Rendered as an ASS file through ffmpeg's `subtitles` filter, so the worker's ffmpeg needs libass. Needs READ on `transcripts`; the transcripts must be this video's. The live preview shows the current line on the Text tab. Undoable and kept in drafts. (Not to be confused with `captions.ts`, the learner player's caption helpers.)

**Join (merge)** (`shared/utils/mergeVideos.ts`)

- 2–`MAX_MERGE_VIDEOS` (10) videos, total ≤ `MAX_MERGE_SECONDS` (3 h). Only stored files not in the trash: links (YouTube/Vimeo/Facebook/URL) and deleted videos are blocked with a reason. Output resolution and a transition (`NONE` straight cut, `FADE` through black, `FADE_WHITE` through white, `DISSOLVE`/`WIPE`/`SLIDE` playing the videos over each other for ~0.6 s per joint, so the result is shorter by that much — `joinedSeconds`, `MergeRules.totalMs`); the result is a new, hidden video.

**Video from audio** (`from-audio.vue`, `shared/utils/audioVideo.ts`)

- Up to `MAX_BATCH` (20) audio files, each becoming its own video; optional cover pictures (JPG/PNG/WebP ≤ 5 MB) as a slideshow of at most `MAX_SLIDES` (30) with starts at least 1 s apart; background colour, resolution (360p–1080p), waveform style, and optional loudness/noise clean-up. Submit is blocked while files upload, a title is missing, or the slideshow is invalid (`submitBlocker`). Look settings are remembered per user.

**Undo, drafts and recipes**

- Batch apply (Videos list › **Apply a recipe…**, `recipeBatch.ts`): per selected video, the recipe's picture settings become one whole-video trim (crop centred for that video's size) and its layers one overlay render (times clamped into the video); sound settings are editor-only. Links, trashed videos, unknown sizes and videos too short for the fades are skipped with a reason. Results wait in each video's editor.
- Results › **Add as new videos** can also put the new videos into a collection; split parts are titled after what is said in them when the transcript is known (`spokenTitle`), else "— Part N". The editor's Results header links to **All edits** (`/processing-jobs?type=EDIT`).
- History keeps up to `HISTORY_LIMIT` (100) snapshots; unrendered edits are saved as a per-video draft in the browser and offered once on return. Recipes (`editRecipe.ts`) keep only video-independent settings (crop shape/size, turn/flip, filter, effect, fades, sound settings, layers) — never the trim range, split points, audio clips, mutes or an uploaded replacement.

### Video editor scenarios

The flows to keep working are written as step-by-step manual test cases in `docs/editor-scenarios.md`, grouped by tab (Trim, Split, Audio, Text, Join, Results, around the editor, Video from audio). There is no browser test setup, so walk through the ones touching your change by hand. Update that file when a flow or rule changes.

## Theme

Primary is a custom "blueprint" blue palette defined in `main.css` (`@theme static`) and registered in `app.config.ts` (`ui.colors`); `neutral` is `ink`, and there is an extra `cancelled` colour alias that must be listed in `nuxt.config.ts` `ui.theme.colors` (that list replaces the defaults, so all six defaults are repeated there).
