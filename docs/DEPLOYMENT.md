# PharmaCare — Production Deployment & Infrastructure Guide

This document outlines the recommended production architecture, step-by-step deployment runbook, security hardening measures, and rollback procedures for the **PharmaCare Pharmacy Management System**.

---

## 1. System Architecture

```mermaid
flowchart TD
    Client["Client Web Browsers\n(Desktops / POS Terminals / Mobile)"] -->|HTTPS / Port 443| Nginx["Nginx Reverse Proxy & Web Server\n(SSL Termination via Let's Encrypt)"]

    subgraph HostServer ["Production Host Server (Linux VPS / Dedicated Server)"]
        Nginx -->|Static Assets /*| StaticApp["Frontend Build (/var/www/pharmacare/frontend/dist)"]
        Nginx -->|Reverse Proxy /api/v1/*| ExpressAPI["Express.js REST API (:5000)\n(Node.js Cluster managed by PM2)"]

        ExpressAPI -->|Persistent Disk| RxStorage["Private Prescription Uploads\n(/var/www/pharmacare/backend/uploads/prescriptions)"]
        ExpressAPI -->|TCP 3306 (Localhost)| MySQL["MySQL 8.0+ Database Server\n(pharmacare_db with Triggers & Row Locking)"]
    end

    ExpressAPI -.->|SMTP TLS :587| EmailProvider["SMTP Mail Server\n(Doctor Availability Notifications)"]
    Client -.->|Optional Auth| Firebase["Firebase Auth Service\n(Project: pharmacare-4ea64)"]
```

---

## 2. Infrastructure Comparison & Hosting Recommendations

| Hosting Model | Feasibility | Persistent Storage | Pros | Cons & Caveats |
| :--- | :--- | :--- | :--- | :--- |
| **Linux VPS (Ubuntu 22/24)**<br>*(DigitalOcean, Hetzner, AWS Lightsail)* | **Highly Recommended** | Full Local NVMe/SSD | Complete privacy control, predictable cost ($4–$10/mo), no ephemeral data loss, local MySQL latency < 1ms | Requires basic Linux server maintenance |
| **Docker Compose on VPS** | **Recommended** | Docker Volume Mounts | Reproducible, isolated containers, simple multi-environment testing | Requires Docker engine and volume backups |
| **PaaS (Render / Railway / Fly.io)** | Conditional | Ephemeral by default | Automatic CI/CD | Free tiers wipe uploaded prescriptions on restart. Persistent disks require paid add-ons ($5–$15/mo) |
| **Serverless (Vercel / Netlify)** | Frontend Only | Not supported for backend | Fast global CDN for React | Backend cannot use persistent disk uploads without migrating to AWS S3 bucket |

> [!IMPORTANT]
> **Hosting Recommendation:** Deploy to a standard Linux VPS (Hetzner, DigitalOcean Droplet, or AWS Lightsail) running Ubuntu 24.04 LTS. This maintains strict compliance with medical record privacy laws and ensures prescription image files in `uploads/prescriptions` are not deleted on process restarts.

---

## 3. Step-by-Step Production Deployment (Ubuntu VPS)

### Step 1: Server Provisioning & Dependencies
Connect to your clean server via SSH:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx mysql-server

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 Process Manager globally
sudo npm install -g pm2
```

### Step 2: Configure Firewall & Database Security
```bash
# Secure firewall (Allow only SSH, HTTP, and HTTPS)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Secure MySQL installation
sudo mysql_secure_installation
```
Log in to MySQL as root and create the application database and isolated user:
```sql
CREATE DATABASE pharmacare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pharma_prod_user'@'localhost' IDENTIFIED BY 'GENERATE_A_SECURE_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON pharmacare_db.* TO 'pharma_prod_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 3: Clone Codebase & Install Dependencies
```bash
sudo mkdir -p /var/www/pharmacare
sudo chown -R $USER:$USER /var/www/pharmacare
cd /var/www/pharmacare

git clone https://github.com/your-org/pharmacare.git .

# Install backend dependencies
cd /var/www/pharmacare/backend
npm ci --production

# Install frontend dependencies and build production bundle
cd /var/www/pharmacare/frontend
npm ci
npm run build
```

