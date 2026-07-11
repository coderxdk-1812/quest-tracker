"""
Hand-authored seed scenarios — the "make-or-break" content for the dataset.

Each Scenario is a coherent, realistic situation (not a bag of unrelated
templates): the SAME topic/subject/vars drive the task title, a set of
concrete breakdown steps, a "vague" variant of those steps (1-2 swapped for
deliberately generic placeholders, used as clarify's input), the clarify
questions that target exactly those placeholder indices, the user's answers
to those questions, and the refined steps that weave the answer content in.

ml/data/generate.py turns each Scenario into hundreds of concrete examples by
sampling its variable pools; ml/data/build_dataset.py fans that out across all
three task types (breakdown/clarify/refine) and validates every example.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from pools import (
    AUDIENCES, CHAPTER_NUMS, CODING_MODES, DEADLINES, GROUP_PHRASES,
    ITEM_COUNTS, ITEM_MEMO_COUNTS, LANGUAGES, MINUTES, PAGE_COUNTS,
    PRIORITIES, SLIDE_COUNTS, SUBJECTS, TAG_POOLS, WORD_COUNTS, rng,
)

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
        subject = v.get("subject") or r.choice(SUBJECTS)
        v["subject"] = subject
        priority = v.get("priority") or r.choice(PRIORITIES)
        v["priority"] = priority
        deadline_phrase, deadline_hours = r.choice(DEADLINES)
        v["deadline_phrase"] = deadline_phrase or ""
        v["_deadline_hours"] = deadline_hours
        group_kind, group_phrase = r.choice(GROUP_PHRASES)
        v["group_kind"] = group_kind
        v["group_phrase"] = f" {group_phrase}" if group_phrase else ""
        v["tags"] = r.choice(self.tags_pool)
        return v


def render_list(tpls: list[str], v: dict) -> list[str]:
    return [t.format(**v) for t in tpls]


# ═══════════════════════════════ essay ═══════════════════════════════

_ESSAY_TOPICS = [
    ("History", "the causes of World War 1"),
    ("History", "the fall of the Roman Empire"),
    ("English Literature", "the theme of ambition in Macbeth"),
    ("English Literature", "unreliable narrators in modern fiction"),
    ("Politics", "the effects of social media on democracy"),
    ("Philosophy", "whether free will is compatible with determinism"),
    ("Environmental Science", "the impact of deforestation on the Amazon"),
    ("Economics", "whether minimum wage increases cause unemployment"),
]

SCENARIOS_ESSAY = [
    Scenario(
        id="essay_argumentative",
        intent="essay",
        title_tpl="Write a {word_count} word essay on {topic}",
        description_tpl="Due {deadline_phrase}. Need a clear argument, not just a summary.",
        var_pools={
            "topic_pair": lambda r: r.choice(_ESSAY_TOPICS),
            "word_count": WORD_COUNTS,
        },
        breakdown_steps_tpl=[
            "Read the prompt and underline exactly what is being asked about {topic}",
            "Brain-dump every argument you already have about {topic} — no filtering",
            "Write a one-line thesis about {topic}",
            "Outline: intro, 3 body points on {topic}, and a conclusion",
            "Draft the body paragraphs on {topic} (~{word_count} words total)",
            "Write the intro and conclusion last",
            "Re-read once for argument flow, once for grammar",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "What's your thesis or main argument about {topic}?", "target_index": 2},
        ],
        refine_answers_tpl=[
            "I think {topic} was mainly driven by economic pressure, not just politics",
        ],
        refine_steps_tpl=[
            "Read the prompt and underline exactly what is being asked about {topic}",
            "Brain-dump every argument you already have about {topic} — no filtering",
            "Draft a thesis around your economic-pressure argument for {topic}, stated in one sentence",
            "Outline: intro, 3 body points on {topic} that build the economic-pressure case, and a conclusion",
            "Draft the body paragraphs on {topic} (~{word_count} words total)",
            "Write the intro and conclusion last",
            "Re-read once for argument flow, once for grammar",
        ],
        extra_static={},
    ),
    Scenario(
        id="essay_book_review",
        intent="essay",
        title_tpl="Book review essay on {topic}",
        description_tpl=None,
        var_pools={
            "topic_pair": lambda r: r.choice(_ESSAY_TOPICS),
            "word_count": WORD_COUNTS,
        },
        breakdown_steps_tpl=[
            "Skim your notes/highlights on {topic} and list the strongest 3 moments",
            "Decide your overall verdict on {topic} in one sentence",
            "Gather 3-5 supporting quotes for {topic} and note the page/source for each",
            "Outline: intro, evidence paragraphs on {topic}, conclusion",
            "Draft the review (~{word_count} words)",
            "Re-read for whether every claim about {topic} has evidence behind it",
        ],
        vague_indices=[0],
        clarify_questions_tpl=[
            {"question": "Which specific moments or passages about {topic} stood out most?", "target_index": 0},
        ],
        refine_answers_tpl=[
            "the ending and how the main argument gets undercut by the last chapter",
        ],
        refine_steps_tpl=[
            "Pull your notes on the ending of {topic} and how it undercuts the main argument — that's your strongest moment",
            "Decide your overall verdict on {topic} in one sentence",
            "Gather 3-5 supporting quotes for {topic}, prioritising the ending, and note the page/source for each",
            "Outline: intro, evidence paragraphs on {topic} building to the ending twist, conclusion",
            "Draft the review (~{word_count} words)",
            "Re-read for whether every claim about {topic} has evidence behind it",
        ],
    ),
]


def _essay_post(v: dict) -> dict:
    subj, topic = v.pop("topic_pair")
    v["subject"] = subj
    v["topic"] = topic
    return v


# ═══════════════════════════════ problem_set ═══════════════════════════════

_PSET_TOPICS = [
    ("Mathematics", "quadratic equations"),
    ("Mathematics", "integration by parts"),
    ("Physics", "projectile motion"),
    ("Physics", "circuits and Ohm's law"),
    ("Chemistry", "stoichiometry"),
    ("Statistics", "hypothesis testing"),
]

SCENARIOS_PSET = [
    Scenario(
        id="pset_worksheet",
        intent="problem_set",
        title_tpl="Finish the {topic} problem set ({item_count} questions)",
        description_tpl="Covers {topic}, due {deadline_phrase}.",
        var_pools={"topic_pair": lambda r: r.choice(_PSET_TOPICS), "item_count": ITEM_COUNTS},
        breakdown_steps_tpl=[
            "Skim all {item_count} {topic} questions and tag each easy / medium / hard",
            "Do every easy {topic} question first to build momentum",
            "Re-read your notes/formulas on {topic} for the hard ones",
            "Work the medium {topic} questions",
            "Do the hardest {topic} problems first; mark anything you get stuck on",
            "Check answers and redo every one you got wrong",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "Which part of {topic} are you shakiest on?", "target_index": 2},
        ],
        refine_answers_tpl=["I keep mixing up the formula for the discriminant"],
        refine_steps_tpl=[
            "Skim all {item_count} {topic} questions and tag each easy / medium / hard",
            "Do every easy {topic} question first to build momentum",
            "Re-derive the discriminant formula from scratch once, then write it at the top of your page",
            "Work the medium {topic} questions",
            "Do the hardest {topic} problems first; mark anything you get stuck on",
            "Check answers and redo every one you got wrong",
        ],
    ),
    Scenario(
        id="pset_exam_style",
        intent="problem_set",
        title_tpl="{item_count} {topic} practice problems before {deadline_phrase}",
        description_tpl=None,
        var_pools={"topic_pair": lambda r: r.choice(_PSET_TOPICS), "item_count": ITEM_COUNTS},
        breakdown_steps_tpl=[
            "Sort the {item_count} {topic} problems by difficulty",
            "Time yourself doing 5 {topic} problems under exam conditions",
            "Review the {topic} problems you got wrong or ran out of time on",
            "Redo those {topic} problems from scratch without looking at the solution",
            "Do a second timed batch of {topic} problems to check improvement",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "What specifically went wrong on the {topic} problems you missed — the setup, the method, or careless errors?", "target_index": 2},
        ],
        refine_answers_tpl=["mostly careless sign errors near the end, not the method itself"],
        refine_steps_tpl=[
            "Sort the {item_count} {topic} problems by difficulty",
            "Time yourself doing 5 {topic} problems under exam conditions",
            "Go back through and circle every sign error in your missed {topic} problems — your method is fine, this is a checking habit",
            "Redo those {topic} problems from scratch, checking signs at each line",
            "Do a second timed batch of {topic} problems to check improvement",
        ],
    ),
]


def _pset_post(v: dict) -> dict:
    subj, topic = v.pop("topic_pair")
    v["subject"] = subj
    v["topic"] = topic
    return v


# ═══════════════════════════════ reading ═══════════════════════════════

_READING_ITEMS = [
    ("English Literature", "the novel"),
    ("History", "the textbook chapter"),
    ("Biology", "the textbook chapter"),
    ("Philosophy", "the assigned paper"),
]

SCENARIOS_READING = [
    Scenario(
        id="reading_chapter",
        intent="reading",
        title_tpl="Read chapter {chapter} of {item} for {subject}",
        description_tpl=None,
        var_pools={"item_pair": lambda r: r.choice(_READING_ITEMS), "chapter": CHAPTER_NUMS},
        breakdown_steps_tpl=[
            "Preview chapter {chapter}: headings, intro and summary first",
            "Read the first section of chapter {chapter} and write a one-sentence summary",
            "Continue section by section through chapter {chapter}, summarising each in a line",
            "Note any terms or ideas from chapter {chapter} you did not understand",
            "Write a 3-bullet takeaway for chapter {chapter}",
        ],
        vague_indices=[3],
        clarify_questions_tpl=[
            {"question": "Do you need to annotate chapter {chapter} as you go, or just read it?", "target_index": 3},
        ],
        refine_answers_tpl=["I need to annotate it — there's a quiz on the details next class"],
        refine_steps_tpl=[
            "Preview chapter {chapter}: headings, intro and summary first",
            "Read the first section of chapter {chapter} and write a one-sentence summary",
            "Continue section by section through chapter {chapter}, summarising each in a line",
            "Annotate chapter {chapter} as you go — underline anything quiz-worthy, since there's a quiz on the details next class",
            "Write a 3-bullet takeaway for chapter {chapter}",
        ],
    ),
    Scenario(
        id="reading_pages",
        intent="reading",
        title_tpl="Read {pages} pages of {item} for {subject}",
        description_tpl="Due {deadline_phrase}.",
        var_pools={"item_pair": lambda r: r.choice(_READING_ITEMS), "pages": PAGE_COUNTS},
        breakdown_steps_tpl=[
            "Preview the {pages} pages: headings, intro and summary first",
            "Read the first quarter and write a one-sentence summary",
            "Continue through the remaining pages, summarising each section in a line",
            "Track how the main argument develops as you read",
            "Write a 3-bullet takeaway for the whole {pages} pages",
        ],
        vague_indices=[3],
        clarify_questions_tpl=[
            {"question": "What should you do with your notes once you're through the {pages} pages — annotate key quotes, or just track the plot/argument?", "target_index": 3},
        ],
        refine_answers_tpl=["track the main argument, I need to summarise it for a discussion"],
        refine_steps_tpl=[
            "Preview the {pages} pages: headings, intro and summary first",
            "Read the first quarter and write a one-sentence summary",
            "Continue through the remaining pages, summarising each section in a line",
            "Track how the main argument develops page by page, since you'll need to summarise it for discussion",
            "Write a 3-bullet takeaway for the whole {pages} pages",
        ],
    ),
]


def _reading_post(v: dict) -> dict:
    subj, item = v.pop("item_pair")
    v["subject"] = subj
    v["item"] = item
    return v


# ═══════════════════════════════ lab_report ═══════════════════════════════

_LAB_TOPICS = [
    ("Chemistry", "titration"),
    ("Physics", "the pendulum experiment"),
    ("Biology", "the enzyme activity experiment"),
]

SCENARIOS_LAB = [
    Scenario(
        id="lab_writeup",
        intent="lab_report",
        title_tpl="Write up the {topic} lab report",
        description_tpl="Due {deadline_phrase}.",
        var_pools={"topic_pair": lambda r: r.choice(_LAB_TOPICS)},
        breakdown_steps_tpl=[
            "Write the aim/hypothesis for the {topic} report in one sentence",
            "List apparatus and the {topic} method as numbered steps",
            "Put your raw data from the {topic} experiment into a clean table",
            "Do the calculations / plot the graph for {topic}",
            "Write the results and what they mean",
            "Write a discussion: errors, improvements, conclusion for {topic}",
        ],
        vague_indices=[4],
        clarify_questions_tpl=[
            {"question": "Is your raw data for {topic} fully collected, so you can write the results section now?", "target_index": 4},
        ],
        refine_answers_tpl=["yes, data's all in, I just haven't run the uncertainty calculation yet"],
        refine_steps_tpl=[
            "Write the aim/hypothesis for the {topic} report in one sentence",
            "List apparatus and the {topic} method as numbered steps",
            "Put your raw data from the {topic} experiment into a clean table",
            "Do the calculations / plot the graph for {topic}",
            "Run the uncertainty calculation on your {topic} data, then write the results and what they mean",
            "Write a discussion: errors, improvements, conclusion for {topic}",
        ],
    ),
    Scenario(
        id="lab_observations",
        intent="lab_report",
        title_tpl="{topic} observations write-up",
        description_tpl=None,
        var_pools={"topic_pair": lambda r: r.choice(_LAB_TOPICS)},
        breakdown_steps_tpl=[
            "Write the aim/hypothesis for {topic} in one sentence",
            "Organise your raw observations from {topic} into a table",
            "Draft the results section for {topic} from your observation table",
            "Do the calculations / plot the graph for {topic}",
            "Write a discussion: errors, improvements, conclusion for {topic}",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "Which sections does this {topic} report need — just method and results, or a full discussion too?", "target_index": 2},
        ],
        refine_answers_tpl=["method, results, and discussion — it's the full report this time"],
        refine_steps_tpl=[
            "Write the aim/hypothesis for {topic} in one sentence",
            "Organise your raw observations from {topic} into a table",
            "Write the method and results sections for {topic}, since this is the full report (not just observations)",
            "Do the calculations / plot the graph for {topic}",
            "Write a discussion: errors, improvements, conclusion for {topic}",
        ],
    ),
]


def _lab_post(v: dict) -> dict:
    subj, topic = v.pop("topic_pair")
    v["subject"] = subj
    v["topic"] = topic
    return v


# ═══════════════════════════════ presentation ═══════════════════════════════

_PRES_TOPICS = [
    ("Environmental Science", "renewable energy"),
    ("History", "the Cold War"),
    ("Biology", "the human genome project"),
    ("Business Studies", "our start-up pitch"),
]

SCENARIOS_PRES = [
    Scenario(
        id="pres_slides",
        intent="presentation",
        title_tpl="Make a presentation on {topic} for {audience}",
        description_tpl="{minutes} minutes, {slide_count} slides.",
        var_pools={
            "topic_pair": lambda r: r.choice(_PRES_TOPICS),
            "audience": AUDIENCES, "minutes": MINUTES, "slide_count": SLIDE_COUNTS,
        },
        breakdown_steps_tpl=[
            "Decide the single message {audience} should remember about {topic}",
            "Outline {slide_count} slides on {topic} (1 idea per slide)",
            "Build the slides on {topic} — visuals first, minimal text",
            "Write speaker notes for each slide",
            "Rehearse aloud for {audience} to fit ~{minutes} min",
        ],
        vague_indices=[3],
        clarify_questions_tpl=[
            {"question": "For the speaker notes on {topic}, do you want full sentences to read from, or just bullet-point cues?", "target_index": 3},
        ],
        refine_answers_tpl=["just bullet cues, I freeze up if I try to read full sentences"],
        refine_steps_tpl=[
            "Decide the single message {audience} should remember about {topic}",
            "Outline {slide_count} slides on {topic} (1 idea per slide)",
            "Build the slides on {topic} — visuals first, minimal text",
            "Write short bullet-point cues (not full sentences) for each slide, since reading full sentences makes you freeze up",
            "Rehearse aloud for {audience} to fit ~{minutes} min",
        ],
    ),
    Scenario(
        id="pres_pitch",
        intent="presentation",
        title_tpl="{topic} pitch deck for {audience}",
        description_tpl=None,
        var_pools={
            "topic_pair": lambda r: r.choice(_PRES_TOPICS),
            "audience": AUDIENCES, "minutes": MINUTES, "slide_count": SLIDE_COUNTS,
        },
        breakdown_steps_tpl=[
            "Write the one-line pitch for {topic} aimed at {audience}",
            "Gather the strongest evidence or data point for {topic} to convince {audience}",
            "Build {slide_count} slides on {topic}, one idea per slide",
            "Anticipate 3 tough questions {audience} might ask about {topic}",
            "Rehearse aloud for {audience} to fit ~{minutes} min",
        ],
        vague_indices=[1],
        clarify_questions_tpl=[
            {"question": "What's the strongest evidence or data point for {topic} that would convince {audience}?", "target_index": 1},
        ],
        refine_answers_tpl=["our pilot showed a 30% cost reduction in the first month"],
        refine_steps_tpl=[
            "Write the one-line pitch for {topic} aimed at {audience}",
            "Lead your evidence with the pilot's 30% cost reduction in month one — that's the number to build the deck around",
            "Build {slide_count} slides on {topic}, one idea per slide",
            "Anticipate 3 tough questions {audience} might ask about {topic}",
            "Rehearse aloud for {audience} to fit ~{minutes} min",
        ],
    ),
]


def _pres_post(v: dict) -> dict:
    subj, topic = v.pop("topic_pair")
    v["subject"] = subj
    v["topic"] = topic
    return v


# ═══════════════════════════════ revision ═══════════════════════════════

_REVISION_TOPICS = [
    ("Chemistry", "the chemistry exam", "organic reaction mechanisms"),
    ("Mathematics", "the maths midterm", "trigonometric identities"),
    ("Biology", "the biology final", "cellular respiration"),
    ("History", "the history exam", "the causes of the Cold War"),
]

SCENARIOS_REVISION = [
    Scenario(
        id="revision_exam",
        intent="revision",
        title_tpl="Revise for {exam_name}",
        description_tpl="Due {deadline_phrase}.",
        var_pools={"topic_triple": lambda r: r.choice(_REVISION_TOPICS)},
        breakdown_steps_tpl=[
            "List every topic on the {subject} syllabus",
            "Rate each {subject} topic red / amber / green by confidence",
            "Start with one weak {subject} topic and re-learn it from your notes",
            "Do active recall — close notes and write what you remember",
            "Practice past-paper questions on that topic",
            "Mark your answers and log mistakes to revisit",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "Which {subject} topics feel weakest right now?", "target_index": 2},
        ],
        refine_answers_tpl=["{weak_topic}, I keep blanking on it"],
        refine_steps_tpl=[
            "List every topic on the {subject} syllabus",
            "Rate each {subject} topic red / amber / green by confidence",
            "Focus revision on {weak_topic}: re-learn it from notes since that's where you keep blanking",
            "Do active recall — close notes and write what you remember, starting with {weak_topic}",
            "Practice past-paper questions on {weak_topic}",
            "Mark your answers and log mistakes to revisit",
        ],
    ),
    Scenario(
        id="revision_pastpapers",
        intent="revision",
        title_tpl="Past papers for {exam_name}",
        description_tpl=None,
        var_pools={"topic_triple": lambda r: r.choice(_REVISION_TOPICS)},
        breakdown_steps_tpl=[
            "Print or open 3 past papers for {subject}",
            "Do the first paper under timed exam conditions",
            "Mark the first {subject} paper and note where you lost marks",
            "Identify the weakest topic from your mistakes",
            "Redo just the questions on that topic from the other 2 papers",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "When marking the first {subject} paper, are you checking for wrong methods, or just wrong final answers?", "target_index": 2},
        ],
        refine_answers_tpl=["wrong methods mostly — I get partway through and pick the wrong approach"],
        refine_steps_tpl=[
            "Print or open 3 past papers for {subject}",
            "Do the first paper under timed exam conditions",
            "Mark the first paper checking for wrong methods/approach, not just wrong final answers, since that's where you're actually losing marks",
            "Identify the weakest topic from your mistakes",
            "Redo just the questions on that topic from the other 2 papers",
        ],
    ),
]


def _revision_post(v: dict) -> dict:
    subj, exam_name, weak_topic = v.pop("topic_triple")
    v["subject"] = subj
    v["exam_name"] = exam_name
    v["weak_topic"] = weak_topic
    return v


# ═══════════════════════════════ coding ═══════════════════════════════

_CODING_TASKS = [
    "a to-do list app", "a linked-list reversal function", "a REST API for a blog",
    "a web scraper", "a simple chatbot", "a login system",
]

SCENARIOS_CODING = [
    Scenario(
        id="coding_build",
        intent="coding",
        title_tpl="Build {coding_task} in {language}",
        description_tpl="{mode}.",
        var_pools={"coding_task": _CODING_TASKS, "language": LANGUAGES, "mode": CODING_MODES},
        breakdown_steps_tpl=[
            "Restate what {coding_task} needs to do and its expected input/output",
            "Write the approach for {coding_task} in plain English / pseudocode",
            "Implement the smallest piece of {coding_task} that runs",
            "Test {coding_task} with one simple case, then edge cases",
            "Debug failures one at a time",
            "Clean up and add a comment on how {coding_task} works",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "What should the first runnable version of {coding_task} in {language} actually do — the full thing, or just the core path?", "target_index": 2},
        ],
        refine_answers_tpl=["just the core path — I'll add auth/extra features after it works"],
        refine_steps_tpl=[
            "Restate what {coding_task} needs to do and its expected input/output",
            "Write the approach for {coding_task} in plain English / pseudocode",
            "Scaffold the {language} project and implement just the core path of {coding_task} first — save auth/extras for after it works",
            "Test {coding_task} with one simple case, then edge cases",
            "Debug failures one at a time",
            "Clean up and add a comment on how {coding_task} works",
        ],
    ),
    Scenario(
        id="coding_debug",
        intent="coding",
        title_tpl="Fix the bug in {coding_task} ({language})",
        description_tpl=None,
        var_pools={"coding_task": _CODING_TASKS, "language": LANGUAGES},
        breakdown_steps_tpl=[
            "Reproduce the bug in {coding_task} reliably",
            "Note the exact mismatch between actual and expected behaviour in {coding_task}",
            "Add print/log statements around the suspected area in {coding_task}",
            "Narrow down the exact line where {coding_task} breaks",
            "Fix it, then re-run the original reproduction case",
            "Add a regression test so this bug in {coding_task} can't come back silently",
        ],
        vague_indices=[1],
        clarify_questions_tpl=[
            {"question": "What's the actual vs. expected behaviour when {coding_task} breaks in {language}?", "target_index": 1},
        ],
        refine_answers_tpl=["it returns undefined instead of the saved item"],
        refine_steps_tpl=[
            "Reproduce the bug in {coding_task} reliably",
            "Note the exact mismatch: {coding_task} returns undefined where it should return the saved item — that's the behaviour to chase",
            "Add print/log statements around the suspected area in {coding_task}",
            "Narrow down the exact line where {coding_task} returns undefined instead of the item",
            "Fix it, then re-run the original reproduction case",
            "Add a regression test so this bug in {coding_task} can't come back silently",
        ],
    ),
]


def _coding_post(v: dict) -> dict:
    return v


# ═══════════════════════════════ project ═══════════════════════════════

_PROJECT_IDEAS = [
    ("Environmental Science", "a renewable-energy science fair project"),
    ("Computer Science", "a portfolio website"),
    ("Business Studies", "a mock start-up plan"),
    ("Art", "a mixed-media art project"),
]

SCENARIOS_PROJECT = [
    Scenario(
        id="project_milestones",
        intent="project",
        title_tpl="{project_name}{group_phrase}",
        description_tpl="Due {deadline_phrase}.",
        var_pools={"project_pair": lambda r: r.choice(_PROJECT_IDEAS)},
        breakdown_steps_tpl=[
            "Write the goal and definition of \"done\" for {project_name} in 2 lines",
            "Break {project_name} into 3-6 milestones",
            "Pick the first milestone for {project_name} and list its concrete tasks",
            "Do the first task for {project_name} now",
            "Schedule the remaining milestones across your calendar",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "What does the finished version of {project_name} actually need to include to count as done?", "target_index": 2},
        ],
        refine_answers_tpl=["a working prototype plus a one-page write-up explaining the design choices"],
        refine_steps_tpl=[
            "Write the goal and definition of \"done\" for {project_name} in 2 lines",
            "Break {project_name} into 3-6 milestones",
            "Pick the first milestone toward a working prototype of {project_name}, and list its concrete tasks — the write-up comes after the prototype works",
            "Do the first task for {project_name} now",
            "Schedule the remaining milestones (including the design write-up) across your calendar",
        ],
    ),
    Scenario(
        id="project_group",
        intent="project",
        title_tpl="{project_name} with the group",
        description_tpl=None,
        var_pools={"project_pair": lambda r: r.choice(_PROJECT_IDEAS)},
        breakdown_steps_tpl=[
            "Agree who does what on {project_name}, and a check-in time",
            "Write the goal and definition of \"done\" for {project_name} in 2 lines",
            "Start your assigned part of {project_name} while the others start theirs in parallel",
            "Do your assigned part of {project_name} now",
            "Merge everyone's parts of {project_name} and review together",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "What's each person's specific role on {project_name}?", "target_index": 2},
        ],
        refine_answers_tpl=["I'm doing research, one person's building, one's presenting"],
        refine_steps_tpl=[
            "Agree who does what on {project_name}, and a check-in time",
            "Write the goal and definition of \"done\" for {project_name} in 2 lines",
            "Start your research role on {project_name} while the builder and presenter start theirs in parallel",
            "Do your assigned research part of {project_name} now",
            "Merge everyone's parts of {project_name} — research, build, and presentation — and review together",
        ],
    ),
]


def _project_post(v: dict) -> dict:
    subj, project_name = v.pop("project_pair")
    v["subject"] = subj
    v["project_name"] = project_name
    return v


# ═══════════════════════════════ memorization ═══════════════════════════════

_MEMO_ITEMS = [
    ("Spanish", "Spanish vocabulary"),
    ("Chemistry", "the periodic table"),
    ("Mathematics", "trigonometric identities"),
    ("Biology", "the stages of mitosis"),
]

SCENARIOS_MEMO = [
    Scenario(
        id="memo_flashcards",
        intent="memorization",
        title_tpl="Memorise {item} ({count} items)",
        description_tpl="Need it solid by {deadline_phrase}.",
        var_pools={"item_pair": lambda r: r.choice(_MEMO_ITEMS), "count": ITEM_MEMO_COUNTS},
        breakdown_steps_tpl=[
            "Split the {count} {item} into small chunks (5-10 items each)",
            "Make flashcards for chunk 1 of {item}",
            "Test yourself on chunk 1 of {item} until 100% recall",
            "Add the next chunk of {item} and review all previous ones",
            "Space it out: review {item} again tonight and tomorrow",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "How are you testing yourself on chunk 1 of {item} — writing it out, saying it aloud, or a quiz app?", "target_index": 2},
        ],
        refine_answers_tpl=["writing it out by hand, that's what sticks for me"],
        refine_steps_tpl=[
            "Split the {count} {item} into small chunks (5-10 items each)",
            "Make flashcards for chunk 1 of {item}",
            "Test yourself on chunk 1 by writing it out by hand until 100% recall — that's what sticks for you",
            "Add the next chunk of {item} and review all previous ones",
            "Space it out: review {item} again tonight and tomorrow",
        ],
    ),
    Scenario(
        id="memo_recite",
        intent="memorization",
        title_tpl="Learn {item} by heart",
        description_tpl=None,
        var_pools={"item_pair": lambda r: r.choice(_MEMO_ITEMS), "count": ITEM_MEMO_COUNTS},
        breakdown_steps_tpl=[
            "Write out all {count} {item} once from a reference",
            "Drill the first half of {item} in short repeated bursts",
            "Test yourself on the first half of {item} without looking",
            "Test yourself on the second half of {item} without looking",
            "Do a full run-through of {item} from memory",
        ],
        vague_indices=[1],
        clarify_questions_tpl=[
            {"question": "By when do you need {item} fully memorised?", "target_index": 1},
        ],
        refine_answers_tpl=["by class tomorrow, so I need it fast"],
        refine_steps_tpl=[
            "Write out all {count} {item} once from a reference",
            "Since it's due by class tomorrow, drill {item} in short 10-minute bursts every hour today instead of one long session",
            "Test yourself on the first half of {item} without looking",
            "Test yourself on the second half of {item} without looking",
            "Do a full run-through of {item} from memory before you sleep, and once more in the morning",
        ],
    ),
]


def _memo_post(v: dict) -> dict:
    subj, item = v.pop("item_pair")
    v["subject"] = subj
    v["item"] = item
    return v


# ═══════════════════════════════ generic ═══════════════════════════════

_GENERIC_TASKS = [
    "sort out my college application", "plan the club fundraiser",
    "organise my desk and notes for the term", "prepare for the club committee meeting",
    "put together a study schedule for the term",
]

SCENARIOS_GENERIC = [
    Scenario(
        id="generic_task",
        intent="generic",
        title_tpl="Need to {task_name}",
        description_tpl="Would like this done by {deadline_phrase}.",
        var_pools={"task_name": _GENERIC_TASKS},
        breakdown_steps_tpl=[
            "Write down what \"finished\" looks like for {task_name}",
            "Break {task_name} into 3 smaller, concrete sub-tasks",
            "Start the checklist for {task_name} covering everything that needs to happen",
            "Do the remaining sub-tasks for {task_name} one at a time",
            "Quick review: is anything missing before you call {task_name} done?",
        ],
        vague_indices=[2],
        clarify_questions_tpl=[
            {"question": "What's the very first concrete piece of {task_name} you could do right now?", "target_index": 2},
        ],
        refine_answers_tpl=["making a checklist of everything that needs to happen first"],
        refine_steps_tpl=[
            "Write down what \"finished\" looks like for {task_name}",
            "Break {task_name} into 3 smaller, concrete sub-tasks",
            "Start with the checklist of everything that needs to happen for {task_name} — that's your concrete first move",
            "Do the remaining sub-tasks for {task_name} one at a time, working off the checklist",
            "Quick review: is anything missing before you call {task_name} done?",
        ],
    ),
    Scenario(
        id="generic_errand",
        intent="generic",
        title_tpl="{task_name}",
        description_tpl=None,
        var_pools={"task_name": _GENERIC_TASKS},
        breakdown_steps_tpl=[
            "Write down what \"finished\" looks like for this",
            "List every concrete sub-task needed to finish this",
            "Do the easiest sub-task first to build momentum",
            "Do the remaining sub-tasks one at a time",
            "Quick review: is anything missing before you call it done?",
        ],
        vague_indices=[1],
        clarify_questions_tpl=[
            {"question": "What does \"done\" actually look like for \"{task_name}\"?", "target_index": 1},
        ],
        refine_answers_tpl=["everything's confirmed and I've told everyone involved"],
        refine_steps_tpl=[
            "Write down what \"finished\" looks like for this",
            "Done means: everything is confirmed and everyone involved has been told — treat that as your finish line",
            "Do the easiest sub-task first to build momentum",
            "Do the remaining sub-tasks one at a time",
            "Quick review: is everything confirmed and has everyone been told, before you call it done?",
        ],
    ),
]


def _generic_post(v: dict) -> dict:
    return v


# ═══════════════════════════════ registry ═══════════════════════════════

# Each intent's scenarios + the post-processing hook that resolves any
# "_pair"/"_triple" tuple picks into their component variables.
REGISTRY: dict[str, tuple[list[Scenario], Callable[[dict], dict]]] = {
    "essay": (SCENARIOS_ESSAY, _essay_post),
    "problem_set": (SCENARIOS_PSET, _pset_post),
    "reading": (SCENARIOS_READING, _reading_post),
    "lab_report": (SCENARIOS_LAB, _lab_post),
    "presentation": (SCENARIOS_PRES, _pres_post),
    "revision": (SCENARIOS_REVISION, _revision_post),
    "coding": (SCENARIOS_CODING, _coding_post),
    "project": (SCENARIOS_PROJECT, _project_post),
    "memorization": (SCENARIOS_MEMO, _memo_post),
    "generic": (SCENARIOS_GENERIC, _generic_post),
}


def all_scenarios() -> list[tuple[Scenario, Callable[[dict], dict]]]:
    out = []
    for _intent, (scenarios, post) in REGISTRY.items():
        for s in scenarios:
            out.append((s, post))
    return out
