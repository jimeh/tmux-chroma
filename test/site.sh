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
    's/^    <section class="section shell" id="\([^"]*\)">/\1/p' \
    "$SITE"
)"
expected_order="$(printf '%s\n' palette behavior configure install)"

[ "$section_order" = "$expected_order" ] ||
  fail 'palette must immediately follow the live preview'

assert_block_contains '.status-prefix' 'background: var(--bar);'
assert_block_contains '.statusbar' '--status-height: 24px;'
assert_block_contains '.statusbar' 'height: var(--status-height);'
assert_block_contains '.statusbar' 'line-height: var(--status-height);'
assert_block_contains '.powerline-glyph' 'width: 1ch;'
assert_block_contains '.powerline-glyph' 'height: 100%;'
assert_block_contains '.status-prefix.is-active' \
  'background: var(--panel-raised);'
assert_block_contains '.status-prefix.is-powerline' \
  'background: var(--bar);'
assert_block_contains '.divider-metrics' '--divider-from: var(--bar);'

for selector in \
  '.status-host' \
  '.status-session' \
  '.status-window' \
  '.status-metrics' \
  '.status-tail'; do
  assert_block_excludes "$selector" 'padding'
done
assert_block_excludes '.status-prefix' 'width:'
assert_block_excludes '.status-metrics' 'gap:'

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
  "'0,0 1,0.5 0,1'" \
  "'1,0 0,0.5 1,1'"; do
  case "$(< "$SITE")" in
    *"$fragment"*) ;;
    *) fail 'Powerline SVGs must fill one normalized character cell' ;;
  esac
done

case "$(< "$SITE")" in
  *"makeElement('', ' ' + metric + ' ')"*) ;;
  *) fail 'metric spacing must use literal character cells' ;;
esac

case "$(< "$SITE")" in
  *'segment-in'*) fail 'status preview changes must not animate' ;;
  *) ;;
esac

printf 'site: ok\n'
