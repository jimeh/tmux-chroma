#!/usr/bin/env bash

set -u

CHROMA_VERSION='0.1.0' # x-release-please-version

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# These ordered tables are Chroma's authored color source of truth. Keep the
# preset order stable: seeded_preset hashes directly into it.
PRESETS='blue #8aadf4 #3f68bb
peach #f5a97f #b5663a
teal #8bd5ca #4f8d83
mauve #c6a0f6 #824ec3
green #a6da95 #649753
lavender #b7bdf8 #616bc9
sapphire #7dc4e4 #437f9a
pink #f5bde6 #c569ac
yellow #eed49f #b89651
maroon #ee99a0 #b74b54
lime #c8dd88 #83964b
ash #a5adcb #636b89
red #ed8796 #ad4352
orchid #e38dcd #a04b8b
jade #8cd9b3 #4e9271
plum #d290df #8f4e9c
purple #ba91d8 #775293
rosewater #f4dbd6 #bc8176
flamingo #f0c6c6 #bd7575
sky #91d7e3 #4d96a2
gold #efbc88 #b17a42
cornflower #83baee #4078ac'

NAMED_BACKGROUNDS='solarized-light #fdf6e3
solarized-dark #002b36
tomorrow #ffffff
tomorrow-night #1d1f21
gruvbox-light #fbf1c7
gruvbox-dark #282828
one-light #fafafa
one-dark #282c34
catppuccin-latte #eff1f5
catppuccin-frappe #303446
catppuccin-macchiato #24273a
catppuccin-mocha #1e1e2e
everforest-light #fdf6e0
everforest-dark #2d353b
rose-pine-dawn #faf4ed
rose-pine #191724
github-light #ffffff
github-dark #0d1117
dracula #282a36
nord #2e3440
monokai #272822
tokyo-night #1a1b26'

MODE_ANCHORS='dark #15181d #20242b #d7dde7 #8b96a8 #6f7a8d #343a44 #eed49f #ed8796 #101216
light #e9ecf2 #dde1e9 #3c4354 #5c6678 #767f93 #c4cad6 #b89651 #ad4352 #f4f6fa'

LUMA_RED=299
LUMA_GREEN=587
LUMA_BLUE=114
LUMA_DIVISOR=1000
LUMA_LIGHT_THRESHOLD=130
SURFACE_BG_MIX=10
SURFACE_PANEL_MIX=13
SURFACE_BG_ALT_MIX=16
SURFACE_BORDER_MIX=27
DARK_MUTED_MIX=60
DARK_SUBTLE_MIX=45
LIGHT_MUTED_MIX=80
LIGHT_SUBTLE_MIX=62
BASE_ALT_MIX=60

preset_names() {
  local name dark light names=''

  while read -r name dark light; do
    names="${names:+$names }$name"
  done <<< "$PRESETS"
  printf '%s\n' "$names"
}

PRESET_NAMES="$(preset_names)"

get_tmux_option() {
  local option="$1"

  tmux show-option -gqv "$option"
}

set_tmux_option() {
  local option="$1"
  local value="$2"

  tmux set-option -gq "$option" "$value"
}

default_tmux_option() {
  local option="$1"
  local default="$2"
  local value

  value="$(get_tmux_option "$option")"
  if [ -n "$value" ]; then
    printf '%s\n' "$value"
  else
    printf '%s\n' "$default"
  fi
}

normalize_hex() {
  local value="$1"

  value="${value//A/a}"
  value="${value//B/b}"
  value="${value//C/c}"
  value="${value//D/d}"
  value="${value//E/e}"
  value="${value//F/f}"
  printf '%s\n' "$value"
}

normalize_configured_background() {
  local configured="$1" named

  resolved_background_source='configured'
  case "$configured" in
    dark | light)
      resolved_background="$configured"
      ;;
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F])
      resolved_background="$(normalize_hex "$configured")"
      ;;
    *)
      named="$(named_background "$configured")"
      if [ -n "$named" ]; then
        resolved_background="$named"
      else
        resolved_background='dark'
        resolved_background_source='default'
      fi
      ;;
  esac
}

