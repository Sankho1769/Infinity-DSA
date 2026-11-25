#!/usr/bin/env python3
"""
Repeatable LeetCode problem catalog importer for Infinity DSA (by InfinityDevLog).

Fetches problem metadata from the MIT-licensed noworneverev/leetcode-api dataset
(or a local JSON snapshot via --local) and generates lightweight data/catalog.json
while preserving all existing guides in data/guides/.
"""

import argparse
import json
import os
import re
import urllib.request
from datetime import date
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
GUIDES_DIR = DATA_DIR / "guides"
CATALOG_PATH = DATA_DIR / "catalog.json"
RAW_SNAPSHOT_PATH = DATA_DIR / "source_snapshot.json"

DEFAULT_DATA_URL = (
    "https://raw.githubusercontent.com/noworneverev/leetcode-api/main/data/leetcode_questions_mini.json"
)
DEFAULT_COMMIT_API = (
    "https://api.github.com/repos/noworneverev/leetcode-api/commits/main"
)

ALL_LANGUAGES = [
    "C++",
    "Java",
    "Python3",
    "Python",
    "JavaScript",
    "TypeScript",
    "C#",
    "C",
    "Go",
    "Kotlin",
    "Swift",
    "Rust",
    "Ruby",
    "PHP",
    "Dart",
    "Scala",
    "Elixir",
    "Erlang",
    "Racket",
]

REQUIRED_GUIDE_TOP_KEYS = {"number", "slug", "title", "understand", "dryRun", "approaches", "tests"}


def extract_slug(item: dict) -> str:
    """Return problem slug from titleSlug or official URL, else 'unknown'."""
    slug = item.get("titleSlug")
    if isinstance(slug, str) and slug.strip():
        return slug.strip()
    url = item.get("url") or ""
    match = re.search(r"/problems/([^/]+)/?", url)
    if match:
        return match.group(1).strip()
    return "unknown"


def normalize_access(item: dict) -> str:
    """Map isPaidOnly boolean to 'Premium', 'Free', or 'unknown'."""
    paid = item.get("isPaidOnly")
    if paid is True:
        return "Premium"
    if paid is False:
        return "Free"
    return "unknown"


def normalize_topics(item: dict) -> list[str]:
    """Extract sorted unique topic tag names, or ['unknown'] if unavailable."""
    raw_tags = item.get("topicTags")
    if not isinstance(raw_tags, list) or not raw_tags:
        return ["unknown"]
    names: list[str] = []
    seen: set[str] = set()
    for tag in raw_tags:
        name = tag.get("name") if isinstance(tag, dict) else str(tag)
        if isinstance(name, str):
            clean = name.strip()
            if clean and clean not in seen:
                seen.add(clean)
                names.append(clean)
    return names if names else ["unknown"]


def is_complete_guide(guide: dict) -> bool:
    """Check whether a guide JSON contains all core sections and at least one approach."""
    if not isinstance(guide, dict):
        return False
    if not REQUIRED_GUIDE_TOP_KEYS.issubset(guide.keys()):
        return False
    approaches = guide.get("approaches")
    if not isinstance(approaches, list) or len(approaches) == 0:
        return False
    has_code = any(
        isinstance(ap.get("code"), dict) and any(str(v).strip() for v in ap["code"].values())
        for ap in approaches
        if isinstance(ap, dict)
    )
    return has_code


def scan_existing_guides() -> dict[int, dict]:
    """Scan data/guides/*.json and index completed guides by problem number."""
    guides_by_num: dict[int, dict] = {}
    if not GUIDES_DIR.exists():
        return guides_by_num

    for path in sorted(GUIDES_DIR.glob("*.json")):
        try:
            with path.open("r", encoding="utf-8") as fh:
                guide = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            print(f"[WARN] Skipping unreadable guide {path.name}: {exc}")
            continue

        if not is_complete_guide(guide):
            print(f"[WARN] Incomplete guide skipped from active coverage: {path.name}")
            continue

        num = int(guide["number"])
        langs_present: set[str] = set()
        for approach in guide["approaches"]:
            code_map = approach.get("code", {})
            for lang, snippet in code_map.items():
                if lang in ALL_LANGUAGES and isinstance(snippet, str) and snippet.strip():
                    langs_present.add(lang)

        ordered_langs = [lang for lang in ALL_LANGUAGES if lang in langs_present]
        rel_path = f"data/guides/{path.name}"
        guides_by_num[num] = {
            "guideFile": rel_path,
            "languages": ordered_langs,
            "slug": guide.get("slug"),
        }
    return guides_by_num


