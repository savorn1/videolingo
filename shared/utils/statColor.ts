// The semantic colour scale every "number in a card with an icon chip"
// component shares (StatTile, KpiTile, SummaryTiles) — one definition, so a
// gradient tweak or a new colour updates all of them together instead of
// drifting apart.
export type StatColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

// A solid gradient block with a white icon reads as more "alive" than a
// flat tinted tile — each semantic colour gets its own two-stop gradient
// rather than a single flat shade, still drawn from the same design-token
// scale (primary/success/warning/error/info/neutral) so it stays consistent
// with the rest of the app's Blueprint palette instead of introducing new
// arbitrary hues.
export const STAT_GRADIENT_CLASSES: Record<StatColor, string> = {
  primary: 'bg-gradient-to-br from-primary-400 to-primary-600',
  success: 'bg-gradient-to-br from-success-400 to-success-600',
  warning: 'bg-gradient-to-br from-warning-400 to-warning-600',
  error: 'bg-gradient-to-br from-error-400 to-error-600',
  info: 'bg-gradient-to-br from-info-400 to-info-600',
  neutral: 'bg-gradient-to-br from-gray-400 to-gray-600'
}

// A plain `shadow-sm` under a coloured gradient chip looks like a grey smudge
// — tinting the shadow to the chip's own colour makes it read as that colour
// casting light, not just floating above the page. Kept a shade weaker than
// the gradient itself (/25, /20 for neutral) so it stays a shadow, not a glow.
export const STAT_SHADOW_CLASSES: Record<StatColor, string> = {
  primary: 'shadow-md shadow-primary-500/25',
  success: 'shadow-md shadow-success-500/25',
  warning: 'shadow-md shadow-warning-500/25',
  error: 'shadow-md shadow-error-500/25',
  info: 'shadow-md shadow-info-500/25',
  neutral: 'shadow-md shadow-gray-500/20'
}
