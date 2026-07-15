# AGENTS.md

Chroma is a dependency-light tmux status theme for macOS and Linux.

## Project structure

- `chroma.tmux`: executable TPM entrypoint and theme implementation.
- `scripts/`: bundled CPU, memory, and disk status helpers.
- `docs/index.html`: dependency-free GitHub Pages site and live preview.
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
- `docs/index.html` duplicates preset names, base colors, and the
  `base_alt` mix formula from `chroma.tmux`. Update both together and run
  `make test`.
- Keep the GitHub Pages site static and usable without a build step.
- Preserve keyboard focus, mobile overflow handling, and reduced-motion
  behavior when changing the site.
