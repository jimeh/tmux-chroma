import { computed, effect, signal } from '@preact/signals';
import { colorLuma, mixColor, normalizeHex } from './color.ts';
import {
  anchors,
  namedBackgroundSeed,
  presetAccent,
  presetForHost,
  seededPreset,
  type Preset,
  type ThemeMode,
} from './presets.ts';

export interface PageWindow {
  id: string;
  index: number;
}

// The page mirrors a tmux session: each section is a window in the
// status-line dock at the bottom of the viewport.
export const windows: PageWindow[] = [
  { id: 'intro', index: 1 },
  { id: 'palette', index: 2 },
  { id: 'config', index: 3 },
  { id: 'install', index: 4 },
];

// The page mirrors @chroma_background: 'dark' (the default),
// 'light', a named theme background, or a custom #rrggbb terminal
// background classified by luma like the plugin. The choice
// persists, and the same resolution runs in an inline <head> script
// so the first paint is already themed; keep the two in sync.
const backgroundStorageKey = 'chroma-background';

function storedBackground(): string {
  try {
    const value = localStorage.getItem(backgroundStorageKey) ?? '';
    return value === 'light' || value === 'dark' ||
        namedBackgroundSeed(value) || normalizeHex(value)
      ? value
      : 'dark';
  } catch (_error) {
    return 'dark';
  }
}

export const background = signal<string>(storedBackground());

export function setBackground(next: string): void {
  background.value = next;
  try {
    localStorage.setItem(backgroundStorageKey, next);
  } catch (_error) {
    // Private browsing without storage: the choice lasts the visit.
  }
}

export const backgroundSeed = computed<string | null>(() => {
  const value = background.value;
  if (value === 'dark' || value === 'light') {
    return null;
  }
  return namedBackgroundSeed(value) ?? value;
});

// A custom seed resolves to the mode its perceived luma classifies
// it as: >= 130 is light, exactly like the plugin.
export const theme = computed<ThemeMode>(() => {
  const seed = backgroundSeed.value;
  if (seed) {
    return colorLuma(seed) >= 130 ? 'light' : 'dark';
  }
  return background.value === 'light' ? 'light' : 'dark';
});

// Mirrors the plugin's custom-seed derivation: the terminal
// background is the seed itself, the bar surfaces blend the mode's
// fg toward it (bg at 10, bg_alt at 16, border at 27 percent;
// panel is the site-only mid-step between bar and bg_alt), and the
// quieter text tones blend fg toward the seed so they keep their
// contrast against any background.
export interface Surfaces {
  canvas: string;
  bar: string;
  panel: string;
  panelRaised: string;
  line: string;
  muted: string;
  subtle: string;
}

export const surfaces = computed<Surfaces | null>(() => {
  const seed = backgroundSeed.value;
  if (!seed) {
    return null;
  }
  const fg = anchors[theme.value].fg;
  // Light mode needs a stronger fg share for the quieter tones,
  // matching where its anchors sit over the default surfaces.
  const mutedMix = theme.value === 'light' ? 80 : 60;
  const subtleMix = theme.value === 'light' ? 62 : 45;
  return {
    canvas: seed,
    bar: mixColor(fg, seed, 10),
    panel: mixColor(fg, seed, 13),
    panelRaised: mixColor(fg, seed, 16),
    line: mixColor(fg, seed, 27),
    muted: mixColor(fg, seed, mutedMix),
    subtle: mixColor(fg, seed, subtleMix),
  };
});

// The active status-bar background: derived from a custom seed, or
// the mode's anchor.
export const barColor = computed(() => (
  surfaces.value?.bar ?? anchors[theme.value].bg
));

export const preset = signal<Preset>(seededPreset());
export const auto = signal(true);
export const powerline = signal(false);
export const showCpu = signal(true);
export const showMemory = signal(true);
export const showDisk = signal(false);
export const prefix = signal(false);
export const sync = signal(false);
export const currentWindow = signal(windows[0].id);
export const lastWindow = signal<string | null>(null);
export const galleryOpen = signal(false);
export const booting = signal(true);
export const autoHost = signal('');
export const clockText = signal(formatClock());

// The accent the current mode resolves to: the light column in
// light mode, base otherwise, exactly like the plugin.
export const accent = computed(() => (
  presetAccent(preset.value, theme.value)
));

// The quieter companion color is derived by blending the accent
// toward the active bar background, exactly like the plugin.
export const accentAlt = computed(() => (
  mixColor(accent.value, barColor.value, 60)
));

// The auto-host preview swatch keeps showing the last auto result
// while a manual preset is selected, so it only follows the accent
// in auto mode.
const autoPreviewPreset = signal(preset.value);
effect(() => {
  if (auto.value) {
    autoPreviewPreset.value = preset.value;
  }
});
export const autoPreviewBase = computed(() => (
  presetAccent(autoPreviewPreset.value, theme.value)
));

export function selectPreset(next: Preset): void {
  auto.value = false;
  preset.value = next;
}

// Typing a hostname is an auto-mode action: it re-selects auto and
// previews the preset the plugin would pick for that host.
export function selectAuto(): void {
  auto.value = true;
  const host = autoHost.value.trim();
  preset.value = host ? presetForHost(host) : seededPreset();
}

// Ctrl-b or Ctrl-q arms the tmux prefix for a moment, lighting the
// dock's ∙ indicator without losing a manually toggled prefix state.
let prefixTimer: number | null = null;
let prefixRestore = false;

export function prefixArmed(): boolean {
  return prefixTimer !== null;
}

export function disarmPrefix(): void {
  if (prefixTimer === null) {
    return;
  }
  window.clearTimeout(prefixTimer);
  prefixTimer = null;
  prefix.value = prefixRestore;
}

export function armPrefix(): void {
  if (prefixTimer === null) {
    prefixRestore = prefix.value;
  } else {
    window.clearTimeout(prefixTimer);
  }
  prefix.value = true;
  prefixTimer = window.setTimeout(disarmPrefix, 1500);
}

function formatClock(): string {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');
}

export function tickClock(): void {
  clockText.value = formatClock();
}
