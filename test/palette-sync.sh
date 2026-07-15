#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

shell_presets="$(
  sed -n "s/^[[:space:]]*\([a-z][a-z]*\)) base='\(#[0-9a-fA-F]*\)' ;;/\1=\2/p" "$ROOT/chroma.tmux"
)"
site_presets="$(
  sed -n "s/^[[:space:]]*{ name: '\([a-z][a-z]*\)', base: '\(#[0-9a-fA-F]*\)' },/\1=\2/p" "$ROOT/docs/index.html"
)"

if [ -z "$shell_presets" ] || [ -z "$site_presets" ]; then
  printf 'failed to extract palette data\n' >&2
  exit 1
fi

if [ "$shell_presets" != "$site_presets" ]; then
  printf 'plugin and website presets differ\n' >&2
  diff -u <(printf '%s\n' "$shell_presets") \
    <(printf '%s\n' "$site_presets") || :
  exit 1
fi

# The search pattern intentionally contains literal shell expressions.
# shellcheck disable=SC2016
if ! sed -n '/base_alt="$(mix_color "$base" "$bg" 60)"/p' \
  "$ROOT/chroma.tmux" | read -r _; then
  printf 'plugin base_alt mix formula changed\n' >&2
  exit 1
fi

if ! sed -n "/mixColor(preset.base, '#15181d', 60)/p" \
  "$ROOT/docs/index.html" | read -r _; then
  printf 'website base_alt mix formula changed\n' >&2
  exit 1
fi

printf 'palette sync: ok (%s presets)\n' \
  "$(printf '%s\n' "$shell_presets" | wc -l | tr -d ' ')"
