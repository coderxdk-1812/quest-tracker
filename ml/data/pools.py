"""
Shared variable pools used to augment hand-authored scenarios (ml/data/scenarios.py)
into a large, diverse dataset. Pure stdlib, no dependencies.
"""

import random

SUBJECTS = [
    "History", "English Literature", "Biology", "Chemistry", "Physics",
    "Mathematics", "Computer Science", "Economics", "Geography", "Art",
    "Music", "Psychology", "Sociology", "Spanish", "French", "Philosophy",
    "Business Studies", "Politics", "Environmental Science", "Statistics",
]

# Deadline phrases paired with an (hours_from_now, ISO-ish template) so
# generated tasks span urgent/soon/normal/far, matching questBreakdown.ts's
# Urgency buckets (urgent <=24h, soon <=72h, normal, far >=240h).
DEADLINES = [
    ("in 5 hours", 5),
    ("tomorrow morning", 18),
    ("in 2 days", 48),
    ("by Friday", 70),
    ("next week", 168),
    ("in three weeks", 500),
    ("next month", 720),
    (None, None),  # no deadline at all
]

PRIORITIES = ["easy", "medium", "hard"]

GROUP_PHRASES = [
    ("group", "with my project group"),
    ("group", "as a team of four"),
    ("group", "with my lab partner"),
    ("solo", "on my own"),
    ("solo", None),
    ("solo", None),  # weight solo slightly more; None -> no phrase appended
]

TAG_POOLS = [
    [], ["exam"], ["homework"], ["coursework"], ["group-project"],
    ["urgent"], ["revision"], ["extra-credit"],
]

WORD_COUNTS = [400, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000]
ITEM_COUNTS = [5, 8, 10, 12, 15, 18, 20, 25, 30, 40]
SLIDE_COUNTS = [5, 6, 8, 10, 12, 15, 20]
MINUTES = [3, 5, 7, 8, 10, 12, 15, 20]
PAGE_COUNTS = [10, 20, 30, 50, 75, 100]
CHAPTER_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
ITEM_MEMO_COUNTS = [15, 20, 25, 30, 40, 50, 60, 80]

LANGUAGES = ["Python", "JavaScript", "Java", "C++", "TypeScript", "SQL", "Swift", "Go"]
CODING_MODES = ["new build", "debugging existing code", "fixing a broken build"]

AUDIENCES = [
    "the class", "the school board", "a panel of judges", "my study group",
    "parents at open evening", "the science fair judges", "my professor",
]


def rng(seed: int) -> random.Random:
    return random.Random(seed)
