#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

shell_presets="$(
  sed -n "s/^[[:space:]]*\([a-z][a-z]*\)) \
base='\(#[[:xdigit:]]*\)' light='\(#[[:xdigit:]]*\)' ;;/\1=\2=\3/p" \
    "$ROOT/chroma.tmux"
)"
if [ -z "$shell_presets" ]; then
  printf 'failed to extract plugin palette data\n' >&2
  exit 1
fi

site="$ROOT/website/src/presets.ts"
site_presets="$(
  sed -n "s/^[[:space:]]*{ name: '\([a-z][a-z]*\)', \
base: '\(#[0-9a-fA-F]*\)', light: '\(#[0-9a-fA-F]*\)' },/\1=\2=\3/p" \
    "$site"
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

# The named background seeds live in three places: the plugin's
# named_background table, the site's presets.ts, and the pre-paint
# inline script in index.html. All three must agree.
shell_backgrounds="$(
  sed -n "s/^[[:space:]]*\([a-z][a-z-]*\)) seed='\(#[[:xdigit:]]*\)' ;;\
/\1=\2/p" "$ROOT/chroma.tmux"
)"
site_backgrounds="$(
  sed -n "s/^[[:space:]]*{ name: '\([a-z-]*\)', \
seed: '\(#[0-9a-f]*\)' },/\1=\2/p" "$site"
)"
html_backgrounds="$(
  sed -n "s/^[[:space:]]*'\([a-z-]*\)': '\(#[0-9a-f]*\)',\{0,1\}\$/\1=\2/p" \
    "$ROOT/website/index.html"
)"
if [ -z "$shell_backgrounds" ]; then
  printf 'failed to extract named backgrounds from chroma.tmux\n' >&2
  exit 1
fi
for copy in "$site_backgrounds" "$html_backgrounds"; do
  if [ "$shell_backgrounds" != "$copy" ]; then
    printf 'named background tables differ\n' >&2
    diff -u <(printf '%s\n' "$shell_backgrounds") \
      <(printf '%s\n' "$copy") || :
    exit 1
  fi
done

# The neutral anchors (bar surfaces, text tones, alerts, ink) are
# duplicated into the site CSS for both modes. The dark anchors are
# the plugin's local defaults; the light anchors are the literal
# reassignments in its light-mode block.
css="$ROOT/website/src/style.css"

plugin_anchor() {
  local mode="$1" name="$2" prefix=''

  if [ "$mode" = 'dark' ]; then
    prefix='local '
  fi
  sed -n "s/^[[:space:]]*${prefix}${name}='\(#[[:xdigit:]]*\)'\$/\1/p" \
    "$ROOT/chroma.tmux" | head -n 1
}

css_anchor() {
  local mode="$1" var="$2" selector=':root'

  if [ "$mode" = 'light' ]; then
    selector=":root\[data-theme='light'\]"
  fi
  sed -n "/^${selector} {\$/,/^}\$/p" "$css" |
    sed -n "s/^  ${var}: \(#[[:xdigit:]]*\);\$/\1/p"
}

for pair in \
  'bg --bar' \
  'bg_alt --panel-raised' \
  'fg --text' \
  'muted --muted' \
  'subtle --subtle' \
  'warn --warn' \
  'alert --alert' \
  'ink --ink'; do
  name="${pair%% *}"
  var="${pair##* }"
  for mode in dark light; do
    plugin_value="$(plugin_anchor "$mode" "$name")"
    site_value="$(css_anchor "$mode" "$var")"
    if [ -z "$plugin_value" ] || [ "$plugin_value" != "$site_value" ]; then
      printf '%s %s (%s) is %s in the plugin but %s in %s\n' \
        "$mode" "$name" "$var" "${plugin_value:-missing}" \
        "${site_value:-missing}" "$css" >&2
      exit 1
    fi
  done
done

# The site also carries every anchor (plus the plugin's border,
# which the CSS does not use for the page chrome) in the anchors
# object in presets.ts, feeding the palette readout and the
# custom-seed derivation.
ts_anchor() {
  local mode="$1" key="$2"

  sed -n "/^  ${mode}: {\$/,/^  },\$/p" "$site" |
    sed -n "s/^    ${key}: '\(#[[:xdigit:]]*\)',\$/\1/p"
}

for pair in \
  'bg bg' \
  'bg_alt bgAlt' \
  'fg fg' \
  'muted muted' \
  'subtle subtle' \
  'border border' \
  'warn warn' \
  'alert alert' \
  'ink ink'; do
  name="${pair%% *}"
  key="${pair##* }"
  for mode in dark light; do
    plugin_value="$(plugin_anchor "$mode" "$name")"
    site_value="$(ts_anchor "$mode" "$key")"
    if [ -z "$plugin_value" ] || [ "$plugin_value" != "$site_value" ]; then
      printf '%s %s (%s) is %s in the plugin but %s in %s\n' \
        "$mode" "$name" "$key" "${plugin_value:-missing}" \
        "${site_value:-missing}" "$site" >&2
      exit 1
    fi
  done
done

site_state="$ROOT/website/src/state.ts"
if ! sed -n "/mixColor(accent.value, barColor.value, 60)/p" \
  "$site_state" | read -r _; then
  printf '%s base_alt mix formula changed\n' "$site_state" >&2
  exit 1
fi

