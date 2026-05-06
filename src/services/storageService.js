// Mirrors the role of UserDefaults + DataPersistenceManager in the iOS app.
// All data lives in localStorage so it survives page reloads.

const KEYS = {
  user: 'mmf_user',
  resumeUrl: 'mmf_resume_url',
  photoFolderName: 'mmf_photo_folder_name',
  linkStepResumeUrl: 'mmf_link_step_resume_url',
  searchHistory: 'mmf_search_history',
}

// ─── User session ─────────────────────────────────────────────────────────

export function saveUser(user) {
  localStorage.setItem(KEYS.user, JSON.stringify(user))
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
}
