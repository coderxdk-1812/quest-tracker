# On-device quest-breakdown model

A purpose-trained, purpose-quantized flan-t5-small fine-tuned to do three jobs
for the task-breakdown feature, entirely on-device in the browser (no runtime
API calls, no server):

- **`breakdown`** — task → an ordered list of concrete, specific steps.
- **`clarify`** — task + current steps → targeted questions about whichever
  steps are actually vague (references the real weak steps, not a fixed list).
- **`refine`** — task + steps + the user's answers → sharper steps that
  demonstrably reflect those answers.

The existing deterministic rule engine (`src/lib/questBreakdown.ts`) is the
permanent fallback — it is never removed, and every model call degrades to it
transparently on any failure (unsupported browser, load failure, timeout, or
invalid output). See `src/lib/localModel.ts` for the runtime wrapper and its
JSON-parsing/fallback contract (unit-tested in `src/lib/localModel.test.ts`).

## Honest status of this pipeline

Everything below is real, runnable code, verified end-to-end in this
environment (a GPU-less Apple Silicon machine) — **except the actual full
fine-tuning run**, which needs a GPU this environment doesn't have:

| Phase | Status |
|---|---|
| 1. Task design / schemas | ✅ Done — `schema.py` |
| 2. Dataset generation + validation | ✅ Done and committed — **250 distinct hand-authored scenarios** (25/intent), 6,000 examples, 0 validation failures, `data/processed/{train,val,test}.jsonl`. Rebuilt from scratch after an earlier version (~20 scenarios × 220 near-duplicate variants = 17,600 rows) trained a model that had just memorized 20 templates — see "Dataset" below for what changed and the diversity numbers proving it. |
| 3. Training script | ✅ Script complete; **CPU smoke config re-verified against the new 250-scenario dataset** (ran to completion — final training loss 3.38 avg / 1.87 last-logged, eval_loss 3.00, checkpointing on best val loss confirmed). Not a real trained model — 12 examples, 2 epochs, purely a pipeline check. The full GPU config has **not** been run here — `fp16` is deliberately off in both full configs (T5 diverges to NaN in fp16; `train.py` also hard-guards against it regardless of config). |
| 4. Evaluation script | ✅ Script complete; **smoke-tested against the base (non-fine-tuned) model** to prove the mechanics (JSON-validity/ROUGE/rubric scoring, report writing, acceptance-threshold checking) — scored 0%, as expected for an un-fine-tuned model. Has not been run against a real trained checkpoint. |
| 5. ONNX conversion | ✅ Script complete; **verified end-to-end against a smoke checkpoint** (97.5MB quantized output, under the 150MB budget). Has not been run against a real trained checkpoint. |
| 6. Browser integration | ✅ Done and wired — `src/lib/localModel.ts`, Settings toggle, `QuestBreakdown.tsx`. `MODEL_ID` is a placeholder until a real model is hosted (see below); every call correctly falls back to the rule engine until then. |
| 7. Tests / CI | ✅ Done — `src/lib/localModel.test.ts` (JSON parsing + fallback contract), web app CI green. |

**What's left, that needs a GPU (local or Colab) and ~an hour, not more
engineering:** run `train.py --config configs/full.json`, then `eval.py`
against the result, iterate on the dataset if the acceptance criteria aren't
met (see "Iterate & retrain" below), then `convert_to_onnx.py`, then host the
output and point `MODEL_ID` in `src/lib/localModel.ts` at it. Steps below.

## Setup

All ML code is isolated from the web app — it has its own `requirements.txt`
and is never imported by anything under `src/`. `ml/data/*.py` (dataset
generation/validation) is pure stdlib on purpose and needs **no install**.

