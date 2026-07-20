import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');

async function read(path: string): Promise<string> {
  return Bun.file(resolve(root, path)).text();
}

const [
  html,
  css,
  main,
  presets,
  color,
  state,
  statusBar,
  dock,
  palette,
  gallery,
  preview,
  statusOverlay,
  config,
  banner,
  generated,
  packageJson,
  wrangler,
] = await Promise.all([
  read('website/index.html'),
  read('website/src/style.css'),
  read('website/src/main.tsx'),
  read('website/src/presets.ts'),
  read('website/src/color.ts'),
  read('website/src/state.ts'),
  read('website/src/components/StatusBar.tsx'),
  read('website/src/components/Dock.tsx'),
  read('website/src/components/Palette.tsx'),
  read('website/src/components/Gallery.tsx'),
  read('website/src/components/Preview.tsx'),
  read('website/src/components/StatusOverlay.tsx'),
  read('website/src/components/Config.tsx'),
  read('website/src/components/Banner.tsx'),
  read('website/.generated/prepaint.js'),
  read('website/package.json'),
  read('website/wrangler.jsonc'),
]);

function expectContains(
  source: string,
  fragments: string | string[],
  message: string
): void {
  for (const fragment of [fragments].flat()) {
    if (!source.includes(fragment)) {
      throw new Error(`${message}: missing ${JSON.stringify(fragment)}`);
    }
  }
}

function expectExcludes(
  source: string,
  fragment: string,
  message: string
): void {
  if (source.includes(fragment)) {
    throw new Error(`${message}: found ${JSON.stringify(fragment)}`);
  }
}

function cssBlock(selector: string): string {
  const blocks: string[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const start = css.indexOf(`${selector} {`, cursor);
    if (start === -1) break;

    const open = css.indexOf('{', start);
    let depth = 0;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      if (css[index] !== '}') continue;
      depth -= 1;
      if (depth === 0) {
        blocks.push(css.slice(start, index + 1));
        cursor = index + 1;
        break;
      }
    }
    if (cursor <= open) {
      throw new Error(`unterminated CSS block: ${selector}`);
    }
  }
  if (blocks.length === 0) throw new Error(`missing CSS block: ${selector}`);
  return blocks.join('\n');
}

function expectBlockContains(
  selector: string,
  declarations: string | string[]
): void {
  expectContains(
    cssBlock(selector),
    declarations,
    `${selector} has required declarations`
  );
}

function expectBlockExcludes(selector: string, declaration: string): void {
  expectExcludes(
    cssBlock(selector),
    declaration,
    `${selector} excludes forbidden declaration`
  );
}

describe('static document contracts', () => {
  test('keeps sections in status-line order', () => {
    const order = [
      ...html.matchAll(/^    <section class="window shell" id="([^"]*)"/gm),
    ].map((match) => match[1]);
    expect(order).toEqual(['intro', 'palette', 'config', 'install']);
  });

  test('keeps manual installation snippets separate', () => {
    const manual = html.slice(
      html.indexOf('<h3>manually</h3>'),
      html.indexOf('<h3>requirements</h3>')
    );
    expect(manual.match(/class="inline-code"/g)).toHaveLength(2);
  });

  test('identifies Chroma and links its dependencies', () => {
    expectContains(
      html,
      [
        '<title>Chroma — a host-aware tmux theme</title>',
        '<p class="tagline hero-tagline">A different accent for every host.</p>',
        'aria-label="Sections, shown as a live Chroma status line"',
        'href="https://github.com/tmux-plugins/tpm"',
      ],
      'landing page identifies Chroma as a tmux theme'
    );
  });

  test('uses the Workers custom domain and deployment commands', () => {
    expectContains(
      html,
      [
        '<link rel="canonical" href="https://chroma.jimeh.dev/">',
        '<meta property="og:url" content="https://chroma.jimeh.dev/">',
        'content="https://chroma.jimeh.dev/preview.png"',
      ],
      'site metadata uses the Workers custom domain'
    );
    expectExcludes(
      html,
      'jimeh.github.io/tmux-chroma',
      'site metadata excludes the old GitHub Pages URL'
    );
    expectContains(
      wrangler,
      [
        '"preview_urls": true',
        '"pattern": "chroma.jimeh.dev"',
        '"custom_domain": true',
        '"directory": "./dist"',
        '"workers_dev": false',
      ],
      'Wrangler deploys preview and production static assets'
    );
    expectContains(
      packageJson,
      [
        '"deploy": "wrangler deploy"',
        '"deploy:preview": "wrangler versions upload"',
      ],
      'package scripts expose both deployment paths'
    );
  });
});

