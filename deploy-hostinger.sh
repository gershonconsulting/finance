#!/bin/bash
# ============================================================
# DEPLOY to finance.gershoncrm.com (Hostinger VPS)
# Run from your LOCAL machine after each update
# Usage: bash deploy-hostinger.sh
# ============================================================

set -e

# ── CONFIG — set your VPS IP here ─────────────────────────
VPS_IP="YOUR_VPS_IP"   # <── Replace with your Hostinger VPS IP
VPS_USER="root"
APP_DIR="/var/www/finance"
DOMAIN="finance.gershoncrm.com"
# ──────────────────────────────────────────────────────────

if [ "$VPS_IP" = "YOUR_VPS_IP" ]; then
  echo "ERROR: Set VPS_IP at the top of this script first."
  exit 1
fi

echo "======================================================"
echo " Deploying to $DOMAIN ($VPS_IP)"
echo "======================================================"

# ── 1. Build ──────────────────────────────────────────────
echo "[1/4] Building..."
npm run build

# ── 2. Verify ─────────────────────────────────────────────
echo "[2/4] Running pre-deploy checks..."
bash verify-deploy.sh

# ── 3. Sync files to VPS ──────────────────────────────────
echo "[3/4] Uploading files to VPS..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '*.md' \
  --exclude '.env*' \
  ./ $VPS_USER@$VPS_IP:$APP_DIR/

# Install production deps on server
ssh $VPS_USER@$VPS_IP "cd $APP_DIR && npm install --omit=dev"

# ── 4. Restart app ────────────────────────────────────────
echo "[4/4] Restarting app with PM2..."
ssh $VPS_USER@$VPS_IP "cd $APP_DIR && pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs && pm2 save"

echo ""
echo "======================================================"
echo " Deploy complete!"
echo " Live at: https://$DOMAIN"
echo " Health:  https://$DOMAIN/api/health"
echo "======================================================"

# Quick smoke test
sleep 3
curl -sf https://$DOMAIN/api/health && echo "Health check passed" || echo "WARNING: health check failed — check server logs"
