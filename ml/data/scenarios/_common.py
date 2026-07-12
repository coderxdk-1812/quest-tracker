"""
Shared Scenario dataclass + rendering helpers used by every intent module in
this package. Pure stdlib — see ml/schema.py's module docstring for why.

Each Scenario is a coherent, realistic situation, not a bag of unrelated
templates: the SAME topic/subject/voice drive the task title, a set of
concrete breakdown steps, a "vague" variant of those steps (1-3 swapped for
deliberately generic placeholders, used as clarify's input), the clarify
questions that target exactly those placeholder indices, the user's answers
to those questions, and the refined steps that weave the answer content in
(not append it).

Genuine diversity across the ~250 scenarios in this package comes from each
scenario having its own fixed topic, title phrasing/voice, and step content
— var_pools are used only for the surface-level, legitimately-variable bits
(word/item/slide counts, deadline, priority, tags, group-vs-solo), never for
the topic or step wording itself. See ml/README.md's "Dataset" section.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from pools import SUBJECTS, DEADLINES, GROUP_PHRASES, TAG_POOLS, PRIORITIES  # noqa: E402

GENERIC_FILLERS = [
    "Research the topic", "Review your notes", "Do the work",
    "Write the essay", "Study for it", "Prepare", "Plan ahead",
    "Practice", "Read about it more", "Work on it",
]


@dataclass
class Scenario:
    id: str
    intent: str
    title_tpl: str
    description_tpl: str | None
    # name -> pool (list) or callable(rng) -> value
    var_pools: dict[str, Any]
    breakdown_steps_tpl: list[str]
    vague_indices: list[int]                 # which breakdown_steps_tpl indices get swapped for a filler
    clarify_questions_tpl: list[dict]         # [{"question": tpl, "target_index": i}]  len == len(vague_indices)
    refine_answers_tpl: list[str]             # answer text template, aligned with clarify_questions_tpl
    refine_steps_tpl: list[str]               # fully sharpened steps (same length as breakdown_steps_tpl)
    tags_pool: list[list[str]] = field(default_factory=lambda: TAG_POOLS)
    # Chance [0,1] that a generated row nulls description/subject even when the
    # scenario defines them — simulates a user who left the field blank.
    description_omit_rate: float = 0.2
    subject_omit_rate: float = 0.15
    extra_static: dict[str, str] = field(default_factory=dict)  # constants available to .format()

    def vague_steps_tpl(self) -> list[str]:
        out = list(self.breakdown_steps_tpl)
        for n, idx in enumerate(self.vague_indices):
            out[idx] = GENERIC_FILLERS[(hash(self.id) + n) % len(GENERIC_FILLERS)]
        return out

    def sample_vars(self, r) -> dict[str, str]:
        v: dict[str, Any] = dict(self.extra_static)
        for name, pool in self.var_pools.items():
            v[name] = pool(r) if callable(pool) else r.choice(pool)
        if "subject" not in v:
            v["subject"] = r.choice(SUBJECTS)
        if "priority" not in v:
            v["priority"] = r.choice(PRIORITIES)
        deadline_phrase, deadline_hours = r.choice(DEADLINES)
        v["deadline_phrase"] = deadline_phrase or ""
        v["_deadline_hours"] = deadline_hours
        group_kind, group_phrase = r.choice(GROUP_PHRASES)
        v["group_kind"] = group_kind
        v["group_phrase"] = f" {group_phrase}" if group_phrase else ""
        v["tags"] = r.choice(self.tags_pool)
        if r.random() < self.description_omit_rate:
            v["_omit_description"] = True
        if r.random() < self.subject_omit_rate:
            v["_omit_subject"] = True
        return v


def render_list(tpls: list[str], v: dict) -> list[str]:
    return [t.format(**v) for t in tpls]


def no_post(v: dict) -> dict:
    """Default post-hook for scenarios with no tuple-pick vars to resolve."""
    return v
