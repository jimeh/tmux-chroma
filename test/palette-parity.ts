import { resolve } from 'node:path';
import { colorSchema } from '../website/.generated/colors.ts';
import { colorLuma, mixColor } from '../website/src/color.ts';
import {
  anchors,
  cksum,
  namedBackgroundSeed,
  presetAccent,
  presets,
  resolution,
  type ThemeMode,
} from '../website/src/presets.ts';

interface TestCase {
  preset: string;
  background: string;
  mode: 'auto' | ThemeMode;
  baseColor?: string;
}

const root = resolve(import.meta.dir, '..');
const plugin = resolve(root, 'chroma.tmux');

function browserResolve(test: TestCase) {
  const preset = presets.find((entry) => entry.name === test.preset);
  if (!preset) throw new Error(`missing generated preset ${test.preset}`);
  const named = namedBackgroundSeed(test.background);
  const seed = named ?? (/^#[0-9a-f]{6}$/i.test(test.background)
    ? test.background
    : null);
  let mode: ThemeMode = test.background === 'light' ? 'light' : 'dark';
  if (seed) {
    mode = colorLuma(seed) >= resolution.luma.lightThreshold
      ? 'light'
      : 'dark';
  }
  if (test.mode !== 'auto') mode = test.mode;
  const anchor = anchors[mode];
  const textMix = resolution.textMix[mode];
  const surface = resolution.surfaceMix;
  const bg = seed ? mixColor(anchor.fg, seed, surface.bg) : anchor.bg;
  const base = test.baseColor ?? presetAccent(preset, mode);
  return {
    preset: test.preset,
    mode,
    seed,
    colors: {
      base,
      baseAlt: mixColor(base, bg, resolution.baseAltMix),
      bg,
      bgAlt: seed
        ? mixColor(anchor.fg, seed, surface.bgAlt)
        : anchor.bgAlt,
      fg: anchor.fg,
      muted: seed
        ? mixColor(anchor.fg, seed, textMix.muted)
        : anchor.muted,
      subtle: seed
        ? mixColor(anchor.fg, seed, textMix.subtle)
        : anchor.subtle,
      border: seed
        ? mixColor(anchor.fg, seed, surface.border)
        : anchor.border,
      warn: anchor.warn,
      alert: anchor.alert,
      ink: anchor.ink,
    },
  };
}

async function shellResolve(test: TestCase) {
  const args = [
    plugin,
    '--resolve-colors',
    '--preset',
    test.preset,
    '--background',
    test.background,
    '--mode',
    test.mode,
  ];
  if (test.baseColor) args.push('--base-color', test.baseColor);
  const child = Bun.spawn(args, { stdout: 'pipe', stderr: 'inherit' });
  const text = await new Response(child.stdout).text();
  if (await child.exited !== 0) throw new Error('shell resolver failed');
  return JSON.parse(text);
}

const cases: TestCase[] = [
  { preset: 'blue', background: 'dark', mode: 'auto' },
  { preset: 'peach', background: 'light', mode: 'auto' },
  { preset: 'teal', background: '#301934', mode: 'auto' },
  { preset: 'mauve', background: '#fdf6e3', mode: 'auto' },
  { preset: 'gold', background: '#828282', mode: 'auto' },
  { preset: 'red', background: '#818181', mode: 'auto' },
  { preset: 'sky', background: 'solarized-light', mode: 'dark' },
  { preset: 'cornflower', background: 'tomorrow-night', mode: 'light' },
  {
    preset: 'purple',
    background: '#608ca6',
    mode: 'auto',
    baseColor: '#abcdef',
  },
];

for (const test of cases) {
  const expected = browserResolve(test);
  const actual = await shellResolve(test);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `resolver mismatch for ${JSON.stringify(test)}\n` +
      `shell:  ${JSON.stringify(actual)}\n` +
      `browser: ${JSON.stringify(expected)}`
    );
  }
}

if (colorSchema.presets.map((preset) => preset.name).join(' ') !==
    presets.map((preset) => preset.name).join(' ')) {
  throw new Error('generated preset order changed');
}

for (const host of ['noct', 'alpha', 'web-01', 'x']) {
  const child = Bun.spawn(['cksum'], {
    stdin: new TextEncoder().encode(host),
    stdout: 'pipe',
  });
  const output = await new Response(child.stdout).text();
  if (await child.exited !== 0) throw new Error('cksum(1) failed');
  const expected = Number(output.split(/\s+/)[0]);
  if (cksum(host) !== expected) {
    throw new Error(`browser cksum disagrees for ${host}`);
  }
}

console.log(`palette parity: ok (${cases.length} resolution cases)`);
