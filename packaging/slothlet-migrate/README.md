# @cldmv/slothlet-migrate

Moves a project from [`@cldmv/slothlet`](https://github.com/CLDMV/slothlet) v3 to v4: the `slothlet()` config, method calls and their options, permission rule targets, imports, error codes, `slothlet.module.json` files and the `slothlet typegen` flags in `package.json`.

v4 rejects v3 names outright (an unknown config or option key is an error), so nothing is left half-migrated in silence. The tool rewrites what it can prove from the code in front of it and reports everything else with the file, line and v4 replacement. It never guesses.

## Run it

```sh
npx @cldmv/slothlet-migrate            # dry run over the current folder: prints a diff and the findings
npx @cldmv/slothlet-migrate src test   # only these paths
npx @cldmv/slothlet-migrate --write    # apply the rewrites
```

Folders are searched for `.js` / `.mjs` / `.cjs` files, `slothlet.module.json` and `package.json`, skipping `node_modules`, `dist`, `coverage` and dot-folders. TypeScript files are listed but not rewritten.

| Option            | What it does                                                                            |
| ----------------- | --------------------------------------------------------------------------------------- |
| `--write`         | apply the rewrites (without it nothing on disk changes)                                 |
| `--config <file>` | also migrate `<file>` as a slothlet config JSON (repeatable)                            |
| `--callee <name>` | treat `<name>(config)` like `slothlet(config)`, for a helper that wraps it (repeatable) |
| `--json`          | print the results as JSON                                                               |
| `--no-diff`       | do not print diffs                                                                      |
| `--no-info`       | hide behaviour notes                                                                    |

The exit code is `0`, `1` when a file could not be parsed, and `2` for a usage error.

## What you get back

Every finding has a level:

- **rewrite**: changed in place (or would be, in a dry run).
- **manual**: needs a hand edit. The tool saw a v3 name but could not prove what it is, for example an options object built in another file, a destructured method, or a code string that is not compared with `err.code`.
- **info**: a v4 behaviour change worth checking; there is nothing to edit (for example `routines.auto` now defaults to `true`).

```text
src/app.mjs:4:2  rewrite dir → base
    dir → base
src/app.mjs:9:18  manual  <node>.__type → api.slothlet.node(<node>).type
    Nodes carry no framework keys in v4. Compare against slothlet.types.*.
```

## What it rewrites

- Config objects passed to `slothlet()` (and `const` objects they use, by name or spread), and config JSON files given with `--config`: renamed and regrouped keys, `allowMutation`, `scanHiddenFolders`, the `routines` array, the per-phase `api.collision` form.
- Method paths on `api.slothlet` / `self.slothlet` that were renamed, moved or folded, including `control.enable()` → `control.mode("on")`.
- Method options: `api.add` (its 4th argument folds into `options.version`), `modules.add*`, `hook.on` (the `"before:path"` pattern form too), `reload({ keepInstanceID })`, `leaves`, `principal.register`, and `generate()` from `@cldmv/slothlet/typegen`.
- `api.remove(moduleID, apiPath)` → `api.remove(apiPath, moduleID)` when the file mounts that module id; otherwise it is reported.
- Permission rule targets (`{ target: "slothlet.…", effect }`) that name a renamed method. A target whose method was folded into a broader one is reported, because rewriting it would widen the rule.
- Imports whose name or path changed, keeping your local name (`import { generate as generateTypes }`).
- Error codes compared with `err.code`, matched in a `switch`, or matched against the error message; `err.context` → `err.details` where the value is provably a slothlet error.
- `slothlet.module.json` format 1 → 2, and `slothlet typegen` flags and the `slothlet.typegen` keys in `package.json`.

Running it again on migrated code changes nothing.

## Use it from code

```js
import { migrateSource, migrateJson, migrateFile } from "@cldmv/slothlet-migrate";

const { code, findings } = migrateSource(source, { filename: "app.mjs" });
```

This package is built and published from the [slothlet](https://github.com/CLDMV/slothlet) repository in lockstep with `@cldmv/slothlet`.
