#!/usr/bin/env bash
# Sets up everything tiny-llm studio needs inside Ubuntu (WSL), exactly as pinned in this repo.
# Safe to run again: each step checks first and skips what is already done.
#
# Expects ~/tiny-llm (the course) and ~/tiny-llm-studio (this repo) to exist already;
# "Setup tiny-llm studio.cmd" on Windows clones them before calling this.
set -euo pipefail

STUDIO="$HOME/tiny-llm-studio"
COURSE="$HOME/tiny-llm"

# Pinned tools. Each download is checked against the SHA256 below before it is used.
UV_VERSION=0.13.7
UV_SHA256=c5221ff41b7892bfc223543883600125f6a47fe845093e0f5bdff4f359196d83
NODE_VERSION=22.23.4
NODE_SHA256=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce
PYTHON_VERSION=3.12.16
CLAUDE_CODE_VERSION=2.1.319

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }

[ -d "$COURSE/.git" ] || { echo "Missing $COURSE. Run 'Setup tiny-llm studio.cmd' on Windows."; exit 1; }
[ -f "$STUDIO/package.json" ] || { echo "Missing $STUDIO. Run 'Setup tiny-llm studio.cmd' on Windows."; exit 1; }

mkdir -p "$HOME/.local/bin" "$HOME/.tiny-llm-studio"
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"

download() { # url sha256 dest
  curl -fsSL --proto '=https' --tlsv1.2 -o "$3" "$1"
  echo "$2  $3" | sha256sum -c --quiet - || { echo "Checksum mismatch for $1, stopping."; rm -f "$3"; exit 1; }
}

step "1/8 System packages (compiler, cmake, git)"
need=()
for p in build-essential cmake git curl ca-certificates xz-utils; do
  dpkg -s "$p" >/dev/null 2>&1 || need+=("$p")
done
if [ ${#need[@]} -gt 0 ]; then
  echo "    Installing ${need[*]} (Ubuntu will ask for your Linux password)"
  sudo apt-get update -q
  sudo apt-get install -y -q "${need[@]}"
fi
ok "build-essential, cmake, git"

step "2/8 uv $UV_VERSION (Python installer)"
if [ "$(uv --version 2>/dev/null | awk '{print $2}')" != "$UV_VERSION" ] || [ ! -x "$HOME/.local/bin/uv" ]; then
  tmp=$(mktemp -d)
  download "https://github.com/astral-sh/uv/releases/download/$UV_VERSION/uv-x86_64-unknown-linux-gnu.tar.gz" "$UV_SHA256" "$tmp/uv.tgz"
  tar -xzf "$tmp/uv.tgz" -C "$tmp"
  install -m 755 "$tmp"/uv-x86_64-unknown-linux-gnu/uv "$tmp"/uv-x86_64-unknown-linux-gnu/uvx "$HOME/.local/bin/"
  rm -rf "$tmp"
fi
ok "$(uv --version)"

step "3/8 Node.js $NODE_VERSION"
if [ "$("$HOME/.local/node/bin/node" --version 2>/dev/null)" != "v$NODE_VERSION" ]; then
  tmp=$(mktemp -d)
  download "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" "$NODE_SHA256" "$tmp/node.txz"
  rm -rf "$HOME/.local/node" && mkdir -p "$HOME/.local/node"
  tar -xJf "$tmp/node.txz" -C "$HOME/.local/node" --strip-components=1
  rm -rf "$tmp"
fi
grep -qF 'export PATH=$HOME/.local/node/bin:$HOME/.local/bin:$PATH' "$HOME/.profile" 2>/dev/null \
  || echo 'export PATH=$HOME/.local/node/bin:$HOME/.local/bin:$PATH' >> "$HOME/.profile"
ok "node $(node --version)"

step "4/8 Python $PYTHON_VERSION and the course packages (hash-pinned)"
cd "$COURSE"
uv python install "$PYTHON_VERSION"
if [ ! -x .venv/bin/python ] || [ "$(.venv/bin/python -c 'import platform; print(platform.python_version())' 2>/dev/null)" != "$PYTHON_VERSION" ]; then
  uv venv --python "$PYTHON_VERSION" .venv
fi
# Every package must match a hash in the lock file, or nothing is installed.
uv pip sync --require-hashes --python .venv/bin/python "$STUDIO/python-requirements.lock.txt"
.venv/bin/python -c 'import mlx.core, torch' && ok "mlx and torch import"

step "5/8 Course extension (C++)"
if ! ls src/extensions/tiny_llm_ext/_ext*.so >/dev/null 2>&1; then
  (cd src/extensions && ../../.venv/bin/python build.py)
fi
ok "src/extensions built"

step "6/8 Tutor skill and local git settings"
mkdir -p .claude/skills
rm -rf .claude/skills/tiny-llm-tutor
cp -r "$STUDIO/tutor-skill/tiny-llm-tutor" .claude/skills/
for line in '.claude/' '.venv-unpinned-backup/'; do
  grep -qxF "$line" .git/info/exclude || echo "$line" >> .git/info/exclude
done
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/skyzh/tiny-llm.git
ok "tiny-llm-tutor skill installed, upstream = skyzh/tiny-llm"

step "7/8 Claude Code $CLAUDE_CODE_VERSION (the tutor)"
if [ ! -x "$HOME/.local/node/bin/claude" ]; then
  # Anthropic's own package; its install step only copies the Linux binary into place.
  npm install -g --ignore-scripts=false "@anthropic-ai/claude-code@$CLAUDE_CODE_VERSION"
fi
ok "$("$HOME/.local/node/bin/claude" --version)"

step "8/8 Studio app (exact versions from package-lock.json, no install scripts)"
cd "$STUDIO"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci
fi
npx --no-install next telemetry disable >/dev/null
npm run build
ok "app built"

printf '\n\033[1;32mUbuntu side is ready.\033[0m\n'
if ! "$HOME/.local/node/bin/claude" auth status 2>/dev/null | grep -q '"loggedIn": *true'; then
  echo "One thing left for the tutor: sign in to Claude once (the studio's Setup page shows how)."
fi
