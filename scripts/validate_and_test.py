#!/usr/bin/env python3
"""
Catalog integrity validator and multi-runtime code verification suite for Infinity DSA.

Checks:
1. Duplicate problem numbers or slugs in data/catalog.json.
2. Broken internal guideFile references or orphaned guide files.
3. Required guide structure, recommended approach flag, and consistency between
   Example 1, dry-run steps, diagrams, and catalog metadata.
4. Executes every approach's implementations across all available local runtimes:
   - Python3, Python (python)
   - JavaScript, TypeScript (node / node --experimental-strip-types)
   - Java (javac + java)
   - PHP (C:\\xampp\\php\\php.exe or php)
   - C# (C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe or csc)
5. Explicitly reports which of the 19 requested languages could not be tested locally.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
GUIDES_DIR = DATA_DIR / "guides"
CATALOG_PATH = DATA_DIR / "catalog.json"

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


def find_runtime(candidates: list[str]) -> str | None:
    """Return the first executable path found in PATH or explicit candidate paths."""
    for cand in candidates:
        if os.path.isabs(cand) and os.path.exists(cand):
            return cand
        resolved = shutil.which(cand)
        if resolved:
            return resolved
    return None


RUNTIMES = {
    "Python3": find_runtime(["python", "python3"]),
    "Python": find_runtime(["python", "python3"]),
    "JavaScript": find_runtime(["node"]),
    "TypeScript": find_runtime(["node"]),
    "Java": find_runtime(["javac"]),
    "PHP": find_runtime(["php", r"C:\xampp\php\php.exe"]),
    "C#": find_runtime(["csc", r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"]),
}


def validate_catalog_and_guides() -> tuple[list[str], list[dict]]:
    """Validate catalog.json and all guide JSON files; return (errors, loaded_guides)."""
    errors: list[str] = []
    loaded_guides: list[dict] = []

    if not CATALOG_PATH.exists():
        return [f"Missing catalog file: {CATALOG_PATH}"], []

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    problems = catalog.get("problems", [])
    if not problems:
        errors.append("Catalog contains 0 problems.")
        return errors, []

    seen_nums: set[int] = set()
    seen_slugs: set[str] = set()
    referenced_files: set[Path] = set()

    for idx, p in enumerate(problems):
        num = p.get("number")
        slug = p.get("slug")
        if num in seen_nums:
            errors.append(f"Duplicate problem number in catalog: {num}")
        seen_nums.add(num)

        if slug and slug != "unknown":
            if slug in seen_slugs:
                errors.append(f"Duplicate slug in catalog: {slug}")
            seen_slugs.add(slug)

        for req_field in ("number", "title", "slug", "difficulty", "topics", "access", "url", "guideStatus"):
            if req_field not in p or p[req_field] in (None, ""):
                errors.append(f"Problem #{num} (row {idx}) missing required field '{req_field}'.")

        if p.get("guideStatus") == "available":
            gfile = p.get("guideFile")
            if not gfile:
                errors.append(f"Problem #{num} marked available but guideFile is empty.")
                continue
            full_gfile = (ROOT_DIR / gfile).resolve()
            if not full_gfile.exists():
                errors.append(f"Broken guideFile link for #{num}: {gfile}")
                continue
            referenced_files.add(full_gfile)

            guide = json.loads(full_gfile.read_text(encoding="utf-8"))
            loaded_guides.append(guide)

            # Cross-check metadata alignment
            if guide.get("number") != num:
                errors.append(f"Guide {gfile} number {guide.get('number')} != catalog {num}")
            if guide.get("slug") != slug:
                errors.append(f"Guide {gfile} slug {guide.get('slug')} != catalog {slug}")

            # Check pedagogical sections
            u = guide.get("understand", {})
            for key in ("question", "plainExplanation", "inputMeaning", "outputMeaning", "rules", "terms", "example1", "example2"):
                if not u.get(key):
                    errors.append(f"Guide #{num}: understand.{key} is missing or empty.")

            ex1 = u.get("example1", {})
            if not ex1.get("diagram"):
                errors.append(f"Guide #{num}: example1.diagram is missing.")

            dr = guide.get("dryRun", {})
            steps = dr.get("steps", [])
            if len(steps) < 2:
                errors.append(f"Guide #{num}: dryRun.steps must have at least 2 steps.")
            for s_idx, step in enumerate(steps):
                if not step.get("title") or not step.get("description") or not step.get("state"):
                    errors.append(f"Guide #{num}: dryRun step {s_idx} missing title/description/state.")

            approaches = guide.get("approaches", [])
            if not approaches:
                errors.append(f"Guide #{num}: must have at least 1 approach.")
            rec_count = sum(1 for a in approaches if a.get("recommended") is True)
            if rec_count != 1:
                errors.append(f"Guide #{num}: expected exactly 1 recommended approach, found {rec_count}.")

            guide_langs: set[str] = set()
            for ap in approaches:
                ap_id = ap.get("id", "?")
                for req_ap in ("id", "name", "coreIdea", "steps", "whyItWorks", "whenToUse", "complexity", "code"):
                    if not ap.get(req_ap):
                        errors.append(f"Guide #{num} approach '{ap_id}': missing '{req_ap}'.")
                comp = ap.get("complexity", {})
                for ck in ("time", "space", "variables", "boundType"):
                    if not comp.get(ck):
                        errors.append(f"Guide #{num} approach '{ap_id}': missing complexity.{ck}.")
                code_map = ap.get("code", {})
                for lang in code_map:
                    if lang not in ALL_LANGUAGES:
                        errors.append(f"Guide #{num} approach '{ap_id}': unsupported language key '{lang}'.")
                    elif str(code_map[lang]).strip():
                        guide_langs.add(lang)

            expected_langs = [l for l in ALL_LANGUAGES if l in guide_langs]
            if p.get("languages") != expected_langs:
                errors.append(
                    f"Catalog language coverage mismatch for #{num}: catalog={p.get('languages')} vs actual={expected_langs}. Re-run import_catalog.py."
                )

            if not guide.get("tests"):
                errors.append(f"Guide #{num}: missing tests array for verification.")

    if GUIDES_DIR.exists():
        for existing_file in GUIDES_DIR.glob("*.json"):
            if existing_file.resolve() not in referenced_files:
                errors.append(f"Orphaned/unlinked guide file: {existing_file.name}")

    return errors, loaded_guides


def run_js_or_ts(code: str, guide: dict, is_ts: bool, tmpdir: Path) -> tuple[bool, str]:
    """Execute JavaScript or TypeScript implementation against guide tests via Node."""
    fn_name = guide.get("jsFunctionName")
    if not fn_name:
        return False, "missing jsFunctionName"
    tests_json = json.dumps(guide["tests"])
    ext = "mts" if is_ts else "mjs"
    harness = f"""{code}

