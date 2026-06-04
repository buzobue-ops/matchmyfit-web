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

  // n8n sometimes wraps response in an array — unwrap it
  const data = Array.isArray(json) ? json[0] : json
  if (!data) return null

  // exists può essere bool, stringa "true"/"false", o assente (se l'utente esiste restituisce dati)
  let exists = false
  if (data.exists !== undefined) {
    exists = typeof data.exists === 'boolean' ? data.exists : String(data.exists).toLowerCase() === 'true'
  } else if (data.username || data.user) {
    // Il webhook ha restituito dati senza campo exists → l'utente esiste
    exists = true
  }
  if (!exists) return null

  // step can be int, string int, or "link"
  let onboardingStep = null
  if (data.step !== undefined) {
    const s = data.step
    if (typeof s === 'number') onboardingStep = s
    else if (String(s).toLowerCase() === 'link') onboardingStep = 2
    else onboardingStep = parseInt(s, 10) || null
  }

  const userValue = data.user
  let profile = null

  if (userValue && typeof userValue === 'object') {
    profile = { ...userValue }
  } else if (typeof userValue === 'string') {
    profile = { id: providerUserId, username: userValue, email, authProvider }
  }

  // Also accept flat response where username is at root level (no .user wrapper)
  if (!profile && data.username) {
    profile = { username: data.username, height: data.height, bodySizes: data.bodySizes }
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

// ─── Search: send link, receive text then photo (two-step Wait node) ─────────

export async function sendLinkStep(link, userId, searchId, { onUpdate } = {}) {
  const payload = {
    step: 'link',
    link,
    userId,
    searchId,
    timestamp: new Date().toISOString(),
  }

  // ── Step 1: send link → get taglia text + resumeUrl ──────────────────────
  const res = await postJSON(API.search, payload, 300000) // 5 min — AI processing can take 2-3 min
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

  const data = Array.isArray(json) ? json[0] : json
  console.log('[search] step1 response', JSON.stringify(data)?.slice(0, 300))

  if (!data) return

  // Show text result immediately (mark as partial so UI shows photo loading)
  const resumeUrl = data.resumeUrl || data.resume_url || data.waitUrl || data.wait_url || null
  applyResponseToResult(searchId, data, onUpdate, resumeUrl ? 'partial' : 'completed')

  if (!resumeUrl) return

  // ── Step 2: send to resumeUrl → get modified photo ────────────────────────
  // n8n needs a few seconds to register the Wait node after responding
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  try {
    let step2Data = null

    for (let attempt = 0; attempt < 5; attempt++) {
      // Wait before each attempt: 4s first, then 6s between retries
      await delay(attempt === 0 ? 4000 : 6000)

      const encoded = encodeURIComponent(resumeUrl)
      const res2 = await postJSON(`${API.resume}?resumeUrl=${encoded}`, { searchId }, 300000)
      const { status: s2, json: json2 } = await parseResponse(res2)

      console.log(`[search] step2 attempt ${attempt + 1} status=${s2}`, JSON.stringify(json2)?.slice(0, 200))

      if (s2 === 409) {
        // Execution not yet at Wait node — retry
        continue
      }

      if (s2 >= 400) break // real error, stop retrying

      const d2 = Array.isArray(json2) ? json2[0] : json2
      // Only accept step2Data if it contains actual result content (image/price).
      // Ignore n8n's "onReceived" acknowledgment {"message":"Workflow was started"}.
      const hasImage = d2 && (d2.imageUrl || d2.image_url || d2.imageBase64 || d2.image)
      const hasPrice = d2 && d2.price != null
      if (d2 && !d2.code && !d2.error && (hasImage || hasPrice)) {
        step2Data = d2
      }
      break
    }

    if (step2Data) {
      applyResponseToResult(searchId, step2Data, onUpdate, 'completed')
    } else {
      // Photo didn't arrive — mark completed with just the text
      const history = loadSearchHistory()
      const existing = history.find(r => r.id === searchId)
      if (existing) {
        updateSearchResult({ ...existing, status: 'completed' })
        onUpdate?.({ ...existing, status: 'completed' })
      }
    }
  } catch (err) {
    console.error('[search] photo step failed', err.message)
    const history = loadSearchHistory()
    const existing = history.find(r => r.id === searchId)
    if (existing) {
      updateSearchResult({ ...existing, status: 'completed' })
      onUpdate?.({ ...existing, status: 'completed' })
    }
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

function extractSizeFromText(text) {
  if (!text) return null
  const sizes = /\b(XS|S|M|L|XL|XXL|XXXL|\d{2}(?:\/\d{2})?)\b/g

  // 1. "Taglia M" / "Taglia 44" — Italian explicit
  const m1 = text.match(/taglia\s+([A-Z]{1,3}|\d{2}(?:\/\d{2})?)/i)
  if (m1) return 'Taglia ' + m1[1].toUpperCase()

  // 2. "recommend … M" / "suggest … L" / "your size is M" — near recommendation keyword
  const mRec = text.match(/(?:recommend(?:ed)?|suggest(?:ed)?|perfect fit|ideal|your size[^.]{0,20}is)[^.]{0,40}?\b(XS|S|M|L|XL|XXL|XXXL)\b/i)
  if (mRec) return mRec[1]

  // 3. "size: M" / "size M" at start of a word/sentence
  const mSize = text.match(/\bsize[:\s]+\b(XS|S|M|L|XL|XXL|XXXL)\b/i)
  if (mSize) return mSize[1]

  // 4. Fallback — last occurrence is usually the conclusion (more reliable than first)
  const all = [...text.matchAll(sizes)]
  if (all.length > 0) return all[all.length - 1][1]

  return null
}

export function applyResponseToResult(searchId, json, onUpdate, status = 'completed') {
  if (!json) return

  // n8n often returns an array — unwrap it
  const data = Array.isArray(json) ? json[0] : json
  if (!data) return

  console.log('[n8n response]', JSON.stringify(data).slice(0, 500))

  // Text: try every common field name n8n might use
  const rawText =
    data.text ?? data.message ?? data.output ?? data.recommendation ??
    data.taglia ?? data.size ?? data.result ?? data.risposta ?? null
  const text = decodeURLText(rawText)

  // Image: accept both base64 and URL
  const imageRaw =
    data.imageBase64 ?? data.image ?? data.imageUrl ?? data.image_url ??
    data.foto ?? data.photo ?? null

  let imageBase64 = null
  let imageUrl = null

  if (typeof imageRaw === 'string') {
    if (imageRaw.startsWith('http')) {
      imageUrl = imageRaw
    } else {
      imageBase64 = decodeBase64Image(imageRaw)
    }
  }

  const productName = decodeURLText(
    data.productName ?? data.product_name ?? data.nome ?? data.name ?? null
  )

  // Price: try common field names
  const rawPrice = data.price ?? data.prezzo ?? data.productPrice ?? data.product_price ?? null
  const productPrice = rawPrice != null ? parseFloat(rawPrice) || null : null

  // Recommended size: try common field names, then extract from text
  const rawSize = data.recommendedSize ?? data.taglia ?? data.size ?? data.taglia_consigliata ?? null
  const recommendedSize = rawSize ? String(rawSize) : extractSizeFromText(text)

  const history = loadSearchHistory()
  const existing = history.find(r => r.id === searchId)
  if (!existing) return

  const updated = {
    ...existing,
    ...(text             ? { responseText: text }               : {}),
    ...(imageBase64      ? { responseImageBase64: imageBase64 } : {}),
    ...(imageUrl         ? { responseImageUrl: imageUrl }       : {}),
    ...(productName      ? { productName }                      : {}),
    ...(productPrice     ? { productPrice }                     : {}),
    ...(recommendedSize  ? { recommendedSize }                  : {}),
    status,
  }

  updateSearchResult(updated)
  onUpdate?.(updated)
}

export function resetOnboardingSession() {
  clearSession()
}

// ─── Update profile (measurements and/or photo) post-onboarding ───────────

export async function sendProfileUpdate(userId, { measurements, imageBase64 }) {
  const payload = {
    userId,
    timestamp: new Date().toISOString(),
  }
  if (measurements) payload.measurements = measurements
  if (imageBase64) {
    payload.imageBase64 = imageBase64
    payload.imageSizeBytes = Math.round((imageBase64.length * 3) / 4)
  }
  // Calls n8n directly (CORS supported) — bypasses Railway proxy
  const res = await postJSON('https://buzobue.app.n8n.cloud/webhook/matchmyfit-profile-update', payload, 90000)
  const { status } = await parseResponse(res)
  if (status >= 400) throw new Error(`Update failed (${status})`)
}
