"""
Evaluates a trained checkpoint on the held-out test set:
  - JSON-validity rate (does the raw generation even parse?)
  - ROUGE-L overlap against the reference target (rough proxy for closeness)
  - rubric pass rate, reusing ml/schema.py's validators directly on the
    generated output: are breakdown/refine steps specific (no bare generic
    placeholders)? do clarify questions target real (in-range) step indices?
    does refine actually change the steps?

Writes a full per-example + per-intent + per-task-type report to
--report_out (default: eval_report.json next to the checkpoint) for error
analysis — see ml/README.md for the iterate-and-retrain loop this feeds.

Usage:
    python3 eval.py --model_dir runs/full --test_file data/processed/test.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import schema
from rouge_score import rouge_scorer
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

ACCEPTANCE = {
    "json_valid_rate": 0.98,
    "rubric_pass_rate": 0.95,
}


def load_test_set(path: str) -> list[dict]:
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def rubric_errors(row: dict, parsed: object) -> list[str]:
    """Reuses the exact same validators the dataset build used, against the
    MODEL's generated output instead of ground truth — this is the crux of
    the rubric check (specific steps / targeted questions / refine deltas)."""
    ex = schema.Example(
        task_type=row["task_type"], input_text=row["input_text"],
        target=json.dumps(parsed), intent=row.get("intent", ""), seed_id=row.get("seed_id", ""),
    )
    return schema.validate_example(ex)


def generate_batch(model, tokenizer, texts: list[str], max_new_tokens: int, num_beams: int, device: str) -> list[str]:
    inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=384).to(device)
    out = model.generate(**inputs, max_new_tokens=max_new_tokens, num_beams=num_beams)
    return tokenizer.batch_decode(out, skip_special_tokens=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model_dir", required=True)
    ap.add_argument("--test_file", default=str(Path(__file__).parent / "data" / "processed" / "test.jsonl"))
    ap.add_argument("--report_out", default=None)
    ap.add_argument("--batch_size", type=int, default=8)
    ap.add_argument("--max_new_tokens", type=int, default=256)
    ap.add_argument("--num_beams", type=int, default=4)
    ap.add_argument("--limit", type=int, default=None, help="Only evaluate the first N rows (fast iteration).")
    ap.add_argument("--device", default="cpu")
    args = ap.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model_dir).to(args.device)
    model.eval()

    rows = load_test_set(args.test_file)
    if args.limit:
        rows = rows[: args.limit]

    scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)

    results = []
    for i in range(0, len(rows), args.batch_size):
        batch = rows[i : i + args.batch_size]
        preds = generate_batch(
            model, tokenizer, [r["input_text"] for r in batch],
            args.max_new_tokens, args.num_beams, args.device,
        )
        for row, pred in zip(batch, preds):
            parsed, json_err = schema.parse_json_strict(pred)
            rouge_l = scorer.score(row["target"], pred)["rougeL"].fmeasure
            errs = [] if json_err else rubric_errors(row, parsed)
            results.append({
                "task_type": row["task_type"],
                "intent": row.get("intent", ""),
                "input_text": row["input_text"],
                "target": row["target"],
                "prediction": pred,
                "json_valid": json_err is None,
                "json_error": json_err,
                "rouge_l": rouge_l,
                "rubric_errors": errs,
                "rubric_pass": json_err is None and not errs,
            })
        print(f"  evaluated {min(i + args.batch_size, len(rows))}/{len(rows)}", file=sys.stderr)

    report = summarize(results)
    report["acceptance"] = check_acceptance(report)

    out_path = Path(args.report_out) if args.report_out else Path(args.model_dir) / "eval_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        json.dump({"summary": report, "examples": results}, f, indent=2)

    print(json.dumps(report, indent=2))
    print(f"\nFull report (incl. per-example error analysis): {out_path}")


def summarize(results: list[dict]) -> dict:
    n = len(results)
    if n == 0:
        return {"n": 0}

    json_valid = sum(r["json_valid"] for r in results)
    rubric_pass = sum(r["rubric_pass"] for r in results)
    avg_rouge = sum(r["rouge_l"] for r in results) / n

    by_task_type = defaultdict(lambda: {"n": 0, "json_valid": 0, "rubric_pass": 0, "rouge_sum": 0.0})
    by_intent = defaultdict(lambda: {"n": 0, "json_valid": 0, "rubric_pass": 0, "rouge_sum": 0.0})
    for r in results:
        for bucket, key in ((by_task_type, r["task_type"]), (by_intent, r["intent"])):
            b = bucket[key]
            b["n"] += 1
            b["json_valid"] += r["json_valid"]
            b["rubric_pass"] += r["rubric_pass"]
            b["rouge_sum"] += r["rouge_l"]

    def finalize(bucket):
        return {
            k: {
                "n": v["n"],
                "json_valid_rate": round(v["json_valid"] / v["n"], 4),
                "rubric_pass_rate": round(v["rubric_pass"] / v["n"], 4),
                "avg_rouge_l": round(v["rouge_sum"] / v["n"], 4),
            }
            for k, v in bucket.items()
        }

    return {
        "n": n,
        "json_valid_rate": round(json_valid / n, 4),
        "rubric_pass_rate": round(rubric_pass / n, 4),
        "avg_rouge_l": round(avg_rouge, 4),
        "by_task_type": finalize(by_task_type),
        "by_intent": finalize(by_intent),
    }


def check_acceptance(report: dict) -> dict:
    return {
        "json_valid_rate": {
            "value": report.get("json_valid_rate"),
            "threshold": ACCEPTANCE["json_valid_rate"],
            "pass": (report.get("json_valid_rate") or 0) >= ACCEPTANCE["json_valid_rate"],
        },
        "rubric_pass_rate": {
            "value": report.get("rubric_pass_rate"),
            "threshold": ACCEPTANCE["rubric_pass_rate"],
            "pass": (report.get("rubric_pass_rate") or 0) >= ACCEPTANCE["rubric_pass_rate"],
        },
        "note": "Model size (<150MB quantized) is checked separately after ml/convert_to_onnx.py — see ml/README.md.",
    }


if __name__ == "__main__":
    main()
