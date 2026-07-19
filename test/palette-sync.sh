#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
first="$(mktemp)"
second="$(mktemp)"
stderr="$(mktemp)"
trap 'rm -f "$first" "$second" "$stderr"' EXIT

"$ROOT/chroma.tmux" --dump-colors > "$first" 2> "$stderr"
"$ROOT/chroma.tmux" --dump-colors > "$second" 2>> "$stderr"
if [ -s "$stderr" ]; then
  printf '%s --dump-colors wrote to stderr:\n' "$ROOT/chroma.tmux" >&2
  sed 's/^/  /' "$stderr" >&2
  exit 1
fi
cmp "$first" "$second"

schema_summary="$(
  # shellcheck disable=SC2016 # JavaScript template literal, not shell syntax.
  bun -e '
const data = JSON.parse(await Bun.file(process.argv[1]).text());
if (data.schemaVersion !== 1) throw new Error("unexpected schema version");
if (data.presets.length !== 22) throw new Error("unexpected preset count");
if (!data.modes.dark || !data.modes.light) throw new Error("missing modes");
if (!data.resolution?.luma || !data.resolution?.surfaceMix ||
    !data.resolution?.textMix) throw new Error("missing constants");
console.log(`${data.presets.length} presets, both modes`);
' "$first"
)"

if "$ROOT/chroma.tmux" --resolve-colors --preset missing \
  > /dev/null 2>&1; then
  printf 'invalid resolve query unexpectedly succeeded\n' >&2
  exit 1
fi

(
  cd "$ROOT/website"
  bun run generate
)
bun "$ROOT/test/palette-parity.ts"

printf 'palette sync: ok (%s)\n' "$schema_summary"
