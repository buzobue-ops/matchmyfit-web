/**
 * ConsentStep.jsx
 * Onboarding consent screen — 5 required checkboxes before proceeding.
 * Also exports helpers used by App.jsx and OnboardingFlow.jsx.
 */

import { useState } from 'react'
import { LegalModal } from './LegalModals.jsx'

const STORAGE_KEY = 'mmf_consents_v1'

const serif = "'Cormorant Garamond', serif"
const sans  = "'DM Sans', sans-serif"

const T = {
  ink:    '#111111',
  warm:   '#C8A882',
  muted:  '#8C8279',
  surface:'#FDFAF5',
  border: '#E2DAD0',
  tagBg:  '#F0EAE0',
  blue:   '#007AFF',
  red:    '#C94040',
}

// ─── Persistence helpers ──────────────────────────────────────────────────────
export function saveConsents(values) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...values, timestamp: new Date().toISOString() }))
}

export function hasConsented() {
  try {
    const c = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return !!(c && c.privacy && c.images && c.age && c.aiEdit && c.aiAdvice)
  } catch { return false }
}

// ─── Single checkbox row ──────────────────────────────────────────────────────
function CheckRow({ id, checked, onChange, children, onReadMore }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 0',
        borderBottom: `1px solid ${T.border}`,
        cursor: 'pointer',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 18, height: 18, accentColor: T.warm, flexShrink: 0, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, fontFamily: sans }}>
        {children}
        {onReadMore && (
          <>
            {' '}
            <button
              type="button"
              onClick={e => { e.preventDefault(); onReadMore() }}
              style={{ color: T.warm, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: sans, textDecoration: 'underline', padding: 0 }}
            >
              Leggi
            </button>
          </>
        )}
      </span>
    </label>
  )
}

