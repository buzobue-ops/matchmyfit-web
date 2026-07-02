import { useState, useRef, useEffect } from 'react'
import { sendProfileUpdate, checkAccountAndFetchProfile } from '../../services/webhookService.js'
import { ImageDisclaimerBox } from '../Legal/LegalModals.jsx'
import PrivacyConsentsPanel from '../Legal/PrivacyConsentsPanel.jsx'
import { getUserInitials, stripPhotoBase64, pickPhotoFields, buildPhotoSrcCandidates, resizePhotoFile } from '../../utils/userPhoto.js'
import { saveUserPhoto, loadUserPhoto } from '../../services/storageService.js'
import ProfilePhotoImage from './ProfilePhotoImage.jsx'

// ─── Design tokens ────────────────────────────────────────────────────────
const S = {
  ink:    '#111111',
  warm:   '#C8A882',
  muted:  '#8C8279',
  surface:'#FDFAF5',
  cream:  '#F5F0E8',
  border: '#E2DAD0',
  tagBg:  '#F0EAE0',
  red:    '#C94040',
  green:  '#3A7A3A',
}
const serif = "'Cormorant Garamond', serif"
const sans  = "'DM Sans', sans-serif"

const MEASURE_FIELDS = [
  { key: 'height',    label: 'Altezza',  unit: 'cm', required: true },
  { key: 'chest',     label: 'Petto',    unit: 'cm' },
  { key: 'waist',     label: 'Vita',     unit: 'cm' },
  { key: 'hips',      label: 'Fianchi',  unit: 'cm' },
  { key: 'shoulders', label: 'Spalle',   unit: 'cm' },
  { key: 'inseam',    label: 'Cavallo',  unit: 'cm' },
]

// Read a numeric field from any of the common user-data locations returned by n8n
function readField(user, key) {
  if (!user) return ''
  // Direct top-level key (e.g. user.height)
  const direct = user[key]
  if (direct != null && direct !== '') return String(direct)
  // Nested under bodySizes (set by onboarding)
  const bs = user.bodySizes
  if (bs && bs[key] != null && bs[key] !== '') return String(bs[key])
  // Nested under measurements (set by profile-update)
  const ms = user.measurements
  if (ms && ms[key] != null && ms[key] !== '') return String(ms[key])
  // Nested under profile (sometimes returned by n8n)
  const pr = user.profile
  if (pr && pr[key] != null && pr[key] !== '') return String(pr[key])
  return ''
}

