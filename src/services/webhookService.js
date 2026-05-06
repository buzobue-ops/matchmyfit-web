// Mirrors WebhookService.swift – all network calls proxied through Express.
import { API, GOOGLE_DRIVE_FOLDER_ID } from '../config.js'
import {
  getResumeUrl,
  setResumeUrl,
  getPhotoFolderName,
  setPhotoFolderName,
  setLinkStepResumeUrl,
  clearSession,
  updateSearchResult,
  loadSearchHistory,
} from './storageService.js'

// ─── Helpers ──────────────────────────────────────────────────────────────

async function postJSON(url, body, timeoutMs = 30000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      const e = new Error('Request timed out. Check your connection and try again.')
      e.code = 'TIMEOUT'
      throw e
    }
    throw err
  }
}

async function parseResponse(res) {
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers }
}

function extractResumeUrl(json) {
  return json?.resumeUrl || null
}

// ─── sendToResumeUrlOrMain ────────────────────────────────────────────────

async function sendToResumeUrlOrMain(payload, timeoutMs = 60000) {
  const resumeUrl = getResumeUrl()
  if (resumeUrl) {
    console.log('[webhook] Using resumeUrl:', resumeUrl)
    const encoded = encodeURIComponent(resumeUrl)
    const res = await postJSON(`${API.resume}?resumeUrl=${encoded}`, payload, timeoutMs)
    const { status, json } = await parseResponse(res)
    // 404 on resumeUrl = Wait node already consumed, treat as success
    if (status === 404) return { json: null }
    if (status === 409) throw Object.assign(new Error('User already exists'), { code: 409, json })
    if (status >= 400) throw new Error(`Request failed with status ${status}`)
    return { json }
  } else {
    console.log('[webhook] Using main onboarding webhook')
    const res = await postJSON(API.onboarding, payload, timeoutMs)
    const { status, json } = await parseResponse(res)
    if (status === 409) throw Object.assign(new Error('User already exists'), { code: 409, json })
    if (status >= 400) throw new Error(`Request failed with status ${status}`)
    return { json }
  }
}

// ─── Account check (login) ────────────────────────────────────────────────

export async function checkAccountAndFetchProfile({ authProvider, providerUserId, email }) {
  const res = await postJSON(API.checkAccount, {
    authProvider,
    providerUserId,
    email,
    timestamp: new Date().toISOString(),
  }, 15000)

  const { status, json } = await parseResponse(res)
  if (status >= 400 || !json) return null

  const exists =
    typeof json.exists === 'boolean' ? json.exists : String(json.exists).toLowerCase() === 'true'
  if (!exists) return null

  // step can be int, string int, or "link"
  let onboardingStep = null
  if (json.step !== undefined) {
    const s = json.step
    if (typeof s === 'number') onboardingStep = s
    else if (String(s).toLowerCase() === 'link') onboardingStep = 2
    else onboardingStep = parseInt(s, 10) || null
  }

  const userValue = json.user
  let profile = null

  if (userValue && typeof userValue === 'object') {
    profile = { ...userValue }
  } else if (typeof userValue === 'string') {
    profile = { id: providerUserId, username: userValue, email, authProvider }
  }

  if (profile && onboardingStep !== null) profile.onboardingStep = onboardingStep
  return profile
}

// ─── Onboarding Step 1: username ──────────────────────────────────────────

export async function sendUsernameStep(userId, username) {
  const payload = {
    step: 'username',
    userId,
    username,
    timestamp: new Date().toISOString(),
  }

  // Fire-and-forget with short timeout; capture resumeUrl if it arrives quickly
  try {
    const res = await postJSON(API.onboarding, payload, 8000)
    const { json } = await parseResponse(res)
    const ru = extractResumeUrl(json)
    if (ru) setResumeUrl(ru)
  } catch {
    // Timeout is OK – proceed anyway
  }
}

// ─── Onboarding Step 2: measurements ─────────────────────────────────────

