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

# The site ports POSIX cksum so its hostname preview picks the same
# preset as seeded_preset in chroma.tmux. Run the extracted JS
# implementation against the system cksum the plugin actually calls.
js_cksum="$(sed -n '/^    function cksum(text) {$/,/^    }$/p' "$site")"
if [ -z "$js_cksum" ]; then
  printf 'failed to extract the cksum port from %s\n' "$site" >&2
  exit 1
fi

sample_hosts='noct alpha web-01 x longhostname-with-many-octets'
shell_sums="$(
  for host in $sample_hosts; do
    printf '%s' "$host" | cksum | awk '{ print $1 }'
  done
)"
# shellcheck disable=SC2086 # word splitting passes one host per arg
js_sums="$(
  node -e "$js_cksum
for (const host of process.argv.slice(1)) {
  console.log(cksum(host));
}" $sample_hosts
)"

if [ "$shell_sums" != "$js_sums" ]; then
  printf '%s cksum port disagrees with cksum(1)\n' "$site" >&2
  diff -u <(printf '%s\n' "$shell_sums") \
    <(printf '%s\n' "$js_sums") || :
  exit 1
fi

printf 'palette sync: ok (%s presets)\n' \
  "$(printf '%s\n' "$shell_presets" | wc -l | tr -d ' ')"
