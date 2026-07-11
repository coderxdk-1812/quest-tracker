"""
Augments the hand-authored scenarios (scenarios.py) into a large set of
concrete Examples for all three task types. Pure stdlib.

Usage: python3 generate.py > /tmp/preview.jsonl   (or import generate_all())
"""

from __future__ import annotations

import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from pools import rng
from scenarios import all_scenarios, render_list
import schema

VARIANTS_PER_SCENARIO = 220
_NOW = datetime.datetime(2026, 7, 15, 12, 0, 0, tzinfo=datetime.timezone.utc)


def _deadline_iso(hours: float | None) -> str | None:
    if hours is None:
        return None
    return (_NOW + datetime.timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _build_task(scenario, v: dict) -> dict:
    tags = list(v.get("tags", []))
    if v.get("group_kind") == "group" and "group-project" not in tags:
        tags = tags + ["group-project"]
    return schema.make_task_json(
        title=scenario.title_tpl.format(**v),
        description=scenario.description_tpl.format(**v) if scenario.description_tpl else None,
        subject=v.get("subject"),
        intent=scenario.intent,
        priority=v["priority"],
        deadline=_deadline_iso(v["_deadline_hours"]),
        tags=tags,
    )


def generate_scenario(scenario, post_hook, n: int, seed: int) -> list[schema.Example]:
    r = rng(seed)
    examples: list[schema.Example] = []
    seen_keys: set[str] = set()
    attempts = 0
    while len(seen_keys) < n and attempts < n * 12:
        attempts += 1
        v = scenario.sample_vars(r)
        v = post_hook(v)
        try:
            task = _build_task(scenario, v)
        except KeyError:
            continue
        # Uniqueness on the full rendered task (title+description+priority+
        # deadline+tags), not just title — several scenarios vary numeric
        # detail (minutes/slides/word count) only in the description.
        key = schema.dumps_compact(task)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        variant_id = f"{scenario.id}#{len(seen_keys)}"

        # breakdown: task -> concrete steps
        good_steps = render_list(scenario.breakdown_steps_tpl, v)
        examples.append(schema.Example(
            task_type="breakdown",
            input_text=schema.format_input("breakdown", task),
            target=schema.dumps_compact(good_steps),
            intent=scenario.intent, seed_id=variant_id,
        ))

        # clarify: task + (partially vague) steps -> targeted questions
        vague_steps = render_list(scenario.vague_steps_tpl(), v)
        questions = [
            {
                "question": q["question"].format(**v),
                "targetStepIndex": q["target_index"],
                "targetStepText": vague_steps[q["target_index"]],
            }
            for q in scenario.clarify_questions_tpl
        ]
        examples.append(schema.Example(
            task_type="clarify",
            input_text=schema.format_input("clarify", task, steps=vague_steps),
            target=schema.dumps_compact(questions),
            intent=scenario.intent, seed_id=variant_id,
        ))

        # clarify (negative case): steps are already all concrete -> no
        # questions. Teaches the model restraint instead of always asking
        # filler questions (see QuestBreakdown.tsx Phase 6 UX requirement).
        examples.append(schema.Example(
            task_type="clarify",
            input_text=schema.format_input("clarify", task, steps=good_steps),
            target=schema.dumps_compact([]),
            intent=scenario.intent, seed_id=variant_id + "_noq",
        ))

        # refine: task + vague steps + answers -> sharpened steps
        answers = [
            {"question": q["question"], "answer": a}
            for q, a in zip(questions, render_list(scenario.refine_answers_tpl, v))
        ]
        refined_steps = render_list(scenario.refine_steps_tpl, v)
        examples.append(schema.Example(
            task_type="refine",
            input_text=schema.format_input("refine", task, steps=vague_steps, answers=answers),
            target=schema.dumps_compact(refined_steps),
            intent=scenario.intent, seed_id=variant_id,
        ))

    return examples


def generate_all(variants_per_scenario: int = VARIANTS_PER_SCENARIO) -> list[schema.Example]:
    examples: list[schema.Example] = []
    for i, (scenario, post_hook) in enumerate(all_scenarios()):
        examples += generate_scenario(scenario, post_hook, variants_per_scenario, seed=1000 + i)
    return examples


if __name__ == "__main__":
    import json
    for ex in generate_all():
        print(json.dumps(ex.to_json()))
