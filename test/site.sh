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
CONFIG="$ROOT/website/src/components/Config.tsx"
GENERATED="$ROOT/website/.generated/prepaint.js"

(
  cd "$ROOT/website"
  bun run generate > /dev/null
)

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
# endpoints to the bar color or they paint stranded raised cells,
# and a literal-space gap cell must stand in for the hidden session
# segment between the host block and the prefix indicator.
narrow_block="$(
  sed -n '/^@media (max-width: 720px) {$/,/^}$/p' "$CSS"
)"
for fragment in \
  '.divider-forward' \
  '--divider-to: var(--bar);' \
  '.divider-tail' \
  '--divider-from: var(--bar);' \
  '.status-session-gap'; do
  case "$narrow_block" in
    *"$fragment"*) ;;
    *) fail 'narrow viewport must retarget surviving dividers to the bar' ;;
  esac
done
assert_file_contains "$STATUSBAR" "'status-session-gap'" \
  'the narrow session gap must be a literal space cell'
assert_block_contains '.status-session-gap' 'background: var(--bar);'
assert_block_contains '.status-session-gap.is-active' \
  'background: var(--panel-raised);'

# The bar boots in as one element: per-segment boot animations once
# left the powerline dividers arriving visibly late, because the
# animation shorthand silently reset the segment stagger delays.
assert_block_contains '.boot' 'animation: segment-in'
if sed -n '/^\.boot \./p' "$CSS" | read -r _; then
  fail 'the status bar must animate as one element, not per segment'
fi

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

# One theme control drives the whole page: an inline head script
# resolves the persisted @chroma_background choice (dark by default,
# regardless of the system scheme) before the stylesheet paints, the
# CSS overrides its dark defaults under data-theme='light', and the
# live conf block hosts the toggle plus a custom background input.
assert_file_contains "$HTML" '<script data-chroma-prepaint></script>' \
  'theme must resolve before the first paint'
assert_file_contains "$GENERATED" "read('chroma-background')" \
  'generated pre-paint resolver must restore the persisted theme'
assert_block_contains ":root\[data-theme='light'\]" 'color-scheme: light;'
assert_file_contains "$CONFIG" '@chroma_background' \
  'the conf block must host the theme control'
assert_file_contains "$CONFIG" 'ariaLabel="@chroma_background value"' \
  'the background value must open a dropdown of every option'
assert_file_contains "$CONFIG" 'ariaLabel="@chroma_preset value"' \
  'the preset value must open a dropdown of every preset'

# The conf dropdowns are custom listboxes: every option carries a
# color swatch, the button is plain text (so copying the block reads
# exactly as rendered), and the popup escapes the conf block's
# scroll clipping via fixed positioning.
for fragment in \
  'role="combobox"' \
  'role="listbox"' \
  'role="option"' \
  'class="conf-option-swatch"' \
  'class="conf-option-label"' \
  'aria-activedescendant'; do
  assert_file_contains "$CONFIG" "$fragment" \
    'conf dropdowns must be accessible swatched listboxes'
done
assert_block_contains '.conf-select-popup' 'position: fixed;'
assert_block_contains '.conf-select-popup' 'max-width: calc(100vw - 16px);'

# iOS paints a scroll container's background on the moving content
# layer, so overscroll would reveal the page behind a scrolling
# block. Every bordered block is a shell around an inner scroll
# region that carries the same background: .block-scroll for the
# code blocks, .status-dock-scroll for the dock, and
# .conf-select-scroll for the dropdown popup.
for declaration in 'overflow-x: auto;' 'overflow-y: hidden;' \
  'background: var(--panel);'; do
  assert_block_contains '.block-scroll' "$declaration"
done
assert_block_contains '.status-dock-scroll' 'overflow-y: hidden;'
assert_block_contains '.status-dock-scroll' 'background: var(--bar);'
assert_block_contains '.conf-select-scroll' 'background: var(--panel);'
assert_block_contains '.conf-select-scroll' 'overscroll-behavior: contain;'

assert_file_contains "$DOCK" 'autoHost' \
  'the dock hostname must follow the typed auto host'
