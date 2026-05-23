import { useState } from 'react'

// ─── Slot config ──────────────────────────────────────────────────────────
const SLOTS = [
  { id: 'top',    label: 'Capo 1', sublabel: 'Top / Maglia / Camicia', emoji: '👔' },
  { id: 'mid',    label: 'Capo 2', sublabel: 'Giacca / Maglione / Cardigan', emoji: '🧥' },
  { id: 'bottom', label: 'Capo 3', sublabel: 'Pantaloni / Gonna / Shorts', emoji: '👖' },
]

// ─── Single slot row ──────────────────────────────────────────────────────
function SlotRow({ slot, value, active, onClick, onChange }) {
  const filled = value.trim().length > 0
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 16,
        border: `1.5px ${filled ? 'solid' : 'dashed'} ${filled ? '#C8A882' : '#E2DAD0'}`,
        background: filled ? 'white' : '#F5F0E8',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        ...(active ? { boxShadow: '0 0 0 2px rgba(200,168,130,0.3)' } : {}),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#8C8279' }}>
          {slot.label}
        </div>
        <span style={{ fontSize: 18 }}>{slot.emoji}</span>
      </div>
      {filled ? (
        <>
          <div style={{ fontSize: 12, color: '#111111', marginTop: 4, fontWeight: 500, wordBreak: 'break-all' }}>
            {value.length > 40 ? value.slice(0, 40) + '…' : value}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onChange('') }}
            style={{
              marginTop: 6, fontSize: 10, color: '#C8A882',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            ✕ Rimuovi
          </button>
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#C8A882', fontWeight: 500, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          + Aggiungi link
        </div>
      )}
    </div>
  )
}

// ─── OutfitPage ───────────────────────────────────────────────────────────
export default function OutfitPage({ user, onBack }) {
  const [links, setLinks] = useState({ top: '', mid: '', bottom: '' })
  const [activeSlot, setActiveSlot] = useState('top')
  const [inputVal, setInputVal] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function handleSlotClick(slotId) {
    setActiveSlot(slotId)
    setInputVal(links[slotId])
  }

  function handleConfirmLink() {
    if (!inputVal.trim()) return
    setLinks(prev => ({ ...prev, [activeSlot]: inputVal.trim() }))
    // advance to next empty slot
    const order = ['top', 'mid', 'bottom']
    const next = order.find(s => s !== activeSlot && !links[s])
    if (next) { setActiveSlot(next); setInputVal('') }
    else setInputVal('')
  }

  const filledCount = Object.values(links).filter(v => v.trim()).length
  const canAnalyze = filledCount >= 2

  async function handleAnalyze() {
    if (!canAnalyze || isAnalyzing) return
    setIsAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/outfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          links: {
            top:    links.top    || null,
            mid:    links.mid    || null,
            bottom: links.bottom || null,
          },
        }),
      })
      const json = await res.json()
      const data = Array.isArray(json) ? json[0] : json
      if (!res.ok) throw new Error(data?.error || `Errore ${res.status}`)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Analisi non riuscita. Riprova.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const activeSlotCfg = SLOTS.find(s => s.id === activeSlot)

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + 16px) 24px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'white', border: '1.5px solid #E2DAD0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, cursor: 'pointer',
          }}
        >
          ←
        </button>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 18, fontWeight: 700, color: '#111111',
        }}>
          Custom Outfit
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Slot cards ── */}
        {SLOTS.map(slot => (
          <SlotRow
            key={slot.id}
            slot={slot}
            value={links[slot.id]}
            active={activeSlot === slot.id}
            onClick={() => handleSlotClick(slot.id)}
            onChange={val => setLinks(prev => ({ ...prev, [slot.id]: val }))}
          />
        ))}

        {/* ── Active slot input ── */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
            color: '#8C8279', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, background: '#C8A882', borderRadius: '50%' }} />
            {activeSlotCfg?.label} — {activeSlotCfg?.sublabel}
          </div>
          <div style={{
            background: 'white',
            border: '1.5px solid #C8A882',
            borderRadius: 16, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C8279" strokeWidth="2" strokeLinecap="round">
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
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#111111',
              }}
            />
            {inputVal && (
              <button
                onClick={handleConfirmLink}
                style={{
                  width: 30, height: 30, borderRadius: 10,
                  background: '#111111', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 13, flexShrink: 0,
                }}
              >
                ✓
              </button>
            )}
          </div>

          {/* OR separator + previous searches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E2DAD0' }} />
            <span style={{ fontSize: 10, color: '#8C8279', fontWeight: 600, letterSpacing: 1 }}>OPPURE</span>
            <div style={{ flex: 1, height: 1, background: '#E2DAD0' }} />
          </div>
        </div>

        {/* ── Analyze button ── */}
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || isAnalyzing}
          style={{
            width: '100%', padding: '14px 20px',
            borderRadius: 16, background: canAnalyze && !isAnalyzing ? '#111111' : '#E2DAD0',
            color: canAnalyze && !isAnalyzing ? 'white' : '#8C8279',
            fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
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
            <>
              🪡 Analizza outfit ({filledCount}/3 capi)
            </>
          )}
        </button>

        <p style={{ fontSize: 11, color: '#8C8279', textAlign: 'center', marginTop: -6 }}>
          {canAnalyze ? 'Pronti — aggiungi il terzo capo per un risultato ancora più preciso' : 'Aggiungi almeno 2 link per procedere'}
        </p>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #E8B4B4', borderRadius: 14, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, color: '#C94040' }}>{error}</p>
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div style={{
            background: '#111111', borderRadius: 20,
            padding: 16, display: 'flex', alignItems: 'center', gap: 14,
            animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
          }}>
            <span style={{ fontSize: 28 }}>✨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#C8A882', letterSpacing: 0.5 }}>
                Risultato outfit
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.5 }}>
                {typeof result.text === 'string'
                  ? decodeURIComponent(result.text.replace(/\+/g, ' '))
                  : result.message || result.output || 'Analisi completata.'}
              </div>
            </div>
            {result.score != null && (
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 30, fontWeight: 900, color: 'white', flexShrink: 0,
              }}>
                {result.score}<span style={{ fontSize: 13, color: '#8C8279' }}>/10</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
