import { useState } from 'react'

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
}
const serif = "'Cormorant Garamond', serif"
const sans  = "'DM Sans', sans-serif"

// ─── Slot config ──────────────────────────────────────────────────────────
const SLOTS = [
  { id: 'top',    label: 'Capo 1', sublabel: 'Top / Maglia / Camicia',        emoji: '👔', dotY: '22%' },
  { id: 'mid',    label: 'Capo 2', sublabel: 'Giacca / Maglione / Cardigan',  emoji: '🧥', dotY: '48%' },
  { id: 'bottom', label: 'Capo 3', sublabel: 'Pantaloni / Gonna / Shorts',    emoji: '👖', dotY: '74%' },
]

// ─── Full-body fashion silhouette SVG ─────────────────────────────────────
function FashionFigure({ activeSlot }) {
  const dotColor = (slotId) => activeSlot === slotId ? S.warm : S.border

  return (
    <svg
      viewBox="0 0 120 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    >
      {/* ── Body silhouette ── */}
      {/* Head */}
      <ellipse cx="60" cy="24" rx="16" ry="20" fill={S.tagBg} stroke={S.border} strokeWidth="1.2"/>

      {/* Neck */}
      <rect x="55" y="42" width="10" height="10" rx="2" fill={S.tagBg} stroke={S.border} strokeWidth="1"/>

      {/* Shoulders / torso top */}
      <path
        d="M30 58 C30 54 42 52 60 52 C78 52 90 54 90 58 L94 80 L86 82 L83 72 L83 130 L37 130 L37 72 L34 82 L26 80 Z"
        fill={S.tagBg} stroke={S.border} strokeWidth="1.2"
      />

      {/* Left arm */}
      <path
        d="M30 60 C22 65 16 80 18 110 C19 120 22 128 24 132 L30 130 C28 126 26 118 25 108 C24 88 28 72 34 64 Z"
        fill={S.tagBg} stroke={S.border} strokeWidth="1"
      />
      {/* Left hand */}
      <ellipse cx="21" cy="136" rx="5" ry="7" fill={S.tagBg} stroke={S.border} strokeWidth="1"/>

      {/* Right arm */}
      <path
        d="M90 60 C98 65 104 80 102 110 C101 120 98 128 96 132 L90 130 C92 126 94 118 95 108 C96 88 92 72 86 64 Z"
        fill={S.tagBg} stroke={S.border} strokeWidth="1"
      />
      {/* Right hand */}
      <ellipse cx="99" cy="136" rx="5" ry="7" fill={S.tagBg} stroke={S.border} strokeWidth="1"/>

      {/* Jacket / mid layer outline */}
      <path
        d="M37 100 L30 130 C30 130 34 140 60 140 C86 140 90 130 90 130 L83 100"
        fill="none" stroke={S.border} strokeWidth="1" strokeDasharray="3 2"
      />

      {/* Waist / hips */}
      <path
        d="M37 130 C35 148 34 160 36 168 L84 168 C86 160 85 148 83 130 Z"
        fill={S.tagBg} stroke={S.border} strokeWidth="1.2"
      />

      {/* Pants/skirt */}
      <path
        d="M36 168 C34 178 33 188 34 198 L56 198 L60 172 L64 198 L86 198 C87 188 86 178 84 168 Z"
        fill={S.tagBg} stroke={S.border} strokeWidth="1.2"
      />

      {/* Left leg */}
      <path
        d="M34 198 C33 218 33 240 34 260 L54 260 L56 198 Z"
        fill={S.tagBg} stroke={S.border} strokeWidth="1"
      />
      {/* Left foot */}
      <ellipse cx="44" cy="263" rx="12" ry="5" fill={S.tagBg} stroke={S.border} strokeWidth="1"/>

      {/* Right leg */}
      <path
        d="M64 198 L66 260 L86 260 C87 240 87 218 86 198 Z"
        fill={S.tagBg} stroke={S.border} strokeWidth="1"
      />
      {/* Right foot */}
      <ellipse cx="76" cy="263" rx="12" ry="5" fill={S.tagBg} stroke={S.border} strokeWidth="1"/>

      {/* ── Hotspot dots ── */}
      {/* Top slot dot — chest area */}
      <circle cx="60" cy="76" r="5" fill={dotColor('top')} />
      <circle cx="60" cy="76" r="8" fill={dotColor('top')} fillOpacity="0.25" />

      {/* Mid slot dot — jacket area */}
      <circle cx="60" cy="118" r="5" fill={dotColor('mid')} />
      <circle cx="60" cy="118" r="8" fill={dotColor('mid')} fillOpacity="0.25" />

      {/* Bottom slot dot — hips area */}
      <circle cx="60" cy="183" r="5" fill={dotColor('bottom')} />
      <circle cx="60" cy="183" r="8" fill={dotColor('bottom')} fillOpacity="0.25" />
    </svg>
  )
}

// ─── Single slot row ──────────────────────────────────────────────────────
function SlotRow({ slot, value, active, onClick, onChange }) {
  const filled = value.trim().length > 0
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 14,
        border: `1.5px ${filled ? 'solid' : 'dashed'} ${active ? S.warm : filled ? S.warm : S.border}`,
        background: active ? 'white' : filled ? 'white' : S.cream,
        padding: '11px 13px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: active ? `0 0 0 3px rgba(200,168,130,0.2)` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: active ? S.warm : S.muted }}>
          {slot.label}
        </div>
        <span style={{ fontSize: 16 }}>{slot.emoji}</span>
      </div>

      {filled ? (
        <>
          <div style={{ fontSize: 11, color: S.ink, marginTop: 3, fontWeight: 500, wordBreak: 'break-all' }}>
            {value.length > 38 ? value.slice(0, 38) + '…' : value}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onChange('') }}
            style={{
              marginTop: 4, fontSize: 10, color: S.warm,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: sans,
            }}
          >
            ✕ Rimuovi
          </button>
        </>
      ) : (
        <div style={{ fontSize: 11, color: active ? S.warm : S.muted, fontWeight: 500, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
          {active ? '↑ Incolla link sopra' : '+ Tocca per aggiungere'}
        </div>
      )}
    </div>
  )
}

