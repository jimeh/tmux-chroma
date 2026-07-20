#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-dist}"

if [[ "$OUTPUT_DIR" != /* ]]; then
  OUTPUT_DIR="$ROOT/$OUTPUT_DIR"
fi

version_output="$("$ROOT/chroma.tmux" --version)"
version="${version_output#chroma }"
if [[ "$version" == "$version_output" ||
  ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  printf 'unexpected Chroma version: %s\n' "$version_output" >&2
  exit 1
fi

package="tmux-chroma-$version"
archive="$OUTPUT_DIR/$package.zip"
work="$(mktemp -d)"

cleanup() {
  rm -rf "$work"
}
trap cleanup EXIT INT TERM

mkdir -p "$work/$package/scripts"
cp "$ROOT/chroma.tmux" "$work/$package/chroma.tmux"
cp "$ROOT/scripts/cpu" "$work/$package/scripts/cpu"
cp "$ROOT/scripts/disk" "$work/$package/scripts/disk"
cp "$ROOT/scripts/memory" "$work/$package/scripts/memory"
cp "$ROOT/README.md" "$work/$package/README.md"
cp "$ROOT/LICENSE" "$work/$package/LICENSE"
cp "$ROOT/CHANGELOG.md" "$work/$package/CHANGELOG.md"

chmod 755 \
  "$work/$package/chroma.tmux" \
  "$work/$package/scripts/cpu" \
  "$work/$package/scripts/disk" \
  "$work/$package/scripts/memory"
chmod 644 \
  "$work/$package/README.md" \
  "$work/$package/LICENSE" \
  "$work/$package/CHANGELOG.md"

# ZIP timestamps cannot predate 1980. Fix every entry to the earliest portable
# timestamp so identical source content produces an identical archive.
TZ=UTC0 touch -t 198001010000 \
  "$work/$package" \
  "$work/$package/scripts" \
  "$work/$package/chroma.tmux" \
  "$work/$package/scripts/cpu" \
  "$work/$package/scripts/disk" \
  "$work/$package/scripts/memory" \
  "$work/$package/README.md" \
  "$work/$package/LICENSE" \
  "$work/$package/CHANGELOG.md"

mkdir -p "$OUTPUT_DIR"
(
  cd "$work"
  ouch compress --quiet --yes "$package" "$package.zip"
)
mv -f "$work/$package.zip" "$archive"

printf '%s\n' "$archive"
