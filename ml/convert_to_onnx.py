"""
Exports a fine-tuned checkpoint to ONNX (via optimum) and int8-quantizes it
for Transformers.js (@huggingface/transformers).

Output layout matches what Transformers.js expects for a seq2seq model:

    <out_dir>/
      config.json, generation_config.json
      tokenizer.json, tokenizer_config.json, spiece.model, special_tokens_map.json
      onnx/
        encoder_model.onnx                 (fp32, kept for reference — not shipped)
        encoder_model_quantized.onnx        <- shipped
        decoder_model.onnx                  (fp32, kept for reference — not shipped)
        decoder_model_quantized.onnx        <- shipped
        decoder_with_past_model.onnx        (fp32, kept for reference — not shipped)
        decoder_with_past_model_quantized.onnx  <- shipped

Quantization uses plain dynamic INT8 (onnxruntime.quantization.quantize_dynamic,
no CPU-ISA targeting like avx512) since the target runtime is WASM in-browser,
not a specific server CPU.

Usage:
    python3 convert_to_onnx.py --model_dir runs/full --out_dir onnx/quest-model
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from onnxruntime.quantization import QuantType, quantize_dynamic
from optimum.onnxruntime import ORTModelForSeq2SeqLM
from transformers import AutoTokenizer

KEEP_FP32 = False  # set True while debugging conversion issues; final ship strips fp32 onnx


def export_onnx(model_dir: str, export_dir: Path) -> None:
    export_dir.mkdir(parents=True, exist_ok=True)
    model = ORTModelForSeq2SeqLM.from_pretrained(model_dir, export=True)
    model.save_pretrained(export_dir)
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    tokenizer.save_pretrained(export_dir)


def quantize_all(export_dir: Path, onnx_out_dir: Path, include_past: bool = False) -> list[Path]:
    onnx_out_dir.mkdir(parents=True, exist_ok=True)
    quantized_paths = []
    onnx_files = sorted(export_dir.glob("*.onnx"))
    if not onnx_files:
        raise RuntimeError(f"no .onnx files found in {export_dir} — export step failed")
    if not include_past:
        # decoder_with_past_model is the KV-cache-reuse graph — noticeably
        # faster generation but ~55MB on its own, which is what pushes
        # flan-t5-small over the ~150MB budget. Transformers.js still works
        # without it (falls back to re-running the full decoder each step);
        # for short JSON outputs the latency difference is minor. Opt back
        # in with --include_past if you have budget headroom to spare.
        onnx_files = [f for f in onnx_files if "decoder_with_past" not in f.name]
    for onnx_file in onnx_files:
        quant_name = onnx_file.stem + "_quantized.onnx"
        quant_path = onnx_out_dir / quant_name
        quantize_dynamic(
            model_input=str(onnx_file),
            model_output=str(quant_path),
            weight_type=QuantType.QInt8,
        )
        quantized_paths.append(quant_path)
        if KEEP_FP32:
            shutil.copy(onnx_file, onnx_out_dir / onnx_file.name)
    return quantized_paths


def assemble_output(export_dir: Path, onnx_out_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in export_dir.iterdir():
        if f.suffix == ".onnx":
            continue
        if f.is_file():
            shutil.copy(f, out_dir / f.name)
    dest_onnx = out_dir / "onnx"
    if dest_onnx.exists():
        shutil.rmtree(dest_onnx)
    shutil.copytree(onnx_out_dir, dest_onnx)


def report_size(out_dir: Path) -> int:
    total = sum(f.stat().st_size for f in out_dir.rglob("*") if f.is_file())
    print(f"\nTotal shipped size: {total / 1_000_000:.1f} MB (budget: ~150 MB)")
    for f in sorted(out_dir.rglob("*"), key=lambda p: -p.stat().st_size if p.is_file() else 0):
        if f.is_file():
            print(f"  {f.relative_to(out_dir)}: {f.stat().st_size / 1_000_000:.2f} MB")
    if total > 150_000_000:
        print("WARNING: over the ~150MB budget — consider flan-t5-small only (not base), "
              "or dropping decoder_with_past (Transformers.js can run without KV-cache reuse, slower).")
    return total


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model_dir", required=True, help="Fine-tuned PyTorch checkpoint dir (output of train.py).")
    ap.add_argument("--out_dir", required=True, help="Final output dir, ready to host/copy into public/models/.")
    ap.add_argument("--keep_fp32", action="store_true", help="Also keep the unquantized .onnx files (debugging only).")
    ap.add_argument("--include_past", action="store_true",
                     help="Keep decoder_with_past_model (faster generation, ~+55MB — likely blows the 150MB budget).")
    args = ap.parse_args()

    global KEEP_FP32
    KEEP_FP32 = args.keep_fp32

    out_dir = Path(args.out_dir)
    work_dir = out_dir.parent / f".{out_dir.name}_work"
    export_dir = work_dir / "export"
    quant_dir = work_dir / "quantized"

    print(f"[1/3] Exporting {args.model_dir} to ONNX...")
    export_onnx(args.model_dir, export_dir)

    print(f"[2/3] Quantizing to int8 (dynamic, portable — no CPU-ISA targeting)...")
    quantize_all(export_dir, quant_dir, include_past=args.include_past)

    print(f"[3/3] Assembling final output at {out_dir}...")
    assemble_output(export_dir, quant_dir, out_dir)

    shutil.rmtree(work_dir, ignore_errors=True)
    report_size(out_dir)
    print(f"\nDone. Point src/lib/localModel.ts's MODEL_ID/MODEL_BASE_URL at this directory "
          f"(hosted via HF Hub or public/models/ + Git LFS — see ml/README.md).")


if __name__ == "__main__":
    main()
