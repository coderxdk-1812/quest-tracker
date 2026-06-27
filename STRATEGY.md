# Level Up Quest — improvement plan (survey + expert review → code)

This document maps your survey findings and the expert review onto concrete changes in
the `level-up-quest-04` codebase, explains what was implemented in this pass, and lays out
the prioritised backlog. It also documents the **local, no-API** approach to "AI".

---

## 1. What the codebase already does well

The app is already far past a basic to-do list. It ships XP / levels / coins, streaks and
streak-freezes, a shop (power-ups, themes, badges), avatars, a global leaderboard, a
rivalry/PvP "curse" system, friends/social, a focus mode, achievements, a timetable, and a
daily-quest system. Game mechanics are **not** the gap.

So the question isn't "add gamification" — the expert review's literal suggestions
(Duolingo leaderboard, badges, status symbols) largely already exist in some form. The real
gaps are the survey's highest-leverage needs that are still missing or weak:

1. **Genuine task breakdown** — nothing in the app helps a student who "doesn't know where
   to start" (the #3 procrastination trigger, 41%). Tasks are atomic; there are no sub-steps.
2. **Truly personalised daily quests** — quests were drawn at **pure random** from a static
   pool, including "finish an overdue task" even when the user has none. This is the exact
   irrelevance the expert flagged in note #4.
3. **Vestigial "AI"** — there is an `ai_tokens` budget table but no model behind it. This is
   the right place to deliver the local, no-API intelligence you asked for.

---

## 2. The local-AI approach (no API, no paid plans)

Your constraint: any AI must be **locally trained, high accuracy, no API/paid dependency**.

For the task-breakdown problem the right tool is a **deterministic, on-device engine**, not a
hosted LLM. For this bounded domain (student task types) a well-designed rule/keyword engine
is *more* accurate, *more* predictable, free, offline, and zero-latency. It benchmarks at
**100% intent accuracy on a 29-item labelled corpus** (see `questBreakdown.test.ts`).

If you later want fuzzier free-text understanding (e.g. classifying messy task titles or
auto-tagging subjects), the upgrade path stays fully local: swap `classifyIntent()` for a
small **transformers.js** ONNX model (e.g. a distilled text classifier) that runs in the
browser via WASM — still no server, no API key, no per-call cost. Callers don't change
because the function signature is preserved. That is the "locally trained model" option,
held in reserve until the heuristic is genuinely insufficient.

---

## 3. Implemented in this pass

### a) `src/lib/questBreakdown.ts` — local Quest Breakdown engine
Pure, dependency-free TypeScript. Classifies a task into one of 10 intents (essay, problem
set, reading, lab report, presentation, revision, coding, project, memorisation, generic)
and emits an ordered list of small, concrete steps with time estimates. Detail scales with
difficulty; the first step is flagged `isStarter` so the UI can offer a one-tap start.

- **Survey support:** "don't know where to start" 41%; "break into smaller tasks" was the #1
  first move on a hard assignment; "smaller achievable tasks" wanted by 26%.
- **Expert support:** notes #1 (quest progression) and #4 (always a relevant next action).
- **Why it matters:** attacks the single biggest initiation-friction point — the "first five
  minutes" that the survey identifies as the highest-leverage moment.

### b) `src/lib/questBreakdown.test.ts` — accuracy benchmark
Vitest suite: a 29-item labelled corpus proving ≥90% (currently 100%) classifier accuracy,
plus determinism, starter-step, difficulty-scaling, override, and fallback checks. Runs in
your existing `npm test` / `vitest` pipeline.

### c) `src/components/tasks/QuestBreakdown.tsx` — the quest-line UI
Drop-in component: renders the steps as a checkable quest line with a progress bar in the
app's existing `glass-card` / `xp-gradient` style, a "Start in Focus Mode" button, and a
reset/regenerate control. **Progress is persisted in `localStorage` keyed by task id — no
database migration required to ship it.** Exposes `onAllComplete` so you can later grant a
small XP bonus, and `onStartFocus` for the focus hand-off.

