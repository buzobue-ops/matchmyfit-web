// ─── Browser Notification Service ────────────────────────────────────────────
// Fires a native browser notification when a search result arrives.
// Works when the tab is in background. No push/service-worker needed.

export function notificationsSupported() {
  return 'Notification' in window
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notify(title, body, options = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  // Don't notify if the tab is currently focused
  if (document.visibilityState === 'visible') return
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })
  } catch {
    // Some browsers block Notification in certain contexts — ignore
  }
}

export function notifySearchComplete(productName) {
  notify(
    '✅ Analisi completata',
    productName ? `Risultato pronto per: ${productName}` : 'Il tuo risultato MatchMyFit è pronto!',
  )
}
