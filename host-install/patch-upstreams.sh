#!/usr/bin/env bash
# Patch mcpproxy/gatehouse upstream cwd/command to located ranch/tools paths. NO SYMLINKS.
set -euo pipefail
declare -A NEW=(
  [kitty-mcp-server]=/home/toxic/estate/ranch/kitty-mcp-server
  [wezterm-agent-mcp]=/home/toxic/estate/ranch/wezterm-agent-mcp
  [rsync-mcp]=/home/toxic/estate/ranch/rsync-mcp
  [tmux-mcp]=/home/toxic/estate/tools/tmux-mcp
  [desktop-commander]=/home/toxic/estate/vendored/desktop-commander
  [websearch-mcp]=/home/toxic/estate/tools/websearch-mcp
)
# lasso is in scratch rescue — do NOT point production at it; disable instead
DISABLE_NAMES=(lasso)

echo "=== find live mcp configs (not tau backups) ==="
mapfile -t CFGS < <(
  find /home/toxic/estate /home/toxic/.config /home/toxic/.mcpproxy /home/toxic \
    -maxdepth 4 \( -name 'mcp_config.json' -o -name 'mcp_proxy.json' -o -name 'mcpproxy*.json' -o -name 'servers.json' \) \
    2>/dev/null | grep -v '/backup-' | grep -v '/tau/backup' | head -40
)
# also pitchfork / gatehouse toml that may embed paths
mapfile -t TOMLS < <(
  find /home/toxic/estate -maxdepth 3 \( -name 'pitchfork.toml' -o -name 'mcpproxy.toml' -o -name 'gatehouse*.toml' \) 2>/dev/null | head -20
)
printf 'JSON:%s\n' "${CFGS[@]:-none}"
printf 'TOML:%s\n' "${TOMLS[@]:-none}"

# Prefer configs that mention broken names
LIVE=()
for f in "${CFGS[@]:-}"; do
  [ -f "$f" ] || continue
  if rg -q 'kitty-mcp|wezterm-agent|rsync-mcp|desktop-commander|tmux-mcp|lasso' "$f" 2>/dev/null; then
    LIVE+=("$f")
    echo "HIT $f"
  fi
done
if [ ${#LIVE[@]} -eq 0 ]; then
  echo "No JSON hit — searching broader for cwd strings..."
  rg -l 'kitty-mcp-server|wezterm-agent-mcp|/estate/tools/' /home/toxic/estate /home/toxic/.config -g '*.json' -g '*.toml' -g '*.yaml' 2>/dev/null | head -30 || true
  echo "STOP — paste this locate output; do not guess config path."
  exit 1
fi

TS=$(date +%s)
for f in "${LIVE[@]}"; do
  cp -a "$f" "${f}.bak.${TS}"
  echo "backup ${f}.bak.${TS}"
  python3 - "$f" <<'PY'
import json, sys, os, re
path = sys.argv[1]
NEW = {
  "kitty-mcp-server": "/home/toxic/estate/ranch/kitty-mcp-server",
  "wezterm-agent-mcp": "/home/toxic/estate/ranch/wezterm-agent-mcp",
  "rsync-mcp": "/home/toxic/estate/ranch/rsync-mcp",
  "tmux-mcp": "/home/toxic/estate/tools/tmux-mcp",
  "desktop-commander": "/home/toxic/estate/vendored/desktop-commander",
  "websearch-mcp": "/home/toxic/estate/tools/websearch-mcp",
}
DISABLE = {"lasso"}
with open(path) as fh:
    data = json.load(fh)

def walk(obj, parent=None, key=None):
    changes = []
    if isinstance(obj, dict):
        name = str(obj.get("name") or obj.get("id") or key or "")
        for nk, nd in NEW.items():
            if nk in name or nk in json.dumps(obj):
                for field in ("cwd", "workingDirectory", "dir", "path", "argsCwd"):
                    if field in obj and isinstance(obj[field], str) and obj[field] != nd:
                        changes.append((name or nk, field, obj[field], nd))
                        obj[field] = nd
                # command arrays that embed old path
                for field in ("command", "args", "cmd"):
                    v = obj.get(field)
                    if isinstance(v, list):
                        for i, part in enumerate(v):
                            if isinstance(part, str):
                                for nk2, nd2 in NEW.items():
                                    if nk2 in part and nd2 not in part:
                                        nv = re.sub(r"/home/toxic/[^\s\"]*%s[^\s\"]*" % re.escape(nk2), nd2, part)
                                        if nv != part:
                                            changes.append((name or nk2, f"{field}[{i}]", part, nv))
                                            v[i] = nv
                if any(d in name.lower() for d in DISABLE) or name.lower() in DISABLE:
                    if obj.get("enabled", True) is not False:
                        changes.append((name, "enabled", obj.get("enabled", True), False))
                        obj["enabled"] = False
                    if "disabled" in obj and obj["disabled"] is not True:
                        changes.append((name, "disabled", obj["disabled"], True))
                        obj["disabled"] = True
        for k, v in list(obj.items()):
            changes += walk(v, obj, k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            changes += walk(v, obj, str(i))
    return changes

ch = walk(data)
with open(path, "w") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")
for c in ch:
    print("PATCH", path, "→", c)
print("TOTAL", len(ch), "changes in", path)
PY
done

echo "=== restart gatehouse / mcpproxy if pitchfork knows them ==="
for d in gatehouse mcpproxy mcp-proxy mesh; do
  pitchfork restart "$d" 2>/dev/null || pitchfork start "$d" 2>/dev/null || true
done
echo "=== done — paste output ==="
