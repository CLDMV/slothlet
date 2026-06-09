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

const api = await slothlet({ dir: "./api" });

// Discover, sort, and mount everything matching the convention in one call:
await api.slothlet.api.modules.addDiscovered({
	scanRoot: process.cwd(),
	prefix: "@cldmv/packrat-driver-"
});

// Now any discovered driver is reachable at its declared mountPath:
api.drivers.opensearch.connect(/* … */);
```

That's the full flow: `discover()` walks the filesystem, `sort()` orders by priority, `addModules()` grafts each module onto the api tree.

---

## The manifest: `slothlet.module.json`

Every slothlet module ships a `slothlet.module.json` at the package root:

```json
{
	"schemaVersion": 1,
	"mountPath": ["drivers", "opensearch"],
	"apiDir": "./dist/api",
	"kind": "driver",
	"priority": 100
}
```

| Field           | Required | Description                                                                                                                                                                                |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion` | yes      | `1` — forward-compat marker.                                                                                                                                                               |
| `mountPath`     | yes      | Where in the api tree the module mounts. `string` (dot-notation) or `string[]` (segments). Reserved roots `slothlet`, `shutdown`, `destroy` are rejected with `MODULE_RESERVED_MOUNTPATH`. |
| `apiDir`        | yes      | Path inside the package to the slothlet folder. Resolved relative to the package root; path-traversal is rejected with `MODULE_PATH_TRAVERSAL`.                                            |
| `name`          | no       | Documentation only. Source of truth is `package.json`'s `name`. If present in manifest, MUST match — mismatch throws `MODULE_MANIFEST_NAME_MISMATCH`.                                      |
| `version`       | no       | Same rule as `name`. Source of truth is `package.json`'s `version`; mismatch throws `MODULE_MANIFEST_VERSION_MISMATCH`.                                                                    |
| `description`   | no       | Falls back to `package.json` description; manifest value silently overrides if present.                                                                                                    |
| `kind`          | no       | Free-form category (e.g. `"driver"`, `"extension"`, `"reranker"`). Slothlet stores but does not interpret; the host filters on it via `discover()`'s `filter` callback.                    |
| `priority`      | no       | Default-comparator key for `sort()`. Higher first. Defaults to `0`.                                                                                                                        |
| `dependencies`  | no       | Module-level dependencies for host-side topological-sort comparators. Slothlet does not enforce semver here.                                                                               |
| `permissions`   | no       | Array of `{caller, target, effect}` rules per slothlet's existing permission grammar. Advisory by default; host opts in to applying them.                                                  |
| `metadata`      | no       | Dedicated block for arbitrary developer extras. The only place unknown-field data goes — unknown top-level fields are rejected with `MODULE_MANIFEST_UNKNOWN_FIELD`.                       |

The canonical JSON Schema is shipped at `schemas/slothlet.module.schema.json` via the package's `exports` map, so editors / CI tooling can `$ref` it:

```jsonc
// In your IDE settings or schema config:
{ "$ref": "@cldmv/slothlet/schemas/slothlet.module.schema.json" }
```

### Alternative manifest sources

Projects with existing manifest conventions can point `discover()` at a different file or a nested key:

```js
await api.slothlet.api.modules.discover({
	manifest: "package.json#slothlet"
});

await api.slothlet.api.modules.discover({
	manifest: "manifest.json#backend",
	schema: { mountPath: "apiPath", apiDir: "apiFolder" }
});
```

The `<file>#<dotted.key>` locator walks the dotted path through the file's JSON. The `schema` option remaps canonical slothlet field names to whatever the legacy manifest calls them. When `schemaVersion` is absent under an override locator, slothlet leniently assumes `1`.

---

## API reference

All methods live at `api.slothlet.api.modules.*`.

### `discover(options?) → Promise<DiscoverResult[]>`

Walks the filesystem for slothlet modules. Returns validated `DiscoverResult[]` and replaces the per-instance discovery cache.

```js
const found = await api.slothlet.api.modules.discover({
	scanRoot: "/abs/path/to/scan/from",
	manifest: "slothlet.module.json",
	prefix: "@cldmv/packrat-driver-",
	filter: (manifest, packageName) => manifest.kind === "driver"
});
```

**Options:**

| Option     | Default                                                                                   | Description                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `scanRoot` | upward-walk from `process.cwd()` to nearest `node_modules` ancestor (capped at 20 levels) | `string \| string[]` — filesystem path(s) to scan.                                                                          |
| `manifest` | `"slothlet.module.json"`                                                                  | Manifest filename or `<file>#<dotted.key>` locator.                                                                         |
| `schema`   | `{}`                                                                                      | Field-name remap for legacy manifests (canonical → legacy).                                                                 |
| `prefix`   | none                                                                                      | `string \| string[]` — pre-skip filter applied during directory enumeration; matches the full package name including scope. |
| `filter`   | none                                                                                      | `(manifest, packageName) => boolean` — post-validation filter; returning falsy excludes the entry.                          |

