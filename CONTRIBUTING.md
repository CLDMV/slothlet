# Contributing to Slothlet

Thank you for your interest in contributing to Slothlet!

## Development Setup

1. Fork and clone the repository (maintainers may clone directly).
2. Install dependencies: `npm install`
3. Run the full test suite: `npm run vitest`
4. Run the coverage gate (Slothlet holds 100%): `npm run coverage`

You do **not** need to export any environment variables. The test tooling selects the correct module-resolution condition per invocation on its own — `npm run vitest` and `npm run coverage` exercise `src/` automatically, and the post-build type checks resolve against `dist/`. Do **not** globally `export NODE_OPTIONS=--conditions=slothlet-dev` (or set `NODE_ENV` by hand): a global `slothlet-dev` condition forces source-mode resolution onto every process and breaks the dist-mode / post-build test paths (the test config even strips an inherited one). When you need to run a one-off script against `src/`, pass the condition to that single command instead: `node --conditions=slothlet-dev path/to/script.mjs`.

## Making Changes

Slothlet uses the CLDMV v4 staging-branch flow — work integrates on `next`, and `master` is the last shipped release.

1. Branch from **`next`**, not `master`, using a conventional-commit prefix: `fix/…`, `feat/…`, `docs/…`, `test/…`, `chore/…`, `refactor/…`, `perf/…`, or `ci/…`.
2. Make your changes and add or update tests as needed (test files are named `*.test.vitest.mjs` — see [Testing New Features](#testing-new-features)).
3. Ensure the suite passes: `npm run vitest` (or a subset — see below).
4. Run the formatter and linter before committing: `npm run format` then `npm run lint`. A precommit hook runs `lint` + `format:check` and rejects a commit that isn't clean, so running these first avoids a surprise.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit message — the release automation derives the version bump from them (`feat` → minor, `fix`/`perf` → patch, a `!` / `BREAKING CHANGE:` → major).
6. Push the branch and open a pull request **targeting `next`**. Maintainers pushing a prefixed branch to the repo get a PR auto-opened into `next`; external contributors open the PR from their fork against `next`. Never push directly to `next` or `master`.

Merged PRs accumulate on `next`; a release ships when the persistent `next → master` pull request is merged (CI computes the version and publishes).

## Test Commands

Run tests through the npm scripts, never `npx vitest` directly — the runner carries the worker/heap and resolution setup the suite needs. Target a subset with the script's passthrough: `npm run vitest -- <pattern>` (e.g. `npm run vitest -- suites/handlers/ownership`).

| Command                    | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `npm run vitest`           | Full vitest suite across all feature suites (`*.test.vitest.mjs`)     |
| `npm run vitest -- <pat>`  | Run a subset by path/name pattern                                     |
| `npm run coverage`         | Full node + browser coverage, merged — the 100% gate                  |
| `npm run debug`            | Quick smoke tests and syntax validation                               |
| `npm run analyze`          | Code quality checks: translations, headers, debug conventions, throws |
| `npm run test:node`        | Node.js integration tests                                             |
| `npm run test:performance` | Performance benchmarks                                                |
| `npm run test:types`       | TypeScript declaration validation                                     |
| `npm run lint`             | ESLint across source and tests                                        |
| `npm run format`           | Prettier write across the repo                                        |

## API Transformation Rules

When modifying API generation logic, refer to the technical references in `docs/API-RULES/`:

- **[`docs/API-RULES.md`](docs/API-RULES.md)** - Index of all 13 API transformation rules
- **[`docs/API-RULES/API-RULES-CONDITIONS.md`](docs/API-RULES/API-RULES-CONDITIONS.md)** - Complete reference for all C01–C34 conditionals
- **[`docs/API-RULES/API-FLATTENING.md`](docs/API-RULES/API-FLATTENING.md)** - Flattening rules F01–F08 with decision trees
- **[`docs/API-RULES/API-RULE-MAPPING.md`](docs/API-RULES/API-RULE-MAPPING.md)** - Traceability matrix mapping rules to code and tests

These documents ensure that changes to API generation logic maintain consistency with existing behavior and don't introduce regressions.

## Code Style

- Follow existing code style throughout the file you are editing
- Use meaningful variable and function names
- Add JSDoc comments for all new functions and methods
- All JS files in `src/` must include the standard file header (see any existing `src/` file)
- Ensure TypeScript declaration types are accurate when modifying public APIs — and note that JSDoc `@param`/`@returns` types must parse under **both** tsc and jsdoc2md, so prefer Closure-style function types (`function(T): R`) over TypeScript arrow types with function-typed parameters
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) format

## i18n Conventions

All user-facing error messages, debug messages, and warnings must go through the i18n system:

- Error codes use `new SlothletError("CODE", context)` - keys must exist in `src/lib/i18n/languages/en-us.json`
- Debug calls use `this.debug("category", { key: "DEBUG_MODE_KEY", ...params })` - no hardcoded message strings
- Run `npm run analyze` to catch missing translations, placeholder mismatches, and hardcoded strings

See [`docs/I18N.md`](docs/I18N.md) for the full i18n system documentation.

## Testing New Features

- Add vitest tests under `tests/vitests/suites/<feature>/`, named `*.test.vitest.mjs`
- For API transformation rule changes: update the relevant `docs/API-RULES/` files and ensure `rule-coverage.test.vitest.mjs` still passes
- For new config options: update `docs/CONFIGURATION.md`
- For public API surface changes: update the relevant `docs/` doc; the per-version changelog and README "What's New" are authored separately at release time, not in the feature PR

## Questions?

Feel free to open an issue for questions or discussion before starting work on significant changes.
