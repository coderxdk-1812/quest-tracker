"""
Shared task/IO schema for the on-device quest-breakdown model.

This is the single source of truth for:
  - the Task JSON shape (mirrors src/lib/questBreakdown.ts's BreakdownInput)
  - the three task-type input prefixes (breakdown / clarify / refine)
  - how a prefixed model INPUT string is built
  - what a valid model OUTPUT looks like for each task type, and how to validate one

Zero third-party dependencies on purpose: ml/data/*.py (dataset generation and
validation) must be runnable with nothing but the stdlib, so the dataset can be
rebuilt/inspected without installing torch/transformers.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Optional

# Must stay byte-for-byte in sync with QuestIntent in src/lib/questBreakdown.ts.
INTENTS = [
    "essay", "problem_set", "reading", "lab_report", "presentation",
    "revision", "coding", "project", "memorization", "generic",
]

PRIORITIES = ["easy", "medium", "hard"]

TASK_TYPES = ["breakdown", "clarify", "refine"]

MAX_STEPS = 8
MIN_STEPS = 3
MAX_QUESTIONS = 3


# ───────────────────────── input formatting ─────────────────────────

def dumps_compact(obj: Any) -> str:
    """Compact JSON (no whitespace) — keeps sequences short for the encoder."""
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def make_task_json(
    title: str,
    description: Optional[str] = None,
    subject: Optional[str] = None,
    intent: Optional[str] = None,
    priority: str = "medium",
    deadline: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> dict:
    if intent is not None and intent not in INTENTS:
        raise ValueError(f"unknown intent: {intent!r}")
    if priority not in PRIORITIES:
        raise ValueError(f"unknown priority: {priority!r}")
    return {
        "title": title,
        "description": description,
        "subject": subject,
        "intent": intent,
        "priority": priority,
        "deadline": deadline,
        "tags": tags or [],
    }


def format_input(
    task_type: str,
    task: dict,
    steps: Optional[list[str]] = None,
    answers: Optional[list[dict]] = None,
) -> str:
    """
    Builds the single prefixed text string fed to the T5 encoder. This exact
    format must be reproduced identically by ml/train.py, ml/eval.py, and the
    browser runtime (src/lib/localModel.ts) — see ml/README.md.

      breakdown: {task}
      clarify:   {task} steps: {steps}
      refine:    {task} steps: {steps} answers: {answers}
    """
    if task_type not in TASK_TYPES:
        raise ValueError(f"unknown task_type: {task_type!r}")
    parts = [f"{task_type}: {dumps_compact(task)}"]
    if steps is not None:
        parts.append(f"steps: {dumps_compact(steps)}")
    if answers is not None:
        parts.append(f"answers: {dumps_compact(answers)}")
    return " ".join(parts)


# ───────────────────────── example record ─────────────────────────

@dataclass
class Example:
    """One training/eval row. `target` is the exact compact-JSON string the
    model is trained to generate for `input_text`."""
    task_type: str
    input_text: str
    target: str
    # Provenance, not used by the model — helps eval/error-analysis group by intent.
    intent: str = ""
    seed_id: str = ""
    meta: dict = field(default_factory=dict)

    def to_json(self) -> dict:
        return {
            "task_type": self.task_type,
            "input_text": self.input_text,
            "target": self.target,
            "intent": self.intent,
            "seed_id": self.seed_id,
        }


# ───────────────────────── output validation ─────────────────────────

# Steps that read as filler rather than a concrete action. Deliberately strict:
# during generation we control the output, so genuinely specific steps should
# never trip this — it exists to catch generation bugs, not to be a lenient net.
_GENERIC_STEP_RE = re.compile(
    r"^(research( it| this| the topic)?|review (your |the )?notes|"
    r"do (the|your|some) work|work on (it|this|the task)|"
    r"complete the task|finish (it|the work)|study|get started|plan ahead|"
    r"think about it|write the (essay|report|paper|code)|do (some|the) research|"
    r"read (about it|more)|prepare|practice)\.?$",
    re.IGNORECASE,
)


def is_generic_step(step: str) -> bool:
    s = step.strip()
    if len(s.split()) < 3:
        return True
    return bool(_GENERIC_STEP_RE.match(s))


def parse_json_strict(text: str) -> tuple[Optional[Any], Optional[str]]:
    try:
        return json.loads(text), None
    except json.JSONDecodeError as e:
        return None, f"invalid JSON: {e}"


def validate_task(task: dict) -> list[str]:
    errors = []
    if not isinstance(task, dict):
        return ["task is not an object"]
    if not task.get("title") or not isinstance(task["title"], str):
        errors.append("task.title missing/empty")
    if task.get("intent") is not None and task["intent"] not in INTENTS:
        errors.append(f"task.intent invalid: {task.get('intent')!r}")
    if task.get("priority") not in PRIORITIES:
        errors.append(f"task.priority invalid: {task.get('priority')!r}")
    if not isinstance(task.get("tags", []), list):
        errors.append("task.tags is not a list")
    return errors


def validate_breakdown_output(steps: Any) -> list[str]:
    errors = []
    if not isinstance(steps, list):
        return ["output is not a JSON array"]
    if not (MIN_STEPS <= len(steps) <= MAX_STEPS):
        errors.append(f"expected {MIN_STEPS}-{MAX_STEPS} steps, got {len(steps)}")
    for i, s in enumerate(steps):
        if not isinstance(s, str) or not s.strip():
            errors.append(f"step[{i}] is not a non-empty string")
            continue
        if is_generic_step(s):
            errors.append(f"step[{i}] is a bare generic placeholder: {s!r}")
    if len(set(s.strip().lower() for s in steps if isinstance(s, str))) != len(steps):
        errors.append("duplicate steps")
    return errors


def validate_clarify_output(questions: Any, steps: list[str]) -> list[str]:
    errors = []
    if not isinstance(questions, list):
        return ["output is not a JSON array"]
    if len(questions) > MAX_QUESTIONS:
        errors.append(f"more than {MAX_QUESTIONS} questions ({len(questions)})")
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            errors.append(f"question[{i}] is not an object")
            continue
        if not q.get("question") or not isinstance(q["question"], str):
            errors.append(f"question[{i}].question missing/empty")
        idx = q.get("targetStepIndex")
        if not isinstance(idx, int) or not (0 <= idx < len(steps)):
            errors.append(f"question[{i}].targetStepIndex out of range: {idx!r}")
            continue
        if q.get("targetStepText") != steps[idx]:
            errors.append(f"question[{i}].targetStepText does not match steps[{idx}]")
    return errors


def validate_refine_output(new_steps: Any, old_steps: list[str], answers: list[dict]) -> list[str]:
    errors = validate_breakdown_output(new_steps)
    if errors:
        return errors
    if [s.strip().lower() for s in new_steps] == [s.strip().lower() for s in old_steps]:
        errors.append("refine output is identical to the input steps (answers had no effect)")
    # At least one answer's content should be traceable in the sharpened steps —
    # otherwise the answers were decoration, not something the model "understood".
    joined = " ".join(new_steps).lower()
    if answers:
        hit = any(
            isinstance(a.get("answer"), str) and a["answer"].strip()
            and any(tok.lower() in joined for tok in a["answer"].split() if len(tok) > 3)
            for a in answers
        )
        if not hit:
            errors.append("no answer content is reflected anywhere in the refined steps")
    return errors


def validate_example(ex: Example) -> list[str]:
    """Full round-trip validation of one generated example."""
    errors = []
    if not ex.input_text.startswith(f"{ex.task_type}: "):
        errors.append("input_text missing correct task-type prefix")

    target, err = parse_json_strict(ex.target)
    if err:
        return errors + [err]

    if ex.task_type == "breakdown":
        errors += validate_breakdown_output(target)
    elif ex.task_type == "clarify":
        # Recover the steps this clarify example was conditioned on from input_text.
        m = re.search(r" steps: (\[.*\])$", ex.input_text)
        steps = json.loads(m.group(1)) if m else []
        errors += validate_clarify_output(target, steps)
    elif ex.task_type == "refine":
        m_steps = re.search(r" steps: (\[.*?\]) answers:", ex.input_text)
        m_ans = re.search(r" answers: (\[.*\])$", ex.input_text)
        old_steps = json.loads(m_steps.group(1)) if m_steps else []
        answers = json.loads(m_ans.group(1)) if m_ans else []
        errors += validate_refine_output(target, old_steps, answers)
    else:
        errors.append(f"unknown task_type {ex.task_type!r}")
    return errors
