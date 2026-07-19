import { colorHue } from './color.ts';
import { colorSchema } from '../.generated/colors.ts';

export interface Preset {
  name: string;
  base: string;
  light?: string;
}

export type ThemeMode = 'dark' | 'light';

export interface ModeAnchors {
  bg: string;
  bgAlt: string;
  fg: string;
  muted: string;
  subtle: string;
  border: string;
  warn: string;
  alert: string;
  ink: string;
}

// Generated from chroma.tmux before every website command.
export const anchors: Record<ThemeMode, ModeAnchors> = colorSchema.modes;
export const resolution = colorSchema.resolution;
export const presets: Preset[] = colorSchema.presets.map((preset) => ({
  name: preset.name,
  base: preset.dark,
  light: preset.light,
}));

// Mirrors the plugin's accent resolution: light mode swaps in the
// light column, while a custom accent (no light variant) stays
// verbatim in both modes.
export function presetAccent(preset: Preset, mode: ThemeMode): string {
  return mode === 'light' && preset.light ? preset.light : preset.base;
}

export const namedBackgrounds: Array<{ name: string; seed: string }> =
  colorSchema.namedBackgrounds.map((entry) => ({ ...entry }));

export function namedBackgroundSeed(name: string): string | null {
  return namedBackgrounds.find(
    (entry) => entry.name === name
  )?.seed ?? null;
}

// The swatch grid and gallery show presets in hue order, not the
// hash-index order the plugin stores them in.
export const displayPresets: Preset[] = [...presets].sort(
  (first, second) => colorHue(first.base) - colorHue(second.base)
);

// Mirrors seeded_preset in chroma.tmux: hash a seed, index into the
// preset list. Browser traits stand in for the hostname, and the
// date and hour are folded in so the default accent differs between
// visitors and drifts over the day.
export function seededPreset(): Preset {
  const now = new Date();
  const seed = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    window.devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
  ].join('|');
  let sum = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    sum = ((sum * 33) ^ seed.charCodeAt(index)) >>> 0;
  }
  return presets[sum % presets.length];
}

// POSIX cksum, bit for bit: a non-reflected CRC-32 (polynomial
// 0x04c11db7) over the bytes, then over the byte length encoded
// least-significant octet first, ones-complemented. Must match
// the cksum call in seeded_preset in chroma.tmux exactly, so a
// hostname typed into the auto preview lands on the same preset
// the plugin picks.
export function cksum(text: string): number {
  const bytes = new TextEncoder().encode(text);
  let crc = 0;
  const feed = (byte: number): void => {
    crc = (crc ^ (byte << 24)) >>> 0;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x80000000
        ? ((crc << 1) ^ 0x04c11db7) >>> 0
        : (crc << 1) >>> 0;
    }
  };
  bytes.forEach(feed);
  for (let length = bytes.length; length > 0; length >>>= 8) {
    feed(length & 0xff);
  }
  return ~crc >>> 0;
}

// Mirrors seeded_preset: hash the short hostname (up to the
// first dot, like hostname -s) and index into the preset list.
export function presetForHost(host: string): Preset {
  const short = host.split('.')[0];
  return presets[cksum(short) % presets.length];
}
