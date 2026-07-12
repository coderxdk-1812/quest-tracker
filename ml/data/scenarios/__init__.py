"""
Registry aggregating all ~250 hand-authored scenarios across the 10 intents,
each in its own module for manageability. Pure stdlib.

Re-exports render_list from _common so ``from scenarios import all_scenarios,
render_list`` (used by ml/data/generate.py) keeps working unchanged.
"""

from __future__ import annotations

from typing import Callable

from ._common import Scenario, render_list  # noqa: F401  (re-exported)

from .essay import SCENARIOS as _ESSAY, _post as _essay_post
from .problem_set import SCENARIOS as _PROBLEM_SET, _post as _problem_set_post
from .reading import SCENARIOS as _READING, _post as _reading_post
from .lab_report import SCENARIOS as _LAB_REPORT, _post as _lab_report_post
from .presentation import SCENARIOS as _PRESENTATION, _post as _presentation_post
from .revision import SCENARIOS as _REVISION, _post as _revision_post
from .coding import SCENARIOS as _CODING, _post as _coding_post
from .project import SCENARIOS as _PROJECT, _post as _project_post
from .memorization import SCENARIOS as _MEMORIZATION, _post as _memorization_post
from .generic import SCENARIOS as _GENERIC, _post as _generic_post

REGISTRY: dict[str, tuple[list[Scenario], Callable[[dict], dict]]] = {
    "essay": (_ESSAY, _essay_post),
    "problem_set": (_PROBLEM_SET, _problem_set_post),
    "reading": (_READING, _reading_post),
    "lab_report": (_LAB_REPORT, _lab_report_post),
    "presentation": (_PRESENTATION, _presentation_post),
    "revision": (_REVISION, _revision_post),
    "coding": (_CODING, _coding_post),
    "project": (_PROJECT, _project_post),
    "memorization": (_MEMORIZATION, _memorization_post),
    "generic": (_GENERIC, _generic_post),
}


def all_scenarios() -> list[tuple[Scenario, Callable[[dict], dict]]]:
    out = []
    for _intent, (scenarios, post) in REGISTRY.items():
        for s in scenarios:
            out.append((s, post))
    return out