```bash
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Pipeline

### 1. Generate the dataset

```bash
cd ml/data
python3 build_dataset.py                 # writes processed/{train,val,test}.jsonl
```

`scenarios/` (a package, one file per intent) holds **250 hand-authored,
realistic scenarios — 25 per intent** across essay, problem_set, reading,
lab_report, presentation, revision, coding, project, memorization, and
generic. This is the second version of the dataset; the first version had
~20 scenarios blown up into 17,600 rows via heavy per-scenario augmentation
(~220 variants each), and the resulting model had just memorized those 20
templates (~65% JSON-valid, clarify worst at 50%, project/generic at 25%).
The fix wasn't more augmentation, it was more *scenarios*: each of the 250
has its own fixed topic/subject and genuinely different title phrasing (some
terse and lowercase, some verbose, some with a typo, some formal) and
genuinely different step content — no shared "8 topics × 2 skeletons" pool
for the content that actually varies. Only the legitimately-variable
surface details (word/item/slide counts, deadline urgency, priority, tags,
group-vs-solo, and whether `description`/`subject` are even filled in) come
from shared pools in `pools.py`.

Each scenario is a coherent situation: the same topic drives the task
title, the concrete breakdown steps, a "vague" variant of those steps used
as clarify's input (1-3 steps deliberately swapped for a filler like
"Research the topic"), the clarify question(s) targeting those exact
swapped indices, the user's answer(s), and the refined steps that weave the
answer in — not append it. `generate.py` samples each scenario **6** times
(deliberately low fan-out — diversity comes from 250 distinct scenarios,
not from squeezing hundreds of variants out of a few), fanning out to
breakdown + clarify (+ a "no vague steps → `[]`" negative example, generated
from every scenario's fully-specific step list) + refine. That's 250 × 6 ×
4 = 6,000 rows, with clarify deliberately 2x breakdown/refine (3,000 vs
1,500 each) per the "over-invest in clarify" requirement — it was the
weakest and most important task.

`build_dataset.py` then validates every example against `schema.py`'s
validators (JSON parses, steps aren't bare generic placeholders, clarify
questions target real in-range steps, refine output is genuinely different
and reflects the answer) — drops/reports any failure — and splits 80/10/10,
grouped so every example from one rendered scenario instance stays in a
single split (no leakage), stratified by intent.

Current committed dataset: **6,000 examples, 0 validation failures** —
1,500 breakdown / 3,000 clarify / 1,500 refine, perfectly balanced 600 per
intent, split into train (4,800) / val (600) / test (600). Real output from
`python3 build_dataset.py`:
```
[build_dataset] 0 validation failures out of 6000 generated examples.
[build_dataset] wrote:
  train: 4800 examples  {'breakdown': 1200, 'clarify': 2400, 'refine': 1200}
  val: 600 examples  {'breakdown': 150, 'clarify': 300, 'refine': 150}
  test: 600 examples  {'breakdown': 150, 'clarify': 300, 'refine': 150}
[build_dataset] no train/val/test leakage confirmed.

[build_dataset] diversity report:
  distinct hand-authored scenarios: 250
  total examples: 6000
  distinct task instances (dedupes breakdown/clarify+/clarify-/refine sharing one task): 1500
  by task_type: {'breakdown': 1500, 'clarify': 3000, 'refine': 1500}
  by intent: {'coding': 600, 'essay': 600, 'generic': 600, 'lab_report': 600, 'memorization': 600,
              'presentation': 600, 'problem_set': 600, 'project': 600, 'reading': 600, 'revision': 600}
  distinct titles: 317  (0.2113 of task instances, 0.0528 of all rows — the latter is
              structurally capped at 0.25 since one task instance always yields 4 rows)
  distinct step-sets (breakdown+refine): 938  (0.3127 of breakdown+refine rows)
  distinct question-sets (clarify): 254  (0.0847 of clarify rows)
```
Two of those numbers look lower than they are without context: **distinct
titles** is capped at 25% of total rows no matter how varied the dataset is
(one task instance structurally produces 4 rows sharing one title) — the
21.13%-of-task-instances figure is the real signal, and it's driven by
scenarios that deliberately use a *static* title (no `{word_count}`-style
variable in it), which is realistic — plenty of real students type a bare
title and leave the details in the description or nowhere at all. **Distinct
question-sets** is low because 1,500 of the 3,000 clarify rows are the
negative `[]` case by design (same trivial target, on purpose — that's the
"say so instead of asking filler questions" signal), and each scenario's
positive question wording is intentionally fixed (a real clarifying
question about *this specific vague step*, not reworded 6 different ways)
— so the ~254 distinct question-sets is close to "one real, topic-grounded
question per scenario," which is the actual goal, not a shortfall.

Building this dataset also surfaced a real authoring bug: 70 scenarios had
a leftover generic-filler word (`"Prepare"`, `"Get started"`, `"Study"`,
etc.) sitting directly in `breakdown_steps_tpl` — a copy/paste residue from
drafting — instead of genuine step content. `schema.py`'s validator caught
every one (that's what "0 validation failures" is actually proving isn't
trivial), and all 70 were rewritten with real, scenario-specific content
before this dataset was committed.

To grow the dataset (e.g. after error analysis — see "Iterate & retrain"
below), add more scenarios to `scenarios/<intent>.py` or widen the pools in
`pools.py`, then rerun `build_dataset.py`.

### 2. Train

The multitask "prefix formatting" (`breakdown: {...}`, `clarify: {...}
steps: [...]`, `refine: {...} steps: [...] answers: [...]`) is baked into
each example's `input_text` by `schema.py`'s `format_input()` at dataset-build
time — `train.py` just tokenizes `input_text` → `target` as a plain seq2seq
pair, so training, eval, and the browser runtime are guaranteed to agree on
the exact same format (`src/lib/localModel.ts`'s `formatInput()` is a direct
TS port — keep all three in sync if you ever change the schema).

```bash
# Smoke test — CPU, ~30s, 12 train examples. Proves the pipeline works
# end-to-end (tokenize → train → eval → checkpoint on best val loss → save).
# Not a real model — do not evaluate/ship its output.
python3 train.py --config configs/smoke.json