// ─── ConsentStep ──────────────────────────────────────────────────────────────
export default function ConsentStep({ onAccept }) {
  const [checks, setChecks] = useState({ privacy: false, images: false, age: false, aiEdit: false, aiAdvice: false })
  const [modal, setModal] = useState(null) // 'gdpr' | 'images' | 'ai-image' | 'ai-advice'

  const allChecked = Object.values(checks).every(Boolean)

  function toggle(key, val) {
    setChecks(prev => ({ ...prev, [key]: val }))
  }

  function handleAccept() {
    if (!allChecked) return
    saveConsents(checks)
    onAccept()
  }

  return (
    <div style={{ fontFamily: sans }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
        <h1 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
          Prima di iniziare
        </h1>
        <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }}>
          Leggi e accetta le condizioni per usare FitMyCart
        </p>
      </div>

      {/* Checkboxes */}
      <div style={{ background: 'white', border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '0 16px', marginBottom: 20 }}>
        <CheckRow
          id="consent-privacy"
          checked={checks.privacy}
          onChange={v => toggle('privacy', v)}
          onReadMore={() => setModal('gdpr')}
        >
          Ho letto e accetto l'<strong>Informativa Privacy (GDPR)</strong> e il trattamento dei miei dati personali per l'erogazione del servizio.
        </CheckRow>

        <CheckRow
          id="consent-images"
          checked={checks.images}
          onChange={v => toggle('images', v)}
          onReadMore={() => setModal('images')}
        >
          Dichiaro di essere <strong>autorizzato alle immagini</strong> che caricherò e sollevo il titolare da responsabilità verso terzi.
        </CheckRow>

        <CheckRow
          id="consent-age"
          checked={checks.age}
          onChange={v => toggle('age', v)}
        >
          Confermo di avere <strong>almeno 16 anni</strong> (o di agire con consenso del genitore/tutore se minorenne).
        </CheckRow>

        <CheckRow
          id="consent-aiedit"
          checked={checks.aiEdit}
          onChange={v => toggle('aiEdit', v)}
          onReadMore={() => setModal('ai-image')}
        >
          Accetto che le immagini caricate vengano <strong>elaborate dall'IA</strong> (AI Act UE 2024/1689, Art.25) e possano essere utilizzate per migliorare il servizio.
        </CheckRow>

        <CheckRow
          id="consent-aiadvice"
          checked={checks.aiAdvice}
          onChange={v => toggle('aiAdvice', v)}
          onReadMore={() => setModal('ai-advice')}
        >
          Comprendo che i <strong>consigli di taglia e stile</strong> sono generati automaticamente e sono solo indicativi, non vincolanti.
        </CheckRow>
      </div>

      {/* CTA */}
      <button
        onClick={handleAccept}
        disabled={!allChecked}
        style={{
          width: '100%', padding: 15, borderRadius: 16,
          background: allChecked ? T.ink : T.border,
          color: allChecked ? 'white' : T.muted,
          fontFamily: sans, fontSize: 15, fontWeight: 600,
          border: 'none', cursor: allChecked ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
        }}
      >
        Accetta e continua
      </button>

      <p style={{ fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
        Spuntando tutte le caselle potrai utilizzare FitMyCart.<br />
        Puoi revocare i consensi in qualsiasi momento dalle impostazioni.
      </p>

      {/* Modals */}
      {modal === 'gdpr' && (
        <LegalModal title="Informativa Privacy (GDPR)" onClose={() => setModal(null)}>
          <p style={{ marginBottom: 12 }}>
            I tuoi dati personali (dati anagrafici, credenziali, foto, misure, abitudini di acquisto) sono trattati dal Titolare per fornire il servizio di personal shopper AI.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Base giuridica:</strong> esecuzione del contratto (Art.6(1)(b)) e consenso esplicito (Art.6(1)(a)) per l'elaborazione di immagini e profilazione.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Conservazione:</strong> dati di acquisto fino a 2 anni dall'ultimo ordine; foto elaborate per il tempo strettamente necessario.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>I tuoi diritti:</strong> accesso, rettifica, cancellazione, limitazione, opposizione, portabilità — esercitabili scrivendo al DPO: <strong>dpo@fitmycart.example</strong>.
          </p>
          <p style={{ fontSize: 11, color: T.muted, fontStyle: 'italic' }}>
            ⚠️ Testo indicativo — consigliata revisione legale personalizzata.
          </p>
        </LegalModal>
      )}

      {modal === 'images' && (
        <LegalModal title="Responsabilità Immagini" onClose={() => setModal(null)}>
          <p style={{ marginBottom: 12 }}>
            Caricando immagini dichiari di possedere tutti i diritti necessari e di non violare diritti di terzi (copyright, privacy, immagine).
          </p>
          <p style={{ marginBottom: 12 }}>
            È vietato caricare immagini di minori senza consenso del genitore/tutore, contenuti violenti, diffamatori o pedopornografici.
          </p>
          <p style={{ marginBottom: 12 }}>
            In caso di violazione il Titolare si riserva di sospendere l'account e segnalare alle autorità competenti.
          </p>
        </LegalModal>
      )}

      {modal === 'ai-image' && (
        <LegalModal title="Elaborazione AI Immagini" onClose={() => setModal(null)}>
          <p style={{ marginBottom: 12 }}>
            L'app utilizza sistemi AI per analizzare le foto caricate e generare immagini di prova virtuale del capo.
          </p>
          <p style={{ marginBottom: 12 }}>
            In conformità all'AI Act UE 2024/1689 (Art.25), tutte le immagini generate dall'AI sono contrassegnate come tali.
          </p>
          <p style={{ marginBottom: 12 }}>
            Le immagini originali restano di tua proprietà e vengono usate esclusivamente per il servizio richiesto.
          </p>
        </LegalModal>
      )}

      {modal === 'ai-advice' && (
        <LegalModal title="Disclaimer AI Consigli" onClose={() => setModal(null)}>
          <p style={{ marginBottom: 12 }}>
            I consigli di taglia, vestibilità e stile sono generati da algoritmi di machine learning e sono <strong>solo indicativi</strong>.
          </p>
          <p style={{ marginBottom: 12 }}>
            FitMyCart non garantisce la precisione dei consigli. Le decisioni di acquisto sono sotto la sola responsabilità dell'utente.
          </p>
          <p style={{ fontSize: 11, color: T.muted, fontStyle: 'italic' }}>
            Nulla di quanto sopra esclude le responsabilità inderogabili previste dalla legge a tutela del consumatore.
          </p>
        </LegalModal>
      )}
    </div>
  )
}
