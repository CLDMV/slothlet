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
  * [.slothlet](#typedef_SlothletAPI_prop_slothlet) ⇒ <code>object</code>
    * [.shutdown()](#typedef_SlothletAPI_prop_slothlet_dot_shutdown)
    * [.api](#typedef_SlothletAPI_prop_slothlet_dot_api) ⇒ <code>object</code>
    * [.hook](#typedef_SlothletAPI_prop_slothlet_dot_hook) ⇒ <code>object</code>
    * [.context](#typedef_SlothletAPI_prop_slothlet_dot_context) ⇒ <code>object</code>
    * [.lifecycle](#typedef_SlothletAPI_prop_slothlet_dot_lifecycle) ⇒ <code>object</code>
    * [.metadata](#typedef_SlothletAPI_prop_slothlet_dot_metadata) ⇒ <code>object</code>
    * [.ownership](#typedef_SlothletAPI_prop_slothlet_dot_ownership) ⇒ <code>object</code>
    * [[.diag]](#typedef_SlothletAPI_prop_slothlet_dot_diag) ⇒ <code>object</code>
    * [[.reference]](#typedef_SlothletAPI_prop_slothlet_dot_reference) ⇒ <code>object</code>


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
| [config.mode] | <code>"eager" | "lazy"</code> | <code>"eager"</code> | <p>Loading strategy.</p>
<ul>
<li><code>&quot;eager&quot;</code> — all modules are loaded immediately at startup (default).</li>
<li><code>&quot;lazy&quot;</code> — modules are loaded on first access via a Proxy.
Also accepted: <code>&quot;immediate&quot;</code> / <code>&quot;preload&quot;</code> (eager aliases); <code>&quot;deferred&quot;</code> / <code>&quot;proxy&quot;</code> (lazy aliases).</li>
</ul> |
| [config.runtime] | <code>"async" | "live"</code> | <code>"async"</code> | <p>Context propagation runtime.</p>
<ul>
<li><code>&quot;async&quot;</code> — AsyncLocalStorage (Node.js built-in, recommended for production).</li>
<li><code>&quot;live&quot;</code> — Experimental live bindings.
Also accepted: <code>&quot;asynclocalstorage&quot;</code> / <code>&quot;als&quot;</code> / <code>&quot;node&quot;</code> as aliases for <code>&quot;async&quot;</code>.</li>
</ul> |
| [config.apiDepth] | <code>number</code> | <code>Infinity</code> | <p>Directory traversal depth. <code>Infinity</code> scans all subdirectories (default). <code>0</code> scans only the root.</p> |
| [config.context] | <code>object | null</code> | <code>null</code> | <p>Object merged into the per-request context accessible inside API functions via <code>import { context } from &quot;@cldmv/slothlet/runtime&quot;</code>.</p> |
| [config.reference] | <code>object | null</code> | <code>null</code> | <p>Object whose properties are merged directly onto the root API and also available as <code>api.slothlet.reference</code>.</p> |
| [config.scope] | <code>Object</code> |  | <p>Controls how per-request scope data is merged. <code>&quot;shallow&quot;</code> merges top-level keys; <code>&quot;deep&quot;</code> recurses into nested objects.</p> |
| [config.api] | <code>object</code> |  | <p>API build and mutation settings.</p> |
| [config.api.collision] | <code>string | Object</code> | <code>"merge"</code> | <p>Collision strategy when two modules export the same path.
Modes: <code>&quot;merge&quot;</code> (default), <code>&quot;merge-replace&quot;</code>, <code>&quot;replace&quot;</code>, <code>&quot;skip&quot;</code>, <code>&quot;warn&quot;</code>, <code>&quot;error&quot;</code>.
Pass an object to use different strategies for the initial build vs. runtime <code>api.slothlet.api.add()</code> calls.</p> |
| [config.api.mutations] | <code>object</code> | <code>{add:true,remove:true,reload:true}</code> | <p>Enable or disable runtime mutation methods on <code>api.slothlet.api</code>.
Object with boolean keys <code>add</code>, <code>remove</code>, <code>reload</code> (all default <code>true</code>).</p> |
| [config.hook] | <code>boolean | string | object</code> | <code>false</code> | <p>Hook system configuration.</p>
<ul>
<li><code>false</code> — disabled (default).</li>
<li><code>true</code> — enabled, all endpoints.</li>
<li><code>string</code> — enabled with a default glob pattern.</li>
<li><code>object</code> — full control: <code>{ enabled: boolean, pattern?: string, suppressErrors?: boolean }</code>.</li>
</ul> |
| [config.debug] | <code>boolean | object</code> | <code>false</code> | <p>Enable verbose internal logging. <code>true</code> enables all categories.
Pass an object with sub-keys <code>builder</code>, <code>api</code>, <code>index</code>, <code>modes</code>, <code>wrapper</code>, <code>ownership</code>, <code>context</code> to target specific subsystems.</p> |
| [config.silent] | <code>boolean</code> | <code>false</code> | <p>Suppress all console output from slothlet (warnings, deprecations). Does not affect <code>debug</code>.</p> |
| [config.diagnostics] | <code>boolean</code> | <code>false</code> | <p>Enable the <code>api.slothlet.diag.*</code> introspection namespace. Intended for testing; do not enable in production.</p> |
| [config.tracking] | <code>boolean | object</code> | <code>false</code> | <p>Enable internal tracking. Pass <code>true</code> or <code>{ materialization: true }</code> to track lazy-mode materialization progress.</p> |
| [config.backgroundMaterialize] | <code>boolean</code> | <code>false</code> | <p>When <code>mode: &quot;lazy&quot;</code>, immediately begins materializing all paths in the background after init.</p> |
| [config.i18n] | <code>object</code> |  | <p>Internationalization settings (dev-facing, process-global).
<code>{ language: string }</code> — selects the locale for framework messages (e.g. <code>&quot;en-us&quot;</code>, <code>&quot;fr-fr&quot;</code>, <code>&quot;ja-jp&quot;</code>).</p> |
| [config.typescript] | <code>boolean | "fast" | "strict" | object</code> | <code>false</code> | <p>TypeScript support.</p>
<ul>
<li><code>false</code> — disabled (default).</li>
<li><code>true</code> or <code>&quot;fast&quot;</code> — esbuild transpilation, no type checking.</li>
<li><code>&quot;strict&quot;</code> — tsc compilation with type checking and <code>.d.ts</code> generation.
See <a href="docs/TYPESCRIPT.md">TYPESCRIPT.md</a> for the full configuration reference.</li>
</ul> |


**Returns**:

- <code>Promise.&lt;SlothletAPI&gt;</code> <p>Fully loaded, proxy-based API object</p>


**SlothletAPI Properties**:

| Property | Type | Description |
| --- | --- | --- |
| slothlet | <code>object</code> | <p>Built-in control namespace.</p> |
| slothlet.shutdown | <code>function</code> | <p>Shut down the instance and release all resources.</p> |
| slothlet.api | <code>object</code> | <p>Runtime mutation methods (<code>add</code>, <code>remove</code>, <code>reload</code>) — availability controlled by <code>api.mutations</code> option.</p> |
| slothlet.hook | <code>object</code> | <p>Hook registration surface (<code>on</code>, <code>off</code>, <code>once</code>, <code>clear</code>) — only present when <code>hook</code> option is enabled.</p> |
| slothlet.context | <code>object</code> | <p>Per-request context helpers (<code>run</code>, <code>get</code>, <code>set</code>, <code>extend</code>).</p> |
| slothlet.lifecycle | <code>object</code> | <p>Lifecycle event emitter (<code>on</code>, <code>off</code>, <code>once</code>, <code>emit</code>).</p> |
| slothlet.metadata | <code>object</code> | <p>Module metadata accessor (<code>get</code>, <code>set</code>, <code>has</code>).</p> |
| slothlet.ownership | <code>object</code> | <p>Module ownership registry (<code>get</code>, <code>unregister</code>).</p> |
| [slothlet.diag] | <code>object</code> | <p>Diagnostics namespace — only present when <code>diagnostics: true</code>.</p> |
| [slothlet.reference] | <code>object</code> | <p>The <code>reference</code> object from config, accessible as <code>api.slothlet.reference</code>.</p> |


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




<a id="at_cldmv_slash_slothlet_slash_builder"></a>

## @cldmv/slothlet/builder
> <p><strong style="font-size: 1.1em;"><p>API building orchestration (mode-agnostic)</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/builder](#at_cldmv_slash_slothlet_slash_builder)





* * *

<a id="at_cldmv_slash_slothlet_slash_builder"></a>

### @cldmv/slothlet/builder
> <p><strong style="font-size: 1.1em;"><p>API building orchestration (mode-agnostic)</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_errors"></a>

## @cldmv/slothlet/errors
> <p><strong style="font-size: 1.1em;"><p>Custom error classes with i18n support</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/errors](#at_cldmv_slash_slothlet_slash_errors)





* * *

<a id="at_cldmv_slash_slothlet_slash_errors"></a>

### @cldmv/slothlet/errors
> <p><strong style="font-size: 1.1em;"><p>Custom error classes with i18n support</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_i18n"></a>

## @cldmv/slothlet/i18n
> <p><strong style="font-size: 1.1em;"><p>i18n translation system for Slothlet errors</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/i18n](#at_cldmv_slash_slothlet_slash_i18n)





* * *

<a id="at_cldmv_slash_slothlet_slash_i18n"></a>

### @cldmv/slothlet/i18n
> <p><strong style="font-size: 1.1em;"><p>i18n translation system for Slothlet errors</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_ownership"></a>

## @cldmv/slothlet/ownership
> <p><strong style="font-size: 1.1em;"><p>Centralized ownership tracking for hot reload</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/ownership](#at_cldmv_slash_slothlet_slash_ownership)





* * *

<a id="at_cldmv_slash_slothlet_slash_ownership"></a>

### @cldmv/slothlet/ownership
> <p><strong style="font-size: 1.1em;"><p>Centralized ownership tracking for hot reload</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_runtime"></a>

## @cldmv/slothlet/runtime
> <p><strong style="font-size: 1.1em;"><p>Runtime dispatcher - proxies to async or live runtime based on configuration</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/runtime](#at_cldmv_slash_slothlet_slash_runtime)





* * *

<a id="at_cldmv_slash_slothlet_slash_runtime"></a>

### @cldmv/slothlet/runtime
> <p><strong style="font-size: 1.1em;"><p>Runtime dispatcher - proxies to async or live runtime based on configuration</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_builders_slash_api_builder"></a>

## @cldmv/slothlet/builders/api\_builder
> <p><strong style="font-size: 1.1em;"><p>Clones the user API, attaches built-in helpers, and wires lifecycle utilities for
> each Slothlet instance.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/builders/api_builder](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder)


**Example**
```js
const builder = new ApiBuilder(slothlet);
const api = await builder.buildFinalAPI(userApi);
```





* * *

<a id="at_cldmv_slash_slothlet_slash_builders_slash_api_builder"></a>

### @cldmv/slothlet/builders/api_builder
> <p><strong style="font-size: 1.1em;"><p>Clones the user API, attaches built-in helpers, and wires lifecycle utilities for
> each Slothlet instance.</p></strong></p>
> 
**Example**
```js
const builder = new ApiBuilder(slothlet);
const api = await builder.buildFinalAPI(userApi);
```




<a id="at_cldmv_slash_slothlet_slash_builders_slash_api-assignment"></a>

## @cldmv/slothlet/builders/api-assignment
> <p><strong style="font-size: 1.1em;"><p>This module provides a single source of truth for assigning values to API paths.
> Used by both initial API build (processFiles) and hot reload (mutateApiValue).</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/builders/api-assignment](#at_cldmv_slash_slothlet_slash_builders_slash_api-assignment)


**Example**
```js
const assignment = new ApiAssignment(slothlet);
assignment.assignToApiPath(api, "math", mathWrapper, {});
```





* * *

<a id="at_cldmv_slash_slothlet_slash_builders_slash_api-assignment"></a>

### @cldmv/slothlet/builders/api-assignment
> <p><strong style="font-size: 1.1em;"><p>This module provides a single source of truth for assigning values to API paths.
> Used by both initial API build (processFiles) and hot reload (mutateApiValue).</p></strong></p>
> 
**Example**
```js
const assignment = new ApiAssignment(slothlet);
assignment.assignToApiPath(api, "math", mathWrapper, {});
```




<a id="at_cldmv_slash_slothlet_slash_builders_slash_modes-processor"></a>

## @cldmv/slothlet/builders/modes-processor
> <p><strong style="font-size: 1.1em;"><p>Class-based processor for handling mode-specific file and directory transformations.
> Extends ComponentBase for consistent dependency injection and error handling.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/builders/modes-processor](#at_cldmv_slash_slothlet_slash_builders_slash_modes-processor)


**Example**
```js
const processor = new ModesProcessor(slothlet);
await processor.processFiles(api, files, directory, ownership, contextManager, config, 0, "lazy", true, false);
```





* * *

<a id="at_cldmv_slash_slothlet_slash_builders_slash_modes-processor"></a>

### @cldmv/slothlet/builders/modes-processor
> <p><strong style="font-size: 1.1em;"><p>Class-based processor for handling mode-specific file and directory transformations.
> Extends ComponentBase for consistent dependency injection and error handling.</p></strong></p>
> 
**Example**
```js
const processor = new ModesProcessor(slothlet);
await processor.processFiles(api, files, directory, ownership, contextManager, config, 0, "lazy", true, false);
```




<a id="at_cldmv_slash_slothlet_slash_factories_slash_component-base"></a>

## @cldmv/slothlet/factories/component-base
> <p><strong style="font-size: 1.1em;"><p>Provides common getters for all Slothlet component classes (handlers, builders, processors).
> All components extend this class to access the Slothlet instance's configuration and API
> references without passing them through function parameters. Components become modular
> extensions of the Slothlet class itself.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/factories/component-base](#at_cldmv_slash_slothlet_slash_factories_slash_component-base)


**Example**
```js
// ESM
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
class MyHandler extends ComponentBase {
  doSomething() {
    if (this.debug?.api) {
      console.log("Debug mode enabled");
    }
    throw new this.SlothletError("ERROR_CODE", { details: "info" });
  }
}
```
**Example**
```js
// CJS
const { ComponentBase } = require("@cldmv/slothlet/factories/component-base");
class MyHandler extends ComponentBase {
  doSomething() {
    return this.____config.mode;
  }
}
```





* * *

<a id="at_cldmv_slash_slothlet_slash_factories_slash_component-base"></a>

### @cldmv/slothlet/factories/component-base
> <p><strong style="font-size: 1.1em;"><p>Provides common getters for all Slothlet component classes (handlers, builders, processors).
> All components extend this class to access the Slothlet instance's configuration and API
> references without passing them through function parameters. Components become modular
> extensions of the Slothlet class itself.</p></strong></p>
> 
**Example**
```js
// ESM
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
class MyHandler extends ComponentBase {
  doSomething() {
    if (this.debug?.api) {
      console.log("Debug mode enabled");
    }
    throw new this.SlothletError("ERROR_CODE", { details: "info" });
  }
}
```
**Example**
```js
// CJS
const { ComponentBase } = require("@cldmv/slothlet/factories/component-base");
class MyHandler extends ComponentBase {
  doSomething() {
    return this.____config.mode;
  }
}
```




<a id="at_cldmv_slash_slothlet_slash_factories_slash_context"></a>

## @cldmv/slothlet/factories/context
> <p><strong style="font-size: 1.1em;"><p>Context management factory - selects appropriate manager based on runtime</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/factories/context](#at_cldmv_slash_slothlet_slash_factories_slash_context)





* * *

<a id="at_cldmv_slash_slothlet_slash_factories_slash_context"></a>

### @cldmv/slothlet/factories/context
> <p><strong style="font-size: 1.1em;"><p>Context management factory - selects appropriate manager based on runtime</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager"></a>

## @cldmv/slothlet/handlers/api-cache-manager
> <p><strong style="font-size: 1.1em;"><p>Manages complete buildAPI result caches per moduleID. The cache system is the single
> source of truth for all API trees - the live API references cached trees, not copies.
> Each cache stores the complete buildAPI result with all parameters needed for rebuild.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/api-cache-manager](#at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager)


**Example**
```js
const cache = slothlet.handlers.apiCacheManager;
cache.set("base_abc123", {
  endpoint: ".",
  api: apiTree,
  folderPath: "./src",
  mode: "lazy"
});
const baseApi = cache.get("base_abc123").api; // Get API from cache
```





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager"></a>

### @cldmv/slothlet/handlers/api-cache-manager
> <p><strong style="font-size: 1.1em;"><p>Manages complete buildAPI result caches per moduleID. The cache system is the single
> source of truth for all API trees - the live API references cached trees, not copies.
> Each cache stores the complete buildAPI result with all parameters needed for rebuild.</p></strong></p>
> 
**Example**
```js
const cache = slothlet.handlers.apiCacheManager;
cache.set("base_abc123", {
  endpoint: ".",
  api: apiTree,
  folderPath: "./src",
  mode: "lazy"
});
const baseApi = cache.get("base_abc123").api; // Get API from cache
```




<a id="at_cldmv_slash_slothlet_slash_handlers_slash_api-manager"></a>

## @cldmv/slothlet/handlers/api-manager
> <p><strong style="font-size: 1.1em;"><p>Provides runtime handlers that extend a loaded API with new modules, remove modules by path
> or moduleID, and reapply additions to support hot reload workflows. This module manages
> per-instance state as class properties and applies updates without requiring a full instance rebuild.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/api-manager](#at_cldmv_slash_slothlet_slash_handlers_slash_api-manager)


**Example**
```js
// ESM
import { ApiManager } from "@cldmv/slothlet/handlers/api-manager";
const manager = new ApiManager(instance);
await manager.addApiComponent({
	apiPath: "plugins",
	folderPath: "./plugins",
	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
});
```
**Example**
```js
// CJS
const { ApiManager } = require("@cldmv/slothlet/handlers/api-manager");
const manager = new ApiManager(instance);
await manager.addApiComponent({
	apiPath: "plugins",
	folderPath: "./plugins",
	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
});
```





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_api-manager"></a>

### @cldmv/slothlet/handlers/api-manager
> <p><strong style="font-size: 1.1em;"><p>Provides runtime handlers that extend a loaded API with new modules, remove modules by path
> or moduleID, and reapply additions to support hot reload workflows. This module manages
> per-instance state as class properties and applies updates without requiring a full instance rebuild.</p></strong></p>
> 
**Example**
```js
// ESM
import { ApiManager } from "@cldmv/slothlet/handlers/api-manager";
const manager = new ApiManager(instance);
await manager.addApiComponent({
	apiPath: "plugins",
	folderPath: "./plugins",
	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
});
```
**Example**
```js
// CJS
const { ApiManager } = require("@cldmv/slothlet/handlers/api-manager");
const manager = new ApiManager(instance);
await manager.addApiComponent({
	apiPath: "plugins",
	folderPath: "./plugins",
	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
});
```




<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-async"></a>

## @cldmv/slothlet/handlers/context-async
> <p><strong style="font-size: 1.1em;"><p>AsyncLocalStorage-based context manager</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/context-async](#at_cldmv_slash_slothlet_slash_handlers_slash_context-async)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-async"></a>

### @cldmv/slothlet/handlers/context-async
> <p><strong style="font-size: 1.1em;"><p>AsyncLocalStorage-based context manager</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-live"></a>

## @cldmv/slothlet/handlers/context-live
> <p><strong style="font-size: 1.1em;"><p>Live bindings context manager (no AsyncLocalStorage)</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/context-live](#at_cldmv_slash_slothlet_slash_handlers_slash_context-live)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-live"></a>

### @cldmv/slothlet/handlers/context-live
> <p><strong style="font-size: 1.1em;"><p>Live bindings context manager (no AsyncLocalStorage)</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_handlers_slash_hook-manager"></a>

## @cldmv/slothlet/handlers/hook-manager
> <p><strong style="font-size: 1.1em;"><p>Hook manager for intercepting API function calls</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/hook-manager](#at_cldmv_slash_slothlet_slash_handlers_slash_hook-manager)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_hook-manager"></a>

### @cldmv/slothlet/handlers/hook-manager
> <p><strong style="font-size: 1.1em;"><p>Hook manager for intercepting API function calls</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_handlers_slash_lifecycle-token"></a>

## @cldmv/slothlet/handlers/lifecycle-token
> <p><strong style="font-size: 1.1em;"><p>Per-instance lifecycle capability token management.</p>
> <p>Provides an unforgeable capability token system for tagSystemMetadata(). Tokens are
> created fresh per Slothlet instance at load time and stored in a module-private WeakMap.
> No token constant is ever exported — importing this file only yields three functions.</p>
> <h3>Why not a module-level exported Symbol?</h3>
> <p>Node.js caches ES module evaluations. Any code that can resolve the file path of this
> module receives the SAME module object — and thus the same Symbol — as the internal
> runtime. A static exported Symbol is therefore equivalent to a public constant.</p>
> <h3>This design</h3>
> <ul>
> <li>Token is a Symbol created at runtime per Slothlet instance (<code>registerInstance</code>)</li>
> <li>Stored exclusively in a module-private WeakMap — no exportable reference exists</li>
> <li><code>getInstanceToken(slothlet)</code> is the only retrieval path (requires live instance)</li>
> <li><code>verifyToken(slothlet, token)</code> checks identity without leaking the value</li>
> </ul>
> <p>Do NOT add any token-value export to this file or to the package.json exports map.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/lifecycle-token](#at_cldmv_slash_slothlet_slash_handlers_slash_lifecycle-token)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_lifecycle-token"></a>

### @cldmv/slothlet/handlers/lifecycle-token
> <p><strong style="font-size: 1.1em;"><p>Per-instance lifecycle capability token management.</p>
> <p>Provides an unforgeable capability token system for tagSystemMetadata(). Tokens are
> created fresh per Slothlet instance at load time and stored in a module-private WeakMap.
> No token constant is ever exported — importing this file only yields three functions.</p>
> <h3>Why not a module-level exported Symbol?</h3>
> <p>Node.js caches ES module evaluations. Any code that can resolve the file path of this
> module receives the SAME module object — and thus the same Symbol — as the internal
> runtime. A static exported Symbol is therefore equivalent to a public constant.</p>
> <h3>This design</h3>
> <ul>
> <li>Token is a Symbol created at runtime per Slothlet instance (<code>registerInstance</code>)</li>
> <li>Stored exclusively in a module-private WeakMap — no exportable reference exists</li>
> <li><code>getInstanceToken(slothlet)</code> is the only retrieval path (requires live instance)</li>
> <li><code>verifyToken(slothlet, token)</code> checks identity without leaking the value</li>
> </ul>
> <p>Do NOT add any token-value export to this file or to the package.json exports map.</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_handlers_slash_materialize-manager"></a>

## @cldmv/slothlet/handlers/materialize-manager
> <p><strong style="font-size: 1.1em;"><p>Materialization tracking manager for lazy mode</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/materialize-manager](#at_cldmv_slash_slothlet_slash_handlers_slash_materialize-manager)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_materialize-manager"></a>

### @cldmv/slothlet/handlers/materialize-manager
> <p><strong style="font-size: 1.1em;"><p>Materialization tracking manager for lazy mode</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_handlers_slash_metadata"></a>

## @cldmv/slothlet/handlers/metadata
> <p><strong style="font-size: 1.1em;"><p>Metadata API handler for accessing function metadata</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/metadata](#at_cldmv_slash_slothlet_slash_handlers_slash_metadata)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_metadata"></a>

### @cldmv/slothlet/handlers/metadata
> <p><strong style="font-size: 1.1em;"><p>Metadata API handler for accessing function metadata</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper"></a>

## @cldmv/slothlet/handlers/unified-wrapper
> <p><strong style="font-size: 1.1em;"><p>Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/unified-wrapper](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper"></a>

### @cldmv/slothlet/handlers/unified-wrapper
> <p><strong style="font-size: 1.1em;"><p>Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_class-instance-wrapper"></a>

## @cldmv/slothlet/helpers/class-instance-wrapper
> <p><strong style="font-size: 1.1em;"><p>Provides detection and wrapping logic for class instances to preserve AsyncLocalStorage
> context when methods are called on returned instances. Adapted from V2.3.0 implementation.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/class-instance-wrapper](#at_cldmv_slash_slothlet_slash_helpers_slash_class-instance-wrapper)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_class-instance-wrapper"></a>

### @cldmv/slothlet/helpers/class-instance-wrapper
> <p><strong style="font-size: 1.1em;"><p>Provides detection and wrapping logic for class instances to preserve AsyncLocalStorage
> context when methods are called on returned instances. Adapted from V2.3.0 implementation.</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_config"></a>

## @cldmv/slothlet/helpers/config
> <p><strong style="font-size: 1.1em;"><p>Configuration normalization utilities</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/config](#at_cldmv_slash_slothlet_slash_helpers_slash_config)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_config"></a>

### @cldmv/slothlet/helpers/config
> <p><strong style="font-size: 1.1em;"><p>Configuration normalization utilities</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context"></a>

## @cldmv/slothlet/helpers/eventemitter-context
> <p><strong style="font-size: 1.1em;"><p>Node.js EventEmitter does NOT automatically propagate AsyncLocalStorage context
> to event listeners. This module patches EventEmitter.prototype methods to wrap
> all listeners with AsyncResource, preserving the context where they were registered.</p>
> <p>Additionally tracks EventEmitters created within slothlet API context so they can
> be cleaned up on shutdown.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/eventemitter-context](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context"></a>

### @cldmv/slothlet/helpers/eventemitter-context
> <p><strong style="font-size: 1.1em;"><p>Node.js EventEmitter does NOT automatically propagate AsyncLocalStorage context
> to event listeners. This module patches EventEmitter.prototype methods to wrap
> all listeners with AsyncResource, preserving the context where they were registered.</p>
> <p>Additionally tracks EventEmitters created within slothlet API context so they can
> be cleaned up on shutdown.</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_hint-detector"></a>

## @cldmv/slothlet/helpers/hint-detector
> <p><strong style="font-size: 1.1em;"><p>Hint detection system for providing helpful error hints</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/hint-detector](#at_cldmv_slash_slothlet_slash_helpers_slash_hint-detector)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_hint-detector"></a>

### @cldmv/slothlet/helpers/hint-detector
> <p><strong style="font-size: 1.1em;"><p>Hint detection system for providing helpful error hints</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_modes-utils"></a>

## @cldmv/slothlet/helpers/modes-utils
> <p><strong style="font-size: 1.1em;"><p>Pure utility functions for mode processing</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/modes-utils](#at_cldmv_slash_slothlet_slash_helpers_slash_modes-utils)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_modes-utils"></a>

### @cldmv/slothlet/helpers/modes-utils
> <p><strong style="font-size: 1.1em;"><p>Pure utility functions for mode processing</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_resolve-from-caller"></a>

## @cldmv/slothlet/helpers/resolve-from-caller
> <p><strong style="font-size: 1.1em;"><p>Resolves relative paths based on where slothlet() was called from.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/resolve-from-caller](#at_cldmv_slash_slothlet_slash_helpers_slash_resolve-from-caller)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_resolve-from-caller"></a>

### @cldmv/slothlet/helpers/resolve-from-caller
> <p><strong style="font-size: 1.1em;"><p>Resolves relative paths based on where slothlet() was called from.</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_sanitize"></a>

## @cldmv/slothlet/helpers/sanitize
> <p><strong style="font-size: 1.1em;"><p>Advanced filename sanitization with rule-based transformation</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/sanitize](#at_cldmv_slash_slothlet_slash_helpers_slash_sanitize)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_sanitize"></a>

### @cldmv/slothlet/helpers/sanitize
> <p><strong style="font-size: 1.1em;"><p>Advanced filename sanitization with rule-based transformation</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_helpers_slash_utilities"></a>

## @cldmv/slothlet/helpers/utilities
> <p><strong style="font-size: 1.1em;"><p>General utility functions</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/helpers/utilities](#at_cldmv_slash_slothlet_slash_helpers_slash_utilities)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_utilities"></a>

### @cldmv/slothlet/helpers/utilities
> <p><strong style="font-size: 1.1em;"><p>General utility functions</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_modes_slash_eager"></a>

## @cldmv/slothlet/modes/eager
> <p><strong style="font-size: 1.1em;"><p>Eager mode implementation - loads all modules immediately with unified wrapper</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/modes/eager](#at_cldmv_slash_slothlet_slash_modes_slash_eager)





* * *

<a id="at_cldmv_slash_slothlet_slash_modes_slash_eager"></a>

### @cldmv/slothlet/modes/eager
> <p><strong style="font-size: 1.1em;"><p>Eager mode implementation - loads all modules immediately with unified wrapper</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_modes_slash_lazy"></a>

## @cldmv/slothlet/modes/lazy
> <p><strong style="font-size: 1.1em;"><p>Lazy mode implementation - deferred loading with unified wrapper</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/modes/lazy](#at_cldmv_slash_slothlet_slash_modes_slash_lazy)





* * *

<a id="at_cldmv_slash_slothlet_slash_modes_slash_lazy"></a>

### @cldmv/slothlet/modes/lazy
> <p><strong style="font-size: 1.1em;"><p>Lazy mode implementation - deferred loading with unified wrapper</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_processors_slash_flatten"></a>

## @cldmv/slothlet/processors/flatten
> <p><strong style="font-size: 1.1em;"><p>Provides the Flatten class for determining when and how to flatten API structures
> based on comprehensive rule set. Implements 18 core conditions (C01-C18) from
> API-RULES-CONDITIONS.md. Extends ComponentBase for access to Slothlet configuration.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/processors/flatten](#at_cldmv_slash_slothlet_slash_processors_slash_flatten)


**Example**
```js
// Flatten is instantiated by Slothlet and passed to processors
const flatten = new Flatten(slothlet);
const decision = flatten.getFlatteningDecision(options);
const categoryDecisions = flatten.buildCategoryDecisions(options);
```





* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_flatten"></a>

### @cldmv/slothlet/processors/flatten
> <p><strong style="font-size: 1.1em;"><p>Provides the Flatten class for determining when and how to flatten API structures
> based on comprehensive rule set. Implements 18 core conditions (C01-C18) from
> API-RULES-CONDITIONS.md. Extends ComponentBase for access to Slothlet configuration.</p></strong></p>
> 
**Example**
```js
// Flatten is instantiated by Slothlet and passed to processors
const flatten = new Flatten(slothlet);
const decision = flatten.getFlatteningDecision(options);
const categoryDecisions = flatten.buildCategoryDecisions(options);
```




<a id="at_cldmv_slash_slothlet_slash_processors_slash_loader"></a>

## @cldmv/slothlet/processors/loader
> <p><strong style="font-size: 1.1em;"><p>Provides the Loader class which handles module loading with cache-busting,
> recursive directory scanning, export validation, and intelligent API merging.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/processors/loader](#at_cldmv_slash_slothlet_slash_processors_slash_loader)


**Example**
```js
const loader = new Loader(slothletInstance);
const module = await loader.loadModule("./path/to/file.mjs", instanceID);
```





* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_loader"></a>

### @cldmv/slothlet/processors/loader
> <p><strong style="font-size: 1.1em;"><p>Provides the Loader class which handles module loading with cache-busting,
> recursive directory scanning, export validation, and intelligent API merging.</p></strong></p>
> 
**Example**
```js
const loader = new Loader(slothletInstance);
const module = await loader.loadModule("./path/to/file.mjs", instanceID);
```




<a id="at_cldmv_slash_slothlet_slash_processors_slash_type-generator"></a>

## @cldmv/slothlet/processors/type-generator
> <p><strong style="font-size: 1.1em;"><p>TypeScript declaration file (.d.ts) generation</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/processors/type-generator](#at_cldmv_slash_slothlet_slash_processors_slash_type-generator)





* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_type-generator"></a>

### @cldmv/slothlet/processors/type-generator
> <p><strong style="font-size: 1.1em;"><p>TypeScript declaration file (.d.ts) generation</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_processors_slash_typescript"></a>

## @cldmv/slothlet/processors/typescript
> <p><strong style="font-size: 1.1em;"><p>TypeScript file transformation using esbuild (fast mode)</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/processors/typescript](#at_cldmv_slash_slothlet_slash_processors_slash_typescript)





* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_typescript"></a>

### @cldmv/slothlet/processors/typescript
> <p><strong style="font-size: 1.1em;"><p>TypeScript file transformation using esbuild (fast mode)</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_runtime_slash_async"></a>

## @cldmv/slothlet/runtime/async
> <p><strong style="font-size: 1.1em;"><p>Provides live bindings (<code>self</code>, <code>context</code>, <code>reference</code>) for use in API modules.
> Uses AsyncLocalStorage for context isolation across async operations.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/runtime/async](#at_cldmv_slash_slothlet_slash_runtime_slash_async)


**Example**
```js
// In your API module (ESM)
import { self, context } from "@cldmv/slothlet/runtime/async";

export function myFunction() {
  // `self` is the full API object
  // `context` is user-provided context data
  return { api: self, data: context.userId };
}
```
**Example**
```js
// In your API module (CJS)
const { self, context } = require("@cldmv/slothlet/runtime/async");

exports.myFunction = function() {
  return { api: self, data: context.userId };
};
```





* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_slash_async"></a>

### @cldmv/slothlet/runtime/async
> <p><strong style="font-size: 1.1em;"><p>Provides live bindings (<code>self</code>, <code>context</code>, <code>reference</code>) for use in API modules.
> Uses AsyncLocalStorage for context isolation across async operations.</p></strong></p>
> 
**Example**
```js
// In your API module (ESM)
import { self, context } from "@cldmv/slothlet/runtime/async";

export function myFunction() {
  // `self` is the full API object
  // `context` is user-provided context data
  return { api: self, data: context.userId };
}
```
**Example**
```js
// In your API module (CJS)
const { self, context } = require("@cldmv/slothlet/runtime/async");

exports.myFunction = function() {
  return { api: self, data: context.userId };
};
```




<a id="at_cldmv_slash_slothlet_slash_runtime_slash_live"></a>

## @cldmv/slothlet/runtime/live
> <p><strong style="font-size: 1.1em;"><p>Provides live bindings (<code>self</code>, <code>context</code>, <code>reference</code>) for use in API modules.
> Uses direct global bindings (no AsyncLocalStorage) for maximum performance.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/runtime/live](#at_cldmv_slash_slothlet_slash_runtime_slash_live)


**Example**
```js
// In your API module (ESM)
import { self, context } from "@cldmv/slothlet/runtime/live";

export function myFunction() {
  return { api: self, data: context.userId };
}
import { SlothletError } from "@cldmv/slothlet/errors"; *
```
**Example**
```js
// In your API module (CJS)
const { self, context } = require("@cldmv/slothlet/runtime/live");

exports.myFunction = function() {
  return { api: self, data: context.userId };
};
```





* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_slash_live"></a>

### @cldmv/slothlet/runtime/live
> <p><strong style="font-size: 1.1em;"><p>Provides live bindings (<code>self</code>, <code>context</code>, <code>reference</code>) for use in API modules.
> Uses direct global bindings (no AsyncLocalStorage) for maximum performance.</p></strong></p>
> 
**Example**
```js
// In your API module (ESM)
import { self, context } from "@cldmv/slothlet/runtime/live";

export function myFunction() {
  return { api: self, data: context.userId };
}
import { SlothletError } from "@cldmv/slothlet/errors"; *
```
**Example**
```js
// In your API module (CJS)
const { self, context } = require("@cldmv/slothlet/runtime/live");

exports.myFunction = function() {
  return { api: self, data: context.userId };
};
```







* * *

## Type Definitions

<a id="typedef_SlothletOptions"></a>

### SlothletOptions : <code>object</code>
<p>Configuration options passed to {@link module:@cldmv/slothlet slothlet()}.</p>

**Kind**: typedef  
**Scope**: global


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| <a id="typedef_SlothletOptions_prop_dir"></a>dir | <code>string</code> |  | Directory to scan for API modules. Relative paths are resolved from the calling file. |
| <a id="typedef_SlothletOptions_prop_mode"></a>[mode] | <code>"eager" | "lazy"</code> | <code>"eager"</code> | Loading strategy. <ul> <li>`"eager"` — all modules are loaded immediately at startup (default).</li> <li>`"lazy"` — modules are loaded on first access via a Proxy. Also accepted: `"immediate"` / `"preload"` (eager aliases); `"deferred"` / `"proxy"` (lazy aliases).</li> </ul> |
| <a id="typedef_SlothletOptions_prop_runtime"></a>[runtime] | <code>"async" | "live"</code> | <code>"async"</code> | Context propagation runtime. <ul> <li>`"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).</li> <li>`"live"` — Experimental live bindings. Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` as aliases for `"async"`.</li> </ul> |
| <a id="typedef_SlothletOptions_prop_apiDepth"></a>[apiDepth] | <code>number</code> | <code>Infinity</code> | Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root. |
| <a id="typedef_SlothletOptions_prop_context"></a>[context] | <code>object | null</code> | <code>null</code> | Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`. |
| <a id="typedef_SlothletOptions_prop_reference"></a>[reference] | <code>object | null</code> | <code>null</code> | Object whose properties are merged directly onto the root API and also available as `api.slothlet.reference`. |
| <a id="typedef_SlothletOptions_prop_scope"></a>[scope] | <code>Object</code> |  | Controls how per-request scope data is merged. `"shallow"` merges top-level keys; `"deep"` recurses into nested objects. |
| <a id="typedef_SlothletOptions_prop_api"></a>[api] | <code>object</code> |  | API build and mutation settings. |
| <a id="typedef_SlothletOptions_prop_api_dot_collision"></a>[api.collision] | <code>string | Object</code> | <code>"merge"</code> | Collision strategy when two modules export the same path. Modes: `"merge"` (default), `"merge-replace"`, `"replace"`, `"skip"`, `"warn"`, `"error"`. Pass an object to use different strategies for the initial build vs. runtime `api.slothlet.api.add()` calls. |
| <a id="typedef_SlothletOptions_prop_api_dot_mutations"></a>[api.mutations] | <code>object</code> | <code>{add:true,remove:true,reload:true}</code> | Enable or disable runtime mutation methods on `api.slothlet.api`. Object with boolean keys `add`, `remove`, `reload` (all default `true`). |
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


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| <a id="typedef_SlothletAPI_prop_slothlet"></a>slothlet | <code>object</code> |  | Built-in control namespace. |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_shutdown"></a>slothlet.shutdown | <code>function</code> |  | Shut down the instance and release all resources. |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_api"></a>slothlet.api | <code>object</code> |  | Runtime mutation methods (`add`, `remove`, `reload`) — availability controlled by `api.mutations` option. |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_hook"></a>slothlet.hook | <code>object</code> |  | Hook registration surface (`on`, `off`, `once`, `clear`) — only present when `hook` option is enabled. |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_context"></a>slothlet.context | <code>object</code> |  | Per-request context helpers (`run`, `get`, `set`, `extend`). |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_lifecycle"></a>slothlet.lifecycle | <code>object</code> |  | Lifecycle event emitter (`on`, `off`, `once`, `emit`). |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_metadata"></a>slothlet.metadata | <code>object</code> |  | Module metadata accessor (`get`, `set`, `has`). |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_ownership"></a>slothlet.ownership | <code>object</code> |  | Module ownership registry (`get`, `unregister`). |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_diag"></a>[slothlet.diag] | <code>object</code> |  | Diagnostics namespace — only present when `diagnostics: true`. |
| <a id="typedef_SlothletAPI_prop_slothlet_dot_reference"></a>[slothlet.reference] | <code>object</code> |  | The `reference` object from config, accessible as `api.slothlet.reference`. |


* * *


