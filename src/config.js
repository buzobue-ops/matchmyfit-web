// ─── n8n backend endpoints (proxied through Express) ─────────────────────
// In sviluppo: stringa vuota → Vite proxy → localhost:3001
// In produzione: URL completo del backend Railway (es. https://matchmyfit-api.up.railway.app)
const API_BASE = import.meta.env.VITE_API_URL || ''

export const API = {
  checkAccount:  `${API_BASE}/api/check-account`,
  onboarding:    `${API_BASE}/api/onboarding`,
  resume:        `${API_BASE}/api/resume`,
  search:        `${API_BASE}/api/search`,
  profileUpdate: `${API_BASE}/api/profile-update`,
  outfit:        `${API_BASE}/api/outfit`,
}

// ─── Google OAuth ─────────────────────────────────────────────────────────
// Create a "Web application" OAuth 2.0 Client ID in Google Cloud Console
// and paste it here (or set VITE_GOOGLE_CLIENT_ID in a .env file).
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com'

// ─── Apple Sign In ────────────────────────────────────────────────────────
// Create a Services ID in Apple Developer → Certificates, IDs & Profiles.
// The Return URL must be the exact origin of this site.
export const APPLE_SERVICE_ID =
  import.meta.env.VITE_APPLE_SERVICE_ID || 'com.matchmyfit.web'

export const APPLE_REDIRECT_URI =
  import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin

// ─── Google Drive folder (same as iOS app) ───────────────────────────────
export const GOOGLE_DRIVE_FOLDER_ID = '1VoVHO33P0uBW5Sl7xq2bbUwMt0JKi4tQ'
