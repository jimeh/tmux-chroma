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

version_output="$("$ROOT/chroma.tmux" --version)"
version="${version_output#chroma }"
package="tmux-chroma-$version"

first="$work/first"
second="$work/second"
extract="$work/extract"

"$ROOT/scripts/package-release.sh" "$first" > /dev/null
"$ROOT/scripts/package-release.sh" "$second" > /dev/null

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

for path in chroma.tmux scripts/cpu scripts/disk scripts/memory; do
  [[ -x "$extract/$package/$path" ]] || fail "$path is not executable"
done

[[ "$("$extract/$package/chroma.tmux" --version)" == "$version_output" ]] ||
  fail 'packaged version differs from the source version'

printf 'release package: ok (%s)\n' "$package.zip"
