# Live Try-On Alpha (Decart Lucy VTON)

Try-on **realistico in realtime** via WebRTC + modello `lucy-vton-latest` (Decart).

Riferimento ufficiale: [mobile-fitting-room](https://github.com/DecartAI/tryon-examples/tree/main/examples/mobile-fitting-room).

## Cosa c’è nell’alpha

| Pezzo | Dove |
|---|---|
| Fitting room UI | `dist/tryon/index.html` → `/matchmyfit/tryon/` |
| Mint token efimero | `POST /matchmyfit/api/decart/token` (PHP) |
| API key permanente | solo in `api/config.php` → `decart_api_key` |

Il browser **non** vede la key `dct_…`: riceve un client token a breve scadenza.

## Deploy rapido

1. Carica `dist/` su Aruba (include `tryon/` e `api/`).
2. Su server, in `matchmyfit/api/config.php`, imposta:
   ```php
   'decart_api_key' => 'dct_…',
   ```
3. Apri: `https://www.zerodb.studio/matchmyfit/tryon/`
4. Carica l’immagine di un capo → **Entra nella fitting room** → concedi la camera.

## Sicurezza

- La key che hai incollato in chat è esposta nello storico: **ruotala** su [platform.decart.ai](https://platform.decart.ai) dopo il primo test.
- `api/config.php` e `dist/api/config.php` sono in `.gitignore`.
- Token Decart: TTL 5 min, modello solo VTON, sessione max 3 min.

## Limiti alpha

- Richiede HTTPS + camera (meglio smartphone in verticale).
- Capo: immagine pulita su sfondo chiaro → risultati migliori.
- Prompt in inglese più stabili.
- Non ancora integrato nel flusso search/outfit della webapp principale (standalone page).
- Costi Decart a consumo (realtime credits).

## Dev locale (Express)

```bash
DECART_API_KEY=dct_… node server/index.js
# oppure PHP: config.php + php -S …
```

Apri la try-on page servita dalla stessa origin dell’API.