describe('status-line geometry', () => {
  test('uses shared measures and tmux cell geometry', () => {
    expectBlockContains(':root', ['--dock-height: 28px;', '--measure: 720px;']);
    for (const selector of [
      '.lede',
      '.inline-code',
      '.conf-block',
      '.readout',
      '.install-command',
      '.custom-color',
    ]) {
      expectBlockContains(selector, 'max-width: var(--measure);');
    }
    expectBlockContains('.statusbar', [
      'height: var(--dock-height);',
      'line-height: var(--dock-height);',
      'white-space: pre;',
    ]);
    expectBlockExcludes('.status-dock', 'border-top');
    expectBlockContains('.status-prefix', 'background: var(--bar);');
    expectBlockContains(
      '.status-prefix.is-active',
      'background: var(--panel-raised);'
    );
    expectBlockContains(
      '.status-prefix.is-powerline',
      'background: var(--bar);'
    );
    expectBlockContains('.divider-metrics', '--divider-from: var(--bar);');
    expectBlockContains('.powerline-glyph', 'height: 100%;');
  });

  test('uses an aligned replacement focus ring', () => {
    expectBlockContains(
      '.custom-color:focus-within',
      'outline: 2px solid var(--accent);'
    );
    expectBlockContains('.custom-color-input:focus-visible', 'outline: none;');
  });

  test('retargets narrow-view dividers to the bar', () => {
    expectContains(
      cssBlock('@media (max-width: 720px)'),
      [
        '.divider-forward',
        '--divider-to: var(--bar);',
        '.divider-tail',
        '--divider-from: var(--bar);',
        '.status-session-gap',
      ],
      'narrow viewport retargets surviving dividers'
    );
    expectContains(
      statusBar,
      "'status-session-gap'",
      'narrow session gap uses a literal cell'
    );
    expectBlockContains('.status-session-gap', 'background: var(--bar);');
    expectBlockContains(
      '.status-session-gap.is-active',
      'background: var(--panel-raised);'
    );
  });

  test('animates the bar as one element', () => {
    expectBlockContains('.boot', 'animation: segment-in');
    expect(css).not.toMatch(/^\.boot \./m);
  });

  test('uses literal cells for segment and Powerline spacing', () => {
    for (const selector of [
      '.status-host',
      '.status-session',
      '.status-metrics',
      '.status-tail',
    ]) {
      expectBlockExcludes(selector, 'padding');
    }
    expectBlockContains('.status-window', 'padding: 0;');
    expectContains(
      statusBar,
      [
        'class="powerline-space is-before"> </span>',
        '<DividerGlyph direction={direction} />',
        'class="powerline-space is-after"> </span>',
      ],
      'Powerline dividers use space, glyph, and space cells'
    );
    expectContains(
      statusBar,
      [
        'viewBox="0 0 1 1"',
        "'-0.1,0 0,0 1,0.5 0,1 -0.1,1'",
        "'1.1,0 1,0 0,0.5 1,1 1.1,1'",
        "{' ' + metric + ' '}",
      ],
      'Powerline and metric cells mirror tmux geometry'
    );
  });
});

