// Mirrors the role of UserDefaults + DataPersistenceManager in the iOS app.
// localStorage is used as the local cache; MySQL (via PHP API su Aruba) is the
// source of truth — synced on every save/update and loaded fresh on login.

const API_BASE = import.meta.env.VITE_API_URL || '/matchmyfit'

// Fire-and-forget: write a search result to the server DB
function _serverSave(result) {
  const userId = _currentUserId()
  if (!userId || !result.id) return
  fetch(`${API_BASE}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...result, userId }),
  }).catch(() => { /* offline — local copy is safe */ })
}

// Fire-and-forget: delete one search from the server DB
function _serverDelete(id) {
  fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' })
    .catch(() => { /* ignore */ })
}

// Fire-and-forget: delete all searches for the current user from server DB
function _serverDeleteAll() {
  const userId = _currentUserId()
  if (!userId) return
  fetch(`${API_BASE}/api/history?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' })
    .catch(() => { /* ignore */ })
}

// Read the current userId from localStorage without importing saveUser
function _currentUserId() {
  try {
    const raw = localStorage.getItem('mmf_user')
    return raw ? JSON.parse(raw)?.id : null
  } catch { return null }
}

const KEYS = {
  user: 'mmf_user',
  resumeUrl: 'mmf_resume_url',
  photoFolderName: 'mmf_photo_folder_name',
  linkStepResumeUrl: 'mmf_link_step_resume_url',
  searchHistory: 'mmf_search_history',
  outfitHistory: 'mmf_outfit_history',
  cart: 'mmf_cart',
}

// ─── User session ─────────────────────────────────────────────────────────

function photoCacheKey(userId) {
  return `mmf_photo_b64_${userId}`
}

/** Foto profilo in cache locale (sopravvive al re-login nativo). */
export function saveUserPhoto(userId, base64) {
  if (!userId || !base64) return
  try {
    localStorage.setItem(photoCacheKey(userId), stripPhotoBase64ForCache(base64))
  } catch { /* quota */ }
}

export function loadUserPhoto(userId) {
  if (!userId) return null
  try {
    return localStorage.getItem(photoCacheKey(userId)) || null
  } catch {
    return null
  }
}

export function clearUserPhoto(userId) {
  if (!userId) return
  try { localStorage.removeItem(photoCacheKey(userId)) } catch { /* */ }
}

function stripPhotoBase64ForCache(raw) {
  return String(raw).replace(/^data:image\/[^;]+;base64,/, '')
}

export function saveUser(user) {
  try {
    // Photo goes to its own cache key…
    const b64 = user?.photoBase64 || user?.photo_base64
    if (user?.id && b64) saveUserPhoto(user.id, b64)
    // …and NEVER inside mmf_user: a multi-MB base64 in the user JSON
    // exceeded the localStorage quota and the uncaught QuotaExceededError
    // (thrown inside a setUser updater) blanked the whole app after
    // saving a profile photo. Persist a lean copy instead.
    const lean = { ...user }
    delete lean.photoBase64
    delete lean.photo_base64
    delete lean.imageBase64
    localStorage.setItem(KEYS.user, JSON.stringify(lean))
  } catch { /* quota exceeded / private mode — session survives in memory */ }
}

export function loadUser() {
  try {
    const raw = localStorage.getItem(KEYS.user)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearUser() {
  localStorage.removeItem(KEYS.user)
  clearSession()
}

// ─── Onboarding session (resumeUrl, photoFolder) ──────────────────────────

export function setResumeUrl(url) {
  if (url) localStorage.setItem(KEYS.resumeUrl, url)
  else localStorage.removeItem(KEYS.resumeUrl)
}

export function getResumeUrl() {
  return localStorage.getItem(KEYS.resumeUrl) || null
}

export function setPhotoFolderName(name) {
  if (name) localStorage.setItem(KEYS.photoFolderName, name)
  else localStorage.removeItem(KEYS.photoFolderName)
}

export function getPhotoFolderName() {
  return localStorage.getItem(KEYS.photoFolderName) || null
}

export function setLinkStepResumeUrl(url) {
  if (url) localStorage.setItem(KEYS.linkStepResumeUrl, url)
  else localStorage.removeItem(KEYS.linkStepResumeUrl)
}

export function getLinkStepResumeUrl() {
  return localStorage.getItem(KEYS.linkStepResumeUrl) || null
}

export function clearSession() {
  localStorage.removeItem(KEYS.resumeUrl)
  localStorage.removeItem(KEYS.photoFolderName)
  localStorage.removeItem(KEYS.linkStepResumeUrl)
}

// ─── Search history ───────────────────────────────────────────────────────

export function saveSearchResult(result) {
  const history = loadSearchHistory()
  const existing = history.findIndex(r => r.id === result.id)
  if (existing >= 0) history[existing] = result
  else history.unshift(result)
  localStorage.setItem(KEYS.searchHistory, JSON.stringify(history))
  _serverSave(result) // async sync — does not block
}

export function updateSearchResult(updated) {
  saveSearchResult(updated)
}

export function loadSearchHistory() {
  try {
    const raw = localStorage.getItem(KEYS.searchHistory)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearSearchHistory() {
  localStorage.removeItem(KEYS.searchHistory)
  _serverDeleteAll() // async sync
}

// Called once on login: fetches the user's full history from the server
// and merges it into localStorage (server wins for completed items).
export async function syncHistoryFromServer(userId) {
  if (!userId) return
  try {
    const res = await fetch(`${API_BASE}/api/history?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return
    const serverItems = await res.json()
    if (!Array.isArray(serverItems) || serverItems.length === 0) return

    // Merge: start from server list, then add local-only pending items
    const localHistory = loadSearchHistory()
    const serverIds = new Set(serverItems.map(r => r.id))
    const localOnlyPending = localHistory.filter(r => !serverIds.has(r.id) && r.status === 'pending')
    const merged = [...serverItems, ...localOnlyPending]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    localStorage.setItem(KEYS.searchHistory, JSON.stringify(merged))
  } catch { /* server unreachable — use local cache */ }
}

// ─── Outfit history ───────────────────────────────────────────────────────
// Each entry: { id, createdAt, imageUrl, links, prices, totalPrice, sizeAdvice }

export function saveOutfitToHistory(entry) {
  const history = loadOutfitHistory()
  const existing = history.findIndex(r => r.id === entry.id)
  if (existing >= 0) history[existing] = entry
  else history.unshift(entry)
  // Keep max 20 outfits
  localStorage.setItem(KEYS.outfitHistory, JSON.stringify(history.slice(0, 20)))
}

export function loadOutfitHistory() {
  try {
    const raw = localStorage.getItem(KEYS.outfitHistory)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function deleteOutfitFromHistory(id) {
  const history = loadOutfitHistory().filter(r => r.id !== id)
  localStorage.setItem(KEYS.outfitHistory, JSON.stringify(history))
}

// ─── Cart ─────────────────────────────────────────────────────────────────
// Each item: { id, name, link, price, source, addedAt }

export function loadCart() {
  try {
    const raw = localStorage.getItem(KEYS.cart)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addToCart(item) {
  const cart = loadCart()
  // Avoid duplicates by link
  if (cart.some(c => c.link === item.link)) return false
  cart.unshift({ ...item, addedAt: new Date().toISOString() })
  localStorage.setItem(KEYS.cart, JSON.stringify(cart))
  return true
}

export function removeFromCart(id) {
  const cart = loadCart().filter(c => c.id !== id)
  localStorage.setItem(KEYS.cart, JSON.stringify(cart))
}

export function updateCartItem(id, updates) {
  const cart = loadCart().map(c => c.id === id ? { ...c, ...updates } : c)
  localStorage.setItem(KEYS.cart, JSON.stringify(cart))
}

export function clearCart() {
  localStorage.removeItem(KEYS.cart)
}

export function isInCart(link) {
  return loadCart().some(c => c.link === link)
}
