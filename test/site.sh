#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTML="$ROOT/website/index.html"
CSS="$ROOT/website/src/style.css"
MAIN="$ROOT/website/src/main.tsx"
PRESETS="$ROOT/website/src/presets.ts"
COLOR="$ROOT/website/src/color.ts"
STATE="$ROOT/website/src/state.ts"
STATUSBAR="$ROOT/website/src/components/StatusBar.tsx"
DOCK="$ROOT/website/src/components/Dock.tsx"
PALETTE="$ROOT/website/src/components/Palette.tsx"
GALLERY="$ROOT/website/src/components/Gallery.tsx"

fail() {
  printf 'site: %s\n' "$1" >&2
  exit 1
}

assert_file_contains() {
  local file="$1"
  local fragment="$2"
  local message="$3"

  case "$(< "$file")" in
    *"$fragment"*) ;;
    *) fail "$message" ;;
  esac
}

assert_block_contains() {
  local selector="$1"
  local declaration="$2"
  local block

  block="$(
    sed -n "/^${selector} {\$/,/^}\$/p" "$CSS"
  )"
  case "$block" in
    *"$declaration"*) ;;
    *) fail "$selector must contain $declaration" ;;
  esac
}

assert_block_excludes() {
  local selector="$1"
  local declaration="$2"
  local block

  block="$(
    sed -n "/^${selector} {\$/,/^}\$/p" "$CSS"
  )"
  case "$block" in
    *"$declaration"*) fail "$selector must not contain $declaration" ;;
    *) ;;
  esac
}

section_order="$(
  sed -n \
    's/^    <section class="window shell" id="\([^"]*\)".*/\1/p' \
    "$HTML"
)"
expected_order="$(printf '%s\n' intro palette config install)"

[ "$section_order" = "$expected_order" ] ||
  fail 'sections must follow the status-line window order'

manual_code_count="$(
  sed -n '/<h3>manually<\/h3>/,/<h3>requirements<\/h3>/p' "$HTML" |
    sed -n '/class="inline-code"/p' |
    wc -l |
    tr -d ' '
)"
[ "$manual_code_count" = '2' ] ||
  fail 'manual installation must use separate shell and tmux snippets'

for fragment in \
  '<title>Chroma — a host-aware tmux theme</title>' \
  '<p class="tagline hero-tagline">A different accent for every host.</p>' \
  'aria-label="Sections, shown as a live Chroma status line"' \
  'href="https://github.com/tmux-plugins/tpm"'; do
  assert_file_contains "$HTML" "$fragment" \
    'landing page must identify Chroma as a tmux theme'
done

assert_block_contains ':root' '--dock-height: 28px;'

# Prose and code blocks share one 80-column measure; per-element ch
# values would drift with each block's font size.
assert_block_contains ':root' '--measure: 720px;'
for selector in '.lede' '.inline-code' '.conf-block' '.readout' \
  '.install-command' '.custom-color'; do
  assert_block_contains "$selector" 'max-width: var(--measure);'
done
assert_block_contains '.statusbar' 'height: var(--dock-height);'
assert_block_contains '.statusbar' 'line-height: var(--dock-height);'
assert_block_contains '.statusbar' 'white-space: pre;'
assert_block_excludes '.status-dock' 'border-top'
assert_block_contains '.status-prefix' 'background: var(--bar);'
assert_block_contains '.status-prefix.is-active' \
  'background: var(--panel-raised);'
assert_block_contains '.status-prefix.is-powerline' \
  'background: var(--bar);'
assert_block_contains '.divider-metrics' '--divider-from: var(--bar);'
assert_block_contains '.powerline-glyph' 'height: 100%;'

# Text inputs sit inside bordered containers; the focus ring moves to
# the container so it aligns with the visible box, and must not be
# suppressed without that replacement.
assert_block_contains '.custom-color:focus-within' \
  'outline: 2px solid var(--accent);'
assert_block_contains '.custom-color-input:focus-visible' 'outline: none;'