detect_ghostty_background() {
  local client_term client_count=0
  local ssh_environment
  local output line value background='' background_count=0

  ssh_environment="$(tmux show-environment -g SSH_CONNECTION 2> /dev/null)" ||
    ssh_environment=''
  case "$ssh_environment" in
    SSH_CONNECTION=*) return 1 ;;
  esac

  # Chroma styles the whole tmux server, so only one attached client can
  # provide an unambiguous terminal background.
  while IFS= read -r client_term; do
    client_count=$((client_count + 1))
    [ "$client_term" = 'xterm-ghostty' ] || return 1
  done < <(tmux list-clients -F '#{client_termname}' 2> /dev/null)
  [ "$client_count" -eq 1 ] || return 1

  command -v ghostty > /dev/null 2>&1 || return 1
  output="$(ghostty +show-config --changes-only=false 2> /dev/null)" ||
    return 1

  while IFS= read -r line; do
    case "$line" in
      'background = '*)
        background_count=$((background_count + 1))
        value="${line#background = }"
        case "$value" in
          '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F])
            background="$(normalize_hex "$value")"
            ;;
          *) return 1 ;;
        esac
        ;;
      'theme = '*)
        value="${line#theme = }"
        # +show-config resolves conditional themes to one branch. Reject the
        # source syntax so a dual light/dark theme never looks authoritative.
        case "$value" in
          *light:* | *dark:*) return 1 ;;
        esac
        ;;
    esac
  done <<< "$output"

  [ "$background_count" -eq 1 ] || return 1
  printf '%s\n' "$background"
}

tmux_supports_client_theme_hooks() {
  local version major minor

  version="$(tmux -V 2> /dev/null)"
  version="${version#tmux }"
  version="${version#next-}"
  major="${version%%.*}"
  minor="${version#*.}"
  minor="${minor%%[!0-9]*}"

  case "$major:$minor" in
    *[!0-9:]* | *: | :*) return 1 ;;
  esac
  [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 6 ]; }
}

sync_ghostty_reload_hook() {
  local hook="$1"
  local enabled="$2"
  local command='run-shell "#{@chroma_plugin_dir}/chroma.tmux"'
  local line indexed found='off'

  while IFS= read -r line; do
    case "$line" in
      "${hook}["*"] $command")
        if [ "$enabled" = 'on' ] && [ "$found" = 'off' ]; then
          found='on'
        else
          indexed="${line%% *}"
          tmux set-hook -gu "$indexed"
        fi
        ;;
    esac
  done < <(tmux show-hooks -g "$hook" 2> /dev/null)

  if [ "$enabled" = 'on' ] && [ "$found" = 'off' ]; then
    tmux set-hook -ag "$hook" "$command"
  fi
}

sync_ghostty_reload_hooks() {
  local enabled="$1"

  sync_ghostty_reload_hook client-attached "$enabled"
  sync_ghostty_reload_hook client-detached "$enabled"
  if tmux_supports_client_theme_hooks; then
    sync_ghostty_reload_hook client-light-theme "$enabled"
    sync_ghostty_reload_hook client-dark-theme "$enabled"
  fi
}

host_short() {
  local host

  host="$(tmux display-message -p '#{host_short}' 2> /dev/null)"
  if [ -n "$host" ]; then
    printf '%s\n' "$host"
  else
    hostname -s 2> /dev/null || hostname
  fi
}

seeded_preset() {
  local host="$1"
  local sum

  sum="$(printf '%s' "$host" | cksum | awk '{ print $1 }')"

  # shellcheck disable=SC2086
  set -- $PRESET_NAMES
  shift "$((sum % $#))"
  printf '%s\n' "$1"
}

resolve_preset() {
  local preset="$1"
  local host="$2"
  local name

  # 'auto' (the default) picks a stable preset from the short
  # hostname; unknown names get the same treatment.
  if [ "$preset" = 'auto' ] || [ -z "$preset" ]; then
    seeded_preset "$host"
    return
  fi

  for name in $PRESET_NAMES; do
    if [ "$name" = "$preset" ]; then
      printf '%s\n' "$preset"
      return
    fi
  done

  seeded_preset "$host"
}

