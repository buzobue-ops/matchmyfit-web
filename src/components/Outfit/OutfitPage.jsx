import { useState } from 'react'
import { loadSearchHistory, addToCart, isInCart } from '../../services/storageService.js'
import { API } from '../../config.js'
import figureUrl from '../../assets/figure.png'

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
// hotspotTop: pixel offset from top of the 240px figure panel where the hotspot dot appears
const SLOTS = [
  { id: 'top',    label: 'Capo 1', sublabel: 'Top / Maglia / Camicia',       emoji: '👔', hotspotTop: 52  },
  { id: 'mid',    label: 'Capo 2', sublabel: 'Giacca / Maglione / Cardigan', emoji: '🧥', hotspotTop: 96  },
  { id: 'bottom', label: 'Capo 3', sublabel: 'Pantaloni / Gonna / Shorts',   emoji: '👖', hotspotTop: 154 },
]

// ─── Figure panel with real illustration + hotspot dots ───────────────────
function FigurePanel({ activeSlot }) {
  return (
    <div style={{
      position: 'relative',
      width: 155,
      flexShrink: 0,
      borderRadius: '24px 0 0 24px',
      overflow: 'hidden',
      backgroundColor: S.cream,
    }}>
      {/* Fashion illustration */}
      <img
        src={figureUrl}
        alt="Fashion illustration"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: '40% top',
          display: 'block',
          mixBlendMode: 'multiply',
          filter: 'contrast(1.0) brightness(1.0) saturate(0.95)',
        }}
      />

      {/* Hotspot dots — right edge of the figure panel */}
      {SLOTS.map(slot => {
        const isActive = activeSlot === slot.id
        return (
          <div
            key={slot.id}
            style={{
              position: 'absolute',
              top: slot.hotspotTop,
              right: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* horizontal connector line */}
            <div style={{
              width: 14,
              height: 1,
              background: isActive ? S.warm : S.ink,
              opacity: isActive ? 1 : 0.2,
              transition: 'all 0.2s',
            }} />
            {/* dot */}
            <div style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isActive ? S.warm : S.ink,
              border: '1.5px solid white',
              boxShadow: `0 0 0 1.5px ${isActive ? S.warm : S.ink}`,
              flexShrink: 0,
              transform: isActive ? 'scale(1.4)' : 'scale(1)',
              transition: 'all 0.2s ease',
              marginRight: -3.5,
            }} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini cart add button (outfit) ────────────────────────────────────────
function SlotCartBtn({ link, slotName, onAdded }) {
  const [inCart, setInCart] = useState(() => isInCart(link))
  const [flash, setFlash] = useState(false)

  function handle(e) {
    e.stopPropagation()
    if (inCart) return
    const id = crypto.randomUUID()
    let hostname = link
    try { hostname = new URL(link).hostname.replace('www.', '') } catch { /* */ }
    const added = addToCart({ id, name: `${slotName} — ${hostname}`, link, price: null, source: 'outfit' })
    if (added) { setInCart(true); setFlash(true); setTimeout(() => setFlash(false), 1400); onAdded?.() }
  }

  return (
    <button
      type="button"
      onClick={handle}
      style={{
        marginTop: 4,
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9, fontWeight: 700, fontFamily: sans,
        color: inCart ? S.warm : S.muted,
        background: 'none', border: 'none', cursor: inCart ? 'default' : 'pointer', padding: 0,
        letterSpacing: 0.3,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 2h1.5l2.5 8h7l1.5-5H5"/>
        <circle cx="7" cy="13" r="1"/>
        <circle cx="12" cy="13" r="1"/>
      </svg>
      {flash ? '✓ aggiunto' : inCart ? 'nel carrello' : '+ carrello'}
    </button>
  )
}

// ─── Single slot card ─────────────────────────────────────────────────────
function SlotCard({ slot, value, active, onClick, onClear, onCartAdded }) {
  const filled = value.trim().length > 0
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: 14,
        border: `1.5px ${filled ? 'solid' : 'dashed'} ${active ? S.warm : filled ? S.warm : S.border}`,
        background: active ? 'white' : filled ? 'white' : S.cream,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: active ? `0 0 0 3px rgba(200,168,130,0.18)` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1,
          textTransform: 'uppercase',
          color: active ? S.warm : S.muted,
        }}>
          {slot.label}
        </div>
        <span style={{ fontSize: 15 }}>{slot.emoji}</span>
      </div>
      {filled ? (
        <>
          <div style={{ fontSize: 10, color: S.ink, marginTop: 3, fontWeight: 500, wordBreak: 'break-all', lineHeight: 1.3 }}>
            {value.length > 32 ? value.slice(0, 32) + '…' : value}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 2 }}>
            <button
              onClick={e => { e.stopPropagation(); onClear() }}
              style={{ fontSize: 9, color: S.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: sans }}
            >✕ rimuovi</button>
            <SlotCartBtn link={value} slotName={slot.sublabel} onAdded={onCartAdded} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 10, color: active ? S.warm : S.muted, fontWeight: 500, marginTop: 3 }}>
          {active ? '↑ incolla link' : '+ aggiungi'}
        </div>
      )}
    </div>
  )
}

