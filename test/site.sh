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

section_order="$(
  sed -n \
    's/^    <section class="section shell" id="\([^"]*\)">/\1/p' \
    "$SITE"
)"
expected_order="$(printf '%s\n' palette behavior configure install)"

[ "$section_order" = "$expected_order" ] ||
  fail 'palette must immediately follow the live preview'

assert_block_contains '.status-prefix' 'background: var(--bar);'
assert_block_contains '.status-prefix.is-active' \
  'background: var(--panel-raised);'
assert_block_contains '.status-prefix.is-powerline' \
  'background: var(--bar);'
assert_block_contains '.divider-metrics' 'background: var(--bar);'

printf 'site: ok\n'
