/**
 * Fallback production build when `vite build` hangs.
 * Output goes to dist/ — same layout as Vite (upload dist/ to Aruba).
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(fileURLToPath(import.meta.url), '..', '..')
const dist = path.join(root, 'dist')
const assets = path.join(dist, 'assets')

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!existsSync(envPath)) return {}
  const out = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const env = loadEnv()
const hash = createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 8)
const jsName = `index-${hash}.js`

mkdirSync(assets, { recursive: true })

console.log('📦  esbuild bundle…')
await build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'src/main.jsx')],
  bundle: true,
  outfile: path.join(assets, jsName),
  format: 'esm',
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  loader: {
    '.jsx': 'jsx',
    '.js': 'js',
    '.png': 'file',
    '.css': 'empty',
  },
  assetNames: '[name]-[hash]',
  publicPath: './',
  define: {
    // Vite-only global: without this, import.meta.env is undefined at runtime
    // and the whole bundle crashes at module load (blank page).
    'import.meta.env.BASE_URL': JSON.stringify('./'),
    'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || '/matchmyfit'),
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || ''),
    'import.meta.env.VITE_APPLE_SERVICE_ID': JSON.stringify(env.VITE_APPLE_SERVICE_ID || ''),
    'import.meta.env.VITE_APPLE_REDIRECT_URI': JSON.stringify(env.VITE_APPLE_REDIRECT_URI || ''),
    'import.meta.env.MODE': JSON.stringify('production'),
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
  },
})

// CSS: reuse the newest CSS from the last Vite build (esbuild doesn't process Tailwind)
import { readdirSync, statSync } from 'fs'
const cssFiles = readdirSync(assets)
  .filter(f => f.startsWith('index-') && f.endsWith('.css'))
  .sort((a, b) => statSync(path.join(assets, b)).mtimeMs - statSync(path.join(assets, a)).mtimeMs)
if (!cssFiles.length) {
  console.error('❌  Nessun CSS in dist/assets — esegui prima una build Vite completa.')
  process.exit(1)
}
const cssName = cssFiles[0]

// Static root files
for (const name of ['icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'figure.png']) {
  const src = path.join(root, 'dist', name)
  const pub = path.join(root, 'public', name)
  if (existsSync(src)) copyFileSync(src, path.join(dist, name))
  else if (existsSync(pub)) copyFileSync(pub, path.join(dist, name))
  else if (name === 'figure.png' && existsSync(path.join(root, 'src/assets/figure.png'))) {
    copyFileSync(path.join(root, 'src/assets/figure.png'), path.join(dist, name))
  }
}

if (existsSync(path.join(root, 'public', '.htaccess'))) {
  copyFileSync(path.join(root, 'public', '.htaccess'), path.join(dist, '.htaccess'))
}

// PHP API (sostituisce Railway Express)
const apiSrc = path.join(root, 'api')
if (existsSync(apiSrc)) {
  execSync(`cp -r "${apiSrc}" "${path.join(dist, 'api')}"`)
}

const html = `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="FitMyCart" />
    <meta name="theme-color" content="#111111" />
    <link rel="icon" type="image/png" href="./icon.png" />
    <link rel="apple-touch-icon" href="./icon-192.png" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <title>FitMyCart</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@200;300;400;500;600&display=swap" rel="stylesheet">
    <script type="text/javascript" src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"></script>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <script type="module" crossorigin src="./assets/${jsName}"></script>
    <link rel="stylesheet" crossorigin href="./assets/${cssName}">
  </head>
  <body class="bg-ios-bg" style="margin:0;background:#F5F0E8;min-height:100%">
    <div id="root"></div>
  </body>
</html>
`
writeFileSync(path.join(dist, 'index.html'), html)

// Remove stale JS bundles (keep current + css + figure png)
try {
  for (const f of execSync(`ls "${assets}"`, { encoding: 'utf8' }).trim().split('\n')) {
    if (f.startsWith('index-') && f.endsWith('.js') && f !== jsName) {
      execSync(`rm "${path.join(assets, f)}"`)
    }
  }
} catch { /* ignore */ }

console.log('')
console.log('✅  Build OK → dist/')
console.log(`   JS: assets/${jsName}`)
console.log(`   CSS: assets/${cssName}`)
