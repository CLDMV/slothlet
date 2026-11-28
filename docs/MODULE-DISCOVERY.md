# Module Discovery + Mount

Slothlet's module discovery + mount pipeline composes subsystems shipped as separate npm packages into a host's api tree at runtime. Each module package ships a `slothlet.module.json` manifest declaring where it mounts; slothlet walks the filesystem, validates the manifests, and grafts each module onto the host's api tree via the existing `api.slothlet.api.add()` primitive.

The entire surface lives at **`api.slothlet.api.modules.*`** — composable pieces that can be used end-to-end or step-by-step.

## When to use this

Use module discovery when a host project pulls in subsystems as independent npm packages and wants to compose them into the runtime api tree without hand-wiring each one. Common shapes:

- A consumer app loads multiple drivers from `@org/driver-*` packages
- A core framework picks up extensions matching a name prefix
- A monorepo workspace composes packages from sibling folders

If you're loading slothlet modules from local source files in a single repo, you don't need this — the existing `api.slothlet.api.add(apiPath, folderPath)` is simpler.

---

## Quick start

```js
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ base: "./api" });

// Discover, sort, and mount everything matching the convention in one call:
await api.slothlet.api.modules.add({
	discover: { root: process.cwd(), prefix: "@cldmv/packrat-driver-" }
});

// Now any discovered driver is reachable at its declared mount:
api.drivers.opensearch.connect(/* … */);
```

That's the full flow: `discover()` walks the filesystem, `sort()` orders by priority, `modules.add()` grafts each module onto the api tree.

---

## The manifest: `slothlet.module.json`

Every slothlet module ships a `slothlet.module.json` at the package root:

```json
{
	"schema": 2,
	"mount": ["drivers", "opensearch"],
	"base": "./dist/api",
	"kind": "driver",
	"priority": 100
}
```

| Field          | Required | Description                                                                                                                                                                            |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`       | yes      | `2` — the manifest format.                                                                                                                                                             |
| `mount`        | yes      | Where in the api tree the module mounts. `string` (dot-notation) or `string[]` (segments). Reserved roots `slothlet`, `shutdown`, `destroy` are rejected with `MODULE_RESERVED_MOUNT`. |
| `base`         | yes      | Path inside the package to the slothlet folder. Resolved relative to the package root; path-traversal is rejected with `MODULE_PATH_TRAVERSAL`.                                        |
| `name`         | no       | Documentation only. Source of truth is `package.json`'s `name`. If present in manifest, MUST match — mismatch throws `MODULE_MANIFEST_NAME_MISMATCH`.                                  |
| `version`      | no       | Same rule as `name`. Source of truth is `package.json`'s `version`; mismatch throws `MODULE_MANIFEST_VERSION_MISMATCH`.                                                                |
| `description`  | no       | Falls back to `package.json` description; manifest value silently overrides if present.                                                                                                |
| `kind`         | no       | Free-form category (e.g. `"driver"`, `"extension"`, `"reranker"`). Slothlet stores but does not interpret; the host filters on it via `discover()`'s `filter` callback.                |
| `priority`     | no       | Default-comparator key for `sort()`. Higher first. Defaults to `0`.                                                                                                                    |
| `dependencies` | no       | Module-level dependencies for host-side topological-sort comparators. Slothlet does not enforce semver here.                                                                           |
| `permissions`  | no       | Array of `{caller, target, effect}` rules per slothlet's existing permission grammar. Applied at mount, at the `manifest` layer (#407); see [PERMISSIONS.md](PERMISSIONS.md).          |
| `events`       | no       | Array of `{caller, event, effect}` event-delivery rules (the manifest layer of the event-rule pool; see [EVENTS.md](EVENTS.md)).                                                       |
| `metadata`     | no       | Dedicated block for arbitrary developer extras. The only place unknown-field data goes — unknown top-level fields are rejected with `MODULE_MANIFEST_UNKNOWN_FIELD`.                   |

The canonical JSON Schema is shipped at `schemas/slothlet.module.schema.json` via the package's `exports` map, so editors / CI tooling can `$ref` it:

```jsonc
// In your IDE settings or schema config:
{ "$ref": "@cldmv/slothlet/schemas/slothlet.module.schema.json" }
```

### Format 1 manifests (deprecated)

Manifests written before v4 use `schemaVersion: 1`, `mountPath` and `apiDir` for what format 2 calls `schema: 2`, `mount` and `base`. Format 1 is still read: slothlet maps it to the format 2 names, so `DiscoverResult.manifest`, `metadata` and every API see format 2, and raises `WARNING_MODULE_MANIFEST_FORMAT_1` for each such package during `discover()`. Rename the three fields to remove the warning. A manifest must use one set of names or the other: any format 1 name next to a format 2 name throws `MODULE_MANIFEST_INVALID`, and `schemaVersion` with a value other than `1`, or `schema` with a value other than `2`, throws `MODULE_MANIFEST_FORMAT_UNSUPPORTED`.

### Alternative manifest sources

Projects with existing manifest conventions can point `discover()` at a different file or a nested key:

```js
await api.slothlet.api.modules.discover({
	manifest: "package.json#slothlet"
});

