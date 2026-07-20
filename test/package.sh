#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"

cleanup() {
  rm -rf "$work"
}
trap cleanup EXIT INT TERM

fail() {
  printf 'package test failed: %s\n' "$*" >&2
  exit 1
}

assert_mode() {
  local expected="$1"
  local path="$2"
  local actual

  if stat -c '%a' "$path" > /dev/null 2>&1; then
    actual="$(stat -c '%a' "$path")"
  else
    actual="$(stat -f '%Lp' "$path")"
  fi

  [[ "$actual" == "$expected" ]] ||
    fail "${path#"$extract/$package/"} has mode $actual, expected $expected"
}

version_output="$("$ROOT/chroma.tmux" --version)"
version="${version_output#chroma }"
package="tmux-chroma-$version"

first="$work/first"
second="$work/second"
extract="$work/extract"

TZ=UTC0 "$ROOT/scripts/package-release.sh" "$first" > /dev/null
TZ=EST5EDT "$ROOT/scripts/package-release.sh" "$second" > /dev/null

first_archive="$first/$package.zip"
second_archive="$second/$package.zip"

[[ -s "$first_archive" ]] || fail 'archive is missing or empty'
cmp -s "$first_archive" "$second_archive" ||
  fail 'repeated builds produced different archives'

mkdir -p "$extract"
ouch decompress --quiet --yes --dir "$extract" "$first_archive"

expected="CHANGELOG.md
LICENSE
README.md
chroma.tmux
scripts/cpu
scripts/disk
scripts/memory"
actual="$(
  cd "$extract/$package"
  find . -type f -print | LC_ALL=C sort | sed 's|^\./||'
)"
[[ "$actual" == "$expected" ]] ||
  fail "unexpected archive contents: $actual"

for path in \
  CHANGELOG.md \
  LICENSE \
  README.md \
  chroma.tmux \
  scripts/cpu \
  scripts/disk \
  scripts/memory; do
  cmp -s "$ROOT/$path" "$extract/$package/$path" ||
    fail "$path differs from the source"
done

assert_mode 755 "$extract/$package/chroma.tmux"
assert_mode 755 "$extract/$package/scripts/cpu"
assert_mode 755 "$extract/$package/scripts/disk"
assert_mode 755 "$extract/$package/scripts/memory"
assert_mode 644 "$extract/$package/README.md"
assert_mode 644 "$extract/$package/LICENSE"
assert_mode 644 "$extract/$package/CHANGELOG.md"

[[ "$("$extract/$package/chroma.tmux" --version)" == "$version_output" ]] ||
  fail 'packaged version differs from the source version'

printf 'release package: ok (%s)\n' "$package.zip"
