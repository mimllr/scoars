# Scoars

A live NHL scoreboard built with Next.js. Pulls real-time scores, period breakdowns, and goal timelines from ESPN's public API, refreshing every 30 seconds. Designed to look great on mobile.

## Stack

- **Next.js 15** (App Router)
- **ESPN API** — scoreboard and game summary endpoints, no key required
- **Vercel** — hosting and edge functions

## Features

- Live scores with auto-refresh every 30 seconds
- Period-by-period scoring breakdown
- Goal timeline with scorer, assists, and strength (PP/SH)
- Dynamic OG image generated at the edge for iMessage/social previews
- iOS-style device frame on desktop, full-screen on mobile

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The OG image is previewable at [http://localhost:3000/api/og](http://localhost:3000/api/og).

## Deployment

Deployed automatically via Vercel on push to `master`.