# Full run — needs a GPU (local CUDA, or a Colab notebook: `!pip install -r
# requirements.txt && !python3 train.py --config configs/full.json`, with
# ml/ uploaded or git-cloned into the Colab runtime first). ~8 epochs over
# 4,800 train examples; expect well under an hour on a single T4 (fp32, no
# fp16 — see the fp16 note above).
python3 train.py --config configs/full.json

# If flan-t5-small doesn't clear the eval bar, scale up — same pipeline,
# just a bigger base model and adjusted batch size/grad-accum:
python3 train.py --config configs/full_base.json
```

Checkpointing is on best `eval_loss` (`load_best_model_at_end=True`), so the
saved model in `runs/full/` is always the best-val checkpoint, not just the
last one. `runs/` is gitignored — checkpoints are large and reproducible.

### 3. Evaluate — don't skip this

```bash
python3 eval.py --model_dir runs/full --test_file data/processed/test.jsonl
```

Reports, overall and broken down by task type and intent:
- **JSON-validity rate** — does the raw generation even parse?
- **ROUGE-L** — closeness to the reference (rough signal, not the bar itself).
- **Rubric pass rate** — reuses `schema.py`'s exact validators against the
  model's *generated* output: are breakdown/refine steps specific (no bare
  generic placeholders)? do clarify questions target real, in-range step
  indices? does refine actually change the steps and reflect the answer?

Writes a full per-example report to `runs/full/eval_report.json` for error
analysis, and checks against the acceptance criteria:

| Criterion | Threshold |
|---|---|
| JSON-validity rate | ≥ 98% |
| Rubric pass rate | ≥ 95% |
| No bare generic placeholders in steps | (part of rubric) |
| Clarify questions reference real weak steps | (part of rubric) |
| Refine visibly changes steps per answers | (part of rubric) |
| Quantized model size | < ~150MB (checked after step 4, below) |

**Iterate & retrain, don't just ship a bad number.** Open
`eval_report.json`, sort by `rubric_pass: false`, and look at what's failing
per intent/task_type in `summary.by_intent` / `summary.by_task_type`. If one
or two intents or task types are consistently weak while the rest are fine,
that's a data problem — the dataset already learned this lesson once (see
"Dataset" above: 20 templates blown up into 17,600 clones scored ~65%
overall with clarify at 50% and project/generic at 25% — the fix was
authoring more distinct scenarios, not more augmentation):
1. Add more/better scenarios for the weak intent(s) in
   `ml/data/scenarios/<intent>.py` (or widen `pools.py`'s shared pools),
   targeting the specific failure pattern you saw — genuinely different
   topics and phrasing, not parametric clones of what's already there.
2. Rerun `build_dataset.py` and check the diversity report hasn't regressed.
3. Retrain (`train.py --config configs/full.json`) — the config's
   `output_dir` is separate per run, so old checkpoints aren't clobbered;
   bump it (e.g. `runs/full_v2`) if you want to compare.
4. Re-run `eval.py` and recheck the acceptance table.

If instead the model is *broadly* weak across every intent and task type
even with the current 250-scenario dataset — i.e. the data isn't
templated/thin anymore but flan-t5-small still can't clear the bar — that's
a capacity problem, not a data problem. The next lever is
**`configs/full_base.json`** (scales to `flan-t5-base`), not more scenarios:
adding yet more data to fix a capacity ceiling is a diminishing-returns
trap. Only move to conversion once `acceptance` in the eval report is all
`true`.

### 4. Convert for the browser

```bash
python3 convert_to_onnx.py --model_dir runs/full --out_dir onnx/quest-model
```

Exports via `optimum` (`ORTModelForSeq2SeqLM`), then int8-quantizes with
plain dynamic quantization (`onnxruntime.quantization.quantize_dynamic` —
deliberately *not* CPU-ISA-targeted like `avx512`, since the runtime target
is WASM in-browser, not a specific server CPU). By default it **drops
`decoder_with_past_model`** (the KV-cache-reuse graph, ~55MB) since
flan-t5-small with all three ONNX graphs quantized lands at ~153MB — just
over budget. Without it: **~97.5MB**, comfortably under. Transformers.js
still works fine without it (re-runs the full decoder each generation step
instead of reusing cached keys/values) — for short JSON outputs like ours
the latency difference is minor. Pass `--include_past` if you have budget
headroom and want faster generation instead.

Output layout matches Transformers.js's expected convention:
```
onnx/quest-model/
  config.json, generation_config.json
  tokenizer.json, tokenizer_config.json, spiece.model, special_tokens_map.json
  onnx/
    encoder_model_quantized.onnx
    decoder_model_quantized.onnx
