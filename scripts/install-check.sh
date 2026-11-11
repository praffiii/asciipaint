#!/usr/bin/env bash
# Packs the library, then type-checks fixtures/install against the tarball with each package manager.
# Run `vp pack` first (release:check does): the tarball ships dist/.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
[[ -d $root/dist ]] || { echo "dist/ is missing: run vp pack first" >&2; exit 1; }
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

bun pm pack --cwd "$root" --destination "$work" --quiet >/dev/null
tarball="$(echo "$work"/asciipaint-*.tgz)"
deps=(three @types/three typescript)
ran=()
failed=()

# Each consumer installs with its own package manager, then type-checks with the tsc it installed.
check() {
  local name=$1 dir=$work/$1
  shift
  echo "== $name"
  cp -R "$root/fixtures/install" "$dir"
  if (cd "$dir" && "$@"); then ran+=("$name"); else failed+=("$name"); fi
}

npm_run() { npm install --no-audit --no-fund --silent "$tarball" "${deps[@]}" && ./node_modules/.bin/tsc --noEmit; }
pnpm_run() { pnpm add --silent "$tarball" "${deps[@]}" && ./node_modules/.bin/tsc --noEmit; }
yarn_run() { npx -y yarn@1 add --silent "$tarball" "${deps[@]}" && ./node_modules/.bin/tsc --noEmit; }
bun_run() { bun add --silent "$tarball" "${deps[@]}" && ./node_modules/.bin/tsc --noEmit; }

check npm npm_run
check pnpm pnpm_run
check yarn yarn_run
check bun bun_run

echo "ran: ${ran[*]:-none}"
if ((${#failed[@]})); then echo "FAILED: ${failed[*]}" >&2; exit 1; fi
