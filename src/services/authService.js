// Google and Apple Sign-In helpers for the web.
// Both return a normalized { id, email, displayName, authProvider } object.

import { GOOGLE_CLIENT_ID, APPLE_SERVICE_ID, APPLE_REDIRECT_URI } from '../config.js'

// ─── Google Sign In ───────────────────────────────────────────────────────
// Uses the Google Identity Services (GIS) popup flow.
// The GIS script is loaded in index.html.

export function initGoogleSignIn(callback) {
  if (!window.google?.accounts?.id) {
    console.warn('[auth] Google GIS not loaded yet')
    return
  }
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      try {
        const payload = decodeJWT(response.credential)
        callback({
          id: payload.sub,
          email: payload.email,
          displayName: payload.name,
          authProvider: 'google',
          googleAccessToken: response.credential, // raw JWT
        })
      } catch (e) {
        console.error('[auth] Failed to decode Google JWT', e)
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  })
}

export function renderGoogleButton(elementId) {
  if (!window.google?.accounts?.id) return
  window.google.accounts.id.renderButton(document.getElementById(elementId), {
    theme: 'outline',
    size: 'large',
    width: '100%',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
  })
}

export function promptGoogleOneTap() {
  window.google?.accounts?.id?.prompt()
}

// ─── Apple Sign In ────────────────────────────────────────────────────────
// Uses the Apple JS SDK loaded in index.html.
// Requires a Services ID configured in Apple Developer Portal.

export async function signInWithApple() {
  if (!window.AppleID?.auth) {
    throw new Error('Apple Sign In is not available.')
  }

  window.AppleID.auth.init({
    clientId: APPLE_SERVICE_ID,
    scope: 'name email',
    redirectURI: APPLE_REDIRECT_URI,
    usePopup: true,
  })

  const response = await window.AppleID.auth.signIn()
  const id_token = response.authorization?.id_token
  if (!id_token) throw new Error('No id_token from Apple')

  const payload = decodeJWT(id_token)
  const name = response.user?.name
  const displayName = name
    ? `${name.firstName || ''} ${name.lastName || ''}`.trim()
    : null

  return {
    id: payload.sub,
    email: payload.email || null,
    displayName,
    authProvider: 'apple',
  }
}

// ─── JWT decode (no verification – we trust the provider) ────────────────

function decodeJWT(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = atob(base64)
  return JSON.parse(json)
}
