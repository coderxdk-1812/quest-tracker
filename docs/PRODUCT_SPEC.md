# Level Up Quest — Product Architecture Spec (v1)

This spec is the single source of truth for the redesign. Every later phase implements
part of it. It is derived from three inputs: the student survey (n=90), the user research
synthesis, and the expert design review — resolved into one coherent model.

## 0. Positioning

> The lowest-friction path from "I have a big, vague assignment" to "I can see myself making
> progress on it" — for a student who works in short bursts, late at night, and forgets things.

The product is **not** a productivity dashboard. It is a progression game whose "content" is
real studying. The dashboard aesthetic is replaced by a quest/rank/territory aesthetic.

## 1. Core engagement loop

```
   CAPTURE ──▶ BREAK DOWN ──▶ START (focus) ──▶ COMPLETE ──▶ REWARD ──▶ PROGRESS ──▶ RETURN
     ▲   forget-proof   "don't know        owns the      checkable    XP/coins/    visible    daily
     │   capture        where to start"    first 5 min    momentum     rank up      identity   pull
     └──────────────────────────────────────────────────────────────────────────────────────┘
```

Each arrow maps to a survey finding:
- CAPTURE → 74% forget tasks at least sometimes.
- BREAK DOWN → "don't know where to start" 41%; "smaller tasks" 26%.
- START → distractions 48%; the first five minutes is the highest-leverage moment.
- COMPLETE/REWARD → checking off is satisfying (72% rate 4–5).
- PROGRESS → "seeing visible progress" is the #1 requested help (44%).
- RETURN → low motivation drives 50% of procrastination; the loop must pull, not guilt.

## 2. Progression system

- **XP & Levels** (already in code): `XP_PER_LEVEL` curve. Keep, but surface a level *ring*
  and "XP to next level" everywhere as the primary progress signal.
- **Ranks**: named tiers grouping levels (e.g. Novice → Apprentice → Adept → Expert →
  Master → Grandmaster → Legend). Ranks are the shareable identity layer. A rank has a
  color, an icon, and a title. Defined in `src/lib/progression.ts`.
- **Milestones**: lifetime achievements with progress bars (tasks completed, focus hours,
  best streak, perfect days). Always show the *next* milestone and % to it.

## 3. Reward system

Two currencies already exist: **XP** (progression) and **coins** (shop). Keep both.
- XP is earned by completing tasks/quests/focus and **cannot be spent** — it only ever grows
  (protects the sense of permanent progress).
- Coins are spent in the shop (cosmetics, power-ups). Spending never reduces XP/rank.
- **Reward sizing** follows the data: grades are the #1 real motivator (58%), so progression
  copy and milestones are framed around mastery/accomplishment, not vanity. Cosmetic rewards
  are opt-in flair, never the core driver.

## 4. Personalization system

The daily experience adapts to the user's real state. Rules (implemented across Phases 3–4):
- **Never show an irrelevant action.** No "clear overdue work" when nothing is overdue.
- **Relevance ranking**: overdue > due-today > today's scheduled subjects > streak protection
  > momentum win > variety.
- **Intelligent fallback ladder** when nothing is urgent:
  1. due-today task → 2. break down the biggest upcoming task → 3. a focus session on a
     weak/scheduled subject → 4. review/active-recall on a recently completed subject →
  5. plan tomorrow. Always yields one valuable next move.
- **One "Next move" card** on the dashboard: a single recommended action with a one-tap start.

## 5. Retention system (Duolingo psychology, adapted)

The expert cited Duolingo's periodic stakes, accountability, and loss aversion. We keep the
*principles* but aim them at **personal** progress, because the survey shows competition is
polarising (avg 2.9/5; 42% find it demotivating) and 51% are already overwhelmed — public
demotion would churn the majority.

- **Streaks** with a visible "at-risk" state and a **streak shield** (freeze) as the loss-
  aversion mechanic — you protect *your* streak, not a public rank.
- **Daily quests** reset on a **rhythm-aware** cycle (40% peak late at night; a midnight reset
  unfairly breaks streaks).
- **Weekly league**: opt-in, friend-sized, low-stakes. Competition is never forced.
- **Comeback, not punishment**: after a missed day, offer a gentle "win back your streak"
  quest rather than a harsh reset.

## 6. Recognition & social status

- **Shareable achievement / profile card** with genuine signalling value (best streak,
  rank, focus hours, tasks mastered) — designed to be screenshot/shared. Framed as evidence
  of consistency and accomplishment (what students value), not generic badges.
- Public, read-only profile route already exists (`/profile/:userId`); add an export/share
  affordance.

## 7. Onboarding & friction removal

- **First-run checklist** (3 steps: add your first task, break it down, run a 1-task focus
  session) that seeds the core loop immediately.
- Remove friction the survey surfaced: fast capture, sensible defaults, never a blank screen,
  always a suggested next move.

## 8. Phase mapping

| Phase | Spec sections delivered |
|-------|--------------------------|
| 2 Visual identity   | §2 ranks/levels, visual language, milestones indicators |
| 3 Personalization   | §4 next-move recommender + fallbacks |
| 4 Motivation        | §2 milestones, §5 streak-at-risk / league |
| 5 Recognition       | §6 shareable card |
| 6 Retention         | §7 onboarding + habit loops |
| 7 QA                | cohesion, tests, build |

## 9. Non-goals (explicitly out of scope, per the data)

- Forced public leaderboards / Duolingo-style public demotion (churns the overwhelmed 51%).
- Heavy generic gamification for its own sake (gamified rewards ranked low, 13%).
- A built-in AI chatbot / any paid API dependency (intelligence stays local & deterministic).
- Content tutoring (only 7% struggle with understanding content).
