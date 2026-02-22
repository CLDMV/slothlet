# Contributing to Slothlet

Thank you for your interest in contributing to Slothlet!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Configure the development environment:
   ```sh
   export NODE_ENV=development
   export NODE_OPTIONS=--conditions=slothlet-dev
   ```
4. Run the full test suite: `npm run vitest`
5. Run the debug/smoke tests: `npm run debug`
6. Run the quality analyzer: `npm run analyze`

## Making Changes

1. Create a feature branch from `master`
2. Make your changes
3. Add or update tests as needed
4. Ensure all tests pass: `npm run vitest`
5. Ensure the debug suite passes: `npm run debug`
6. Ensure the quality analyzer reports no issues: `npm run analyze`
7. Ensure linting passes: `npm run lint`
8. Submit a pull request

## Test Commands

| Command | Purpose |
|---------|---------|
| `npm run vitest` | Full vitest suite (4000+ tests across all feature suites) |
| `npm run debug` | Quick smoke tests and syntax validation |
| `npm run analyze` | Code quality checks: translations, headers, debug conventions, throws |
| `npm run test:node` | Node.js integration tests |
| `npm run test:performance` | Performance benchmarks |
| `npm run test:types` | TypeScript declaration validation |
| `npm run lint` | ESLint across source and tests |

## API Transformation Rules

When modifying API generation logic, refer to the technical references in `docs/API-RULES/`:

- **[`docs/API-RULES.md`](docs/API-RULES.md)** — Index of all 13 API transformation rules
- **[`docs/API-RULES/API-RULES-CONDITIONS.md`](docs/API-RULES/API-RULES-CONDITIONS.md)** — Complete reference for all C01–C34 conditionals
- **[`docs/API-RULES/API-FLATTENING.md`](docs/API-RULES/API-FLATTENING.md)** — Flattening rules F01–F08 with decision trees
- **[`docs/API-RULES/API-RULE-MAPPING.md`](docs/API-RULES/API-RULE-MAPPING.md)** — Traceability matrix mapping rules to code and tests

These documents ensure that changes to API generation logic maintain consistency with existing behavior and don't introduce regressions.

## Code Style

- Follow existing code style throughout the file you are editing
- Use meaningful variable and function names
- Add JSDoc comments for all new functions and methods
- All JS files in `src/` must include the standard file header (see any existing `src/` file)
- Ensure TypeScript declaration types are accurate when modifying public APIs
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) format

## i18n Conventions

All user-facing error messages, debug messages, and warnings must go through the i18n system:

- Error codes use `new SlothletError("CODE", context)` — keys must exist in `src/lib/i18n/languages/en-us.json`
- Debug calls use `this.debug("category", { key: "DEBUG_MODE_KEY", ...params })` — no hardcoded message strings
- Run `npm run analyze` to catch missing translations, placeholder mismatches, and hardcoded strings

See [`docs/I18N.md`](docs/I18N.md) for the full i18n system documentation.

## Testing New Features

- Add vitest tests under `tests/vitests/suites/<feature>/`
- For API transformation rule changes: update the relevant `docs/API-RULES/` files and ensure `rule-coverage.test.vitest.mjs` still passes
- For new config options: update `docs/CONFIGURATION.md`
- For public API surface changes: update the relevant `docs/` doc and the v3 changelog

## Questions?

Feel free to open an issue for questions or discussion before starting work on significant changes.
