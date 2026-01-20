# V2 vs V3 Gap List (Working)

Last updated: 2026-01-19

## Sources Reviewed

- [BREAKING-CHANGES-V3.md](BREAKING-CHANGES-V3.md)
- [V3-API-STRUCTURE-ISSUES.md](V3-API-STRUCTURE-ISSUES.md)
- [docs/HOOKS.md](docs/HOOKS.md)
- [docs/SANITIZATION.md](docs/SANITIZATION.md)
- [docs/API-FLATTENING.md](docs/API-FLATTENING.md)
- [docs/MODULE-STRUCTURE.md](docs/MODULE-STRUCTURE.md)
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md)
- [BUGS.md](BUGS.md)
- [AGENT-USAGE.md](AGENT-USAGE.md)
- Recent git history (last 50 commits)

## Still Missing or Incomplete in V3

1. Hooks system (API surface and runtime behavior)
   - V2 provides full hooks API and configuration; V3 currently missing entirely.
   - Source: [V3-API-STRUCTURE-ISSUES.md](V3-API-STRUCTURE-ISSUES.md)
   - Related details: [docs/HOOKS.md](docs/HOOKS.md)
   - Feature set (from docs + v2 code/tests):
     - Hook types: before, after, always, error
     - Hook registration: api.hooks.on(tag, type, handler, { pattern, priority, subset, id })
     - Hook removal: api.hooks.off(nameOrPattern)
     - Hook management: api.hooks.enable(pattern?), api.hooks.disable(pattern?), api.hooks.clear(type?)
     - Hook listing: api.hooks.list(type?) with enabled patterns + registration metadata
     - Pattern matching: glob patterns (*, **), braces {a,b}, negation (!pattern)
     - Priority ordering: higher priority first, then registration order
     - Subset phases: before → primary → after within each hook type (git: feat(hooks) subset system)
     - Before hooks: can mutate args (return array) or short-circuit (return value)
     - After hooks: transform return value (chaining)
     - Always hooks: run regardless of success/error; read-only observer
     - Error hooks: receive error context with source (before/function/after/always), hook id/tag, stack, timestamp
     - Error suppression option: hooks.suppressErrors flag to report errors without throwing (docs)
     - Pattern-filtered execution: enable/disable specific path patterns
     - Cleanup: hook manager cleanup on shutdown to avoid leaks
     - Debug hooks/tests: hooks debug logging + internal property tests (see hooks test suite)

## Verified Parity (via inspect-api-structure, eager)

1. Acronym casing present in v3 output (autoIP, parseJSON, getHTTPStatus)
   - Verified in v3 eager inspect output: [tmp/v3-inspect-eager.txt](tmp/v3-inspect-eager.txt)
   - Baseline v2 output: [tmp/v2-inspect-eager.txt](tmp/v2-inspect-eager.txt)

2. Single named-export auto-flattening parity (parseJSON-style files)
   - Verified in v3 eager output: api.task.parseJSON()
   - Baseline v2 output: api.task.parseJSON()
   - Evidence: [tmp/v3-inspect-eager.txt](tmp/v3-inspect-eager.txt), [tmp/v2-inspect-eager.txt](tmp/v2-inspect-eager.txt)

3. Underscore handling (multi_defaults/multi_func)
   - V3 eager output preserves underscores: api.multi_defaults.*, api.multi_func.*
   - Matches v2 eager output naming
   - Evidence: [tmp/v3-inspect-eager.txt](tmp/v3-inspect-eager.txt), [tmp/v2-inspect-eager.txt](tmp/v2-inspect-eager.txt)

## Lazy Verification Notes

1. V2 lazy inspection completed successfully
   - Evidence: [tmp/v2-inspect-lazy.txt](tmp/v2-inspect-lazy.txt)

2. V3 lazy inspection completed successfully after proxy fix
   - Evidence: [tmp/v3-inspect-lazy.txt](tmp/v3-inspect-lazy.txt)

## Fixed or Closed Items (Per Docs/Git)

- Root contributor pattern for callable root API
- Root-level methods attached to root callable function
- Mixed default + named export handling
- Logger callable namespace fix
- Folder/folder.mjs flattening behavior

Status and rationale recorded in [V3-API-STRUCTURE-ISSUES.md](V3-API-STRUCTURE-ISSUES.md) and [BREAKING-CHANGES-V3.md](BREAKING-CHANGES-V3.md).

## Design Changes (Not Missing, But Breaking)

- Built-in methods moved under api.slothlet.* with diagnostics under api.slothlet.diag.*
- Diagnostics now gated by diagnostics: true config
- Runtime reference export removed
- Metadata API import path changed

Details in [BREAKING-CHANGES-V3.md](BREAKING-CHANGES-V3.md).

## Notes / Verification TODOs

- Re-run V2 vs V3 structure inspection for acronyms and single-export flattening.
- Cross-check underscore handling on multi_defaults/multi_func scenarios.