def fetch_upstream_commit_meta() -> tuple[str, str]:
    """Fetch latest commit SHA and timestamp from noworneverev/leetcode-api."""
    try:
        req = urllib.request.Request(
            DEFAULT_COMMIT_API,
            headers={"User-Agent": "Infinity-DSA-Catalog-Importer"},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        sha = info.get("sha", "unknown")
        commit_date = info.get("commit", {}).get("committer", {}).get("date", "unknown")
        return sha, commit_date
    except Exception as exc:
        print(f"[WARN] Could not fetch upstream commit metadata: {exc}")
        return "unknown", "unknown"


def load_source_items(local_path: str | None, url: str) -> tuple[list[dict], str, str]:
    """Load upstream problem items from local file or network URL."""
    if local_path:
        src = Path(local_path)
        with src.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data, "local-snapshot", "unknown"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Infinity-DSA-Catalog-Importer"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw_bytes = resp.read()
    RAW_SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAW_SNAPSHOT_PATH.write_bytes(raw_bytes)
    data = json.loads(raw_bytes.decode("utf-8"))
    sha, commit_date = fetch_upstream_commit_meta()
    return data, sha, commit_date


def build_catalog(local_path: str | None = None, url: str = DEFAULT_DATA_URL) -> dict:
    """Build lightweight catalog.json preserving all existing guides."""
    raw_items, upstream_sha, upstream_date = load_source_items(local_path, url)
    guides_by_num = scan_existing_guides()

    seen_numbers: set[int] = set()
    seen_slugs: set[str] = set()
    problems: list[dict] = []
    topic_set: set[str] = set()
    global_lang_set: set[str] = set()

    for item in raw_items:
        raw_fid = str(item.get("questionFrontendId") or "").strip()
        if not raw_fid.isdigit():
            continue
        number = int(raw_fid)
        if number in seen_numbers:
            continue
        seen_numbers.add(number)

        title = str(item.get("title") or "unknown").strip() or "unknown"
        slug = extract_slug(item)
        if slug != "unknown" and slug in seen_slugs:
            slug = f"{slug}-{number}"
        if slug != "unknown":
            seen_slugs.add(slug)

        difficulty = str(item.get("difficulty") or "unknown").strip() or "unknown"
        if difficulty not in {"Easy", "Medium", "Hard"}:
            difficulty = "unknown"

        topics = normalize_topics(item)
        for t in topics:
            topic_set.add(t)

        access = normalize_access(item)
        category = str(item.get("categoryTitle") or "unknown").strip() or "unknown"
        official_url = str(item.get("url") or "").strip()
        if not official_url and slug != "unknown":
            official_url = f"https://leetcode.com/problems/{slug}/"
        if not official_url:
            official_url = "unknown"

        guide_meta = guides_by_num.get(number)
        guide_status = "available" if guide_meta else "pending"
        guide_file = guide_meta["guideFile"] if guide_meta else None
        languages = guide_meta["languages"] if guide_meta else []
        for lang in languages:
            global_lang_set.add(lang)

        problems.append(
            {
                "number": number,
                "title": title,
                "slug": slug,
                "difficulty": difficulty,
                "topics": topics,
                "access": access,
                "category": category,
                "url": official_url,
                "guideStatus": guide_status,
                "guideFile": guide_file,
                "languages": languages,
            }
        )

    problems.sort(key=lambda p: p["number"])

    completed_count = sum(1 for p in problems if p["guideStatus"] == "available")
    premium_count = sum(1 for p in problems if p["access"] == "Premium")
    free_count = sum(1 for p in problems if p["access"] == "Free")

    all_topics = sorted(t for t in topic_set if t != "unknown")
    if "unknown" in topic_set:
        all_topics.append("unknown")

    catalog = {
        "meta": {
            "siteName": "Infinity DSA",
            "creatorCredit": "by InfinityDevLog",
            "subtitle": "LeetCode Solutions",
            "source": {
                "name": "noworneverev/leetcode-api",
                "repositoryUrl": "https://github.com/noworneverev/leetcode-api",
                "dataUrl": url,
                "license": "MIT",
                "upstreamCommit": upstream_sha,
                "upstreamDate": upstream_date,
                "checkedDate": date.today().isoformat(),
            },
            "totalProblems": len(problems),
            "completedGuides": completed_count,
            "pendingGuides": len(problems) - completed_count,
            "freeCount": free_count,
            "premiumCount": premium_count,
            "allTopics": all_topics,
            "allLanguages": ALL_LANGUAGES,
            "availableLanguages": [lang for lang in ALL_LANGUAGES if lang in global_lang_set],
        },
        "problems": problems,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GUIDES_DIR.mkdir(parents=True, exist_ok=True)
    with CATALOG_PATH.open("w", encoding="utf-8") as fh:
        json.dump(catalog, fh, ensure_ascii=False, separators=(",", ":"))

    return catalog


def main() -> None:
    parser = argparse.ArgumentParser(description="Import or refresh Infinity DSA problem catalog.")
    parser.add_argument("--local", help="Path to a local leetcode_questions_mini.json snapshot.")
    parser.add_argument("--url", default=DEFAULT_DATA_URL, help="Remote JSON dataset URL.")
    args = parser.parse_args()

    catalog = build_catalog(local_path=args.local, url=args.url)
    meta = catalog["meta"]
    print(
        f"Catalog generated: {meta['totalProblems']} problems "
        f"({meta['freeCount']} Free, {meta['premiumCount']} Premium), "
        f"{meta['completedGuides']} completed guides, "
        f"{meta['pendingGuides']} pending."
    )


if __name__ == "__main__":
    main()
