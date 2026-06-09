import { useState, useCallback } from 'react'
import { loadCart, removeFromCart, updateCartItem, clearCart } from '../../services/storageService.js'

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
  greenBg:'#E8F5E8',
}
const serif = "'Cormorant Garamond', serif"
const sans  = "'DM Sans', sans-serif"

// ─── Extract brand from URL ───────────────────────────────────────────────
const BRAND_MAP = {
  'zara.com': 'ZARA', 'hm.com': 'H&M', 'cos.com': 'COS',
  'mango.com': 'MANGO', 'asos.com': 'ASOS', 'zalando.com': 'ZALANDO',
  'hugoboss.com': 'HUGO BOSS', 'boss.com': 'HUGO BOSS',
  'ralphlauren.com': 'RALPH LAUREN', 'calvinklein.com': 'CALVIN KLEIN',
  'tommyhilfiger.com': 'TOMMY', 'levi.com': 'LEVI\'S', 'gap.com': 'GAP',
  'uniqlo.com': 'UNIQLO', 'massimodutti.com': 'M. DUTTI',
  'pullandbear.com': 'PULL&BEAR', 'bershka.com': 'BERSHKA',
  'stradivarius.com': 'STRADIVARIUS', 'reserved.com': 'RESERVED',
  'nike.com': 'NIKE', 'adidas.com': 'ADIDAS', 'puma.com': 'PUMA',
  'nordstrom.com': 'NORDSTROM', 'farfetch.com': 'FARFETCH',
  'net-a-porter.com': 'NET-A-PORTER', 'ssense.com': 'SSENSE',
  'boggi.com': 'BOGGI', 'boggi.com/it': 'BOGGI',
  'spadaroma.com': 'SPADAROMA', 'antonioli.eu': 'ANTONIOLI',
  'luisaviaroma.com': 'LUISAVIAROMA', 'rinascente.it': 'RINASCENTE',
  'eataly.net': 'EATALY',
}
function extractBrand(link) {
  if (!link) return null
  try {
    const host = new URL(link).hostname.replace('www.', '').toLowerCase()
    for (const [domain, brand] of Object.entries(BRAND_MAP)) {
      if (host.includes(domain)) return brand
    }
    // Fallback: capitalize first part of domain
    const parts = host.split('.')
    if (parts.length >= 2) return parts[0].toUpperCase()
  } catch { /* */ }
  return null
}

// ─── Cart Item Row ─────────────────────────────────────────────────────────
function CartItem({ item, onRemove, onPriceChange }) {
  const [editing, setEditing] = useState(false)
  const [priceInput, setPriceInput] = useState(
    item.price != null ? String(item.price) : ''
  )

  function commitPrice() {
    const val = parseFloat(priceInput.replace(',', '.'))
    onPriceChange(isNaN(val) ? null : val)
    setEditing(false)
  }

  const sourceLabel = item.source === 'outfit' ? 'OUTFIT' : 'CAPO SINGOLO'
  const sourceColor = item.source === 'outfit' ? S.warm : S.muted
  const brand = extractBrand(item.link)

  // Try to shorten the link for display
  let displayLink = item.link
  try {
    const u = new URL(item.link)
    displayLink = u.hostname.replace('www.', '') + u.pathname.slice(0, 28) + (u.pathname.length > 28 ? '…' : '')
  } catch { /* keep raw */ }

  return (
    <div style={{
      background: 'white',
      border: `1.5px solid ${S.border}`,
      borderRadius: 18,
      overflow: 'hidden',
    }}>
      {/* Top row */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Brand badge */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: item.source === 'outfit' ? 'rgba(200,168,130,0.15)' : S.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: brand && brand.length <= 2 ? 14 : 11, fontWeight: 700,
          color: item.source === 'outfit' ? S.warm : 'white',
          fontFamily: sans, letterSpacing: 0.5,
        }}>
          {brand ? brand.slice(0, 2).toUpperCase() : (item.name || '?').slice(0, 2).toUpperCase()}
        </div>

        {/* Name + link */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: S.ink, lineHeight: 1.3, marginBottom: 5 }}>
            {item.name || 'Prodotto'}
          </div>
          {/* Pills row: brand + taglia + source */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 4 }}>
            {brand && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 100,
                background: S.ink, color: 'white',
              }}>{brand}</span>
            )}
            {item.recommendedSize && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                padding: '2px 8px', borderRadius: 100,
                background: 'rgba(200,168,130,0.15)',
                color: S.warm,
                border: `1px solid rgba(200,168,130,0.35)`,
              }}>📏 {item.recommendedSize}</span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 100,
              background: item.source === 'outfit' ? 'rgba(200,168,130,0.10)' : S.tagBg,
              color: sourceColor,
            }}>{sourceLabel}</span>
          </div>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: S.muted, textDecoration: 'none', wordBreak: 'break-all', lineHeight: 1.4 }}
            onClick={e => e.stopPropagation()}
          >
            {displayLink}
          </a>
        </div>

        {/* Remove */}
        <button
          onClick={onRemove}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: '#FFF0F0', border: '1px solid #E8B4B4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke={S.red} strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Price row */}
      <div style={{
        borderTop: `1px solid ${S.tagBg}`,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
      }}>
        <span style={{ fontSize: 12, color: S.muted, fontWeight: 500 }}>Prezzo</span>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: S.tagBg, border: `1.5px solid ${S.warm}`,
              borderRadius: 10, padding: '6px 10px',
            }}>
              <span style={{ fontSize: 13, color: S.muted }}>€</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitPrice() }}
                style={{
                  width: 72, border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: sans, fontSize: 14, fontWeight: 600, color: S.ink,
                }}
                placeholder="0.00"
              />
            </div>
            <button
              onClick={commitPrice}
              style={{
                padding: '7px 12px', borderRadius: 10,
                background: S.ink, border: 'none', cursor: 'pointer',
                color: 'white', fontFamily: sans, fontSize: 12, fontWeight: 600,
              }}
            >Ok</button>
            <button
              onClick={() => { setPriceInput(item.price != null ? String(item.price) : ''); setEditing(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: S.muted, fontFamily: sans }}
            >Annulla</button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer',
              padding: '5px 10px', borderRadius: 10,
              background: S.tagBg, border: `1px dashed ${S.border}`,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: item.price != null ? S.ink : S.muted, fontFamily: serif }}>
              {item.price != null ? `€ ${Number(item.price).toFixed(2)}` : '+ aggiungi prezzo'}
            </span>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke={S.muted} strokeWidth="1.5" strokeLinecap="round">
              <path d="M9.5 2.5l2 2-6 6-2.5.5.5-2.5 6-6z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyCart() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 24px', gap: 16, textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', background: S.tagBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={S.border} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      </div>
      <div>
        <p style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: S.ink, margin: 0 }}>Carrello vuoto</p>
        <p style={{ fontSize: 14, color: S.muted, marginTop: 8, lineHeight: 1.5, maxWidth: 240 }}>
          Aggiungi capi dalle ricerche o dagli outfit per confrontare i prezzi
        </p>
      </div>
    </div>
  )
}

