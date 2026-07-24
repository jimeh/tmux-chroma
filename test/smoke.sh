#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN="$ROOT/chroma.tmux"
SOCKET="chroma-test-$$"
TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/chroma-test.XXXXXX")"
FAKE_BIN="$TEST_TMP/bin"
GHOSTTY_FIXTURE="$TEST_TMP/ghostty"
GHOST_CLIENT_PID=''
OTHER_CLIENT_PID=''

cleanup() {
  tmux -L "$SOCKET" kill-server 2> /dev/null || true
  [ -z "$GHOST_CLIENT_PID" ] || wait "$GHOST_CLIENT_PID" 2> /dev/null || true
  [ -z "$OTHER_CLIENT_PID" ] || wait "$OTHER_CLIENT_PID" 2> /dev/null || true
  rm -rf "$TEST_TMP"
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

client_count() {
  local client count=0

  while IFS= read -r client; do
    [ -n "$client" ] || continue
    count=$((count + 1))
  done < <(tmux -L "$SOCKET" list-clients -F '#{client_name}')
  printf '%s\n' "$count"
}

wait_for_client_count() {
  local expected="$1" _

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ "$(client_count)" -eq "$expected" ] && return
    sleep 0.1
  done
  fail "expected $expected attached client(s), got $(client_count)"
}

tmux_supports_client_theme_hooks() {
  local version major minor

  version="$(tmux -V)"
  version="${version#tmux }"
  major="${version%%.*}"
  minor="${version#*.}"
  minor="${minor%%[!0-9]*}"
  [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 6 ]; }
}

chroma_hook_count() {
  local hook="$1" line count=0

  while IFS= read -r line; do
    case "$line" in
      *'run-shell "#{@chroma_plugin_dir}/chroma.tmux"')
        count=$((count + 1))
        ;;
    esac
  done < <(tmux -L "$SOCKET" show-hooks -g "$hook")
  printf '%s\n' "$count"
}

run_theme() {
  tmux -L "$SOCKET" run-shell "$PLUGIN"
}

mkdir -p "$FAKE_BIN" "$GHOSTTY_FIXTURE"
cat > "$FAKE_BIN/ghostty" << 'EOF'
#!/bin/sh

[ "$*" = '+show-config --changes-only=false' ] || exit 64
[ ! -e "$CHROMA_GHOSTTY_FIXTURE/fail" ] || exit 1
while IFS= read -r line; do
  printf '%s\n' "$line"
done < "$CHROMA_GHOSTTY_FIXTURE/output"
EOF
chmod +x "$FAKE_BIN/ghostty"
printf 'background = #000000\n' > "$GHOSTTY_FIXTURE/output"

CHROMA_GHOSTTY_FIXTURE="$GHOSTTY_FIXTURE" PATH="$FAKE_BIN:$PATH" \
  tmux -L "$SOCKET" -f /dev/null new-session -d -s chroma
run_theme

version_output="$("$PLUGIN" --version)"
assert_option @chroma_version "${version_output#chroma }"
assert_option @chroma_bg '#15181d'
assert_option @chroma_current_mode dark
assert_option @chroma_current_background dark
assert_option @chroma_current_background_source default
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

# Two more accents independently pin the generated light column.
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
assert_option @chroma_current_background '#fdf6e3'
assert_option @chroma_current_background_source configured
assert_option @chroma_bg '#e9e4d4'
assert_option @chroma_bg_alt '#ded9cc'
assert_option @chroma_border '#c8c5bc'
assert_option @chroma_muted '#626670'
assert_option @chroma_subtle '#85878a'

tmux -L "$SOCKET" set-option -g @chroma_background '#FDF6E3'
run_theme
assert_option @chroma_current_background '#fdf6e3'
assert_option @chroma_current_background_source configured

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
assert_option @chroma_current_background '#fdf6e3'
assert_option @chroma_current_background_source configured
assert_option @chroma_bg '#e9e4d4'

tmux -L "$SOCKET" set-option -g @chroma_background tomorrow-night
run_theme
assert_option @chroma_current_mode dark
assert_option @chroma_bg '#2f3234'

tmux -L "$SOCKET" set-option -g @chroma_background bogus
run_theme
assert_option @chroma_current_mode dark
assert_option @chroma_current_background dark
assert_option @chroma_current_background_source default
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

# Ghostty detection is opt-in and falls back atomically. The control-mode
# client proves client_termname survives tmux even though the theme runs in a
# tmux-owned run-shell process.
tmux -L "$SOCKET" set-option -g @chroma_background '#301934'
tmux -L "$SOCKET" set-option -g @chroma_detect_ghostty_background on
if tmux_supports_client_theme_hooks; then
  tmux -L "$SOCKET" set-hook -g client-light-theme \
    'display-message "user light hook"'
  tmux -L "$SOCKET" set-hook -g client-dark-theme \
    'display-message "user dark hook"'
