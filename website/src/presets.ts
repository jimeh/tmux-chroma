import { colorHue } from './color.ts';

export interface Preset {
  name: string;
  base: string;
}

// Preset names, base colors, and the base_alt mix formula are
// duplicated from chroma.tmux. Update them together and run
// `make test`; test/palette-sync.sh diffs the two lists.
export const presets: Preset[] = [
  { name: 'blue', base: '#8aadf4' },
  { name: 'peach', base: '#f5a97f' },
  { name: 'teal', base: '#8bd5ca' },
  { name: 'mauve', base: '#c6a0f6' },
  { name: 'green', base: '#a6da95' },
  { name: 'lavender', base: '#b7bdf8' },
  { name: 'sapphire', base: '#7dc4e4' },
  { name: 'pink', base: '#f5bde6' },
  { name: 'yellow', base: '#eed49f' },
  { name: 'maroon', base: '#ee99a0' },
  { name: 'lime', base: '#c8dd88' },
  { name: 'ash', base: '#a5adcb' },
  { name: 'red', base: '#ed8796' },
  { name: 'orchid', base: '#e38dcd' },
  { name: 'jade', base: '#8cd9b3' },
  { name: 'plum', base: '#d290df' },
  { name: 'purple', base: '#ba91d8' },
  { name: 'rosewater', base: '#f4dbd6' },
  { name: 'flamingo', base: '#f0c6c6' },
  { name: 'sky', base: '#91d7e3' },
  { name: 'gold', base: '#efbc88' },
  { name: 'cornflower', base: '#83baee' },
];

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