await api.slothlet.api.modules.discover({
	manifest: "manifest.json#backend",
	schema: { mount: "apiPath", base: "apiFolder" }
});
```

The `<file>#<dotted.key>` locator walks the dotted path through the file's JSON. The `schema` option remaps canonical slothlet field names to whatever the legacy manifest calls them. When `schema` is absent under an override locator, slothlet leniently assumes the current format (format 1 when the manifest uses a format 1 field name).

---

## API reference

All methods live at `api.slothlet.api.modules.*`.

### `discover(options?) → Promise<DiscoverResult[]>`

Walks the filesystem for slothlet modules. Returns validated `DiscoverResult[]` and replaces the per-instance discovery cache. Discovery needs Node: in a browser, `discover()`, a `modules.add()` that runs it and a `modules.add(name)` that has to discover are refused with `MODULE_DISCOVERY_REQUIRES_NODE`. Mount modules there with `api.slothlet.api.add()` from the manifest.

```js
const found = await api.slothlet.api.modules.discover({
	root: "/abs/path/to/scan/from",
	manifest: "slothlet.module.json",
	prefix: "@cldmv/packrat-driver-",
	filter: (manifest, packageName) => manifest.kind === "driver"
});
```

**Options:**

| Option     | Default                                                                                   | Description                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `root`     | upward-walk from `process.cwd()` to nearest `node_modules` ancestor (capped at 20 levels) | `string \| string[]` — filesystem path(s) to scan.                                                                          |
| `manifest` | `"slothlet.module.json"`                                                                  | Manifest filename or `<file>#<dotted.key>` locator.                                                                         |
| `schema`   | `{}`                                                                                      | Field-name remap for legacy manifests (canonical → legacy).                                                                 |
| `prefix`   | none                                                                                      | `string \| string[]` — pre-skip filter applied during directory enumeration; matches the full package name including scope. |
| `filter`   | none                                                                                      | `(manifest, packageName) => boolean` — post-validation filter; returning falsy excludes the entry.                          |

**Scan mode auto-detect** (per root):

- If `<root>/node_modules` exists → npm mode (walks `node_modules/*` and `node_modules/@*/*`, one level deep).
- Otherwise → folder mode (walks immediate subfolders of root).

**Dedupe + multi-version:**

- Same real path (symlink aliasing) → silent dedupe; first wins.
- Same package name + different versions → both surface as separate `DiscoverResult` entries.
- Same name + same version + different real paths → throws `MODULE_DUPLICATE_NAME_VERSION_MISMATCH` (unusual; almost certainly a misconfiguration).

**`DiscoverResult`** (frozen):

| Key        | Description                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `package`  | Package name from `package.json`.                                                              |
| `folder`   | Absolute path of the package folder.                                                           |
| `base`     | Absolute path of the manifest's `base` folder.                                                 |
| `mount`    | Mount segments, always an array (a dot-notation `mount` string is split).                      |
| `manifest` | The validated manifest, deep-frozen, under the format 2 names (format 1 manifests are mapped). |

### `sort(results, comparator?) → DiscoverResult[]`

Pure function. Returns a new array sorted by the chosen comparator.

**Default comparator:** `manifest.priority` descending, `package` ascending as tiebreak.

```js
const ordered = api.slothlet.api.modules.sort(found);

// Custom comparator:
const alpha = api.slothlet.api.modules.sort(found, (a, b) => a.package.localeCompare(b.package));
```

### `add(target?, options?) → Promise<MountResult | MountResult[] | { mounted, failed }>`

Mounts modules. The target says what to mount:

| Target                                                          | Mounts                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| a package name                                                  | that module, looked up in the discovery cache (`discover()` runs first when the cache is empty)      |
| a result this instance's `discover()` or `cache.get()` returned | that module                                                                                          |
| an array of names and results                                   | the batch                                                                                            |
| nothing, or only an options object                              | every module `discover()` finds (with `options.discover`), ordered by `sort()` (with `options.sort`) |

Only results this instance's discovery returned count as a result: a result is recognised by identity, never by its shape. Any other object is the options, so `add({ discover: { prefix: "@org/" } })` is a discover run, and an object you built yourself is never mounted as a module.

```js
// One module, by name: looks it up in the cache; runs discover() if the cache is empty
await api.slothlet.api.modules.add("@cldmv/packrat-driver-opensearch");

// One module, from a result discover() returned
await api.slothlet.api.modules.add(found[0]);

// One module, with options
await api.slothlet.api.modules.add("@org/foo", {
	collision: { mode: "error" },
	version: "1.4.2" // disambiguator when multiple versions are cached
});

// A batch
await api.slothlet.api.modules.add(["@org/foo", someDiscoverResult, "@org/bar"], {
	collision: { mode: "error" },
	failure: "best-effort",
	concurrency: 4
});

// Discover, sort and mount everything found
await api.slothlet.api.modules.add({
	discover: { root: process.cwd(), prefix: "@cldmv/packrat-driver-" },
	sort: (a, b) => a.package.localeCompare(b.package),
	collision: { mode: "error" },
	failure: "best-effort"
});
```

**Options:**

| Option        | Default   | Applies to              | Description                                                                                                                                                                                                                            |
| ------------- | --------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collision`   | `"merge"` | all                     | `collision.mode` (or the mode as a bare string): one of `"skip" \| "warn" \| "replace" \| "merge" \| "merge-replace" \| "error"`. When `"error"`, throws `MODULE_MOUNT_COLLISION` if the exact mount is already occupied.              |
| `version`     | none      | one module              | Disambiguator when the cache holds multiple versions of `name`.                                                                                                                                                                        |
| `discover`    | `{}`      | a name, a discover run  | The `discover()` options: for the discover run, and for the lazy `discover()` a name triggers when the cache is empty.                                                                                                                 |
| `failure`     | `"throw"` | a batch, a discover run | `"throw"` (default — throw on first failure, mounted entries remain), `"rollback"` (throw + best-effort unmount of entries mounted in this call), or `"best-effort"` (continue past failures, return `{ mounted, failed }` aggregate). |
| `concurrency` | `1`       | a batch, a discover run | Mount concurrency. `1` (default) = serial. `Infinity` = all-at-once via `Math.min(concurrency, items.length)`. Lifecycle event order tracks completion order under `concurrency > 1`.                                                  |
| `sort`        | priority  | a discover run          | Comparator for the found results (see `sort()`).                                                                                                                                                                                       |

**Return shape:** one module → `MountResult`. A batch or a discover run → `MountResult[]` under `"throw"` / `"rollback"`, `{ mounted: MountResult[], failed: FailureEntry[] }` under `"best-effort"`.

**`MountResult`**:

| Key       | Description                                                                                  |
| --------- | -------------------------------------------------------------------------------------------- |
| `module`  | The module id the mount was registered under.                                                |
| `package` | The package name.                                                                            |
| `mount`   | Mount segments as an array, including the `vMAJOR` prefix when the module mounted versioned. |
| `found`   | The `DiscoverResult` the module was mounted from.                                            |
| `version` | `{ default, tag }` when the module mounted under a version prefix, otherwise `null`.         |

**Multi-version routing:** when two or more resolved items share a `package` with different `version`s, every entry in that group routes through slothlet's versioned mount (`api.add`'s `version` option) — each lands at `vMAJOR.<mountPath>` and the highest semver becomes the registered default. See [VERSIONING.md](VERSIONING.md) for the underlying mechanism.

### `remove(name, opts?) → Promise<boolean>`

Unmounts a previously-mounted module. Returns `true` if anything was unmounted.

```js
await api.slothlet.api.modules.remove("@org/foo");