const __tests = {tests_json};
const __normalize = (v, unordered) => {{
  if (unordered && Array.isArray(v)) return JSON.stringify([...v].sort((a, b) => a - b));
  return JSON.stringify(v);
}};
for (const t of __tests) {{
  const args = JSON.parse(JSON.stringify(t.args));
  let actual;
  if (typeof __customInvoke === 'function') {{
    actual = __customInvoke({fn_name}, args, t);
  }} else {{
    actual = {fn_name}(...args);
  }}
  if (__normalize(actual, t.unorderedArray) !== __normalize(t.expected, t.unorderedArray)) {{
    console.error("FAIL", t.name, "got", actual, "expected", t.expected);
    process.exit(1);
  }}
}}
"""
    # For linked list tests (like #2 Add Two Numbers), inject ListNode helpers when needed
    if guide.get("runtimeHelpers") == "linked_list":
        harness = f"""class ListNode {{
  constructor(val = 0, next = null) {{ this.val = val; this.next = next; }}
}}
function __toList(arr) {{
  const dummy = new ListNode(0); let cur = dummy;
  for (const x of arr) {{ cur.next = new ListNode(x); cur = cur.next; }}
  return dummy.next;
}}
function __fromList(node) {{
  const out = []; while (node) {{ out.push(node.val); node = node.next; }}
  return out;
}}
function __customInvoke(fn, args) {{
  return __fromList(fn(...args.map(__toList)));
}}
""" + harness

    target = tmpdir / f"test.{ext}"
    target.write_text(harness, encoding="utf-8")
    cmd = [RUNTIMES["JavaScript"]]
    if is_ts:
        cmd.append("--experimental-strip-types")
    cmd.append(str(target))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if proc.returncode != 0:
        return False, (proc.stderr or proc.stdout).strip()
    return True, f"{len(guide['tests'])}/{len(guide['tests'])} passed"


def run_python(code: str, guide: dict, tmpdir: Path) -> tuple[bool, str]:
    """Execute Python3 or Python implementation against guide tests."""
    method = guide.get("pyMethodName")
    if not method:
        return False, "missing pyMethodName"
    tests_json = json.dumps(guide["tests"])
    preamble = ""
    invoke_block = f"actual = getattr(sol, '{method}')(*args)"

    if guide.get("runtimeHelpers") == "linked_list":
        preamble = """class ListNode(object):
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def __to_list(arr):
    dummy = ListNode(0)
    cur = dummy
    for x in arr:
        cur.next = ListNode(x)
        cur = cur.next
    return dummy.next