// ─── History chip ─────────────────────────────────────────────────────────
function HistoryChip({ result, onSelect }) {
  const name = result.productName || (() => {
    try { return new URL(result.productLink).hostname.replace('www.', '') } catch { return 'Link' }
  })()
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <button
      onClick={() => onSelect(result.productLink)}
      style={{
        flexShrink: 0,
        background: 'white', border: `1.5px solid ${S.border}`,
        borderRadius: 14, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', fontFamily: sans,
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = S.warm}
      onMouseLeave={e => e.currentTarget.style.borderColor = S.border}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: 'rgba(200,168,130,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color: S.warm, letterSpacing: 0.3,
      }}>{initials}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: S.ink, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
    </button>
  )
}

// ─── OutfitPage ───────────────────────────────────────────────────────────
export default function OutfitPage({ user, onBack, onOpenCart }) {
  const [links, setLinks]           = useState({ top: '', mid: '', bottom: '' })
  const [activeSlot, setActiveSlot] = useState('top')
  const [inputVal, setInputVal]     = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [cartCount, setCartCount]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmf_cart') || '[]').length } catch { return 0 }
  })

  function refreshCartCount() {
    try { setCartCount(JSON.parse(localStorage.getItem('mmf_cart') || '[]').length) } catch { /* */ }
  }

  // Load completed search history for chips
  const history = loadSearchHistory()
    .filter(r => r.status === 'completed' && r.productLink)
    .slice(0, 12)

  function handleSlotClick(slotId) {
    setActiveSlot(slotId)
    setInputVal(links[slotId])
  }

  function handleConfirmLink(url) {
    const val = (url || inputVal).trim()
    if (!val) return
    setLinks(prev => ({ ...prev, [activeSlot]: val }))
    // advance to next empty slot
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
      const res = await fetch(API.outfit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          links: { top: links.top || null, mid: links.mid || null, bottom: links.bottom || null },
        }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { throw new Error('Risposta non valida dal server') }
      if (Array.isArray(data)) data = data[0]
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
        <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: S.ink }}>Custom Outfit</div>
        {/* Cart icon */}
        <button
          onClick={onOpenCart}
          style={{
            position: 'relative',
            width: 36, height: 36, borderRadius: 12,
            background: 'white', border: `1.5px solid ${S.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={S.ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2h1.5l2.5 8h7l1.5-5H5"/>
            <circle cx="7" cy="13" r="1"/>
            <circle cx="12" cy="13" r="1"/>
          </svg>
          {cartCount > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              width: 16, height: 16, borderRadius: '50%',
              background: S.warm, color: 'white',
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: sans,
            }}>{cartCount > 9 ? '9+' : cartCount}</div>
          )}
        </button>
      </div>

      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Figure + Slots ── */}
        <div style={{
          background: S.cream,
          border: `1.5px solid ${S.border}`,
          borderRadius: 24,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'stretch',
          minHeight: 240,
          position: 'relative',
        }}>
          {/* Left: fashion illustration */}
          <FigurePanel activeSlot={activeSlot} />

          {/* Right: slot cards */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '14px 14px 14px 10px',
            justifyContent: 'center',
          }}>
            {SLOTS.map(slot => (
              <SlotCard
                key={slot.id}
                slot={slot}
                value={links[slot.id]}
                active={activeSlot === slot.id}
                onClick={() => handleSlotClick(slot.id)}
                onClear={() => setLinks(prev => ({ ...prev, [slot.id]: '' }))}
                onCartAdded={refreshCartCount}
              />
            ))}
          </div>
        </div>

        {/* ── Active slot input ── */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
            color: S.warm, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, background: S.warm, borderRadius: '50%' }} />
            {activeSlotCfg?.label} — {activeSlotCfg?.sublabel}
          </div>

          {/* URL input */}
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
              placeholder={`Incolla link — ${activeSlotCfg?.sublabel}…`}
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
            {inputVal.trim() && (
              <button
                onClick={() => handleConfirmLink()}
                style={{
                  width: 30, height: 30, borderRadius: 10,
                  background: S.ink, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 13, flexShrink: 0,
                }}
              >✓</button>
            )}
          </div>

          {/* OR + history chips */}
          {history.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <div style={{ flex: 1, height: 1, background: S.border }} />
                <span style={{ fontSize: 10, color: S.muted, fontWeight: 700, letterSpacing: 1 }}>OPPURE SCEGLI DALLO STORICO</span>
                <div style={{ flex: 1, height: 1, background: S.border }} />
              </div>
              <div style={{
                display: 'flex', gap: 8, overflowX: 'auto',
                paddingBottom: 4, scrollbarWidth: 'none',
              }}>
                {history.map(r => (
                  <HistoryChip
                    key={r.id}
                    result={r}
                    onSelect={(url) => handleConfirmLink(url)}
                  />
                ))}
              </div>
            </>
          )}
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
          ) : `🪡 Analizza outfit (${filledCount}/3 capi)`}
        </button>

        <p style={{ fontSize: 11, color: S.muted, textAlign: 'center', marginTop: -6 }}>
          {canAnalyze
            ? 'Puoi aggiungere un terzo capo per un risultato più preciso'
            : 'Aggiungi almeno 2 capi per procedere'}
        </p>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #E8B4B4', borderRadius: 14, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, color: S.red, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            border: `1.5px solid ${S.border}`,
            animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
          }}>
            {/* Header */}
            <div style={{
              background: S.ink, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: S.warm, letterSpacing: 0.5 }}>Outfit generato</div>
                {(result.text || result.message || result.output) && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, lineHeight: 1.5 }}>
                    {typeof result.text === 'string'
                      ? decodeURIComponent(result.text.replace(/\+/g, ' '))
                      : result.message || result.output}
                  </div>
                )}
              </div>
            </div>
            {/* Outfit image */}
            {result.imageUrl && (
              <div style={{ background: S.cream, position: 'relative' }}>
                <img
                  src={result.imageUrl}
                  alt="Outfit generato"
                  style={{
                    width: '100%',
                    maxHeight: 480,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                <a
                  href={result.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    position: 'absolute', bottom: 10, right: 10,
                    background: 'rgba(17,17,17,0.72)',
                    color: 'white', fontSize: 10, fontWeight: 600,
                    padding: '5px 10px', borderRadius: 10,
                    textDecoration: 'none', fontFamily: sans, letterSpacing: 0.3,
                  }}
                >↗ Apri</a>
              </div>
            )}
          </div>
        )}

        <div style={{ height: 'max(env(safe-area-inset-bottom), 16px)' }} />
      </div>
    </div>
  )
}
