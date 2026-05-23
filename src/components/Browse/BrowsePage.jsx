import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { addToCart } from '../../services/storageService.js'

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

// ─── Quick-access brand tiles ─────────────────────────────────────────────
const BRANDS = [
  { name: 'Zara',     url: 'https://www.zara.com/it/',          emoji: '🔲' },
  { name: 'H&M',      url: 'https://www2.hm.com/it_it/',        emoji: '🟥' },
  { name: 'ASOS',     url: 'https://www.asos.com/',             emoji: '🖤' },
  { name: 'Zalando',  url: 'https://www.zalando.it/',           emoji: '🟠' },
  { name: 'Mango',    url: 'https://shop.mango.com/it/',        emoji: '🟡' },
  { name: 'Pull&Bear',url: 'https://www.pullandbear.com/it/',   emoji: '🐻' },
  { name: 'Bershka',  url: 'https://www.bershka.com/it/',      emoji: '🔵' },
  { name: 'Stradivarius', url: 'https://www.stradivarius.com/it/', emoji: '🌿' },
  { name: 'Nike',     url: 'https://www.nike.com/it/',          emoji: '✔️' },
  { name: 'Adidas',   url: 'https://www.adidas.it/',            emoji: '🦓' },
  { name: 'Uniqlo',   url: 'https://www.uniqlo.com/it/',        emoji: '🔴' },
  { name: 'Amazon Fashion', url: 'https://www.amazon.it/s?rh=n%3A1772418031', emoji: '📦' },
]

// ─── Add-link action sheet ─────────────────────────────────────────────────
function AddSheet({ url, onClose, onDone }) {
  const [name, setName] = useState('')
  const [added, setAdded] = useState(null) // 'search' | 'outfit' | null

  // Try to extract a hostname as default name
  let hostname = url
  try { hostname = new URL(url).hostname.replace('www.', '') } catch { /* */ }

  function handleAdd(source) {
    const id = crypto.randomUUID()
    addToCart({
      id,
      name: name.trim() || hostname,
      link: url,
      price: null,
      source,
    })
    setAdded(source)
    setTimeout(() => { onDone(source); onClose() }, 900)
  }

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.5)', zIndex: 100 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
        background: S.surface, borderRadius: '28px 28px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.14)',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ width: 40, height: 4, background: S.border, borderRadius: 2, margin: '12px auto 16px' }} />
        <div style={{ padding: '0 24px 24px' }}>

          {added ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
              <span style={{ fontSize: 44 }}>✅</span>
              <p style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: S.ink }}>
                {added === 'search' ? 'Aggiunto come Capo Singolo' : 'Aggiunto all\'Outfit'}
              </p>
            </div>
          ) : (
            <>
              {/* URL preview */}
              <div style={{
                background: S.tagBg, borderRadius: 14,
                padding: '10px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2" strokeLinecap="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
                <span style={{ fontSize: 11, color: S.muted, flex: 1, wordBreak: 'break-all', lineHeight: 1.4 }}>
                  {url.length > 70 ? url.slice(0, 70) + '…' : url}
                </span>
              </div>

              {/* Optional name */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 8 }}>
                  Nome prodotto (opzionale)
                </div>
                <input
                  type="text"
                  placeholder={hostname}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'white', border: `1.5px solid ${S.border}`,
                    borderRadius: 14, padding: '12px 14px',
                    fontFamily: sans, fontSize: 14, color: S.ink, outline: 'none',
                  }}
                />
              </div>

              {/* Action buttons */}
              <p style={{ fontSize: 11, color: S.muted, textAlign: 'center', marginBottom: 14 }}>
                Aggiungi questo link a:
              </p>

              <button
                onClick={() => handleAdd('search')}
                style={{
                  width: '100%', padding: '15px 20px', borderRadius: 16, marginBottom: 10,
                  background: S.ink, border: 'none', cursor: 'pointer',
                  color: 'white', fontFamily: sans, fontSize: 15, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H5v10a1 1 0 001 1h12a1 1 0 001-1V10h1.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/>
                </svg>
                Capo Singolo — analizza fit
              </button>

              <button
                onClick={() => handleAdd('outfit')}
                style={{
                  width: '100%', padding: '15px 20px', borderRadius: 16, marginBottom: 10,
                  background: 'white', border: `1.5px solid ${S.border}`, cursor: 'pointer',
                  color: S.ink, fontFamily: sans, fontSize: 15, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>🪡</span>
                Aggiungi all'Outfit
              </button>

              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: 12, background: 'transparent', border: 'none',
                  color: S.muted, fontSize: 14, cursor: 'pointer', fontFamily: sans,
                }}
              >Annulla</button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── Install PWA hint ─────────────────────────────────────────────────────
function PwaHint({ onDismiss }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a1a, #2d2015)',
      borderRadius: 18, padding: '16px 18px',
      display: 'flex', gap: 14, alignItems: 'flex-start',
      marginBottom: 20, position: 'relative',
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>
          Installa FitMyCart
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
          Aggiungila all'Home Screen per attivare la condivisione rapida.
          Poi, in qualsiasi browser, usa <strong style={{ color: S.warm }}>Condividi → FitMyCart</strong> per inviare un link direttamente qui.
        </p>
      </div>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute', top: 10, right: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', fontSize: 16,
        }}
      >✕</button>
    </div>
  )
}

