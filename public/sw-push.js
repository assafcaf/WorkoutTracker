// Push half of the service worker. vite.config.ts pulls this in with workbox.importScripts,
// so it is a classic script: no imports, no module syntax.

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    const parsed = event.data ? event.data.json() : null
    if (parsed && typeof parsed === 'object') payload = parsed
  } catch {
    // An unparseable payload still shows a notification: iOS revokes a subscription whose
    // pushes show nothing.
  }
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Workout Tracker'
  const options = {
    body: payload.body,
    tag: payload.tag,
    data: { url: payload.url },
    icon: 'icons/icon-192.png',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data
  const url = (data && data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      if (windows.length > 0) return windows[0].focus()
      return self.clients.openWindow(url)
    }),
  )
})