### Step 4: Configure Production Environment Variables
In `/var/www/pharmacare/backend/.env`:
```ini
NODE_ENV=production
PORT=5000
API_PREFIX=/api/v1

DB_HOST=localhost
DB_PORT=3306
DB_USER=pharma_prod_user
DB_PASSWORD=YOUR_STRONG_DATABASE_PASSWORD
DB_NAME=pharmacare_db

JWT_SECRET=GENERATE_64_CHAR_RANDOM_SECRET_KEY
JWT_EXPIRES_IN=8h
BCRYPT_SALT_ROUNDS=12

CORS_ORIGIN=https://pharmacare.yourdomain.com

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500
AUTH_RATE_LIMIT_MAX=15
INQUIRY_RATE_LIMIT_MAX=20

SMTP_HOST=smtp.mailgun.org  # Or SendGrid / AWS SES / Postmark
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=YOUR_SMTP_API_PASSWORD
SMTP_FROM="PharmaCare Clinical Pharmacy" <noreply@yourdomain.com>
```

In `/var/www/pharmacare/frontend/.env`:
```ini
VITE_API_BASE_URL=/api/v1

VITE_FIREBASE_API_KEY=AIzaSyB1nOmKp23E9PVha0GZ-clRAKy51XiXmKM
VITE_FIREBASE_AUTH_DOMAIN=pharmacare-4ea64.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pharmacare-4ea64
VITE_FIREBASE_STORAGE_BUCKET=pharmacare-4ea64.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1085052601219
VITE_FIREBASE_APP_ID=1:1085052601219:web:5302dca761a65eb3fa6cb6
VITE_FIREBASE_MEASUREMENT_ID=G-96KMBWT2EW
```

### Step 5: Database Migration & Schema Setup
Run the initial Phase 3 schema and migration files:
```bash
cd /var/www/pharmacare/database
mysql -u pharma_prod_user -p pharmacare_db < 001_phase3_schema.sql
mysql -u pharma_prod_user -p pharmacare_db < migrations/001_inquiries_and_categories.sql
```

### Step 6: Start Backend with PM2
```bash
cd /var/www/pharmacare/backend
pm2 start src/server.js --name pharmacare-api -i max
pm2 save
pm2 startup
```

### Step 7: Configure Nginx & SSL
Create `/etc/nginx/sites-available/pharmacare`:
```nginx
server {
    listen 80;
    server_name pharmacare.yourdomain.com;

    # Maximum file upload size for doctor prescriptions
    client_max_body_size 10M;

    # Frontend Static SPA
    root /var/www/pharmacare/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy to Express REST API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable the configuration and issue SSL:
```bash
sudo ln -s /etc/nginx/sites-available/pharmacare /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue free Let's Encrypt SSL certificate
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pharmacare.yourdomain.com
```

---

## 4. Production Security Checklist

- [x] **Database Isolated:** MySQL binds only to `127.0.0.1`. Port 3306 is blocked by UFW firewall.
- [x] **Private Prescription Images:** Prescription uploads in `uploads/prescriptions` are not served as static web files; they are streamed through an authenticated endpoint with role checks and directory traversal validation.
- [x] **Security HTTP Headers:** Helmet is configured with Cross-Origin Resource Policy for prescription image streaming.
- [x] **Rate Limiting:** Global rate limit (500 req/15min), Auth rate limit (15 attempts/15min), and Public Inquiry limit (20 req/15min).
- [x] **Database Safety Triggers:** Strict SQL triggers prevent selling inactive, recalled, quarantined, or expired medicine batches.
- [x] **No Secrets in Frontend:** `.env` and sensitive backend credentials are excluded from frontend bundles.

---

## 5. Rollback Runbook

If a deployment fails, follow this rollback procedure immediately:

1. **Revert Git Version:**
   ```bash
   cd /var/www/pharmacare
   git checkout <PREVIOUS_STABLE_COMMIT_HASH>
   ```
2. **Rebuild Frontend:**
   ```bash
   cd frontend && npm ci && npm run build
   ```
3. **Restart API Server:**
   ```bash
   cd ../backend && npm ci --production && pm2 restart pharmacare-api
   ```
4. **Restore Database if Migration Failed:**
   ```bash
   node scripts/restore-db.js --db pharmacare_db --force-production ../database/backups/<LAST_BACKUP>.sql
   ```
5. **Verify System Health:**
   ```bash
   curl -I https://pharmacare.yourdomain.com/api/v1/health
   ```
