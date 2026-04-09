#!/bin/bash
# Run this on the VPS to pull latest code and restart
# Usage: bash /var/www/finance/deploy/update.sh

APP_DIR="/var/www/finance"

cd $APP_DIR
git pull origin main
npm install --omit=dev --quiet
systemctl restart gershon-finance
echo "Updated and restarted."
systemctl status gershon-finance --no-pager
