#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="$ROOT/docs/index.html"

fail() {
  printf 'site: %s\n' "$1" >&2
  exit 1
}

assert_block_contains() {
  local selector="$1"
  local declaration="$2"
  local block

  block="$(
    sed -n "/^    ${selector} {\$/,/^    }\$/p" "$SITE"
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
    sed -n "/^    ${selector} {\$/,/^    }\$/p" "$SITE"
  )"
  case "$block" in
    *"$declaration"*) fail "$selector must not contain $declaration" ;;
    *) ;;
  esac
}

section_order="$(
  sed -n \
    's/^    <section class="window shell" id="\([^"]*\)".*/\1/p' \
    "$SITE"
)"
expected_order="$(printf '%s\n' intro palette config install)"

[ "$section_order" = "$expected_order" ] ||
  fail 'sections must follow the status-line window order'

manual_code_count="$(
  sed -n '/<h3>manually<\/h3>/,/<h3>requirements<\/h3>/p' "$SITE" |
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
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'landing page must identify Chroma as a tmux theme' ;;
  esac
done

assert_block_contains ':root' '--dock-height: 28px;'
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

# Narrow viewports hide the session and metrics segments; the
# surviving forward and tail dividers must retarget their hidden
# endpoints to the bar color or they paint stranded raised cells.
narrow_block="$(
  sed -n '/^    @media (max-width: 720px) {$/,/^    }$/p' "$SITE"
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
  "makeElement('powerline-space is-before', ' ')" \
  'makeDividerGlyph(direction)' \
  "makeElement('powerline-space is-after', ' ')"; do
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'Powerline dividers must use space, glyph, and space cells' ;;
  esac
done

for fragment in \
  "glyph.setAttribute('viewBox', '0 0 1 1')" \
  "'-0.1,0 0,0 1,0.5 0,1 -0.1,1'" \
  "'1.1,0 1,0 0,0.5 1,1 1.1,1'"; do
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'Powerline SVGs must fill one normalized character cell' ;;
  esac
done

case "$(< "$SITE")" in
  *"makeElement('', ' ' + metric + ' ')"*) ;;
  *) fail 'metric spacing must use literal character cells' ;;
esac

for fragment in \
  'id="statusbar"' \
  'id="swatch-grid"' \
  'id="custom-color-input"' \
  'aria-label="Accent presets"' \
  'function setupPalette()' \
  'function normalizeHex(value)' \
  "selectPreset({ name: 'custom', base: customBase })" \
  'colorHue(first.base) - colorHue(second.base)' \
  '@media (prefers-reduced-motion: reduce)'; do
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'site must preserve preview and palette controls' ;;
  esac
done

for fragment in \
  'function seededPreset()' \
  'preset: seededPreset(),' \
  'now.getHours(),'; do
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'default accent must be seeded from browser traits and time' ;;
  esac
done

# The default is the auto preset: browser-seeded on this page, with a
# hostname input that reuses the plugin's exact cksum hash to preview
# the accent any host would get.
for fragment in \
  'function cksum(text)' \
  'function presetForHost(host)' \
  'id="auto-host-input"' \
  "dataset.preset = 'auto'" \
  'selectAuto();'; do
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'auto preset must hash hostnames like the plugin' ;;
  esac
done

for fragment in \
  'id="gallery-bars"' \
  'aria-modal="true"' \
  'function buildGalleryBar(preset)' \
  "'1:zsh'" \
  "event.key === 'w'" \
  'region.inert = true;' \
  'region.inert = false;'; do
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'prefix + w must open the preset gallery' ;;
  esac
done

printf 'site: ok\n'