```

### 5. Host it

Two options, either works with `src/lib/localModel.ts` as written (it passes
`MODEL_ID` straight to Transformers.js's `pipeline()`, which resolves either
a HF Hub repo id or a relative path under `env.localModelPath`):

- **HF Hub (recommended)** — `huggingface-cli upload <your-org>/quest-breakdown-flan-t5-small onnx/quest-model .` then set `MODEL_ID` in `src/lib/localModel.ts` to that repo id. Transformers.js fetches + caches (browser Cache API) on first use, exactly like any other HF-hosted model — no app changes needed beyond the id.
- **Self-hosted (`public/models/`)** — copy `onnx/quest-model/` into `public/models/quest-breakdown/`, set `MODEL_ID = '/models/quest-breakdown'` and configure Transformers.js's `env.localModelPath`/`env.allowRemoteModels = false` in `localModel.ts`. Use **Git LFS** for the `.onnx` files if you go this route (~97.5MB is past what you want in a plain git blob) — `git lfs track "public/models/**/*.onnx"`.

### 6. Point the app at it

Edit the one line in `src/lib/localModel.ts`:
```ts
const MODEL_ID = 'your-org/quest-breakdown-flan-t5-small'; // was a placeholder
```
That's the entire integration change — `breakdown()`/`clarify()`/`refine()`,
the Settings toggle, the "thinking…"/download-progress UI, and the rule-engine
fallback are all already wired in `src/components/tasks/QuestBreakdown.tsx`
and don't need to change.

## Design notes

- **Why one model, three tasks, via prefixes.** Same trick as the original
  T5 paper — a single small model generalizes better across related tasks
  than three separate tiny models would, and it's a third of the download.
- **Why the schema lives in `schema.py`, not duplicated per script.**
  `generate.py`, `train.py`, `eval.py`, and `src/lib/localModel.ts` must
  agree byte-for-byte on the prefixed input format and the output JSON
  shape. `schema.py` is the single Python source of truth; `localModel.ts`
  is a deliberate, commented TS port of the same functions — if you change
  one, change both, and re-run the tests in `localModel.test.ts`.
- **Why validation is this strict.** The dataset is the model's only signal.
  A single mis-authored "good" step that's secretly generic (this happened
  during authoring — `schema.py`'s validator caught 70 scenarios where a
  filler phrase like `"Prepare"` or `"Get started"` had leaked into the
  "good" `breakdown_steps_tpl` template, plus one `refine_steps_tpl` that
  didn't actually reflect its own answer) trains the model to think that's
  acceptable output. The validator is a hard gate, not a lint warning — see
  "Dataset" above for what got caught and fixed.
- **Why 250 scenarios at 6 variants each, not 20 at 220.** More rows isn't
  more signal if they're paraphrases of each other — a model trained on
  17,600 rows generated from 20 templates learned the 20 templates, not the
  underlying skill. Scenario *count* is what teaches generalization; the
  per-scenario variant count just adds realistic surface noise (deadlines,
  counts, missing fields) on top of content that's already genuinely
  different. See `diversity_report()` in `build_dataset.py` for the metrics
  that keep this honest on every rebuild.