fi
run_theme
assert_option @chroma_current_background '#301934'
assert_option @chroma_current_background_source configured

tmux -L "$SOCKET" set-option -g @chroma_background solarized-light
run_theme
assert_option @chroma_current_background '#fdf6e3'
assert_option @chroma_current_background_source configured
tmux -L "$SOCKET" set-option -g @chroma_background '#301934'

mkfifo "$TEST_TMP/ghost-client-input"
exec 8<> "$TEST_TMP/ghost-client-input"
TERM=xterm-ghostty tmux -L "$SOCKET" -C attach-session -t chroma \
  <&8 > "$TEST_TMP/ghost-client-output" &
GHOST_CLIENT_PID=$!
wait_for_client_count 1
assert_option @chroma_current_background_source configured

printf 'background = #FDF6E3\ntheme = Catppuccin Latte\n' \
  > "$GHOSTTY_FIXTURE/output"
run_theme
assert_option @chroma_current_background '#fdf6e3'
assert_option @chroma_current_background_source ghostty
assert_option @chroma_current_mode light

tmux -L "$SOCKET" set-option -g @chroma_mode dark
run_theme
assert_option @chroma_current_background '#fdf6e3'
assert_option @chroma_current_background_source ghostty
assert_option @chroma_current_mode dark
tmux -L "$SOCKET" set-option -gu @chroma_mode

printf 'background = fdf6e3\n' > "$GHOSTTY_FIXTURE/output"
run_theme
assert_option @chroma_current_background '#301934'
assert_option @chroma_current_background_source configured

printf 'background = #fdf6e3\nbackground = #002b36\n' \
  > "$GHOSTTY_FIXTURE/output"
run_theme
assert_option @chroma_current_background '#301934'
assert_option @chroma_current_background_source configured

printf 'background = #fdf6e3\ntheme = light:Day,dark:Night\n' \
  > "$GHOSTTY_FIXTURE/output"
run_theme
assert_option @chroma_current_background '#301934'
assert_option @chroma_current_background_source configured

touch "$GHOSTTY_FIXTURE/fail"
tmux -L "$SOCKET" set-option -g @chroma_background invalid
run_theme
assert_option @chroma_current_background dark
assert_option @chroma_current_background_source default
rm "$GHOSTTY_FIXTURE/fail"

printf 'background = #fdf6e3\n' > "$GHOSTTY_FIXTURE/output"
tmux -L "$SOCKET" set-option -g @chroma_background '#301934'
mkfifo "$TEST_TMP/other-client-input"
exec 9<> "$TEST_TMP/other-client-input"
TERM=xterm-256color tmux -L "$SOCKET" -C attach-session -t chroma \
  <&9 > "$TEST_TMP/other-client-output" &
OTHER_CLIENT_PID=$!
wait_for_client_count 2
run_theme
assert_option @chroma_current_background '#301934'
assert_option @chroma_current_background_source configured

kill "$OTHER_CLIENT_PID"
wait "$OTHER_CLIENT_PID" 2> /dev/null || true
OTHER_CLIENT_PID=''
exec 9>&-
wait_for_client_count 1
run_theme
run_theme
assert_option @chroma_current_background '#fdf6e3'
assert_option @chroma_current_background_source ghostty

if tmux_supports_client_theme_hooks; then
  assert_contains \
    "$(tmux -L "$SOCKET" show-hooks -g client-light-theme)" \
    'display-message "user light hook"'
  assert_contains \
    "$(tmux -L "$SOCKET" show-hooks -g client-dark-theme)" \
    'display-message "user dark hook"'
  [ "$(chroma_hook_count client-light-theme)" -eq 1 ] ||
    fail 'Ghostty light-theme reload hook was not idempotent'
  [ "$(chroma_hook_count client-dark-theme)" -eq 1 ] ||
    fail 'Ghostty dark-theme reload hook was not idempotent'
fi

tmux -L "$SOCKET" set-option -g @chroma_detect_ghostty_background invalid
run_theme
assert_option @chroma_current_background '#301934'
assert_option @chroma_current_background_source configured
if tmux_supports_client_theme_hooks; then
  [ "$(chroma_hook_count client-light-theme)" -eq 0 ] ||
    fail 'Ghostty light-theme reload hook remained after opt-out'
  [ "$(chroma_hook_count client-dark-theme)" -eq 0 ] ||
    fail 'Ghostty dark-theme reload hook remained after opt-out'
  assert_contains \
    "$(tmux -L "$SOCKET" show-hooks -g client-light-theme)" \
    'display-message "user light hook"'
  assert_contains \
    "$(tmux -L "$SOCKET" show-hooks -g client-dark-theme)" \
    'display-message "user dark hook"'
fi

tmux -L "$SOCKET" set-option -gu @chroma_detect_ghostty_background
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
