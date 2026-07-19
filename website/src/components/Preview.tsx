import type { JSX } from 'preact';
import { mixColor } from '../color.ts';
import {
  anchors,
  presetAccent,
  presets,
  resolution,
} from '../presets.ts';
import { previewOpen, resolveBackground } from '../state.ts';
import { StatusBar, type StatusWindowItem } from './StatusBar.tsx';
import { StatusOverlay } from './StatusOverlay.tsx';

interface PreviewBackground {
  name: string;
  label: string;
  accent: string;
}

const backgrounds: PreviewBackground[] = [
  { name: 'dark', label: 'dark', accent: 'peach' },
  { name: 'light', label: 'light', accent: 'blue' },
  {
    name: 'solarized-dark',
    label: 'solarized dark',
    accent: 'green',
  },
  {
    name: 'solarized-light',
    label: 'solarized light',
    accent: 'mauve',
  },
];

const previewWindows: StatusWindowItem[] = [
  { key: 'zsh', text: '1:zsh' },
  { key: 'vim', text: '2:vim', flag: '*', current: true },
  { key: 'ssh', text: '3:ssh', flag: '#' },
  { key: 'logs', text: '4:logs', flag: '!', alert: true },
];

function backgroundStyle(
  background: PreviewBackground
): JSX.CSSProperties {
  const resolved = resolveBackground(background.name);
  const mode = anchors[resolved.mode];
  const custom = resolved.surfaces;
  const bar = custom?.bar ?? mode.bg;
  const previewPreset = presets.find(
    (item) => item.name === background.accent
  );
  if (!previewPreset) {
    throw new Error('Unknown preview accent: ' + background.accent);
  }
  const accent = presetAccent(previewPreset, resolved.mode);

  return {
    '--preview-background': resolved.seed ??
      `var(--canvas-${resolved.mode})`,
    '--bar': bar,
    '--panel-raised': custom?.panelRaised ?? mode.bgAlt,
    '--line': custom?.line ?? mode.border,
    '--text': mode.fg,
    '--muted': custom?.muted ?? mode.muted,
    '--subtle': custom?.subtle ?? mode.subtle,
    '--warn': mode.warn,
    '--alert': mode.alert,
    '--ink': mode.ink,
    '--accent': accent,
    '--accent-alt': mixColor(
      accent,
      bar,
      resolution.baseAltMix
    ),
  };
}

function PreviewBar({ powerline }: { powerline: boolean }) {
  return (
    <StatusBar
      class="preview-bar"
      host="chroma"
      powerline={powerline}
      prefixActive={false}
      syncActive={false}
      metrics={['CPU 12%', 'MEM 64%']}
      windows={previewWindows}
    />
  );
}

/**
 * Render the deterministic prefix+p screenshot stage.
 *
 * Two complementary accent pairs span four background resolutions,
 * with block and Powerline stacked so only the status style changes
 * within each tile.
 */
export function Preview() {
  const open = previewOpen.value;

  return (
    <StatusOverlay
      open={open}
      class="status-preview"
      popupClass="preview-popup"
      ariaLabel="Chroma preview across four backgrounds and two styles"
      onClose={() => {
        previewOpen.value = false;
      }}
    >
      <header class="preview-heading">
        <p class="comment preview-kicker"># chroma preview</p>
        <p class="comment preview-hint">
          four backgrounds · two status styles · press q to close
        </p>
      </header>
      <div class="preview-grid">
        {backgrounds.map((background) => (
          <section
            class="preview-theme"
            style={backgroundStyle(background)}
            key={background.name}
            aria-label={background.label + ' background'}
          >
            <header class="preview-theme-heading">
              <span>
                {background.label} · {background.accent}
              </span>
              <code>@chroma_background '{background.name}'</code>
            </header>
            <div class="preview-style">
              <span class="preview-style-label">block</span>
              <PreviewBar powerline={false} />
            </div>
            <div class="preview-style">
              <span class="preview-style-label">powerline</span>
              <PreviewBar powerline />
            </div>
          </section>
        ))}
      </div>
    </StatusOverlay>
  );
}
