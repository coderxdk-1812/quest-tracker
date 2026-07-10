# Zenith

A gamified study & task-management app for students — XP, levels, coins, streaks, a shop,
achievements, a focus mode, a timetable, friends/leaderboard, and **personalised daily
quests** with a **local (no-API) task-breakdown engine** that turns any assignment into an
ordered, do-able "quest line".

Built with Vite + React + TypeScript + Tailwind + shadcn/ui, with Supabase for auth and data.

---

## Quick start

```bash
# 1. Install dependencies (npm, or use bun/pnpm/yarn)
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env with your Supabase project values (see below)

# 3. Run the dev server
npm run dev

# 4. Production build
npm run build && npm run preview
```

## Scripts

| Command            | What it does                          |
|--------------------|---------------------------------------|
| `npm run dev`      | Start the Vite dev server             |
| `npm run build`    | Production build to `dist/`           |
| `npm run preview`  | Preview the production build          |
| `npm run lint`     | Run ESLint                            |
| `npm test`         | Run the Vitest suite                  |

## Environment variables

All client-side and `VITE_`-prefixed (safe to expose; the Supabase *publishable* key is
designed for browser use). Set them in `.env`:

```
VITE_SUPABASE_PROJECT_ID=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=https://<project>.supabase.co
```

## Supabase setup

1. Create a project at https://supabase.com.
2. Apply the SQL in `supabase/migrations/` (in filename order) via the Supabase SQL editor
   or the Supabase CLI (`supabase db push`). These create the `tasks`, `game_state`,
   `timetable_entries`, `task_completions`, `daily_quests`, `friendships`, `notifications`,
   and `ai_tokens` tables with row-level security.
3. Enable Email auth (and any OAuth providers you want) under Authentication.
4. Copy your project URL, project id, and publishable/anon key into `.env`.

---

## The local Quest Breakdown engine (no API, no paid plans)

`src/lib/questBreakdown.ts` is a fully local, deterministic engine that classifies a task
into one of 10 student archetypes (essay, problem set, reading, lab report, presentation,
revision, coding, project, memorisation, generic) and produces an ordered list of small
steps with time estimates and a flagged "start here" step.

- No network calls, no API keys, no rate limits — works offline, zero cost.
- Deterministic and unit-tested: see `src/lib/questBreakdown.test.ts`
  (100% intent accuracy on the labelled benchmark corpus).
- Surfaced in the task editor via the "Don't know where to start?" button
  (`src/components/tasks/QuestBreakdown.tsx`). Step progress persists in `localStorage`,
  so no extra database table is required to use it.
- Upgrade path: if you ever need fuzzier free-text understanding, swap `classifyIntent()`
  for a local transformers.js ONNX classifier — still no server or API key. Callers don't
  change because the signature is preserved.

Daily quests (`src/components/dashboard/DailyQuests.tsx`) are personalised against the
user's real state (overdue work, today's scheduled subjects, active streak) rather than
chosen at random, with intelligent fallbacks so irrelevant quests are never shown.

See `STRATEGY.md` (kept alongside this README in the delivery) for the full product
rationale and roadmap.

---

## Redesign: implemented systems (phased)

The app was extended in modular, individually-committed phases per `docs/PRODUCT_SPEC.md`.
All logic lives in pure, unit-tested libraries (`src/lib/*`) with thin React components on top.

| Phase | What shipped | Key files |
|-------|--------------|-----------|
| CI | Type-check, lint, test & build on every push/PR | `.github/workflows/ci.yml` |
| 1 Architecture | Product spec: engagement loop, progression, personalization, retention | `docs/PRODUCT_SPEC.md` |
| 2 Visual identity | Rank system (Novice→Legend) + level ring, rank badge, hero HUD | `src/lib/progression.ts`, `src/components/progression/*` |
| 3 Personalization | "Next move" recommender with intelligent fallback ladder | `src/lib/nextMove.ts`, `src/components/dashboard/NextMoveCard.tsx` |
| 4 Motivation | Milestones + streak-at-risk loss aversion (personal, not public) | `src/lib/milestones.ts`, `src/lib/streak.ts` |
| 5 Recognition | Shareable accomplishment card (caption + downloadable SVG) | `src/lib/shareCard.ts`, `src/components/profile/ShareCard.tsx` |
| 6 Retention | First-run onboarding checklist seeding the core loop | `src/lib/onboarding.ts`, `src/components/dashboard/OnboardingChecklist.tsx` |
| 7 QA | De-duplicated dashboard, full type/lint/test/build pass | — |

Plus the earlier local, no-API **Quest Breakdown** engine (`src/lib/questBreakdown.ts`).

Run `npm test` to execute the full suite (35 tests across the engine, progression,
personalization, milestones, streak, share-card and onboarding libraries).
