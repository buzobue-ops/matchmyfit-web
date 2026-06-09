const express = require('express')
const cors = require('cors')
const path = require('path')
const { Pool } = require('pg')

// ─── PostgreSQL ─────────────────────────────────────────────────────────────
// Set DATABASE_URL in Railway environment variables.
// If not set, history API returns empty (graceful degradation).
let db = null
if (process.env.DATABASE_URL) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  })
  db.query(`
    CREATE TABLE IF NOT EXISTS searches (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      product_link     TEXT,
      product_name     TEXT,
      response_text    TEXT,
      image_url        TEXT,
      price            NUMERIC,
      recommended_size TEXT,
      status           TEXT DEFAULT 'pending',
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS searches_user_id_idx ON searches (user_id);
  `).then(() => console.log('[db] PostgreSQL connected & tables ready'))
    .catch(err => console.error('[db] init error:', err.message))
}

const app = express()
const PORT = process.env.PORT || 3001

// n8n webhook URLs
const N8N_ONBOARDING_URL    = 'https://buzobue.app.n8n.cloud/webhook/aa94f233-cc9b-416f-8cbf-a7c5fae268c4'
const N8N_CHECK_ACCOUNT_URL = 'https://buzobue.app.n8n.cloud/webhook/ea2e6b62-1998-4f9a-8c1f-3cd7409319c3'
const N8N_LINK_PAGE_URL     = 'https://buzobue.app.n8n.cloud/webhook/ed39425a-e716-4273-adf5-a8e7779d19bf'
// Custom Outfit — webhook OUTFIT workflow (ZZM9ZzbGJlX494N1)
const N8N_OUTFIT_URL = process.env.N8N_OUTFIT_URL || 'https://buzobue.app.n8n.cloud/webhook/0c23a3b1-895b-471a-a4eb-140c49c1b111'

// CORS: accetta richieste dal dominio Aruba e da localhost in sviluppo
const allowedOrigins = [
  'http://localhost:5173',
  'https://zerodb.studio',
  'https://www.zerodb.studio',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Permetti richieste senza origin (Postman, test) e quelle nella lista
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS bloccato per origine: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))

// Serve built frontend in production
app.use(express.static(path.join(__dirname, '../dist')))

// ─── Proxy helpers ─────────────────────────────────────────────────────────

async function proxyJSON(targetUrl, body, res, timeoutMs = 30000) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)

    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    // Forward all response headers that n8n sets
    const forwardHeaders = ['photofoldername', 'content-type']
    forwardHeaders.forEach(h => {
      const val = response.headers.get(h)
      if (val) res.setHeader(h, val)
    })

    res.status(response.status).json(data)
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Gateway timeout' })
    }
    console.error('[proxy error]', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Check if account exists (login flow)
app.post('/api/check-account', async (req, res) => {
  console.log('[check-account]', req.body)
  await proxyJSON(N8N_CHECK_ACCOUNT_URL, req.body, res, 15000)
})

// Onboarding steps (username, measurements, photo, complete)
app.post('/api/onboarding', async (req, res) => {
  console.log('[onboarding] step =', req.body.step)
  await proxyJSON(N8N_ONBOARDING_URL, req.body, res, 60000)
})

// Resume a Wait node (resumeUrl passed as query param)
app.post('/api/resume', async (req, res) => {
  const { resumeUrl } = req.query
  if (!resumeUrl) return res.status(400).json({ error: 'Missing resumeUrl' })
  console.log('[resume]', resumeUrl)
  await proxyJSON(resumeUrl, req.body, res, 300000) // 5 min — image generation can take 2+ min
})

// Profile update (photo + measurements)
app.post('/api/profile-update', async (req, res) => {
  console.log('[profile-update] userId =', req.body.userId)
  await proxyJSON('https://buzobue.app.n8n.cloud/webhook/matchmyfit-profile-update', req.body, res, 30000)
})

// Link search step
app.post('/api/search', async (req, res) => {
  console.log('[search] link =', req.body.link)
  await proxyJSON(N8N_LINK_PAGE_URL, req.body, res, 300000) // 5 min timeout like iOS
})

// Feedback
app.post('/api/feedback', async (req, res) => {
  console.log('[feedback] userId =', req.body.userId, 'rating =', req.body.rating)
  await proxyJSON('https://buzobue.app.n8n.cloud/webhook/matchmyfit-feedback', req.body, res, 10000)
})

// Custom Outfit (3 link → n8n outfit workflow)
app.post('/api/outfit', async (req, res) => {
  const { userId, links = {} } = req.body
  const searchId = `outfit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const outfitBody = {
    userId,
    searchId,
    top:    links.top    || null,
    mid:    links.mid    || null,
    bottom: links.bottom || null,
  }
  console.log('[outfit] userId =', userId, 'searchId =', searchId)
  await proxyJSON(N8N_OUTFIT_URL, outfitBody, res, 300000) // 5 min — 3 elaborazioni
})

// ─── OAuth relay callback (Soluzione B: HTTPS relay → matchmyfit:// scheme) ──
// Register https://matchmyfit.up.railway.app/api/oauth/callback in Google Cloud Console.
// Google redirects here with ?code=xxx, this endpoint redirects to the native scheme.
// This relay avoids the "invalid redirect URI" error with custom URL schemes.
app.get('/api/oauth/callback', (req, res) => {
  const { code, state, id_token, error } = req.query
  if (error) {
    return res.redirect(`matchmyfit://oauth?error=${encodeURIComponent(error)}`)
  }
  // Build the native deep link with all params Google sent
  const params = new URLSearchParams()
  if (code)     params.set('code', code)
  if (id_token) params.set('id_token', id_token)
  if (state)    params.set('state', state)
  params.set('provider', 'google')
  // Redirect to native scheme — iOS app intercepts matchmyfit://
  res.redirect(`matchmyfit://oauth?${params.toString()}`)
})

