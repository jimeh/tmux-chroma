import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

interface ModeAnchors {
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

interface ColorSchema {
  schemaVersion: number;
  modes: Record<'dark' | 'light', ModeAnchors>;
  presets: Array<{ name: string; dark: string; light: string }>;
  namedBackgrounds: Array<{ name: string; seed: string }>;
  resolution: {
    luma: {
      red: number;
      green: number;
      blue: number;
      divisor: number;
      lightThreshold: number;
    };
    surfaceMix: { bg: number; panel: number; bgAlt: number; border: number };
    textMix: Record<'dark' | 'light', { muted: number; subtle: number }>;
    baseAltMix: number;
  };
}

const website = resolve(import.meta.dir, '..');
const plugin = resolve(website, '..', 'chroma.tmux');
const outputDir = resolve(website, '.generated');

const child = Bun.spawn([plugin, '--dump-colors'], {
  stdout: 'pipe',
  stderr: 'inherit',
});
const text = await new Response(child.stdout).text();
if (await child.exited !== 0) {
  throw new Error('chroma.tmux --dump-colors failed');
}

function fail(message: string): never {
  throw new Error(`invalid Chroma color schema: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${label} must be a non-empty array`);
  }
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function hex(value: unknown, label: string): string {
  const color = string(value, label);
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    fail(`${label} must be a lowercase #rrggbb color`);
  }
  return color;
}

