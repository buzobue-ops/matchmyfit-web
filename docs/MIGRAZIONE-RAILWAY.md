# Migrazione da Railway a PHP + n8n (Aruba)

Questa guida descrive come dismettere Railway e far girare tutto su **Aruba** (frontend + API PHP) con **n8n** per la logica di business.

## Architettura

| Componente | Prima (Railway) | Dopo (Aruba + n8n) |
|---|---|---|
| Frontend SPA | `zerodb.studio/matchmyfit/` | Invariato |
| API proxy | Express su Railway | **PHP** in `matchmyfit/api/` |
| Database | PostgreSQL Railway | **MySQL Aruba** (opzionale) |
| Workflow AI / scraping | n8n Cloud | Invariato |
| OAuth relay (app iOS) | `*.railway.app/api/oauth/callback` | `zerodb.studio/matchmyfit/api/oauth/callback` |

## Cosa fa l'API PHP

- **Proxy verso n8n**: onboarding, search, outfit, profile-update, feedback, resume (con guard SSRF)
- **OAuth relay**: redirect HTTPS → `matchmyfit://` per Google/Apple Sign-In nell'app nativa
- **Image proxy**: thumbnail Google Drive (per la PWA)
- **History / quota / auth email**: MySQL locale (se configurato), altrimenti degrada gracefully come prima

## Deploy su Aruba

### 1. Carica i file

Dopo la build, carica l'intera cartella `dist/` in `/matchmyfit/` sul server:

```
/matchmyfit/
  index.html
  assets/
  api/              ← nuovo
    index.php
    config.php      ← da creare
    schema.sql
    lib/
    .htaccess
  .htaccess
```

### 2. Configura MySQL

1. Crea database e utente nel pannello Aruba
2. Esegui `api/schema.sql` una volta
3. Copia `api/config.example.php` → `api/config.php`
4. Compila host, nome DB, utente, password e `auth_secret`

Se **non** configuri MySQL:
- history resta solo in localStorage (già supportato)
- quota resta permissiva (come Express senza `DATABASE_URL`)
- auth email restituisce 503

### 3. Aggiorna OAuth (Google + Apple)

Sostituisci il redirect URI Railway con:

```
https://www.zerodb.studio/matchmyfit/api/oauth/callback
```

in Google Cloud Console e nel Service ID Apple.

### 4. Migra dati da Railway (opzionale)

Se avevi dati su PostgreSQL Railway:

```bash
# Export da Railway
pg_dump $DATABASE_URL --table=searches --table=usage_quotas --table=email_users > dump.sql

# Adatta tipi PostgreSQL → MySQL e importa su Aruba
```

Le tabelle hanno lo stesso schema logico (vedi `api/schema.sql`).

### 5. Spegni Railway

Dopo aver verificato che webapp e app iOS funzionano:

1. Elimina il servizio Railway
2. Elimina il database PostgreSQL Railway
3. Rimuovi le variabili `VITE_API_URL` che puntavano a Railway (default ora: `/matchmyfit`)

## Sviluppo locale

```bash
# Frontend (se hai il repo completo con Vite)
VITE_API_URL=http://localhost:8080/matchmyfit npm run dev

# API PHP
cd api && php -S localhost:8080
```

Per test rapido senza MySQL, l'API risponde comunque ai proxy n8n.

## n8n — nessuna modifica obbligatoria

I webhook n8n restano gli stessi. L'API PHP li chiama server-side (niente problemi CORS).

L'unico endpoint che il client chiama con `resumeUrl` dinamico (`/api/resume`) continua a passare dal server per evitare SSRF.

## Server Express (`server/`)

Marcato come **deprecato**. Utile solo per sviluppo locale con Node.js. Non serve più in produzione.
