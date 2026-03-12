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

[@cldmv/slothlet(config)](#at_cldmv_slash_slothlet) ⇒ <code>Promise.&lt;SlothletAPI&gt;</code>
  * [.destroy()](#typedef_SlothletAPI_prop_destroy)
  * [.shutdown()](#typedef_SlothletAPI_prop_shutdown)
  * [.slothlet](#typedef_SlothletAPI_prop_slothlet) ⇒ <code>object</code>
    * [.api](#typedef_SlothletAPI_prop_slothlet-api) ⇒ <code>object</code>
      * [.add()](#typedef_SlothletAPI_prop_slothlet-api-add)
      * [.reload()](#typedef_SlothletAPI_prop_slothlet-api-reload)
      * [.remove()](#typedef_SlothletAPI_prop_slothlet-api-remove)
    * [.context](#typedef_SlothletAPI_prop_slothlet-context) ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-context-get)
      * [.inspect()](#typedef_SlothletAPI_prop_slothlet-context-inspect)
      * [.run()](#typedef_SlothletAPI_prop_slothlet-context-run)
      * [.scope()](#typedef_SlothletAPI_prop_slothlet-context-scope)
      * [.set()](#typedef_SlothletAPI_prop_slothlet-context-set)
    * [\[.diag\]](#typedef_SlothletAPI_prop_slothlet-diag) ⇒ <code>object</code>
      * [\[.caches\]](#typedef_SlothletAPI_prop_slothlet-diag-caches) ⇒ <code>object</code>
        * [\[.get\]()](#typedef_SlothletAPI_prop_slothlet-diag-caches-get)
        * [\[.getAllModuleIDs\]()](#typedef_SlothletAPI_prop_slothlet-diag-caches-getAllModuleIDs)
        * [\[.has\]()](#typedef_SlothletAPI_prop_slothlet-diag-caches-has)
      * [\[.context\]](#typedef_SlothletAPI_prop_slothlet-diag-context) ⇒ <code>object</code>
      * [\[.describe\]()](#typedef_SlothletAPI_prop_slothlet-diag-describe)
      * [\[.getAPI\]()](#typedef_SlothletAPI_prop_slothlet-diag-getAPI)
      * [\[.getOwnership\]()](#typedef_SlothletAPI_prop_slothlet-diag-getOwnership)
      * [\[.hook\]](#typedef_SlothletAPI_prop_slothlet-diag-hook) ⇒ <code>object</code>
      * [\[.inspect\]()](#typedef_SlothletAPI_prop_slothlet-diag-inspect)
      * [\[.owner\]](#typedef_SlothletAPI_prop_slothlet-diag-owner) ⇒ <code>object</code>
        * [\[.get\]()](#typedef_SlothletAPI_prop_slothlet-diag-owner-get)
      * [\[.reference\]](#typedef_SlothletAPI_prop_slothlet-diag-reference) ⇒ <code>object</code>
      * [\[.SlothletWarning\]()](#typedef_SlothletAPI_prop_slothlet-diag-SlothletWarning)
    * [.hook](#typedef_SlothletAPI_prop_slothlet-hook) ⇒ <code>object</code>
      * [.clear()](#typedef_SlothletAPI_prop_slothlet-hook-clear)
      * [.disable()](#typedef_SlothletAPI_prop_slothlet-hook-disable)
      * [.enable()](#typedef_SlothletAPI_prop_slothlet-hook-enable)
      * [.list()](#typedef_SlothletAPI_prop_slothlet-hook-list)
      * [.off()](#typedef_SlothletAPI_prop_slothlet-hook-off)
      * [.on()](#typedef_SlothletAPI_prop_slothlet-hook-on)
      * [.remove()](#typedef_SlothletAPI_prop_slothlet-hook-remove)
    * [.lifecycle](#typedef_SlothletAPI_prop_slothlet-lifecycle) ⇒ <code>object</code>
      * [.off()](#typedef_SlothletAPI_prop_slothlet-lifecycle-off)
      * [.on()](#typedef_SlothletAPI_prop_slothlet-lifecycle-on)
    * [.materialize](#typedef_SlothletAPI_prop_slothlet-materialize) ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-materialize-get)
      * [.materialized](#typedef_SlothletAPI_prop_slothlet-materialize-materialized) ⇒ <code>boolean</code>
      * [.wait()](#typedef_SlothletAPI_prop_slothlet-materialize-wait)
    * [.metadata](#typedef_SlothletAPI_prop_slothlet-metadata) ⇒ <code>object</code>
      * [.caller()](#typedef_SlothletAPI_prop_slothlet-metadata-caller)
      * [.get()](#typedef_SlothletAPI_prop_slothlet-metadata-get)
      * [.remove()](#typedef_SlothletAPI_prop_slothlet-metadata-remove)
      * [.removeFor()](#typedef_SlothletAPI_prop_slothlet-metadata-removeFor)
      * [.self()](#typedef_SlothletAPI_prop_slothlet-metadata-self)
      * [.set()](#typedef_SlothletAPI_prop_slothlet-metadata-set)
      * [.setFor()](#typedef_SlothletAPI_prop_slothlet-metadata-setFor)
      * [.setGlobal()](#typedef_SlothletAPI_prop_slothlet-metadata-setGlobal)
    * [.owner](#typedef_SlothletAPI_prop_slothlet-owner) ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-owner-get)
    * [.ownership](#typedef_SlothletAPI_prop_slothlet-ownership) ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-ownership-get)
      * [.unregister()](#typedef_SlothletAPI_prop_slothlet-ownership-unregister)
    * [\[.reference\]](#typedef_SlothletAPI_prop_slothlet-reference) ⇒ <code>object</code>
    * [.reload()](#typedef_SlothletAPI_prop_slothlet-reload)
    * [.run()](#typedef_SlothletAPI_prop_slothlet-run)
    * [.scope()](#typedef_SlothletAPI_prop_slothlet-scope)
    * [.shutdown()](#typedef_SlothletAPI_prop_slothlet-shutdown)


**Type Definitions**

  * [SlothletOptions](#typedef_SlothletOptions) : <code>object</code>
  * [SlothletAPI](#typedef_SlothletAPI) : <code>object</code>


**Example**
```js
// ESM default import (recommended)
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ dir: "./api" });
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
const api = await slothlet({ dir: "./api", mode: "lazy" });
```
**Example**
```js
// With per-request context isolation
const api = await slothlet({
  dir: "./api",
  context: { db, logger },
  runtime: "async"
});

// Inside an API module, access context via:
// import { context } from "@cldmv/slothlet/runtime";
```
**Example**
```js
// With hook interception
const api = await slothlet({ dir: "./api", hook: true });
api.slothlet.hook.on("before", "math.*", (endpoint, args) => {
  console.log("calling:", endpoint, args);
});
```
**Example**
```js
// Multiple independent instances
const api1 = await slothlet({ dir: "./api" });
const api2 = await slothlet({ dir: "./other-api" });
```
**Example**
```js
// Shutdown when done
await api.slothlet.shutdown();
```





* * *

<a id="at_cldmv_slash_slothlet"></a>

### @cldmv/slothlet(config) ⇒ <code>Promise.&lt;SlothletAPI&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Create a new Slothlet instance and load an API from a directory.
> This is the sole public entry point for slothlet. Each call produces an independent
> API instance with its own component graph, context store, and lifecycle.</p></strong></p>
> 

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| config | <code>[SlothletOptions](#typedef_SlothletOptions)</code> |  | <p>Configuration options</p> |
| config.dir | <code>string</code> |  | <p>Directory to scan for API modules. Relative paths are resolved from the calling file.</p> |
| [config.mode] | <code>"eager" | "lazy"</code> | <code>"eager"</code> | <p>Loading strategy.</p> <ul> <li><code>&quot;eager&quot;</code> — all modules are loaded immediately at startup (default).</li> <li><code>&quot;lazy&quot;</code> — modules are loaded on first access via a Proxy. Also accepted: <code>&quot;immediate&quot;</code> / <code>&quot;preload&quot;</code> (eager aliases); <code>&quot;deferred&quot;</code> / <code>&quot;proxy&quot;</code> (lazy aliases).</li> </ul> |
| [config.runtime] | <code>"async" | "live"</code> | <code>"async"</code> | <p>Context propagation runtime.</p> <ul> <li><code>&quot;async&quot;</code> — AsyncLocalStorage (Node.js built-in, recommended for production).</li> <li><code>&quot;live&quot;</code> — Experimental live bindings. Also accepted: <code>&quot;asynclocalstorage&quot;</code> / <code>&quot;als&quot;</code> / <code>&quot;node&quot;</code> as aliases for <code>&quot;async&quot;</code>.</li> </ul> |
| [config.apiDepth] | <code>number</code> | <code>Infinity</code> | <p>Directory traversal depth. <code>Infinity</code> scans all subdirectories (default). <code>0</code> scans only the root.</p> |
| [config.context] | <code>object | null</code> | <code>null</code> | <p>Object merged into the per-request context accessible inside API functions via <code>import { context } from &quot;@cldmv/slothlet/runtime&quot;</code>.</p> |
| [config.reference] | <code>object | null</code> | <code>null</code> | <p>Object whose properties are merged directly onto the root API and also available as <code>api.slothlet.reference</code>.</p> |
| [config.scope] | <code>Object</code> |  | <p>Controls how per-request scope data is merged. <code>&quot;shallow&quot;</code> merges top-level keys; <code>&quot;deep&quot;</code> recurses into nested objects.</p> |
| [config.api] | <code>object</code> |  | <p>API build and mutation settings.</p> |
| [config.api.collision] | <code>string | Object</code> | <code>"merge"</code> | <p>Collision strategy when two modules export the same path. Modes: <code>&quot;merge&quot;</code> (default), <code>&quot;merge-replace&quot;</code>, <code>&quot;replace&quot;</code>, <code>&quot;skip&quot;</code>, <code>&quot;warn&quot;</code>, <code>&quot;error&quot;</code>. Pass an object to use different strategies for the initial build vs. runtime <code>api.slothlet.api.add()</code> calls.</p> |
| [config.api.mutations] | <code>object</code> | <code>{add:true,remove:true,reload:true}</code> | <p>Enable or disable runtime mutation methods on <code>api.slothlet.api</code>. Object with boolean keys <code>add</code>, <code>remove</code>, <code>reload</code> (all default <code>true</code>).</p> |
| [config.hook] | <code>boolean | string | object</code> | <code>false</code> | <p>Hook system configuration.</p> <ul> <li><code>false</code> — disabled (default).</li> <li><code>true</code> — enabled, all endpoints.</li> <li><code>string</code> — enabled with a default glob pattern.</li> <li><code>object</code> — full control: <code>{ enabled: boolean, pattern?: string, suppressErrors?: boolean }</code>.</li> </ul> |
| [config.debug] | <code>boolean | object</code> | <code>false</code> | <p>Enable verbose internal logging. <code>true</code> enables all categories. Pass an object with sub-keys <code>builder</code>, <code>api</code>, <code>index</code>, <code>modes</code>, <code>wrapper</code>, <code>ownership</code>, <code>context</code> to target specific subsystems.</p> |
| [config.silent] | <code>boolean</code> | <code>false</code> | <p>Suppress all console output from slothlet (warnings, deprecations). Does not affect <code>debug</code>.</p> |
| [config.diagnostics] | <code>boolean</code> | <code>false</code> | <p>Enable the <code>api.slothlet.diag.*</code> introspection namespace. Intended for testing; do not enable in production.</p> |
| [config.tracking] | <code>boolean | object</code> | <code>false</code> | <p>Enable internal tracking. Pass <code>true</code> or <code>{ materialization: true }</code> to track lazy-mode materialization progress.</p> |
| [config.backgroundMaterialize] | <code>boolean</code> | <code>false</code> | <p>When <code>mode: &quot;lazy&quot;</code>, immediately begins materializing all paths in the background after init.</p> |
| [config.i18n] | <code>object</code> |  | <p>Internationalization settings (dev-facing, process-global). <code>{ language: string }</code> — selects the locale for framework messages (e.g. <code>&quot;en-us&quot;</code>, <code>&quot;fr-fr&quot;</code>, <code>&quot;ja-jp&quot;</code>).</p> |
| [config.typescript] | <code>boolean | "fast" | "strict" | object</code> | <code>false</code> | <p>TypeScript support.</p> <ul> <li><code>false</code> — disabled (default).</li> <li><code>true</code> or <code>&quot;fast&quot;</code> — esbuild transpilation, no type checking.</li> <li><code>&quot;strict&quot;</code> — tsc compilation with type checking and <code>.d.ts</code> generation. See <a href="docs/TYPESCRIPT.md">TYPESCRIPT.md</a> for the full configuration reference.</li> </ul> |


**Returns**:

- <code>Promise.&lt;SlothletAPI&gt;</code> <p>Fully loaded, proxy-based API object</p>


**SlothletAPI Properties**:

| Property | Type | Description |
| --- | --- | --- |
| slothlet | <code>object</code> | <p>Built-in control namespace. All framework internals live here to avoid collisions with loaded modules.</p> |
| slothlet.api | <code>object</code> | <p>Runtime API mutation methods — availability controlled by <code>api.mutations</code> config option.</p> |
| slothlet.context | <code>object</code> | <p>Per-request context helpers.</p> |
| [slothlet.diag] | <code>object</code> | <p>Diagnostics namespace — only present when <code>diagnostics: true</code>. Do not enable in production.</p> |
| [slothlet.diag.caches] | <code>object</code> | <p>Cache diagnostics sub-namespace.</p> |
| [slothlet.diag.context] | <code>object</code> | <p>The <code>context</code> config value as passed to <code>slothlet()</code>.</p> |
| [slothlet.diag.hook] | <code>object</code> | <p>Hook system diagnostics sub-namespace (present only when hooks are enabled).</p> |
| [slothlet.diag.owner] | <code>object</code> | <p>Ownership sub-namespace for diagnostics.</p> |
| [slothlet.diag.reference] | <code>object</code> | <p>The <code>reference</code> config value as passed to <code>slothlet()</code>.</p> |
| slothlet.hook | <code>object</code> | <p>Hook registration surface — only present when the <code>hook</code> option is enabled.</p> |
| slothlet.lifecycle | <code>object</code> | <p>Lifecycle event emitter.</p> |
| slothlet.materialize | <code>object</code> | <p>Lazy materialization tracking (meaningful only when <code>mode: &quot;lazy&quot;</code>).</p> |
| slothlet.materialize.materialized | <code>boolean</code> | <p><code>true</code> once all lazy folders have been fully loaded.</p> |
| slothlet.metadata | <code>object</code> | <p>Module metadata accessor.</p> |
| slothlet.owner | <code>object</code> | <p>Direct path ownership accessor (shorthand for <code>slothlet.ownership</code>).</p> |
| slothlet.ownership | <code>object</code> | <p>Module ownership registry.</p> |
| [slothlet.reference] | <code>object</code> | <p>The <code>reference</code> object from config, merged onto the root API and accessible here.</p> |


**SlothletAPI Methods** — see [SlothletAPI](#typedef_SlothletAPI) for full documentation:

| Method | Description |
| --- | --- |
| [destroy()](#typedef_SlothletAPI_prop_destroy) | Like <code>shutdown()</code> but additionally invokes registered destroy hooks before teardown. |
| [shutdown()](#typedef_SlothletAPI_prop_shutdown) | Convenience alias for <code>slothlet.shutdown()</code>. Shuts down the instance and invokes any user-provided shutdown hook first. |
| [slothlet.api.add()](#typedef_SlothletAPI_prop_slothlet-api-add) | Mount a new API module at runtime. |
| [slothlet.api.reload()](#typedef_SlothletAPI_prop_slothlet-api-reload) | Hot-reload a specific module or directory path. |
| [slothlet.api.remove()](#typedef_SlothletAPI_prop_slothlet-api-remove) | Unmount an API module at runtime. |
| [slothlet.context.get()](#typedef_SlothletAPI_prop_slothlet-context-get) | Get a value from the current per-request context store. |
| [slothlet.context.inspect()](#typedef_SlothletAPI_prop_slothlet-context-inspect) | Return a snapshot of the current context state (for debugging). |
| [slothlet.context.run()](#typedef_SlothletAPI_prop_slothlet-context-run) | Execute a callback with isolated context data merged in. |
| [slothlet.context.scope()](#typedef_SlothletAPI_prop_slothlet-context-scope) | Execute a function with structured context options (<code>context</code>, <code>fn</code>, <code>args</code>, <code>merge</code>, <code>isolation</code>). |
| [slothlet.context.set()](#typedef_SlothletAPI_prop_slothlet-context-set) | Set a value in the current per-request context store. |
| [[slothlet.diag.caches.get()]](#typedef_SlothletAPI_prop_slothlet-diag-caches-get) | Get full cache diagnostic data (<code>{ totalCaches, caches[] }</code>). |
| [[slothlet.diag.caches.getAllModuleIDs()]](#typedef_SlothletAPI_prop_slothlet-diag-caches-getAllModuleIDs) | Return all moduleIDs currently in cache. |
| [[slothlet.diag.caches.has()]](#typedef_SlothletAPI_prop_slothlet-diag-caches-has) | Check whether a cache entry exists for a given moduleID. |
| [[slothlet.diag.describe()]](#typedef_SlothletAPI_prop_slothlet-diag-describe) | Describe API structure. Pass <code>true</code> to return the full API object; omit for top-level keys only. |
| [[slothlet.diag.getAPI()]](#typedef_SlothletAPI_prop_slothlet-diag-getAPI) | Return the live bound API proxy object. |
| [[slothlet.diag.getOwnership()]](#typedef_SlothletAPI_prop_slothlet-diag-getOwnership) | Return ownership diagnostics for all registered API paths. |
| [[slothlet.diag.inspect()]](#typedef_SlothletAPI_prop_slothlet-diag-inspect) | Return a full diagnostic snapshot of current instance state. |
| [[slothlet.diag.owner.get()]](#typedef_SlothletAPI_prop_slothlet-diag-owner-get) | Get the owning moduleIDs for a specific API path. |
| [[slothlet.diag.SlothletWarning()]](#typedef_SlothletAPI_prop_slothlet-diag-SlothletWarning) | The <code>SlothletWarning</code> class — access <code>.captured</code> for warnings emitted during tests. |
| [slothlet.hook.clear()](#typedef_SlothletAPI_prop_slothlet-hook-clear) | Alias for <code>remove()</code>. |
| [slothlet.hook.disable()](#typedef_SlothletAPI_prop_slothlet-hook-disable) | Disable hooks matching a filter (empty = disable all). |
| [slothlet.hook.enable()](#typedef_SlothletAPI_prop_slothlet-hook-enable) | Enable hooks matching a filter (empty = enable all). |
| [slothlet.hook.list()](#typedef_SlothletAPI_prop_slothlet-hook-list) | List registered hooks matching a filter. |
| [slothlet.hook.off()](#typedef_SlothletAPI_prop_slothlet-hook-off) | Remove hooks by ID or filter object (v2 alias for <code>remove()</code>). |
| [slothlet.hook.on()](#typedef_SlothletAPI_prop_slothlet-hook-on) | Register a hook handler for a type:pattern (e.g. <code>&quot;before:math.*&quot;</code>). |
| [slothlet.hook.remove()](#typedef_SlothletAPI_prop_slothlet-hook-remove) | Remove hooks matching a filter (<code>id</code>, <code>type</code>, <code>pattern</code>). |
| [slothlet.lifecycle.off()](#typedef_SlothletAPI_prop_slothlet-lifecycle-off) | Unsubscribe a handler from a lifecycle event. |
| [slothlet.lifecycle.on()](#typedef_SlothletAPI_prop_slothlet-lifecycle-on) | Subscribe to a lifecycle event (e.g. <code>&quot;materialized:complete&quot;</code>). |
| [slothlet.materialize.get()](#typedef_SlothletAPI_prop_slothlet-materialize-get) | Get current materialization statistics (<code>{ total, materialized, remaining, percentage }</code>). |
| [slothlet.materialize.wait()](#typedef_SlothletAPI_prop_slothlet-materialize-wait) | Returns a Promise that resolves when all lazy folders are fully materialized. |
| [slothlet.metadata.caller()](#typedef_SlothletAPI_prop_slothlet-metadata-caller) | Get metadata for the function that invoked the current one (runtime-injected). |
| [slothlet.metadata.get()](#typedef_SlothletAPI_prop_slothlet-metadata-get) | Get metadata for a specific function reference. |
| [slothlet.metadata.remove()](#typedef_SlothletAPI_prop_slothlet-metadata-remove) | Remove per-function metadata (all keys or a specific key). |
| [slothlet.metadata.removeFor()](#typedef_SlothletAPI_prop_slothlet-metadata-removeFor) | Remove path-level metadata for a given API path or moduleID. |
| [slothlet.metadata.self()](#typedef_SlothletAPI_prop_slothlet-metadata-self) | Get metadata for the currently-executing API function (runtime-injected). |
| [slothlet.metadata.set()](#typedef_SlothletAPI_prop_slothlet-metadata-set) | Set per-function metadata by direct function reference. |
| [slothlet.metadata.setFor()](#typedef_SlothletAPI_prop_slothlet-metadata-setFor) | Set metadata for all functions reachable under an API path or moduleID. |
| [slothlet.metadata.setGlobal()](#typedef_SlothletAPI_prop_slothlet-metadata-setGlobal) | Set global metadata applied to every function in the instance. |
| [slothlet.owner.get()](#typedef_SlothletAPI_prop_slothlet-owner-get) | Get ownership info for a specific API path. |
| [slothlet.ownership.get()](#typedef_SlothletAPI_prop_slothlet-ownership-get) | Get the set of moduleIDs that own a given API path. |
| [slothlet.ownership.unregister()](#typedef_SlothletAPI_prop_slothlet-ownership-unregister) | Unregister a module from all ownership records. |
| [slothlet.reload()](#typedef_SlothletAPI_prop_slothlet-reload) | Reload the entire instance (re-scans the directory and recreates all module references). Accepts <code>{ keepInstanceID: boolean }</code>. |
| [slothlet.run()](#typedef_SlothletAPI_prop_slothlet-run) | Execute a callback with isolated per-request context data. Convenience alias for <code>slothlet.context.run()</code>. |
| [slothlet.scope()](#typedef_SlothletAPI_prop_slothlet-scope) | Execute a function with full structured per-request context options. Convenience alias for <code>slothlet.context.scope()</code>. |
| [slothlet.shutdown()](#typedef_SlothletAPI_prop_slothlet-shutdown) | Shut down the instance and release all resources. |


**Example**
```js
// ESM default import (recommended)
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ dir: "./api" });
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
const api = await slothlet({ dir: "./api", mode: "lazy" });
```
**Example**
```js
// With per-request context isolation
const api = await slothlet({
  dir: "./api",
  context: { db, logger },
  runtime: "async"
});

// Inside an API module, access context via:
// import { context } from "@cldmv/slothlet/runtime";
```
**Example**
```js
// With hook interception
const api = await slothlet({ dir: "./api", hook: true });
api.slothlet.hook.on("before", "math.*", (endpoint, args) => {
  console.log("calling:", endpoint, args);
});
```
**Example**
```js
// Multiple independent instances
const api1 = await slothlet({ dir: "./api" });
const api2 = await slothlet({ dir: "./other-api" });
```
**Example**
```js
// Shutdown when done
await api.slothlet.shutdown();
```




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
> <td><code>object</code></td>
> <td>Live reference to the full Slothlet API proxy. Use to call sibling modules without import cycles.</td>
> </tr>
> <tr>
> <td><code>context</code></td>
> <td><code>object</code></td>
> <td>Per-request context data set by <code>api.slothlet.context.run(ctx, fn)</code>. Readable and writable.</td>
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











* * *

## Type Definitions

<a id="typedef_SlothletOptions"></a>

### SlothletOptions : <code>object</code>
<p>Configuration options passed to {@link module:@cldmv/slothlet slothlet()}.</p>

**Kind**: typedef  
**Scope**: global


| Property | Type | Default | Description |
| --- | --- | --- | --- |
| <a id="typedef_SlothletOptions_prop_dir"></a>dir | <code>string</code> |  | Directory to scan for API modules. Relative paths are resolved from the calling file. |
| <a id="typedef_SlothletOptions_prop_mode"></a>[mode] | <code>"eager" | "lazy"</code> | <code>"eager"</code> | Loading strategy. <ul> <li>`"eager"` — all modules are loaded immediately at startup (default).</li> <li>`"lazy"` — modules are loaded on first access via a Proxy. Also accepted: `"immediate"` / `"preload"` (eager aliases); `"deferred"` / `"proxy"` (lazy aliases).</li> </ul> |
| <a id="typedef_SlothletOptions_prop_runtime"></a>[runtime] | <code>"async" | "live"</code> | <code>"async"</code> | Context propagation runtime. <ul> <li>`"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).</li> <li>`"live"` — Experimental live bindings. Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` as aliases for `"async"`.</li> </ul> |
| <a id="typedef_SlothletOptions_prop_apiDepth"></a>[apiDepth] | <code>number</code> | <code>Infinity</code> | Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root. |
| <a id="typedef_SlothletOptions_prop_context"></a>[context] | <code>object | null</code> | <code>null</code> | Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`. |
| <a id="typedef_SlothletOptions_prop_reference"></a>[reference] | <code>object | null</code> | <code>null</code> | Object whose properties are merged directly onto the root API and also available as `api.slothlet.reference`. |
| <a id="typedef_SlothletOptions_prop_scope"></a>[scope] | <code>Object</code> |  | Controls how per-request scope data is merged. `"shallow"` merges top-level keys; `"deep"` recurses into nested objects. |
| <a id="typedef_SlothletOptions_prop_api"></a>[api] | <code>object</code> |  | API build and mutation settings. |
| <a id="typedef_SlothletOptions_prop_api-collision"></a>[api.collision] | <code>string | Object</code> | <code>"merge"</code> | Collision strategy when two modules export the same path. Modes: `"merge"` (default), `"merge-replace"`, `"replace"`, `"skip"`, `"warn"`, `"error"`. Pass an object to use different strategies for the initial build vs. runtime `api.slothlet.api.add()` calls. |
| <a id="typedef_SlothletOptions_prop_api-mutations"></a>[api.mutations] | <code>object</code> | <code>{add:true,remove:true,reload:true}</code> | Enable or disable runtime mutation methods on `api.slothlet.api`. Object with boolean keys `add`, `remove`, `reload` (all default `true`). |
| <a id="typedef_SlothletOptions_prop_hook"></a>[hook] | <code>boolean | string | object</code> | <code>false</code> | Hook system configuration. <ul> <li>`false` — disabled (default).</li> <li>`true` — enabled, all endpoints.</li> <li>`string` — enabled with a default glob pattern.</li> <li>`object` — full control: `{ enabled: boolean, pattern?: string, suppressErrors?: boolean }`.</li> </ul> |
| <a id="typedef_SlothletOptions_prop_debug"></a>[debug] | <code>boolean | object</code> | <code>false</code> | Enable verbose internal logging. `true` enables all categories. Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context` to target specific subsystems. |
| <a id="typedef_SlothletOptions_prop_silent"></a>[silent] | <code>boolean</code> | <code>false</code> | Suppress all console output from slothlet (warnings, deprecations). Does not affect `debug`. |
| <a id="typedef_SlothletOptions_prop_diagnostics"></a>[diagnostics] | <code>boolean</code> | <code>false</code> | Enable the `api.slothlet.diag.*` introspection namespace. Intended for testing; do not enable in production. |
| <a id="typedef_SlothletOptions_prop_tracking"></a>[tracking] | <code>boolean | object</code> | <code>false</code> | Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress. |
| <a id="typedef_SlothletOptions_prop_backgroundMaterialize"></a>[backgroundMaterialize] | <code>boolean</code> | <code>false</code> | When `mode: "lazy"`, immediately begins materializing all paths in the background after init. |
| <a id="typedef_SlothletOptions_prop_i18n"></a>[i18n] | <code>object</code> |  | Internationalization settings (dev-facing, process-global). `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`). |
| <a id="typedef_SlothletOptions_prop_typescript"></a>[typescript] | <code>boolean | "fast" | "strict" | object</code> | <code>false</code> | TypeScript support. <ul> <li>`false` — disabled (default).</li> <li>`true` or `"fast"` — esbuild transpilation, no type checking.</li> <li>`"strict"` — tsc compilation with type checking and `.d.ts` generation. See <a href="docs/TYPESCRIPT.md">TYPESCRIPT.md</a> for the full configuration reference.</li> </ul> |


* * *

<a id="typedef_SlothletAPI"></a>

### SlothletAPI : <code>object</code>
<p>Bound API object returned by {@link module:@cldmv/slothlet slothlet()}.
The root contains all loaded module exports plus the reserved <code>slothlet</code> namespace.</p>

**Kind**: typedef  
**Scope**: global


| Property | Type | Description |
| --- | --- | --- |
| <a id="typedef_SlothletAPI_prop_slothlet"></a>slothlet | <code>object</code> | Built-in control namespace. All framework internals live here to avoid collisions with loaded modules. |
| <a id="typedef_SlothletAPI_prop_slothlet-api"></a>slothlet.api | <code>object</code> | Runtime API mutation methods — availability controlled by `api.mutations` config option. |
| <a id="typedef_SlothletAPI_prop_slothlet-context"></a>slothlet.context | <code>object</code> | Per-request context helpers. |
| <a id="typedef_SlothletAPI_prop_slothlet-diag"></a>[slothlet.diag] | <code>object</code> | Diagnostics namespace — only present when `diagnostics: true`. Do not enable in production. |
| <a id="typedef_SlothletAPI_prop_slothlet-diag-caches"></a>[slothlet.diag.caches] | <code>object</code> | Cache diagnostics sub-namespace. |
| <a id="typedef_SlothletAPI_prop_slothlet-diag-context"></a>[slothlet.diag.context] | <code>object</code> | The `context` config value as passed to `slothlet()`. |
| <a id="typedef_SlothletAPI_prop_slothlet-diag-hook"></a>[slothlet.diag.hook] | <code>object</code> | Hook system diagnostics sub-namespace (present only when hooks are enabled). |
| <a id="typedef_SlothletAPI_prop_slothlet-diag-owner"></a>[slothlet.diag.owner] | <code>object</code> | Ownership sub-namespace for diagnostics. |
| <a id="typedef_SlothletAPI_prop_slothlet-diag-reference"></a>[slothlet.diag.reference] | <code>object</code> | The `reference` config value as passed to `slothlet()`. |
| <a id="typedef_SlothletAPI_prop_slothlet-hook"></a>slothlet.hook | <code>object</code> | Hook registration surface — only present when the `hook` option is enabled. |
| <a id="typedef_SlothletAPI_prop_slothlet-lifecycle"></a>slothlet.lifecycle | <code>object</code> | Lifecycle event emitter. |
| <a id="typedef_SlothletAPI_prop_slothlet-materialize"></a>slothlet.materialize | <code>object</code> | Lazy materialization tracking (meaningful only when `mode: "lazy"`). |
| <a id="typedef_SlothletAPI_prop_slothlet-materialize-materialized"></a>slothlet.materialize.materialized | <code>boolean</code> | `true` once all lazy folders have been fully loaded. |
| <a id="typedef_SlothletAPI_prop_slothlet-metadata"></a>slothlet.metadata | <code>object</code> | Module metadata accessor. |
| <a id="typedef_SlothletAPI_prop_slothlet-owner"></a>slothlet.owner | <code>object</code> | Direct path ownership accessor (shorthand for `slothlet.ownership`). |
| <a id="typedef_SlothletAPI_prop_slothlet-ownership"></a>slothlet.ownership | <code>object</code> | Module ownership registry. |
| <a id="typedef_SlothletAPI_prop_slothlet-reference"></a>[slothlet.reference] | <code>object</code> | The `reference` object from config, merged onto the root API and accessible here. |


<a id="typedef_SlothletAPI_prop_destroy"></a>

#### destroy()

Like <code>shutdown()</code> but additionally invokes registered destroy hooks before teardown.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_shutdown"></a>

#### shutdown()

Convenience alias for <code>slothlet.shutdown()</code>. Shuts down the instance and invokes any user-provided shutdown hook first.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-api-add"></a>

#### slothlet.api.add()

Mount a new API module at runtime.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-api-reload"></a>

#### slothlet.api.reload()

Hot-reload a specific module or directory path.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-api-remove"></a>

#### slothlet.api.remove()

Unmount an API module at runtime.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-get"></a>

#### slothlet.context.get()

Get a value from the current per-request context store.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-inspect"></a>

#### slothlet.context.inspect()

Return a snapshot of the current context state (for debugging).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-run"></a>

#### slothlet.context.run()

Execute a callback with isolated context data merged in.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-scope"></a>

#### slothlet.context.scope()

Execute a function with structured context options (<code>context</code>, <code>fn</code>, <code>args</code>, <code>merge</code>, <code>isolation</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-set"></a>

#### slothlet.context.set()

Set a value in the current per-request context store.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-caches-get"></a>

#### slothlet.diag.caches.get()

Get full cache diagnostic data (<code>{ totalCaches, caches[] }</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-caches-getAllModuleIDs"></a>

#### slothlet.diag.caches.getAllModuleIDs()

Return all moduleIDs currently in cache.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-caches-has"></a>

#### slothlet.diag.caches.has()

Check whether a cache entry exists for a given moduleID.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-describe"></a>

#### slothlet.diag.describe()

Describe API structure. Pass <code>true</code> to return the full API object; omit for top-level keys only.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-getAPI"></a>

#### slothlet.diag.getAPI()

Return the live bound API proxy object.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-getOwnership"></a>

#### slothlet.diag.getOwnership()

Return ownership diagnostics for all registered API paths.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-inspect"></a>

#### slothlet.diag.inspect()

Return a full diagnostic snapshot of current instance state.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-owner-get"></a>

#### slothlet.diag.owner.get()

Get the owning moduleIDs for a specific API path.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-SlothletWarning"></a>

#### slothlet.diag.SlothletWarning()

The <code>SlothletWarning</code> class — access <code>.captured</code> for warnings emitted during tests.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-clear"></a>

#### slothlet.hook.clear()

Alias for <code>remove()</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-disable"></a>

#### slothlet.hook.disable()

Disable hooks matching a filter (empty = disable all).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-enable"></a>

#### slothlet.hook.enable()

Enable hooks matching a filter (empty = enable all).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-list"></a>

#### slothlet.hook.list()

List registered hooks matching a filter.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-off"></a>

#### slothlet.hook.off()

Remove hooks by ID or filter object (v2 alias for <code>remove()</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-on"></a>

#### slothlet.hook.on()

Register a hook handler for a type:pattern (e.g. <code>&quot;before:math.*&quot;</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-remove"></a>

#### slothlet.hook.remove()

Remove hooks matching a filter (<code>id</code>, <code>type</code>, <code>pattern</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-lifecycle-off"></a>

#### slothlet.lifecycle.off()

Unsubscribe a handler from a lifecycle event.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-lifecycle-on"></a>

#### slothlet.lifecycle.on()

Subscribe to a lifecycle event (e.g. <code>&quot;materialized:complete&quot;</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-materialize-get"></a>

#### slothlet.materialize.get()

Get current materialization statistics (<code>{ total, materialized, remaining, percentage }</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-materialize-wait"></a>

#### slothlet.materialize.wait()

Returns a Promise that resolves when all lazy folders are fully materialized.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-caller"></a>

#### slothlet.metadata.caller()

Get metadata for the function that invoked the current one (runtime-injected).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-get"></a>

#### slothlet.metadata.get()

Get metadata for a specific function reference.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-remove"></a>

#### slothlet.metadata.remove()

Remove per-function metadata (all keys or a specific key).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-removeFor"></a>

#### slothlet.metadata.removeFor()

Remove path-level metadata for a given API path or moduleID.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-self"></a>

#### slothlet.metadata.self()

Get metadata for the currently-executing API function (runtime-injected).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-set"></a>

#### slothlet.metadata.set()

Set per-function metadata by direct function reference.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-setFor"></a>

#### slothlet.metadata.setFor()

Set metadata for all functions reachable under an API path or moduleID.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-setGlobal"></a>

#### slothlet.metadata.setGlobal()

Set global metadata applied to every function in the instance.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-owner-get"></a>

#### slothlet.owner.get()

Get ownership info for a specific API path.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-ownership-get"></a>

#### slothlet.ownership.get()

Get the set of moduleIDs that own a given API path.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-ownership-unregister"></a>

#### slothlet.ownership.unregister()

Unregister a module from all ownership records.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-reload"></a>

#### slothlet.reload()

Reload the entire instance (re-scans the directory and recreates all module references). Accepts <code>{ keepInstanceID: boolean }</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-run"></a>

#### slothlet.run()

Execute a callback with isolated per-request context data. Convenience alias for <code>slothlet.context.run()</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-scope"></a>

#### slothlet.scope()

Execute a function with full structured per-request context options. Convenience alias for <code>slothlet.context.scope()</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *

<a id="typedef_SlothletAPI_prop_slothlet-shutdown"></a>

#### slothlet.shutdown()

Shut down the instance and release all resources.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

* * *


* * *