export async function sendMeasurementsStep(userId, { height, chest, waist, hips, shoulders, inseam }) {
  const measurements = {}
  if (height != null) measurements.height = height
  if (chest != null) measurements.chest = chest
  if (waist != null) measurements.waist = waist
  if (hips != null) measurements.hips = hips
  if (shoulders != null) measurements.shoulders = shoulders
  if (inseam != null) measurements.inseam = inseam

  const payload = {
    step: 'measurements',
    userId,
    measurements,
    timestamp: new Date().toISOString(),
    source: 'web_measurements_step',
  }

  const { json } = await sendToResumeUrlOrMain(payload, 60000)

  // Capture photoFolderName from response body
  if (json?.photoFolderName) setPhotoFolderName(json.photoFolderName)
  if (json?.photoFolderId) setPhotoFolderName(json.photoFolderId)

  const ru = extractResumeUrl(json)
  if (ru) setResumeUrl(ru)
}

// ─── Onboarding Step 3: photo (base64 JSON, same as iOS) ─────────────────

export async function sendPhotoStep(userId, imageBase64) {
  const payload = {
    step: 'photo',
    userId,
    timestamp: new Date().toISOString(),
    imageSizeBytes: Math.round((imageBase64.length * 3) / 4),
    imageBase64,
  }

  const folder = getPhotoFolderName()
  if (folder) payload.photoFolder = folder

  const { json } = await sendToResumeUrlOrMain(payload, 90000)

  const ru = extractResumeUrl(json)
  if (ru) setResumeUrl(ru)
}

// ─── Onboarding Step 4: complete ──────────────────────────────────────────

export async function sendCompleteProfile(user) {
  const profileData = {
    userId: user.id,
    username: user.username,
    email: user.email || '',
    displayName: user.displayName || '',
    authProvider: user.authProvider,
    createdAt: user.createdAt || new Date().toISOString(),
    height: user.height,
    bodySizes: user.bodySizes,
    googleDriveFolderId: GOOGLE_DRIVE_FOLDER_ID,
  }

  const payload = {
    step: 'complete',
    userId: user.id,
    profile: profileData,
    googleDriveFolderId: GOOGLE_DRIVE_FOLDER_ID,
    timestamp: new Date().toISOString(),
  }

  const { json } = await sendToResumeUrlOrMain(payload, 60000)

  const nextResumeUrl = extractResumeUrl(json)
  if (nextResumeUrl) setLinkStepResumeUrl(nextResumeUrl)

  setResumeUrl(null)
}

// ─── Search: send link, receive text + image ──────────────────────────────

export async function sendLinkStep(link, userId, searchId, { onUpdate } = {}) {
  const payload = {
    step: 'link',
    link,
    userId,
    searchId,
    timestamp: new Date().toISOString(),
  }

  const res = await postJSON(API.search, payload, 300000) // 5 min, same as iOS
  const { status, json } = await parseResponse(res)

  if (status >= 400) {
    const isTimeout = status === 504 || status === 524 || status === 502
    if (isTimeout) {
      const e = new Error('Server timeout')
      e.code = 'TIMEOUT'
      throw e
    }
    throw new Error(`Search failed (${status})`)
  }

  if (json) {
    applyResponseToResult(searchId, json, onUpdate)
  }
}

// ─── Apply n8n response to stored result ──────────────────────────────────

function decodeURLText(raw) {
  if (typeof raw !== 'string') return null
  try { return decodeURIComponent(raw.replace(/\+/g, ' ')) } catch { return raw }
}

function decodeBase64Image(raw) {
  if (typeof raw !== 'string') return null
  // Strip data URL prefix if present
  return raw.replace(/^data:image\/[^;]+;base64,/, '')
}

export function applyResponseToResult(searchId, json, onUpdate) {
  if (!json) return

  const text = decodeURLText(json.text ?? json.message)

  let imageBase64 = null
  const imageRaw = json.imageBase64 ?? json.image
  if (typeof imageRaw === 'string' && !imageRaw.startsWith('http')) {
    imageBase64 = decodeBase64Image(imageRaw)
  }

  const productName = decodeURLText(json.productName ?? json.product_name)

  const history = loadSearchHistory()
  const existing = history.find(r => r.id === searchId)
  if (!existing) return

  const updated = {
    ...existing,
    ...(text ? { responseText: text } : {}),
    ...(imageBase64 ? { responseImageBase64: imageBase64 } : {}),
    ...(productName ? { productName } : {}),
    status: 'completed',
  }

  updateSearchResult(updated)
  onUpdate?.(updated)
}

export function resetOnboardingSession() {
  clearSession()
}
