import { resolve } from 'node:path';
import { colorSchema } from '../website/.generated/colors.ts';
import { cksum, presets, type ThemeMode } from '../website/src/presets.ts';

interface TestCase {
  preset: string;
  background: string;
  mode: 'auto' | ThemeMode;
  baseColor?: string;
}

interface RuntimePalette {
  mode: ThemeMode;
  surfaces: {
    canvas: string;
    bar: string;
    panel: string;
    panelRaised: string;
    line: string;
    muted: string;
    subtle: string;
  } | null;
  bar: string;
  accent: string;
  accentAlt: string;
}

interface ShellPalette {
  mode: ThemeMode;
  seed: string | null;
  colors: {
    base: string;
    baseAlt: string;
    bg: string;
    bgAlt: string;
    fg: string;
    muted: string;
    subtle: string;
    border: string;
    warn: string;
    alert: string;
    ink: string;
  };
}

const root = resolve(import.meta.dir, '..');
const plugin = resolve(root, 'chroma.tmux');
const storage = new Map<string, string>();
const storageApi = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storageApi,
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { language: 'en-GB', userAgent: 'chroma-parity-test' },
});
Object.defineProperty(globalThis, 'screen', {
  configurable: true,
  value: { height: 720, width: 1280 },
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    devicePixelRatio: 1,
    setTimeout: globalThis.setTimeout.bind(globalThis),
  },
});

const state = await import('../website/src/state.ts');
const prepaintSource = await Bun.file(
  resolve(root, 'website/.generated/prepaint.js')
).text();

function runtimeResolve(test: TestCase): RuntimePalette {
  const preset = presets.find((entry) => entry.name === test.preset);
  if (!preset) throw new Error(`missing generated preset ${test.preset}`);

  state.background.value = test.background;
  state.modeOverride.value = test.mode;
  state.selectPreset(test.baseColor
    ? { name: 'custom', base: test.baseColor }
    : preset);

  const surfaceValues = state.surfaces.value;
  return {
    mode: state.theme.value,
    surfaces: surfaceValues ? { ...surfaceValues } : null,
    bar: state.barColor.value,
    accent: state.accent.value,
    accentAlt: state.accentAlt.value,
  };
}

async function shellResolve(test: TestCase): Promise<ShellPalette> {
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
  return JSON.parse(text) as ShellPalette;
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}\nactual:   ${JSON.stringify(actual)}\n` +
      `expected: ${JSON.stringify(expected)}`
    );
  }
}

function assertRuntimeMatchesShell(
  test: TestCase,
  runtime: RuntimePalette,
  shell: ShellPalette
): void {
  const label = `resolver mismatch for ${JSON.stringify(test)}`;
  const anchors = colorSchema.modes[runtime.mode];
  assertEqual(runtime.mode, shell.mode, `${label}: mode`);
  assertEqual(runtime.bar, shell.colors.bg, `${label}: bar`);
  assertEqual(runtime.accent, shell.colors.base, `${label}: accent`);
  assertEqual(
    runtime.accentAlt,
    shell.colors.baseAlt,
    `${label}: accentAlt`
  );
  assertEqual(shell.colors.fg, anchors.fg, `${label}: fg`);
  assertEqual(shell.colors.warn, anchors.warn, `${label}: warn`);
  assertEqual(shell.colors.alert, anchors.alert, `${label}: alert`);
  assertEqual(shell.colors.ink, anchors.ink, `${label}: ink`);

  if (shell.seed === null) {
    assertEqual(runtime.surfaces, null, `${label}: named surfaces`);
    assertEqual(shell.colors.bgAlt, anchors.bgAlt, `${label}: bgAlt`);
    assertEqual(shell.colors.muted, anchors.muted, `${label}: muted`);
    assertEqual(shell.colors.subtle, anchors.subtle, `${label}: subtle`);
    assertEqual(shell.colors.border, anchors.border, `${label}: border`);
    return;
  }
  if (!runtime.surfaces) throw new Error(`${label}: missing surfaces`);
  assertEqual(runtime.surfaces.canvas, shell.seed, `${label}: canvas`);
  assertEqual(runtime.surfaces.bar, shell.colors.bg, `${label}: surface bar`);
  assertEqual(
    runtime.surfaces.panelRaised,
    shell.colors.bgAlt,
    `${label}: panelRaised`
  );
  assertEqual(runtime.surfaces.line, shell.colors.border, `${label}: line`);
  assertEqual(runtime.surfaces.muted, shell.colors.muted, `${label}: muted`);
  assertEqual(
    runtime.surfaces.subtle,
    shell.colors.subtle,
    `${label}: subtle`
  );
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
  { preset: 'jade', background: '#FDF6E3', mode: 'auto' },
  {
    preset: 'purple',
    background: '#608ca6',
    mode: 'auto',
    baseColor: '#abcdef',
  },
];

for (const test of cases) {
  const runtime = runtimeResolve(test);
  const shell = await shellResolve(test);
  assertRuntimeMatchesShell(test, runtime, shell);
}

interface PrepaintResult {
  theme: string | undefined;
  styles: Record<string, string>;
}

function runPrepaint(test: TestCase): PrepaintResult {
  storage.clear();
  if (test.background !== 'dark') {
    storage.set('chroma-background', test.background);
  }
  if (test.mode !== 'auto') storage.set('chroma-mode', test.mode);

  const styles = new Map<string, string>();
  const documentElement = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty: (name: string, value: string) => styles.set(name, value),
    },
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement },
  });
  Function(prepaintSource)();
  return {
    theme: documentElement.dataset.theme,
    styles: Object.fromEntries(styles),
  };
}

const prepaintCases: TestCase[] = [
  { preset: 'blue', background: 'dark', mode: 'auto' },
  { preset: 'peach', background: 'light', mode: 'auto' },
  { preset: 'red', background: 'light', mode: 'dark' },
  { preset: 'teal', background: 'solarized-light', mode: 'auto' },
  { preset: 'mauve', background: '#301934', mode: 'auto' },
  { preset: 'gold', background: 'tomorrow-night', mode: 'light' },
];

for (const test of prepaintCases) {
  const runtime = runtimeResolve(test);
  const prepaint = runPrepaint(test);
  assertEqual(
    prepaint.theme,
    runtime.mode,
    `prepaint theme mismatch for ${JSON.stringify(test)}`
  );
  const surfaces = runtime.surfaces;
  const expectedStyles = surfaces ? {
    '--canvas': surfaces.canvas,
    '--bar': surfaces.bar,
    '--panel': surfaces.panel,
    '--panel-raised': surfaces.panelRaised,
    '--line': surfaces.line,
    '--muted': surfaces.muted,
    '--subtle': surfaces.subtle,
  } : {};
  assertEqual(
    prepaint.styles,
    expectedStyles,
    `prepaint styles mismatch for ${JSON.stringify(test)}`
  );
}

if (colorSchema.presets.map((preset) => preset.name).join(' ') !==
    presets.map((preset) => preset.name).join(' ')) {
  throw new Error('generated preset order changed');
}

for (const host of [
  'noct',
  'alpha',
  'web-01',
  'x',
  'longhostname-with-many-octets',
  'x'.repeat(300),
]) {
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

console.log(
  `palette parity: ok (${cases.length} runtime, ` +
  `${prepaintCases.length} prepaint cases)`
);
