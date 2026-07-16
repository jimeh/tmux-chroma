#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

shell_presets="$(
  sed -n "s/^[[:space:]]*\([a-z][a-z]*\)) base='\(#[0-9a-fA-F]*\)' ;;/\1=\2/p" "$ROOT/chroma.tmux"
)"
if [ -z "$shell_presets" ]; then
  printf 'failed to extract plugin palette data\n' >&2
  exit 1
fi

site="$ROOT/docs/index.html"
site_presets="$(
  sed -n "s/^[[:space:]]*{ name: '\([a-z][a-z]*\)', base: '\(#[0-9a-fA-F]*\)' },/\1=\2/p" "$site"
)"

if [ -z "$site_presets" ]; then
  printf 'failed to extract palette data from %s\n' "$site" >&2
  exit 1
fi

if [ "$shell_presets" != "$site_presets" ]; then
  printf 'plugin and %s presets differ\n' "$site" >&2
  diff -u <(printf '%s\n' "$shell_presets") \
    <(printf '%s\n' "$site_presets") || :
  exit 1
fi

if ! sed -n "/mixColor(preset.base, '#15181d', 60)/p" \
  "$site" | read -r _; then
  printf '%s base_alt mix formula changed\n' "$site" >&2
  exit 1
fi

# The search pattern intentionally contains literal shell expressions.
# shellcheck disable=SC2016
if ! sed -n '/base_alt="$(mix_color "$base" "$bg" 60)"/p' \
  "$ROOT/chroma.tmux" | read -r _; then
  printf 'plugin base_alt mix formula changed\n' >&2
  exit 1
fi

printf 'palette sync: ok (%s presets)\n' \
  "$(printf '%s\n' "$shell_presets" | wc -l | tr -d ' ')"
