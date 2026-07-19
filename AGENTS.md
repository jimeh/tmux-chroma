# AGENTS.md

Chroma is a dependency-light tmux status theme for macOS and Linux.

## Project map

- `chroma.tmux`: executable TPM entrypoint, theme implementation, and the
  authored source for all color data.
- `scripts/`: bundled CPU, memory, and disk status helpers.
- `test/`: Bun contract tests plus a live tmux regression test.
- `website/`: Vite + Preact site and interactive preview. See
  `website/AGENTS.md` before changing it.

TPM installs clone the whole repository. Never commit generated website output,
vendored dependencies, or other artifacts that would inflate plugin installs.

## Tasks

Mise owns tool versions and the complete task surface. Bun is the only
JavaScript runtime.

```sh
mise run setup
mise tasks
mise run check
mise run verify
```

Use `mise run check` for normal iteration. It runs formatting checks, linters,
typechecking, Bun tests, and the live tmux smoke test. Use `mise run verify`
before handoff; it also builds the production website and audits GitHub Actions.
Run targeted tasks such as `test:web`, `test:tmux`, `lint:web`, or `build` while
iterating. Every task has a description in `mise tasks`.

## Global conventions

- Keep the plugin compatible with Bash 4.2 on Linux and macOS system Bash.
- Avoid dependencies when a small shell implementation is sufficient.
- Treat repeated tmux config loads as a first-class behavior. Theme loading
  must be idempotent.
- Test rendered tmux options in an isolated server; text inspection alone is
  insufficient for status-format behavior.
- Run Powerline assertions under a UTF-8 locale. Older tmux versions do not
  preserve divider glyphs in a plain `C` locale.
- `chroma.tmux` is the single authored source for presets, named backgrounds,
  neutral anchors, and resolution constants. Its `--dump-colors` mode emits the
  versioned JSON schema without tmux, and `--resolve-colors` exposes the real
  shell resolver for parity tests. Run `mise run test:web` after changing the
  schema or resolver.
- Document surprising project-specific discoveries here or in the applicable
  subtree instructions. Prefer an executable regression check when possible.