**Scan mode auto-detect** (per scanRoot):

- If `<scanRoot>/node_modules` exists → npm mode (walks `node_modules/*` and `node_modules/@*/*`, one level deep).
- Otherwise → folder mode (walks immediate subfolders of scanRoot).

**Dedupe + multi-version:**

- Same real path (symlink aliasing) → silent dedupe; first wins.
- Same packageName + different versions → both surface as separate `DiscoverResult` entries.
- Same name + same version + different real paths → throws `MODULE_DUPLICATE_NAME_VERSION_MISMATCH` (unusual; almost certainly a misconfiguration).

### `sort(results, comparator?) → DiscoverResult[]`

Pure function. Returns a new array sorted by the chosen comparator.

**Default comparator:** `manifest.priority` descending, `packageName` ascending as tiebreak.

```js
const ordered = api.slothlet.api.modules.sort(found);

// Custom comparator:
const alpha = api.slothlet.api.modules.sort(found, (a, b) => a.packageName.localeCompare(b.packageName));
```

### `addModule(nameOrResult, options?) → Promise<MountResult>`

Mounts a single module. Accepts a package name (looked up in the discovery cache) or a `DiscoverResult` directly.

```js
// By name — looks up in cache; lazy-triggers discover() if cache is empty
await api.slothlet.api.modules.addModule("@cldmv/packrat-driver-opensearch");

// By DiscoverResult — direct
await api.slothlet.api.modules.addModule(found[0]);

// With options
await api.slothlet.api.modules.addModule("@org/foo", {
	collisionMode: "error",
	version: "1.4.2" // disambiguator when multiple versions are cached
});
```

**Options:**

| Option          | Default   | Description                                                                                                                                                                  |
| --------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collisionMode` | `"merge"` | One of `"skip" \| "warn" \| "replace" \| "merge" \| "merge-replace" \| "error"`. When `"error"`, throws `MODULE_MOUNT_COLLISION` if the exact mountPath is already occupied. |
| `version`       | none      | Disambiguator when the cache holds multiple versions of `name`.                                                                                                              |
| `discover`      | `{}`      | Options forwarded to the lazy `discover()` call if the cache is empty (only when called with a name).                                                                        |

### `addModules(items, options?) → Promise<MountResult[] | { mounted, failed }>`

Batch mount. Accepts a heterogeneous array of names and `DiscoverResult` objects.

```js
await api.slothlet.api.modules.addModules(["@org/foo", someDiscoverResult, "@org/bar"], {
	collisionMode: "error",
	onFailure: "best-effort",
	concurrency: 4
});
```

**Options:**

| Option          | Default   | Description                                                                                                                                                                                                                            |
| --------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collisionMode` | `"merge"` | Same values as `addModule`.                                                                                                                                                                                                            |
| `onFailure`     | `"throw"` | `"throw"` (default — throw on first failure, mounted entries remain), `"rollback"` (throw + best-effort unmount of entries mounted in this call), or `"best-effort"` (continue past failures, return `{ mounted, failed }` aggregate). |
| `concurrency`   | `1`       | Mount concurrency. `1` (default) = serial. `Infinity` = all-at-once via `Math.min(concurrency, items.length)`. Lifecycle event order tracks completion order under `concurrency > 1`.                                                  |

**Return shape** is bifurcated:

- `"throw"` / `"rollback"` → `MountResult[]`
- `"best-effort"` → `{ mounted: MountResult[], failed: FailureEntry[] }`

**Multi-version routing:** when two or more resolved items share a `packageName` with different `version`s, every entry in that group routes through slothlet's `versionConfig` mechanism — each lands at `vMAJOR.<mountPath>` and the highest semver becomes the registered default. See [VERSIONING.md](VERSIONING.md) for the underlying mechanism.

### `removeModule(name, opts?) → Promise<boolean>`

Unmounts a previously-mounted module. Returns `true` if anything was unmounted.

```js
await api.slothlet.api.modules.removeModule("@org/foo");

// Disambiguate when multi-version mounts exist:
await api.slothlet.api.modules.removeModule("@org/foo", { version: "1.4.2" });
```

### `addDiscovered(options?) → Promise<MountResult[] | { mounted, failed }>`

One-shot convenience: chains `discover()` → `sort()` → `addModules()`. Accepts the union of all three's options, plus a `sort` option for a custom comparator.

```js
await api.slothlet.api.modules.addDiscovered({
  scanRoot: process.cwd(),
  prefix: "@cldmv/packrat-driver-",
  sort: (a, b) => /* custom comparator, or omit for default priority sort */,
  collisionMode: "error",
  onFailure: "best-effort"
});
```