// ─── OutfitPage ───────────────────────────────────────────────────────────
export default function OutfitPage({ user, onBack }) {
  const [links, setLinks]         = useState({ top: '', mid: '', bottom: '' })
  const [activeSlot, setActiveSlot] = useState('top')
  const [inputVal, setInputVal]   = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)

  function handleSlotClick(slotId) {
    setActiveSlot(slotId)
    setInputVal(links[slotId])
  }

  function handleConfirmLink() {
    if (!inputVal.trim()) return
    setLinks(prev => ({ ...prev, [activeSlot]: inputVal.trim() }))
    const order = ['top', 'mid', 'bottom']
    const next = order.find(s => s !== activeSlot && !links[s])
    if (next) { setActiveSlot(next); setInputVal('') }
    else setInputVal('')
  }

  const filledCount = Object.values(links).filter(v => v.trim()).length
  const canAnalyze  = filledCount >= 2

  async function handleAnalyze() {
    if (!canAnalyze || isAnalyzing) return
    setIsAnalyzing(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/outfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          links: { top: links.top || null, mid: links.mid || null, bottom: links.bottom || null },
        }),
      })
      const json = await res.json()
      const data = Array.isArray(json) ? json[0] : json
      if (!res.ok) throw new Error(data?.error || `Errore ${res.status}`)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Analisi non riuscita. Riprova.')
    } finally { setIsAnalyzing(false) }
  }

  const activeSlotCfg = SLOTS.find(s => s.id === activeSlot)

  return (
    <div style={{ minHeight: '100vh', background: S.surface, fontFamily: sans }}>

      {/* ── Header ── */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + 16px) 24px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
        <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: S.ink }}>
          Custom Outfit
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Figure + Slots layout ── */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', minHeight: 280 }}>

          {/* Figure column */}
          <div style={{
            width: 110, flexShrink: 0,
            background: 'white', border: `1.5px solid ${S.border}`,
            borderRadius: 20, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '12px 8px',
          }}>
            <FashionFigure activeSlot={activeSlot} />
          </div>

          {/* Slots column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SLOTS.map(slot => (
              <div key={slot.id} style={{ flex: 1 }}>
                <SlotRow
                  slot={slot}
                  value={links[slot.id]}
                  active={activeSlot === slot.id}
                  onClick={() => handleSlotClick(slot.id)}
                  onChange={val => setLinks(prev => ({ ...prev, [slot.id]: val }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Active slot input ── */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
            color: S.warm, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, background: S.warm, borderRadius: '50%' }} />
            {activeSlotCfg?.label} — {activeSlotCfg?.sublabel}
          </div>
          <div style={{
            background: 'white', border: `1.5px solid ${S.warm}`,
            borderRadius: 16, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2" strokeLinecap="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            <input
              type="url"
              inputMode="url"
              placeholder={`Incolla link ${activeSlotCfg?.sublabel}…`}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmLink()}
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: sans, fontSize: 13, color: S.ink,
              }}
            />
            {inputVal && (
              <button
                onClick={handleConfirmLink}
                style={{
                  width: 30, height: 30, borderRadius: 10,
                  background: S.ink, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 13, flexShrink: 0,
                }}
              >✓</button>
            )}
          </div>
        </div>

        {/* ── Analyze button ── */}
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || isAnalyzing}
          style={{
            width: '100%', padding: '14px 20px',
            borderRadius: 16, background: canAnalyze && !isAnalyzing ? S.ink : S.border,
            color: canAnalyze && !isAnalyzing ? 'white' : S.muted,
            fontFamily: sans, fontSize: 15, fontWeight: 600,
            border: 'none', cursor: canAnalyze && !isAnalyzing ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
        >
          {isAnalyzing ? (
            <>
              <div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} />
              Analisi outfit in corso…
            </>
          ) : (
            `🪡 Analizza outfit (${filledCount}/3 capi)`
          )}
        </button>

        <p style={{ fontSize: 11, color: S.muted, textAlign: 'center', marginTop: -8 }}>
          {canAnalyze ? 'Aggiungi il terzo capo per un risultato ancora più preciso' : 'Aggiungi almeno 2 capi per procedere'}
        </p>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #E8B4B4', borderRadius: 14, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, color: S.red }}>{error}</p>
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div style={{
            background: S.ink, borderRadius: 20,
            padding: 16, display: 'flex', alignItems: 'center', gap: 14,
            animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
          }}>
            <span style={{ fontSize: 28 }}>✨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.warm, letterSpacing: 0.5 }}>
                Risultato outfit
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 1.5 }}>
                {typeof result.text === 'string'
                  ? decodeURIComponent(result.text.replace(/\+/g, ' '))
                  : result.message || result.output || 'Analisi completata.'}
              </div>
            </div>
            {result.score != null && (
              <div style={{ fontFamily: serif, fontSize: 30, fontWeight: 900, color: 'white', flexShrink: 0 }}>
                {result.score}<span style={{ fontSize: 13, color: S.muted }}>/10</span>
              </div>
            )}
          </div>
        )}

        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </div>
    </div>
  )
}
