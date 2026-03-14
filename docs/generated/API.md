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
  * .slothlet ⇒ <code>object</code>
    * .api ⇒ <code>object</code>
      * [.add()](#typedef_SlothletAPI_prop_slothlet-api-add)
      * [.reload()](#typedef_SlothletAPI_prop_slothlet-api-reload)
      * [.remove()](#typedef_SlothletAPI_prop_slothlet-api-remove)
    * .context ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-context-get)
      * [.inspect()](#typedef_SlothletAPI_prop_slothlet-context-inspect)
      * [.run()](#typedef_SlothletAPI_prop_slothlet-context-run)
      * [.scope()](#typedef_SlothletAPI_prop_slothlet-context-scope)
      * [.set()](#typedef_SlothletAPI_prop_slothlet-context-set)
    * \[.diag\] ⇒ <code>object</code>
      * \[.caches\] ⇒ <code>object</code>
        * [\[.get\]()](#typedef_SlothletAPI_prop_slothlet-diag-caches-get)
        * [\[.getAllModuleIDs\]()](#typedef_SlothletAPI_prop_slothlet-diag-caches-getAllModuleIDs)
        * [\[.has\]()](#typedef_SlothletAPI_prop_slothlet-diag-caches-has)
      * \[.context\] ⇒ <code>object</code>
      * [\[.describe\]()](#typedef_SlothletAPI_prop_slothlet-diag-describe)
      * [\[.getAPI\]()](#typedef_SlothletAPI_prop_slothlet-diag-getAPI)
      * [\[.getOwnership\]()](#typedef_SlothletAPI_prop_slothlet-diag-getOwnership)
      * \[.hook\] ⇒ <code>object</code>
      * [\[.inspect\]()](#typedef_SlothletAPI_prop_slothlet-diag-inspect)
      * \[.owner\] ⇒ <code>object</code>
        * [\[.get\]()](#typedef_SlothletAPI_prop_slothlet-diag-owner-get)
      * \[.reference\] ⇒ <code>object</code>
      * [\[.SlothletWarning\]()](#typedef_SlothletAPI_prop_slothlet-diag-SlothletWarning)
    * .hook ⇒ <code>object</code>
      * [.clear()](#typedef_SlothletAPI_prop_slothlet-hook-clear)
      * [.disable()](#typedef_SlothletAPI_prop_slothlet-hook-disable)
      * [.enable()](#typedef_SlothletAPI_prop_slothlet-hook-enable)
      * [.list()](#typedef_SlothletAPI_prop_slothlet-hook-list)
      * [.off()](#typedef_SlothletAPI_prop_slothlet-hook-off)
      * [.on()](#typedef_SlothletAPI_prop_slothlet-hook-on)
      * [.remove()](#typedef_SlothletAPI_prop_slothlet-hook-remove)
    * .lifecycle ⇒ <code>object</code>
      * [.off()](#typedef_SlothletAPI_prop_slothlet-lifecycle-off)
      * [.on()](#typedef_SlothletAPI_prop_slothlet-lifecycle-on)
    * .materialize ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-materialize-get)
      * .materialized ⇒ <code>boolean</code>
      * [.wait()](#typedef_SlothletAPI_prop_slothlet-materialize-wait)
    * .metadata ⇒ <code>object</code>
      * [.caller()](#typedef_SlothletAPI_prop_slothlet-metadata-caller)
      * [.get()](#typedef_SlothletAPI_prop_slothlet-metadata-get)
      * [.remove()](#typedef_SlothletAPI_prop_slothlet-metadata-remove)
      * [.removeFor()](#typedef_SlothletAPI_prop_slothlet-metadata-removeFor)
      * [.self()](#typedef_SlothletAPI_prop_slothlet-metadata-self)
      * [.set()](#typedef_SlothletAPI_prop_slothlet-metadata-set)
      * [.setFor()](#typedef_SlothletAPI_prop_slothlet-metadata-setFor)
      * [.setGlobal()](#typedef_SlothletAPI_prop_slothlet-metadata-setGlobal)
    * .owner ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-owner-get)
    * .ownership ⇒ <code>object</code>
      * [.get()](#typedef_SlothletAPI_prop_slothlet-ownership-get)
      * [.unregister()](#typedef_SlothletAPI_prop_slothlet-ownership-unregister)
    * \[.reference\] ⇒ <code>object</code>
    * [.reload()](#typedef_SlothletAPI_prop_slothlet-reload)
    * [.run()](#typedef_SlothletAPI_prop_slothlet-run)
    * [.scope()](#typedef_SlothletAPI_prop_slothlet-scope)
    * [.shutdown()](#typedef_SlothletAPI_prop_slothlet-shutdown)

[@cldmv/slothlet/runtime](#at_cldmv_slash_slothlet_slash_runtime)


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


**Returns**:

- <code>Promise.&lt;SlothletAPI&gt;</code> <p>Fully loaded, proxy-based API object</p>


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

<a id="typedef_SlothletOptions"></a>

### SlothletOptions : <code>object</code>
<p>Configuration options passed to <code>slothlet()</code>.</p>

**Kind**: typedef  
**Scope**: global


| Property | Type | Default | Description |
| --- | --- | --- | --- |
| <a id="typedef_SlothletOptions_prop_dir"></a>dir | <code>string</code> |  | Directory to scan for API modules. Relative paths are resolved from the calling file. |
| <a id="typedef_SlothletOptions_prop_mode"></a>[mode] | <code>"eager" \| "lazy"</code> | <code>"eager"</code> | Loading strategy. <ul> <li>`"eager"` — all modules are loaded immediately at startup (default).</li> <li>`"lazy"` — modules are loaded on first access via a Proxy. Also accepted: `"immediate"` / `"preload"` (eager aliases); `"deferred"` / `"proxy"` (lazy aliases).</li> </ul> |
| <a id="typedef_SlothletOptions_prop_runtime"></a>[runtime] | <code>"async" \| "live"</code> | <code>"async"</code> | Context propagation runtime. <ul> <li>`"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).</li> <li>`"live"` — Experimental live bindings. Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` as aliases for `"async"`.</li> </ul> |
| <a id="typedef_SlothletOptions_prop_apiDepth"></a>[apiDepth] | <code>number</code> | <code>Infinity</code> | Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root. |
| <a id="typedef_SlothletOptions_prop_context"></a>[context] | <code>object \| null</code> | <code>null</code> | Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`. |
| <a id="typedef_SlothletOptions_prop_reference"></a>[reference] | <code>object \| null</code> | <code>null</code> | Object whose properties are merged directly onto the root API and also available as `api.slothlet.reference`. |
| <a id="typedef_SlothletOptions_prop_scope"></a>[scope] | <code>Object</code> |  | Controls how per-request scope data is merged. `"shallow"` merges top-level keys; `"deep"` recurses into nested objects. |
| <a id="typedef_SlothletOptions_prop_api"></a>[api] | <code>object</code> |  | API build and mutation settings. |
| <a id="typedef_SlothletOptions_prop_api-collision"></a>[api.collision] | <code>string \| Object</code> | <code>"merge"</code> | Collision strategy when two modules export the same path. Modes: `"merge"` (default), `"merge-replace"`, `"replace"`, `"skip"`, `"warn"`, `"error"`. Pass an object to use different strategies for the initial build vs. runtime `api.slothlet.api.add()` calls. |
| <a id="typedef_SlothletOptions_prop_api-mutations"></a>[api.mutations] | <code>object</code> | <code>{add:true,remove:true,reload:true}</code> | Enable or disable runtime mutation methods on `api.slothlet.api`. Object with boolean keys `add`, `remove`, `reload` (all default `true`). |
| <a id="typedef_SlothletOptions_prop_hook"></a>[hook] | <code>boolean \| string \| object</code> | <code>false</code> | Hook system configuration. <ul> <li>`false` — disabled (default).</li> <li>`true` — enabled, all endpoints.</li> <li>`string` — enabled with a default glob pattern.</li> <li>`object` — full control: `{ enabled: boolean, pattern?: string, suppressErrors?: boolean }`.</li> </ul> |
| <a id="typedef_SlothletOptions_prop_debug"></a>[debug] | <code>boolean \| object</code> | <code>false</code> | Enable verbose internal logging. `true` enables all categories. Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context` to target specific subsystems. |
| <a id="typedef_SlothletOptions_prop_silent"></a>[silent] | <code>boolean</code> | <code>false</code> | Suppress all console output from slothlet (warnings, deprecations). Does not affect `debug`. |
| <a id="typedef_SlothletOptions_prop_diagnostics"></a>[diagnostics] | <code>boolean</code> | <code>false</code> | Enable the `api.slothlet.diag.*` introspection namespace. Intended for testing; do not enable in production. |
| <a id="typedef_SlothletOptions_prop_tracking"></a>[tracking] | <code>boolean \| object</code> | <code>false</code> | Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress. |
| <a id="typedef_SlothletOptions_prop_backgroundMaterialize"></a>[backgroundMaterialize] | <code>boolean</code> | <code>false</code> | When `mode: "lazy"`, immediately begins materializing all paths in the background after init. |
| <a id="typedef_SlothletOptions_prop_i18n"></a>[i18n] | <code>object</code> |  | Internationalization settings (dev-facing, process-global). `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`). |
| <a id="typedef_SlothletOptions_prop_typescript"></a>[typescript] | <code>boolean \| "fast" \| "strict" \| object</code> | <code>false</code> | TypeScript support. <ul> <li>`false` — disabled (default).</li> <li>`true` or `"fast"` — esbuild transpilation, no type checking.</li> <li>`"strict"` — tsc compilation with type checking and `.d.ts` generation. See <a href="docs/TYPESCRIPT.md">TYPESCRIPT.md</a> for the full configuration reference.</li> </ul> |


* * *

<a id="typedef_SlothletAPI"></a>

### SlothletAPI : <code>object</code>
<p>Bound API object returned by <code>slothlet()</code>.
The root contains all loaded module exports plus the reserved <code>slothlet</code> namespace.</p>

**Kind**: typedef  
**Scope**: global


<a id="typedef_SlothletAPI_prop_destroy"></a>

#### api.destroy() ⇒ <code>void</code>

Like <code>shutdown()</code> but additionally invokes registered destroy hooks before teardown.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.destroy();
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.destroy();
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.destroy();
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.destroy();
```

* * *

<a id="typedef_SlothletAPI_prop_shutdown"></a>

#### api.shutdown() ⇒ <code>void</code>

Convenience alias for <code>slothlet.shutdown()</code>. Shuts down the instance and invokes any user-provided shutdown hook first.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.shutdown();
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.shutdown();
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.shutdown();
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.shutdown();
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-api-add"></a>

#### api.slothlet.api.add(apiPath, folderPath, [options]) ⇒ <code>Promise.&lt;void&gt;</code>

Mount a new API module at runtime.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| apiPath | <code>string</code> |  |
| folderPath | <code>string</code> |  |
| [options] | <code>Object</code> |  |

**Returns**: <code>Promise.&lt;void&gt;</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.api.add('utils.math', './api/utils/math');
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.api.add('utils.math', './api/utils/math');
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.api.add('utils.math', './api/utils/math');
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.api.add('utils.math', './api/utils/math');
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-api-reload"></a>

#### api.slothlet.api.reload([pathOrModuleId], [options]) ⇒ <code>Promise.&lt;void&gt;</code>

Hot-reload a specific module or directory path.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [pathOrModuleId] | <code>string\|null</code> |  |
| [options] | <code>Object</code> |  |

**Returns**: <code>Promise.&lt;void&gt;</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
// Reload a specific module
await api.slothlet.api.reload('utils.math');
// Reload everything
await api.slothlet.api.reload();
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  // Reload a specific module
  await api.slothlet.api.reload('utils.math');
  // Reload everything
  await api.slothlet.api.reload();
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  // Reload a specific module
  await api.slothlet.api.reload('utils.math');
  // Reload everything
  await api.slothlet.api.reload();
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
// Reload a specific module
await api.slothlet.api.reload('utils.math');
// Reload everything
await api.slothlet.api.reload();
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-api-remove"></a>

#### api.slothlet.api.remove(pathOrModuleId) ⇒ <code>Promise.&lt;void&gt;</code>

Unmount an API module at runtime.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| pathOrModuleId | <code>string</code> |  |

**Returns**: <code>Promise.&lt;void&gt;</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.api.remove('utils.math');
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.api.remove('utils.math');
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.api.remove('utils.math');
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.api.remove('utils.math');
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-get"></a>

#### api.slothlet.context.get([key]) ⇒ <code>*</code>

Get a value from the current per-request context store.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [key] | <code>string</code> |  |

**Returns**: <code>*</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
  const userId = api.slothlet.context.get('userId'); // 42
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
    const userId = api.slothlet.context.get('userId'); // 42
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
    const userId = api.slothlet.context.get('userId'); // 42
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
  const userId = api.slothlet.context.get('userId'); // 42
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-inspect"></a>

#### api.slothlet.context.inspect() ⇒ <code>Object</code>

Return a snapshot of the current context state (for debugging).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
  const snapshot = api.slothlet.context.inspect();
  // { data: { userId: 42 }, ... }
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
    const snapshot = api.slothlet.context.inspect();
    // { data: { userId: 42 }, ... }
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
    const snapshot = api.slothlet.context.inspect();
    // { data: { userId: 42 }, ... }
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
  const snapshot = api.slothlet.context.inspect();
  // { data: { userId: 42 }, ... }
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-run"></a>

#### api.slothlet.context.run(contextData, callback, args) ⇒ <code>*</code>

Execute a callback with isolated context data merged in.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| contextData | <code>Object</code> |  |
| callback | <code>function</code> |  |
| args | <code>*</code> |  |

**Returns**: <code>*</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
  return api.myModule.getUser(); // sees context.userId = 42
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
    return api.myModule.getUser(); // sees context.userId = 42
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
    return api.myModule.getUser(); // sees context.userId = 42
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.context.run({ userId: 42 }, async () =&gt; {
  return api.myModule.getUser(); // sees context.userId = 42
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-scope"></a>

#### api.slothlet.context.scope(options) ⇒ <code>*</code>

Execute a function with structured context options (<code>context</code>, <code>fn</code>, <code>args</code>, <code>merge</code>, <code>isolation</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> |  |

**Returns**: <code>*</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.context.scope({
  context: { userId: 42 },
  fn: async () =&gt; api.myModule.getUser()
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.context.scope({
    context: { userId: 42 },
    fn: async () =&gt; api.myModule.getUser()
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.context.scope({
    context: { userId: 42 },
    fn: async () =&gt; api.myModule.getUser()
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.context.scope({
  context: { userId: 42 },
  fn: async () =&gt; api.myModule.getUser()
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-context-set"></a>

#### api.slothlet.context.set(key, value) ⇒ <code>void</code>

Set a value in the current per-request context store.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> |  |
| value | <code>*</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.context.run({}, async () =&gt; {
  api.slothlet.context.set('traceId', 'abc-123');
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.context.run({}, async () =&gt; {
    api.slothlet.context.set('traceId', 'abc-123');
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.context.run({}, async () =&gt; {
    api.slothlet.context.set('traceId', 'abc-123');
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.context.run({}, async () =&gt; {
  api.slothlet.context.set('traceId', 'abc-123');
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-caches-get"></a>

#### api.slothlet.diag.caches.get() ⇒ <code>Object</code>

Get full cache diagnostic data (<code>{ totalCaches, caches[] }</code>). Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const cacheData = api.slothlet.diag.caches.get();
// { totalCaches: 2, caches: [...] }
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const cacheData = api.slothlet.diag.caches.get();
  // { totalCaches: 2, caches: [...] }
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const cacheData = api.slothlet.diag.caches.get();
  // { totalCaches: 2, caches: [...] }
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const cacheData = api.slothlet.diag.caches.get();
// { totalCaches: 2, caches: [...] }
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-caches-getAllModuleIDs"></a>

#### api.slothlet.diag.caches.getAllModuleIDs() ⇒ <code>string[]</code>

Return all moduleIDs currently in cache. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>string[]</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const ids = api.slothlet.diag.caches.getAllModuleIDs();
// ['utils/math.mjs', 'utils/strings.mjs']
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const ids = api.slothlet.diag.caches.getAllModuleIDs();
  // ['utils/math.mjs', 'utils/strings.mjs']
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const ids = api.slothlet.diag.caches.getAllModuleIDs();
  // ['utils/math.mjs', 'utils/strings.mjs']
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const ids = api.slothlet.diag.caches.getAllModuleIDs();
// ['utils/math.mjs', 'utils/strings.mjs']
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-caches-has"></a>

#### api.slothlet.diag.caches.has(moduleID) ⇒ <code>boolean</code>

Check whether a cache entry exists for a given moduleID. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| moduleID | <code>string</code> |  |

**Returns**: <code>boolean</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-describe"></a>

#### api.slothlet.diag.describe([showAll]) ⇒ <code>*</code>

Describe API structure. Pass <code>true</code> to return the full API object; omit for top-level keys only. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [showAll] | <code>boolean</code> |  |

**Returns**: <code>*</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const keys = api.slothlet.diag.describe();
const full = api.slothlet.diag.describe(true);
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const keys = api.slothlet.diag.describe();
  const full = api.slothlet.diag.describe(true);
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const keys = api.slothlet.diag.describe();
  const full = api.slothlet.diag.describe(true);
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const keys = api.slothlet.diag.describe();
const full = api.slothlet.diag.describe(true);
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-getAPI"></a>

#### api.slothlet.diag.getAPI() ⇒ <code>Object</code>

Return the live bound API proxy object. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-getOwnership"></a>

#### api.slothlet.diag.getOwnership() ⇒ <code>Object</code>

Return ownership diagnostics for all registered API paths. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const ownership = api.slothlet.diag.getOwnership();
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const ownership = api.slothlet.diag.getOwnership();
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const ownership = api.slothlet.diag.getOwnership();
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const ownership = api.slothlet.diag.getOwnership();
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-inspect"></a>

#### api.slothlet.diag.inspect() ⇒ <code>Object</code>

Return a full diagnostic snapshot of current instance state. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const snapshot = api.slothlet.diag.inspect();
console.log(snapshot.modules, snapshot.hooks);
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const snapshot = api.slothlet.diag.inspect();
  console.log(snapshot.modules, snapshot.hooks);
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const snapshot = api.slothlet.diag.inspect();
  console.log(snapshot.modules, snapshot.hooks);
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const snapshot = api.slothlet.diag.inspect();
console.log(snapshot.modules, snapshot.hooks);
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-owner-get"></a>

#### api.slothlet.diag.owner.get(apiPath) ⇒ <code>string[]</code>

Get the owning moduleIDs for a specific API path. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| apiPath | <code>string</code> |  |

**Returns**: <code>string[]</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const owners = api.slothlet.diag.owner.get('math.add');
// ['utils/math.mjs']
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const owners = api.slothlet.diag.owner.get('math.add');
  // ['utils/math.mjs']
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const owners = api.slothlet.diag.owner.get('math.add');
  // ['utils/math.mjs']
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const owners = api.slothlet.diag.owner.get('math.add');
// ['utils/math.mjs']
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-diag-SlothletWarning"></a>

#### api.slothlet.diag.SlothletWarning() ⇒ <code>SlothletWarning</code>

The <code>SlothletWarning</code> class — access <code>.captured</code> for warnings emitted during tests. Only available when <code>diagnostics: true</code>.

> **Requires**: `diagnostics: true` in config

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>SlothletWarning</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', diagnostics: true });
const SlothletWarning = api.slothlet.diag.SlothletWarning;
console.log(SlothletWarning.captured); // array of captured warnings
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', diagnostics: true });
  const SlothletWarning = api.slothlet.diag.SlothletWarning;
  console.log(SlothletWarning.captured); // array of captured warnings
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', diagnostics: true });
  const SlothletWarning = api.slothlet.diag.SlothletWarning;
  console.log(SlothletWarning.captured); // array of captured warnings
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', diagnostics: true });
const SlothletWarning = api.slothlet.diag.SlothletWarning;
console.log(SlothletWarning.captured); // array of captured warnings
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-clear"></a>

#### api.slothlet.hook.clear([filter]) ⇒ <code>void</code>

Alias for <code>remove()</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [filter] | <code>Object</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.clear({ type: 'before' });
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.clear({ type: 'before' });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.clear({ type: 'before' });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.clear({ type: 'before' });
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-disable"></a>

#### api.slothlet.hook.disable([filter]) ⇒ <code>void</code>

Disable hooks matching a filter (empty = disable all).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [filter] | <code>Object</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.disable(); // disable all
api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.disable(); // disable all
  api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.disable(); // disable all
  api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.disable(); // disable all
api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-enable"></a>

#### api.slothlet.hook.enable([filter]) ⇒ <code>void</code>

Enable hooks matching a filter (empty = enable all).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [filter] | <code>Object</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.disable();
// later...
api.slothlet.hook.enable(); // re-enable all
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.disable();
  // later...
  api.slothlet.hook.enable(); // re-enable all
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.disable();
  // later...
  api.slothlet.hook.enable(); // re-enable all
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.disable();
// later...
api.slothlet.hook.enable(); // re-enable all
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-list"></a>

#### api.slothlet.hook.list([filter]) ⇒ <code>Object[]</code>

List registered hooks matching a filter.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [filter] | <code>Object</code> |  |

**Returns**: <code>Object[]</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', hook: true });
const allHooks = api.slothlet.hook.list();
const beforeHooks = api.slothlet.hook.list({ type: 'before' });
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', hook: true });
  const allHooks = api.slothlet.hook.list();
  const beforeHooks = api.slothlet.hook.list({ type: 'before' });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', hook: true });
  const allHooks = api.slothlet.hook.list();
  const beforeHooks = api.slothlet.hook.list({ type: 'before' });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', hook: true });
const allHooks = api.slothlet.hook.list();
const beforeHooks = api.slothlet.hook.list({ type: 'before' });
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-off"></a>

#### api.slothlet.hook.off(idOrFilter) ⇒ <code>void</code>

Remove hooks by ID or filter object (v2 alias for <code>remove()</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| idOrFilter | <code>string\|Object</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', hook: true });
const hookId = api.slothlet.hook.on('before:math.<em>', handler);
api.slothlet.hook.off(hookId); // remove by ID
api.slothlet.hook.off({ type: 'after' }); // remove by filter
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', hook: true });
  const hookId = api.slothlet.hook.on('before:math.</em>', handler);
  api.slothlet.hook.off(hookId); // remove by ID
  api.slothlet.hook.off({ type: 'after' }); // remove by filter
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', hook: true });
  const hookId = api.slothlet.hook.on('before:math.<em>', handler);
  api.slothlet.hook.off(hookId); // remove by ID
  api.slothlet.hook.off({ type: 'after' }); // remove by filter
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', hook: true });
const hookId = api.slothlet.hook.on('before:math.</em>', handler);
api.slothlet.hook.off(hookId); // remove by ID
api.slothlet.hook.off({ type: 'after' }); // remove by filter
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-on"></a>

#### api.slothlet.hook.on(typePattern, handler, [options]) ⇒ <code>string</code>

Register a hook handler for a type:pattern (e.g. <code>&quot;before:math.*&quot;</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| typePattern | <code>string</code> |  |
| handler | <code>function</code> |  |
| [options] | <code>Object</code> |  |

**Returns**: <code>string</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', hook: true });
const hookId = api.slothlet.hook.on('before:math.<em>', ({ args }) =&gt; {
  console.log('math called with', args);
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', hook: true });
  const hookId = api.slothlet.hook.on('before:math.</em>', ({ args }) =&gt; {
    console.log('math called with', args);
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', hook: true });
  const hookId = api.slothlet.hook.on('before:math.<em>', ({ args }) =&gt; {
    console.log('math called with', args);
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', hook: true });
const hookId = api.slothlet.hook.on('before:math.</em>', ({ args }) =&gt; {
  console.log('math called with', args);
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-hook-remove"></a>

#### api.slothlet.hook.remove([filter]) ⇒ <code>void</code>

Remove hooks matching a filter (<code>id</code>, <code>type</code>, <code>pattern</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [filter] | <code>Object</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.remove({ type: 'before', pattern: 'math.<em>' });
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.remove({ type: 'before', pattern: 'math.</em>' });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', hook: true });
  api.slothlet.hook.remove({ type: 'before', pattern: 'math.<em>' });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', hook: true });
api.slothlet.hook.remove({ type: 'before', pattern: 'math.</em>' });
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-lifecycle-off"></a>

#### api.slothlet.lifecycle.off(event, handler) ⇒ <code>void</code>

Unsubscribe a handler from a lifecycle event.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> |  |
| handler | <code>function</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
const handler = () =&gt; console.log('shutdown');
api.slothlet.lifecycle.on('shutdown', handler);
api.slothlet.lifecycle.off('shutdown', handler);
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  const handler = () =&gt; console.log('shutdown');
  api.slothlet.lifecycle.on('shutdown', handler);
  api.slothlet.lifecycle.off('shutdown', handler);
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  const handler = () =&gt; console.log('shutdown');
  api.slothlet.lifecycle.on('shutdown', handler);
  api.slothlet.lifecycle.off('shutdown', handler);
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
const handler = () =&gt; console.log('shutdown');
api.slothlet.lifecycle.on('shutdown', handler);
api.slothlet.lifecycle.off('shutdown', handler);
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-lifecycle-on"></a>

#### api.slothlet.lifecycle.on(event, handler) ⇒ <code>void</code>

Subscribe to a lifecycle event (e.g. <code>&quot;materialized:complete&quot;</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> |  |
| handler | <code>function</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.lifecycle.on('shutdown', () =&gt; {
  console.log('Slothlet is shutting down');
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.lifecycle.on('shutdown', () =&gt; {
    console.log('Slothlet is shutting down');
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.lifecycle.on('shutdown', () =&gt; {
    console.log('Slothlet is shutting down');
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.lifecycle.on('shutdown', () =&gt; {
  console.log('Slothlet is shutting down');
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-materialize-get"></a>

#### api.slothlet.materialize.get() ⇒ <code>Object</code>

Get current materialization statistics (<code>{ total, materialized, remaining, percentage }</code>).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', mode: 'lazy' });
const stats = api.slothlet.materialize.get();
// { total: 5, materialized: 3, remaining: 2, percentage: 60 }
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', mode: 'lazy' });
  const stats = api.slothlet.materialize.get();
  // { total: 5, materialized: 3, remaining: 2, percentage: 60 }
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', mode: 'lazy' });
  const stats = api.slothlet.materialize.get();
  // { total: 5, materialized: 3, remaining: 2, percentage: 60 }
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', mode: 'lazy' });
const stats = api.slothlet.materialize.get();
// { total: 5, materialized: 3, remaining: 2, percentage: 60 }
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-materialize-wait"></a>

#### api.slothlet.materialize.wait() ⇒ <code>Promise.&lt;void&gt;</code>

Returns a Promise that resolves when all lazy folders are fully materialized.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Promise.&lt;void&gt;</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api', mode: 'lazy' });
await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api', mode: 'lazy' });
  await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api', mode: 'lazy' });
  await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api', mode: 'lazy' });
await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-caller"></a>

#### api.slothlet.metadata.caller() ⇒ <code>Object|null</code>

Get metadata for the function that invoked the current one (runtime-injected).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object|null</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
// Inside an API module, get metadata of the calling function:
const callerMeta = api.slothlet.metadata.caller(); // null if no caller
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  // Inside an API module, get metadata of the calling function:
  const callerMeta = api.slothlet.metadata.caller(); // null if no caller
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  // Inside an API module, get metadata of the calling function:
  const callerMeta = api.slothlet.metadata.caller(); // null if no caller
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
// Inside an API module, get metadata of the calling function:
const callerMeta = api.slothlet.metadata.caller(); // null if no caller
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-get"></a>

#### api.slothlet.metadata.get(fn) ⇒ <code>Object</code>

Get metadata for a specific function reference.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> |  |

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
const meta = api.slothlet.metadata.get(api.math.add);
// { label: 'Addition' }
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  const meta = api.slothlet.metadata.get(api.math.add);
  // { label: 'Addition' }
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  const meta = api.slothlet.metadata.get(api.math.add);
  // { label: 'Addition' }
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
const meta = api.slothlet.metadata.get(api.math.add);
// { label: 'Addition' }
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-remove"></a>

#### api.slothlet.metadata.remove(fn, [key]) ⇒ <code>void</code>

Remove per-function metadata (all keys or a specific key).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> |  |
| [key] | <code>string</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
api.slothlet.metadata.remove(api.math.add, 'label'); // remove key
api.slothlet.metadata.remove(api.math.add); // remove all
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  api.slothlet.metadata.remove(api.math.add, 'label'); // remove key
  api.slothlet.metadata.remove(api.math.add); // remove all
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  api.slothlet.metadata.remove(api.math.add, 'label'); // remove key
  api.slothlet.metadata.remove(api.math.add); // remove all
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
api.slothlet.metadata.remove(api.math.add, 'label'); // remove key
api.slothlet.metadata.remove(api.math.add); // remove all
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-removeFor"></a>

#### api.slothlet.metadata.removeFor(pathOrModuleId, [key]) ⇒ <code>void</code>

Remove path-level metadata for a given API path or moduleID.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| pathOrModuleId | <code>string</code> |  |
| [key] | <code>string\|Array.&lt;string&gt;</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions
api.slothlet.metadata.removeFor('math'); // remove all metadata
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions
  api.slothlet.metadata.removeFor('math'); // remove all metadata
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions
  api.slothlet.metadata.removeFor('math'); // remove all metadata
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions
api.slothlet.metadata.removeFor('math'); // remove all metadata
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-self"></a>

#### api.slothlet.metadata.self() ⇒ <code>Object|null</code>

Get metadata for the currently-executing API function (runtime-injected).

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Object|null</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
// Inside api.math.add, get its own metadata:
const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  // Inside api.math.add, get its own metadata:
  const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  // Inside api.math.add, get its own metadata:
  const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
// Inside api.math.add, get its own metadata:
const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-set"></a>

#### api.slothlet.metadata.set(fn, key, value) ⇒ <code>void</code>

Set per-function metadata by direct function reference.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> |  |
| key | <code>string</code> |  |
| value | <code>*</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
  api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.set(api.math.add, 'label', 'Addition');
api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-setFor"></a>

#### api.slothlet.metadata.setFor(pathOrModuleId, keyOrObj, [value]) ⇒ <code>void</code>

Set metadata for all functions reachable under an API path or moduleID.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| pathOrModuleId | <code>string</code> |  |
| keyOrObj | <code>string\|Object</code> |  |
| [value] | <code>*</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.setFor('math', 'category', 'utilities');
api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.setFor('math', 'category', 'utilities');
  api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.setFor('math', 'category', 'utilities');
  api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.setFor('math', 'category', 'utilities');
api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-metadata-setGlobal"></a>

#### api.slothlet.metadata.setGlobal(key, value) ⇒ <code>void</code>

Set global metadata applied to every function in the instance.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> |  |
| value | <code>*</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.setGlobal('version', '2.0');
// Every function now has metadata: { version: '2.0' }
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.setGlobal('version', '2.0');
  // Every function now has metadata: { version: '2.0' }
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  api.slothlet.metadata.setGlobal('version', '2.0');
  // Every function now has metadata: { version: '2.0' }
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
api.slothlet.metadata.setGlobal('version', '2.0');
// Every function now has metadata: { version: '2.0' }
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-owner-get"></a>

#### api.slothlet.owner.get(apiPath) ⇒ <code>Object</code>

Get ownership info for a specific API path.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| apiPath | <code>string</code> |  |

**Returns**: <code>Object</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
const info = api.slothlet.owner.get('math.add');
// { path: 'math.add', owners: Set { 'utils/math.mjs' } }
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  const info = api.slothlet.owner.get('math.add');
  // { path: 'math.add', owners: Set { 'utils/math.mjs' } }
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  const info = api.slothlet.owner.get('math.add');
  // { path: 'math.add', owners: Set { 'utils/math.mjs' } }
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
const info = api.slothlet.owner.get('math.add');
// { path: 'math.add', owners: Set { 'utils/math.mjs' } }
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-ownership-get"></a>

#### api.slothlet.ownership.get(apiPath) ⇒ <code>Set.&lt;string&gt;</code>

Get the set of moduleIDs that own a given API path.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| apiPath | <code>string</code> |  |

**Returns**: <code>Set.&lt;string&gt;</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
const owners = api.slothlet.ownership.get('math.add');
// Set { 'utils/math.mjs' }
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  const owners = api.slothlet.ownership.get('math.add');
  // Set { 'utils/math.mjs' }
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  const owners = api.slothlet.ownership.get('math.add');
  // Set { 'utils/math.mjs' }
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
const owners = api.slothlet.ownership.get('math.add');
// Set { 'utils/math.mjs' }
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-ownership-unregister"></a>

#### api.slothlet.ownership.unregister(moduleID) ⇒ <code>void</code>

Unregister a module from all ownership records.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| moduleID | <code>string</code> |  |

**Returns**: <code>void</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.api.remove('math');
api.slothlet.ownership.unregister('utils/math.mjs');
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.api.remove('math');
  api.slothlet.ownership.unregister('utils/math.mjs');
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.api.remove('math');
  api.slothlet.ownership.unregister('utils/math.mjs');
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.api.remove('math');
api.slothlet.ownership.unregister('utils/math.mjs');
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-reload"></a>

#### api.slothlet.reload([options]) ⇒ <code>Promise.&lt;void&gt;</code>

Reload the entire instance (re-scans the directory and recreates all module references). Accepts <code>{ keepInstanceID: boolean }</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> |  |

**Returns**: <code>Promise.&lt;void&gt;</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.reload(); // full reload
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.reload(); // full reload
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.reload(); // full reload
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.reload(); // full reload
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-run"></a>

#### api.slothlet.run(contextData, callback, args) ⇒ <code>*</code>

Execute a callback with isolated per-request context data. Convenience alias for <code>slothlet.context.run()</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| contextData | <code>Object</code> |  |
| callback | <code>function</code> |  |
| args | <code>*</code> |  |

**Returns**: <code>*</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.run({ userId: 42 }, async () =&gt; {
  return api.myModule.getUser();
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.run({ userId: 42 }, async () =&gt; {
    return api.myModule.getUser();
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.run({ userId: 42 }, async () =&gt; {
    return api.myModule.getUser();
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.run({ userId: 42 }, async () =&gt; {
  return api.myModule.getUser();
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-scope"></a>

#### api.slothlet.scope(options) ⇒ <code>*</code>

Execute a function with full structured per-request context options. Convenience alias for <code>slothlet.context.scope()</code>.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> |  |

**Returns**: <code>*</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.scope({
  context: { userId: 42 },
  fn: async () =&gt; api.myModule.getUser()
});
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.scope({
    context: { userId: 42 },
    fn: async () =&gt; api.myModule.getUser()
  });
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  const result = await api.slothlet.scope({
    context: { userId: 42 },
    fn: async () =&gt; api.myModule.getUser()
  });
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
const result = await api.slothlet.scope({
  context: { userId: 42 },
  fn: async () =&gt; api.myModule.getUser()
});
```

* * *

<a id="typedef_SlothletAPI_prop_slothlet-shutdown"></a>

#### api.slothlet.shutdown() ⇒ <code>Promise.&lt;void&gt;</code>

Shut down the instance and release all resources.

**Kind**: function property of [<code>SlothletAPI</code>](#typedef_SlothletAPI)

**Returns**: <code>Promise.&lt;void&gt;</code>

**Example**
```javascript
// ESM usage via slothlet API
import slothlet from &quot;@cldmv/slothlet&quot;;
const api = await slothlet({ dir: './api' });
await api.slothlet.shutdown();
```

**Example**
```javascript
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import(&quot;@cldmv/slothlet&quot;);
  const api = await slothlet({ dir: './api' });
  await api.slothlet.shutdown();
}
```

**Example**
```javascript
// CJS usage via slothlet API (top-level)
let slothlet;
(async () =&gt; {
  ({ slothlet } = await import(&quot;@cldmv/slothlet&quot;));
  const api = await slothlet({ dir: './api' });
  await api.slothlet.shutdown();
})();
```

**Example**
```javascript
// CJS usage via slothlet API (inside async function)
const slothlet = require(&quot;@cldmv/slothlet&quot;);
const api = await slothlet({ dir: './api' });
await api.slothlet.shutdown();
```

* * *


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
> <td><code>object</code></td>
> <td>Live reference to the full Slothlet API proxy. Use to call sibling modules without import cycles.</td>
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










