#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN="$ROOT/chroma.tmux"
SOCKET="chroma-test-$$"

cleanup() {
  tmux -L "$SOCKET" kill-server 2> /dev/null || true
}
trap cleanup EXIT INT TERM

fail() {
  printf 'smoke test failed: %s\n' "$*" >&2
  exit 1
}

option() {
  tmux -L "$SOCKET" show-option -gqv "$1"
}

assert_option() {
  local name="$1"
  local expected="$2"
  local actual

  actual="$(option "$name")"
  [ "$actual" = "$expected" ] ||
    fail "$name: expected '$expected', got '$actual'"
}

assert_contains() {
  local value="$1"
  local expected="$2"

  case "$value" in
    *"$expected"*) ;;
    *) fail "expected value to contain '$expected'" ;;
  esac
}

assert_not_contains() {
  local value="$1"
  local unexpected="$2"

  case "$value" in
    *"$unexpected"*) fail "expected value not to contain '$unexpected'" ;;
    *) ;;
  esac
}

run_theme() {
  tmux -L "$SOCKET" run-shell "$PLUGIN"
}

tmux -L "$SOCKET" -f /dev/null new-session -d -s chroma
tmux -L "$SOCKET" set-option -g @chroma_preset peach
run_theme

assert_option @chroma_current_preset peach
assert_option @chroma_base '#f5a97f'
assert_option @chroma_base_alt '#9b6f57'
assert_option @chroma_plugin_dir "$ROOT"
assert_contains "$(option @chroma_preset_names)" 'purple'
assert_contains "$(option @chroma_preset_names)" 'gold'
assert_contains "$(option @chroma_preset_names)" 'cornflower'
assert_contains "$(option @chroma_preset_names)" 'rosewater'

left_before="$(option status-left)"
right_before="$(option status-right)"
run_theme
[ "$left_before" = "$(option status-left)" ] ||
  fail 'status-left changed after reload'
[ "$right_before" = "$(option status-right)" ] ||
  fail 'status-right changed after reload'

tmux -L "$SOCKET" set-option -g @chroma_base_color '#123456'
run_theme
assert_option @chroma_base '#123456'
assert_option @chroma_base_alt '#13283f'

tmux -L "$SOCKET" set-option -g @chroma_base_color invalid
tmux -L "$SOCKET" set-option -g @chroma_preset invalid
run_theme
assert_not_contains "$(option @chroma_base)" 'invalid'
assert_contains "$(option @chroma_preset_names)" \
  "$(option @chroma_current_preset)"

tmux -L "$SOCKET" set-option -g @chroma_preset purple
run_theme
assert_option @chroma_current_preset purple
assert_option @chroma_base '#ba91d8'

tmux -L "$SOCKET" set-option -g @chroma_preset cornflower
run_theme
assert_option @chroma_current_preset cornflower
assert_option @chroma_base '#83baee'

tmux -L "$SOCKET" set-option -g @chroma_preset sky
run_theme
assert_option @chroma_current_preset sky
assert_option @chroma_base '#91d7e3'

# 'auto' must land on the same preset the seeded hash picks for the
# host, mirroring seeded_preset: cksum(host_short) % preset count.
tmux -L "$SOCKET" set-option -g @chroma_preset auto
run_theme
host="$(tmux -L "$SOCKET" display-message -p '#{host_short}')"
sum="$(printf '%s' "$host" | cksum | awk '{ print $1 }')"
read -ra names <<< "$(option @chroma_preset_names)"
assert_option @chroma_current_preset "${names[sum % ${#names[@]}]}"

tmux -L "$SOCKET" set-option -g @chroma_preset blue
tmux -L "$SOCKET" set-option -g @chroma_powerline on
tmux -L "$SOCKET" set-option -g @chroma_show_cpu off
tmux -L "$SOCKET" set-option -g @chroma_show_memory off
tmux -L "$SOCKET" set-option -g @chroma_show_disk on
tmux -L "$SOCKET" set-option -g @chroma_disk_path /tmp
tmux -L "$SOCKET" set-option -g @chroma_left_extra DEV
tmux -L "$SOCKET" set-option -g @chroma_right_extra VPN
run_theme

left="$(option status-left)"
right="$(option status-right)"
assert_contains "$left" ''
assert_contains "$left" 'DEV'
assert_contains "$right" ''
assert_contains "$right" 'VPN'
assert_contains "$right" 'scripts/disk'
assert_contains "$right" '/tmp'
assert_not_contains "$right" 'scripts/cpu'
assert_not_contains "$right" 'scripts/memory'

cpu="$("$ROOT/scripts/cpu")"
memory="$("$ROOT/scripts/memory")"
disk="$("$ROOT/scripts/disk" /)"

[[ "$cpu" =~ ^([0-9]{1,3}%|--)$ ]] ||
  fail "unexpected CPU output: '$cpu'"
[[ "$memory" =~ ^([0-9]{1,3}%|--)$ ]] ||
  fail "unexpected memory output: '$memory'"
[[ "$disk" =~ ^([0-9]+([.][0-9])?[BKMGTPE]?|--)$ ]] ||
  fail "unexpected disk output: '$disk'"

printf 'tmux smoke: ok (%s)\n' "$(tmux -V)"
