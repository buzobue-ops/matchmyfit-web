const crypto = require('crypto')

const EMAIL_PROVIDER = 'email'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
  } catch {
    return false
  }
}

function makeSessionToken(userId) {
  const payload = `${userId}:${Date.now()}`
  const sig = crypto.createHmac('sha256', process.env.AUTH_SECRET || 'matchmyfit-dev-secret')
    .update(payload)
    .digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

function profileFromRow(row) {
  if (!row) return null
  return {
    id: row.user_id,
    userId: row.user_id,
    email: row.email,
    username: row.username,
    displayName: row.display_name || row.username,
    authProvider: EMAIL_PROVIDER,
    height: row.height != null ? Number(row.height) : null,
    bodySizes: {
      height: row.height != null ? Number(row.height) : null,
      chest: row.chest != null ? Number(row.chest) : null,
      waist: row.waist != null ? Number(row.waist) : null,
      hips: row.hips != null ? Number(row.hips) : null,
      shoulders: row.shoulders != null ? Number(row.shoulders) : null,
      inseam: row.inseam != null ? Number(row.inseam) : null,
    },
    onboardingStep: 2,
    createdAt: row.created_at,
  }
}

async function ensureEmailUsersTable(db) {
  if (!db) return
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_users (
      user_id       TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username      TEXT NOT NULL,
      display_name  TEXT,
      height        NUMERIC,
      chest         NUMERIC,
      waist         NUMERIC,
      hips          NUMERIC,
      shoulders     NUMERIC,
      inseam        NUMERIC,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS email_users_email_idx ON email_users (LOWER(email));
  `)
}

async function proxyOnboarding(onboardingUrl, body, timeoutMs = 60000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(onboardingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { raw: text } }
  } catch (err) {
    clearTimeout(timer)
    console.error('[auth/onboarding]', err.message)
    return null
  }
}

async function syncEmailUserToN8n(onboardingUrl, user, imageBase64) {
  const userId = user.user_id
  const measurements = {
    height: user.height != null ? Number(user.height) : null,
    chest: user.chest != null ? Number(user.chest) : null,
    waist: user.waist != null ? Number(user.waist) : null,
    hips: user.hips != null ? Number(user.hips) : null,
    shoulders: user.shoulders != null ? Number(user.shoulders) : null,
    inseam: user.inseam != null ? Number(user.inseam) : null,
  }

  await proxyOnboarding(onboardingUrl, {
    step: 'username',
    userId,
    username: user.username,
    timestamp: new Date().toISOString(),
  }, 15000)

  await proxyOnboarding(onboardingUrl, {
    step: 'measurements',
    userId,
    measurements,
    timestamp: new Date().toISOString(),
    source: 'ios_manual_register',
  }, 30000)

  if (imageBase64) {
    await proxyOnboarding(onboardingUrl, {
      step: 'photo',
      userId,
      imageBase64,
      imageSizeBytes: Math.round((imageBase64.length * 3) / 4),
      timestamp: new Date().toISOString(),
    }, 90000)
  }

  const profile = profileFromRow(user)
  await proxyOnboarding(onboardingUrl, {
    step: 'complete',
    userId,
    profile: {
      userId,
      username: user.username,
      email: user.email,
      displayName: user.display_name || user.username,
      authProvider: EMAIL_PROVIDER,
      createdAt: user.created_at || new Date().toISOString(),
      height: profile.height,
      bodySizes: profile.bodySizes,
    },
    timestamp: new Date().toISOString(),
  }, 30000)
}

async function lookupEmailUser(db, { providerUserId, email }) {
  if (!db) return null
  let rows
  if (providerUserId) {
    ;({ rows } = await db.query('SELECT * FROM email_users WHERE user_id = $1 LIMIT 1', [providerUserId]))
  }
  if ((!rows || !rows.length) && email) {
    ;({ rows } = await db.query('SELECT * FROM email_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]))
  }
  return rows?.[0] || null
}

// ─── Rate limiting (in-memory, per IP) ─────────────────────────────────────
// Blocks credential brute-force / registration spam without external deps.
const rateBuckets = new Map()

function rateLimited(key, maxHits, windowMs) {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { hits: 1, resetAt: now + windowMs })
    return false
  }
  bucket.hits += 1
  return bucket.hits > maxHits
}

// Periodic cleanup so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key)
  }
}, 10 * 60 * 1000).unref()

function clientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown'
}

function registerAuthEmailRoutes(app, db, { onboardingUrl }) {
  if (db) {
    ensureEmailUsersTable(db).catch(err => console.error('[auth] table init:', err.message))
  }

  app.post('/api/auth/register', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database unavailable' })
    if (rateLimited(`reg:${clientIP(req)}`, 10, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Troppi tentativi. Riprova tra qualche minuto.' })
    }

    const {
      email,
      password,
      username,
      displayName,
      height,
      chest,
      waist,
      hips,
      shoulders,
      inseam,
      imageBase64,
    } = req.body || {}

    const normalizedEmail = String(email || '').trim().toLowerCase()
    const cleanUsername = String(username || '').trim()
    const cleanPassword = String(password || '')

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({ error: 'Email non valida' })
    }
    if (cleanPassword.length < 8) {
      return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' })
    }
    if (!cleanUsername) {
      return res.status(400).json({ error: 'Username obbligatorio' })
    }
    if (height == null || Number(height) <= 0) {
      return res.status(400).json({ error: 'Altezza obbligatoria' })
    }

    try {
      const existing = await db.query('SELECT 1 FROM email_users WHERE LOWER(email) = $1', [normalizedEmail])
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Email già registrata' })
      }

      const userId = crypto.randomUUID()
      const passwordHash = hashPassword(cleanPassword)
      const { rows } = await db.query(
        `INSERT INTO email_users
          (user_id, email, password_hash, username, display_name, height, chest, waist, hips, shoulders, inseam)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          userId,
          normalizedEmail,
          passwordHash,
          cleanUsername,
          String(displayName || cleanUsername).trim(),
          Number(height),
          chest != null ? Number(chest) : null,
          waist != null ? Number(waist) : null,
          hips != null ? Number(hips) : null,
          shoulders != null ? Number(shoulders) : null,
          inseam != null ? Number(inseam) : null,
        ]
      )

      const user = rows[0]
      const token = makeSessionToken(userId)
      const profile = profileFromRow(user)

      // Rispondi subito — la sync n8n può richiedere 1–2 minuti in background.
      res.status(201).json({
        userId,
        email: normalizedEmail,
        username: user.username,
        displayName: user.display_name,
        token,
        profile,
      })

      syncEmailUserToN8n(onboardingUrl, user, imageBase64 || null)
        .catch(err => console.error('[auth/register] n8n sync:', err.message))
    } catch (err) {
      console.error('[auth/register]', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/auth/login', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email e password obbligatorie' })
    }
    if (rateLimited(`login:${clientIP(req)}`, 20, 15 * 60 * 1000)
      || rateLimited(`login:${normalizedEmail}`, 10, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Troppi tentativi. Riprova tra qualche minuto.' })
    }

    try {
      const { rows } = await db.query(
        'SELECT * FROM email_users WHERE LOWER(email) = $1 LIMIT 1',
        [normalizedEmail]
      )
      const user = rows[0]
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Email o password non corretti' })
      }

      const token = makeSessionToken(user.user_id)
      res.json({
        userId: user.user_id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        token,
        profile: profileFromRow(user),
      })
    } catch (err) {
      console.error('[auth/login]', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  return {
    lookupEmailUser: (providerUserId, email) => lookupEmailUser(db, { providerUserId, email }),
    profileFromRow,
    EMAIL_PROVIDER,
  }
}

module.exports = { registerAuthEmailRoutes, ensureEmailUsersTable }
