# TubeGist Deployment Guide

## Cloudflare Pages Deployment

### Step 1: Manual Deployment via Dashboard

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. Create a new project
3. Connect to the GitHub repository: `ncgraviton02/tube-gist`
4. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`

### Step 2: Environment Variables

In the Cloudflare Pages dashboard, add these environment variables:

- `ANTHROPIC_API_KEY`: Your Claude API key

### Step 3: D1 Database Setup

1. Create D1 database:
   ```bash
   wrangler d1 create tube-gist-db
   ```

2. Apply migrations:
   ```bash
   wrangler d1 migrations apply tube-gist-db
   ```

3. Update `wrangler.toml` with the database ID returned from step 1

4. Bind the database to your Pages project in the dashboard

### Step 4: Domain Setup

The app will be available at your Cloudflare Pages URL once deployed.

## Local Development

```bash
npm install
npm run dev
```

## Features

- YouTube video transcript extraction
- AI-powered summarization with Claude
- Newspaper-style design
- Password authentication (`yoyoballusingh`)
- History of past summaries

## Tech Stack

- Astro + Cloudflare Pages
- Claude API for summarization
- D1 for data storage
- TypeScript