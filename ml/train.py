"""
Fine-tunes flan-t5-small (or flan-t5-base — just switch model_name in the
config) multitask on breakdown/clarify/refine, using the examples produced by
ml/data/build_dataset.py.

The multitask "prefix formatting" is already baked into each example's
input_text by ml/schema.py's format_input() at dataset-build time (e.g.
"breakdown: {...}", "clarify: {...} steps: [...]") — this script just
tokenizes input_text -> target as a plain seq2seq pair, so the same
formatting function is guaranteed to be used at train time, eval time
(ml/eval.py), and inference time (src/lib/localModel.ts must mirror it).

Usage:
    python3 train.py --config configs/smoke.json     # CPU, ~seconds, proves the pipeline
    python3 train.py --config configs/full.json       # needs a GPU — see ml/README.md
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from datasets import load_dataset
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
    set_seed,
)

ML_DIR = Path(__file__).parent


def load_config(path: str) -> dict:
    with open(path) as f:
        cfg = json.load(f)
    cfg.pop("_comment", None)
    return cfg


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, help="Path to a JSON config (see ml/configs/).")
    ap.add_argument("--model_name", default=None, help="Override config's model_name (e.g. to scale to flan-t5-base).")
    args = ap.parse_args()

    cfg = load_config(args.config)
    if args.model_name:
        cfg["model_name"] = args.model_name

    set_seed(cfg["seed"])

    tokenizer = AutoTokenizer.from_pretrained(cfg["model_name"])
    model = AutoModelForSeq2SeqLM.from_pretrained(cfg["model_name"])

    data_files = {
        "train": str(ML_DIR / cfg["train_file"]),
        "validation": str(ML_DIR / cfg["val_file"]),
    }
    raw = load_dataset("json", data_files=data_files)

    if cfg.get("max_train_samples"):
        raw["train"] = raw["train"].select(range(min(cfg["max_train_samples"], len(raw["train"]))))
    if cfg.get("max_val_samples"):
        raw["validation"] = raw["validation"].select(range(min(cfg["max_val_samples"], len(raw["validation"]))))

    max_source_length = cfg["max_source_length"]
    max_target_length = cfg["max_target_length"]

    def preprocess(batch):
        model_inputs = tokenizer(
            batch["input_text"], max_length=max_source_length, truncation=True,
        )
        labels = tokenizer(
            text_target=batch["target"], max_length=max_target_length, truncation=True,
        )
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    tokenized = raw.map(
        preprocess, batched=True,
        remove_columns=raw["train"].column_names,
        desc="Tokenizing",
    )

    collator = DataCollatorForSeq2Seq(tokenizer, model=model, label_pad_token_id=-100)

    output_dir = str(ML_DIR / cfg["output_dir"])
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=cfg["per_device_train_batch_size"],
        per_device_eval_batch_size=cfg["per_device_eval_batch_size"],
        gradient_accumulation_steps=cfg.get("gradient_accumulation_steps", 1),
        learning_rate=cfg["learning_rate"],
        num_train_epochs=cfg["num_train_epochs"],
        eval_strategy=cfg["eval_strategy"],
        eval_steps=cfg.get("eval_steps"),
        save_strategy=cfg["eval_strategy"],
        save_steps=cfg.get("save_steps"),
        save_total_limit=cfg.get("save_total_limit", 3),
        logging_steps=cfg.get("logging_steps", 50),
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        predict_with_generate=True,
        generation_max_length=cfg.get("generation_max_length", max_target_length),
        generation_num_beams=cfg.get("generation_num_beams", 1),
        fp16=cfg.get("fp16", False),
        bf16=cfg.get("bf16", False),
        warmup_ratio=cfg.get("warmup_ratio", 0.0),
        weight_decay=cfg.get("weight_decay", 0.0),
        lr_scheduler_type=cfg.get("lr_scheduler_type", "linear"),
        seed=cfg["seed"],
        no_cuda=cfg.get("no_cuda", False),
        report_to=cfg.get("report_to", []),
        logging_dir=str(ML_DIR / cfg["output_dir"] / "logs"),
    )

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        data_collator=collator,
        tokenizer=tokenizer,
    )

    trainer.train()
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

    metrics = trainer.evaluate()
    with open(Path(output_dir) / "final_eval_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("Final eval metrics:", metrics)


if __name__ == "__main__":
    main()
