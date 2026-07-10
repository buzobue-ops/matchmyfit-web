import { loadUserPhoto } from '../services/storageService.js'

const API_BASE = import.meta.env.VITE_API_URL || '/matchmyfit'

export function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null
  let m = url.match(/[?&]id=([^&]+)/)
  if (m) return m[1]
  m = url.match(/\/file\/d\/([^/]+)/)
  if (m) return m[1]
  m = url.match(/\/d\/([^/]+)/)
  return m ? m[1] : null
}

function proxyDriveUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (!API_BASE) return url
  if (!url.startsWith('https://drive.google.com/')) return url
  return `${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`
}

function driveThumbnail(url, size = 'w800') {
  const id = extractDriveFileId(url)
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=${size}`
  return url
}

/** Estrae campi foto da oggetti n8n (flat o annidati). */
export function pickPhotoFields(source) {
  if (!source || typeof source !== 'object') return {}
  const nested = source.profile && typeof source.profile === 'object' ? source.profile : null
  const userObj = source.user && typeof source.user === 'object' ? source.user : null

  const url =
    source.photoUrl || source.photo_url ||
    source.profilePhotoUrl || source.profilePhoto ||
    source.mirrorPhotoUrl || source.mirror_photo_url ||
    source.fotoUrl || source.foto ||
    source.photoLink || source.photo ||
    source.imageUrl || source.image_url ||
    source.driveUrl || source.drive_url ||
    nested?.photoUrl || nested?.photo_url || nested?.foto ||
    nested?.imageUrl || nested?.mirrorPhotoUrl ||
    userObj?.photoUrl || userObj?.photo_url || userObj?.foto

  const b64 =
    source.photoBase64 || source.photo_base64 ||
    source.imageBase64 || source.image_base64 ||
    nested?.photoBase64 || nested?.imageBase64 ||
    userObj?.photoBase64 || userObj?.imageBase64

  const out = {}
  if (url && typeof url === 'string' && url.trim()) out.photoUrl = url.trim()
  if (b64) out.photoBase64 = stripPhotoBase64(b64)
  return out
}

/** Cerca foto in strutture n8n annidate o in array. */
export function deepPickPhotoFields(source, depth = 0) {
  if (!source || depth > 4) return {}
  const direct = pickPhotoFields(source)
  if (direct.photoUrl || direct.photoBase64) return direct

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = deepPickPhotoFields(item, depth + 1)
      if (found.photoUrl || found.photoBase64) return found
    }
    return {}
  }

  if (typeof source === 'object') {
    for (const value of Object.values(source)) {
      if (value && typeof value === 'object') {
        const found = deepPickPhotoFields(value, depth + 1)
        if (found.photoUrl || found.photoBase64) return found
      }
    }
  }
  return {}
}

/** Lista URL da provare in ordine (proxy → thumbnail diretto → originale). */
export function buildPhotoSrcCandidates(user) {
  if (!user) return []

  const merged = { ...user, ...pickPhotoFields(user) }
  const userId = merged.id
  const cached = userId ? loadUserPhoto(userId) : null
  if (cached) {
    return [`data:image/jpeg;base64,${stripPhotoBase64(cached)}`]
  }

  const raw = merged.photoBase64
  if (raw) {
    return [`data:image/jpeg;base64,${stripPhotoBase64(raw)}`]
  }

  const url = merged.photoUrl || merged.photo_url
  if (!url) return []

  const thumb = driveThumbnail(url)
  const candidates = []
  if (thumb) candidates.push(proxyDriveUrl(thumb))
  if (thumb && thumb !== url) candidates.push(thumb)
  candidates.push(proxyDriveUrl(url))
  if (!url.startsWith('https://drive.google.com/thumbnail')) candidates.push(url)

  return [...new Set(candidates.filter(Boolean))]
}

export function getUserPhotoSrc(user) {
  const candidates = buildPhotoSrcCandidates(user)
  return candidates[0] || null
}

export function getUserInitials(user) {
  return (user?.displayName || user?.username || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function stripPhotoBase64(raw) {
  if (!raw) return null
  return String(raw).replace(/^data:image\/[^;]+;base64,/, '')
}

// ─── Photo upload preprocessing ────────────────────────────────────────────
// Full-resolution phone photos (4-6 MB base64) blew n8n Cloud's memory and
// the localStorage quota. Every upload path must go through this: it applies
// EXIF orientation (baked into pixels by the canvas re-encode) and caps the
// longest side, returning a lean JPEG base64 without the data: prefix.

async function loadOrientedBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch { /* older Safari — fall through to <img> (which honors EXIF too) */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid image')) }
    img.src = url
  })
}

export async function resizePhotoFile(file, maxDim = 1600, quality = 0.85) {
  const bitmap = await loadOrientedBitmap(file)
  const srcW = bitmap.width || bitmap.naturalWidth
  const srcH = bitmap.height || bitmap.naturalHeight
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  if (typeof bitmap.close === 'function') bitmap.close()
  return canvas.toDataURL('image/jpeg', quality).replace(/^data:image\/jpeg;base64,/, '')
}
