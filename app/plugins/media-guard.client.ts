// No right-click menu ("Save video as…", "Copy video address") on any video or
// audio in the app. A deterrent only — the real protection is that the backend
// hands out signed links that expire (MediaUrls on the server), so a link copied
// out of the developer tools stops working.
export default defineNuxtPlugin(() => {
  document.addEventListener('contextmenu', (e) => {
    const el = e.target as HTMLElement | null
    if (el?.closest?.('video, audio')) e.preventDefault()
  })
})
