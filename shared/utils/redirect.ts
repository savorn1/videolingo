// Where to send someone after signing in (or when they open /login already signed in).

/**
 * Only ever an internal path. A `redirect` of "//evil.com", "/\evil.com" or
 * "https://evil.com" would otherwise turn the login page into an open redirect;
 * anything else that isn't a path falls back to the dashboard.
 */
export function safeRedirectTarget(raw: unknown): string {
  const target = Array.isArray(raw) ? raw[0] : raw
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/'
  // A signed-in person sent back to the login page would loop.
  if (target === '/login' || target.startsWith('/login?') || target.startsWith('/login/')) return '/'
  return target
}