// ─── CartPage ─────────────────────────────────────────────────────────────
export default function CartPage({ onBack }) {
  const [items, setItems] = useState(() => loadCart())

  const refresh = useCallback(() => setItems(loadCart()), [])

  function handleRemove(id) {
    removeFromCart(id)
    refresh()
  }

  function handlePriceChange(id, price) {
    updateCartItem(id, { price })
    refresh()
  }

  function handleClear() {
    clearCart()
    refresh()
  }

  // Totals
  const priced   = items.filter(i => i.price != null)
  const total    = priced.reduce((s, i) => s + Number(i.price), 0)
  const hasTotal = priced.length > 0

  // Group by source
  const singles = items.filter(i => i.source !== 'outfit')
  const outfits = items.filter(i => i.source === 'outfit')

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
          Carrello
          {items.length > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 12, fontWeight: 600,
              background: S.ink, color: 'white',
              padding: '2px 8px', borderRadius: 100,
              verticalAlign: 'middle',
            }}>{items.length}</span>
          )}
        </span>

        {items.length > 0 ? (
          <button
            onClick={handleClear}
            style={{ fontSize: 12, color: S.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: sans, fontWeight: 500 }}
          >Svuota</button>
        ) : <div style={{ width: 50 }} />}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 120px' }}>
        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <>
            {/* Singles */}
            {singles.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Capi singoli
                  <span style={{ background: S.tagBg, color: S.muted, fontSize: 9, padding: '2px 7px', borderRadius: 100 }}>{singles.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {singles.map(item => (
                    <CartItem
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemove(item.id)}
                      onPriceChange={(price) => handlePriceChange(item.id, price)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Outfit items */}
            {outfits.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Da outfit
                  <span style={{ background: 'rgba(200,168,130,0.15)', color: S.warm, fontSize: 9, padding: '2px 7px', borderRadius: 100 }}>{outfits.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {outfits.map(item => (
                    <CartItem
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemove(item.id)}
                      onPriceChange={(price) => handlePriceChange(item.id, price)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* ── Sticky total ── */}
      {items.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '16px 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          background: S.surface,
          borderTop: `1px solid ${S.border}`,
          boxShadow: '0 -8px 24px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 500 }}>
                {hasTotal
                  ? `${priced.length} di ${items.length} capi con prezzo`
                  : `${items.length} ${items.length === 1 ? 'capo' : 'capi'} nel carrello`}
              </div>
              {items.length > priced.length && (
                <div style={{ fontSize: 11, color: S.warm, marginTop: 2 }}>
                  {items.length - priced.length} senza prezzo
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Totale</div>
              <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: hasTotal ? S.ink : S.muted, lineHeight: 1 }}>
                {hasTotal ? `€ ${total.toFixed(2)}` : '—'}
              </div>
            </div>
          </div>

          {/* Open all links */}
          <button
            onClick={() => items.forEach(i => window.open(i.link, '_blank', 'noopener'))}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: 14,
              background: S.ink, border: 'none',
              color: 'white', fontFamily: sans, fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2h4v4M6 10L14 2M7 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-4"/>
            </svg>
            Apri tutti i link
          </button>
        </div>
      )}
    </div>
  )
}
