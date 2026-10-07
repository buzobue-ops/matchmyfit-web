# Alpha: Framing try-on → scatto

Fitting room **on-device** (MediaPipe Pose + overlay capo) per inquadrare e scattare.
Nessun credito Decart/AI in streaming.

## URL

`https://www.zerodb.studio/matchmyfit/tryon/`  
File: `dist/tryon/index.html`

(La demo Decart realtime resta in `dist/tryon-decart/`.)

## Flusso alpha (fino allo scatto)

1. Carica immagine capo (file o URL)
2. Scegli tipo: top / bottom
3. Apri fitting room → camera + overlay geometrico sulle landmark
4. Regola scala / offset / opacità
5. **Scatta** → preview + salva JPEG

Lo scatto è anche in `sessionStorage` (`mmf_tryon_shot`) per un futuro handoff al flusso analisi in-app.

## Limiti (voluti in alpha)

- Overlay geometrico, non fotorealistico
- Meglio capi ritagliati su sfondo chiaro
- Richiede HTTPS + permesso camera
- CORS può bloccare URL esterni → usa upload file

## Prossimo passo (dopo feedback)

Handoff dello scatto al flusso search/analisi già consolidato.