// ─── BrowsePage ───────────────────────────────────────────────────────────
export default function BrowsePage({ sharedUrl, onClearShared, onBack }) {
  const [query, setQuery]       = useState('')
  const [pastedUrl, setPastedUrl] = useState(sharedUrl || '')
  const [addSheetUrl, setAddSheetUrl] = useState(sharedUrl || null)
  const [showPwaHint, setShowPwaHint] = useState(
    () => localStorage.getItem('fmc_pwa_hint_dismissed') !== '1'
  )
  const [toast, setToast]       = useState(null)
  const inputRef = useRef(null)

  // If a shared URL arrived, open the sheet immediately
  useEffect(() => {
    if (sharedUrl) {
      setAddSheetUrl(sharedUrl)
      onClearShared?.()
    }
  }, [sharedUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissHint() {
    localStorage.setItem('fmc_pwa_hint_dismissed', '1')
    setShowPwaHint(false)
  }

  function handleSearch() {
    const q = query.trim()
    if (!q) return
    // If it looks like a URL, open directly; otherwise open Google search
    const url = q.startsWith('http') ? q : `https://www.google.com/search?q=${encodeURIComponent(q + ' sito:zara.com OR site:hm.com OR site:asos.com OR site:zalando.it')}`
    window.open(url, '_blank', 'noopener')
  }

  function handleOpenBrand(url) {
    window.open(url, '_blank', 'noopener')
  }

  function handlePasteSubmit() {
    const url = pastedUrl.trim()
    if (!url.startsWith('http')) return
    setAddSheetUrl(url)
  }

  function handleDone(source) {
    const msg = source === 'search' ? '✓ Pronto per l\'analisi fit' : '✓ Aggiunto all\'outfit'
    setToast(msg)
    setPastedUrl('')
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', background: S.surface, fontFamily: sans }}>

      {/* ── Nav ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(253,250,245,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${S.border}`,
        padding: 'env(safe-area-inset-top) 20px 0',
      }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            Cerca &amp; Aggiungi
          </span>
          <div style={{ width: 36 }} />
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && createPortal(
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: S.ink, color: 'white', borderRadius: 100,
          padding: '10px 20px', fontSize: 13, fontWeight: 600,
          zIndex: 200, whiteSpace: 'nowrap',
          animation: 'slideUp 0.2s ease',
          fontFamily: sans,
        }}>{toast}</div>,
        document.body
      )}

      <div style={{ padding: '20px 20px 60px' }}>

        {/* ── PWA install hint ── */}
        {showPwaHint && <PwaHint onDismiss={dismissHint} />}

        {/* ── Search bar ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 10 }}>
            Cerca nel web
          </div>
          <div style={{
            display: 'flex', gap: 8,
          }}>
            <div style={{
              flex: 1,
              background: 'white', border: `1.5px solid ${S.border}`,
              borderRadius: 16, padding: '13px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = S.warm}
              onBlurCapture={e => e.currentTarget.style.borderColor = S.border}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
              </svg>
              <input
                ref={inputRef}
                type="search"
                placeholder='Es. "maglione oversize bianco" o incolla un URL…'
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: sans, fontSize: 13, color: S.ink,
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: S.muted, fontSize: 16 }}>✕</button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={!query.trim()}
              style={{
                width: 48, borderRadius: 14,
                background: query.trim() ? S.ink : S.border,
                border: 'none', cursor: query.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13L13 3M3 3h10v10"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 11, color: S.muted, marginTop: 8, lineHeight: 1.5 }}>
            La ricerca apre il browser del tuo dispositivo — trova il prodotto, poi torna qui a incollare il link.
          </p>
        </div>

        {/* ── Brand grid ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 12 }}>
            Apri direttamente
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          }}>
            {BRANDS.map(brand => (
              <button
                key={brand.name}
                onClick={() => handleOpenBrand(brand.url)}
                style={{
                  background: 'white', border: `1.5px solid ${S.border}`,
                  borderRadius: 14, padding: '10px 6px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: sans,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = S.warm; e.currentTarget.style.background = S.tagBg }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = 'white' }}
              >
                <span style={{ fontSize: 18 }}>{brand.emoji}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: S.ink, textAlign: 'center', lineHeight: 1.2, letterSpacing: 0.3 }}>
                  {brand.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Paste URL section ── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 10 }}>
            Incolla il link del prodotto
          </div>

          <div style={{
            background: 'white', border: `1.5px solid ${S.border}`,
            borderRadius: 16, padding: '13px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 10,
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = S.warm}
            onBlurCapture={e => e.currentTarget.style.borderColor = S.border}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2" strokeLinecap="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            <input
              type="url"
              inputMode="url"
              placeholder="https://www.zara.com/it/…"
              value={pastedUrl}
              onChange={e => setPastedUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasteSubmit()}
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: sans, fontSize: 13, color: S.ink,
              }}
            />
            {pastedUrl && (
              <button onClick={() => setPastedUrl('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 16 }}>✕</button>
            )}
          </div>

          <button
            onClick={handlePasteSubmit}
            disabled={!pastedUrl.trim().startsWith('http')}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 16,
              background: pastedUrl.trim().startsWith('http') ? S.ink : S.border,
              color: pastedUrl.trim().startsWith('http') ? 'white' : S.muted,
              fontFamily: sans, fontSize: 15, fontWeight: 600,
              border: 'none', cursor: pastedUrl.trim().startsWith('http') ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Aggiungi questo link →
          </button>
        </div>

        {/* ── How-to steps ── */}
        <div style={{
          marginTop: 28,
          background: S.cream, border: `1px solid ${S.border}`,
          borderRadius: 18, padding: '16px 18px',
        }}>
          <p style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: S.ink, margin: '0 0 12px' }}>
            Come funziona
          </p>
          {[
            { n: '1', text: 'Cerca o apri un brand qui sopra → si apre il browser del tuo dispositivo' },
            { n: '2', text: 'Naviga e trova il prodotto che ti interessa' },
            { n: '3', text: 'Copia l\'URL dalla barra dell\'indirizzo (tieni premuto → Copia)' },
            { n: '4', text: 'Torna qui, incolla e scegli se analizzare come Capo Singolo o aggiungere all\'Outfit' },
            { n: '★', text: 'Se installi FitMyCart sull\'Home Screen, puoi usare "Condividi → FitMyCart" direttamente dal browser — zero copia-incolla!' },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: step.n === '★' ? S.warm : S.ink,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'white',
                fontFamily: sans,
              }}>{step.n}</div>
              <p style={{ fontSize: 12, color: S.muted, lineHeight: 1.5, margin: 0, flex: 1 }}>{step.text}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── Add sheet ── */}
      {addSheetUrl && (
        <AddSheet
          url={addSheetUrl}
          onClose={() => setAddSheetUrl(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
