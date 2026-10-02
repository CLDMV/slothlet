<a id="at_cldmv_slash_slothlet"></a>

## @cldmv/slothlet
> <p><strong style="font-size: 1.1em;"><p>Slothlet is a module-loading framework for Node.js (ESM-first) that scans a directory of source files
> and assembles them into a single, cohesive API object with zero runtime dependencies.</p>
> <p>Key Features:</p>
> <ul>
> <li>Eager and lazy loading strategies with configurable traversal depth</li>
> <li>Proxy-based API object with hot-reload, dynamic add/remove, and ownership tracking</li>
> <li>AsyncLocalStorage-based per-request context isolation (or experimental live bindings)</li>
> <li>Declarative hook system for intercepting and modifying API calls</li>
> <li>TypeScript file support (esbuild fast mode or tsc strict mode)</li>
> <li>Collision handling with merge / replace / skip / warn / error modes</li>
> <li>Rich lifecycle events, metadata annotations, and diagnostics</li>
> <li>Full i18n support for all framework messages (11 languages)</li>
> </ul></strong></p>
> 


**Structure**

[@cldmv/slothlet(config)](#at_cldmv_slash_slothlet) ⇒ <code>Object</code>

[@cldmv/slothlet/runtime](#at_cldmv_slash_slothlet_slash_runtime)


**Example**
```js
// ESM default import (recommended)
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ base: "./api" });
await api.math.add(2, 3);  // 5
await api.slothlet.shutdown();
```
**Example**
```js
// ESM named import
import { slothlet } from "@cldmv/slothlet";
```
**Example**
```js
// CommonJS require
const slothlet = require("@cldmv/slothlet");
```
**Example**
```js
// Lazy loading mode — modules loaded on first access
const api = await slothlet({ base: "./api", mode: "lazy" });
```
**Example**
```js
// With per-request context isolation
const api = await slothlet({
  base: "./api",
  context: { db, logger },
  runtime: "async"
});

// Inside an API module, access context via:
// import { context } from "@cldmv/slothlet/runtime";
```
**Example**
```js
// With hook interception
const api = await slothlet({ base: "./api", hook: true });
api.slothlet.hook.on("before", "math.*", (endpoint, args) => {
  console.log("calling:", endpoint, args);
});
```
**Example**
```js
// Multiple independent instances
const api1 = await slothlet({ base: "./api" });
const api2 = await slothlet({ base: "./other-api" });
```
**Example**
```js
// Shutdown when done
await api.slothlet.shutdown();
```





* * *

<a id="at_cldmv_slash_slothlet"></a>

### @cldmv/slothlet(config) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Create a new Slothlet instance and load an API from a directory.
> This is the sole public entry point for slothlet. Each call produces an independent
> API instance with its own component graph, context store, and lifecycle.</p></strong></p>
> 

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| config | <code>[SlothletOptions](#typedef_module_at_cldmv_slash_slothlet_SlothletOptions)</code> |  | <p>Configuration options</p> |


**Returns**:

- <code>Object</code> <p>Fully loaded, proxy-based API object</p>


**Example**
```js
// ESM default import (recommended)
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ base: "./api" });
await api.math.add(2, 3);  // 5
await api.slothlet.shutdown();
```
**Example**
```js
// ESM named import
import { slothlet } from "@cldmv/slothlet";
```
**Example**
```js
// CommonJS require
const slothlet = require("@cldmv/slothlet");
```
**Example**
```js
// Lazy loading mode — modules loaded on first access
const api = await slothlet({ base: "./api", mode: "lazy" });
```
**Example**
```js
// With per-request context isolation
const api = await slothlet({
  base: "./api",
  context: { db, logger },
  runtime: "async"
});

// Inside an API module, access context via:
// import { context } from "@cldmv/slothlet/runtime";
```
**Example**
```js
// With hook interception
const api = await slothlet({ base: "./api", hook: true });
api.slothlet.hook.on("before", "math.*", (endpoint, args) => {
  console.log("calling:", endpoint, args);
});
```
**Example**
```js
// Multiple independent instances
const api1 = await slothlet({ base: "./api" });
const api2 = await slothlet({ base: "./other-api" });
```
**Example**
```js
// Shutdown when done
await api.slothlet.shutdown();
```




* * *

<a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions"></a>

### SlothletOptions : <code>object</code>
<p>Configuration options passed to <code>slothlet()</code>.</p>

**Kind**: typedef  
**Scope**: inner


<a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_resolveModuleSpecifier"></a>

#### api.resolveModuleSpecifier()

Browser-mode module resolver: <code>(fileEntry: {path, name, fullName}) =&gt; string | URL</code>.
Maps a manifest file entry to an importable URL or bare specifier. Defaults to resolving against <code>base</code> as a <code>file://</code> URL.
Override to point at a CDN, bundler virtual module, or other browser-friendly source.

**Kind**: function property of [<code>SlothletOptions</code>](#typedef_module_at_cldmv_slash_slothlet_SlothletOptions)

* * *

<a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_import"></a>

#### api.import()

Injectable leaf importer: <code>(specifier: string) =&gt; Promise&lt;object&gt;</code>.
Every leaf module load is routed through it instead of slothlet's own dynamic <code>import()</code>, so the
modules land in the caller's module graph rather than slothlet's. Pass <code>(s) =&gt; import(s)</code> written
inside the consumer's own (transformed) code to make a coverage run attribute leaf execution
correctly; unset, slothlet imports natively exactly as before. See <a href="../docs/TESTING.md"><code>docs/TESTING.md</code></a>.

**Kind**: function property of [<code>SlothletOptions</code>](#typedef_module_at_cldmv_slash_slothlet_SlothletOptions)

* * *

<a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_versionDispatcher"></a>

#### api.versionDispatcher()

Version routing discriminator for versioned API paths.</p>
<ul>
<li><strong>string</strong> (e.g. <code>&quot;version&quot;</code>) — at dispatch time, reads that key from the calling module's version metadata to select a version tag.</li>
<li><strong>function</strong> — called as <code>(allVersions, caller) =&gt; versionTag | null</code>; return a registered version tag to force routing, or <code>null</code>/<code>undefined</code> to fall through to the automatic default.</li>
<li><strong>omitted / <code>undefined</code></strong> — behaves identically to <code>&quot;version&quot;</code>.
Only relevant when modules are registered via <code>api.slothlet.api.add()</code> with a <code>versionConfig</code> argument.</li>
</ul>

**Kind**: function property of [<code>SlothletOptions</code>](#typedef_module_at_cldmv_slash_slothlet_SlothletOptions)

* * *


| Property | Type | Default | Description |
| --- | --- | --- | --- |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_base"></a>[base] | <code>string</code> |  | Directory (node mode) or file:// URL / base URL (browser mode) to load API modules from. Required in both modes. Plain filesystem paths are automatically converted to `file://` URLs by the default browser-mode resolver. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_dir"></a>[dir] | <code>string</code> |  | Deprecated alias for `base`. Still accepted; emits a `V3_CONFIG_DEPRECATED` warning unless `silent: true`. Will be removed in v4. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_mode"></a>[mode] | <code>"eager" \| "lazy"</code> | <code>"eager"</code> | Loading strategy. <ul> <li>`"eager"` — all modules are loaded immediately at startup (default).</li> <li>`"lazy"` — modules are loaded on first access via a Proxy. Also accepted: `"immediate"` / `"preload"` (eager aliases); `"deferred"` / `"proxy"` (lazy aliases).</li> </ul> |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_runtime"></a>[runtime] | <code>"async" \| "live"</code> | <code>"async"</code> | Context propagation runtime. <ul> <li>`"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).</li> <li>`"live"` — Experimental live bindings. Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` as aliases for `"async"`.</li> </ul> |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_apiDepth"></a>[apiDepth] | <code>number</code> | <code>Infinity</code> | Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_hidden"></a>[hidden] | <code>string \| Array.<string></code> |  | Glob or array of globs hiding files and folders from the API, matched against each entry's path relative to `base` (folder-style `a/b` or dotted `a.b`; `*` one segment, `**` any depth, `?` one char, `{a,b}` alternation, `!` negation). Files match on their extension-stripped path. Applies on top of the built-in rule that `.`/`__`-prefixed names are hidden by default (`.`/`__`-prefixed folders can be restored via the deprecated `scanHiddenFolders`; files stay hidden). Also accepted per-call by `api.slothlet.api.add(path, dir, { hidden })`, where globs are relative to the added folder. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_scanHiddenFolders"></a>[scanHiddenFolders] | <code>boolean</code> | <code>false</code> | Deprecated escape hatch: restore the pre-v3.11 behavior of scanning `.`/`__`-prefixed folders. Emits a `CONFIG_SCAN_HIDDEN_FOLDERS_DEPRECATED` warning when supplied (unless `silent: true`). Will be removed in v4. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_context"></a>[context] | <code>object \| null</code> | <code>null</code> | Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_reference"></a>[reference] | <code>object \| null</code> | <code>null</code> | Object whose properties are merged directly onto the root API and also available as `api.slothlet.reference`. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_scope"></a>[scope] | <code>Object</code> |  | Controls how per-request scope data is merged. `"shallow"` merges top-level keys; `"deep"` recurses into nested objects. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_api"></a>[api] | <code>object</code> |  | API build and mutation settings. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_api-collision"></a>[api.collision] | <code>string \| Object</code> | <code>"merge"</code> | Collision strategy when two modules export the same path. Modes: `"merge"` (default), `"merge-replace"`, `"replace"`, `"skip"`, `"warn"`, `"error"`. Pass an object to use different strategies for the initial build vs. runtime `api.slothlet.api.add()` calls. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_api-mutations"></a>[api.mutations] | <code>object</code> | <code>{add:true,remove:true,reload:true}</code> | Enable or disable runtime mutation methods on `api.slothlet.api`. Object with boolean keys `add`, `remove`, `reload` (all default `true`). |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_hook"></a>[hook] | <code>boolean \| string \| object</code> | <code>false</code> | Hook system configuration. <ul> <li>`false` — disabled (default).</li> <li>`true` — enabled, all endpoints.</li> <li>`string` — enabled with a default glob pattern.</li> <li>`object` — full control: `{ enabled: boolean, pattern?: string, suppressErrors?: boolean }`.</li> </ul> |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions"></a>[permissions] | <code>object</code> |  | Permission system configuration. Omit it and the system is off entirely. See <a href="docs/PERMISSIONS.md#configuration">PERMISSIONS.md</a>. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-defaultPolicy"></a>[permissions.defaultPolicy] | <code>"allow" \| "deny"</code> | <code>"allow"</code> | Fallback when no rule matches. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-enabled"></a>[permissions.enabled] | <code>boolean</code> | <code>true</code> | Global enforcement toggle. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-audit"></a>[permissions.audit] | <code>"default" \| "verbose" \| boolean</code> | <code>"default"</code> | Audit level; `true`/`false` normalize to `"default"`. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-readGating"></a>[permissions.readGating] | <code>boolean</code> | <code>true</code> | Gate terminal data-value reads the same way calls are gated. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-failOpenOnAbsentCaller"></a>[permissions.failOpenOnAbsentCaller] | <code>boolean</code> | <code>false</code> | Restore the legacy fail-open treatment of calls with no resolvable caller. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-owner"></a>[permissions.owner] | <code>boolean</code> | <code>false</code> | Owner grant (#509): a caller leaf may access any target leaf currently owned by the same module (the initial load's base module, or an `api.add()`'s `moduleID`) — across that module's own directories — wherever `defaultPolicy` would otherwise deny. Matched by owner, not path, so another module mounted into the same namespace gets nothing; an explicit deny rule still wins. See <a href="docs/PERMISSIONS.md#owner-grant">PERMISSIONS.md</a>. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-references"></a>[permissions.references] | <code>object</code> |  | Options for api functions held as references (`{ capture?: boolean }`). |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-private"></a>[permissions.private] | <code>object</code> |  | Module-privacy host policy (`{ host?: "deny"\|"allow" }`). |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-rules"></a>[permissions.rules] | <code>Array.<object></code> |  | Initial `{ caller, target, effect, condition?, requires? }` rules. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_permissions-events"></a>[permissions.events] | <code>object</code> |  | Event-rule section (`{ default?: "deny"\|"notify"\|"allow", rules?: Array<object> }`). |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_debug"></a>[debug] | <code>boolean \| object</code> | <code>false</code> | Enable verbose internal logging. `true` enables all categories. Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context` to target specific subsystems. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_silent"></a>[silent] | <code>boolean</code> | <code>false</code> | Suppress all console output from slothlet (warnings, deprecations). Does not affect `debug`. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_diagnostics"></a>[diagnostics] | <code>boolean</code> | <code>false</code> | Enable the `api.slothlet.diag.*` introspection namespace. Intended for testing; do not enable in production. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_lifecycle"></a>[lifecycle] | <code>Object.<string, (function()|Array.<function()>)></code> |  | Construction-time lifecycle subscribers, registered on the lifecycle emitter BEFORE the api builds so events emitted during cold-start `buildAPI` (init-time `impl:warning` / `impl:created` / …) are observable. Maps an event name to a handler `function(data, token)` or an array of them; any event name is accepted. Because they are ordinary subscribers, they also receive runtime events afterward — equivalent to calling `api.slothlet.lifecycle.on(event, fn)` for each, but early enough to catch initialization diagnostics. Example: `{ "impl:warning": (d) => log(d), "impl:error": [onError, audit] }`. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_collectLifecycleHooks"></a>[collectLifecycleHooks] | <code>boolean</code> | <code>false</code> | DEPRECATED — will be removed in v4. Expands into two implicit `routines` entries (`{name: "^**.shutdown", mode: "shutdown", order: "depth"}` and the `destroy` equivalent) reproducing this option's original whole-tree, cross-mount, deepest-first scope for literally-named `shutdown`/`destroy` leaves, dropping any existing `shutdown`/`destroy`-mode routine (including the built-in `shutdown` default) in favor of these — and sets the effective `autoRoutines` to `true` unless `autoRoutines` is given explicitly. Nested hooks remain directly callable regardless. Emits a `V3_CONFIG_DEPRECATED` warning unless `silent: true`. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_routines"></a>[routines] | <code>Array.<(string|{name: string, mode: ("manual"|"startup"|"shutdown"|"destroy"), recursive: boolean, order: ("mount"|"depth"), cascade: boolean})></code> |  | Stackable lifecycle routines (#341). Every mounted module exporting a function matching a configured routine name is composed into one callable at its exact composed api path, plus a root cascade (`self.<name>()`, i.e. `api.<name>()`) that runs every matching contribution anywhere. Entries: `"name"` (mode `"manual"`), `"name:mode"`, or `{ name, mode?, recursive?, order?, cascade? }` (`recursive`/`order`/`cascade` only settable via the object form). `name` is mount-relative by default (a bare name matches only a mount's own top level; a dotted name matches a fixed relative sub-path, or with `recursive: true` any depth within the mount); a `^`-prefixed name is root-anchored, matched via glob (`*`, `**`, `{}`, `!`) against the full api path, crossing mount boundaries. `order` (`"mount"` \| `"depth"`, mode-defaulted) controls the root cascade's grouping order. `cascade` (default `true`) controls whether the root `api.<name>()` run-all cascade is created at all — set `cascade: false` (#400) for a per-entity lifecycle routine, where the host must invoke exactly one co-owner by key via `api.<path>.<name>.for(moduleID)(...)` rather than a run-all; every stacked path also exposes `api.<path>.<name>.contributors` (the moduleIDs present there). `.for(key)` runs that one contributor in its own extent/identity with the args passed straight through, and bypasses the `stackRoutines` owner-filter so a specific co-owner runs even if it lost the shared-path collision. Providing `routines` at all REPLACES the built-in defaults (`slothlet.defaults.routines`: `initialize` → `startup`, `shutdown` → `shutdown`) — spread `slothlet.defaults.routines` to extend them instead, or pass `[]` to disable every routine. Every configured routine is always wrapped and directly callable regardless of `autoRoutines`. Whether two or more contributors colliding at the identical api path all run is governed by `stackRoutines` (#365), independent of `collisionMode` — by default only the single contribution that actually owns that path runs, matching ordinary collision behavior. A throwing contributor doesn't stop the chain — every contributor runs (best-effort), and one aggregate `ROUTINE_FAILED` error is thrown afterward if any failed. See <a href="docs/LIFECYCLE.md#routines">LIFECYCLE.md</a>. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_autoRoutines"></a>[autoRoutines] | <code>boolean</code> | <code>false</code> | The non-deprecated replacement for `collectLifecycleHooks`. TEMPORARY v3-compat default (#341): `false` for now, so a project upgrading sees no behavior change from a pre-existing nested leaf that happens to share a routine's name (e.g. `shutdown`) — it stays stacked and directly callable, but does not start auto-firing. When `true`, every `mode: "startup"` routine's cascade runs at the end of compose, and every `mode: "shutdown"`/`"destroy"` routine's cascade runs on the corresponding dispose call. Planned to default to `true` in v4 (`collectLifecycleHooks` removed at the same time) — see <a href="docs/LIFECYCLE.md#routines">LIFECYCLE.md</a>. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_stackRoutines"></a>[stackRoutines] | <code>boolean</code> | <code>false</code> | Whether two or more modules' contributions colliding at the exact same composed api path all run, or only the single contribution that actually owns that path (per `collisionMode`) runs (#365). `false` by default, matching ordinary (non-routine) collision behavior everywhere else in the framework. Deliberately independent of `collisionMode` — a module that loses a collision, under any mode, does not run via the routine system unless this is explicitly `true`. The root cascade runs every matching contribution across distinct api paths regardless of this flag; where two or more contributions land on the identical api path, the cascade applies the same filtering a direct call at that path would. See <a href="docs/LIFECYCLE.md#stackroutines">LIFECYCLE.md</a>. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_tracking"></a>[tracking] | <code>boolean \| object</code> | <code>false</code> | Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_backgroundMaterialize"></a>[backgroundMaterialize] | <code>boolean</code> | <code>false</code> | When `mode: "lazy"`, immediately begins materializing all paths in the background after init. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_i18n"></a>[i18n] | <code>object</code> |  | Internationalization settings (dev-facing, process-global). `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`). |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_platform"></a>[platform] | <code>"browser" \| "node"</code> |  | Execution-environment target. Controls whether filesystem-dependent code paths run. Independent of `env` (the `process.env` snapshot). <ul> <li>`"browser"` — browser/worker/Electron-renderer mode. Skips filesystem operations and the `process.env` snapshot. Requires `manifest`.</li> <li>`"node"` — explicit Node.js mode.</li> <li>Omitted — auto-detected: `"browser"` when a `manifest` is provided (or no Node `process` is present), `"node"` otherwise.</li> </ul> |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_env"></a>[env] | <code>object \| null</code> |  | `process.env` snapshot configuration (Node mode). Independent of `platform`. <ul> <li>`{ include: ["KEY"] }` — allowlist; only the listed keys are captured in `api.slothlet.env`. Non-string entries are silently ignored; an all-non-string array falls back to the full snapshot.</li> <li>Omitted / `null` — the full `process.env` snapshot is captured.</li> </ul> |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_env-include"></a>[env.include] | <code>Array.<string></code> |  | Allowlist of environment variable names to capture. Only string entries are used. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_manifest"></a>[manifest] | <code>Object</code> |  | Pre-generated directory structure for browser mode. Produced at build time by `generateManifest()` from `@cldmv/slothlet/helpers/generate-manifest`. Required when `platform: "browser"`. Presence of `manifest` auto-triggers browser mode without needing an explicit `platform: "browser"`. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_suppressFixes"></a>[suppressFixes] | <code>Array.<string></code> |  | Opt out of specific bug-fix behaviors that landed in v3 and become permanent in v4. Each entry uses the `<rule>_<PR>` form (e.g. `"C03_116"`). Each listed rule emits a `WARN_SUPPRESS_FIX_ACTIVE` deprecation warning unless `silent: true`. Temporary escape hatch — will be removed in v4 when the corrected behaviors become permanent. |
| <a id="typedef_module_at_cldmv_slash_slothlet_SlothletOptions_prop_typescript"></a>[typescript] | <code>boolean \| "fast" \| "strict" \| object</code> | <code>false</code> | TypeScript support. <ul> <li>`false` — disabled (default).</li> <li>`true` or `"fast"` — esbuild transpilation, no type checking.</li> <li>`"strict"` — tsc compilation with type checking and `.d.ts` generation. See <a href="docs/TYPESCRIPT.md">TYPESCRIPT.md</a> for the full configuration reference.</li> </ul> |


* * *



<a id="at_cldmv_slash_slothlet_slash_runtime"></a>

## @cldmv/slothlet/runtime
> <p><strong style="font-size: 1.1em;"><p>Provides live bindings for use inside API module functions. Import the exports you need:</p>
> <pre class="prettyprint source lang-js"><code>import { self, context, instanceID } from &quot;@cldmv/slothlet/runtime&quot;;
> </code></pre>
> <table>
> <thead>
> <tr>
> <th>Export</th>
> <th>Type</th>
> <th>Description</th>
> </tr>
> </thead>
> <tbody>
> <tr>
> <td><code>self</code></td>
> <td><code>SlothletSelf</code></td>
> <td>Live reference to the full Slothlet API proxy. Use to call sibling modules without import cycles. Typed by extending <code>SlothletSelf</code> (see <code>slothlet typegen</code>).</td>
> </tr>
> <tr>
> <td><code>context</code></td>
> <td><code>object</code></td>
> <td>The current ambient context object. Seeded at startup via <code>config.context</code> and persists across calls. <code>api.slothlet.context.run()</code> / <code>.scope()</code> can override it for the duration of a single call. Readable and writable.</td>
> </tr>
> <tr>
> <td><code>instanceID</code></td>
> <td><code>string</code></td>
> <td>Unique identifier of the active Slothlet instance.</td>
> </tr>
> </tbody>
> </table>
> <p>All three are lazy Proxy objects — they resolve to the correct runtime value at call time,
> whether the instance uses <code>&quot;async&quot;</code> (AsyncLocalStorage) or <code>&quot;live&quot;</code> runtime mode.</p></strong></p>
> 








<a id="at_cldmv_slash_slothlet_slash_typegen"></a>

## @cldmv/slothlet/typegen
> <p><strong style="font-size: 1.1em;"><p>Loads a Slothlet API directory in eager + fast TypeScript mode, then writes a
> <code>.d.ts</code> file describing the resulting API shape. Intended for users who want
> editor-time type information for their API without running Slothlet in strict
> mode at runtime.</p>
> <p>The same logic is exposed three ways:</p>
> <ul>
> <li>As a function: <code>import { generateTypes } from &quot;@cldmv/slothlet/typegen&quot;</code></li>
> <li>As a CLI: <code>npx slothlet typegen ./api ./types/api.d.ts MyApi</code></li>
> <li>As a CLI with no args, falling back to the <code>slothlet.typegen</code> field in
> the project's <code>package.json</code>.</li>
> </ul>
> <p>Runtime is unaffected — the user runs this on demand (e.g. via <code>prebuild</code> or
> <code>predev</code> scripts) and ships the generated <code>.d.ts</code> alongside (or instead of)
> the source. Slothlet does NOT auto-regenerate types at load time.</p></strong></p>
> 








<a id="at_cldmv_slash_slothlet_slash_helpers_slash_generate-manifest"></a>

## @cldmv/slothlet/helpers/generate-manifest
> <p><strong style="font-size: 1.1em;"><p>Two entry points, both <strong>Node.js-only build-time utilities</strong> (they use <code>node:fs</code> / module
> resolution and run in your build step, a Vite/Webpack plugin, or an Electron main process):</p>
> <ul>
> <li><code>generateBrowserAssets(apiDir, { slothletBase })</code> — <strong>the recommended one-call entry.</strong>
> Returns <code>{ manifest, importmap }</code>: the API-directory manifest <strong>and</strong> the importmap covering
> both slothlet's own modules (see #123) and the exact <code>exports</code> subpaths of the third-party
> packages the registered API leaves import (see #297), so browser consumers never hand-roll it.</li>
> <li><code>generateManifest(dir)</code> — the lower-level primitive that returns just the API manifest
> (the <code>{ files, directories }</code> tree passed to <code>slothlet({ manifest, resolveModuleSpecifier })</code>).</li>
> </ul>
> <p>Why two artifacts: slothlet loads <strong>API leaves</strong> at runtime, so their location is deferred to
> the <code>resolveModuleSpecifier</code> callback (the manifest holds relative paths). slothlet's <strong>own</strong>
> static imports are resolved by the browser <em>before slothlet runs</em>, so they must live in the
> page's <code>&lt;script type=&quot;importmap&quot;&gt;</code> — which is what <code>importmap</code> provides.</p>
> <p>Manifest shape:</p>
> <pre class="prettyprint source lang-json"><code>{
>   &quot;files&quot;: [
>     { &quot;path&quot;: &quot;math.mjs&quot;, &quot;name&quot;: &quot;math&quot;, &quot;fullName&quot;: &quot;math.mjs&quot; }
>   ],
>   &quot;directories&quot;: [
>     {
>       &quot;name&quot;: &quot;utils&quot;,
>       &quot;path&quot;: &quot;utils&quot;,
>       &quot;children&quot;: {
>         &quot;files&quot;: [{ &quot;path&quot;: &quot;utils/format.mjs&quot;, &quot;name&quot;: &quot;format&quot;, &quot;fullName&quot;: &quot;format.mjs&quot; }],
>         &quot;directories&quot;: []
>       }
>     }
>   ]
> }
> </code></pre></strong></p>
> 




**Example**
```js
// build.mjs — run this at build time in Node.js
import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
import { writeFileSync } from "node:fs";

const manifest = await generateManifest("./src/api");
writeFileSync("./public/api-manifest.json", JSON.stringify(manifest, null, 2));
```
**Example**
```js
// app.js — use the manifest at runtime in the browser
import manifest from "./public/api-manifest.json" assert { type: "json" };
import { slothlet } from "@cldmv/slothlet";
import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";

const api = await slothlet({
  manifest,
  resolveModuleSpecifier: createManifestResolver(new URL("./api/", import.meta.url))
});
```






<a id="at_cldmv_slash_slothlet_slash_helpers_slash_instance-imports"></a>

## @cldmv/slothlet/helpers/instance-imports
> <p><strong style="font-size: 1.1em;"><p>The loader imports every leaf with a per-instance query
> (<code>?slothlet_instance=&lt;id&gt;[&amp;module=&lt;moduleID&gt;][&amp;_reload=&lt;timestamp&gt;]</code>), so each instance — and each
> reload — evaluates its own copy of the leaf. A module the leaf IMPORTS is resolved by the host,
> which knows nothing about that query: a relative helper would be one module shared by every
> instance and every reload, and module-level state in it would leak between instances.</p>
> <p>This module closes that gap for everything reachable through relative or <code>file:</code> specifiers,
> at any depth:</p>
> <ul>
> <li><strong>Native Node</strong> — {@link installInstanceImportHooks} registers a process-wide, in-thread resolve
> hook (<code>module.registerHooks()</code>, Node &gt;= 22.15 — slothlet's engines floor) that copies the
> importing module's instance parameter onto the child. Registered once per process; a no-op
> for every import whose parent carries no slothlet query.</li>
> <li><strong>Vite / vitest</strong> — {@link slothletInstanceImports} is the same rule as a vite <code>resolveId</code>
> plugin, for leaves loaded through a consumer's <code>import</code> hook into a vite module graph (where
> Node's resolve hooks never run).</li>
> </ul>
> <p>A helper is ONE copy per instance. Only <code>slothlet_instance</code> is copied: not the leaf's <code>module</code>
> (mount) parameter, so the base leaves and every <code>api.slothlet.api.add</code> mount share the copy; and
> not the leaf's <code>_reload</code> stamp, so a partial reload (<code>api.slothlet.api.reload(…)</code>) re-imports the
> reloaded leaves against the instance's existing helper copy — helper state survives it. A full
> reload (<code>api.slothlet.reload()</code>) rotates the instance ID, which is what gives helpers a fresh
> copy; edits to helper code therefore need a full reload.</p>
> <p>What stays shared: bare specifiers (<code>node_modules</code> packages, <code>node:</code> builtins, subpath <code>#imports</code>,
> <code>@cldmv/slothlet</code> and its runtime), any file inside a <code>node_modules</code> package other than the
> importer's own, and slothlet's own source files — the live-binding runtime must remain one
> module per process.</p></strong></p>
> 








<a id="at_cldmv_slash_slothlet_slash_helpers_slash_manifest-resolver"></a>

## @cldmv/slothlet/helpers/manifest-resolver
> <p><strong style="font-size: 1.1em;"><p><code>createManifestResolver(base)</code> produces a <code>resolveModuleSpecifier</code> function that
> resolves manifest-relative file paths to absolute URLs using the standard
> <code>new URL(path, base)</code> algorithm. This is the correct resolver for any deployment
> where API modules are served from a known base URL (the vast majority of use cases).</p>
> <p>This file has <strong>no Node.js-specific imports</strong> — it is safe to include in a browser
> bundle directly. For the build-time <code>generateManifest</code> utility (which uses <code>node:fs</code>)
> see <code>@cldmv/slothlet/helpers/generate-manifest</code>.</p>
> <h3>Typical browser workflow</h3>
> <pre class="prettyprint source lang-text"><code>Build time  →  generateManifest(&quot;./src/api&quot;)  →  api-manifest.json
> Bundle time →  import api-manifest.json
> Runtime     →  createManifestResolver(import.meta.url)  →  pass to slothlet()
> </code></pre></strong></p>
> 




**Example**
```js
// API modules live next to the current module
import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
import manifest from "./api-manifest.json" assert { type: "json" };
import { slothlet } from "@cldmv/slothlet";

const api = await slothlet({
  manifest,
  resolveModuleSpecifier: createManifestResolver(import.meta.url)
});
```
**Example**
```js
// API modules live in a sub-directory relative to the current module
import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";

const api = await slothlet({
  manifest,
  resolveModuleSpecifier: createManifestResolver(new URL("./api/", import.meta.url))
});
```








