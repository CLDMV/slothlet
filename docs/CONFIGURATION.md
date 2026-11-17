# Configuration Reference

Complete reference for all slothlet configuration options. Pass these as properties of the options object to `slothlet({ ... })`.

Every key must be one listed here, at every level of a group: an unknown key (a typo, or an option name from slothlet v3) throws `INVALID_CONFIG_UNKNOWN_KEY` with `details.key` naming it (`"permissions.defaultPolicy"`) and `details.path` as segments. `npx @cldmv/slothlet-migrate` moves v3 configs to the v4 names. Values whose keys are your own are not checked: `context`, `reference`, `metadata`, `lifecycle`, `loader.files`, `typescript.compiler`, and the items of `permissions.rules`, `permissions.events.rules` and `routines.entries`, which their own validation reads.

The options object of every `api.slothlet.*` method (`api.add`, `api.leaves`, `api.reload`, `api.modules.*`, `reload`, `hook.on` and the hook filters, `event.on`, `context.scope`, `permissions.principal.register`) and of `generate()` from `@cldmv/slothlet/typegen` is checked the same way, with `details.where` naming the method (`"slothlet.api.add"`).

---

## Quick Reference

```javascript
const api = await slothlet({
	// Required
	base: "./api", // API directory (node) or base URL (browser)

	// API build
	mode: "eager", // "eager" | "lazy"
	runtime: "async", // "async" | "live"
	helpers: "instance", // "instance" | "module" — one copy of each helper file per instance, or per importing api file
	depth: Infinity, // number | Infinity
	hidden: [], // string | string[] — globs hiding files/folders from the API

	// How leaf files are found and loaded
	loader: {
		import: undefined, // (specifier) => Promise<module> — every leaf load goes through it
		files: undefined, // browser file list from files.generate(); giving one selects browser mode
		materialize: false, // lazy mode: materialize every path in the background after init
		platform: undefined, // "node" | "browser" — auto-detected
		resolve: undefined // browser: a file list entry to an importable URL
	},

	// Collision and mutation control
	api: {
		collision: { mode: "merge", override: false }, // mode: string or { initial, api }; a bare string means { mode }
		mutations: {
			add: true,
			remove: true,
			reload: true,
			permissions: true,
			events: true
		}
	},

	// Context
	context: null,
	reference: null,
	scope: { merge: "shallow", isolation: "partial" }, // merge: "shallow" | "deep"; isolation: "partial" | "full"
	metadata: null, // init metadata applied to every function
	sanitize: {}, // file-name to api-key rules, see SANITIZATION.md

	// Hooks
	hook: false, // boolean | string | object

	// Permissions (off without this block) — see PERMISSIONS.md
	permissions: { policy: "allow", caller: { attribution: "precise" } }, // attribution: "precise" | "fast"

	// Routines
	routines: { auto: false, entries: slothlet.defaults.routines, stack: false },

	// Versioned api paths
	versioning: { dispatcher: null }, // version metadata key, or (versions, caller) => tag

	// Debug / diagnostics
	debug: false,
	silent: false,
	diagnostics: false,
	tracking: false,

	// Time (host only) — see the `clock` section
	clock: undefined, // { now, set, clear } — each member optional

	// i18n (dev-facing; process-global)
	i18n: { language: "en-us" },

	// TypeScript
	typescript: false // see TYPESCRIPT.md
});
```

---

## Base Directory

### `base`

**Type**: `string` (path in node mode; base URL in browser mode) | `null`
**Required**: No — omit it for an instance built entirely through `api.add()` (see below).

In node mode it is the directory to scan for API modules (relative paths are resolved from the calling file); in browser mode it is the base URL used to resolve module specifiers.

```javascript
const api = await slothlet({ base: "./api" });
const api = await slothlet({ base: "/absolute/path/to/api" });
```

