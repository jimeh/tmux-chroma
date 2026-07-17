import { colorHue } from './color.ts';

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

// The neutral anchors per mode, duplicated from chroma.tmux (the
// CSS carries most of them again as custom properties for styling);
// test/palette-sync.sh diffs every role against the plugin. They
// feed the palette readout and the custom-seed derivation.
export const anchors: Record<ThemeMode, ModeAnchors> = {
  dark: {
    bg: '#15181d',
    bgAlt: '#20242b',
    fg: '#d7dde7',
    muted: '#8b96a8',
    subtle: '#6f7a8d',
    border: '#343a44',
    warn: '#eed49f',
    alert: '#ed8796',
    ink: '#101216',
  },
  light: {
    bg: '#e9ecf2',
    bgAlt: '#dde1e9',
    fg: '#3c4354',
    muted: '#5c6678',
    subtle: '#767f93',
    border: '#c4cad6',
    warn: '#b89651',
    alert: '#ad4352',
    ink: '#f4f6fa',
  },
};

// Preset names, both accent columns, and the base_alt mix formula
// are duplicated from chroma.tmux. Update them together and run
// `make test`; test/palette-sync.sh diffs the palettes.
export const presets: Preset[] = [
  { name: 'blue', base: '#8aadf4', light: '#3f68bb' },
  { name: 'peach', base: '#f5a97f', light: '#b5663a' },
  { name: 'teal', base: '#8bd5ca', light: '#4f8d83' },
  { name: 'mauve', base: '#c6a0f6', light: '#824ec3' },
  { name: 'green', base: '#a6da95', light: '#649753' },
  { name: 'lavender', base: '#b7bdf8', light: '#616bc9' },
  { name: 'sapphire', base: '#7dc4e4', light: '#437f9a' },
  { name: 'pink', base: '#f5bde6', light: '#c569ac' },
  { name: 'yellow', base: '#eed49f', light: '#b89651' },
  { name: 'maroon', base: '#ee99a0', light: '#b74b54' },
  { name: 'lime', base: '#c8dd88', light: '#83964b' },
  { name: 'ash', base: '#a5adcb', light: '#636b89' },
  { name: 'red', base: '#ed8796', light: '#ad4352' },
  { name: 'orchid', base: '#e38dcd', light: '#a04b8b' },
  { name: 'jade', base: '#8cd9b3', light: '#4e9271' },
  { name: 'plum', base: '#d290df', light: '#8f4e9c' },
  { name: 'purple', base: '#ba91d8', light: '#775293' },
  { name: 'rosewater', base: '#f4dbd6', light: '#bc8176' },
  { name: 'flamingo', base: '#f0c6c6', light: '#bd7575' },
  { name: 'sky', base: '#91d7e3', light: '#4d96a2' },
  { name: 'gold', base: '#efbc88', light: '#b17a42' },
  { name: 'cornflower', base: '#83baee', light: '#4078ac' },
];

// Mirrors the plugin's accent resolution: light mode swaps in the
// light column, while a custom accent (no light variant) stays
// verbatim in both modes.
export function presetAccent(preset: Preset, mode: ThemeMode): string {
  return mode === 'light' && preset.light ? preset.light : preset.base;
}

// Background seeds for popular terminal themes, duplicated from
// named_background in chroma.tmux (the inline pre-paint script in
// index.html carries a third copy); test/palette-sync.sh diffs all
// three. A name resolves to that theme's background color and then
// behaves like the matching custom #rrggbb.
export const namedBackgrounds: Array<{ name: string; seed: string }> = [
  { name: 'solarized-light', seed: '#fdf6e3' },
  { name: 'solarized-dark', seed: '#002b36' },
  { name: 'tomorrow', seed: '#ffffff' },
  { name: 'tomorrow-night', seed: '#1d1f21' },
  { name: 'gruvbox-light', seed: '#fbf1c7' },
  { name: 'gruvbox-dark', seed: '#282828' },
  { name: 'one-light', seed: '#fafafa' },
  { name: 'one-dark', seed: '#282c34' },
  { name: 'catppuccin-latte', seed: '#eff1f5' },
  { name: 'catppuccin-frappe', seed: '#303446' },
  { name: 'catppuccin-macchiato', seed: '#24273a' },
  { name: 'catppuccin-mocha', seed: '#1e1e2e' },
  { name: 'everforest-light', seed: '#fdf6e0' },
  { name: 'everforest-dark', seed: '#2d353b' },
  { name: 'rose-pine-dawn', seed: '#faf4ed' },
  { name: 'rose-pine', seed: '#191724' },
  { name: 'github-light', seed: '#ffffff' },
  { name: 'github-dark', seed: '#0d1117' },
  { name: 'dracula', seed: '#282a36' },
  { name: 'nord', seed: '#2e3440' },
  { name: 'monokai', seed: '#272822' },
  { name: 'tokyo-night', seed: '#1a1b26' },
];

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
