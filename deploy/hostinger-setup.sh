#!/bin/bash

# Gershon Finance - Hostinger VPS Setup Script
# Run once as root after SSHing into your VPS:
# bash hostinger-setup.sh

set -e

APP_DIR="/var/www/finance"
APP_USER="www-data"
DOMAIN="finance.gershoncrm.com"

echo "=== Installing system packages ==="
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx git curl

echo "=== Installing Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "=== Cloning repo ==="
mkdir -p $APP_DIR
git clone https://github.com/gershonconsulting/finance.git $APP_DIR
cd $APP_DIR

echo "=== Installing Node dependencies ==="
npm install --omit=dev

echo "=== Creating systemd service ==="
cat > /etc/systemd/system/gershon-finance.service <<EOF
[Unit]
Description=Gershon Finance Dashboard
After=network.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable gershon-finance
systemctl start gershon-finance

echo "=== Configuring Nginx ==="
cat > /etc/nginx/sites-available/gershon-finance <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/gershon-finance /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "=== Setting up SSL with Let's Encrypt ==="
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@gershoncrm.com

echo ""
echo "=== DONE ==="
echo "Live at: https://$DOMAIN"
echo "Health:  https://$DOMAIN/api/health"
echo ""
echo "Useful commands:"
echo "  systemctl status gershon-finance    # check app status"
echo "  systemctl restart gershon-finance   # restart app"
echo "  journalctl -u gershon-finance -f    # view logs"