// Disambiguate when multi-version mounts exist:
await api.slothlet.api.modules.remove("@org/foo", { version: "1.4.2" });
```

### Cache inspection

```js
api.slothlet.api.modules.cache.get(); // → DiscoverResult[]
api.slothlet.api.modules.cache.clear(); // → void; does not unmount anything
api.slothlet.api.modules.stale(); // → MountResult[] — mounted modules no longer in cache
```

`stale()` enables reconciliation after re-discovery. When the host re-runs `discover()` (e.g. after `pnpm install` / `pnpm uninstall`), modules that were previously mounted but no longer appear in the new cache are flagged as stale. The host decides whether to call `modules.remove()` on each.

---

## Lifecycle events

Five `modules:*` events emit through slothlet's standard lifecycle handler (subscribe via `api.slothlet.lifecycle.on(name, handler)`). See [LIFECYCLE.md — Module Discovery Events](LIFECYCLE.md#module-discovery-events) for full payload shapes.

| Event                       | When                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| `modules:discover-start`    | Beginning of `discover()`                                              |
| `modules:discover-complete` | After cache replacement; payload includes `stale[]` for reconciliation |
| `modules:mount-start`       | Beginning of `modules.add`'s mount phase                               |
| `modules:mount-complete`    | Once per successfully mounted module                                   |
| `modules:loaded`            | After the helper's full async chain settles                            |

```js
api.slothlet.lifecycle.on("modules:loaded", ({ mounted, failed }) => {
	console.log(`mounted ${mounted.length} modules; ${failed?.length ?? 0} failed`);
});

// Stale mounts come from re-discovery, not from a mount: they are on modules:discover-complete.
api.slothlet.lifecycle.on("modules:discover-complete", ({ stale }) => {
	console.log(`${stale.length} mounted modules are no longer installed`);
});
```

---

## Error reference

All errors throw `SlothletError` with typed codes. See `src/lib/i18n/languages/en-us.json` for the canonical messages and hints (translated across all 12 supported locales).

| Code                                     | When                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `MODULE_MANIFEST_INVALID`                | Manifest fails JSON parse or schema validation                                 |
| `MODULE_MANIFEST_UNKNOWN_FIELD`          | Unrecognized top-level field in manifest — use the `metadata` block for extras |
| `MODULE_MANIFEST_NAME_MISMATCH`          | Manifest `name` disagrees with `package.json`                                  |
| `MODULE_MANIFEST_VERSION_MISMATCH`       | Manifest `version` disagrees with `package.json`                               |
| `MODULE_PATH_TRAVERSAL`                  | `base` resolves outside the package root                                       |
| `MODULE_MANIFEST_FORMAT_UNSUPPORTED`     | `schema` not `2`, or `schemaVersion` not `1`                                   |
| `MODULE_PACKAGE_NOT_FOUND`               | `modules.add(name)` and name isn't in the cache after discovery                |
| `MODULE_RESERVED_MOUNT`                  | Manifest claims a reserved root (`slothlet`, `shutdown`, `destroy`)            |
| `MODULE_DUPLICATE_NAME_VERSION_MISMATCH` | Same package name + version at multiple real paths (G7 case 3)                 |
| `MODULE_MOUNT_COLLISION`                 | Pre-flight detects exact-mount collision and `collision: { mode: "error" }`    |
| `MODULE_DISCOVERY_REQUIRES_NODE`         | Discovery was asked for in a browser, which has no filesystem to walk          |

---

## Round-tripping the manifest

Each successfully mounted module keeps its full normalized manifest, and [`slothlet.node(target)`](METADATA.md#node-reports) reports it as `manifest` for every node of the module. It is not metadata: user metadata never carries it.

```js
api.slothlet.node("drivers.opensearch").manifest;
// { schema: 2, name: "@cldmv/packrat-driver-opensearch", version: "1.4.2", ... }

api.slothlet.node("drivers.opensearch.connect").manifest;
// The same manifest: the leaf belongs to the same module
```

This is useful for "what module am I in?" introspection from inside module code.

---

## See also

- [LIFECYCLE.md — Module Discovery Events](LIFECYCLE.md#module-discovery-events) — event payloads and ordering
- [VERSIONING.md](VERSIONING.md) — the versioned mounts (`api.add`'s `version` option) used for multi-version mounts
- [METADATA.md](METADATA.md) — `metadata.get()` and the manifest round-trip
- [PERMISSIONS.md](PERMISSIONS.md) — the permission rule grammar used by the manifest's `permissions[]` field
- [MODULE-STRUCTURE.md](MODULE-STRUCTURE.md) — what a slothlet module looks like internally
- `schemas/slothlet.module.schema.json` — canonical JSON Schema for editor / CI validation
