
<a name="module_@cldmv/slothlet"></a>

## @cldmv/slothlet
<p><strong style="font-size: 1.1em;"><p>Slothlet - Advanced module loader with lazy and eager loading capabilities</p></strong></p>



* [@cldmv/slothlet(options)](#module_@cldmv/slothlet) ⇒ <code>Promise.<(function()|object)></code>
    * [.isLoaded()](#module_@cldmv/slothlet--slothlet.isLoaded) ⇒ <code>boolean</code>
    * [.getApi()](#module_@cldmv/slothlet--slothlet.getApi) ⇒ <code>function | object</code>
    * [.getBoundApi()](#module_@cldmv/slothlet--slothlet.getBoundApi) ⇒ <code>function | object</code>
    * [.shutdown()](#module_@cldmv/slothlet--slothlet.shutdown) ⇒ <code>Promise.&lt;void&gt;</code>

* **Typedefs**
    * [SlothletOptions](#typedef_module_@cldmv/slothlet_SlothletOptions) : <code>object</code>


**Example**
```js
// Default import (recommended)
import slothlet from '@cldmv/slothlet';

// OR destructured import
import { slothlet } from '@cldmv/slothlet';

// OR both (they're the same)
import slothlet, { slothlet as namedSlothlet } from '@cldmv/slothlet';

// OR dynamic import
const slothlet = await import('@cldmv/slothlet');

// OR dynamic destructured import
const { slothlet } = await import('@cldmv/slothlet');

// Usage
const api = await slothlet({
    dir: './api_tests/api_test'
});
```
**Example**
```js
// Default require (recommended)
const slothlet = require('@cldmv/slothlet');

// OR destructured require
const { slothlet } = require('@cldmv/slothlet');

// OR both (they're the same)
const { default: slothlet, slothlet: namedSlothlet } = require('@cldmv/slothlet');

// OR dynamic import from CJS (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api = await slothlet({
    dir: './api_tests/api_test'
  });
})();

// Usage (inside async function or top-level await)
const api = await slothlet({
    dir: './api_tests/api_test'
});
```

> [!IMPORTANT]
> The `await` keyword requires an async context. Use within an async function or at the top level in ES modules.

**Example**
```js
// Multiple instances with ESM
import slothlet from '@cldmv/slothlet';

const api1 = await slothlet({ dir: './api_tests/api_test' });
const api2 = await slothlet({ dir: './api_tests/api_test_mixed' });
```
**Example**
```js
// Multiple instances with CommonJS
const slothlet = require('@cldmv/slothlet');

const api1 = await slothlet({ dir: './api_tests/api_test' });
const api2 = await slothlet({ dir: './api_tests/api_test_cjs' });
```
**Example**
```js
// Create with context and reference (direct call)
const api = await slothlet({
  dir: './api_tests/api_test',
  context: { user: 'alice', env: 'prod' },
  reference: { version: '1.0.0' }
});

// Access modules through bound API
await api.math.add(2, 3); // 5
api.context.user; // 'alice'
api.version; // '1.0.0'
```
**Example**
```js
// Shutdown when done
await api.shutdown();
```




* * *

<!-- Found 5 main functions --><!-- Main function names: slothlet, isLoaded, getApi, getBoundApi, shutdown --><a name="module_@cldmv/slothlet--slothlet"></a>

### @cldmv/slothlet(options) ⇒ <code>Promise.&lt;(function()|object)&gt;</code>
<p>Creates a slothlet API instance with the specified configuration.
This is the main entry point that can be called directly as a function.</p>

**Kind**: static method of [<code>@cldmv/slothlet</code>](#module_@cldmv/slothlet)

**Returns**:

- <code>Promise.&lt;(function()|object)&gt;</code> <p>The bound API object or function</p>



| Param | Type | Description |
| --- | --- | --- |
| options | <code>[SlothletOptions](#typedef_module_@cldmv/slothlet_SlothletOptions)</code> | <p>Configuration options for creating the API</p> |



* * *

<a name="module_@cldmv/slothlet--slothlet.isLoaded"></a>

### @cldmv/slothlet.isLoaded() ⇒ <code>boolean</code>
<p>Checks if the API has been loaded.</p>

**Kind**: static method of [<code>@cldmv/slothlet</code>](#module_@cldmv/slothlet)

**Returns**:

- <code>boolean</code> <p></p>



* * *

<a name="module_@cldmv/slothlet--slothlet.getApi"></a>

### @cldmv/slothlet.getApi() ⇒ <code>function | object</code>
<p>Returns the raw built API object (unbound, except in lazy mode where it's identical to boundapi).
This is the original API structure before processing and binding operations.
Most consumers should use getBoundApi() instead.</p>

**Kind**: static method of [<code>@cldmv/slothlet</code>](#module_@cldmv/slothlet)

**Returns**:

- <code>function | object</code> <p>The raw API object or function</p>



* * *

<a name="module_@cldmv/slothlet--slothlet.getBoundApi"></a>

### @cldmv/slothlet.getBoundApi() ⇒ <code>function | object</code>
<p>Returns the processed and bound API object that consumers should use.
This includes live-binding references, context/reference injection, and shutdown management.
This is what most applications should interact with.</p>

**Kind**: static method of [<code>@cldmv/slothlet</code>](#module_@cldmv/slothlet)

**Returns**:

- <code>function | object</code> <p>The bound API object or function with live bindings and context</p>



* * *

<a name="module_@cldmv/slothlet--slothlet.shutdown"></a>

### @cldmv/slothlet.shutdown() ⇒ <code>Promise.&lt;void&gt;</code>
<p>Gracefully shuts down the API and cleans up resources.</p>
<p>This method performs a comprehensive cleanup of the slothlet instance, including:</p>
<ul>
<li>Calling any user-defined shutdown functions in the loaded API</li>
<li>Disposing of internal engine resources (VM contexts, workers, child processes)</li>
<li>Clearing all bound references and live bindings</li>
<li>Resetting the instance to an unloaded state</li>
</ul>
<p>The shutdown process includes timeout protection (5 seconds) and prevents
recursive shutdown calls to ensure safe cleanup even in error conditions.</p>

**Kind**: static method of [<code>@cldmv/slothlet</code>](#module_@cldmv/slothlet)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p>Resolves when shutdown is complete</p>


**Throws**:

- <code>Error</code> <p>If recursive shutdown is detected or shutdown fails</p>


**Example**
```js
// Basic shutdown
await api.shutdown();
```
**Example**
```js
// Shutdown with error handling
try {
  await api.shutdown();
  console.log('API shut down successfully');
} catch (error) {
  console.error('Shutdown failed:', error.message);
}
```



* * *



<a name="module_@cldmv/slothlet/runtime"></a>

## @cldmv/slothlet/runtime
<p><strong style="font-size: 1.1em;"><p>Provides AsyncLocalStorage-based context isolation for slothlet instances,
enabling per-instance live bindings and context management across async operations.</p></strong></p>



* [@cldmv/slothlet/runtime](#module_@cldmv/slothlet/runtime)

* **Exports**
    * [self](#module_@cldmv/slothlet--slothlet/runtime.self) : <code>function | object</code>
    * [context](#module_@cldmv/slothlet--slothlet/runtime.context) : <code>object</code>
    * [reference](#module_@cldmv/slothlet--slothlet/runtime.reference) : <code>object</code>


**Example**
```js
// ESM usage (public API)
import { self, context, reference } from '@cldmv/slothlet/runtime';
```
**Example**
```js
// CJS usage (public API)
const { self, context, reference } = require('@cldmv/slothlet/runtime');
```




* * *

<!-- Found 0 main functions --><a name="module_@cldmv/slothlet--slothlet/runtime.context"></a>

### context : <code>object</code>
<p>Live binding to the current instance's 'context' data from AsyncLocalStorage context.</p>

**Kind**: export of [<code>@cldmv/slothlet/runtime</code>](#module_@cldmv/slothlet/runtime)


* * *

<a name="module_@cldmv/slothlet--slothlet/runtime.reference"></a>

### reference : <code>object</code>
<p>Live binding to the current instance's 'reference' object from AsyncLocalStorage context.</p>

**Kind**: export of [<code>@cldmv/slothlet/runtime</code>](#module_@cldmv/slothlet/runtime)


* * *

<a name="module_@cldmv/slothlet--slothlet/runtime.self"></a>

### self : <code>function | object</code>
<p>Live binding to the current instance's 'self' reference from AsyncLocalStorage context.</p>

**Kind**: export of [<code>@cldmv/slothlet/runtime</code>](#module_@cldmv/slothlet/runtime)


* * *






* * *

## Type Definitions

<a name="typedef_SlothletOptions"></a>

### SlothletOptions : <code>object</code>


**Kind**: typedef  
**Scope**: global


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [dir] | <code>string</code> | <code>api</code> | Directory to load API modules from. Can be absolute or relative path. If relative, resolved from process.cwd(). Defaults to &quot;api&quot; directory in current working directory. |
| [lazy] | <code>boolean</code> |  | Loading strategy: • `true`: Lazy loading - modules loaded on-demand when accessed (lower initial load, proxy overhead) • `false`: Eager loading - all modules loaded immediately (default, higher initial load, direct access) |
| [apiDepth] | <code>number</code> | <code>Infinity</code> | Directory traversal depth control: • `Infinity`: Traverse all subdirectories recursively (default) • `0`: Only load files in root directory, no subdirectories • `1`, `2`, etc.: Limit traversal to specified depth levels |
| [debug] | <code>boolean</code> |  | Debug output control: • `true`: Enable verbose logging for module loading, API construction, and binding operations • `false`: Silent operation (default) • Can be set via command line flag `--slothletdebug`, environment variable `SLOTHLET_DEBUG=true`, or options parameter • Command line and environment settings become the default for all instances unless overridden |
| [mode] | <code>string</code> | <code>singleton</code> | Execution environment mode: • `&quot;singleton&quot;`: Single shared instance within current process (default, fastest) • `&quot;vm&quot;`: Isolated VM context for security/isolation • `&quot;worker&quot;`: Web Worker or Worker Thread execution • `&quot;fork&quot;`: Child process execution for complete isolation |
| [api_mode] | <code>string</code> | <code>auto</code> | API structure and calling convention: • `&quot;auto&quot;`: Auto-detect based on root module exports (function vs object) - recommended (default) • `&quot;function&quot;`: Force API to be callable as function with properties attached • `&quot;object&quot;`: Force API to be plain object with method properties |
| [context] | <code>object</code> | <code>{}</code> | Context data object injected into live-binding `context` reference. Available to all loaded modules via `import { context } from 'slothlet'`. Useful for request data, user sessions, environment configs, etc. |
| [reference] | <code>object</code> | <code>{}</code> | Reference object merged into the API root level. Properties not conflicting with loaded modules are added directly to the API. Useful for utility functions, constants, or external service connections. |
| [entry] | <code>string</code> |  | Entry module URL for advanced use cases. Defaults to slothlet's own module URL. Only modify if implementing custom loaders. **Warning**: This parameter is experimental and not officially supported. Use at your own risk. |


* * *


