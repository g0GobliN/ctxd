# The Diff Firewall

The Context Firewall controls what goes *to* a worker. The Diff Firewall
inspects what comes *back*.

AI workers routinely make changes larger than the task required: a one-line fix
reformats a file, a null check arrives with a refactor, a bug fix quietly adds a
dependency. The Diff Firewall measures that and explains it.

**It never edits, reverts or rejects anything.** A large diff is not wrong by
itself — sometimes a task genuinely needs one. The firewall's job is to make the
shape of a change visible so a human can decide.

```
diff ──► surface ──► noise ──► over-edit ──► classify ──► receipt
```

## Usage

```bash
ctxd diff --task "Change the webhook retry limit from 3 to 5"
```

| Option | Effect |
|---|---|
| `--task <text>` | Sets the expected change scope. Without it, no file can be judged unrelated |
| `--staged` | Inspect the index only |
| `--range <rev>` | Inspect a revision range, e.g. `main...HEAD` |
| `--path <p>` | Limit to a path (repeatable) |
| `--expect <p>` | Declare a path as in scope (repeatable) |
| `--verification <s>` | Record a `PASS` / `FAIL` / `NEEDS_REVIEW` result on the receipt |
| `--json` | Emit the Change Receipt as JSON |

Exit code `2` means the change is worth reviewing before continuing.

## Reading the diff

ctxd only ever *reads* Git — no `add`, no `stash`, no index mutation. Untracked
files are read from disk and represented as additions rather than staged with
`git add -N`, because a firewall that modified the repository it inspects would
be a worse problem than the one it detects.

Rename detection is on (`-M`), so a moved file reads as one rename instead of a
large deletion plus a large addition.

## Change surface (§51)

Counted from the diff, never inferred:

`files_changed` · `lines_added` · `lines_removed` · `lines_modified` ·
`semantic_lines` · `formatting_lines` · `formatting_only_changes` ·
`comment_only_changes` · `import_only_changes` · `dependency_changes` ·
`rename_changes` · `generated_file_changes` · `unrelated_files`

A file counts as **related** when its path shares vocabulary with the task, its
changed lines mention a task term, or it was declared with `--expect`. A test
file is never reported as unrelated while its subject was also changed — §51
calls that "potentially acceptable".

`lines_modified` counts replaced lines: within a hunk, a run of removals
followed by a run of additions is a modification of `min(removed, added)`.

## Formatting noise (§53)

The firewall asks one question of every changed line: **can a runtime observe
this?**

Removed and added lines are paired across the whole file after normalising away
indentation, internal whitespace, line endings, quote style and trailing
punctuation. Lines that pair up are churn; the remainder is semantic change.

Pairing is done per file, not per hunk — a formatter moves lines between hunks,
and per-hunk pairing would report the move as real change.

Detected: `line-endings` · `indentation` · `whitespace` · `quote-style` ·
`trailing-punctuation` · `blank-lines` · `import-order` · `whole-file-format`

Reported, never reverted. A future safe cleanup mechanism can act on this after
verification; the firewall itself does not.

## Comment noise (§54)

A comment earns its place by saying something the code cannot.

**Kept** — comments carrying reasoning: why unusual behaviour exists, security
constraints, business rules, external API quirks, workarounds, invariants,
links, TODOs. Also every documentation block (JSDoc, docstrings), which
describes an API rather than narrating the line beneath it.

**Flagged** — comments that open with narration (`// Check if the event
exists.`) or repeat ≥60% of the next line's identifiers.

The bar for flagging is high on purpose. Keeping a redundant comment costs
nothing; flagging a comment that records a security constraint is exactly the
mistake this feature exists to prevent. **Nothing is ever deleted** — the goal is
to move durable reasoning into ctxd memory instead of accumulating it in source.

## Expected scope and small-fix protection (§55)

ctxd infers a task's size from its wording:

| Size | Trigger | Expected |
|---|---|---|
| `small` | "change X from 3 to 5", "typo", "null check", "bump" | ~2 files, ~20 lines |
| `medium` | no size markers | ~5 files, ~200 lines |
| `large` | "refactor", "migrate", "rewrite", "add support for" | ~20 files, ~1500 lines |

`large` beats `small` when both match: "refactor the retry limit" is a refactor,
and treating it as a one-liner would raise a false alarm on a legitimate diff.

The mismatch check measures **raw** churn as well as semantic lines. A one-line
fix that reindents 300 lines is the §55 case exactly — the reviewer still has to
read all 300 — so churn gets a looser allowance (4×), not an unlimited one.

## Change efficiency score (§52)

> **This is not a correctness score.** A perfectly correct change can score low,
> and a wrong change can score 1.0.

It measures one thing: how focused the change appears relative to what the task
asked for. It starts at 1.0 and loses ground only for things that were counted:

| Deduction | Weight |
|---|---|
| Unrelated files | ratio × 0.35 |
| Formatting noise | ratio × 0.25 |
| Larger than expected | overshoot × 0.30 |
| Whole-file rewrites | ratio × 0.20 |
| Comment noise | ratio × 0.10 |
| Dependency changes | 0.10 |
| Duplicated logic | 0.05 |

Every deduction is returned with the score, so the receipt shows the arithmetic
rather than asserting a number.

## Classification (§57)

| Verdict | Meaning |
|---|---|
| `FOCUSED` | Minimal, focused change |
| `ACCEPTABLE` | Normal review is enough |
| `BROAD` | Skim for changes the task did not require |
| `SUSPICIOUS` | Review before continuing |
| `NEEDS_REVIEW` | A human must look |

Order is fixed, and hard evidence outranks the heuristic score: an architecture
violation, a failed verification, or a small task that produced a large change
all force `NEEDS_REVIEW` regardless of the score, because those are facts while
the score is an estimate.

## Change Receipt (§56)

Written to `~/.ctxd/change_receipts/<request_id>.json` — the counterpart to the
Context Receipt. That one explains every token ctxd sent; this one explains every
line the worker changed.

Receipts are written, never rewritten, and the worker's code is never touched.

## Determinism

No embeddings, no model, no network. The same diff and the same task always
produce the same verdict — which is why it can be tested and benchmarked.

`analyzeDiff(files, options)` is exposed as a pure function over a parsed diff,
so the firewall can be exercised on fixture diffs with no repository involved.
