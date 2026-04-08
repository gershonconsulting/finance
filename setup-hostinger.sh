#!/bin/bash
# ============================================================
# ONE-TIME SERVER SETUP — finance.gershoncrm.com
# Run this ONCE on your Hostinger VPS after first SSH login
# Usage: bash setup-hostinger.sh
# ============================================================

set -e

DOMAIN="finance.gershoncrm.com"
APP_DIR="/var/www/finance"
APP_USER="www-data"

echo "======================================================"
echo " Hostinger VPS Setup: $DOMAIN"
echo "======================================================"

# ── 1. System update ──────────────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 20 LTS ─────────────────────────────────────
echo "[2/7] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

# ── 3. PM2 ────────────────────────────────────────────────
echo "[3/7] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ── 4. Nginx ──────────────────────────────────────────────
echo "[4/7] Installing nginx..."
apt-get install -y nginx
systemctl enable nginx

# ── 5. Certbot (Let's Encrypt SSL) ────────────────────────
echo "[5/7] Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# ── 6. App directory ──────────────────────────────────────
echo "[6/7] Creating app directory..."
mkdir -p $APP_DIR
chown -R root:root $APP_DIR

# ── 7. Nginx config ───────────────────────────────────────
echo "[7/7] Writing nginx config..."
cat > /etc/nginx/sites-available/$DOMAIN << 'NGINXCONF'
server {
    listen 80;
    server_name finance.gershoncrm.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── SSL cert ──────────────────────────────────────────────
echo ""
echo "======================================================"
echo " Getting SSL certificate..."
echo " Make sure DNS A record is already pointing here!"
echo "======================================================"
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@gershoncrm.com

echo ""
echo "======================================================"
echo " Setup complete!"
echo " Next: run ./deploy-hostinger.sh from your local machine"
echo "======================================================"
