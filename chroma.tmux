#!/usr/bin/env bash

set -u

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PRESET_NAMES='blue peach teal mauve green lavender sapphire pink yellow maroon
lime ash red orchid jade plum purple rosewater flamingo sky gold cornflower'

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

mix_color() {
  local c1="${1#\#}" c2="${2#\#}" pct="$3"
  local r g b

  r=$((($((16#${c1:0:2})) * pct + $((16#${c2:0:2})) * (100 - pct)) / 100))
  g=$((($((16#${c1:2:2})) * pct + $((16#${c2:2:2})) * (100 - pct)) / 100))
  b=$((($((16#${c1:4:2})) * pct + $((16#${c2:4:2})) * (100 - pct)) / 100))

  printf '#%02x%02x%02x\n' "$r" "$g" "$b"
}

apply_preset() {
  local preset="$1"
  local base_color="$2"
  local background="$3"
  local mode='dark'
  local seed='' hex luma r g b
  local bg='#15181d'
  local bg_alt='#20242b'
  local fg='#d7dde7'
  local muted='#8b96a8'
  local subtle='#6f7a8d'
  local border='#343a44'
  local base='#8aadf4'
  local light='#1e66f5'
  local base_alt
  local warn='#eed49f'
  local alert='#ed8796'
  local ink='#101216'

  case "$background" in
    light) mode='light' ;;
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F])
      seed="$background"
      hex="${background#\#}"
      r=$((16#${hex:0:2}))
      g=$((16#${hex:2:2}))
      b=$((16#${hex:4:2}))
      luma=$(((299 * r + 587 * g + 114 * b) / 1000))
      if [ "$luma" -ge 128 ]; then
        mode='light'
      fi
      ;;
  esac

  if [ "$mode" = 'light' ]; then
    bg='#e9ecf2'
    bg_alt='#dde1e9'
    fg='#3c4354'
    muted='#5c6678'
    subtle='#767f93'
    border='#c4cad6'
    warn='#df8e1d'
    alert='#d20f39'
    ink='#f4f6fa'
  fi

  if [ -n "$seed" ]; then
    bg="$(mix_color "$fg" "$seed" 10)"
    bg_alt="$(mix_color "$fg" "$seed" 16)"
    border="$(mix_color "$fg" "$seed" 27)"
  fi

  case "$preset" in
    blue) base='#8aadf4' light='#1e66f5' ;;
    peach) base='#f5a97f' light='#fe640b' ;;
    teal) base='#8bd5ca' light='#179299' ;;
    mauve) base='#c6a0f6' light='#8839ef' ;;
    green) base='#a6da95' light='#40a02b' ;;
    lavender) base='#b7bdf8' light='#7287fd' ;;
    sapphire) base='#7dc4e4' light='#209fb5' ;;
    pink) base='#f5bde6' light='#ea76cb' ;;
    yellow) base='#eed49f' light='#df8e1d' ;;
    maroon) base='#ee99a0' light='#e64553' ;;
    lime) base='#c8dd88' light='#7ba013' ;;
    ash) base='#a5adcb' light='#6f7d9c' ;;
    red) base='#ed8796' light='#d20f39' ;;
    orchid) base='#e38dcd' light='#c13da6' ;;
    jade) base='#8cd9b3' light='#179b6e' ;;
    plum) base='#d290df' light='#a640b8' ;;
    purple) base='#ba91d8' light='#7b52ab' ;;
    rosewater) base='#f4dbd6' light='#dc8a78' ;;
    flamingo) base='#f0c6c6' light='#dd7878' ;;
    sky) base='#91d7e3' light='#04a5e5' ;;
    gold) base='#efbc88' light='#b0771c' ;;
    cornflower) base='#83baee' light='#3d74d8' ;;
  esac

  if [ "$mode" = 'light' ]; then
    base="$light"
  fi

  if [ -n "$base_color" ]; then
    base="$base_color"
  fi

  # Quieter tint of base, used for window flags except bell alerts.
  base_alt="$(mix_color "$base" "$bg" 60)"

  set_tmux_option @chroma_current_preset "$preset"
  set_tmux_option @chroma_base "$base"
  set_tmux_option @chroma_base_alt "$base_alt"
  set_tmux_option @chroma_bg "$bg"
  set_tmux_option @chroma_bg_alt "$bg_alt"
  set_tmux_option @chroma_fg "$fg"
  set_tmux_option @chroma_muted "$muted"
  set_tmux_option @chroma_subtle "$subtle"
  set_tmux_option @chroma_border "$border"
  set_tmux_option @chroma_warn "$warn"
  set_tmux_option @chroma_alert "$alert"
  set_tmux_option @chroma_ink "$ink"
  set_tmux_option @chroma_dark "$ink"
  set_tmux_option @chroma_current_mode "$mode"
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
  local host preset requested_preset base_color background
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
  background="$(default_tmux_option @chroma_background 'dark')"

  # mix_color needs a full #rrggbb value; ignore anything else.
  case "$base_color" in
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;;
    *) base_color='' ;;
  esac

  case "$background" in
    dark | light) ;;
    '#'[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;;
    *) background='dark' ;;
  esac

  apply_preset "$preset" "$base_color" "$background"

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

  set_tmux_option @chroma_plugin_dir "$CURRENT_DIR"
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

main
