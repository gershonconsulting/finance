# Gershon Finance - Hostinger Deployment Summary

## Key Commands

**Initial Setup (run once on fresh VPS):**
```bash
curl -o setup.sh https://raw.githubusercontent.com/gershonconsulting/finance/main/deploy/hostinger-setup.sh && bash setup.sh
```

**Service Management:**
- Status check: `systemctl status gershon-finance`
- View logs: `journalctl -u gershon-finance -n 20`
- Live logs: `journalctl -u gershon-finance -f`
- Restart: `systemctl restart gershon-finance`

**Updates (run on VPS to pull latest code):**
```bash
cd /var/www/finance && bash deploy/update.sh
```

**SSL/Certificates:**
- Check certificates: `certbot certificates`
- Renew: `certbot renew --dry-run`

**Verification:**
- Web test: `curl https://finance.gershoncrm.com`
- Health check: `curl https://finance.gershoncrm.com/api/health`

## Setup Overview

The automated script installs Node.js 20, nginx, and certbot, clones the repository,
configures a systemd service running `node server.js` on port 3000, sets up nginx as
a reverse proxy, and obtains a Let's Encrypt SSL certificate.
Expected duration: 5-10 minutes.

## DNS Configuration

At your domain registrar, add an A record pointing `finance.gershoncrm.com` to your
Hostinger VPS IP with TTL 300.

## Post-Deploy

Update the Xero OAuth redirect URI in your Xero developer portal to:
`https://finance.gershoncrm.com/auth/callback`