# The search patterns intentionally contain literal shell expressions.
# shellcheck disable=SC2016
if ! sed -n '/base_alt="$(mix_color "$base" "$bg" 60)"/p' \
  "$ROOT/chroma.tmux" | read -r _; then
  printf 'plugin base_alt mix formula changed\n' >&2
  exit 1
fi

# Custom-background handling must stay in lockstep: the luma
# classification (>= 130 is light) and the fg-toward-seed surface
# blends at 10 and 16 percent (plus 27 for the plugin border, which
# the site maps to its line color).
check_pair() {
  local plugin_fragment="$1"
  local site_file="$2"
  local site_fragment="$3"

  if ! sed -n "/$plugin_fragment/p" "$ROOT/chroma.tmux" | read -r _; then
    printf 'plugin custom-background formula changed: %s\n' \
      "$plugin_fragment" >&2
    exit 1
  fi
  if ! sed -n "/$site_fragment/p" "$site_file" | read -r _; then
    printf '%s custom-background formula changed: %s\n' \
      "$site_file" "$site_fragment" >&2
    exit 1
  fi
}

# shellcheck disable=SC2016
check_pair 'luma=$(((299 \* r + 587 \* g + 114 \* b) \/ 1000))' \
  "$ROOT/website/src/color.ts" '299 \* channel(color, 1)'
# shellcheck disable=SC2016
check_pair 'luma=$(((299 \* r + 587 \* g + 114 \* b) \/ 1000))' \
  "$ROOT/website/src/color.ts" '587 \* channel(color, 3)'
# shellcheck disable=SC2016
check_pair 'luma=$(((299 \* r + 587 \* g + 114 \* b) \/ 1000))' \
  "$ROOT/website/src/color.ts" '114 \* channel(color, 5)) \/ 1000'
# The shared mix keeps the plugin's channel order and divisor.
# shellcheck disable=SC2016
check_pair 'r=$((($((16#${c1:0:2})) \* pct' \
  "$ROOT/website/src/color.ts" 'channel(first, index) \* percent'
# shellcheck disable=SC2016
check_pair '(100 - pct)) \/ 100))' \
  "$ROOT/website/src/color.ts" '(100 - percent)'
# shellcheck disable=SC2016
check_pair '"$luma" -ge 130' \
  "$site_state" 'colorLuma(seed) >= 130'
# shellcheck disable=SC2016
check_pair 'bg="$(mix_color "$fg" "$seed" 10)"' \
  "$site_state" 'bar: mixColor(fg, seed, 10),'
# shellcheck disable=SC2016
check_pair 'bg_alt="$(mix_color "$fg" "$seed" 16)"' \
  "$site_state" 'panelRaised: mixColor(fg, seed, 16),'
# shellcheck disable=SC2016
check_pair 'border="$(mix_color "$fg" "$seed" 27)"' \
  "$site_state" 'line: mixColor(fg, seed, 27),'
# shellcheck disable=SC2016
check_pair 'muted="$(mix_color "$fg" "$seed" "$muted_mix")"' \
  "$site_state" 'muted: mixColor(fg, seed, mutedMix),'
# shellcheck disable=SC2016
check_pair 'subtle="$(mix_color "$fg" "$seed" "$subtle_mix")"' \
  "$site_state" 'subtle: mixColor(fg, seed, subtleMix),'
check_pair 'muted_mix=60' "$site_state" "'light' ? 80 : 60"
check_pair 'muted_mix=80' "$site_state" "'light' ? 80 : 60"
check_pair 'subtle_mix=45' "$site_state" "'light' ? 62 : 45"
check_pair 'subtle_mix=62' "$site_state" "'light' ? 62 : 45"

# The inline pre-paint script in index.html repeats the same
# resolution: every blend percentage, both text-tone ratio pairs,
# the full luma formula and threshold, the mix channel order, and
# the mode fg anchors (as decimal RGB, derived here from the same
# plugin anchors the site checks above use).
rgb_triple() {
  local hex="${1#\#}"

  printf '%d, %d, %d' \
    "$((16#${hex:0:2}))" "$((16#${hex:2:2}))" "$((16#${hex:4:2}))"
}

fg_dark="$(plugin_anchor dark fg)"
fg_light="$(plugin_anchor light fg)"
site_html="$ROOT/website/index.html"
for fragment in 'mix(10)' 'mix(13)' 'mix(16)' 'mix(27)' \
  'mix(mutedMix)' 'mix(subtleMix)' 'luma >= 130' \
  "'light' ? 80 : 60" "'light' ? 62 : 45" \
  '(299 * seed[0] + 587 * seed[1] + 114 * seed[2]) / 1000' \
  '(fg[index] * pct + channel * (100 - pct)) / 100' \
  "mode === 'light' ? [$(rgb_triple "$fg_light")] : \
[$(rgb_triple "$fg_dark")]"; do
  if ! grep -F "$fragment" "$site_html" > /dev/null; then
    printf '%s pre-paint script misses %s\n' \
      "$site_html" "$fragment" >&2
    exit 1
  fi
done

# The site ports POSIX cksum so its hostname preview picks the same
# preset as seeded_preset in chroma.tmux. Run the extracted JS
# implementation against the system cksum the plugin actually calls.
js_cksum="$(
  sed -n '/^export function cksum(text: string): number {$/,/^}$/p' "$site" |
    sed 's/^export //'
)"
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
  bun -e "$js_cksum
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

printf 'palette sync: ok (%s presets, both modes)\n' \
  "$(printf '%s\n' "$shell_presets" | wc -l | tr -d ' ')"
