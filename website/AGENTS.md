# Website guidance

The website is a Vite + Preact TypeScript app deployed as static assets through
Cloudflare Workers Builds. Static prose lives in `index.html`; interactive
islands mount from `src/main.tsx` and share state through `@preact/signals`.

## Tasks and generated files

Run website tasks from the repository root through mise:

```sh
mise run dev
mise run generate
mise run typecheck
mise run test:web
mise run test:browser
mise run build
```

`chroma.tmux` is the authored color source. `mise run generate` creates ignored
files under `.generated/`; dev, typecheck, test, and build generate them before
use. Never hand-edit or commit generated colors. Bun tests compare the browser
runtime and pre-paint resolver with `chroma.tmux --resolve-colors`; Playwright
smoke tests exercise critical behavior in Chromium.

Production publishes from `main` to `chroma.jimeh.dev`; non-production branches
upload preview versions and receive links in pull requests. The `dist` output is
gitignored and must never be committed.

## Architecture and behavior

- Keep runtime dependencies limited to `preact` and `@preact/signals`. Build and
  validation tooling belongs in `devDependencies` or `mise.toml`.
- Keep source in strict TypeScript. Prose stays in `index.html` so it renders
  without JavaScript; components own only interactive islands.
- The one theme control is the `@chroma_background` dropdown in the live conf
  block, plus its custom background input. The page, dock, and gallery re-theme
  together. Dark is the default regardless of the system color scheme. The
  fixed README preview resolves each tile independently.
- A persisted background can be `dark`, `light`, a named theme, or a custom
  `#rrggbb` seed. A persisted `@chroma_mode` override forces palette mode. The
  generated inline pre-paint script resolves both before styles paint.
- Custom background surfaces and muted/subtle text tones derive from the seed
  using the same generated constants as the plugin. The deterministic
  four-background preview is the README screenshot source.
- The preview status bar mirrors tmux cell geometry. Segment spacing comes from
  literal spaces under `white-space: pre`, never CSS padding. The fixed dock
  scrolls horizontally instead of wrapping on narrow viewports.
- One `StatusBar` component renders dock, gallery, and README preview bars.
  Keyed window items keep focused dock buttons attached across re-renders for
  overlay focus restoration.
- Preserve keyboard focus, mobile overflow, and reduced-motion behavior.
- Keep mobile text inputs at a computed 16px or larger. iPhone Safari zooms
  focused controls below that threshold; do not disable user viewport scaling.
- Anchor conf dropdown geometry to the selected option only when opening.
  Hover and keyboard changes may scroll the active row into view, but must not
  reposition the popup or it will walk under the pointer and cascade hovers.
- iOS Safari paints a scroll container background on its moving content layer.
  Every scrolling region therefore lives inside a non-scrolling shell with the
  same background: `.block-scroll`, `.status-dock-scroll`, and
  `.conf-select-scroll`.
- Conf-block values and the auto-host preview persist in localStorage under
  `chroma-*` keys only while non-default. Runtime prefix and sync signals remain
  session-only. A reset line appears while any persisted setting differs.
- The preset gallery opens with Ctrl-b or Ctrl-q followed by w and renders one
  status line per accent.
- Prefix+p opens the deterministic README preview: dark, light,
  solarized-dark, and solarized-light tiles with block and Powerline bars. Keep
  the peach, blue, green, and mauve accent sequence and shared
  `resolveBackground` path intact.

## Deployment

Use `https://chroma.jimeh.dev/` as the canonical URL. Keep the custom domain and
static asset directory in `wrangler.jsonc`; do not add a GitHub Pages `CNAME`.
Workers preview URLs stay enabled while the public `workers.dev` production
route remains disabled.