def __from_list(node):
    out = []
    while node is not None:
        out.append(node.val)
        node = node.next
    return out
"""
        invoke_block = f"actual = __from_list(getattr(sol, '{method}')(*[__to_list(a) for a in args]))"

    script = f"""from typing import List, Optional, Dict, Tuple
import copy, json

{preamble}
{code}

tests = json.loads({tests_json!r})
sol = Solution()
for t in tests:
    args = copy.deepcopy(t["args"])
    {invoke_block}
    exp = t["expected"]
    if t.get("unorderedArray") and isinstance(actual, list):
        ok = sorted(actual) == sorted(exp)
    else:
        ok = actual == exp
    if not ok:
        raise AssertionError(f"FAIL {{t['name']}}: got {{actual!r}}, expected {{exp!r}}")
"""
    target = tmpdir / "test_sol.py"
    target.write_text(script, encoding="utf-8")
    proc = subprocess.run([RUNTIMES["Python3"], str(target)], capture_output=True, text=True, timeout=15)
    if proc.returncode != 0:
        return False, (proc.stderr or proc.stdout).strip()
    return True, f"{len(guide['tests'])}/{len(guide['tests'])} passed"


def run_java(code: str, guide: dict, tmpdir: Path) -> tuple[bool, str]:
    """Compile and run Java Solution against per-guide Java test driver."""
    driver = guide.get("javaDriver")
    if not driver:
        return False, "missing javaDriver"
    jdir = tmpdir / "java_run"
    jdir.mkdir(parents=True, exist_ok=True)
    sol_file = jdir / "Solution.java"
    main_file = jdir / "Main.java"
    sol_file.write_text(code, encoding="utf-8")
    main_file.write_text(driver, encoding="utf-8")

    comp = subprocess.run(["javac", str(sol_file), str(main_file)], capture_output=True, text=True, timeout=20)
    if comp.returncode != 0:
        return False, (comp.stderr or comp.stdout).strip()
    run = subprocess.run(["java", "-cp", str(jdir), "Main"], capture_output=True, text=True, timeout=15)
    if run.returncode != 0:
        return False, (run.stderr or run.stdout).strip()
    return True, f"{len(guide['tests'])}/{len(guide['tests'])} passed"


def run_php(code: str, guide: dict, tmpdir: Path) -> tuple[bool, str]:
    """Execute PHP Solution against per-guide PHP test driver."""
    driver = guide.get("phpDriver")
    if not driver:
        return False, "missing phpDriver"
    clean_code = code.strip()
    if clean_code.startswith("<?php"):
        clean_code = clean_code[5:]
    php_file = tmpdir / "test_sol.php"
    php_file.write_text(f"<?php\n{clean_code}\n{driver}\n", encoding="utf-8")
    proc = subprocess.run([RUNTIMES["PHP"], str(php_file)], capture_output=True, text=True, timeout=15)
    if proc.returncode != 0:
        return False, (proc.stderr or proc.stdout).strip()
    return True, f"{len(guide['tests'])}/{len(guide['tests'])} passed"


def run_csharp(code: str, guide: dict, tmpdir: Path) -> tuple[bool, str]:
    """Compile and run C# Solution using csc.exe against per-guide C# driver."""
    driver = guide.get("csharpDriver")
    if not driver:
        return False, "missing csharpDriver"
    sol_file = tmpdir / "Solution.cs"
    drv_file = tmpdir / "Runner.cs"
    exe_file = tmpdir / "TestSol.exe"
    sol_file.write_text(code + "\n", encoding="utf-8")
    drv_file.write_text(driver + "\n", encoding="utf-8")
    comp = subprocess.run(
        [RUNTIMES["C#"], "/nologo", f"/out:{exe_file}", str(sol_file), str(drv_file)],
        capture_output=True,
        text=True,
        timeout=20,
    )
    if comp.returncode != 0:
        return False, (comp.stdout or comp.stderr).strip()
    run = subprocess.run([str(exe_file)], capture_output=True, text=True, timeout=15)
    if run.returncode != 0:
        return False, (run.stderr or run.stdout).strip()
    return True, f"{len(guide['tests'])}/{len(guide['tests'])} passed"


