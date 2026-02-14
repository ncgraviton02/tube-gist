# TubeGist - YouTube Video Summarizer

A newspaper-style web application that transforms YouTube videos into elegant, readable summaries using AI.

## Features

- **Clean Input**: Simply paste any YouTube URL
- **AI-Powered Analysis**: Uses Claude API to extract key insights from video transcripts
- **Newspaper Aesthetic**: Beautiful, editorial design inspired by classic print media
- **Smart History**: Tracks and displays your previous summaries
- **Secure Access**: Simple password protection for private use

## Design Philosophy

TubeGist presents video summaries like newspaper articles, with:
- Compelling headlines that capture the essence
- Key takeaways in digestible bullet points  
- Detailed analysis in readable paragraphs
- Notable quotes when available

## Typography & Style

- **Headlines**: Playfair Display (elegant serif)
- **Body Text**: Libre Baskerville (readable serif)
- **UI Elements**: Source Sans 3 (clean sans-serif)
- **Colors**: Muted editorial palette
- **Layout**: Clean, spacious, professional

## Tech Stack

- **Frontend**: Astro (SSG/SSR)
- **Hosting**: Cloudflare Pages
- **Database**: Cloudflare D1
- **AI**: Anthropic Claude API
- **Styling**: Custom CSS with newspaper aesthetics

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:4321` and use password: `yoyoballusingh`

## Deployment

See [DEPLOY.md](./DEPLOY.md) for complete deployment instructions to Cloudflare Pages.

## Project Structure

```
src/
├── components/
│   └── Layout.astro          # Main layout with typography
├── pages/
│   ├── index.astro          # Main app with URL input
│   ├── login.astro          # Password authentication
│   └── api/
│       ├── auth.ts          # Authentication endpoint
│       ├── history.ts       # Summaries history
│       └── summarize.ts     # YouTube processing
└── migrations/
    └── 0001_create_summaries.sql
```

## License

MIT