# AGENTS.md

Chroma is a dependency-light tmux status theme for macOS and Linux.

## Project map

- `chroma.tmux`: executable TPM entrypoint, theme implementation, and the
  authored source for all color data.
- `scripts/`: bundled CPU, memory, and disk status helpers plus release
  packaging.
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

## Releases

Release Please opens and maintains the release PR from Conventional Commit PR
titles. Merging that PR creates a `v*` tag and draft GitHub release, calls the
release workflow, uploads the minimal plugin ZIP, verifies it, and publishes the
release.

The release config deliberately uses the `go` strategy because Chroma has no
language package manifest. Its generic extra-file updater keeps
`CHROMA_VERSION` in `chroma.tmux` aligned with the release manifest, generated
`CHANGELOG.md`, tags, and GitHub releases. The first release is `v0.1.0`.

`mise run release:package` creates the deterministic
`dist/tmux-chroma-<version>.zip`. Keep its contents limited to `chroma.tmux`,
the three metric helpers, README, license, and changelog. `mise run
test:package` asserts the exact contents, source parity, executable modes, and
reproducibility.

The workflow authenticates as the release bot so its PRs trigger normal checks.
It requires the `RELEASE_BOT_CLIENT_ID` repository variable and
`RELEASE_BOT_PRIVATE_KEY` repository secret.

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