### Cache inspection

```js
api.slothlet.api.modules.getDiscoveryCache(); // → DiscoverResult[]
api.slothlet.api.modules.clearDiscoveryCache(); // → void; does not unmount anything
api.slothlet.api.modules.getStaleMounts(); // → MountResult[] — mounted modules no longer in cache
```

`getStaleMounts()` enables reconciliation after re-discovery. When the host re-runs `discover()` (e.g. after `pnpm install` / `pnpm uninstall`), modules that were previously mounted but no longer appear in the new cache are flagged as stale. The host decides whether to call `removeModule()` on each.

---

## Lifecycle events

Five `modules:*` events emit through slothlet's standard lifecycle handler (subscribe via `api.slothlet.lifecycle.on(name, handler)`). See [LIFECYCLE.md — Module Discovery Events](LIFECYCLE.md#module-discovery-events) for full payload shapes.

| Event                       | When                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `modules:discover-start`    | Beginning of `discover()`                                               |
| `modules:discover-complete` | After cache replacement; payload includes `stale[]` for reconciliation  |
| `modules:mount-start`       | Beginning of `addModule` / `addModules` / `addDiscovered`'s mount phase |
| `modules:mount-complete`    | Once per successfully mounted module                                    |
| `modules:loaded`            | After the helper's full async chain settles                             |

```js
api.slothlet.lifecycle.on("modules:loaded", ({ mounted, failed, stale }) => {
	console.log(`mounted ${mounted.length} modules; ${failed?.length ?? 0} failed; ${stale?.length ?? 0} stale`);
});
```

---

## Error reference

All errors throw `SlothletError` with typed codes. See `src/lib/i18n/languages/en-us.json` for the canonical messages and hints (translated across all 12 supported locales).

| Code                                     | When                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `MODULE_MANIFEST_NOT_FOUND`              | Manifest file (or override locator) doesn't exist for the package              |
| `MODULE_MANIFEST_INVALID`                | Manifest fails JSON parse or schema validation                                 |
| `MODULE_MANIFEST_UNKNOWN_FIELD`          | Unrecognized top-level field in manifest — use the `metadata` block for extras |
| `MODULE_MANIFEST_NAME_MISMATCH`          | Manifest `name` disagrees with `package.json`                                  |
| `MODULE_MANIFEST_VERSION_MISMATCH`       | Manifest `version` disagrees with `package.json`                               |
| `MODULE_PATH_TRAVERSAL`                  | `apiDir` resolves outside the package root                                     |
| `MODULE_VERSION_UNSUPPORTED`             | `schemaVersion` present but not equal to `1`                                   |
| `MODULE_PACKAGE_NOT_FOUND`               | `addModule(name)` and name isn't in the cache after discovery                  |
| `MODULE_RESERVED_MOUNTPATH`              | Manifest claims a reserved root (`slothlet`, `shutdown`, `destroy`)            |
| `MODULE_DUPLICATE_NAME_VERSION_MISMATCH` | Same package name + version at multiple real paths (G7 case 3)                 |
| `MODULE_MOUNT_COLLISION`                 | Pre-flight detects exact-mountPath collision and `collisionMode: "error"`      |

---

## Round-tripping the manifest

Each successfully mounted module stores its full normalized manifest at the mount point via `metadata.setFor(mountPath, "_module", { manifest })`. Retrieve it via [`metadata.getFor(path)`](METADATA.md#getforpathormoduleid):

```js
const meta = api.slothlet.metadata.getFor("drivers.opensearch");
console.log(meta._module.manifest);
// { schemaVersion: 1, name: "@cldmv/packrat-driver-opensearch", version: "1.4.2", ... }
```

Because slothlet's metadata system merges parent → child along the path, the manifest also surfaces from any leaf under the mountPath:

```js
api.slothlet.metadata.getFor("drivers.opensearch.connect")._module.manifest;
// Same manifest — inherited via the parent → child merge
```

This is useful for "what module am I in?" introspection from inside module code.

---

## See also

- [LIFECYCLE.md — Module Discovery Events](LIFECYCLE.md#module-discovery-events) — event payloads and ordering
- [VERSIONING.md](VERSIONING.md) — the underlying `versionConfig` mechanism used for multi-version mounts
- [METADATA.md](METADATA.md) — `metadata.getFor()` and the manifest round-trip
- [PERMISSIONS.md](PERMISSIONS.md) — the permission rule grammar used by the manifest's `permissions[]` field
- [MODULE-STRUCTURE.md](MODULE-STRUCTURE.md) — what a slothlet module looks like internally
- `schemas/slothlet.module.schema.json` — canonical JSON Schema for editor / CI validation
