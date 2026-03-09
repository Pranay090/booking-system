# Deploying the Booking System (Free Tier)

Free-tier stack:

| Service    | Provider        | Free Tier Limits                         |
|------------|-----------------|------------------------------------------|
| Frontend   | **Vercel**      | Unlimited for hobby projects             |
| Backend    | **Render**      | Sleeps after 15 min idle (~30s cold start) |
| PostgreSQL | **Neon**        | 0.5 GB storage, always available         |
| Redis      | **Upstash**     | 10,000 commands/day                      |

---

## Prerequisites

- Your code pushed to a **GitHub** repository
- Accounts on: [Neon](https://neon.tech), [Upstash](https://upstash.com), [Render](https://render.com), [Vercel](https://vercel.com)

---

## Step 1: Set Up PostgreSQL (Neon)

1. Go to [neon.tech](https://neon.tech) and create a project
2. Copy the **connection string** — it looks like:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Open the **SQL Editor** in the Neon dashboard
4. Paste and run the contents of `backend/sql/schema.sql` to create tables
5. Optionally run `backend/sql/seed.sql` for sample data

Save the connection string — you'll need it as `DATABASE_URL`.

---

## Step 2: Set Up Redis (Upstash)

1. Go to [upstash.com](https://upstash.com) and create a Redis database
2. Copy the **Redis URL** — it looks like:
   ```
   rediss://default:xxxxx@us1-xxx.upstash.io:6379
   ```

Save this — you'll need it as `REDIS_URL`.

---

## Step 3: Deploy Backend (Render)

### Option A: One-click with Blueprint

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render will detect `render.yaml` and set up the service
4. Fill in the environment variables it prompts for

### Option B: Manual setup

1. Go to Render → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Add these **environment variables:**

| Variable          | Value                                           |
|-------------------|-----------------------------------------------|
| `DATABASE_URL`    | Your Neon connection string                    |
| `REDIS_URL`       | Your Upstash Redis URL                         |
| `JWT_SECRET`      | A strong random string (e.g. `openssl rand -hex 32`) |
| `FRONTEND_URL`    | `https://your-app.vercel.app` (set after Step 4) |
| `ENABLE_WORKER`   | `true`                                         |
| `NODE_ENV`        | `production`                                   |

### Optional (for Google OAuth):

| Variable               | Value                                                  |
|------------------------|--------------------------------------------------------|
| `GOOGLE_CLIENT_ID`     | From Google Cloud Console                              |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console                              |
| `GOOGLE_CALLBACK_URL`  | `https://your-app.onrender.com/auth/google/callback`   |

5. Deploy and note your Render URL (e.g. `https://booking-system-api.onrender.com`)

---

## Step 4: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Angular (or Other)
   - **Output Directory:** `dist/frontend/browser`
4. Add this **environment variable:**

| Variable       | Value                                        |
|----------------|----------------------------------------------|
| `BACKEND_URL`  | `https://your-app.onrender.com` (from Step 3) |

5. Deploy! Note your Vercel URL (e.g. `https://booking-system.vercel.app`)

---

## Step 5: Connect Frontend ↔ Backend

Go back to your **Render** dashboard and update:

- `FRONTEND_URL` = `https://booking-system.vercel.app` (your Vercel URL)

This enables CORS and Google OAuth redirects.

---

## Step 6: (Optional) Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add **Authorized redirect URI:**
   ```
   https://your-app.onrender.com/auth/google/callback
   ```
4. Add **Authorized JavaScript origin:**
   ```
   https://your-app.vercel.app
   ```

---

## Local Development

Nothing changes for local dev. The default environment values still point to `localhost`:

```bash
# Backend
cd backend
cp ../.env.example .env   # edit values as needed
npm run dev                # API on http://localhost:3000
npm run dev:worker         # pricing worker (separate terminal)

# Frontend
cd frontend
npm start                  # App on http://localhost:4200
```

Or use Docker Compose as before:

```bash
docker compose up
```

---

## Troubleshooting

| Issue                          | Fix                                                        |
|--------------------------------|------------------------------------------------------------|
| Backend takes 30s to respond   | Normal — Render free tier cold start. First request wakes it up. |
| CORS errors in browser         | Ensure `FRONTEND_URL` on Render matches your Vercel URL exactly |
| Google OAuth redirect fails    | Check `GOOGLE_CALLBACK_URL` and Google Console redirect URIs |
| Database connection refused    | Verify `DATABASE_URL` is correct and Neon project is active |
| Redis connection error         | Verify `REDIS_URL` — Upstash uses `rediss://` (with TLS)  |
