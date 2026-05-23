#!/bin/bash
# ─── FitMyCart — Deploy automatico su Aruba via FTP ──────────────────────
# Uso: npm run deploy
# Prima: copia .env.deploy.example in .env.deploy e riempi le credenziali

set -e

# Carica credenziali FTP dal file .env.deploy (mai committato in git)
if [ -f ".env.deploy" ]; then
  export $(grep -v '^#' .env.deploy | xargs)
fi

# Controlla che le variabili siano impostate
if [ -z "$FTP_HOST" ] || [ -z "$FTP_USER" ] || [ -z "$FTP_PASS" ] || [ -z "$FTP_PATH" ]; then
  echo ""
  echo "❌  Credenziali FTP mancanti."
  echo "   Copia .env.deploy.example in .env.deploy e compila i campi."
  echo ""
  exit 1
fi

echo "📦  Build in corso..."
npm run build

echo "🚀  Upload su $FTP_HOST → $FTP_PATH"

# Usa lftp se disponibile (più affidabile), altrimenti ncftp/ftp
if command -v lftp &> /dev/null; then
  lftp -c "
    set ftp:ssl-allow no;
    open -u '$FTP_USER','$FTP_PASS' '$FTP_HOST';
    mirror --reverse --delete --verbose dist/ $FTP_PATH;
    bye
  "
elif command -v ncftpput &> /dev/null; then
  ncftpput -R -v -u "$FTP_USER" -p "$FTP_PASS" "$FTP_HOST" "$FTP_PATH" dist/*
else
  echo ""
  echo "⚠️  lftp non trovato. Installalo con: brew install lftp"
  echo "   Oppure carica manualmente la cartella dist/ su Aruba via FileZilla."
  echo ""
  echo "   File da caricare in $FTP_PATH:"
  ls dist/
  ls dist/assets/
  exit 1
fi

echo ""
echo "✅  Deploy completato! Visita https://www.zerodb.studio/matchmyfit/"
