#!/usr/bin/env bash
# First fix: turn literal \n in ~/.secrets into real newlines so mise dotenv works.
set -euo pipefail
SECRETS="${1:-$HOME/.secrets}"
[ -f "$SECRETS" ] || { echo "missing $SECRETS"; exit 1; }
cp "$SECRETS" "${SECRETS}.bak.$(date +%s)"
python3 - "$SECRETS" <<'PY'
import sys, re
from pathlib import Path
p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8", errors="replace")
fixed = text.replace("\\n", "\n")
fixed = re.sub(r"([^\n])export ", r"\1\nexport ", fixed)
p.write_text(fixed)
print(f"wrote {p} (backup alongside)")
PY
