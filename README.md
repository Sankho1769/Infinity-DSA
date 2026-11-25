# Infinity DSA

**by InfinityDevLog** · *LeetCode Solutions*

A fast, static, plain HTML/CSS/JavaScript library of LeetCode problem guides designed to build intuition before code. Every completed guide walks through:

1. **What are we trying to find?** — plain-language intuition, term definitions, input/output rules, a labeled diagram for Example 1, and an edge-case Example 2.
2. **Interactive Dry Run** — step-by-step visual walkthrough (`Previous`, `Next`, `Reset`) showing how the recommended algorithm solves Example 1.
3. **Approach Comparison** — brute-force to optimal approaches with core ideas, step-by-step logic, invariants, when-to-use notes, complexity bounds (with variables and worst-case / expected / amortized tags), and recommended trade-offs.
4. **Multi-Language Code & Verification** — per-approach language selector across 19 tracked languages (`C++`, `Java`, `Python3`, `Python`, `JavaScript`, `TypeScript`, `C#`, `C`, `Go`, `Kotlin`, `Swift`, `Rust`, `Ruby`, `PHP`, `Dart`, `Scala`, `Elixir`, `Erlang`, `Racket`), showing only implemented languages as available and featuring live in-browser JavaScript test execution.

---

## Catalog Provenance & Coverage Gaps

- **Metadata Source:** [`noworneverev/leetcode-api`](https://github.com/noworneverev/leetcode-api) (`data/leetcode_questions_mini.json`)
- **License:** MIT License (Copyright (c) 2025 Yan-Ying Liao)
- **Upstream Commit Checked:** `0bfaa628613453817eeb0aebf4eb8b96300ad401` (`2026-11-24T08:58:20Z`)
- **Date Checked:** `2026-11-25`
- **Total Indexed Problems:** `4,123` (`3,332` Free, `791` Premium)
- **Completed Guides:** `10` (`#1`, `#2`, `#3`, `#4`, `#5`, `#6`, `#7`, `#8`, `#9`, `#53`)
- **Pending Guides:** `4,113` (marked **Guide pending** and linked directly to the official LeetCode problem)

### Known Coverage Gaps & Access Policy
- **Premium entries (791 problems):** Indexed using public metadata only (`number`, `title`, `slug`, `difficulty`, `topics`, `access: "Premium"`, and official link). Gated problem statements are never copied; readers are directed to LeetCode.
- **Missing upstream topics (144 problems):** Some entries (primarily JavaScript, pandas, and newly added problems) have empty `topicTags` in the upstream snapshot. These are explicitly marked as `unknown` in `data/catalog.json` rather than guessed.
- **Categories beyond Algorithms:** Database (`323`), JavaScript (`67`), pandas (`15`), Concurrency (`9`), and Shell (`4`) problems are indexed in the catalog and marked `Guide pending`.
- **Regional problem sets:** Only global `leetcode.com` numbered problems (`#1`–`#4123`) are present in this dataset; LeetCode China-only prefixes (`LCP`, `LCR`, `Interview`) are excluded.

---

## Running Locally

Because the site dynamically fetches `data/catalog.json` and individual `data/guides/*.json` files on demand, serve the repository over any local static HTTP server (opening `file://` directly blocks `fetch` in most browsers):

```bash
# Option 1: Python built-in HTTP server
python -m http.server 8000

# Option 2: Node static server
npx serve .
```

Then open `http://localhost:8000/` in your browser.

### Shareable URLs
- Homepage with filters: `index.html?q=array&diff=Easy&status=available`
- Direct problem guide: `problem.html?slug=two-sum` or `problem.html?id=53`

---

## Updating the Problem Catalog

Run the repeatable importer to fetch the latest upstream snapshot and regenerate `data/catalog.json` while **preserving all existing guides** in `data/guides/`:

```bash
# Fetch fresh snapshot from GitHub and rebuild data/catalog.json
python scripts/import_catalog.py

# Or rebuild from a local snapshot file
python scripts/import_catalog.py --local data/source_snapshot.json
```

The script automatically scans `data/guides/*.json`, checks completeness, computes per-problem and global language coverage, and never modifies existing guide files.

---

## Adding a New Problem Guide

1. Create a new JSON file in `data/guides/<number>-<slug>.json` matching an entry in `data/catalog.json`. Follow an existing guide (for example `data/guides/1-two-sum.json` or `data/guides/2-add-two-numbers.json`) for the exact schema:
   - `understand`: `question`, `plainExplanation`, `inputMeaning`, `outputMeaning`, `rules`, `terms`, `example1` (with `diagram`), and `example2` (edge case).
   - `dryRun`: `approachId`, `algorithmName`, and `steps` (`title`, `description`, `state` diagram).
   - `approaches`: array of genuinely distinct approaches (exactly one with `"recommended": true` and `recommendedTradeOff`), each containing `coreIdea`, `steps`, `whyItWorks`, `whenToUse`, `complexity` (`time`, `space`, `variables`, `boundType`), and `code` keyed by canonical language name.
   - `tests` (plus `javaDriver`, `phpDriver`, `csharpDriver` when those languages are provided).
2. Rebuild the catalog index so homepage stats, search, and language filters reflect the new guide:
   ```bash
   python scripts/import_catalog.py --local data/source_snapshot.json
   ```
3. Run the validator and multi-runtime test suite:
   ```bash
   python scripts/validate_and_test.py
   ```
   This verifies:
   - No duplicate problem numbers or slugs
   - No broken internal `guideFile` links or orphaned guide files
   - Required sections, diagrams, and catalog/guide consistency
   - All test cases pass across every locally available runtime (`Python3`, `Python`, `JavaScript`, `TypeScript`, `Java`, `PHP`, `C#`), while reporting any languages whose runtimes are not installed locally.
