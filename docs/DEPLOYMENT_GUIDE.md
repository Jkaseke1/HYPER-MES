# GitHub Pages Deployment Guide

## Overview
This guide explains how to deploy HYPER MES frontend to GitHub Pages. The frontend connects to your existing Supabase backend.

---

## Prerequisites

1. **GitHub Account** with repository access
2. **Supabase Project** already set up and running
3. **Environment Variables** configured

---

## Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click **New Repository**
3. Name it `HYPER-MES` (or your preferred name)
4. Set to **Public** (required for free GitHub Pages)
5. Click **Create Repository**

---

## Step 2: Update Configuration

### Update `vite.config.ts`
Change the `base` path to match your repository name:

```typescript
base: '/YOUR-REPO-NAME/',
```

For example, if your repo is `HYPER-MES`:
```typescript
base: '/HYPER-MES/',
```

---

## Step 3: Set Up Environment Variables

### Option A: GitHub Secrets (Recommended)
1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

3. Update `.github/workflows/deploy.yml` build step:
```yaml
- name: Build
  run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

### Option B: Hardcode in Build (Less Secure)
Create `.env.production` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

⚠️ **Warning**: Don't commit secrets to public repos!

---

## Step 4: Push Code to GitHub

```bash
# Initialize git (if not already)
git init

# Add remote
git remote add origin https://github.com/YOUR-USERNAME/HYPER-MES.git

# Add all files
git add .

# Commit
git commit -m "Initial commit - HYPER MES"

# Push to main branch
git push -u origin main
```

---

## Step 5: Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. The workflow will auto-deploy on push to `main`

---

## Step 6: Verify Deployment

1. Go to **Actions** tab to see deployment progress
2. Once complete, your site is live at:
   ```
   https://YOUR-USERNAME.github.io/HYPER-MES/
   ```

---

## Updating the Site

Simply push changes to the `main` branch:

```bash
git add .
git commit -m "Your update message"
git push
```

GitHub Actions will automatically rebuild and deploy.

---

## Troubleshooting

### Blank Page After Deploy
- Check browser console for errors
- Verify `base` path in `vite.config.ts` matches repo name
- Ensure 404.html is in the `public` folder

### API Connection Issues
- Verify Supabase URL and key are correct
- Check Supabase dashboard for API errors
- Ensure Supabase project is active

### Build Failures
- Check Actions tab for error logs
- Run `npm run build` locally to test
- Verify all dependencies are in `package.json`

---

## Supabase Configuration

Ensure your Supabase project allows connections from GitHub Pages:

1. Go to Supabase Dashboard → **Settings** → **API**
2. Under **URL Configuration**, your site URL should work
3. No CORS changes needed - Supabase allows browser requests by default

---

## Team Access

Share the deployed URL with your team:
```
https://YOUR-USERNAME.github.io/HYPER-MES/
```

Each team member needs:
- The URL
- Their login credentials (created in Supabase Auth)

---

## Security Notes

1. **Anon Key is Safe**: The Supabase anon key is designed to be public
2. **RLS Protects Data**: Row Level Security policies control access
3. **Auth Required**: Users must log in to access data
4. **HTTPS**: GitHub Pages uses HTTPS by default
