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

**Permissions.** `useAuth().can(module, 'READ' | 'WRITE' | 'APPROVE')` gates UI (admins pass everything). Routes are guarded by `auth.global.ts` and `admin.ts`; learners with no permissions land on `/learn`. When adding a button for a backend action, find which of READ/WRITE/APPROVE the backend requires (noted at the top of the composables, e.g. `useProcessingJobs.ts`: cancel = APPROVE).

**`shared/utils/` holds the logic, components hold the UI.** Pure functions (validation, arithmetic, sanitising storage data) live in `shared/utils/*.ts` with a `.spec.ts` next to them, imported as `#shared/utils/...`. Components and composables only wire them to state. New behaviour should follow this: write the pure function and test, then use it from the component. Tests run in jsdom (`vitest.config.ts`); note `import.meta.url` isn't a `file:` URL there, so use `process.cwd()` for file paths (see `tabAccent.spec.ts`).

**Auto-imports clash.** Every exported function/const in `shared/utils` and `app/composables` is auto-imported by name. `shared/utils/codebase.spec.ts` fails if two files export the same name, and also if an icon-only button lacks an `aria-label` or `title`.

**Browser-side persistence.** Per-user conveniences (export presets, overlay templates, edit recipes, editor drafts, last-used tab) are kept in `localStorage` through `NamedEntry` lists (`shared/utils/namedList.ts`: unique names, cap of 30). Always wrap storage access in try/catch. Export presets and a few settings also sync to the user's server-side preferences via `useLearnerPrefs`.

### The video editor (the largest feature)

`app/pages/videos/[id]/editor.vue` mounts `app/components/VideoClipEditor.vue` (very large). Its tabs — Trim, Split, Audio (`AudioEditPanel`), Text (`OverlayPanel`), Join (`JoinPanel`) — each build a request for a backend job (`useVideoEdits`: `startTrim`, `startSplit`, `startAudio`, `startOverlay`, …). Things that span files:

- **Jobs and results.** Starting an edit queues a processing job; the editor polls `overview()` every 3 s while any job is active. Finished jobs appear as clips under "Results", which can be promoted (`Replace original`, which keeps the old file under Versions, or `Add as new video`) or discarded. The single-edit buttons are disabled while any job is active (`busy`), but the server accepts up to `MAX_QUEUED_EDITS` (3) queued/running edits per video (409 beyond that; they run one at a time), which multi-format export uses.
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
- Multi-format export queues one trim per ticked preset, each with `centeredCrop` of that shape and the preset's size, using the current range.

**Split**

- 1 to `MAX_SEGMENTS` (20) segments, each a valid trim range; each segment becomes its own new video. Gaps are allowed (time left out is shown), overlaps are shown but valid. Segment order is the output order.
- Helpers: split at playhead (the segment the playhead is inside, not within 0.1 s of an edge), split evenly (N parts, each ≥ `MIN_TRIM_MS`, N ≤ 20), split every N seconds (a remainder shorter than `MIN_TRIM_MS` folds into the previous part), and moving a boundary shared by two touching segments (both stay ≥ `MIN_TRIM_MS`).

**Audio** (`useAudioEdit`, `shared/utils/audioEdit.ts`)

- Source is the video's own sound or an uploaded replacement. The sound is a list of clips (pieces of the source placed on the video's timeline): at most `MAX_AUDIO_CLIPS` (50), pieces at least `MIN_CLIP_MS` (50), none starting at or after the video's end. An untouched single clip needn't be sent (`isIdentityClips`).
- Other settings: muted ranges (overlaps merge), volume 0–400 %, fade in/out (together not longer than the output), normalize, denoise `OFF|LIGHT|STRONG`, enhance voice, background music (own volume, start, loop, "duck" under speech), speed 0.5–2×, pitch ±12 semitones, balance, channels `KEEP|MONO|STEREO`.
- Cannot render when: nothing changed, an upload is chosen but missing, or every clip is deleted with no music (silence is Volume 0 %, not deleting clips).
- The live preview only plays volume (up to 100 %) and muted ranges; everything else is audible only in the rendered result.

**Text & overlays** (`useOverlayEdit`)

- Layers are `TEXT` or `IMAGE`, drawn in list order (later on top), with position (centre kept within 0.1–0.9 × 0.08–0.92 of the frame), size, colour, background, opacity, animation, start/end time. Layers snap to centres and edges (`layerSnap`, tolerance 0.015). Templates and recipes copy layers with fresh ids and clamp times into the video.

**Join (merge)** (`shared/utils/mergeVideos.ts`)

- 2–`MAX_MERGE_VIDEOS` (10) videos, total ≤ `MAX_MERGE_SECONDS` (3 h). Only stored files not in the trash: links (YouTube/Vimeo/Facebook/URL) and deleted videos are blocked with a reason. Output resolution and a transition (`NONE` straight cut, `FADE` through black); the result is a new, hidden video.

**Video from audio** (`from-audio.vue`, `shared/utils/audioVideo.ts`)

- Up to `MAX_BATCH` (20) audio files, each becoming its own video; optional cover pictures (JPG/PNG/WebP ≤ 5 MB) as a slideshow of at most `MAX_SLIDES` (30) with starts at least 1 s apart; background colour, resolution (360p–1080p), waveform style, and optional loudness/noise clean-up. Submit is blocked while files upload, a title is missing, or the slideshow is invalid (`submitBlocker`). Look settings are remembered per user.

**Undo, drafts and recipes**

- History keeps up to `HISTORY_LIMIT` (100) snapshots; unrendered edits are saved as a per-video draft in the browser and offered once on return. Recipes (`editRecipe.ts`) keep only video-independent settings (crop shape/size, sound settings, layers) — never the trim range, split points, audio clips, mutes or an uploaded replacement.

### Video editor scenarios

The flows to keep working are written as step-by-step manual test cases in `docs/editor-scenarios.md`, grouped by tab (Trim, Split, Audio, Text, Join, Results, around the editor, Video from audio). There is no browser test setup, so walk through the ones touching your change by hand. Update that file when a flow or rule changes.

## Theme

Primary is a custom "blueprint" blue palette defined in `main.css` (`@theme static`) and registered in `app.config.ts` (`ui.colors`); `neutral` is `ink`, and there is an extra `cancelled` colour alias that must be listed in `nuxt.config.ts` `ui.theme.colors` (that list replaces the defaults, so all six defaults are repeated there).
