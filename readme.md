Team members: Dhara, Bhavya, and Prajith

Submission for Ai collective hackathon september 2026.

## Project structure

- `idea.md` — the plan. Read this first.
- `web/` — the app (Next.js + TypeScript + Tailwind). Everything we build lives here.
- `Wilderness North/` — challenge data (not in git; get it from Prajith).

## Getting started

```bash
git clone https://github.com/prajithravisankar/ai_collective_sep_2026.git
cd ai_collective_sep_2026/web
npm install
npm run dev   # open http://localhost:3000
```

## Where to build (see idea.md for full task lists)

- Person A1 (packing logic): `web/lib/packing.ts` (stub with TODOs)
- Person A2 (flight logic): `web/lib/flights.ts` (stub with TODOs)
- Person B (UI): `web/app/entry/`, `web/app/picking/`, `web/app/flights/` pages
- Person C (3D view): starts after the MVP is deployed

Shared types are in `web/lib/types.ts`. CSV parsing already works: `web/lib/csv.ts`.

## Deployment (Vercel)

The app auto-deploys on every push to `main`:
1. vercel.com → Add New Project → import this repo
2. Set **Root Directory** to `web` (only setting that matters)
3. Deploy. Every `git push` updates the live URL.

Rule: if `npm run build` fails locally, don't push — that's what breaks the live site.
