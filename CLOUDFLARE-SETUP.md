# Duhahe Market - Cloudflare Hosting Setup
# Domain: duhaherwandamarket.store
# Goal: Host the full app (frontend + backend) on Cloudflare

## Prerequisites
- Cloudflare account (you have the domain registered)
- Node.js >= 18 installed

## Step 1: Deploy API to Cloudflare Workers

### 1.1 Initialize Worker (already done - wrangler.toml created)
Your API app is at `apps/api/` with Express + MongoDB.

### 1.2 Update wrangler.toml (already created at apps/api/wrangler.toml)
The config I created supports your Express app. Make sure your `src/server.ts` is compatible with Cloudflare Workers runtime (using esbuild output).

### 1.3 Deploy the Worker
```bash
# From apps/api directory
npx wrangler deploy
```

### 1.4 After deployment note the URL
Your API will be at: `duhahe-api.your-subdomain.workers.dev`

## Step 2: Deploy Admin to Cloudflare Pages

### 2.1 Build the admin app (already built)
```bash
npm run build -w @duhahe/admin
# Output: apps/admin/dist/
```

### 2.2 Create Pages project via Cloudflare Dashboard
1. Go to https://dash.cloudflare.com/pages
2. Click "Create a project"
3. Select "Import from Git" (or "Deploy manually")
4. If using Git: Connect your GitHub/GitLab/Bitbucket repo
5. If manual: Upload the `apps/admin/dist/` folder

### 2.3 Deploy settings
- Framework: Vite
- Build command: `npm run build -w @duhahe/admin` (or leave blank if manual deploy)
- Output directory: `apps/admin/dist`
- Root directory: `apps/admin`

### 2.4 After deployment note the URL
Your admin app will be at: `duhahe-admin.your-subdomain.pages.dev`

## Step 3: Configure Cloudflare DNS for duhaherwandamarket.store

### 3.1 In Cloudflare DNS (for duhaherwandamarket.store)

Add these records:

| Type | Name | Value | Proxy | TTL |
|------|------|-------|-------|-----|
| CNAME | `www` | `duhahe-admin.your-subdomain.pages.dev` | 🟡 Proxied | Auto |
| CNAME | `api` | `duhahe-api.your-subdomain.workers.dev` | 🌑 DNS only | Auto |
| A | `@` | `172.64.0.1` | 🟡 Proxied | Auto *(Cloudflare Pages IP)* |
| A | `@` | `172.64.0.2` | 🟡 Proxied | Auto *(Cloudflare Pages IP)* |
| A | `@` | `172.64.0.3` | 🟡 Proxied | Auto *(Cloudflare Pages IP)* |
| A | `@` | `172.64.0.4` | 🟡 Proxied | Auto *(Cloudflare Pages IP)* |

**Note**: After adding the domain in Cloudflare Pages, it will show you the exact CNAME/A records to use.

### 3.2 SSL/TLS Configuration
- Go to **SSL/TLS** → **Full** (or Full-strict)
- This enables HTTPS for your domain

### 3.3 Page Rules (Optional)
Set up routing:
- `duhaherwandamarket/store/*` → Forward to your Pages URL
- `api.duhaherwandamarket/store/*` → Forward to your Workers URL

## Step 4: Configure API Base URL

Your frontend (admin app) needs to know the API URL. Update your env vars:

### 4.1 In apps/admin/.env or vite.config.ts
```env
VITE_API_URL=https://api.duhaherwandamarket.store
```

### 4.2 Or in your API calls
```javascript
// Example fetch in your React app
const API_BASE = 'https://api.duhaherwandamarket.store';
fetch(`${API_BASE}/api/...`)
```

## Step 5: Test Your Setup

### 5.1 Visit your domain
```
https://duhaherwandamarket.store
```
Should show your admin dashboard.

### 5.2 Test API
```
https://api.duhaherwandamarket.store/health
```
or whatever your health check endpoint is.

### 5.3 Verify SSL
Both `https://duhaherwandamarket.store` and `https://api.duhaherwandamarket.store` should show valid SSL.

## Step 6: Wait for Propagation
- DNS changes: 2-10 minutes
- Full propagation: Up to 24 hours (usually faster)
- Use: [whatsmydns.net](https://whatsmydns.net) to check

## Commands Summary

```bash
# Build admin
npm run build -w @duhahe/admin

# Deploy worker (from apps/api)
npx wrangler deploy

# Check Cloudflare dashboard for Pages deployment

# Verify DNS propagation
# Visit: whatsmydns.net for duhaherwandamarket.store
```

## Notes
- Your Express API uses MongoDB - you'll need to set up a Cloudflare D1 database or keep using your existing MongoDB
- Environment variables (MONGO_URI, JWT_SECRET, etc.) need to be set in Cloudflare Workers dashboard → Your Worker → Settings → Variables
- The admin app build is already complete in `apps/admin/dist/`