describe('interactive island contracts', () => {
  test('preserves preview and palette controls', () => {
    expectContains(html, ['class="status-dock"', 'id="swatch-grid"'], 'site');
    expectContains(
      palette,
      [
        'aria-label="Accent presets"',
        'id="custom-color-input"',
        "selectPreset({ name: 'custom', base: submitted })",
      ],
      'palette controls remain available'
    );
    expectContains(
      color,
      'function normalizeHex(value: string)',
      'custom colors remain normalized'
    );
    expectContains(
      presets,
      'colorHue(first.base) - colorHue(second.base)',
      'presets remain sorted by hue'
    );
  });

  test('honors reduced motion', () => {
    expectBlockContains(
      '@media (prefers-reduced-motion: reduce)',
      'animation-duration: 0.01ms !important;'
    );
    expectContains(
      dock,
      'prefers-reduced-motion',
      'dock navigation honors reduced motion'
    );
  });

  test('resolves theme state before first paint', () => {
    expectContains(
      html,
      '<script data-chroma-prepaint></script>',
      'theme resolves before first paint'
    );
    expectContains(
      generated,
      ["read('chroma-background')", "read('chroma-mode')"],
      'pre-paint resolver restores persisted theme state'
    );
    expectBlockContains(":root[data-theme='light']", 'color-scheme: light;');
    expectContains(
      config,
      [
        '@chroma_background',
        'ariaLabel="@chroma_background value"',
        'ariaLabel="@chroma_preset value"',
        '@chroma_mode',
      ],
      'conf block hosts theme controls'
    );
  });

  test('keeps custom dropdown semantics and positioning', () => {
    expectContains(
      config,
      [
        'role="combobox"',
        'role="listbox"',
        'role="option"',
        'class="conf-option-swatch"',
        'class="conf-option-label"',
        'aria-activedescendant',
      ],
      'conf dropdowns expose swatched listbox semantics'
    );
    expectBlockContains('.conf-select-popup', [
      'position: fixed;',
      'max-width: calc(100vw - 16px);',
    ]);
    expectContains(
      config,
      "querySelector('.status-dock')",
      'dropdown stops above the status dock'
    );
    expectContains(
      config,
      ['const maxUp = Math.max(', 'const maxDown = Math.max('],
      'dropdown geometry clamps unavailable viewport space'
    );
  });

  test('keeps backgrounds behind every scrolling layer', () => {
    expectBlockContains('.block-scroll', [
      'overflow-x: auto;',
      'overflow-y: hidden;',
      'background: var(--panel);',
    ]);
    expectBlockContains('.status-dock-scroll', [
      'overflow-y: hidden;',
      'background: var(--bar);',
    ]);
    expectBlockContains('.conf-select-scroll', [
      'background: var(--panel);',
      'overscroll-behavior: contain;',
    ]);
  });

  test('persists only configurable values and exposes resets', () => {
    expectContains(dock, 'autoHost', 'dock hostname follows typed auto host');
    expectContains(
      config,
      [
        "'dark themes'",
        "'light themes'",
        'colorLuma(entry.seed)',
        'id="custom-background-input"',
        '# reset to defaults',
        'aria-label="Reset the custom background"',
      ],
      'configuration controls preserve grouped themes and resets'
    );
    expectContains(
      state,
      [
        'persistValue(',
        'backgroundStorageKey,',
        "'chroma-preset'",
        "'chroma-mode'",
        "'chroma-host'",
        "'chroma-powerline'",
        "'chroma-show-cpu'",
        "'chroma-show-memory'",
        "'chroma-show-disk'",
      ],
      'conf values persist under stable keys'
    );
    expectContains(
      palette,
      [
        'aria-label="Clear the hostname"',
        'aria-label="Reset the custom accent"',
      ],
      'palette controls expose resets'
    );
  });

  test('keeps copy affordances and prompt spacing', () => {
    expectContains(
      main,
      "querySelectorAll('.inline-code')",
      'install snippets gain copy buttons'
    );
    expectContains(
      palette,
      "document.execCommand('copy')",
      'copy retains its fallback'
    );
    expectBlockContains('.conf-block', 'position: relative;');
    expectBlockContains('.inline-code', 'position: relative;');
    expectContains(
      config,
      'function confText',
      'conf copy is built from state'
    );
    expectContains(
      html,
      'docs</span> <span',
      'prompt cursor follows one literal space'
    );
  });

  test('keeps hero controls and automatic preset selection', () => {
    expectContains(
      html,
      [
        '<a href="https://github.com/jimeh/tmux-chroma">github</a>',
        'id="theme-toggle"',
        'darkreader-lock',
      ],
      'hero links and theme controls remain available'
    );
    expectContains(
      config,
      'function BackgroundQuickToggle',
      'hero toggle changes the background option'
    );
    expectContains(
      presets,
      [
        'function seededPreset()',
        'now.getHours(),',
        'function cksum(text: string)',
        'function presetForHost(host: string)',
      ],
      'automatic presets use browser and host seeds'
    );
    expectContains(
      state,
      'host ? presetForHost(host) : seededPreset()',
      'state selects the correct automatic seed'
    );
    expectContains(
      palette,
      ['id="auto-host-input"', 'onClick={selectAuto}'],
      'palette exposes automatic host selection'
    );
  });

  test('keeps prefix navigation, modal isolation, and easter eggs', () => {
    expectContains(
      gallery,
      ['class="gallery-bars"', "'1:zsh'"],
      'prefix+w preserves the preset gallery'
    );
    expectContains(
      statusOverlay,
      ['aria-modal="true"', 'region.inert = true;', 'region.inert = false;'],
      'status overlays isolate background regions'
    );
    expectContains(
      main,
      [
        "event.key === 'w'",
        "event.key === 'p'",
        "event.key === 'r'",
        "event.key === 'c'",
      ],
      'prefix shortcuts remain registered'
    );
    expectContains(
      state,
      ['function rollLogo', 'function rainbowLogo'],
      'logo actions remain available'
    );
    expectContains(
      banner,
      'LETTER_COLUMNS',
      'banner remains split into per-letter columns'
    );
  });

  test('keeps the deterministic README preview composition', () => {
    expectContains(html, 'id="preview"', 'page mounts the README preview');
    expectContains(
      preview,
      [
        "{ name: 'dark', label: 'dark', accent: 'peach' }",
        "{ name: 'light', label: 'light', accent: 'blue' }",
        "accent: 'green'",
        "accent: 'mauve'",
        '<PreviewBar powerline={false} />',
        '<PreviewBar powerline />',
        'resolveBackground(background.name)',
        "'--preview-background'",
        'var(--canvas-',
      ],
      'preview uses fixed backgrounds and the shared resolver'
    );
    expectContains(
      state,
      'function resolveBackground',
      'preview backgrounds use the live page resolver'
    );
    expectBlockContains(':root', [
      '--canvas-dark: #090a0d;',
      '--canvas-light: #f6f8fb;',
    ]);
    expectBlockContains(
      '.preview-grid',
      'grid-template-columns: repeat(2, minmax(0, 1fr));'
    );
    expectBlockContains('.preview-bar', 'min-width: 0;');
    expectContains(
      cssBlock('@media (max-width: 1360px)'),
      'grid-template-columns: minmax(0, 1fr);',
      'preview stacks before its status bars clip'
    );
  });
});
