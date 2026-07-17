# AGENTS.md

Chroma is a dependency-light tmux status theme for macOS and Linux.

## Project structure

- `chroma.tmux`: executable TPM entrypoint and theme implementation.
- `scripts/`: bundled CPU, memory, and disk status helpers.
- `website/`: Vite + Preact source for the GitHub Pages site and
  interactive preview; terminal-session layout where the fixed status-line
  dock doubles as page navigation. Static prose lives in
  `website/index.html`; interactive islands mount from
  `website/src/main.jsx` and share state through `@preact/signals`.
- `test/`: shell and live tmux regression tests.

The site is built and deployed by `.github/workflows/pages.yml`; the
`website/dist` output is gitignored and must never be committed. TPM
installs clone this whole repository, so keep `website/` small and never
add build artifacts or vendored dependencies to it.

## Commands

```sh
make format
make lint
make test
make check
```

Website (from `website/`):

```sh
npm ci
npm run dev
npm run build
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
- The website duplicates preset names, base colors, the `base_alt` mix
  formula, and the POSIX `cksum` hash from `chroma.tmux`
  (`website/src/presets.js`, `website/src/state.js`). Update them together
  and run `make test`; `test/palette-sync.sh` diffs the palettes and runs
  the JS cksum port against `cksum(1)`.
- Keep website dependencies minimal: `preact` and `@preact/signals` at
  runtime, `vite` for the build, nothing else. Prose stays as static HTML
  in `website/index.html` so content renders without JavaScript;
  components own only the interactive islands.
- The preview status bar mirrors tmux cell geometry: segment spacing comes
  from literal space characters in the format strings under
  `white-space: pre` (`website/src/components/StatusBar.jsx`), never CSS
  padding. The fixed dock scrolls horizontally instead of wrapping on
  narrow viewports. `test/site.sh` enforces the no-padding rule.
- One `StatusBar` component renders both the dock and the gallery bars;
  keyed window items keep focused dock buttons attached across re-renders,
  which the gallery's focus restore relies on.
- Use `https://jimeh.github.io/tmux-chroma/` as the canonical site URL.
  The personal site runs on Cloudflare Workers, so keep the legacy
  `jimeh/jimeh.github.io` Pages custom domain and `CNAME` unset; otherwise
  GitHub redirects all project Pages through the unrelated personal-site
  origin.
- Preserve keyboard focus, mobile overflow handling, and reduced-motion
  behavior when changing the site.
- The site hides a preset gallery behind the tmux prefix: Ctrl-b or
  Ctrl-q, then w (choose-window). It renders one status line per accent
  and is used to screenshot the palette for the README. Keep it working
  when changing status bar markup or styles.
