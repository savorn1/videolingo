// Which videos are still being made (from audio, or by joining others), for the
// badge on the Videos list and the Dashboard. Reads the shared answer from
// useJobActivity; `onFinished` is told when videos stop being made.

export type { MakingInfo } from '~/composables/useJobActivity'

export function useMakingVideos(options: { onFinished?: (videoIds: number[]) => void } = {}) {
  const { making, refresh } = useJobActivity({ onVideosFinished: options.onFinished })
  return { making, refresh }
}
