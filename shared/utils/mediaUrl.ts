// The backend hands out stored files (videos, thumbnails, results) as signed links
// that expire, and re-signs them now and then — so the same file can arrive with a
// different query string. Anything that asks "is this the same file?" (the player's
// key, the editor's reset, a saved draft) compares these keys instead of whole links.

/** The link without its query string or fragment: the same for every signed copy of one file. */
export function mediaKey(url: string | null | undefined): string {
  if (!url) return ''
  return url.split(/[?#]/, 1)[0]!
}

/** Whether a link is a signed, expiring one (an S3-style presigned link). */
export function isSignedUrl(url: string | null | undefined): boolean {
  return !!url && /[?&]X-Amz-(Signature|Expires)=/.test(url)
}