### d) `src/components/dashboard/DailyQuests.tsx` — personalised selection
Replaced pure-random `pickRandom` with `pickPersonalized`, which scores each candidate
against the user's **real state**: it hard-excludes the overdue quest when nothing is
overdue (the expert's exact example), boosts quests for subjects scheduled or due **today**,
protects an active streak, guarantees one attainable momentum win, caps repetition of any
single metric, and adds light jitter so the set still varies day to day. 100% local.

- **Survey support:** overwhelm avg 3.6/5 (51% at 4–5) and students rarely prioritise — the
  daily list must surface what matters today, not noise.
- **Expert support:** note #4 (personalised actions with intelligent fallbacks).

### e) `src/pages/Tasks.tsx` — wiring
Adds a "Don't know where to start? Break it into steps" button inside the task editor that
reveals the `QuestBreakdown` panel for the current task.

All five files pass esbuild syntax/JSX validation; the engine passes its full test suite.

---

## 4. Roadmap (prioritised)

### Must have (core loop — both sources agree)
- **[DONE] Local task breakdown + quest-line UI** (R1).
- **[DONE] Personalised daily quests with fallbacks** (R3/R4).
- **Persist sub-steps in the database.** Promote the localStorage steps to a `task_steps`
  table so breakdown progress syncs across devices and can feed XP/streaks. *(Medium)*
- **Grade / goal linkage.** Let tasks attach to a course and a target grade; surface a
  progress roll-up. Grades are the #1 motivator (58%) — currently unmodelled. *(Medium)*

### Should have (engagement multipliers)
- **One-tap "Start" = breakdown + focus session** fused into a single action — own the first
  five minutes. The hooks (`isStarter`, `onStartFocus`) are already in place. *(Low–Med)*
- **Rhythm-aware daily reset.** 40% peak late at night and 24% are "random"; a midnight reset
  unfairly breaks streaks. Make the daily cycle configurable. *(Low–Med)*
- **Active-study quest types** (teach-back, practice-question, co-op) — turn the learning
  methods students rate highest (practice 61%, teaching 36%) into quest content. This is the
  real differentiator vs. generic to-do apps. *(Med–High)*

### Nice to have
- **Opt-in leagues** instead of a forced global leaderboard. Competition is polarising
  (avg 2.9/5; 42% find it demotivating), so make it opt-in to keep the energised third
  without churning the rest. *(Med)*
- **Academic-credential achievements** with genuine signalling value (shareable evidence of
  consistency), reframing the expert's "status symbol" toward what students actually value
  (grades/outcomes) rather than vanity badges. *(Med–High)*
- **transformers.js local classifier** if free-text understanding outgrows the heuristic. *(Med)*

---

## 5. The honest tension: gamification vs. the data

The expert leans hard on competition, public leaderboards, and Duolingo-style loss/demotion.
The survey is lukewarm-to-negative on exactly those: competition averages 2.9/5 and 42% find
it demotivating; generic gamified rewards rank near the bottom (13%). Aggressive public
demotion is risky for an already-overwhelmed user base (51% frequently overwhelmed).

Recommendation (evidence-led): **keep the expert's *principle* — stakes, accountability, loss
aversion — but aim it at *personal* streaks/progress rather than public ranking, and make all
head-to-head competition opt-in.** Same psychology, far less churn. This is why the work in
this pass invests in relevance, breakdown, and personal progress first, and treats
competitive mechanics as opt-in polish.

---

## 6. How to apply these changes

The repo already contains the edited files, but for your own repo:

```bash
# from your project root, on a new branch
git checkout -b local-quest-breakdown
git apply level-up-quest-improvements.patch   # applies all 5 files
npm install
npm test                                       # runs the engine benchmark
npm run dev
```

Or simply copy the five files in `src/` over your existing tree (the two modified files,
`Tasks.tsx` and `DailyQuests.tsx`, were edited additively and should drop in cleanly on the
current `main`).