export default function ProfilePage({ user, onBack, onSave, onSyncProfile, onRevokeConsents }) {
  const [measurements, setMeasurements] = useState({
    height:    readField(user, 'height'),
    chest:     readField(user, 'chest'),
    waist:     readField(user, 'waist'),
    hips:      readField(user, 'hips'),
    shoulders: readField(user, 'shoulders'),
    inseam:    readField(user, 'inseam'),
  })
  const [photoBase64, setPhotoBase64] = useState(() =>
    stripPhotoBase64(user?.photoBase64 || user?.photo_base64 || loadUserPhoto(user?.id))
  )
  const [photoCleared, setPhotoCleared] = useState(false)
  const [remotePhotoFailed, setRemotePhotoFailed] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(() => buildPhotoSrcCandidates(user).length === 0)
  const [isSaving, setIsSaving]   = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState(null)
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false

    const localCandidates = buildPhotoSrcCandidates(user)
    if (localCandidates.length > 0) {
      setPhotoLoading(false)
    } else {
      setPhotoLoading(true)
    }

    ;(async () => {
      try {
        const profile = await checkAccountAndFetchProfile({
          authProvider: user.authProvider,
          providerUserId: user.id,
          email: user.email,
        })
        if (cancelled || !profile) return

        const photoFields = pickPhotoFields(profile)
        const merged = { ...user, ...profile, ...photoFields }

        if (photoFields.photoBase64) {
          setPhotoBase64(photoFields.photoBase64)
          setPhotoCleared(false)
          setRemotePhotoFailed(false)
          saveUserPhoto(user.id, photoFields.photoBase64)
        }

        if (buildPhotoSrcCandidates(merged).length > 0) {
          setRemotePhotoFailed(false)
        }

        if (photoFields.photoUrl || photoFields.photoBase64) {
          onSyncProfile?.(photoFields)
        }
      } catch {
        /* offline — usa cache locale */
      } finally {
        if (!cancelled) setPhotoLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [user?.id, user?.email, user?.authProvider]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleMeasure(key, val) {
    if (val !== '' && !/^\d*\.?\d*$/.test(val)) return
    setMeasurements(prev => ({ ...prev, [key]: val }))
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      // Downscale + bake EXIF orientation before anything touches the photo
      const b64 = await resizePhotoFile(file)
      setPhotoBase64(b64)
      setPhotoCleared(false)
      setRemotePhotoFailed(false)
      saveUserPhoto(user.id, b64)
    } catch {
      setError('Immagine non valida. Riprova con un altro file.')
    }
  }

  async function handleSave() {
    if (!measurements.height) { setError("L'altezza è obbligatoria."); return }
    setIsSaving(true); setError(null)
    try {
      const meas = {}
      MEASURE_FIELDS.forEach(f => { if (measurements[f.key]) meas[f.key] = parseFloat(measurements[f.key]) })
      await sendProfileUpdate(user.id, { measurements: meas, imageBase64: photoBase64 || undefined })
      onSave({
        height: meas.height,
        measurements: meas,
        ...(photoBase64 ? { photoBase64 } : {}),
        ...(user.photoUrl ? { photoUrl: user.photoUrl } : {}),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Salvataggio non riuscito. Riprova.')
    } finally { setIsSaving(false) }
  }

  const photoUser = !photoCleared && user ? {
    ...user,
    ...(photoBase64 ? { photoBase64 } : {}),
  } : null
  const hasLocalPhoto = !photoCleared && (
    !!photoBase64 ||
    (!remotePhotoFailed && photoUser && buildPhotoSrcCandidates(photoUser).length > 0)
  )
  const initials = getUserInitials(user).slice(0, 1)

  return (
    <div style={{ minHeight: '100vh', background: S.surface, fontFamily: sans, display: 'flex', flexDirection: 'column' }}>

      {/* ── Nav ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `calc(env(safe-area-inset-top) + 12px) 20px 12px`,
        borderBottom: `1px solid ${S.border}`,
        background: 'rgba(253,250,245,0.92)',
        backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'white', border: `1.5px solid ${S.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, cursor: 'pointer',
          }}
        >←</button>

        <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: S.ink }}>
          Profilo
        </span>

        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            padding: '8px 16px', borderRadius: 12,
            background: saved ? '#E8F5E8' : S.ink,
            color: saved ? S.green : 'white',
            border: saved ? `1px solid #C8E6C8` : 'none',
            fontFamily: sans, fontSize: 13, fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.5 : 1,
            transition: 'all 0.25s',
          }}
        >
          {isSaving ? 'Salvo…' : saved ? '✓ Salvato' : 'Salva'}
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 40px' }}>

        {/* User card */}
        <div style={{
          background: 'white', border: `1.5px solid ${S.border}`,
          borderRadius: 20, padding: '20px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 24,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: hasLocalPhoto ? 'transparent' : `linear-gradient(135deg, ${S.warm}, #8B6545)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: 'white', fontWeight: 700, flexShrink: 0,
            overflow: 'hidden',
            border: hasLocalPhoto ? `1.5px solid ${S.border}` : 'none',
          }}>
            {hasLocalPhoto ? (
              <ProfilePhotoImage
                user={photoUser}
                alt="Foto profilo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onAllFailed={() => setRemotePhotoFailed(true)}
              />
            ) : initials}
          </div>
          <div>
            <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: S.ink }}>
              {user?.displayName || user?.username}
            </div>
            {user?.email && (
              <div style={{ fontSize: 12, color: S.muted, marginTop: 3 }}>{user.email}</div>
            )}
            {user?.username && (
              <div style={{ fontSize: 12, color: S.warm, marginTop: 2 }}>@{user.username}</div>
            )}
          </div>
        </div>

        {/* ── Measurements section ── */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 10 }}>
          Misure
        </div>
        <div style={{
          background: 'white', border: `1.5px solid ${S.border}`,
          borderRadius: 18, overflow: 'hidden', marginBottom: 24,
        }}>
          {MEASURE_FIELDS.map((field, i) => (
            <div
              key={field.key}
              style={{
                display: 'flex', alignItems: 'center', padding: '14px 18px',
                borderBottom: i < MEASURE_FIELDS.length - 1 ? `1px solid ${S.tagBg}` : 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 14, color: S.ink }}>
                {field.label}
                {field.required && <span style={{ color: S.warm }}> *</span>}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="—"
                value={measurements[field.key]}
                onChange={e => handleMeasure(field.key, e.target.value)}
                style={{
                  textAlign: 'right', fontSize: 15, fontWeight: 600,
                  color: measurements[field.key] ? S.ink : S.muted,
                  background: 'transparent', border: 'none', outline: 'none',
                  width: 64, fontFamily: sans,
                }}
              />
              <span style={{ fontSize: 12, color: S.muted, width: 28, textAlign: 'right' }}>{field.unit}</span>
            </div>
          ))}
        </div>

        {/* ── Photo section ── */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 10 }}>
          Foto allo specchio
        </div>

        <div style={{
          display: 'flex', alignItems: 'start', gap: 10,
          background: 'rgba(200,168,130,0.1)', borderRadius: 14,
          padding: '13px 16px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: 13, color: S.warm, fontWeight: 500, lineHeight: 1.45, margin: 0 }}>
            Foto allo specchio a figura intera per una stima delle taglie più accurata
          </p>
        </div>

        <ImageDisclaimerBox />

        {hasLocalPhoto ? (
          <div style={{ marginBottom: 16 }}>
            <ProfilePhotoImage
              user={photoUser}
              alt="Foto profilo"
              style={{
                width: '100%', maxHeight: 320, objectFit: 'contain',
                borderRadius: 16, background: S.tagBg,
              }}
              onAllFailed={() => setRemotePhotoFailed(true)}
            />
            <button
              onClick={() => {
                setPhotoBase64(null)
                setPhotoCleared(true)
                setRemotePhotoFailed(false)
              }}
              style={{
                marginTop: 8, fontSize: 12, color: S.red,
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: sans,
              }}
            >
              ✕ Rimuovi foto
            </button>
          </div>
        ) : photoLoading ? (
          <div style={{
            background: S.tagBg, border: `1.5px dashed ${S.border}`,
            borderRadius: 16, height: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, flexDirection: 'column', gap: 8,
          }}>
            <div className="spinner" />
            <span style={{ fontSize: 12, color: S.muted }}>Caricamento foto…</span>
          </div>
        ) : (
          <div style={{
            background: S.tagBg, border: `1.5px dashed ${S.border}`,
            borderRadius: 16, height: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 32 }}>🪞</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { ref: cameraRef,  capture: 'environment', label: '📷  Scatta foto' },
            { ref: galleryRef, capture: undefined,      label: '🖼  Galleria'    },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={() => btn.ref.current?.click()}
              style={{
                flex: 1, padding: '13px 8px', borderRadius: 14,
                border: `1.5px solid ${S.warm}`, background: 'white',
                color: S.warm, fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
        <input ref={galleryRef} type="file" accept="image/*"                       style={{ display: 'none' }} onChange={handleFile} />

        {error && (
          <div style={{
            background: '#FFF0F0', border: '1px solid #E8B4B4',
            borderRadius: 14, padding: '12px 16px', marginTop: 8,
          }}>
            <p style={{ fontSize: 13, color: S.red, margin: 0 }}>{error}</p>
          </div>
        )}

        <PrivacyConsentsPanel onRevoked={onRevokeConsents} />
      </div>

      {/* ── Sticky save button ── */}
      <div style={{
        padding: '12px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        borderTop: `1px solid ${S.border}`,
        background: S.surface,
      }}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            width: '100%', padding: 15, borderRadius: 16,
            background: saved ? '#E8F5E8' : S.ink,
            color: saved ? S.green : 'white',
            border: saved ? `1px solid #C8E6C8` : 'none',
            fontFamily: sans, fontSize: 15, fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.5 : 1,
            transition: 'all 0.25s',
          }}
        >
          {isSaving ? 'Salvataggio…' : saved ? '✓ Modifiche salvate' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  )
}