# Narrow viewports hide the session and metrics segments; the
# surviving forward and tail dividers must retarget their hidden
# endpoints to the bar color or they paint stranded raised cells.
narrow_block="$(
  sed -n '/^@media (max-width: 720px) {$/,/^}$/p' "$CSS"
)"
for fragment in \
  '.divider-forward' \
  '--divider-to: var(--bar);' \
  '.divider-tail' \
  '--divider-from: var(--bar);'; do
  case "$narrow_block" in
    *"$fragment"*) ;;
    *) fail 'narrow viewport must retarget surviving dividers to the bar' ;;
  esac
done

# Segment spacing must come from literal space characters in the format
# strings, mirroring tmux cell geometry, never from CSS padding.
for selector in \
  '.status-host' \
  '.status-session' \
  '.status-metrics' \
  '.status-tail'; do
  assert_block_excludes "$selector" 'padding'
done
assert_block_contains '.status-window' 'padding: 0;'

for fragment in \
  "class=\"powerline-space is-before\">{' '}" \
  '<DividerGlyph direction={direction} />' \
  "class=\"powerline-space is-after\">{' '}"; do
  assert_file_contains "$STATUSBAR" "$fragment" \
    'Powerline dividers must use space, glyph, and space cells'
done

for fragment in \
  'viewBox="0 0 1 1"' \
  "'-0.1,0 0,0 1,0.5 0,1 -0.1,1'" \
  "'1.1,0 1,0 0,0.5 1,1 1.1,1'"; do
  assert_file_contains "$STATUSBAR" "$fragment" \
    'Powerline SVGs must fill one normalized character cell'
done

assert_file_contains "$STATUSBAR" "{' ' + metric + ' '}" \
  'metric spacing must use literal character cells'

assert_file_contains "$HTML" 'class="status-dock"' \
  'site must render the status-line dock'
assert_file_contains "$HTML" 'id="swatch-grid"' \
  'site must preserve preview and palette controls'
assert_file_contains "$PALETTE" 'aria-label="Accent presets"' \
  'site must preserve preview and palette controls'
assert_file_contains "$PALETTE" 'id="custom-color-input"' \
  'site must preserve preview and palette controls'
assert_file_contains "$PALETTE" \
  "selectPreset({ name: 'custom', base: submitted })" \
  'site must preserve preview and palette controls'
assert_file_contains "$COLOR" 'function normalizeHex(value: string)' \
  'site must preserve preview and palette controls'
assert_file_contains "$PRESETS" \
  'colorHue(first.base) - colorHue(second.base)' \
  'swatches and gallery must sort presets by hue'
assert_block_contains '@media (prefers-reduced-motion: reduce)' \
  'animation-duration: 0.01ms !important;'
assert_file_contains "$DOCK" 'prefers-reduced-motion' \
  'dock navigation must honor reduced motion'

for fragment in \
  'function seededPreset()' \
  'now.getHours(),'; do
  assert_file_contains "$PRESETS" "$fragment" \
    'default accent must be seeded from browser traits and time'
done
assert_file_contains "$STATE" 'signal<Preset>(seededPreset())' \
  'default accent must be seeded from browser traits and time'

# The default is the auto preset: browser-seeded on this page, with a
# hostname input that reuses the plugin's exact cksum hash to preview
# the accent any host would get.
for fragment in \
  'function cksum(text: string)' \
  'function presetForHost(host: string)'; do
  assert_file_contains "$PRESETS" "$fragment" \
    'auto preset must hash hostnames like the plugin'
done
assert_file_contains "$PALETTE" 'id="auto-host-input"' \
  'auto preset must hash hostnames like the plugin'
assert_file_contains "$PALETTE" 'onClick={selectAuto}' \
  'auto preset must hash hostnames like the plugin'

for fragment in \
  'class="gallery-bars"' \
  'aria-modal="true"' \
  "'1:zsh'" \
  'region.inert = true;' \
  'region.inert = false;'; do
  assert_file_contains "$GALLERY" "$fragment" \
    'prefix + w must open the preset gallery'
done
assert_file_contains "$MAIN" "event.key === 'w'" \
  'prefix + w must open the preset gallery'

printf 'site: ok\n'
