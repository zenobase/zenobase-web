# Dependency upgrade pass

Each item below is one commit. PR description: before/after version table,
decisions on any major-version bumps, follow-up notes.

## Policy

- **24-hour cool-down**: do not apply any release less than 24 hours old.
- **Majors**: for each available major-version bump, summarize what changed
  (breaking changes, new features, migration effort) and ask whether to go
  ahead, skip, or defer. Record the decision and reasoning in the PR.
- Run `pnpm audit` to surface CVE findings.

## Upgrades

- **npm packages** in `package.json`; include updated snapshots (Vuetify minor
  bumps often change rendered HTML — update with `vitest run --update` and
  review diffs before committing)
- **Biome** — `@biomejs/biome` is pinned to an exact version; bump manually
  and run `biome migrate --write` to update `biome.json`; include any
  reformatted source files in the same commit
- **Infra packages** in `infra/package.json`
- **GitHub Actions** in `.github/workflows/`
- **Node.js / pnpm** — `.nvmrc` and the `engines` field in `package.json`, and
  GitHub Actions
