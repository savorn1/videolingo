// The page-wide animation speed (see shared/utils/animationSpeed.ts). One value shared by every
// component; it is written to the `--anim-speed` CSS variable, which the animations divide
// their durations by. Kept in this browser; storage can be blocked, then it just resets.

import { sanitizeAnimationSpeed, type AnimationSpeed } from '#shared/utils/animationSpeed'

const STORAGE_KEY = 'videolingo:animation-speed'

export function useAnimationSpeed() {
  const speed = useState<AnimationSpeed>('animation-speed', () => 1)

  function apply(value: AnimationSpeed) {
    if (import.meta.client) document.documentElement.style.setProperty('--anim-speed', String(value))
  }

  onMounted(() => {
    try {
      speed.value = sanitizeAnimationSpeed(localStorage.getItem(STORAGE_KEY))
    } catch {
      // Storage blocked: the normal speed is fine.
    }
    apply(speed.value)
  })

  function set(value: AnimationSpeed) {
    speed.value = value
    apply(value)
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // Not kept for next time; harmless.
    }
  }

  return { speed, set }
}
