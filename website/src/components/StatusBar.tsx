import type { JSX } from 'preact';
import { clockText } from '../state.ts';

// Segment spacing comes from literal space characters in the strings
// below (white-space: pre), never CSS padding, mirroring tmux cell
// geometry. Keep colors, spaces, and glyphs in sync with chroma.tmux.

export interface StatusWindowItem {
  key: string;
  text: string;
  nameSuffix?: string;
  flag?: string;
  alert?: boolean;
  current?: boolean;
  onSelect?: () => void;
}

export interface StatusBarProps {
  host: string;
  powerline: boolean;
  prefixActive: boolean;
  syncActive: boolean;
  metrics: string[];
  windows: StatusWindowItem[];
  class?: string;
  style?: JSX.CSSProperties;
}

function DividerGlyph({ direction }: { direction: 'forward' | 'reverse' }) {
  // The triangle keeps its full-height base on the viewport edge
  // and extends a rectangle past it, clipped away. Painted exactly
  // on the edge, the base antialiases against the glyph background
  // and shows a hairline seam; simply overshooting the base
  // corners instead would narrow them along the diagonals and
  // detach the triangle from the neighboring segment's corners.
  const points =
    direction === 'forward'
      ? '-0.1,0 0,0 1,0.5 0,1 -0.1,1'
      : '1.1,0 1,0 0,0.5 1,1 1.1,1';
  return (
    <svg
      class="powerline-glyph"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points={points} />
    </svg>
  );
}

// Powerline dividers occupy three character cells: a space in the
// leading segment's color, the glyph, a space in the trailing one.
function Divider({
  name,
  direction,
  tailColor,
}: {
  name: string;
  direction: 'forward' | 'reverse';
  tailColor?: string;
}) {
  return (
    <span
      class={'powerline-divider is-' + direction + ' ' + name}
      style={tailColor ? { '--tail-color': tailColor } : undefined}
    >
      <span class="powerline-space is-before"> </span>
      <DividerGlyph direction={direction} />
      <span class="powerline-space is-after"> </span>
    </span>
  );
}

// One window entry; the dock passes onSelect and renders buttons,
// while screenshot panels leave it unset and render inert spans.
function WindowItem({ item }: { item: StatusWindowItem }) {
  const className = 'status-window' + (item.current ? ' is-current' : '');
  const content = (
    <>
      {' ' + item.text}
      {item.nameSuffix ? (
        <span class="status-window-name">{item.nameSuffix}</span>
      ) : null}
      {item.flag ? (
        <span class={'flag' + (item.alert ? ' is-alert' : '')}>
          {item.flag}
        </span>
      ) : null}{' '}
    </>
  );
  if (!item.onSelect) {
    return <span class={className}>{content}</span>;
  }
  return (
    <button
      class={className}
      type="button"
      data-window={item.key}
      aria-current={item.current ? 'true' : undefined}
      onClick={item.onSelect}
    >
      {content}
    </button>
  );
}

// A full status line. Renders both the interactive dock and the
// screenshot panels' static previews; keyed window items let
// Preact update segments in place, so a focused window button
// survives re-renders.
export function StatusBar({
  host,
  powerline,
  prefixActive,
  syncActive,
  metrics,
  windows,
  class: extraClass,
  style,
}: StatusBarProps) {
  const tail = syncActive ? 'SYNC' : clockText.value;
  // The themed variables resolve per mode (and per screenshot bar,
  // where the palette may be overridden inline).
  const tailColor = syncActive ? 'var(--alert)' : 'var(--accent)';
  return (
    <div
      class={'statusbar' + (extraClass ? ' ' + extraClass : '')}
      style={style}
    >
      <span class="status-segment status-host">
        {powerline ? '  ' + host + ' ' : ' ' + host + ' '}
      </span>
      {powerline ? (
        <Divider name="divider-forward" direction="forward" />
      ) : null}
      <span class="status-segment status-session">{' docs '}</span>
      {powerline ? <Divider name="divider-to-bar" direction="forward" /> : null}
      {!powerline ? (
        <span class={'status-session-gap' + (prefixActive ? ' is-active' : '')}>
          {' '}
        </span>
      ) : null}
      <span
        class={
          'status-segment status-prefix' +
          (prefixActive ? ' is-active' : '') +
          (powerline ? ' is-powerline' : '')
        }
      >
        {'∙ '}
      </span>
      <span class="status-spacer" />
      <span class="status-segment status-windows">
        {windows.map((item) => (
          <WindowItem key={item.key} item={item} />
        ))}
      </span>
      <span class="status-spacer" />
      {metrics.length ? (
        <>
          {powerline ? (
            <Divider name="divider-metrics" direction="reverse" />
          ) : null}
          <span class="status-segment status-metrics">
            {metrics.map((metric, index) => (
              <>
                {index > 0 ? <span class="metric-dot">∙</span> : null}
                <span>{' ' + metric + ' '}</span>
              </>
            ))}
          </span>
        </>
      ) : null}
      {powerline ? (
        <Divider
          name="divider-tail"
          direction="reverse"
          tailColor={tailColor}
        />
      ) : null}
      <span
        class={'status-segment status-tail' + (syncActive ? ' is-sync' : '')}
      >
        {powerline ? ' ' + tail + '  ' : ' ' + tail + ' '}
      </span>
    </div>
  );
}