function number(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number
): number {
  if (!Number.isInteger(value) ||
      (value as number) < minimum || (value as number) > maximum) {
    fail(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function validateColors(value: unknown): ColorSchema {
  const schema = record(value, 'root');
  if (schema.schemaVersion !== 1) {
    fail('schemaVersion must be 1');
  }

  const modeValues = record(schema.modes, 'modes');
  for (const mode of ['dark', 'light'] as const) {
    const anchors = record(modeValues[mode], `modes.${mode}`);
    for (const anchor of [
      'bg', 'bgAlt', 'fg', 'muted', 'subtle',
      'border', 'warn', 'alert', 'ink',
    ]) {
      hex(anchors[anchor], `modes.${mode}.${anchor}`);
    }
  }

  const presetNames = new Set<string>();
  for (const [index, value] of array(schema.presets, 'presets').entries()) {
    const preset = record(value, `presets[${index}]`);
    const name = string(preset.name, `presets[${index}].name`);
    if (!/^[a-z][a-z-]*$/.test(name)) {
      fail(`presets[${index}].name has an invalid format`);
    }
    if (presetNames.has(name)) fail(`duplicate preset name: ${name}`);
    presetNames.add(name);
    hex(preset.dark, `presets[${index}].dark`);
    hex(preset.light, `presets[${index}].light`);
  }

  const backgroundNames = new Set<string>();
  for (const [index, value] of array(
    schema.namedBackgrounds,
    'namedBackgrounds'
  ).entries()) {
    const background = record(value, `namedBackgrounds[${index}]`);
    const name = string(
      background.name,
      `namedBackgrounds[${index}].name`
    );
    if (!/^[a-z][a-z-]*$/.test(name)) {
      fail(`namedBackgrounds[${index}].name has an invalid format`);
    }
    if (backgroundNames.has(name)) {
      fail(`duplicate named background: ${name}`);
    }
    backgroundNames.add(name);
    hex(background.seed, `namedBackgrounds[${index}].seed`);
  }

  const resolution = record(schema.resolution, 'resolution');
  const luma = record(resolution.luma, 'resolution.luma');
  for (const weight of ['red', 'green', 'blue']) {
    number(luma[weight], `resolution.luma.${weight}`, 0, 10000);
  }
  number(luma.divisor, 'resolution.luma.divisor', 1, 10000);
  number(luma.lightThreshold, 'resolution.luma.lightThreshold', 0, 255);

  const surfaceMix = record(
    resolution.surfaceMix,
    'resolution.surfaceMix'
  );
  for (const surface of ['bg', 'panel', 'bgAlt', 'border']) {
    number(surfaceMix[surface], `resolution.surfaceMix.${surface}`, 0, 100);
  }

  const textMix = record(resolution.textMix, 'resolution.textMix');
  for (const mode of ['dark', 'light']) {
    const mixes = record(textMix[mode], `resolution.textMix.${mode}`);
    number(mixes.muted, `resolution.textMix.${mode}.muted`, 0, 100);
    number(mixes.subtle, `resolution.textMix.${mode}.subtle`, 0, 100);
  }
  number(resolution.baseAltMix, 'resolution.baseAltMix', 0, 100);

  return value as ColorSchema;
}

let parsed: unknown;
try {
  parsed = JSON.parse(text);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  fail(`output is not valid JSON: ${detail}`);
}
const colors = validateColors(parsed);
const first = colors.presets[0];

function mix(firstColor: string, secondColor: string, percent: number): string {
  return '#' + [1, 3, 5].map((index) => {
    const firstChannel = parseInt(firstColor.slice(index, index + 2), 16);
    const secondChannel = parseInt(secondColor.slice(index, index + 2), 16);
    const value = Math.floor(
      (firstChannel * percent + secondChannel * (100 - percent)) / 100
    );
    return value.toString(16).padStart(2, '0');
  }).join('');
}

function cssMode(mode: 'dark' | 'light'): string {
  const anchors = colors.modes[mode];
  const accent = first[mode];
  const selector = mode === 'dark' ? ':root' : ":root[data-theme='light']";
  const autoAccents = ['blue', 'green', 'yellow', 'red'].map((name) => {
    const preset = colors.presets.find((entry) => entry.name === name);
    if (!preset) throw new Error(`missing auto-swatch preset: ${name}`);
    return preset[mode];
  });
  return `${selector} {
  --bar: ${anchors.bg};
  --panel-raised: ${anchors.bgAlt};
  --text: ${anchors.fg};
  --muted: ${anchors.muted};
  --subtle: ${anchors.subtle};
  --warn: ${anchors.warn};
  --alert: ${anchors.alert};
  --ink: ${anchors.ink};
  --accent: ${accent};
  --accent-alt: ${mix(accent, anchors.bg, colors.resolution.baseAltMix)};
  --auto-accent-1: ${autoAccents[0]};
  --auto-accent-2: ${autoAccents[1]};
  --auto-accent-3: ${autoAccents[2]};
  --auto-accent-4: ${autoAccents[3]};
}`;
}

const moduleSource = `// Generated by scripts/generate-colors.ts. Do not edit.
export const colorSchema = ${JSON.stringify(colors, null, 2)} as const;
`;
const css = `${cssMode('dark')}\n\n${cssMode('light')}\n`;
const prepaintColors = {
  modes: colors.modes,
  namedBackgrounds: colors.namedBackgrounds,
  resolution: {
    luma: colors.resolution.luma,
    surfaceMix: colors.resolution.surfaceMix,
    textMix: colors.resolution.textMix,
  },
};
const prepaint = `// Generated by scripts/generate-colors.ts. Do not edit.
(function () {
  var colors = ${JSON.stringify(prepaintColors)};
  var read = function (key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };
  var stored = read('chroma-background');
  var forced = read('chroma-mode');
  if (forced !== 'dark' && forced !== 'light') forced = null;
  var root = document.documentElement;
  if (stored === 'light' || stored === 'dark') {
    root.dataset.theme = forced || stored;
    return;
  }
  var named = {};
  colors.namedBackgrounds.forEach(function (entry) {
    named[entry.name] = entry.seed;
  });
  if (Object.prototype.hasOwnProperty.call(named, stored || '')) {
    stored = named[stored];
  }
  if (!/^#[0-9a-f]{6}$/.test(stored || '')) {
    root.dataset.theme = forced || 'dark';
    return;
  }
  var seed = [1, 3, 5].map(function (offset) {
    return parseInt(stored.slice(offset, offset + 2), 16);
  });
  var lumaSpec = colors.resolution.luma;
  var luma = Math.floor(
    (lumaSpec.red * seed[0] + lumaSpec.green * seed[1] +
      lumaSpec.blue * seed[2]) / lumaSpec.divisor
  );
  var mode = forced ||
    (luma >= lumaSpec.lightThreshold ? 'light' : 'dark');
  var fgHex = colors.modes[mode].fg;
  var fg = [1, 3, 5].map(function (offset) {
    return parseInt(fgHex.slice(offset, offset + 2), 16);
  });
  var mix = function (percent) {
    return '#' + seed.map(function (channel, index) {
      var value = Math.floor(
        (fg[index] * percent + channel * (100 - percent)) / 100
      );
      return value.toString(16).padStart(2, '0');
    }).join('');
  };
  var surface = colors.resolution.surfaceMix;
  var text = colors.resolution.textMix[mode];
  root.dataset.theme = mode;
  root.style.setProperty('--canvas', stored);
  root.style.setProperty('--bar', mix(surface.bg));
  root.style.setProperty('--panel', mix(surface.panel));
  root.style.setProperty('--panel-raised', mix(surface.bgAlt));
  root.style.setProperty('--line', mix(surface.border));
  root.style.setProperty('--muted', mix(text.muted));
  root.style.setProperty('--subtle', mix(text.subtle));
})();
`;
const siteModule = `// Generated by scripts/generate-colors.ts. Do not edit.
export const colorCss = ${JSON.stringify(css)};
export const prepaint = ${JSON.stringify(prepaint)};
`;

async function write(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, contents);
}

await Promise.all([
  write(resolve(outputDir, 'colors.ts'), moduleSource),
  write(resolve(outputDir, 'colors.css'), css),
  write(resolve(outputDir, 'prepaint.js'), prepaint),
  write(resolve(outputDir, 'site.ts'), siteModule),
]);
