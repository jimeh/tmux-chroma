import { describe, expect, test } from 'bun:test';
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

interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
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

async function run(args: string[], stdin?: string): Promise<CommandResult> {
  const child = Bun.spawn(args, {
    stdin: stdin === undefined ? 'ignore' : new TextEncoder().encode(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stderr, stdout };
}

function runtimeResolve(testCase: TestCase): RuntimePalette {
  const preset = presets.find((entry) => entry.name === testCase.preset);
  if (!preset) throw new Error(`missing generated preset ${testCase.preset}`);

  state.background.value = testCase.background;
  state.modeOverride.value = testCase.mode;
  state.selectPreset(
    testCase.baseColor ? { name: 'custom', base: testCase.baseColor } : preset
  );

  const surfaceValues = state.surfaces.value;
  return {
    mode: state.theme.value,
    surfaces: surfaceValues ? { ...surfaceValues } : null,
    bar: state.barColor.value,
    accent: state.accent.value,
    accentAlt: state.accentAlt.value,
  };
}

async function shellResolve(testCase: TestCase): Promise<ShellPalette> {
  const args = [
    plugin,
    '--resolve-colors',
    '--preset',
    testCase.preset,
    '--background',
    testCase.background,
    '--mode',
    testCase.mode,
  ];
  if (testCase.baseColor) args.push('--base-color', testCase.baseColor);
  const result = await run(args);
  expect(result.stderr).toBe('');
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout) as ShellPalette;
}

function expectRuntimeToMatchShell(
  runtime: RuntimePalette,
  shell: ShellPalette
): void {
  const anchors = colorSchema.modes[runtime.mode];
  expect(runtime.mode).toBe(shell.mode);
  expect(runtime.bar).toBe(shell.colors.bg);
  expect(runtime.accent).toBe(shell.colors.base);
  expect(runtime.accentAlt).toBe(shell.colors.baseAlt);
  expect(shell.colors.fg).toBe(anchors.fg);
  expect(shell.colors.warn).toBe(anchors.warn);
  expect(shell.colors.alert).toBe(anchors.alert);
  expect(shell.colors.ink).toBe(anchors.ink);

  if (shell.seed === null) {
    expect(runtime.surfaces).toBeNull();
    expect(shell.colors.bgAlt).toBe(anchors.bgAlt);
    expect(shell.colors.muted).toBe(anchors.muted);
    expect(shell.colors.subtle).toBe(anchors.subtle);
    expect(shell.colors.border).toBe(anchors.border);
    return;
  }

  expect(runtime.surfaces).not.toBeNull();
  expect(runtime.surfaces?.canvas).toBe(shell.seed);
  expect(runtime.surfaces?.bar).toBe(shell.colors.bg);
  expect(runtime.surfaces?.panelRaised).toBe(shell.colors.bgAlt);
  expect(runtime.surfaces?.line).toBe(shell.colors.border);
  expect(runtime.surfaces?.muted).toBe(shell.colors.muted);
  expect(runtime.surfaces?.subtle).toBe(shell.colors.subtle);
}

interface PrepaintResult {
  theme: string | undefined;
  styles: Record<string, string>;
}

function runPrepaint(testCase: TestCase): PrepaintResult {
  storage.clear();
  if (testCase.background !== 'dark') {
    storage.set('chroma-background', testCase.background);
  }
  if (testCase.mode !== 'auto') storage.set('chroma-mode', testCase.mode);

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

describe('color schema', () => {
  test('is deterministic, quiet, and versioned', async () => {
    const first = await run([plugin, '--dump-colors']);
    const second = await run([plugin, '--dump-colors']);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(first.stderr).toBe('');
    expect(second.stderr).toBe('');
    expect(second.stdout).toBe(first.stdout);

    const schema = JSON.parse(first.stdout) as typeof colorSchema;
    expect(schema.schemaVersion).toBe(1);
    expect(schema.presets).toHaveLength(22);
    expect(schema.modes.dark).toBeDefined();
    expect(schema.modes.light).toBeDefined();
    expect(schema.resolution.luma).toBeDefined();
    expect(schema.resolution.surfaceMix).toBeDefined();
    expect(schema.resolution.textMix).toBeDefined();
  });

  test('rejects invalid resolver queries', async () => {
    const result = await run([
      plugin,
      '--resolve-colors',
      '--preset',
      'missing',
    ]);
    expect(result.exitCode).not.toBe(0);
  });

  test('preserves generated preset order', () => {
    expect(colorSchema.presets.map((preset) => String(preset.name))).toEqual(
      presets.map((preset) => preset.name)
    );
  });
});

describe('browser palette parity', () => {
  const cases: TestCase[] = [
    { preset: 'blue', background: 'dark', mode: 'auto' },
    { preset: 'peach', background: 'light', mode: 'auto' },
    { preset: 'teal', background: '#301934', mode: 'auto' },
    { preset: 'mauve', background: '#fdf6e3', mode: 'auto' },
    { preset: 'gold', background: '#828282', mode: 'auto' },
    { preset: 'red', background: '#818181', mode: 'auto' },
    { preset: 'sky', background: 'solarized-light', mode: 'dark' },
    {
      preset: 'cornflower',
      background: 'tomorrow-night',
      mode: 'light',
    },
    { preset: 'jade', background: '#FDF6E3', mode: 'auto' },
    {
      preset: 'purple',
      background: '#608ca6',
      mode: 'auto',
      baseColor: '#abcdef',
    },
  ];

  for (const testCase of cases) {
    test(JSON.stringify(testCase), async () => {
      const runtime = runtimeResolve(testCase);
      const shell = await shellResolve(testCase);
      expectRuntimeToMatchShell(runtime, shell);
    });
  }
});

describe('pre-paint palette parity', () => {
  const cases: TestCase[] = [
    { preset: 'blue', background: 'dark', mode: 'auto' },
    { preset: 'peach', background: 'light', mode: 'auto' },
    { preset: 'red', background: 'light', mode: 'dark' },
    { preset: 'teal', background: 'solarized-light', mode: 'auto' },
    { preset: 'mauve', background: '#301934', mode: 'auto' },
    { preset: 'jade', background: '#FDF6E3', mode: 'auto' },
    { preset: 'gold', background: 'tomorrow-night', mode: 'light' },
  ];

  for (const testCase of cases) {
    test(JSON.stringify(testCase), () => {
      const runtime = runtimeResolve(testCase);
      const prepaint = runPrepaint(testCase);
      expect(prepaint.theme).toBe(runtime.mode);

      const surfaces = runtime.surfaces;
      expect(prepaint.styles).toEqual(
        surfaces
          ? {
              '--canvas': surfaces.canvas,
              '--bar': surfaces.bar,
              '--panel': surfaces.panel,
              '--panel-raised': surfaces.panelRaised,
              '--line': surfaces.line,
              '--muted': surfaces.muted,
              '--subtle': surfaces.subtle,
            }
          : {}
      );
    });
  }
});

describe('browser cksum parity', () => {
  for (const host of [
    'noct',
    'alpha',
    'web-01',
    'x',
    'longhostname-with-many-octets',
    'x'.repeat(300),
  ]) {
    test(host, async () => {
      const result = await run(['cksum'], host);
      expect(result.exitCode).toBe(0);
      const expected = Number(result.stdout.split(/\s+/)[0]);
      expect(cksum(host)).toBe(expected);
    });
  }
});