for fragment in "'dark themes'" "'light themes'" \
  'colorLuma(entry.seed)'; do
  assert_file_contains "$CONFIG" "$fragment" \
    'themes must group by their seed luma classification'
done
assert_file_contains "$CONFIG" 'id="custom-background-input"' \
  'the config section must accept a custom background seed'
assert_file_contains "$STATE" 'persistValue(backgroundStorageKey' \
  'a manual background choice must persist'

# Every conf-block value (and the auto-host preview) persists under
# a chroma-* key, stored only while non-default, with a reset link
# in the conf block while anything differs.
for key in chroma-preset chroma-mode chroma-host chroma-powerline \
  chroma-show-cpu chroma-show-memory chroma-show-disk; do
  assert_file_contains "$STATE" "'$key'" \
    'conf values must persist across visits'
done
assert_file_contains "$CONFIG" '@chroma_mode' \
  'the conf block must host the mode override'
assert_file_contains "$GENERATED" "read('chroma-mode')" \
  'the mode override must resolve before the first paint'
assert_file_contains "$CONFIG" '# reset to defaults' \
  'the conf block must offer a reset while non-default'
assert_file_contains "$PALETTE" 'aria-label="Clear the hostname"' \
  'the auto-host preview must offer a clear button'
assert_file_contains "$PALETTE" 'aria-label="Reset the custom accent"' \
  'an applied custom accent must offer a reset button'
assert_file_contains "$CONFIG" 'aria-label="Reset the custom background"' \
  'an applied custom background must offer a reset button'

assert_file_contains "$CONFIG" "querySelector('.status-dock')" \
  'the conf dropdown must stop above the status dock'
assert_file_contains "$HTML" 'darkreader-lock' \
  'the page must opt out of dark-mode extensions'

# The static install snippets gain copy buttons as progressive
# enhancement, and the conf block's copy emits only the option
# lines, built from state rather than the DOM.
assert_file_contains "$MAIN" "querySelectorAll('.inline-code')" \
  'install snippets must gain copy buttons'
assert_file_contains "$PALETTE" "document.execCommand('copy')" \
  'copy must fall back beyond the clipboard API'
assert_block_contains '.conf-block' 'position: relative;'
assert_block_contains '.inline-code' 'position: relative;'
assert_file_contains "$CONFIG" 'function confText' \
  'the conf block copy must emit only the option lines'

# The blinking cursor sits exactly one space after the typed
# command, like a shell prompt.
assert_file_contains "$HTML" 'docs</span> <span' \
  'the prompt cursor must sit one space after the command'

# The hero links to the repository and hosts a prominent light/dark
# toggle beside the prompt.
assert_file_contains "$HTML" \
  '<a href="https://github.com/jimeh/tmux-chroma">github</a>' \
  'the hero must link to the repository'
assert_file_contains "$HTML" 'id="theme-toggle"' \
  'the hero must host the light/dark toggle'
assert_file_contains "$CONFIG" 'function BackgroundQuickToggle' \
  'the hero toggle must flip the background option'

for fragment in \
  'function seededPreset()' \
  'now.getHours(),'; do
  assert_file_contains "$PRESETS" "$fragment" \
    'default accent must be seeded from browser traits and time'
done
assert_file_contains "$STATE" 'host ? presetForHost(host) : seededPreset()' \
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

# Easter eggs: prefix + r re-rolls the banner with six random
# accents kept in hue order (sampled as sorted indices of the
# hue-ordered list); prefix + c paints the curated rainbow.
assert_file_contains "$MAIN" "event.key === 'r'" \
  'prefix + r must re-roll the banner accents'
assert_file_contains "$MAIN" "event.key === 'c'" \
  'prefix + c must paint the banner rainbow'
assert_file_contains "$STATE" 'function rollLogo' \
  'prefix + r must re-roll the banner accents'
assert_file_contains "$STATE" 'function rainbowLogo' \
  'prefix + c must paint the banner rainbow'
assert_file_contains "$ROOT/website/src/components/Banner.tsx" \
  'LETTER_COLUMNS' 'the banner must split into per-letter columns'

printf 'site: ok\n'
