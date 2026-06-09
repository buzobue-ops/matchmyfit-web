/**
 * LegalModals.jsx
 * Centralised legal-notice components for MatchMyFit / FitMyCart.
 *
 * Exports:
 *  - GdprBanner         sticky bottom-of-screen GDPR notice (dismissable)
 *  - ImageDisclaimerBox inline box shown on every photo-upload screen
 *  - AiAdviceDisclaimer inline banner shown next to AI search results
 *  - LegalModal         generic full-screen modal (title + body)
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'

// ─── Shared tokens (matches the app's warm palette) ───────────────────────────
const T = {
  ink:     '#111111',
  warm:    '#C8A882',
  warmBg:  'rgba(200,168,130,0.10)',
  muted:   '#8C8279',
  surface: '#FDFAF5',
  border:  '#E2DAD0',
  tagBg:   '#F0EAE0',
  blueBg:  'rgba(0,122,255,0.07)',
  blue:    '#007AFF',
  green:   '#3A7A3A',
  greenBg: '#E8F5E8',
}
const serif = "'Cormorant Garamond', serif"
const sans  = "'DM Sans', sans-serif"

// ─── Generic fullscreen legal modal ───────────────────────────────────────────
export function LegalModal({ title, children, onClose }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxHeight: '88vh',
          background: T.surface,
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 10px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: T.ink }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: T.tagBg, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: T.muted, fontFamily: sans,
            }}
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 20px 32px',
          fontFamily: sans, fontSize: 13, lineHeight: 1.6, color: T.muted,
        }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── GDPR Banner (sticky bottom) ──────────────────────────────────────────────
export function GdprBanner({ onAccept }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 888,
        background: 'rgba(253,250,245,0.97)',
        backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${T.border}`,
        padding: '14px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)',
        fontFamily: sans,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}>
        <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>
          FitMyCart tratta i tuoi dati personali secondo il GDPR (Reg.UE 2016/679).{' '}
          <button
            onClick={() => setShowModal(true)}
            style={{ color: T.warm, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: sans, textDecoration: 'underline', padding: 0 }}
          >
            Consulta l'Informativa Privacy
          </button>
          {' '}per dettagli su finalità, base giuridica, tempi di conservazione e diritti.
        </p>
        <button
          onClick={onAccept}
          style={{
            width: '100%', padding: '12px', borderRadius: 14,
            background: T.ink, color: 'white',
            fontFamily: sans, fontSize: 14, fontWeight: 600,
            border: 'none', cursor: 'pointer',
          }}
        >
          Ho capito, continua
        </button>
      </div>

      {showModal && (
        <LegalModal title="Informativa Privacy (GDPR)" onClose={() => setShowModal(false)}>
          <p style={{ marginBottom: 12 }}>
            I dati personali forniti dall'Utente (dati anagrafici, credenziali di accesso, foto del corpo, misure, abitudini di acquisto, ecc.) sono trattati da <strong>[Titolare del trattamento]</strong> in qualità di titolare.
          </p>
          <p style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>Finalità:</p>
          <ul style={{ paddingLeft: 16, marginBottom: 12 }}>
            <li style={{ marginBottom: 6 }}>(1) Fornire il servizio di personal shopper virtuale con tecnologia AI (Art.6(1)(b) GDPR, esecuzione del contratto).</li>
            <li style={{ marginBottom: 6 }}>(2) Analizzare immagini per individuare taglie e abbinamenti (profilazione automatica, Art.6(1)(a) con consenso esplicito).</li>
            <li style={{ marginBottom: 6 }}>(3) Inviare newsletter/promozioni se acconsentito (Art.6(1)(a)).</li>
          </ul>
          <p style={{ marginBottom: 12 }}>
            Non si effettua profilazione delle categorie "sensibili" senza tuo consenso esplicito.
          </p>
          <p style={{ marginBottom: 12 }}>
            I dati sono conservati solo per il tempo necessario al servizio (ad es. dati di acquisto fino a 2 anni dall'ultimo ordine), secondo i principi di minimizzazione e limitazione della conservazione (Art.5 GDPR).
          </p>
          <p style={{ marginBottom: 12 }}>
            Sono adottate misure di sicurezza adeguate (cifratura TLS, accessi protetti, log delle operazioni).
          </p>
          <p style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>I tuoi diritti:</p>
          <p style={{ marginBottom: 12 }}>
            Accesso, rettifica, cancellazione/"diritto all'oblio", limitazione, opposizione, portabilità — garantiti e descritti nell'Informativa estesa.
          </p>
          <p style={{ marginBottom: 12 }}>
            Non siamo responsabili di eventuali ripercussioni dovute a errori imputabili a terzi o a violazioni di limiti legali commesse dall'utente.
          </p>
          <p style={{ marginBottom: 12 }}>
            Contatti DPO: <strong>dpo@fitmycart.example</strong> (placeholder — sostituire con indirizzo reale).
          </p>
          <p style={{ marginBottom: 0, fontSize: 11, color: T.muted, fontStyle: 'italic' }}>
            ⚠️ Questo testo non sostituisce la consultazione del GDPR e del Codice Privacy. Consigliata revisione legale personalizzata.
          </p>
        </LegalModal>
      )}
    </>
  )
}

// ─── Image Disclaimer Box (shown on photo upload screens) ────────────────────
export function ImageDisclaimerBox() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div style={{
        background: T.warmBg,
        border: `1px solid ${T.warm}`,
        borderRadius: 14,
        padding: '11px 14px',
        marginBottom: 12,
        fontFamily: sans,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>📋</span>
          <div>
            <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.45, margin: 0 }}>
              Caricando una foto, dichiari di essere autorizzato a farlo. Non caricare immagini di altri o di minorenni senza permesso.{' '}
              <button
                onClick={() => setShowModal(true)}
                style={{ color: T.warm, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: sans, textDecoration: 'underline', padding: 0 }}
              >
                Leggi di più
              </button>
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <LegalModal title="Responsabilità Immagini & AI" onClose={() => setShowModal(false)}>
          <p style={{ fontWeight: 700, color: T.ink, marginBottom: 8, fontSize: 14 }}>
            📷 Responsabilità sulle immagini caricate
          </p>
          <p style={{ marginBottom: 10 }}>
            L'Utente dichiara e garantisce di avere titolo e consensi per le immagini caricate e solleva il Titolare da ogni responsabilità verso terzi (diritti di immagine, copyright, privacy).
          </p>
          <p style={{ marginBottom: 10 }}>
            È proibito caricare contenuti pedopornografici, violenti o diffamatori, nonché immagini riconducibili ad altre persone che non abbiano concesso esplicito consenso.
          </p>
          <p style={{ marginBottom: 10 }}>
            Nessuna foto ritraente <strong>minorenni</strong> potrà essere utilizzata senza l'autorizzazione di chi esercita la potestà genitoriale, come richiesto dalla normativa nazionale e dalle linee guida del Garante.
          </p>
          <p style={{ marginBottom: 16 }}>
            In caso di violazione, il Titolare si riserva di bloccare l'account e, se necessario, segnalare alle autorità competenti.
          </p>

          <div style={{ height: 1, background: T.border, margin: '16px 0' }} />

          <p style={{ fontWeight: 700, color: T.ink, marginBottom: 8, fontSize: 14 }}>
            🤖 Elaborazione AI delle immagini (AI Act UE 2024/1689)
          </p>
          <p style={{ marginBottom: 10 }}>
            L'App utilizza sistemi di Intelligenza Artificiale per generare o modificare immagini (es. "provare" vestiti sul modello fotografato).
          </p>
          <p style={{ marginBottom: 10 }}>
            In ottemperanza all'Art.25 del Regolamento UE 2024/1689 (AI Act) e alle linee-guida del Garante, tutte le immagini create o ritoccate dall'IA sono chiaramente contrassegnate come tali con un watermark o etichetta visibile ("IA", "Generato digitalmente").
          </p>
          <p style={{ marginBottom: 10 }}>
            Le immagini originali caricate rimangono di proprietà dell'utente e vengono trattate solo nei limiti dello scopo (miglioramento del servizio), non diffuse pubblicamente.
          </p>
          <p style={{ marginBottom: 10 }}>
            Ogni output IA è fornito "così come è" e può contenere imperfezioni o artefatti digitali. Utilizzando questa funzione, l'utente accetta che i risultati siano generati automaticamente da algoritmi.
          </p>
          <p style={{ fontSize: 11, color: T.muted, fontStyle: 'italic' }}>
            ⚠️ Consigliata revisione legale personalizzata per conformità specifica alla propria attività.
          </p>
        </LegalModal>
      )}
    </>
  )
}

// ─── AI Advice Disclaimer (shown next to search results) ─────────────────────
export function AiAdviceDisclaimer() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div style={{
        background: T.blueBg,
        borderRadius: 12,
        padding: '9px 13px',
        marginTop: 10,
        fontFamily: sans,
        display: 'flex', alignItems: 'flex-start', gap: 7,
      }}>
        <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
        <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.45, margin: 0 }}>
          I consigli di FitMyCart sono generati automaticamente e non costituiscono consulenza vincolante. Usali come suggerimenti orientativi.{' '}
          <button
            onClick={() => setShowModal(true)}
            style={{ color: T.blue, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: sans, textDecoration: 'underline', padding: 0 }}
          >
            Leggi
          </button>
        </p>
      </div>

      {showModal && (
        <LegalModal title="Disclaimer AI Consigli" onClose={() => setShowModal(false)}>
          <p style={{ marginBottom: 12 }}>
            Tutti i suggerimenti stilistici e di fitting forniti dall'App sono generati automaticamente e sono solo <strong>indicativi</strong>.
          </p>
          <p style={{ marginBottom: 12 }}>
            FitMyCart, i suoi sviluppatori e affiliati declinano ogni responsabilità per differenze fra la consigliata veste virtuale e quella effettiva del capo, problemi di acquisto, o insoddisfazione dei risultati.
          </p>
          <p style={{ marginBottom: 12 }}>
            L'utente riconosce che il software si basa su algoritmi di machine learning che possono produrre raccomandazioni imprecise. Nessuna dichiarazione o garanzia (esplicita o implicita) è fornita in merito alla precisione o adeguatezza dei consigli.
          </p>
          <p style={{ marginBottom: 12 }}>
            Le decisioni di acquisto basate sui suggerimenti sono sotto la <strong>sola responsabilità dell'utente</strong>. Il servizio FitMyCart è offerto "as is".
          </p>
          <p style={{ fontSize: 12, color: T.muted, fontStyle: 'italic' }}>
            <strong>N.B.:</strong> nulla di quanto sopra intende escludere le responsabilità inderogabili previste dalla legge a tutela del consumatore (art. Codice del Consumo) per dolo, colpa grave o danni alla salute.
          </p>
        </LegalModal>
      )}
    </>
  )
}
