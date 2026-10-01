// The Join tab's videos in progress: whole videos from the library, in the order
// they will play. Lives in the editor, not the panel, so undo/redo and the saved
// draft cover it like the other tabs. Joining itself is the existing merge
// dialog (MergeVideosModal → POST /api/admin/videos/merge), which makes a new,
// disabled video from them.

import type { Video } from '~/composables/useVideos'
import { MAX_MERGE_VIDEOS, blockedReason, type MergeItem } from '#shared/utils/mergeVideos'
import { moveItem } from '#shared/utils/reorder'

export interface JoinClip extends MergeItem {
  videoUrl: string | null
  width: number | null
  height: number | null
}

export function joinClipFrom(v: Pick<Video, 'id' | 'title' | 'thumbnailUrl' | 'videoUrl' | 'durationSeconds' | 'width' | 'height' | 'deleted' | 'storageKey' | 'source'>): JoinClip {
  return {
    id: v.id,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    videoUrl: v.videoUrl,
    durationSeconds: v.durationSeconds,
    width: v.width,
    height: v.height,
    blocked: blockedReason(v)
  }
}

export function useJoinEdit(video: () => Video) {
  const state = reactive({ clips: [joinClipFrom(video())] as JoinClip[] })

  function reset() {
    state.clips = [joinClipFrom(video())]
  }

  /** Puts a fresh copy of the edited video's own details in (its title/duration may have loaded late). */
  function refreshOwn() {
    const i = state.clips.findIndex((c) => c.id === video().id)
    if (i >= 0) state.clips[i] = joinClipFrom(video())
  }

  function add(v: JoinClip) {
    if (state.clips.length >= MAX_MERGE_VIDEOS || state.clips.some((c) => c.id === v.id)) return false
    state.clips.push({ ...v })
    return true
  }

  function move(from: number, to: number) {
    state.clips = moveItem(state.clips, from, to)
  }

  return { state, reset, refreshOwn, add, move }
}

export type JoinEdit = ReturnType<typeof useJoinEdit>

/** Videos picked on other pages ("Add to a join"), waiting to be added in the editor. */
export function useJoinQueue() {
  return useState<JoinClip[]>('join-queue', () => [])
}
