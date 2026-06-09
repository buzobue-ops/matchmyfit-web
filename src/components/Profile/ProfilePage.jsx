import { useState, useRef } from 'react'
import { sendProfileUpdate } from '../../services/webhookService.js'
import { ImageDisclaimerBox } from '../Legal/LegalModals.jsx'

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

export default function ProfilePage({ user, onBack, onSave }) {
  const [measurements, setMeasurements] = useState({
    height:    readField(user, 'height'),
    chest:     readField(user, 'chest'),
    waist:     readField(user, 'waist'),
    hips:      readField(user, 'hips'),
    shoulders: readField(user, 'shoulders'),
    inseam:    readField(user, 'inseam'),
  })
  const [photoBase64, setPhotoBase64] = useState(null)
  const [isSaving, setIsSaving]   = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState(null)
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)

  function handleMeasure(key, val) {
    if (val !== '' && !/^\d*\.?\d*$/.test(val)) return
    setMeasurements(prev => ({ ...prev, [key]: val }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoBase64(reader.result.replace(/^data:image\/[^;]+;base64,/, ''))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSave() {
    if (!measurements.height) { setError("L'altezza è obbligatoria."); return }
    setIsSaving(true); setError(null)
    try {
      const meas = {}
      MEASURE_FIELDS.forEach(f => { if (measurements[f.key]) meas[f.key] = parseFloat(measurements[f.key]) })
      await sendProfileUpdate(user.id, { measurements: meas, imageBase64: photoBase64 || undefined })
      onSave({ height: meas.height, measurements: meas, ...(photoBase64 ? { photoBase64 } : {}) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Salvataggio non riuscito. Riprova.')
    } finally { setIsSaving(false) }
  }

  const initials = (user?.displayName || user?.username || '?')[0].toUpperCase()

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
            background: `linear-gradient(135deg, ${S.warm}, #8B6545)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: 'white', fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
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

        {photoBase64 ? (
          <div style={{ marginBottom: 16 }}>
            <img
              src={`data:image/jpeg;base64,${photoBase64}`}
              alt="Preview"
              style={{
                width: '100%', maxHeight: 320, objectFit: 'contain',
                borderRadius: 16, background: S.tagBg,
              }}
            />
            <button
              onClick={() => setPhotoBase64(null)}
              style={{
                marginTop: 8, fontSize: 12, color: S.red,
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: sans,
              }}
            >
              ✕ Rimuovi foto
            </button>
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
