# AGENTS.md

Chroma is a dependency-light tmux status theme for macOS and Linux.

## Project structure

- `chroma.tmux`: executable TPM entrypoint and theme implementation.
- `scripts/`: bundled CPU, memory, and disk status helpers.
- `docs/index.html`: dependency-free GitHub Pages site and interactive
  preview; terminal-session layout where the fixed status-line dock doubles
  as page navigation.
- `test/`: shell and live tmux regression tests.

## Commands

```sh
make format
make lint
make test
make check
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
- The HTML docs duplicate preset names, base colors, and the `base_alt` mix
  formula from `chroma.tmux`. Update them together and run `make test`.
- Keep the GitHub Pages site static and usable without a build step.
- The preview status bar mirrors tmux cell geometry: segment spacing comes
  from literal space characters in the format strings under
  `white-space: pre`, never CSS padding. The fixed dock scrolls
  horizontally instead of wrapping on narrow viewports. `test/site.sh`
  enforces the no-padding rule.
- Use `https://jimeh.github.io/tmux-chroma/` as the canonical site URL.
  The personal site runs on Cloudflare Workers, so keep the legacy
  `jimeh/jimeh.github.io` Pages custom domain and `CNAME` unset; otherwise
  GitHub redirects all project Pages through the unrelated personal-site
  origin.
- Preserve keyboard focus, mobile overflow handling, and reduced-motion
  behavior when changing the site.
