// Scrolling that respects the system's Reduce Motion setting (HIG Motion: "Make motion optional").
// CSS smooth scrolling follows the setting by itself; scrollTo / scrollIntoView with behavior 'smooth' doesn't.

/** 'smooth', or 'auto' (a jump) when the person asked for reduced motion or there's no window. */
export function scrollMotion(): ScrollBehavior {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  } catch {
    return 'auto'
  }
}
