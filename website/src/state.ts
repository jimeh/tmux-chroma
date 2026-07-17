import { computed, effect, signal } from '@preact/signals';
import { colorLuma, mixColor, normalizeHex } from './color.ts';
import {
  anchors,
  namedBackgroundSeed,
  presetAccent,
  presetForHost,
  presets,
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

// Every value the conf block renders (plus the auto-host preview)
// persists across visits under a chroma-* key, stored only while it
// differs from its default — so reset is just clearing the keys.
// The background resolution also runs in an inline <head> script so
// the first paint is already themed; keep the two in sync.
const backgroundStorageKey = 'chroma-background';

function storedValue(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch (_error) {
    return '';
  }
}

function persistValue(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch (_error) {
    // Private browsing without storage: choices last the visit.
  }
}

function storedBackground(): string {
  const value = storedValue(backgroundStorageKey);
  return value === 'light' || value === 'dark' ||
      namedBackgroundSeed(value) || normalizeHex(value)
    ? value
    : 'dark';
}

export const background = signal<string>(storedBackground());

export function setBackground(next: string): void {
  background.value = next;
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

// A persisted accent choice survives reloads: a preset name, a
// custom #rrggbb, or the auto default (seeded by a persisted host
// when one was typed).
function initialAccent(): { auto: boolean; preset: Preset } {
  const stored = storedValue('chroma-preset');
  const named = presets.find((item) => item.name === stored);
  if (named) {
    return { auto: false, preset: named };
  }
  const hex = normalizeHex(stored);
  if (hex) {
    return { auto: false, preset: { name: 'custom', base: hex } };
  }
  const host = storedValue('chroma-host').trim();
  return { auto: true, preset: host ? presetForHost(host) : seededPreset() };
}

const initial = initialAccent();
export const preset = signal<Preset>(initial.preset);
export const auto = signal(initial.auto);
export const powerline = signal(storedValue('chroma-powerline') === 'on');
export const showCpu = signal(storedValue('chroma-show-cpu') !== 'off');
export const showMemory = signal(
  storedValue('chroma-show-memory') !== 'off'
);
export const showDisk = signal(storedValue('chroma-show-disk') === 'on');
export const prefix = signal(false);
export const sync = signal(false);
export const currentWindow = signal(windows[0].id);
export const lastWindow = signal<string | null>(null);
export const galleryOpen = signal(false);
export const booting = signal(true);
export const autoHost = signal(storedValue('chroma-host'));
export const clockText = signal(formatClock());

// Persist each conf value only while it differs from its default.
effect(() => {
  persistValue(backgroundStorageKey,
    background.value === 'dark' ? null : background.value);
});
effect(() => {
  persistValue('chroma-preset',
    auto.value
      ? null
      : preset.value.name === 'custom'
        ? preset.value.base
        : preset.value.name);
});
effect(() => {
  persistValue('chroma-host', autoHost.value.trim() || null);
});
effect(() => {
  persistValue('chroma-powerline', powerline.value ? 'on' : null);
});
effect(() => {
  persistValue('chroma-show-cpu', showCpu.value ? null : 'off');
});
effect(() => {
  persistValue('chroma-show-memory', showMemory.value ? null : 'off');
});
effect(() => {
  persistValue('chroma-show-disk', showDisk.value ? 'on' : null);
});

// True while any persisted conf value differs from its default;
// the conf block offers a reset link only then.
export const configDirty = computed(() => (
  background.value !== 'dark' || !auto.value ||
  autoHost.value.trim() !== '' || powerline.value ||
  !showCpu.value || !showMemory.value || showDisk.value
));

export function resetConfig(): void {
  background.value = 'dark';
  powerline.value = false;
  showCpu.value = true;
  showMemory.value = true;
  showDisk.value = false;
  autoHost.value = '';
  selectAuto();
}

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