**No base directory.** Omit `base` (or pass `base: null`) to start from an empty root and build the whole tree at runtime with [`api.slothlet.api.add()`](./RELOAD.md#apislothletapiadd) — directories, in-memory `{ exports }` objects, at a path or at the root (`""`). Nothing is scanned, so there is no `WARN_DIRECTORY_EMPTY`; permissions, lifecycle, `remove()`, and both reload forms work as usual, and a full `reload()` replays what was added.

```javascript
const api = await slothlet({ mode: "eager" }); // no base
await api.slothlet.api.add("services", { exports: { now: () => Date.now() } });
await api.slothlet.api.add("plugins", "./plugins");
```

A base that is given but unusable still fails loudly: an empty string throws `INVALID_CONFIG_DIR_MISSING`, a path that does not exist throws, and an existing but empty directory still warns `WARN_DIRECTORY_EMPTY`. In browser mode the same applies, and a `loader.files` list is only needed with a base — a list that names files without a base throws `INVALID_CONFIG_DIR_MISSING`, since those files cannot be resolved.

---

## API Build Options

### `mode`

**Type**: `"eager"` | `"lazy"`
**Default**: `"eager"`

Controls when API modules are loaded and materialized.

- **`"eager"`** - All modules are loaded and the API is fully built on initialization. Safe for all runtimes.
- **`"lazy"`** - Modules are loaded on first access via a Proxy. Reduces startup time for large APIs.

Aliases, matched case-insensitively:

| Value                      | Same as   |
| -------------------------- | --------- |
| `"immediate"`, `"preload"` | `"eager"` |
| `"deferred"`, `"proxy"`    | `"lazy"`  |

Any other value falls back to `"eager"`.

```javascript
const api = await slothlet({ base: "./api", mode: "lazy" });
```

See [LIFECYCLE.md](LIFECYCLE.md) for lazy mode behavior, proxy semantics, and materialization details.

---

### `runtime`

**Type**: `"async"` | `"live"`
**Default**: `"async"`

Selects the context-propagation runtime.

- **`"async"`** - Uses AsyncLocalStorage (Node.js built-in). Recommended for all production use.
- **`"live"`** - Experimental live bindings mode. Has known limitations; do not use in production.

The live runtime creates no `AsyncLocalStorage`: slothlet makes its store when the first instance on the async runtime is created. On Node 22, where a store that has run switches async hooks on for the whole process, a process whose instances all use the live runtime leaves async hooks off.

Aliases, matched case-insensitively:

| Value                                 | Same as   |
| ------------------------------------- | --------- |
| `"asynclocal"`, `"asynclocalstorage"` | `"async"` |
| `"livebindings"`, `"experimental"`    | `"live"`  |

Any other value (including `"als"` and `"node"`) is not recognized and silently falls back to `"async"`.

```javascript
const api = await slothlet({ base: "./api", runtime: "async" });
```

See [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md) for context runtime details.

---

### `helpers`

**Type**: `"instance"` | `"module"`
**Default**: `"instance"`

How often an instance loads a **helper file**: a file an api file imports by a relative path (or from its own package) that is no api file itself, such as `api/orders.mjs` importing `../lib/queue.mjs`.

- **`"instance"`** - Once per instance. Every api file importing the helper gets the same module, so state the helper keeps at module level (a cache, a counter, a queue) is shared between them, as in any JavaScript program. See [Helper Modules Are Per Instance](MODULE-STRUCTURE.md#helper-modules-are-per-instance).
- **`"module"`** - Once per importing api file. Each api file gets its own copy of every helper it imports, directly or through other helpers. An api file mounted twice with `api.slothlet.api.add()` gets a copy per mount.

```javascript
// lib/tally.mjs
let count = 0;
export const bump = () => ++count;

// api/one.mjs and api/two.mjs both:  import { bump } from "../lib/tally.mjs";  export const next = () => bump();
```

```javascript
const shared = await slothlet({ base: "./api" });
[await shared.one.next(), await shared.two.next()]; // [1, 2] - one count

const apart = await slothlet({ base: "./api", helpers: "module" });
[await apart.one.next(), await apart.two.next()]; // [1, 1] - a count each
```

**Why turn it on.** A helper file has no api path, so with one shared copy the permission system can only say that the helper's code belongs to the api files importing it, and holds it to all of them where it cannot tell more (see [a helper file's code](PERMISSIONS.md#file-level-code-has-its-own-permission-path)). With a copy per api file, each copy's code is known to be that one file's: a helper function a leaf hands out, and a timer or queue the helper starts when it loads, run as the module of the api file the copy was loaded for, under `permissions.attribution: "fast"` as well.

**What it costs.**

- **Helper state is no longer shared between api files.** A cache, connection pool, registry or queue kept in a helper becomes one per importing api file. Programs that rely on api files sharing a helper's state must keep the default, or move that state to a package or to slothlet's `context`.
- **Memory and load time.** Each helper is compiled and evaluated once per api file that imports it, and whatever it starts when it loads (timers, connections) starts once per copy.
- `instanceof` between copies fails: a class declared in a helper is a different class in each copy.

**Limits.**

- **CommonJS helpers** are copied per api file too, so their state is separate, but a CommonJS file's stack frames carry only its path, not which copy is running. For permissions a CommonJS helper's own code therefore stays held to every api file that loads the helper.
- **Packages are never copied**: a file in another package (`node_modules`, or a folder with its own named `package.json`) is one module for the whole process, as before.
- **Browser builds are not affected.** Without Node's resolve hook or the vite plugin (`plugin()` from `@cldmv/slothlet/vite`), the browser loads what a file imports itself, so there is one copy and the every-importer rule applies. The option is accepted and does nothing there.
- A partial reload re-imports the reloaded api files, which link against their existing helper copies, as with `"instance"`.

```javascript
const api = await slothlet({ base: "./api", helpers: "module" });
```

---

### `depth`

**Type**: `number` | `Infinity`
**Default**: `Infinity`

Limits how many directory levels deep slothlet scans when building the API from `base`. Useful for monorepo layouts or large directory trees where you want to restrict which subdirectories become API namespaces.

```javascript
// Only scan top-level dir and one level deep
const api = await slothlet({ base: "./api", depth: 1 });
```

Setting `Infinity` (default) scans all subdirectories.

---

### `hidden`

**Type**: `string` | `string[]`
**Default**: none

Glob or array of globs hiding files and folders from the API. Each glob is matched against an entry's path **relative to `base`** — written folder-style (`internal/secret`) or dotted (`internal.secret`); files match on their extension-stripped path (`math/scratch.mjs` matches `math.scratch`). Supported syntax: `*` (one segment), `**` (any number of segments, none included: `tools/**` names `tools` itself, a root file `tools.mjs` included, as well as everything in the folder), `?` (one char), `{a,b}` (alternation), `!` (negation).

> **Match the on-disk name, not the API key.** Globs are tested against the raw directory/file name as it appears on disk, _before_ it is sanitized into a JavaScript-safe API property. A folder `draft-notes` (surfaced as `api.draftNotes`) is hidden with `hidden: "draft-notes"`, not `hidden: "draftNotes"`.

```javascript
// Hide a folder, a nested subtree, and one file
const api = await slothlet({ base: "./api", hidden: ["drafts", "internal/**", "math.scratch"] });
```

`api.slothlet.api.add(path, dir, { hidden })` accepts the same option per call, with globs relative to the **added** folder.

Hidden entries are skipped during scanning. A folder whose entire contents are hidden does not create an API key at all.

**The built-in rule and `!`.** Files **and** folders whose names start with `.` or `__` are hidden by default, with no configuration. Your globs sit over that rule: they apply in order, the last glob that matches an entry decides, and an entry no glob matches falls to the built-in rule. A glob starting with `!` brings back what an earlier glob, or the built-in rule, hid (gitignore-style); a glob ending in `/` names folders only; a name's leading `.` is part of the name, in either form (`**/.*`, `.env`, `a..git`).

```javascript
// Bring back every __-prefixed file and folder
await slothlet({ base: "./api", hidden: "!**/__*" });

// Bring back .- and __-prefixed folders only (what v3's scanHiddenFolders: true did); files stay hidden
await slothlet({ base: "./api", hidden: ["!**/.*/", "!**/__*/"] });

// Bring back __internal, but keep one folder inside it hidden
await slothlet({ base: "./api", hidden: ["!__internal/", "__internal/drafts"] });
```

A name the framework reserves (`__metadata`, `_impl`, …) is still refused when a `!` glob brings it back (`MODULE_RESERVED_FILENAME` / `MODULE_RESERVED_DIRNAME`). As in gitignore, a folder that stays hidden is never scanned, so a `!` glob cannot reach an entry inside it; bring the folder back first. In a browser, the manifest `generateManifest()` writes leaves `.`/`__`-prefixed entries out, so a `!` glob can only bring back entries a hand-written manifest lists.

The v3 `scanHiddenFolders` option is gone; `hidden: ["!**/.*/", "!**/__*/"]` does what `scanHiddenFolders: true` did.

---

## Collision Options

### `api.collision`

**Type**: `{ mode?: string | { initial: string, api: string }, override?: boolean }` | `string`
**Default**: `{ mode: "merge", override: false }`

Controls behavior when two modules export a property at the same API path. A bare string is the shorthand for `{ mode }`.

#### `api.collision.mode`

| Mode              | Behavior                                                           |
| ----------------- | ------------------------------------------------------------------ |
| `"merge"`         | Merge properties - preserve originals and add new ones _(default)_ |
| `"merge-replace"` | Merge properties - add new ones and overwrite overlapping values   |
| `"replace"`       | Replace existing value completely                                  |
| `"skip"`          | Silently ignore the collision, keep the existing value             |
| `"warn"`          | Warn about the collision, keep the existing value                  |
| `"error"`         | Throw an error on collision                                        |

Use the object form to specify different strategies for the initial API build vs. runtime `api.slothlet.api.add()` operations:

```javascript
const api = await slothlet({
	base: "./api",
	api: {
		collision: {
			mode: {
				initial: "merge", // During initial build
				api: "replace" // During api.slothlet.api.add()
			}
		}
	}
});
```

A string mode applies to both contexts:

```javascript
const api = await slothlet({ base: "./api", api: { collision: "warn" } }); // same as { collision: { mode: "warn" } }
```

#### `api.collision.override`

**Type**: `boolean`
**Default**: `false`

Honor a per-call `collision.mode` / `collision.mutate` / `replay` on `api.slothlet.api.add()`. Locked by default: passing them warns and the override is ignored, since it could bypass the instance's collision config. `collision.force` stays the always-available targeted escape hatch regardless.

See [METADATA.md](METADATA.md) for per-module collision mode overrides via metadata.

---

## Mutation Options

### `api.mutations`

**Type**: `{ add?: boolean, remove?: boolean, reload?: boolean, permissions?: boolean, events?: boolean }`
**Default**: `{ add: true, remove: true, reload: true, permissions: true, events: true }`

Controls which runtime API mutation methods are available. Affects the `api.slothlet.api.*` (module mounting), `api.slothlet.permissions.*` (rule management), and `api.slothlet.event.rules.*` (event-rule management) mutation surfaces.

| Property      | Default | Controls                                                                                          |
| ------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `add`         | `true`  | `api.slothlet.api.add()` - mount new API modules at runtime                                       |
| `remove`      | `true`  | `api.slothlet.api.remove()` - unmount API modules at runtime                                      |
| `reload`      | `true`  | `api.slothlet.api.reload()` - hot-reload a module or directory                                    |
| `permissions` | `true`  | `api.slothlet.permissions.addRule()` / `removeRule()` - add or remove permission rules at runtime |
| `events`      | `true`  | `api.slothlet.event.rules.add()` / `remove()` - add or remove event rules at runtime (host-only)  |

Disable all mutations to create a locked, immutable API:

```javascript
const api = await slothlet({
	base: "./api",
	api: {
		mutations: { add: false, remove: false, reload: false, permissions: false }
	}
});
```

---

## Context Options

### `context`

**Type**: `object` | `null`
**Default**: `null`

An object that is merged into the per-request context available inside async API functions via `api.slothlet.context.get()`. Useful for injecting shared services (loggers, DB connections, etc.) that API methods can access without explicit parameters.

```javascript
const api = await slothlet({
	base: "./api",
	context: { db, logger }
});
```

See [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md) for per-request context isolation and usage patterns.

---

### `reference`

**Type**: `object` | `null`
**Default**: `null`

An object whose properties are merged directly into the root of the built API and, when `diagnostics: true` is set, readable as `api.slothlet.diag.reference`. Commonly used to expose the API object itself back through `reference` so modules can call peer methods without circular imports.

```javascript
const api = await slothlet({
	base: "./api",
	reference: { db, config }
});

api.db; // ✅ db is directly on the API
api.config; // ✅
```

---

### `scope`

**Type**: `{ merge?: "shallow" | "deep", isolation?: "partial" | "full" }`
**Default**: `undefined` (`merge` behaves as `"shallow"`, `isolation` as `"partial"`)

Sets the defaults for `api.slothlet.scope()` runs. Both can be overridden per call.

- **`merge`**
  - **`"shallow"`** - Top-level keys are merged (default when scope is provided)
  - **`"deep"`** - Deep recursive merge of all nested keys
  - Any other value throws `INVALID_CONFIG`.
- **`isolation`**
  - **`"partial"`** (default) - The scope shares `self` with the rest of the api, so a write through `self` inside the scope is visible outside it.
  - **`"full"`** - The scope gets a copy-on-write `self`: writes made inside the scope stay inside it.
  - Any other value throws `SCOPE_INVALID_ISOLATION_MODE`.

```javascript
const api = await slothlet({
	base: "./api",
	scope: { merge: "deep", isolation: "full" }
});
```

See [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md) for how scopes work.

---

### `metadata`

**Type**: `object` | `null`
**Default**: `null`

Init metadata. Every key is set as global metadata, so it is inherited by every later `api.slothlet.api.add()`, and is also registered as user metadata for the base module. System metadata fields still win over these keys.

```javascript
const api = await slothlet({
	base: "./api",
	metadata: { team: "platform", tier: "internal" }
});
```

See [METADATA.md](METADATA.md#init-metadata) for lookup priority and the runtime metadata API.

---

## Sanitization

### `sanitize`

**Type**: `{ first?: boolean, preserve?: { upper?: boolean, lower?: boolean }, rules?: { leave?: string[], nocase?: string[], upper?: string[], lower?: string[] } }`
**Default**: `{}`

Controls how file and folder names become api property names (`auto-ip.mjs` becomes `autoIp`). It takes the same options as `sanitize()` from `@cldmv/slothlet/sanitize` and applies to everything the loader names (initial build, `api.slothlet.api.add()`, reloads, browser mode) and to `api.slothlet.sanitize(str)` alike.

| Option           | Default | Effect                                                          |
| ---------------- | ------- | --------------------------------------------------------------- |
| `first`          | `true`  | Lowercase the first character of the first segment              |
| `preserve.upper` | `false` | Keep an all-uppercase name as it is (`COMMON_APPS`)             |
| `preserve.lower` | `false` | Keep an all-lowercase name as it is, underscores included       |
| `rules.leave`    | none    | Segments kept exactly as written, case-sensitive, globs allowed |
| `rules.nocase`   | none    | Same, case-insensitive                                          |
| `rules.upper`    | none    | Segments forced to UPPERCASE                                    |
| `rules.lower`    | none    | Segments forced to lowercase                                    |

```javascript
const api = await slothlet({
	base: "./api",
	sanitize: { rules: { upper: ["*-ip"] } }
});

// auto-ip.mjs -> api.autoIP, net-ip/ -> api.netIP
api.slothlet.sanitize("auto-ip"); // "autoIP"
```

See [SANITIZATION.md](SANITIZATION.md) for pattern matching, rule precedence and examples.

---

## Permissions

The `permissions` block turns the permission system on; every option it takes is listed in [PERMISSIONS.md](./PERMISSIONS.md#configuration-options). Two of them change what a module is handed, so they are described here too.

`permissions` may also be a bare mode: `"on"`, `"strict"`, `"off"` or `"disabled"` is the same as `{ mode }`, `true` is `"on"` and `false` is no block. Inside the block, `mode: true` and `mode: false` mean `"on"` and `"off"`. Any other string or non-object value is an `INVALID_CONFIG`.

### `permissions.mode: "strict"`

`"strict"` is `"on"` with two differences: it is chosen in the config only (`control.enable()` and `control.disable()` throw `PERMISSION_STRICT_FIXED`), and the instance refuses to start (`PERMISSION_BASELINE_UNMET`) while a check of the permission baseline is not met. The checks are facts slothlet tries for itself as the instance starts: in a browser, a Content Security Policy that refuses `'unsafe-eval'` and `blob:` and `data:` scripts; under vitest, the `@cldmv/slothlet/vite` plugin. Plain Node has no check. Under `"on"` the same checks run and each one not met is a warning. `api.slothlet.permissions.control.report()` shows what they found.

```javascript
const api = await slothlet({ base: "./api", permissions: { mode: "strict", rules } });
api.slothlet.permissions.control.report().baseline.met; // true
```

In Node, `--disallow-code-generation-from-strings` is recommended extra hardening: slothlet refuses `eval` and `Function` code as the rules say without it, so it is not a check, but the flag refuses code made from strings in the whole process.

A met baseline means only that the checks slothlet can make passed. Code that ran before slothlet can have replaced globals or faked what the checks read, and a browser can never be fully trusted. The checks, what each rules out, and the known limits are in [PERMISSIONS.md → Strict mode, the baseline, and capabilities](./PERMISSIONS.md#strict-mode-the-baseline-and-capabilities).

With no `permissions` block the system is off: no call, read or event rule is evaluated. That includes the event levels ([EVENTS.md](./EVENTS.md#delivery-levels)): every `self.slothlet.event.on()` subscription is delivered at `allow`, with its payload. Under a `permissions` block the event rules apply, and a subscriber that matches none gets `permissions.events.policy` (built-in: `notify`, the trigger without the payload).

### `permissions.gating.buffers`

**Type**: `boolean | number`
**Default**: `false`

While the permission system is on, what one module hands another reaches it as a view, except values that hold nothing but their own bytes: a typed array or `Buffer` is handed over as itself, because native code needs the array. A member a module stored on the array under a string key (`bytes.item = instance`) can only be found by listing the array's keys, which lists every index (about 14 ms for 64 KB, 400 ms for 1 MB, on each crossing), so by default it is not looked for and rides along.

| Value            | A typed array or `Buffer` one module hands another                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `false`          | handed over as itself, its keys never listed                                                                     |
| `true`           | its keys are listed; one holding a member of its own is handed over as a view                                    |
| a whole number N | listed when it is N kilobytes or smaller (`byteLength <= N * 1024`); a larger one is handed over as with `false` |

Anything else is rejected with `INVALID_CONFIG`.

```javascript
const api = await slothlet({ base: "./api", permissions: { policy: "deny", gating: { buffers: 64 }, rules } });
```

### `permissions.caller.attribution`

**Type**: `"precise" | "fast"`
**Default**: `"precise"`

A `self.*` call is allowed only when both the code making it (its definer: the leaf it is written in) and the caller running it are allowed. This option decides how slothlet knows the definer of code a module hands out:

| Value       | A returned function, class, class instance, generator, promise or Proxy export            | Where the call stack cannot tell the definer                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"precise"` | a stand-in recording a fallback definer: not `===` the original, about 1 µs more per call | still known for a function returned directly (browser modules sharing a folder, a CommonJS file two instances load, `caller.provenance: false`); `eval`-built code is refused while `caller.provenance` is on |
| `"fast"`    | the original itself: `===` holds and calls are plain calls                                | refused with `PERMISSION_DENIED`                                                                                                                                                                              |

Wherever the stack names the definer, both use it. Plain data comes back as itself under both, unsearched, and with the permission system not on nothing is wrapped or checked under either. Any other value is rejected with `INVALID_CONFIG`.

**`"fast"` together with `caller.provenance: false` keeps no author check.** `caller.provenance` reads who wrote code from the stack and `"precise"` records it on what a module hands out; with both off, every function runs as whoever runs it. It is the one combination in which the two values refuse different things:

```javascript
// rules: policy "allow", { caller: "author.**", target: "vault.**", effect: "deny" }
// author returns () => self.vault.get(); runner, which may read the vault, runs it.
//
// { attribution: "precise", provenance: false }  → PERMISSION_DENIED  (the function records author)
// { attribution: "fast",    provenance: false }  → "SECRET"           (the function runs as runner)
// either value with provenance on (the default)  → PERMISSION_DENIED  (the stack names author)
```

```javascript
const api = await slothlet({ base: "./api", permissions: { policy: "deny", caller: { attribution: "fast" }, rules } });
```

See [Code a module hands out runs as its definer](./PERMISSIONS.md#code-a-module-hands-out-runs-as-its-definer) for the rule, the trade-off and its limits.

### `permissions.private`

**Type**: `{ host?: "deny" | "allow", scope?: "module" | "folder" }`
**Default**: `{ host: "deny", scope: "module" }`

How [module-private members](./PERMISSIONS.md#module-private-exports) (exports named with a leading `_` or `__`) are held while the permission system is on.

- `scope` decides what a private member is private to. Under `"module"` it is the module ID that owns the member's path: every leaf of the base folder belongs to the base module, and everything an `api.slothlet.api.add()` composes belongs to that add's moduleID, given or generated. Under `"folder"` it is the folder of files that exports the member, as before v4.0.0, and a subfolder is a module of its own.
- `host` decides whether the host's own reads and calls of a private member are allowed (`"allow"`) or refused (`"deny"`).

```text
api/billing/internals.mjs   export const __rate = 0.2
api/billing/quote.mjs       reads self.billing.internals.__rate
api/billing/deep/audit.mjs  reads self.billing.internals.__rate
api/reporting/peek.mjs      reads self.billing.internals.__rate
ext/vault.mjs               added with api.slothlet.api.add("ext", "./ext", { id: "ext" }), reads the same
```

| Reader               | `scope: "module"` (default) | `scope: "folder"`   |
| -------------------- | --------------------------- | ------------------- |
| `billing.quote`      | `0.2`                       | `0.2`               |
| `billing.deep.audit` | `0.2`                       | `PERMISSION_DENIED` |
| `reporting.peek`     | `0.2`                       | `PERMISSION_DENIED` |
| `ext.vault`          | `PERMISSION_DENIED`         | `PERMISSION_DENIED` |
| the host             | `PERMISSION_DENIED`         | `PERMISSION_DENIED` |

Any other value of either key, or a `private` that is not an object, is rejected with `INVALID_CONFIG`.

```javascript
const api = await slothlet({ base: "./api", permissions: { policy: "allow", private: { scope: "folder", host: "allow" } } });
```

---

## Hook Configuration

### `hook`

**Type**: `boolean` | `string` | `{ enabled, pattern, errors, pin }` (an object is enabled unless `enabled: false`)
**Default**: `false`

Enables the hook system, which intercepts API function calls.

```javascript
// Simple enable
const api = await slothlet({ base: "./api", hook: true });

// Enable with a default pattern filter
const api = await slothlet({ base: "./api", hook: "database.*" });

// Full object form
const api = await slothlet({
	base: "./api",
	hook: {
		enabled: true,
		pattern: "**", // Default glob filter for hooks
		errors: false, // "suppress" (or true): don't re-throw after error hooks run
		pin: true // pin each handler to its registering module's identity (see HOOKS.md)
	}
});
```

See [HOOKS.md](HOOKS.md) for the complete hook API and usage guide.

---

## Debug and Diagnostics

### `debug`

**Type**: `boolean` | `object`
**Default**: `false`

Enables verbose internal logging. `true` enables all categories. Pass an object to target specific subsystems:

```javascript
const api = await slothlet({
	base: "./api",
	debug: {
		builder: false, // API tree construction
		api: false, // api.slothlet.api.* operations
		index: false, // File indexing and scanning
		modes: false, // Flattening mode decisions
		wrapper: false, // Proxy/wrapper construction
		ownership: false, // Module ownership tracking
		context: false, // Context propagation
		initialization: false, // Instance startup/compose
		materialize: false, // Lazy materialization
		versioning: false, // Versioned mounts/dispatcher
		permissions: false // Permission rule resolution
	}
});
```

---

### `silent`

**Type**: `boolean`
**Default**: `false`

Keeps slothlet's warnings off the console. It decides only that: every warning is still created and recorded on the instance (`api.slothlet.diag.SlothletWarning.captured`), `impl:warning` / `impl:error` lifecycle events still fire (see [LIFECYCLE.md](LIFECYCLE.md)), and `debug` logging is not affected.

```javascript
const api = await slothlet({ base: "./api", silent: true });
```

---

### `diagnostics`

**Type**: `boolean`
**Default**: `false`

Enables the `api.slothlet.diag.*` namespace for runtime introspection. Intended for testing and debugging - do not enable in production.

```javascript
const api = await slothlet({ base: "./api", diagnostics: true });

// Now available:
api.slothlet.diag.describe();
api.slothlet.diag.inspect();
```

See [The `api.slothlet.diag.*` Namespace](#the-apislothletdiag-namespace) below for the full surface.

---

### `lifecycle`

**Type**: `Object.<string, Function | Function[]>`
**Default**: _(none)_

Construction-time lifecycle subscribers, registered on the lifecycle emitter **before** the api builds — so events emitted during the cold-start build (init-time `impl:warning`, `impl:created`, …) are observable. `api.slothlet.lifecycle.on(...)` can only attach _after_ the build, by which point those events have already fired. Maps an event name to a handler `function(data, token)` or an array of handlers; any event name is accepted. The handlers are ordinary subscribers, so they keep receiving runtime events afterward too.

```javascript
const api = await slothlet({
	base: "./api",
	lifecycle: {
		"impl:warning": (data) => console.warn(`[init] ${data.code}: ${data.message}`),
		"impl:error": [onError, auditError],
		"impl:created": (data) => registry.add(data.apiPath)
	}
});
```

A non-plain-object value (array, class instance, primitive) throws at construction. See [LIFECYCLE.md](LIFECYCLE.md) for the event catalog and the `impl:warning` / `impl:error` payloads.

---

### `routines`

**Type**: `{ auto?: boolean, entries?: Array<…>, stack?: boolean }`
**Default**: `{ auto: false, entries: slothlet.defaults.routines, stack: false }`

The routine system's group. It takes the object form only.

#### `routines.entries`

**Type**: `Array<string | { name: string, mode?: "manual" | "startup" | "shutdown" | "destroy", recursive?: boolean, order?: "mount" | "depth", cascade?: boolean }>`
**Default**: `slothlet.defaults.routines` — `[{ name: "initialize", mode: "startup" }, { name: "shutdown", mode: "shutdown" }]`

A **routine** is a named cross-module runnable: every mounted module exporting a function matching a configured routine name is composed into a callable at its exact composed api path, plus a root cascade (`self.<name>()` ≡ `api.slothlet.<name>()`) that runs every matching contribution anywhere, each at its own distinct api path. When two or more modules' contributions land on the **identical** api path (e.g. a coordinator and its contributors sharing `self.auth`), whether all of them run there or only the one that owns that path is controlled by [`routines.stack`](#routinesstack).

Each entry normalizes to `{ name, mode, recursive, order, cascade }`: a bare `"name"` string (mode `"manual"`), `"name:mode"` (split on the first colon), or `{ name, mode?, recursive?, order?, cascade? }` — `recursive`/`order`/`cascade` are only settable via the object form. Providing `entries` **replaces** the built-in defaults — pass `[]` to disable every routine, or spread `slothlet.defaults.routines` to extend rather than replace them. `cascade` (default `true`) governs the root run-all: set `cascade: false` for a **per-entity** routine, where the host invokes exactly one co-owner via `api.<path>.<name>.for(key)` (and discovers the co-owners via `.contributors`) instead of a run-all cascade — see [LIFECYCLE.md](LIFECYCLE.md#per-entity-routines-cascade-false-forkey-and-contributors).

By default, `name` is resolved **relative to a mount point** (a top-level `base`-scan entry, or an `api.slothlet.api.add()` target) — a bare name only matches a mount's own top level, never anything nested. A dotted name (`"admin.initialize"`) matches a fixed relative sub-path, or with `recursive: true` matches that name at any depth within the mount. A `^`-prefixed name (`"^ext.*.initialize"`) is root-anchored: matched via glob (`*`, `**`, `{}`, `!`) against the full absolute api path, crossing mount boundaries. `order` controls the root cascade's grouping order — `"mount"` (registration order) or `"depth"` (deepest-matching-path first); defaults to `"depth"` for `shutdown`/`destroy`, `"mount"` for `startup`/`manual`.

```javascript
const api = await slothlet({ base: "./api", routines: { entries: [...slothlet.defaults.routines, "launch"] } });
// extends the defaults with a new "launch" (manual) routine

const api2 = await slothlet({ base: "./api", routines: { entries: [] } });
// disables initialize/shutdown routine behavior entirely

// Every nested shutdown()/destroy() leaf, deepest first, crossing mount boundaries:
const api3 = await slothlet({
	base: "./api",
	routines: {
		auto: true,
		entries: [
			{ name: "initialize", mode: "startup" },
			{ name: "^**.shutdown", mode: "shutdown", order: "depth" },
			{ name: "^**.destroy", mode: "destroy", order: "depth" }
		]
	}
});
```

See [LIFECYCLE.md](LIFECYCLE.md#routines) for the full contract — name matching, stacking semantics, cascade ordering, `mode` firing rules, and the best-effort, aggregated `ROUTINE_FAILED` error shape.

#### `routines.auto`

**Type**: `boolean`
**Default**: `false`

Every configured routine is always stacked and directly callable regardless of this flag — only the _automatic_ firing (`startup` at compose end, `shutdown`/`destroy` at dispose) is gated.

```javascript
const api = await slothlet({ base: "./api", routines: { auto: true } });
// "startup"-mode routines now auto-run at compose end; "shutdown"/"destroy"-mode routines auto-run at dispose.
```

#### `routines.stack`

**Type**: `boolean`
**Default**: `false`

Whether two or more modules' contributions colliding at the exact same composed api path all run, or only the single contribution that actually owns that path (per [`api.collision`](#apicollision)) runs. `false` by default, matching ordinary (non-routine) collision behavior everywhere else in the framework — a colliding key always resolves to one winner unless explicitly opted into stacking.

Deliberately independent of the collision mode: stacking is not a side effect of `merge`, `replace`, or any other mode — a module that loses a collision, under any collision mode, does not run via the routine system unless `routines.stack: true` is set. The root cascade runs every matching contribution across **distinct** api paths regardless of this flag; where two or more contributions land on the **identical** api path, the cascade applies the same filtering a direct call at that path would.

```javascript
const api = await slothlet({ base: "./api", routines: { stack: true } });
await api.slothlet.api.add(["auth"], "./plugins/auth-core/api");
await api.slothlet.api.add(["auth"], "./plugins/auth-audit/api"); // also exports "initialize"

await api.auth.initialize(); // runs both, in mount order — without routines.stack only one would
```

See [LIFECYCLE.md](LIFECYCLE.md#routines) for the full contract.

---

### `tracking`

**Type**: `boolean` | `{ materialization: boolean }`
**Default**: `false`

Enables internal tracking features.

| Property          | Default | Effect                                                 |
| ----------------- | ------- | ------------------------------------------------------ |
| `materialization` | `false` | Track which lazy-mode API paths have been materialized |

```javascript
const api = await slothlet({ base: "./api", mode: "lazy", tracking: true });
// or
const api = await slothlet({ base: "./api", mode: "lazy", tracking: { materialization: true } });
```

---

## Loader

### `loader`

**Type**: `{ import?: Function, files?: { files: Array, directories: Array }, materialize?: boolean, platform?: "node" | "browser", resolve?: Function }`
**Default**: `{}`

How leaf files are found and loaded.

| Option        | Default         | Effect                                                                                                                                                                                                                                 |
| ------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import`      | none            | `(specifier) => Promise<module>`: every leaf load goes through it instead of slothlet's own `import()`, so a coverage run attributes leaf code (see [TESTING.md](TESTING.md)). Anything but a function throws `INVALID_CONFIG_IMPORT`. |
| `files`       | none            | The browser file list `files.generate()` from `@cldmv/slothlet/files` writes; giving one selects browser mode. See [BROWSER.md](BROWSER.md).                                                                                           |
| `materialize` | `false`         | With `mode: "lazy"`, start materializing every api path in the background right after initialization. The api is usable through its proxies before this completes.                                                                     |
| `platform`    | auto-detected   | `"node"` or `"browser"`: scan the filesystem, or read `files`. Omitted, it is `"browser"` when `files` is given or no Node `process` is present.                                                                                       |
| `resolve`     | resolve on base | Browser: `({ path, name, full }) => string \| URL`, a file list entry to an importable URL. Defaults to resolving against `base` as a `file://` URL.                                                                                   |

```javascript
const api = await slothlet({
	base: "./api",
	mode: "lazy",
	loader: { materialize: true }
});
```

See [LIFECYCLE.md](LIFECYCLE.md) for materialization details.

---

### `clock`

**Type**: `{ now?: () => number, set?: Function, clear?: Function }`
**Default**: none (the functions slothlet loaded with)

The functions an instance reads the time with and starts its deferred work with. Every member is optional, and a member you leave out is the copy slothlet took when it loaded. Anything that is not an object whose given members are functions throws `INVALID_CONFIG`.

slothlet takes `Date.now` and the timers when it loads, so a script (or a test runner) that replaces them afterwards does not move an instance. That is deliberate: a principal's `ttl` is measured on that clock, and a module that replaced `Date.now` must not be able to stretch it. `clock` is how a host that wants to control time, a test above all, hands an instance its own:

- **`now`** is the time in milliseconds. It stamps the principal cache behind `ttl` (a value older than `ttl`, or resolved at a time later than `now()` reports, is stale), the ID a `reload()` gives the instance, the ID of a context run, and every time slothlet records: the `timestamp` of lifecycle events and hook failure sources, the `at` of event metadata, the time a rule or an ownership entry was registered.
- **`set`** and **`clear`** take the place of `setTimeout` and `clearTimeout`: when you give `set`, slothlet's own deferred work (the background step of `loader.materialize` and `tracking.materialization`, and the patch of a stack after an api change) runs through it with a delay of `0` instead of on the host's immediate queue, so a host that fakes timers moves it with its own clock. slothlet never cancels a timer it started, so `clear` is only kept for the host's use of the instance's clock.

The option is read once, when the instance is created, and kept by the instance alone: it is not part of the config the instance reports (`api.slothlet.diag.inspect().config`), a module's manifest, the options of `api.slothlet.api.add()` and `context` cannot supply or replace it, and it carries across `reload()` and `restart()`. Two instances have two clocks.

A clock whose `now` throws makes the call that read it throw. A `now` that answers something that is not a finite number, or that goes backwards, never keeps a principal alive past its `ttl`: the value is stale.

```javascript
// Test a principal's ttl without waiting for it
let time = 1_000;
const api = await slothlet({
	base: "./api",
	permissions: { policy: "deny", rules },
	clock: { now: () => time }
});
api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve, ttl: 10 });
// ...resolve it, then
time += 11; // the cached value is now stale, with no real wait
```

With a test runner's fake timers, install them before creating the instance and hand it the (now fake) functions:

```javascript
vi.useFakeTimers();
const api = await slothlet({ base: "./api", clock: { now: Date.now, set: setTimeout, clear: clearTimeout } });
await vi.advanceTimersByTimeAsync(10); // moves the instance's clock and its deferred work
```

Process-wide work that belongs to no instance keeps the functions slothlet loaded with: the TypeScript processor's sweep of old transform folders, frame placement's sampling of the host's scripts, the `@generated` stamp of generated type files, and the cache-busting token of a module import.

---

## Versioning

### `versioning`

**Type**: `{ dispatcher?: string | ((versions, caller) => string | null) | null }`
**Default**: `{ dispatcher: null }`

`dispatcher` picks the version a call to a versioned api path runs: a string names the key read from the caller's version metadata (`null` means `"version"`), a function is called as `(versions, caller)` and returns a registered version tag, or `null`/`undefined` to take the default. Anything else throws `INVALID_CONFIG_VERSION_DISPATCHER`. See [VERSIONING.md](VERSIONING.md).

```javascript
const api = await slothlet({ base: "./api", versioning: { dispatcher: "apiVersion" } });
```

---

## TypeScript

### `typescript`

**Type**: `boolean` | `"fast"` | `"strict"` | `object`
**Default**: `false`

Enables TypeScript **module loading** — transpilation of `.ts`/`.mts` files in the API directory. `true` or `"fast"` uses esbuild (no type checking); `"strict"` uses `tsc` (type-checks, and can optionally emit a `.d.ts`). Declaration generation is a sub-feature of strict mode, not what this flag turns on by itself.

```javascript
const api = await slothlet({ base: "./api", typescript: true }); // fast mode (esbuild)
const api = await slothlet({ base: "./api", typescript: "strict" }); // strict mode (tsc)
```

See [TYPESCRIPT.md](TYPESCRIPT.md) for the full TypeScript configuration reference, modes, peer dependencies, and generated type file details.

---

## The `api.slothlet.diag.*` Namespace

Available only when `diagnostics: true` is set. Provides runtime introspection for testing and debugging.

```javascript
const api = await slothlet({ base: "./api", diagnostics: true });
const diag = api.slothlet.diag;
```

### `diag.describe([showAll])`

List top-level API keys, or dump the full API structure.

```javascript
diag.describe(); // Returns array of top-level key names
diag.describe(true); // Returns full shallow copy of API object
```

### `diag.reference`

The `reference` object passed at initialization, or `null`.

```javascript
console.log(diag.reference); // { db, config } or null
```

### `diag.context`

The `context` object passed at initialization.

```javascript
console.log(diag.context); // { db, logger } or {}
```

### `diag.inspect()`

Returns internal instance state from `getDiagnostics()` - config snapshot, handler state, and materialization stats.

```javascript
const state = diag.inspect();
```

### `diag.owner.get(apiPath)`

Returns the ownership set for the given API path - the set of `moduleID` strings that currently own that path.

```javascript
const owners = diag.owner.get("math.add");
// Set { "base_abc123" }
```

Returns `null` if the path is not tracked.

### `diag.caches.get()`

Returns cache diagnostics summarizing all active API caches.

```javascript
const info = diag.caches.get();
// {
//   totalCaches: 2,
//   caches: [
//     { moduleID: "base_abc", endpoint: ".", pathCount: 45, ... },
//     { moduleID: "plugins_xyz", endpoint: "plugins", pathCount: 12, ... }
//   ]
// }
```

### `diag.caches.getAllModuleIDs()`

Returns the array of all `moduleID` strings currently in cache.

```javascript
const ids = diag.caches.getAllModuleIDs(); // ["base_abc", "plugins_xyz"]
```

### `diag.caches.has(moduleID)`

Returns `true` if a cache exists for the given `moduleID`.

```javascript
diag.caches.has("base_abc"); // true
```

### `diag.hook.compilePattern(pattern)` _(hooks enabled only)_

Expands a glob pattern string into a `RegExp`. Only available when `hook` is also enabled.

```javascript
const re = diag.hook.compilePattern("math.*");
```

### `diag.SlothletWarning`

This instance's `SlothletWarning` class. Every warning the instance raises is recorded here, whether or not it is printed: two instances never share a `captured` list, and `clearCaptured()` on one leaves the other's warnings alone. Whether a warning is also printed is the instance's [`silent`](#silent) option. Used in tests to assert on warnings.

```javascript
// In tests
diag.SlothletWarning.clearCaptured();
// ... trigger code that may emit warnings ...
const warnings = diag.SlothletWarning.captured;
expect(warnings).toHaveLength(1);
```

- `captured` - every warning this instance raised.
- `clearCaptured()` - empties this instance's list.

Warnings raised outside any instance (for example a coverage notice from module load) go to the process-level class, `SlothletWarning` from `@cldmv/slothlet/errors`, which has its own `captured` and `clearCaptured()` and prints every warning. Warnings from either class are `instanceof SlothletWarning`.
