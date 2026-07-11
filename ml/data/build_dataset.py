"""
Orchestrates the full dataset build: generate -> validate -> stratified,
leak-free split -> write JSONL.

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


def build(variants_per_scenario: int, seed: int) -> dict[str, list[schema.Example]]:
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

    return splits


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
    ap.add_argument("--variants-per-scenario", type=int, default=220)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    splits = build(args.variants_per_scenario, args.seed)
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


if __name__ == "__main__":
    main()
