#!/bin/bash
# Double-click this file in Finder to install (first time only) and start
# Public Reputation on your own computer. It opens automatically at
# http://localhost:3000 once ready — leave this window open while using it.

cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "----------------------------------------------------------------"
  echo "Node.js is not installed on this computer."
  echo "Install it from https://nodejs.org (LTS version), then double-click"
  echo "this file again."
  echo "----------------------------------------------------------------"
  read -p "Press Enter to close this window..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing dependencies (this takes a minute)..."
  npm install
fi

if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

echo ""
echo "Starting Public Reputation..."
echo "Once you see 'Ready', open http://localhost:3000 in your browser."
echo "Leave this window open. Press Control+C here to stop the app."
echo ""

npm run dev
