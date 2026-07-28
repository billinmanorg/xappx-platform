#!/usr/bin/env python3
"""Brand compliance check.

The style guide makes one rule non-negotiable: the company name is XAPPX, and
the retired names must not appear anywhere - copy, metadata, filenames, image
labels, code comments or URLs. Retired names leak back in through seed data and
comments long after the marketing site is clean, so this runs in CI.

Also warns on claims the style guide prohibits.
"""
import os, re, sys

ROOT = "."
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "__pycache__"}

# XAPPX contains "APPX", never "APX" - so \bAPX\b cannot match inside the brand.
# The banned list is exactly what the style guide names. "Zap" singular is NOT
# banned - only the plural ZAPS and the ZAPX/APX forms. Do not widen these
# patterns past what the guide actually prohibits.
BANNED = [
    (re.compile(r"\bZAPS\b", re.I),       "retired name (ZAPS) - the company name is XAPPX"),
    (re.compile(r"\bZAPX\b", re.I),       "retired name (ZAPX) - the company name is XAPPX"),
    (re.compile(r"\bZAPS?[ _-]?APX\b", re.I), "retired name (ZAPS APX) - the company name is XAPPX"),
    (re.compile(r"\bAPX\b"),              "standalone APX is not a brand name; write XAPPX"),
    (re.compile(r"\bWTAF\b", re.I),       "retired working name - the company name is XAPPX"),
]

# Style guide section 2 and 6. These are warnings: they are wrong in
# customer-facing copy but may be legitimate in internal engineering prose.
DISCOURAGED = [
    (re.compile(r"vibe cod\w*", re.I),
     'not a public-facing term - use "AI-native development" or "generative app development"'),
    (re.compile(r"no[- ]code required", re.I),
     'prohibited claim unless a verified self-service builder ships'),
    (re.compile(r"\bcentrali[sz]ed (data )?vault\b", re.I),
     'the XAPPX vault is decentralized - do not describe it as centralized'),
    (re.compile(r"guaranteed (revenue|cost savings|savings)", re.I),
     "unsupported claim"),
    (re.compile(r"\b(perfect security|instant deployment)\b", re.I),
     "unsupported claim"),
    (re.compile(r"replace (your |their )?(staff|employees|workers|team)", re.I),
     "fear-based replacement language - XAPPX frees people from low-value repetition"),
]

# This file necessarily contains the retired names in its own patterns, and the
# brand documentation has to state the rule it enforces. Both are exempt: this
# file by path, and any line carrying the marker below.
SELF = os.path.normpath("tools/check_brand_terms.py")
ALLOW_MARKER = "brand-check" + ":allow"

errors, warnings = [], []

for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        path = os.path.join(dirpath, fn)
        if os.path.normpath(path) == SELF:
            continue

        # filenames and paths count too
        for pat, why in BANNED:
            if pat.search(fn):
                errors.append(f"{path}: filename contains {why}")

        if os.path.splitext(fn)[1] in {".png", ".jpg", ".jpeg", ".gif", ".zip", ".pdf", ".ico", ".woff", ".woff2"}:
            continue
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue

        for i, line in enumerate(text.splitlines(), 1):
            if ALLOW_MARKER in line:
                continue
            for pat, why in BANNED:
                m = pat.search(line)
                if m:
                    errors.append(f"{path}:{i}: '{m.group(0)}' - {why}")
            for pat, why in DISCOURAGED:
                m = pat.search(line)
                if m:
                    warnings.append(f"{path}:{i}: '{m.group(0)}' - {why}")

for wmsg in warnings:
    print(f"::warning::{wmsg}")
for e in errors:
    print(f"::error::{e}")

print(f"\nbrand check: {len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
