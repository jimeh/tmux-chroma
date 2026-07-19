# AGENTS.md

Chroma is a dependency-light tmux status theme for macOS and Linux.

## Project structure

- `chroma.tmux`: executable TPM entrypoint and theme implementation.
- `scripts/`: bundled CPU, memory, and disk status helpers.
- `website/`: Vite + Preact TypeScript source for the Cloudflare Workers site
  and interactive preview; terminal-session layout where the fixed
  status-line dock doubles as page navigation. Static prose lives in
  `website/index.html`; interactive islands mount from
  `website/src/main.tsx` and share state through `@preact/signals`. Bun
  is the package manager and script runner (`bun install`, `bun run`).
- `test/`: shell and live tmux regression tests.

Cloudflare Workers Builds builds and deploys the site from `website/`.
Production publishes from `main` to `chroma.jimeh.dev`; non-production
branches upload preview versions and receive links in pull requests. The
`website/dist` output is gitignored and must never be committed. TPM installs
clone this whole repository, so keep `website/` small and never add build
artifacts or vendored dependencies to it.

## Commands

Tool versions (bun, shellcheck, shfmt) are pinned in `mise.toml` and
installed with `mise install`; CI uses the same pins through
`jdx/mise-action`. markdownlint-cli2 and html-validate are pinned in the
Makefile and run through `bunx --bun`. There is no Node dependency; bun
is the only JS runtime, including for `test/palette-sync.sh`.

```sh
mise install
cd website
bun install --frozen-lockfile
cd ..
make format
make lint
make test
make check
```

The root palette parity test imports the real website signals runtime, so
website dependencies must be installed before `make test` or `make check`.

Website (from `website/`):

```sh
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun run build
bun run deploy
bun run deploy:preview
```

## Conventions

- Keep the plugin compatible with Bash 4.2 on Linux and macOS system Bash.
- Avoid dependencies when a small shell implementation is sufficient.
- Treat repeated tmux config loads as a first-class behavior. Theme loading
  must be idempotent.
- Test rendered tmux options in an isolated server; text inspection alone is
  insufficient for status-format behavior.
- Run Powerline assertions under a UTF-8 locale. Older tmux versions do not
  preserve divider glyphs in a plain `C` locale.
- `chroma.tmux` is the single authored source for presets, named
  backgrounds, neutral anchors, and resolution constants. Its
  `--dump-colors` mode emits the versioned JSON schema without tmux;
  `--resolve-colors` exposes the real shell resolver for parity tests.
  `bun run generate` in `website/` creates ignored files under
  `website/.generated/`; dev, typecheck, and build run it first. Never
  hand-edit or commit generated colors. Run `make test` after changing
  the schema or resolver.
- The site has one theme control, the `@chroma_background` dropdown
  in the live conf block (plus a custom background input): the page,
  dock, and gallery re-theme together. Dark is the default regardless
  of the system color scheme; the persisted choice — 'dark', 'light',
  a named theme background, or a custom `#rrggbb` seed classified and
  blended like the plugin (surfaces and the muted/subtle text tones
  both derive from the seed), with a persisted `@chroma_mode`
  override forcing the palette mode — is resolved by an inline
  generated pre-paint script before the stylesheet paints. Vite injects
  that script and shared color variables at the placeholders in
  `website/index.html`; browser color math consumes the generated
  constants and is checked against `--resolve-colors`. Dark stays the
  README screenshot source.
- Keep website dependencies minimal: `preact` and `@preact/signals` at
  runtime; `vite`, `@preact/preset-vite`, and `typescript` for the build;
  `wrangler` for deployment. Source is strict TypeScript (`bun run typecheck`
  must pass). Prose stays as static HTML in `website/index.html` so content
  renders without JavaScript; components own only the interactive islands.
- The preview status bar mirrors tmux cell geometry: segment spacing comes
  from literal space characters in the format strings under
  `white-space: pre` (`website/src/components/StatusBar.tsx`), never CSS
  padding. The fixed dock scrolls horizontally instead of wrapping on
  narrow viewports. `test/site.sh` enforces the no-padding rule.
- One `StatusBar` component renders both the dock and the gallery bars;
  keyed window items keep focused dock buttons attached across re-renders,
  which the gallery's focus restore relies on.
- Use `https://chroma.jimeh.dev/` as the canonical site URL. Keep the custom
  domain and static asset directory in `website/wrangler.jsonc`; do not add a
  GitHub Pages `CNAME`. Workers preview URLs are explicitly enabled while the
  public `workers.dev` production route is disabled.
- Preserve keyboard focus, mobile overflow handling, and reduced-motion
  behavior when changing the site.
- iOS Safari paints a scroll container's background on the moving
  content layer, so rubber-band overscroll reveals whatever sits
  behind the element. Every scrolling region therefore lives inside
  a shell that carries the same background: `.block-scroll` inside
  the bordered code blocks, `.status-dock-scroll` inside the dock,
  and `.conf-select-scroll` inside the dropdown popup. Keep the
  shells non-scrolling.
- Conf-block values and the auto-host preview persist in
  localStorage under `chroma-*` keys, written only while
  non-default; the conf block shows a `# reset to defaults` line
  while anything differs. Runtime signals (prefix, sync) stay
  session-only by design.
- The site hides a preset gallery behind the tmux prefix: Ctrl-b or
  Ctrl-q, then w (choose-window). It renders one status line per accent
  and is used to screenshot the palette for the README. Keep it working
  when changing status bar markup or styles.
