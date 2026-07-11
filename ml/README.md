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
| 2. Dataset generation + validation | ✅ Done and committed — 17,600 examples, 0 validation failures, `data/processed/{train,val,test}.jsonl` |
| 3. Training script | ✅ Script complete; **CPU smoke config verified with a real run** (loss 3.57→0.87, eval_loss 2.20→1.39, checkpointing on best val loss confirmed). The full GPU config has **not** been run here. |
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

`scenarios.py` holds ~20 hand-authored, realistic scenarios (2 per intent ×
10 intents: essay, problem_set, reading, lab_report, presentation, revision,
coding, project, memorization, generic). Each scenario is a coherent
situation — the same topic/subject/vars drive the task title, the concrete
breakdown steps, a "vague" variant of those steps used as clarify's input (1
step deliberately swapped for a filler like "Research the topic"), the
clarify question targeting that exact swapped index, the user's answer, and
the refined steps that weave the answer in. `generate.py` programmatically
augments each scenario (subject, item/word/slide counts, deadlines, group vs
solo, priority, tags) into ~220 variants, fanning out to breakdown + clarify
(+ a "no vague steps → `[]`" negative example) + refine examples.

`build_dataset.py` then validates every example against `schema.py`'s
validators (JSON parses, steps aren't bare generic placeholders, clarify
questions target real in-range steps, refine output is genuinely different
and reflects the answer) — drops/reports any failure — and splits 80/10/10,
grouped so every example from one rendered scenario instance stays in a
single split (no leakage), stratified by intent.

Current committed dataset: **17,600 examples, 0 validation failures** —
4,400 breakdown / 8,800 clarify / 4,400 refine, balanced 440/440 per intent
per task across breakdown+refine, split into train (14,080) / val (1,760) /
test (1,760).

To grow the dataset (e.g. after error analysis — see below), add more
scenarios to `scenarios.py` or widen the pools in `pools.py`, then rerun.

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
# 14,080 examples; expect on the order of 30-90 minutes on a single T4.
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
intent or task type is consistently weak:
1. Add more/better scenarios for it in `ml/data/scenarios.py` (or widen its
   pools in `pools.py`), targeting the specific failure pattern you saw.
2. Rerun `build_dataset.py`.
3. Retrain (`train.py --config configs/full.json`) — the config's
   `output_dir` is separate per run, so old checkpoints aren't clobbered;
   bump it (e.g. `runs/full_v2`) if you want to compare.
4. Re-run `eval.py` and recheck the acceptance table.

Only move to conversion once `acceptance` in the eval report is all `true`.

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
  during authoring — `schema.py`'s validator caught 13 scenarios where a
  filler phrase leaked into the "good" template) trains the model to think
  that's acceptable output. The validator is a hard gate, not a lint warning.
