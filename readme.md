Team members: Dhara, Bhavya, and Prajith

Submission for Ai collective hackathon september 2026.

**Live app: https://ai-collective-sep-2026.vercel.app** (auto-deploys from `main`)

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

## Where to build — your roadmap has your todo list

- Person A1 (packing logic): [roadmaps/person-a1-packing.md](roadmaps/person-a1-packing.md) → `web/lib/packing.ts`
- Person A2 (flight logic): [roadmaps/person-a2-flights.md](roadmaps/person-a2-flights.md) → `web/lib/flights.ts`
- Person B (UI): [roadmaps/person-b-ui.md](roadmaps/person-b-ui.md) → `web/app/` pages
- Person C (3D view, after MVP is deployed): [roadmaps/person-c-3d.md](roadmaps/person-c-3d.md)

Check off boxes in your roadmap as you go and push, so everyone sees progress.

Shared types are in `web/lib/types.ts`. CSV parsing already works: `web/lib/csv.ts`.

## Deployment (Vercel)

The app auto-deploys on every push to `main`:
1. vercel.com → Add New Project → import this repo
2. Set **Root Directory** to `web` (only setting that matters)
3. Deploy. Every `git push` updates the live URL.

Rule: if `npm run build` fails locally, don't push — that's what breaks the live site.