// POST version for Apple (Apple uses form_post response mode)
app.post('/api/oauth/callback', express.urlencoded({ extended: true }), (req, res) => {
  const { code, id_token, state, error } = req.body
  if (error) {
    return res.redirect(`matchmyfit://oauth?error=${encodeURIComponent(error)}`)
  }
  const params = new URLSearchParams()
  if (code)     params.set('code', code)
  if (id_token) params.set('id_token', id_token)
  if (state)    params.set('state', state)
  params.set('provider', 'apple')
  res.redirect(`matchmyfit://oauth?${params.toString()}`)
})

// ─── Image proxy (for PWA/Service Worker that blocks cross-origin Drive URLs) ─
// Usage: /api/image-proxy?url=https://drive.google.com/thumbnail?id=XXX&sz=w800
app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query
  if (!url || !url.startsWith('https://drive.google.com/')) {
    return res.status(400).send('Invalid URL')
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    const buf = await response.arrayBuffer()
    res.send(Buffer.from(buf))
  } catch (err) {
    res.status(502).send('Image proxy error')
  }
})

// ─── Search history API ────────────────────────────────────────────────────

// GET /api/history?userId=xxx  → array of search results for that user
app.get('/api/history', async (req, res) => {
  const { userId } = req.query
  if (!userId || !db) return res.json([])
  try {
    const { rows } = await db.query(
      `SELECT id, user_id, product_link, product_name, response_text,
              image_url, price, recommended_size, status, created_at
       FROM searches WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 200`,
      [userId]
    )
    res.json(rows.map(r => ({
      id:               r.id,
      userId:           r.user_id,
      productLink:      r.product_link,
      productName:      r.product_name,
      responseText:     r.response_text,
      responseImageUrl: r.image_url,
      productPrice:     r.price != null ? Number(r.price) : null,
      recommendedSize:  r.recommended_size,
      status:           r.status,
      createdAt:        r.created_at,
    })))
  } catch (err) {
    console.error('[history] GET error:', err.message)
    res.json([])
  }
})

// POST /api/history  → upsert a search result
app.post('/api/history', async (req, res) => {
  if (!db) return res.json({ ok: true })
  const r = req.body
  if (!r.id || !r.userId) return res.status(400).json({ error: 'Missing id or userId' })
  // Don't persist 'pending' to keep DB clean; only save completed/failed
  if (r.status === 'pending') return res.json({ ok: true })
  try {
    await db.query(`
      INSERT INTO searches
        (id, user_id, product_link, product_name, response_text,
         image_url, price, recommended_size, status, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (id) DO UPDATE SET
        product_name     = EXCLUDED.product_name,
        response_text    = EXCLUDED.response_text,
        image_url        = EXCLUDED.image_url,
        price            = EXCLUDED.price,
        recommended_size = EXCLUDED.recommended_size,
        status           = EXCLUDED.status,
        updated_at       = NOW()
    `, [
      r.id, r.userId, r.productLink, r.productName,
      r.responseText, r.responseImageUrl,
      r.productPrice ?? null, r.recommendedSize ?? null,
      r.status ?? 'completed',
    ])
    res.json({ ok: true })
  } catch (err) {
    console.error('[history] POST error:', err.message)
    res.json({ ok: false })
  }
})

// DELETE /api/history/:id  → delete a single search
app.delete('/api/history/:id', async (req, res) => {
  if (!db) return res.json({ ok: true })
  try {
    await db.query('DELETE FROM searches WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[history] DELETE error:', err.message)
    res.json({ ok: false })
  }
})

// DELETE /api/history?userId=xxx  → clear all searches for a user
app.delete('/api/history', async (req, res) => {
  if (!db || !req.query.userId) return res.json({ ok: true })
  try {
    await db.query('DELETE FROM searches WHERE user_id = $1', [req.query.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error('[history] DELETE all error:', err.message)
    res.json({ ok: false })
  }
})

// SPA fallback – serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`MatchMyFit server running on http://localhost:${PORT}`)
})
