#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="/home/lavaa/iadorefrogs-site"
API_DIR="/opt/frogs-api"
NGX_SITE="/etc/nginx/sites-available/iadorefrogs"
SERVICE="/etc/systemd/system/frogs-api.service"

echo "[1/7] Ensure packages"
sudo apt-get update -y
sudo apt-get install -y nginx nodejs npm rsync curl

echo "[2/7] Sync API code to ${API_DIR}"
sudo mkdir -p "$API_DIR"
sudo rsync -a "${SITE_ROOT}/server/" "$API_DIR/"
cd "$API_DIR"
sudo npm install --omit=dev

echo "[3/7] Seed runtime data dirs"
sudo mkdir -p "${SITE_ROOT}/system/data" "${SITE_ROOT}/system/chat/rooms"
if [ ! -f "${SITE_ROOT}/system/chat/rooms/public.txt" ]; then
  echo "[]" | sudo tee "${SITE_ROOT}/system/chat/rooms/public.txt" >/dev/null
fi
if [ ! -f "${SITE_ROOT}/system/data/users.json" ]; then
  sudo tee "${SITE_ROOT}/system/data/users.json" >/dev/null <<'JSON'
[
  { "username": "Agu", "password": "Banana2004!", "tier": "devmode" }
]
JSON
fi
if [ ! -f "${SITE_ROOT}/system/data/admin.json" ]; then
  sudo tee "${SITE_ROOT}/system/data/admin.json" >/dev/null <<'JSON'
{ "order": [], "hidden": [], "pinned": [], "perApp": {} }
JSON
fi
sudo chown -R www-data:www-data "${SITE_ROOT}/system/data" "${SITE_ROOT}/system/chat/rooms"
sudo chmod -R 770 "${SITE_ROOT}/system/data" "${SITE_ROOT}/system/chat/rooms"

echo "[4/7] Install systemd service"
sudo cp -f "${SITE_ROOT}/server/frogs-api.service" "$SERVICE"
sudo systemctl daemon-reload
sudo systemctl enable --now frogs-api

echo "[5/7] Configure nginx"
sudo cp -f "${SITE_ROOT}/server/nginx-site.conf" "$NGX_SITE"
sudo ln -sf "$NGX_SITE" /etc/nginx/sites-enabled/iadorefrogs
sudo nginx -t
sudo systemctl reload nginx

echo "[6/7] Health checks"
curl -fsS http://127.0.0.1:3000/api/health || true
curl -fsS http://127.0.0.1/api/health || true

echo "[7/7] Done. Visit your site via Cloudflare."
