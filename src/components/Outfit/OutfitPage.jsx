import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { loadSearchHistory, addToCart, isInCart, saveOutfitToHistory, loadOutfitHistory, deleteOutfitFromHistory } from '../../services/storageService.js'
import { API } from '../../config.js'
import figureUrl from '../../assets/figure.png'
import { AiAdviceDisclaimer } from '../Legal/LegalModals.jsx'

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

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatPrice(p) {
  if (p == null || isNaN(p)) return null
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(p)
}

// Loading indicator shown while the Outfit analysis runs
function OutfitWaitingIndicator() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 50000)
    return () => clearTimeout(t)
  }, [])
  const msgs = [
    'Sto analizzando i capi e le tue misure…',
    'Sto preparando la foto try-on…',
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0 4px' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: S.warm, animation: `pulseSoft 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <p style={{ fontSize: 12, color: S.muted, textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>{msgs[phase]}</p>
    </div>
  )
}

function driveImgSrc(url) {
  if (!url) return null
  const m = url.match(/[?&]id=([^&]+)/)
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`
  return url
}

function extractSizeBadge(text) {
  if (!text) return null
  // Primary: match "Taglia [size]" — avoids false positives in brand names (e.g. "M" in H&M)
  const tagged = text.match(/[Tt]aglia\s+(XXS|XS|S|M|L|XL|XXL|XXXL|3XL|4XL|\d{2}(?:\/\d{2})?)\b/i)
  if (tagged) return tagged[1].toUpperCase()
  // Fallback: first standalone size token (for old format compatibility)
  const m = text.match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|3XL|4XL|\d{2}(?:\/\d{2})?)\b(?!\s*%)/)
  return m ? m[1].toUpperCase() : null
}

// Handles both "TOP: [...] | MID: [...] | BOTTOM: [...] | OVERALL: [...]"
// and newline-separated variants
function parseSizeAdvice(text) {
  if (!text) return {}
  const normalized = text.replace(/\n(TOP|MID|BOTTOM|OVERALL)\s*:/gi, ' | $1:')
  const parts = {}
  const topM     = normalized.match(/TOP\s*:\s*([\s\S]+?)(?=\s*\|\s*(?:MID|BOTTOM|OVERALL)\s*:|$)/i)
  const midM     = normalized.match(/MID\s*:\s*([\s\S]+?)(?=\s*\|\s*(?:BOTTOM|OVERALL)\s*:|$)/i)
  const botM     = normalized.match(/BOTTOM\s*:\s*([\s\S]+?)(?=\s*\|\s*OVERALL\s*:|$)/i)
  const ovrM     = normalized.match(/OVERALL\s*:\s*([\s\S]+?)$/i)
  if (topM) parts.top     = topM[1].trim()
  if (midM) parts.mid     = midM[1].trim()
  if (botM) parts.bottom  = botM[1].trim()
  if (ovrM) parts.overall = ovrM[1].trim()
  parts.badges = {
    top:    extractSizeBadge(parts.top),
    mid:    extractSizeBadge(parts.mid),
    bottom: extractSizeBadge(parts.bottom),
  }
  return parts
}

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

// ─── Size advice pill per slot ────────────────────────────────────────────
function SizeAdvicePill({ slotId, advice, badge }) {
  const slot = SLOTS.find(s => s.id === slotId)
  if (!advice) return null
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '10px 12px',
      background: 'rgba(200,168,130,0.08)',
      borderRadius: 12,
      borderLeft: `3px solid ${S.warm}`,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{slot?.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.warm }}>
            {slot?.label} — {slot?.sublabel}
          </div>
          {badge && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: 'white',
              background: S.warm, padding: '1px 8px', borderRadius: 8,
              letterSpacing: 0.5, flexShrink: 0,
            }}>📏 {badge}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: S.ink, lineHeight: 1.5 }}>{advice}</div>
      </div>
    </div>
  )
}

// ─── Add all to cart ──────────────────────────────────────────────────────
function AddOutfitToCartBtn({ links, prices, sizeAdvice, onAdded }) {
  const [added, setAdded] = useState(false)
  function handleAdd() {
    if (added) return
    SLOTS.forEach(slot => {
      const link = links[slot.id]
      if (!link) return
      const id = crypto.randomUUID()
      let hostname = link
      try { hostname = new URL(link).hostname.replace('www.', '') } catch { /* */ }
      addToCart({ id, name: `${slot.sublabel} — ${hostname}`, link, price: prices?.[slot.id] ?? null, recommendedSize: sizeAdvice?.[slot.id] ?? null, source: 'outfit' })
    })
    setAdded(true); onAdded?.()
  }
  return (
    <button onClick={handleAdd} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', padding: '13px 20px', borderRadius: 14,
      background: added ? S.cream : S.ink,
      border: `1.5px solid ${added ? S.warm : S.ink}`,
      color: added ? S.warm : 'white',
      fontFamily: sans, fontSize: 14, fontWeight: 600,
      cursor: added ? 'default' : 'pointer', transition: 'all 0.25s',
    }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 2h1.5l2.5 8h7l1.5-5H5"/><circle cx="7" cy="13" r="1"/><circle cx="12" cy="13" r="1"/>
      </svg>
      {added ? '✓ Outfit aggiunto al carrello' : 'Aggiungi outfit al carrello'}
    </button>
  )
}

// ─── Fullscreen image lightbox ────────────────────────────────────────────
function ImageLightbox({ src, href, onClose }) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.18s ease',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: 'white', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: sans,
        }}
      >✕</button>

      {/* Image — stop propagation so clicking the image itself doesn't close */}
      <img
        src={src}
        alt="Outfit"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 96px)',
          objectFit: 'contain',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      />

      {/* Open full link */}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(env(safe-area-inset-bottom) + 20px)',
            left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.15)',
            color: 'white', fontSize: 12, fontWeight: 600,
            padding: '8px 18px', borderRadius: 20,
            textDecoration: 'none', fontFamily: sans,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >↗ Apri originale</a>
      )}
    </div>,
    document.body
  )
}

// ─── Outfit history card ──────────────────────────────────────────────────
function OutfitHistoryCard({ entry, onLoad, onDelete, onCartAdded }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [lightbox, setLightbox]     = useState(false)
  const [expanded, setExpanded]     = useState(false)
  const closeLightbox = useCallback(() => setLightbox(false), [])

  const sa         = entry.sizeAdvice || {}
  const prices     = entry.prices     || {}
  const totalPrice = entry.totalPrice  ?? null
  const hasPrices  = Object.values(prices).some(p => p != null && !isNaN(Number(p)))
  const hasDetail  = !!(sa.top || sa.mid || sa.bottom || sa.overall || hasPrices)

  const date = entry.createdAt
    ? new Date(entry.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
    : '—'

  return (
    <>
      {lightbox && entry.imageUrl && (
        <ImageLightbox
          src={driveImgSrc(entry.imageUrl)}
          href={entry.imageUrl}
          onClose={closeLightbox}
        />
      )}
    <div style={{
      background: 'white', border: `1.5px solid ${expanded ? S.warm : S.border}`,
      borderRadius: 18, overflow: 'hidden', marginBottom: 12,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Thumbnail — tappable to open lightbox */}
        <div
          onClick={() => entry.imageUrl && setLightbox(true)}
          style={{
            width: 90, flexShrink: 0, background: S.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 90,
            cursor: entry.imageUrl ? 'zoom-in' : 'default',
            position: 'relative',
          }}
        >
          {entry.imageUrl ? (
            <>
              <img
                src={driveImgSrc(entry.imageUrl)}
                alt="Outfit"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0)',
                transition: 'background 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
              >
                <span style={{
                  fontSize: 16, opacity: 0.85,
                  background: 'rgba(0,0,0,0.45)', borderRadius: '50%',
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>🔍</span>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 28 }}>🪡</span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: S.muted, marginBottom: 4 }}>{date}</div>
            {SLOTS.map(slot => {
              const link = entry.links?.[slot.id]
              if (!link) return null
              let hostname = link
              try { hostname = new URL(link).hostname.replace('www.', '') } catch { /* */ }
              return (
                <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 11 }}>{slot.emoji}</span>
                  <span style={{ fontSize: 11, color: S.ink, fontWeight: 500 }}>{hostname}</span>
                  {sa.badges?.[slot.id] && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: S.warm, color: 'white', padding: '1px 6px', borderRadius: 6 }}>
                      {sa.badges[slot.id]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => onLoad(entry)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10,
                background: S.ink, color: 'white',
                border: 'none', fontFamily: sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >↩ Ricarica</button>
            {hasDetail && (
              <button
                onClick={() => setExpanded(v => !v)}
                style={{
                  padding: '7px 10px', borderRadius: 10,
                  background: expanded ? S.warm : S.cream,
                  color: expanded ? 'white' : S.muted,
                  border: `1px solid ${expanded ? S.warm : S.border}`,
                  fontFamily: sans, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.18s',
                }}
              >{expanded ? '▲' : '📏 ▼'}</button>
            )}
            {confirmDel ? (
              <button
                onClick={() => onDelete(entry.id)}
                style={{
                  padding: '7px 10px', borderRadius: 10,
                  background: '#FFF0F0', color: S.red,
                  border: `1px solid #E8B4B4`, fontFamily: sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >Conferma</button>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                style={{
                  padding: '7px 10px', borderRadius: 10,
                  background: S.cream, color: S.muted,
                  border: `1px solid ${S.border}`, fontFamily: sans, fontSize: 12, cursor: 'pointer',
                }}
              >🗑</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${S.border}`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Taglie per slot */}
          {(sa.top || sa.mid || sa.bottom) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: S.muted }}>
                Taglie consigliate
              </div>
              {['top', 'mid', 'bottom'].map(slotId =>
                sa[slotId] ? (
                  <SizeAdvicePill key={slotId} slotId={slotId} advice={sa[slotId]} badge={sa.badges?.[slotId]} />
                ) : null
              )}
            </div>
          )}

          {/* Commento globale */}
          {sa.overall && (
            <div style={{
              padding: '10px 12px',
              background: `linear-gradient(135deg, rgba(200,168,130,0.15), rgba(200,168,130,0.05))`,
              border: `1px solid rgba(200,168,130,0.35)`,
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>🪡</span>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.warm }}>
                  Commento globale outfit
                </div>
              </div>
              <p style={{ fontSize: 12, color: S.ink, lineHeight: 1.5, margin: 0 }}>{sa.overall}</p>
            </div>
          )}

          {/* Prezzi */}
          {hasPrices && (
            <div style={{ padding: '8px 12px', background: S.tagBg, borderRadius: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: S.muted, marginBottom: 6 }}>
                Prezzi
              </div>
              {SLOTS.map(slot => {
                const p = prices[slot.id]
                if (p == null || isNaN(Number(p))) return null
                return (
                  <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: S.muted }}>{slot.emoji} {slot.sublabel}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: S.ink }}>{formatPrice(Number(p))}</span>
                  </div>
                )
              })}
              {totalPrice != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 5, borderTop: `1px solid ${S.border}`, marginTop: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: S.ink }}>Totale</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: S.warm }}>{formatPrice(Number(totalPrice))}</span>
                </div>
              )}
            </div>
          )}

          {/* Aggiungi al carrello */}
          <AddOutfitToCartBtn
            links={entry.links || {}}
            prices={prices}
            sizeAdvice={sa.badges}
            onAdded={onCartAdded}
          />
        </div>
      )}
    </div>
    </>
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
  const [outfitHistory, setOutfitHistory] = useState(() => loadOutfitHistory())
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
          // Explicit garment type labels so the AI knows exactly what each slot is
          garmentTypes: {
            top:    'Top / Maglia / Camicia (strato base, indossato a contatto con il corpo)',
            mid:    'Giacca / Maglione / Cardigan (strato esterno, sopra il top)',
            bottom: 'Pantaloni / Gonna / Shorts (parte inferiore)',
          },
        }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { throw new Error('Risposta non valida dal server') }
      if (Array.isArray(data)) data = data[0]
      if (!res.ok) throw new Error(data?.error || `Errore ${res.status}`)

      setResult(data)

      // Save to outfit history
      const historyEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        imageUrl: data.imageUrl || data.image_url || null,
        links: { top: links.top || null, mid: links.mid || null, bottom: links.bottom || null },
        sizeAdvice: parseSizeAdvice(data.sizeAdvice ?? data.text ?? null),
        prices: data.prices ?? {},
        totalPrice: data.totalPrice ?? null,
      }
      saveOutfitToHistory(historyEntry)
      setOutfitHistory(loadOutfitHistory())
    } catch (err) {
      setError(err.message || 'Analisi non riuscita. Riprova.')
    } finally { setIsAnalyzing(false) }
  }

  const activeSlotCfg = SLOTS.find(s => s.id === activeSlot)

  // Derived from result
  const sizeAdvice = result ? parseSizeAdvice(result.sizeAdvice ?? result.text ?? null) : {}
  const prices     = result?.prices ?? {}
  const totalPrice = result?.totalPrice ?? null
  const hasPrices  = Object.values(prices).some(p => p != null && !isNaN(Number(p)))

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

        {isAnalyzing && <OutfitWaitingIndicator />}

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
            <div style={{ background: S.ink, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: S.warm, letterSpacing: 0.5 }}>Outfit generato</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Analisi taglie e vestibilità</div>
              </div>
            </div>

            {/* Outfit image */}
            {(result.imageUrl || result.image_url) && (() => {
              const imgSrc = driveImgSrc(result.imageUrl || result.image_url)
              const imgHref = result.imageUrl || result.image_url
              return (
                <div style={{ background: S.cream, position: 'relative' }}>
                  <img
                    src={imgSrc}
                    alt="Outfit generato"
                    style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }}
                  />
                  <a
                    href={imgHref}
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
              )
            })()}

            {/* Size advice per slot */}
            {(sizeAdvice.top || sizeAdvice.mid || sizeAdvice.bottom) && (
              <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: S.muted, marginBottom: 2 }}>
                  Taglie consigliate
                </div>
                {['top', 'mid', 'bottom'].map(slotId =>
                  sizeAdvice[slotId] ? (
                    <SizeAdvicePill
                      key={slotId}
                      slotId={slotId}
                      advice={sizeAdvice[slotId]}
                      badge={sizeAdvice.badges?.[slotId]}
                    />
                  ) : null
                )}
              </div>
            )}

            {/* OVERALL outfit commentary */}
            {sizeAdvice.overall && (
              <div style={{
                margin: '12px 14px 0',
                padding: '12px 14px',
                background: `linear-gradient(135deg, rgba(200,168,130,0.15), rgba(200,168,130,0.05))`,
                border: `1px solid rgba(200,168,130,0.35)`,
                borderRadius: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>🪡</span>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.warm }}>
                    Commento globale outfit
                  </div>
                </div>
                <p style={{ fontSize: 13, color: S.ink, lineHeight: 1.6, margin: 0 }}>{sizeAdvice.overall}</p>
              </div>
            )}

            {/* Price breakdown */}
            {hasPrices && (
              <div style={{ margin: '12px 14px 0', padding: '10px 14px', background: S.tagBg, borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: S.muted, marginBottom: 6 }}>
                  Prezzi
                </div>
                {SLOTS.map(slot => {
                  const p = prices[slot.id]
                  if (p == null || isNaN(Number(p))) return null
                  return (
                    <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: S.muted }}>{slot.emoji} {slot.sublabel}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: S.ink }}>{formatPrice(Number(p))}</span>
                    </div>
                  )
                })}
                {totalPrice != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: `1px solid ${S.border}`, marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: S.ink }}>Totale</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: S.warm }}>{formatPrice(Number(totalPrice))}</span>
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer + Cart */}
            <div style={{ padding: '12px 14px 16px' }}>
              <AiAdviceDisclaimer />
              <div style={{ marginTop: 12 }}>
                <AddOutfitToCartBtn
                  links={links}
                  prices={prices}
                  sizeAdvice={sizeAdvice.badges}
                  onAdded={refreshCartCount}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Outfit history ── */}
        {outfitHistory.length > 0 && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase', color: S.muted,
              marginBottom: 12, marginTop: result ? 8 : 0,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>🕐</span> Storico outfit
            </div>
            {outfitHistory.map(entry => (
              <OutfitHistoryCard
                key={entry.id}
                entry={entry}
                onLoad={(e) => {
                  setLinks({
                    top:    e.links?.top    || '',
                    mid:    e.links?.mid    || '',
                    bottom: e.links?.bottom || '',
                  })
                  setResult(null)
                  setError(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                onDelete={(id) => {
                  deleteOutfitFromHistory(id)
                  setOutfitHistory(loadOutfitHistory())
                }}
                onCartAdded={refreshCartCount}
              />
            ))}
          </div>
        )}

        <div style={{ height: 'max(env(safe-area-inset-bottom), 16px)' }} />
      </div>
    </div>
  )
}
