# Deploy Landing Page to EC2 (bridge.neviljobanputra.com)

This guide will help you deploy the Bridge AI landing page to your EC2 instance on the subdomain `bridge.neviljobanputra.com`.

## Prerequisites

1. EC2 instance running Ubuntu/Debian (or similar Linux)
2. Domain name configured with DNS access
3. SSH access to your EC2 instance
4. Node.js 18+ installed on EC2

## Step 1: Build the Web Version

On your EC2 instance, navigate to the project directory and build:

```bash
# Install dependencies (if not already done)
npm install

# Build the web version
npx expo export --platform web

# This will create a 'dist' folder with static files
```

## Step 2: Install Nginx

```bash
# Update package list
sudo apt update

# Install Nginx
sudo apt install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 3: Configure Nginx for bridge.neviljobanputra.com

Create the Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/bridge.neviljobanputra.com
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name bridge.neviljobanputra.com;

    root /var/www/bridge.neviljobanputra.com;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache HTML files
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }
}
```

## Step 4: Create Web Directory and Deploy Files

```bash
# Create web directory
sudo mkdir -p /var/www/bridge.neviljobanputra.com

# Copy built files (adjust path if your dist folder is elsewhere)
sudo cp -r dist/* /var/www/bridge.neviljobanputra.com/

# Set proper permissions
sudo chown -R www-data:www-data /var/www/bridge.neviljobanputra.com
sudo chmod -R 755 /var/www/bridge.neviljobanputra.com
```

## Step 5: Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/bridge.neviljobanputra.com /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

## Step 6: Configure DNS

Add an A record in your domain's DNS settings:

```
Type: A
Name: bridge
Value: <your-ec2-public-ip>
TTL: 3600
```

Wait for DNS propagation (can take a few minutes to hours).

## Step 7: Set Up SSL with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d bridge.neviljobanputra.com

# Follow the prompts to complete setup
# Certbot will automatically configure Nginx and set up auto-renewal
```

## Step 8: Update API Endpoints (If Needed)

If your backend API is on a different domain, update `config/api.ts` before building:

```typescript
// Update the base URL to your backend API
export const API_BASE_URL = 'https://api.neviljobanputra.com'; // or your backend URL
```

Then rebuild:
```bash
npx expo export --platform web
sudo cp -r dist/* /var/www/bridge.neviljobanputra.com/
sudo systemctl reload nginx
```

## Step 9: Set Up Auto-Deployment Script

Create a deployment script for easy updates:

```bash
nano ~/deploy-landing.sh
```

Add:

```bash
#!/bin/bash

echo "🚀 Deploying Bridge AI Landing Page..."

# Navigate to project directory
cd /path/to/your/project

# Pull latest changes
git pull origin main

# Install dependencies (if package.json changed)
npm install

# Build web version
npx expo export --platform web

# Copy to web directory
sudo cp -r dist/* /var/www/bridge.neviljobanputra.com/

# Set permissions
sudo chown -R www-data:www-data /var/www/bridge.neviljobanputra.com

# Reload Nginx
sudo systemctl reload nginx

echo "✅ Deployment complete!"
```

Make it executable:
```bash
chmod +x ~/deploy-landing.sh
```

## Troubleshooting

### Check Nginx Status
```bash
sudo systemctl status nginx
```

### Check Nginx Error Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### Check Nginx Access Logs
```bash
sudo tail -f /var/log/nginx/access.log
```

### Test DNS Resolution
```bash
nslookup bridge.neviljobanputra.com
```

### Verify Files Are in Place
```bash
ls -la /var/www/bridge.neviljobanputra.com/
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

## Firewall Configuration

Make sure ports 80 and 443 are open:

```bash
# For UFW (Ubuntu Firewall)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# For AWS Security Groups
# Add inbound rules:
# - HTTP (port 80) from 0.0.0.0/0
# - HTTPS (port 443) from 0.0.0.0/0
```

## Quick Reference Commands

```bash
# Build web version
npx expo export --platform web

# Deploy to web directory
sudo cp -r dist/* /var/www/bridge.neviljobanputra.com/
sudo chown -R www-data:www-data /var/www/bridge.neviljobanputra.com
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Next Steps

1. ✅ Landing page is deployed
2. ⏭️ Test the site: `https://bridge.neviljobanputra.com`
3. ⏭️ Set up monitoring (optional)
4. ⏭️ Configure CDN (optional, for better performance)

