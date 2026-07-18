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
run_theme

assert_option @chroma_bg '#15181d'
assert_option @chroma_current_mode dark
assert_option @chroma_ink '#101216'
assert_option @chroma_dark '#101216'

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

tmux -L "$SOCKET" set-option -gu @chroma_base_color
tmux -L "$SOCKET" set-option -g @chroma_background light
tmux -L "$SOCKET" set-option -g @chroma_preset blue
run_theme
assert_option @chroma_current_mode light
assert_option @chroma_base '#3f68bb'
assert_option @chroma_bg '#e9ecf2'
assert_option @chroma_warn '#b89651'
assert_option @chroma_ink '#f4f6fa'
assert_option @chroma_dark '#f4f6fa'
assert_option @chroma_base_alt '#839cd1'

# Two more accents pin the light column here; palette-sync.sh keeps
# the full table in lockstep with the site.
tmux -L "$SOCKET" set-option -g @chroma_preset peach
run_theme
assert_option @chroma_base '#b5663a'

tmux -L "$SOCKET" set-option -g @chroma_preset cornflower
run_theme
assert_option @chroma_base '#4078ac'

tmux -L "$SOCKET" set-option -g @chroma_preset blue
run_theme

left_before="$(option status-left)"
right_before="$(option status-right)"
run_theme
[ "$left_before" = "$(option status-left)" ] ||
  fail 'light status-left changed after reload'
[ "$right_before" = "$(option status-right)" ] ||
  fail 'light status-right changed after reload'

tmux -L "$SOCKET" set-option -g @chroma_background '#fdf6e3'
run_theme
assert_option @chroma_current_mode light
assert_option @chroma_bg '#e9e4d4'
assert_option @chroma_bg_alt '#ded9cc'
assert_option @chroma_border '#c8c5bc'
assert_option @chroma_muted '#626670'
assert_option @chroma_subtle '#85878a'

# Luma 130 exactly is light and 129 stays dark; pins the >= boundary.
tmux -L "$SOCKET" set-option -g @chroma_background '#828282'
run_theme
assert_option @chroma_current_mode light
assert_option @chroma_bg '#7b7b7d'

tmux -L "$SOCKET" set-option -g @chroma_background '#818181'
run_theme
assert_option @chroma_current_mode dark
assert_option @chroma_bg '#898a8b'

tmux -L "$SOCKET" set-option -g @chroma_background '#301934'
run_theme
assert_option @chroma_current_mode dark
assert_option @chroma_bg '#402c45'
assert_option @chroma_muted '#948e9f'
assert_option @chroma_subtle '#7b7184'

# Named theme backgrounds resolve to their seed and then behave
# like the matching literal #rrggbb.
tmux -L "$SOCKET" set-option -g @chroma_background solarized-light
run_theme
assert_option @chroma_current_mode light
assert_option @chroma_bg '#e9e4d4'

tmux -L "$SOCKET" set-option -g @chroma_background tomorrow-night
run_theme
assert_option @chroma_current_mode dark
assert_option @chroma_bg '#2f3234'

tmux -L "$SOCKET" set-option -g @chroma_background bogus
run_theme
assert_option @chroma_current_mode dark
assert_option @chroma_bg '#15181d'

# @chroma_mode forces the palette mode over the background's luma
# classification; the background still supplies the seed.
tmux -L "$SOCKET" set-option -g @chroma_background '#608ca6'
run_theme
assert_option @chroma_current_mode dark

tmux -L "$SOCKET" set-option -g @chroma_mode light
run_theme
assert_option @chroma_current_mode light
assert_option @chroma_bg '#5c849d'
assert_option @chroma_ink '#f4f6fa'

tmux -L "$SOCKET" set-option -g @chroma_mode dark
tmux -L "$SOCKET" set-option -g @chroma_background light
run_theme
assert_option @chroma_current_mode dark
assert_option @chroma_bg '#15181d'

tmux -L "$SOCKET" set-option -g @chroma_mode bogus
tmux -L "$SOCKET" set-option -g @chroma_background '#608ca6'
run_theme
assert_option @chroma_current_mode dark

tmux -L "$SOCKET" set-option -gu @chroma_mode
tmux -L "$SOCKET" set-option -gu @chroma_background

tmux -L "$SOCKET" set-option -g @chroma_base_color '#123456'
tmux -L "$SOCKET" set-option -g @chroma_background light
run_theme
assert_option @chroma_base '#123456'
assert_option @chroma_base_alt '#687d94'

tmux -L "$SOCKET" set-option -gu @chroma_base_color
tmux -L "$SOCKET" set-option -gu @chroma_background

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