# Background seeds for popular terminal themes. A name resolves to
# that theme's background color and then flows through the same
# luma classification and surface blending as a literal #rrggbb.
named_background() {
  local wanted="$1" name seed

  while read -r name seed; do
    if [ "$name" = "$wanted" ]; then
      printf '%s\n' "$seed"
      return
    fi
  done <<< "$NAMED_BACKGROUNDS"
  printf '\n'
}

preset_colors() {
  local wanted="$1" name dark light

  while read -r name dark light; do
    if [ "$name" = "$wanted" ]; then
      printf '%s %s\n' "$dark" "$light"
      return
    fi
  done <<< "$PRESETS"
  return 1
}

mode_anchors() {
  local wanted="$1" mode values

  while read -r mode values; do
    if [ "$mode" = "$wanted" ]; then
      printf '%s\n' "$values"
      return
    fi
  done <<< "$MODE_ANCHORS"
  return 1
}

mix_color() {
  local c1="${1#\#}" c2="${2#\#}" pct="$3"
  local r g b

  r=$((($((16#${c1:0:2})) * pct + $((16#${c2:0:2})) * (100 - pct)) / 100))
  g=$((($((16#${c1:2:2})) * pct + $((16#${c2:2:2})) * (100 - pct)) / 100))
  b=$((($((16#${c1:4:2})) * pct + $((16#${c2:4:2})) * (100 - pct)) / 100))

  printf '#%02x%02x%02x\n' "$r" "$g" "$b"
}

resolve_colors() {
  local preset="$1"
  local base_color="$2"
  local background="$3"
  local mode_override="$4"
  local mode='dark' accent_dark accent_light
  local seed='' hex luma r g b
  local bg bg_alt fg muted subtle border warn alert ink
  local muted_mix="$DARK_MUTED_MIX"
  local subtle_mix="$DARK_SUBTLE_MIX"

  case "$background" in
    light) mode='light' ;;
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F])
      seed="$background"
      hex="${background#\#}"
      r=$((16#${hex:0:2}))
      g=$((16#${hex:2:2}))
      b=$((16#${hex:4:2}))
      luma=$(((LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b) / LUMA_DIVISOR))
      if [ "$luma" -ge "$LUMA_LIGHT_THRESHOLD" ]; then
        mode='light'
      fi
      ;;
  esac

  # An explicit @chroma_mode wins over the background's
  # classification; the background still supplies the seed.
  case "$mode_override" in
    dark | light) mode="$mode_override" ;;
  esac

  read -r bg bg_alt fg muted subtle border warn alert ink \
    <<< "$(mode_anchors "$mode")"
  if [ "$mode" = 'light' ]; then
    muted_mix="$LIGHT_MUTED_MIX"
    subtle_mix="$LIGHT_SUBTLE_MIX"
  fi

  if [ -n "$seed" ]; then
    bg="$(mix_color "$fg" "$seed" "$SURFACE_BG_MIX")"
    bg_alt="$(mix_color "$fg" "$seed" "$SURFACE_BG_ALT_MIX")"
    border="$(mix_color "$fg" "$seed" "$SURFACE_BORDER_MIX")"
    # Text tones keep their contrast against any seed: fg stays the
    # mode anchor, and the quieter tones blend it toward the seed at
    # the per-mode ratios the anchors sit at over the default
    # surfaces (light mode needs a stronger fg share).
    muted="$(mix_color "$fg" "$seed" "$muted_mix")"
    subtle="$(mix_color "$fg" "$seed" "$subtle_mix")"
  fi

  read -r accent_dark accent_light <<< "$(preset_colors "$preset")"
  resolved_base="$accent_dark"

  if [ "$mode" = 'light' ]; then
    resolved_base="$accent_light"
  fi

  if [ -n "$base_color" ]; then
    resolved_base="$base_color"
  fi

  # Quieter tint of base, used for window flags except bell alerts.
  resolved_base_alt="$(mix_color "$resolved_base" "$bg" "$BASE_ALT_MIX")"

  resolved_preset="$preset"
  resolved_mode="$mode"
  resolved_seed="$seed"
  resolved_bg="$bg"
  resolved_bg_alt="$bg_alt"
  resolved_fg="$fg"
  resolved_muted="$muted"
  resolved_subtle="$subtle"
  resolved_border="$border"
  resolved_warn="$warn"
  resolved_alert="$alert"
  resolved_ink="$ink"
}

apply_preset() {
  resolve_colors "$@"

  set_tmux_option @chroma_current_preset "$resolved_preset"
  set_tmux_option @chroma_base "$resolved_base"
  set_tmux_option @chroma_base_alt "$resolved_base_alt"
  set_tmux_option @chroma_bg "$resolved_bg"
  set_tmux_option @chroma_bg_alt "$resolved_bg_alt"
  set_tmux_option @chroma_fg "$resolved_fg"
  set_tmux_option @chroma_muted "$resolved_muted"
  set_tmux_option @chroma_subtle "$resolved_subtle"
  set_tmux_option @chroma_border "$resolved_border"
  set_tmux_option @chroma_warn "$resolved_warn"
  set_tmux_option @chroma_alert "$resolved_alert"
  set_tmux_option @chroma_ink "$resolved_ink"
  set_tmux_option @chroma_dark "$resolved_ink"
  set_tmux_option @chroma_current_mode "$resolved_mode"
}

dump_colors() {
  local mode bg bg_alt fg muted subtle border warn alert ink
  local name dark light seed comma=''

  printf '{\n  "schemaVersion": 1,\n  "modes": {\n'
  while read -r mode bg bg_alt fg muted subtle border warn alert ink; do
    printf '%s    "%s": {\n' "$comma" "$mode"
    printf '      "bg": "%s",\n      "bgAlt": "%s",\n' "$bg" "$bg_alt"
    printf '      "fg": "%s",\n      "muted": "%s",\n' "$fg" "$muted"
    printf '      "subtle": "%s",\n      "border": "%s",\n' \
      "$subtle" "$border"
    printf '      "warn": "%s",\n      "alert": "%s",\n' "$warn" "$alert"
    printf '      "ink": "%s"\n    }' "$ink"
    comma=$',\n'
  done <<< "$MODE_ANCHORS"
  printf '\n  },\n  "presets": [\n'
  comma=''
  while read -r name dark light; do
    printf '%s    { "name": "%s", "dark": "%s", "light": "%s" }' \
      "$comma" "$name" "$dark" "$light"
    comma=$',\n'
  done <<< "$PRESETS"
  printf '\n  ],\n  "namedBackgrounds": [\n'
  comma=''
  while read -r name seed; do
    printf '%s    { "name": "%s", "seed": "%s" }' \
      "$comma" "$name" "$seed"
    comma=$',\n'
  done <<< "$NAMED_BACKGROUNDS"
  printf '\n  ],\n  "resolution": {\n'
  printf '    "luma": { "red": %s, "green": %s, "blue": %s, ' \
    "$LUMA_RED" "$LUMA_GREEN" "$LUMA_BLUE"
  printf '"divisor": %s, "lightThreshold": %s },\n' \
    "$LUMA_DIVISOR" "$LUMA_LIGHT_THRESHOLD"
  printf '    "surfaceMix": { "bg": %s, "panel": %s, ' \
    "$SURFACE_BG_MIX" "$SURFACE_PANEL_MIX"
  printf '"bgAlt": %s, "border": %s },\n' \
    "$SURFACE_BG_ALT_MIX" "$SURFACE_BORDER_MIX"
  printf '    "textMix": {\n'
  printf '      "dark": { "muted": %s, "subtle": %s },\n' \
    "$DARK_MUTED_MIX" "$DARK_SUBTLE_MIX"
  printf '      "light": { "muted": %s, "subtle": %s }\n' \
    "$LIGHT_MUTED_MIX" "$LIGHT_SUBTLE_MIX"
  printf '    },\n    "baseAltMix": %s\n  }\n}\n' "$BASE_ALT_MIX"
}

dump_resolved_colors() {
  printf '{\n'
  printf '  "preset": "%s",\n  "mode": "%s",\n' \
    "$resolved_preset" "$resolved_mode"
  if [ -n "$resolved_seed" ]; then
    printf '  "seed": "%s",\n' "$resolved_seed"
  else
    printf '  "seed": null,\n'
  fi
  printf '  "colors": {\n'
  printf '    "base": "%s",\n    "baseAlt": "%s",\n' \
    "$resolved_base" "$resolved_base_alt"
  printf '    "bg": "%s",\n    "bgAlt": "%s",\n' \
    "$resolved_bg" "$resolved_bg_alt"
  printf '    "fg": "%s",\n    "muted": "%s",\n' \
    "$resolved_fg" "$resolved_muted"
  printf '    "subtle": "%s",\n    "border": "%s",\n' \
    "$resolved_subtle" "$resolved_border"
  printf '    "warn": "%s",\n    "alert": "%s",\n' \
    "$resolved_warn" "$resolved_alert"
  printf '    "ink": "%s"\n  }\n}\n' "$resolved_ink"
}

resolve_colors_command() {
  local preset='blue' background='dark' mode='auto' base_color=''
  local value

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --preset | --background | --mode | --base-color)
        if [ "$#" -lt 2 ]; then
          printf '%s requires a value\n' "$1" >&2
          return 2
        fi
        value="$2"
        case "$1" in
          --preset) preset="$value" ;;
          --background) background="$value" ;;
          --mode) mode="$value" ;;
          --base-color) base_color="$value" ;;
        esac
        shift 2
        ;;
      *)
        printf 'unknown --resolve-colors argument: %s\n' "$1" >&2
        return 2
        ;;
    esac
  done

  if ! preset_colors "$preset" > /dev/null; then
    printf 'unknown preset: %s\n' "$preset" >&2
    return 2
  fi
  case "$mode" in
    auto | dark | light) ;;
    *)
      printf 'mode must be auto, dark, or light: %s\n' "$mode" >&2
      return 2
      ;;
  esac
  case "$base_color" in
    '') ;;
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;;
    *)
      printf 'base color must be #rrggbb: %s\n' "$base_color" >&2
      return 2
      ;;
  esac
  case "$background" in
    dark | light) ;;
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;;
    *)
      value="$(named_background "$background")"
      if [ -z "$value" ]; then
        printf 'unknown background: %s\n' "$background" >&2
        return 2
      fi
      background="$value"
      ;;
  esac

  resolve_colors "$preset" "$base_color" "$background" "$mode"
  dump_resolved_colors
}

segment() {
  local fg="$1"
  local bg="$2"
  local text="$3"

  printf '#[fg=%s]#[bg=%s]%s' "$fg" "$bg" "$text"
}

powerline_divider() {
  local from="$1"
  local to="$2"
  local glyph="$3"
  local divider

  if [ "$glyph" = '' ]; then
    divider="$(segment "$from" "$to" "$glyph")"
  else
    divider="$(segment "$to" "$from" "$glyph")"
  fi

  printf '%s%s%s' \
    "$(segment "$from" "$from" ' ')" \
    "$divider" \
    "$(segment "$to" "$to" ' ')"
}

main() {
  local host preset requested_preset base_color background mode_override
  local configured_background detect_ghostty detected_background
  local background_source
  local host_label left_extra right_extra clock_format clock_min_width
  local powerline
  local interval
  local show_cpu show_memory show_disk disk_path
  local bg bg_alt fg muted subtle border base base_alt warn alert ink
  local cpu memory disk metrics metric_sep sync_on sync_render
  local prefix prefix_on prefix_off left right clock wide tail tail_bg
  local window_flags

  host="$(host_short)"
  requested_preset="$(get_tmux_option @chroma_preset)"
  preset="$(resolve_preset "$requested_preset" "$host")"
  base_color="$(get_tmux_option @chroma_base_color)"
  configured_background="$(get_tmux_option @chroma_background)"
  normalize_configured_background "$configured_background"
  background="$resolved_background"
  background_source="$resolved_background_source"
  detect_ghostty="$(default_tmux_option \
    @chroma_detect_ghostty_background 'off')"
  [ "$detect_ghostty" = 'on' ] || detect_ghostty='off'
  if [ "$detect_ghostty" = 'on' ]; then
    detected_background="$(detect_ghostty_background)" || detected_background=''
    if [ -n "$detected_background" ]; then
      background="$detected_background"
      background_source='ghostty'
    fi
  fi
  mode_override="$(default_tmux_option @chroma_mode 'auto')"

  case "$mode_override" in
    dark | light) ;;
    *) mode_override='auto' ;;
  esac

  # mix_color needs a full #rrggbb value; ignore anything else.
  case "$base_color" in
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;;
    *) base_color='' ;;
  esac

  apply_preset "$preset" "$base_color" "$background" "$mode_override"
  set_tmux_option @chroma_version "$CHROMA_VERSION"
  set_tmux_option @chroma_current_background "$background"
  set_tmux_option @chroma_current_background_source "$background_source"
  set_tmux_option @chroma_plugin_dir "$CURRENT_DIR"
  sync_ghostty_reload_hooks "$detect_ghostty"

  host_label="$(default_tmux_option @chroma_host_label '#H')"
  left_extra="$(get_tmux_option @chroma_left_extra)"
  right_extra="$(get_tmux_option @chroma_right_extra)"
  clock_format="$(default_tmux_option @chroma_clock_format '%H:%M')"
  clock_min_width="$(default_tmux_option @chroma_clock_min_width '91')"
  powerline="$(default_tmux_option @chroma_powerline 'off')"
  interval="$(default_tmux_option @chroma_status_interval '5')"
  show_cpu="$(default_tmux_option @chroma_show_cpu 'on')"
  show_memory="$(default_tmux_option @chroma_show_memory 'on')"
  show_disk="$(default_tmux_option @chroma_show_disk 'off')"
  disk_path="$(default_tmux_option @chroma_disk_path '/')"

  bg="$(get_tmux_option @chroma_bg)"
  bg_alt="$(get_tmux_option @chroma_bg_alt)"
  fg="$(get_tmux_option @chroma_fg)"
  muted="$(get_tmux_option @chroma_muted)"
  subtle="$(get_tmux_option @chroma_subtle)"
  border="$(get_tmux_option @chroma_border)"
  base="$(get_tmux_option @chroma_base)"
  base_alt="$(get_tmux_option @chroma_base_alt)"
  warn="$(get_tmux_option @chroma_warn)"
  alert="$(get_tmux_option @chroma_alert)"
  ink="$(get_tmux_option @chroma_ink)"

  # Unquoted echo flattens the newline in PRESET_NAMES to a space.
  # shellcheck disable=SC2086,SC2116
  set_tmux_option @chroma_preset_names "$(echo $PRESET_NAMES)"

  cpu="#($CURRENT_DIR/scripts/cpu)"
  memory="#($CURRENT_DIR/scripts/memory)"
  disk="#($CURRENT_DIR/scripts/disk '$disk_path')"
  metric_sep="$(segment "$muted" "$bg_alt" '∙')"

  # The invisible bg-on-bg placeholder keeps the centred window list
  # from shifting every time the prefix indicator flashes on.
  if [ "$powerline" = 'on' ]; then
    prefix_on="$(segment "$warn" "$bg" '∙ ')"
    prefix_off="$(segment "$bg" "$bg" '∙ ')"
  else
    prefix_on="$(segment "$warn" "$bg_alt" '∙ ')"
    prefix_off="$(segment "$bg" "$bg" '∙ ')"
  fi
  prefix="#{?client_prefix,$prefix_on,$prefix_off}"
  if [ "$powerline" = 'on' ]; then
    sync_on="$(segment "$ink" "$alert" ' SYNC  ')"
  else
    sync_on="$(segment "$ink" "$alert" ' SYNC ')"
  fi
  set_tmux_option @chroma_sync_on "$sync_on"
  set_tmux_option @chroma_sync_off ''

  # Commas would split the surrounding #{?...} conditional; tmux turns
  # #, back into a literal comma at display time.
  if [ "$powerline" = 'on' ]; then
    clock="$(segment "$ink" "$base" " ${clock_format//,/#,}  ")"
  else
    clock="$(segment "$ink" "$base" " ${clock_format//,/#,} ")"
  fi
  wide="#{e|>=:#{client_width},$clock_min_width}"

  if [ "$powerline" = 'on' ]; then
    left="$(segment "$ink" "$base" "  $host_label ")"
    left="$left$(powerline_divider "$base" "$bg_alt" '')"
  else
    left="$(segment "$ink" "$base" " $host_label ")"
  fi
  left="$left$(segment "$fg" "$bg_alt" ' #S ')"

  if [ "$powerline" != 'on' ]; then
    left="$left$prefix"
  fi

  if [ -n "$left_extra" ]; then
    left="$left$(segment "$fg" "$bg_alt" " $left_extra ")"
  fi

  if [ "$powerline" = 'on' ]; then
    left="$left$(powerline_divider "$bg_alt" "$bg" '')"
    left="$left$prefix"
  fi

  right=''

  if [ -n "$right_extra" ]; then
    right="$right$(segment "$fg" "$bg_alt" " $right_extra ")"
  fi

  metrics=''

  if [ "$show_cpu" = 'on' ]; then
    metrics="$(segment "$fg" "$bg_alt" " CPU $cpu ")"
  fi

  if [ "$show_memory" = 'on' ]; then
    if [ -n "$metrics" ]; then
      metrics="$metrics$metric_sep"
    fi
    metrics="$metrics$(segment "$fg" "$bg_alt" " MEM $memory ")"
  fi

  if [ "$show_disk" = 'on' ]; then
    if [ -n "$metrics" ]; then
      metrics="$metrics$metric_sep"
    fi
    metrics="$metrics$(segment "$fg" "$bg_alt" " $disk_path $disk ")"
  fi

  right="$right$metrics"

  if [ -n "$right" ]; then
    tail_bg="$bg_alt"
    if [ "$powerline" = 'on' ]; then
      right="$(powerline_divider "$bg" "$bg_alt" '')$right"
    fi
  else
    tail_bg="$bg"
  fi

  sync_render="$sync_on"
  if [ "$powerline" = 'on' ]; then
    clock="$(powerline_divider "$tail_bg" "$base" '')$clock"
    sync_render="$(powerline_divider "$tail_bg" "$alert" '')$sync_on"
  fi

  # SYNC takes over the clock slot while panes are synchronized (at any
  # width); the clock itself only renders on clients wide enough.
  tail="#{?pane_synchronized,$sync_render,#{?$wide,$clock,}}"
  right="$right$tail"

  # Keep alert tabs in the neutral inactive palette. Bell flags use the alert
  # color; all other window flags use the quieter accent.
  window_flags="#{?window_bell_flag,#[fg=$alert]!,#[fg=$base_alt]#F}"

  set_tmux_option status on
  set_tmux_option status-interval "$interval"
  set_tmux_option status-left-length 80
  set_tmux_option status-right-length 140
  set_tmux_option status-justify centre
  set_tmux_option status-style "fg=$fg,bg=$bg"
  set_tmux_option status-left-style "fg=$fg,bg=$bg"
  set_tmux_option status-right-style "fg=$fg,bg=$bg"
  set_tmux_option message-style "fg=$ink,bg=$warn"
  set_tmux_option mode-style "fg=$ink,bg=$base"
  set_tmux_option pane-border-style "fg=$border"
  set_tmux_option pane-active-border-style "fg=$base"
  set_tmux_option window-status-separator ''
  set_tmux_option window-status-style "fg=$subtle,bg=$bg"
  set_tmux_option window-status-current-style "fg=$base,bg=$bg"
  set_tmux_option window-status-bell-style "fg=$muted,bg=$bg"
  set_tmux_option window-status-activity-style "fg=$muted,bg=$bg"
  set_tmux_option window-status-format " #I:#W$window_flags "
  set_tmux_option window-status-current-format " #I:#W$window_flags "
  set_tmux_option status-left "$left#[default]"
  set_tmux_option status-right "$right#[default]"
}

case "${1-}" in
  --version)
    if [ "$#" -ne 1 ]; then
      printf '%s takes no arguments\n' "$1" >&2
      exit 2
    fi
    printf 'chroma %s\n' "$CHROMA_VERSION"
    ;;
  --dump-colors)
    if [ "$#" -ne 1 ]; then
      printf '%s takes no arguments\n' "$1" >&2
      exit 2
    fi
    dump_colors
    ;;
  --resolve-colors)
    shift
    resolve_colors_command "$@"
    ;;
  '') main ;;
  *)
    printf 'unknown argument: %s\n' "$1" >&2
    exit 2
    ;;
esac
