import { computed, effect, signal } from '@preact/signals';
import { mixColor } from './color.ts';
import { presetForHost, seededPreset, type Preset } from './presets.ts';

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

// The quieter companion color is derived by blending the accent
// toward Chroma's bar background, exactly like the plugin.
export const accentAlt = computed(() => (
  mixColor(preset.value.base, '#15181d', 60)
));

// The auto-host preview swatch keeps showing the last auto result
// while a manual preset is selected, so it only follows the accent
// in auto mode.
export const autoPreviewBase = signal(preset.value.base);
effect(() => {
  if (auto.value) {
    autoPreviewBase.value = preset.value.base;
  }
});

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
