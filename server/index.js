const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

// n8n webhook URLs (mirrors AppConfig.swift)
const N8N_ONBOARDING_URL = 'https://buzobue.app.n8n.cloud/webhook/aa94f233-cc9b-416f-8cbf-a7c5fae268c4'
const N8N_CHECK_ACCOUNT_URL = 'https://buzobue.app.n8n.cloud/webhook/ea2e6b62-1998-4f9a-8c1f-3cd7409319c3'
const N8N_LINK_PAGE_URL = 'https://buzobue.app.n8n.cloud/webhook/579403a2-94d1-4065-9959-19db0fc2c49c'

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
  await proxyJSON(resumeUrl, req.body, res, 60000)
})

// Link search step
app.post('/api/search', async (req, res) => {
  console.log('[search] link =', req.body.link)
  await proxyJSON(N8N_LINK_PAGE_URL, req.body, res, 300000) // 5 min timeout like iOS
})

// SPA fallback – serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`MatchMyFit server running on http://localhost:${PORT}`)
})