def main() -> int:
    errors, guides = validate_catalog_and_guides()
    if errors:
        print("VALIDATION ERRORS:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"Catalog & schema validation passed ({len(guides)} complete guide(s)).")

    available_runtimes = [lang for lang, path in RUNTIMES.items() if path]
    unavailable_runtimes = [lang for lang in ALL_LANGUAGES if lang not in RUNTIMES or not RUNTIMES[lang]]
    print("Available local runtimes:", ", ".join(available_runtimes))
    print("Unavailable local runtimes (cannot be tested locally):", ", ".join(unavailable_runtimes))

    failures: list[str] = []
    total_executions = 0

    with tempfile.TemporaryDirectory(prefix="inf_dsa_verify_") as tmp:
        tmpdir = Path(tmp)
        for guide in guides:
            num = guide["number"]
            title = guide["title"]
            print(f"\nVerifying #{num} {title}:")
            for ap in guide["approaches"]:
                ap_id = ap["id"]
                code_map = ap["code"]
                ap_results: list[str] = []
                for lang in ALL_LANGUAGES:
                    if lang not in code_map:
                        continue
                    code = code_map[lang]
                    if lang not in RUNTIMES or not RUNTIMES[lang]:
                        ap_results.append(f"{lang}: UNTESTED(no runtime)")
                        continue
                    total_executions += 1
                    sub = tmpdir / f"{num}_{ap_id}_{lang.replace('#', 'sharp').replace('+', 'p')}"
                    sub.mkdir(parents=True, exist_ok=True)
                    if lang == "JavaScript":
                        ok, msg = run_js_or_ts(code, guide, False, sub)
                    elif lang == "TypeScript":
                        ok, msg = run_js_or_ts(code, guide, True, sub)
                    elif lang in ("Python3", "Python"):
                        ok, msg = run_python(code, guide, sub)
                    elif lang == "Java":
                        ok, msg = run_java(code, guide, sub)
                    elif lang == "PHP":
                        ok, msg = run_php(code, guide, sub)
                    elif lang == "C#":
                        ok, msg = run_csharp(code, guide, sub)
                    else:
                        ok, msg = True, "skipped"

                    if ok:
                        ap_results.append(f"{lang}: PASS")
                    else:
                        ap_results.append(f"{lang}: FAIL({msg})")
                        failures.append(f"#{num} [{ap_id}] {lang}: {msg}")
                print(f"  - {ap['name']}: " + " | ".join(ap_results))

    print(f"\nTotal runtime verifications executed: {total_executions}")
    if failures:
        print("RUNTIME FAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("All tested implementations passed 100% of test cases!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
