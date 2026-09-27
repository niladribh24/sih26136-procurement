"""PreToolUse guard: inside this repo, Claude may only write to backend/ and frontend/ (plus the
root CLAUDE.md), never backend/.env. nlp/ and everything else in the repo stay blocked. Paths
outside the repo (~/.claude plans, memory) are allowed."""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WRITABLE_DIRS = (ROOT / "backend", ROOT / "frontend")


def norm(p: Path) -> str:
    return os.path.normcase(str(p.resolve()))


data = json.load(sys.stdin)
tool_input = data.get("tool_input") or {}
raw = tool_input.get("file_path") or tool_input.get("notebook_path")
if not raw:
    sys.exit(0)

target = Path(raw)
if not target.is_absolute():
    target = Path(data.get("cwd") or ROOT) / target
t = norm(target)  # resolve() collapses ../ tricks like backend/../nlp/x

if not t.startswith(norm(ROOT) + os.sep):
    sys.exit(0)  # outside the repo: not ours to police
if t == norm(ROOT / "backend" / ".env"):
    print(f"Blocked: {raw} holds real secrets and must not be edited by Claude. Edit it by hand.", file=sys.stderr)
    sys.exit(2)
if t == norm(ROOT / "CLAUDE.md") or any(t.startswith(norm(d) + os.sep) for d in WRITABLE_DIRS):
    sys.exit(0)

print(
    f"Blocked: {raw} is outside backend/ and frontend/. Per CLAUDE.md, Claude only writes to "
    "backend/ and frontend/ (and the root CLAUDE.md). nlp/ belongs to another owner - ask the user first.",
    file=sys.stderr,
)
sys.exit(2)
