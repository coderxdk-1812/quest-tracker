"""
Orchestrates the full dataset build: generate -> validate -> diversity report
-> stratified, leak-free split -> write JSONL.

No leakage: every example derived from the same rendered scenario instance
(breakdown + clarify + clarify-no-question + refine, which all share
variables and largely-overlapping task text) is kept in exactly one split —
never spread across train/val/test. Splitting is also stratified by intent
so every split has proportional coverage of all 10 intents.

Usage:
    python3 build_dataset.py [--variants-per-scenario N] [--seed S]
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from generate import generate_all
import schema

OUT_DIR = Path(__file__).parent / "processed"


def base_group_key(seed_id: str) -> str:
    """Strips the '_noq' suffix so both clarify variants of one rendered
    instance (with-question and no-question) group with its breakdown/refine."""
    return seed_id[:-len("_noq")] if seed_id.endswith("_noq") else seed_id


def scenario_id(seed_id: str) -> str:
    """seed_id looks like 'essay_wwi_causes#3' or '..._noq' — the part before
    '#' is the hand-authored scenario that generated this row."""
    return seed_id.split("#", 1)[0]


def _task_from_input_text(input_text: str) -> dict:
    """Recovers the task JSON object from a formatted input_text string
    (see schema.format_input) — used only for the diversity report below,
    not for training/validation."""
    m = re.match(r"^\w+: ", input_text)
    rest = input_text[m.end():] if m else input_text
    task, _ = json.JSONDecoder().raw_decode(rest)
    return task


def diversity_report(valid: list[schema.Example]) -> dict:
    """
    Proves the dataset's diversity comes from ~250 distinct hand-authored
    scenarios, not from number-swapping a handful of templates hundreds of
    times (the original bug). Reports:
      - counts per task_type and per intent
      - unique-title ratio: distinct rendered task titles, both as a
        fraction of ALL rows (breakdown/clarify-positive/clarify-negative/
        refine of the same task instance structurally share one title, so
        this is capped at 25% even in a perfectly-varied dataset) and as a
        fraction of distinct TASK INSTANCES (dedupes that structural 4x
        repeat, which is the more informative number)
      - unique-step-set ratio (breakdown/refine): how many distinct step
        arrays exist, out of the total breakdown+refine row count
      - unique-question-set ratio (clarify): same idea, over clarify's
        question text
    """
    n = len(valid)
    scenario_ids = {scenario_id(ex.seed_id) for ex in valid}
    titles = set()
    task_instances = set()
    step_sets = set()
    step_set_n = 0
    question_sets = set()
    question_set_n = 0
    by_task_type: dict[str, int] = defaultdict(int)
    by_intent: dict[str, int] = defaultdict(int)

    for ex in valid:
        by_task_type[ex.task_type] += 1
        by_intent[ex.intent] += 1
        task = _task_from_input_text(ex.input_text)
        titles.add(task.get("title", ""))
        task_instances.add(json.dumps(task, sort_keys=True))
        target = json.loads(ex.target)
        if ex.task_type in ("breakdown", "refine"):
            step_set_n += 1
            step_sets.add(tuple(target))
        elif ex.task_type == "clarify":
            question_set_n += 1
            question_sets.add(tuple(q.get("question", "") for q in target))

    n_instances = len(task_instances)
    return {
        "total_examples": n,
        "distinct_scenarios": len(scenario_ids),
        "distinct_task_instances": n_instances,
        "by_task_type": dict(sorted(by_task_type.items())),
        "by_intent": dict(sorted(by_intent.items())),
        "distinct_titles": len(titles),
        "unique_title_ratio_of_rows": round(len(titles) / n, 4) if n else 0.0,
        "unique_title_ratio_of_task_instances": round(len(titles) / n_instances, 4) if n_instances else 0.0,
        "distinct_step_sets": len(step_sets),
        "unique_step_set_ratio": round(len(step_sets) / step_set_n, 4) if step_set_n else 0.0,
        "distinct_question_sets": len(question_sets),
        "unique_question_set_ratio": round(len(question_sets) / question_set_n, 4) if question_set_n else 0.0,
    }


def print_diversity_report(report: dict) -> None:
    print("\n[build_dataset] diversity report:")
    print(f"  distinct hand-authored scenarios: {report['distinct_scenarios']}")
    print(f"  total examples: {report['total_examples']}")
    print(f"  distinct task instances (dedupes breakdown/clarify+/clarify-/refine sharing one task): {report['distinct_task_instances']}")
    print(f"  by task_type: {report['by_task_type']}")
    print(f"  by intent: {report['by_intent']}")
    print(f"  distinct titles: {report['distinct_titles']}"
          f"  ({report['unique_title_ratio_of_task_instances']} of task instances,"
          f" {report['unique_title_ratio_of_rows']} of all rows —"
          f" the latter is structurally capped at 0.25 since one task instance"
          f" always yields 4 rows)")
    print(f"  distinct step-sets (breakdown+refine): {report['distinct_step_sets']}  ({report['unique_step_set_ratio']} of breakdown+refine rows)")
    print(f"  distinct question-sets (clarify): {report['distinct_question_sets']}  ({report['unique_question_set_ratio']} of clarify rows)")


def build(variants_per_scenario: int, seed: int) -> tuple[dict[str, list[schema.Example]], dict]:
    examples = generate_all(variants_per_scenario)

    # Validate every example; drop (and report) any failures rather than ship them.
    valid: list[schema.Example] = []
    dropped: list[tuple[schema.Example, list[str]]] = []
    for ex in examples:
        errs = schema.validate_example(ex)
        if errs:
            dropped.append((ex, errs))
        else:
            valid.append(ex)

    if dropped:
        print(f"[build_dataset] dropped {len(dropped)}/{len(examples)} invalid examples:")
        for ex, errs in dropped[:20]:
            print(f"  {ex.seed_id} ({ex.task_type}): {errs}")
        if len(dropped) > 20:
            print(f"  ... and {len(dropped) - 20} more")
    else:
        print(f"[build_dataset] 0 validation failures out of {len(examples)} generated examples.")

    report = diversity_report(valid)

    # Group by (intent, base scenario-instance) for leak-free, stratified splitting.
    groups: dict[tuple[str, str], list[schema.Example]] = defaultdict(list)
    for ex in valid:
        groups[(ex.intent, base_group_key(ex.seed_id))].append(ex)

    by_intent: dict[str, list[str]] = defaultdict(list)
    for (intent, key) in groups:
        by_intent[intent].append(key)

    r = random.Random(seed)
    splits: dict[str, list[schema.Example]] = {"train": [], "val": [], "test": []}
    for intent, keys in by_intent.items():
        r.shuffle(keys)
        n = len(keys)
        n_val = max(1, round(n * 0.10))
        n_test = max(1, round(n * 0.10))
        n_train = n - n_val - n_test
        assign = (
            [("train", k) for k in keys[:n_train]]
            + [("val", k) for k in keys[n_train:n_train + n_val]]
            + [("test", k) for k in keys[n_train + n_val:]]
        )
        for split_name, key in assign:
            splits[split_name].extend(groups[(intent, key)])

    return splits, report


def write_jsonl(path: Path, examples: list[schema.Example]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for ex in examples:
            f.write(json.dumps(ex.to_json(), ensure_ascii=False) + "\n")


def assert_no_leakage(splits: dict[str, list[schema.Example]]) -> None:
    keys_by_split = {
        name: {base_group_key(ex.seed_id) for ex in exs} for name, exs in splits.items()
    }
    overlap_tv = keys_by_split["train"] & keys_by_split["val"]
    overlap_tt = keys_by_split["train"] & keys_by_split["test"]
    overlap_vt = keys_by_split["val"] & keys_by_split["test"]
    assert not overlap_tv, f"train/val leakage: {list(overlap_tv)[:5]}"
    assert not overlap_tt, f"train/test leakage: {list(overlap_tt)[:5]}"
    assert not overlap_vt, f"val/test leakage: {list(overlap_vt)[:5]}"
    # Also check for exact input_text duplicates across splits (belt & suspenders).
    texts_by_split = {name: {ex.input_text for ex in exs} for name, exs in splits.items()}
    assert not (texts_by_split["train"] & texts_by_split["test"]), "duplicate input_text train/test"
    assert not (texts_by_split["train"] & texts_by_split["val"]), "duplicate input_text train/val"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants-per-scenario", type=int, default=6)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    splits, report = build(args.variants_per_scenario, args.seed)
    assert_no_leakage(splits)

    for name, exs in splits.items():
        write_jsonl(OUT_DIR / f"{name}.jsonl", exs)

    print("\n[build_dataset] wrote:")
    for name, exs in splits.items():
        by_type = defaultdict(int)
        for ex in exs:
            by_type[ex.task_type] += 1
        print(f"  {name}: {len(exs)} examples  {dict(by_type)}  -> {OUT_DIR / f'{name}.jsonl'}")
    print("[build_dataset] no train/val/test leakage confirmed.")

    print_diversity_report(report)


if __name__ == "__main__":
    main()
