"""Stop hook: if backend .py/.sql files have uncommitted changes, run pytest; block stopping on failure."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

data = json.load(sys.stdin)
# Already continuing because of this hook once: don't block again, or a test Claude
# can't fix would loop forever.
if data.get("stop_hook_active"):
    sys.exit(0)

# -uall lists files inside new (untracked) folders instead of just the folder name.
status = subprocess.run(
    ["git", "status", "--porcelain", "-uall", "--", "backend"],
    cwd=ROOT, capture_output=True, text=True,
).stdout
if not any(line.strip().strip('"').endswith((".py", ".sql")) for line in status.splitlines()):
    sys.exit(0)

result = subprocess.run(
    [sys.executable, "-m", "pytest", "-q", "-x"],
    cwd=ROOT / "backend", capture_output=True, text=True,
)
if result.returncode == 0:
    sys.exit(0)

tail = "\n".join((result.stdout + result.stderr).strip().splitlines()[-40:])
print(f"backend tests fail (pytest -q -x in backend/). Fix before finishing:\n\n{tail}", file=sys.stderr)
sys.exit(2)
