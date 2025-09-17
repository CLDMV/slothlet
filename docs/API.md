<a id="at_cldmv_slash_slothlet"></a>

## @cldmv/slothlet
> <p><strong style="font-size: 1.1em;"><p>Slothlet is a sophisticated module loading framework that provides both lazy and eager
> loading strategies for JavaScript modules. It features copy-left materialization,
> live-binding references, and comprehensive API management.</p>
> <p>Key Features:</p>
> <ul>
> <li>Lazy loading with look-ahead materialization</li>
> <li>Eager loading for immediate module availability</li>
> <li>Copy-left approach preserving materialized functions</li>
> <li>Live-binding references (self, context, reference)</li>
> <li>Configurable debug output</li>
> <li>Multiple execution modes (vm, worker, fork)</li>
> <li>Bound API management with automatic cleanup</li>
> <li>Callable function interface for simplified usage</li>
> </ul></strong></p>
> 


**Structure**

[slothlet(options)](#at_cldmv_slash_slothlet_ddash_slothlet) ⇒ <code><code>Promise.&lt;(function()|object)&gt;</code></code>
  * [.isLoaded()](#at_cldmv_slash_slothlet_dot_isLoaded) ⇒ <code><code>boolean</code></code>
  * [.getApi()](#at_cldmv_slash_slothlet_dot_getApi) ⇒ <code><code>function | object</code></code>
  * [.getBoundApi()](#at_cldmv_slash_slothlet_dot_getBoundApi) ⇒ <code><code>function | object</code></code>
  * [.shutdown()](#at_cldmv_slash_slothlet_dot_shutdown) ⇒ <code><code>Promise.&lt;void&gt;</code></code>


**Type Definitions**

  * [SlothletOptions](#typedef_SlothletOptions) : <code>object</code>


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

<a id="at_cldmv_slash_slothlet_ddash_slothlet"></a>

### slothlet(options) ⇒ <code>Promise.&lt;(function()|object)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a slothlet API instance with the specified configuration.
> This is the main entry point that can be called directly as a function.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet</code>](#at_cldmv_slash_slothlet)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>[SlothletOptions](#typedef_SlothletOptions)</code> | <code>{}</code> | <p>Configuration options for creating the API</p> |


**Returns**:

- <code>Promise.&lt;(function()|object)&gt;</code> <p>The bound API object or function</p>



* * *

<a id="at_cldmv_slash_slothlet_dot_isLoaded"></a>

### .isLoaded() ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Checks if the API has been loaded.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet</code>](#at_cldmv_slash_slothlet)

**Returns**:

- <code>boolean</code> <p></p>



* * *

<a id="at_cldmv_slash_slothlet_dot_getApi"></a>

### .getApi() ⇒ <code>function | object</code>
> <p><strong style="font-size: 1.1em;"><p>Returns the raw built API object (unbound, except in lazy mode where it's identical to boundapi).
> This is the original API structure before processing and binding operations.
> Most consumers should use getBoundApi() instead.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet</code>](#at_cldmv_slash_slothlet)

**Returns**:

- <code>function | object</code> <p>The raw API object or function</p>



* * *

<a id="at_cldmv_slash_slothlet_dot_getBoundApi"></a>

### .getBoundApi() ⇒ <code>function | object</code>
> <p><strong style="font-size: 1.1em;"><p>Returns the processed and bound API object that consumers should use.
> This includes live-binding references, context/reference injection, and shutdown management.
> This is what most applications should interact with.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet</code>](#at_cldmv_slash_slothlet)

**Returns**:

- <code>function | object</code> <p>The bound API object or function with live bindings and context</p>



* * *

<a id="at_cldmv_slash_slothlet_dot_shutdown"></a>

### .shutdown() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gracefully shuts down the API and cleans up resources.</p>
> <p>This method performs a comprehensive cleanup of the slothlet instance, including:</p>
> <ul>
> <li>Calling any user-defined shutdown functions in the loaded API</li>
> <li>Disposing of internal engine resources (VM contexts, workers, child processes)</li>
> <li>Clearing all bound references and live bindings</li>
> <li>Resetting the instance to an unloaded state</li>
> </ul>
> <p>The shutdown process includes timeout protection (5 seconds) and prevents
> recursive shutdown calls to ensure safe cleanup even in error conditions.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet</code>](#at_cldmv_slash_slothlet)

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




<a id="at_cldmv_slash_slothlet_slash_runtime"></a>

## @cldmv/slothlet/runtime
> <p><strong style="font-size: 1.1em;"><p>Provides AsyncLocalStorage-based context isolation for slothlet instances,
> enabling per-instance live bindings and context management across async operations.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/runtime](#at_cldmv_slash_slothlet_slash_runtime)


**Exported Constants**

  * [self](#at_cldmv_slash_slothlet_slash_runtime_dot_self) ⇒ <code>function | object</code>
  * [context](#at_cldmv_slash_slothlet_slash_runtime_dot_context) ⇒ <code>object</code>
  * [reference](#at_cldmv_slash_slothlet_slash_runtime_dot_reference) ⇒ <code>object</code>


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

<a id="at_cldmv_slash_slothlet_slash_runtime"></a>

### @cldmv/slothlet/runtime
> <p><strong style="font-size: 1.1em;"><p>Provides AsyncLocalStorage-based context isolation for slothlet instances,
> enabling per-instance live bindings and context management across async operations.</p></strong></p>
> 
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

<a id="at_cldmv_slash_slothlet_slash_runtime_dot_self"></a>

### self
> <p><strong style="font-size: 1.1em;"><p>Live binding to the current instance's 'self' reference from AsyncLocalStorage context.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime</code>](#at_cldmv_slash_slothlet_slash_runtime)

**Example**
```js
// Access current instance self
console.log(self); // Current slothlet instance
```



* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_dot_context"></a>

### context
> <p><strong style="font-size: 1.1em;"><p>Live binding to the current instance's 'context' data from AsyncLocalStorage context.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime</code>](#at_cldmv_slash_slothlet_slash_runtime)

**Example**
```js
// Access current context data
console.log(context); // Current context object
```



* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_dot_reference"></a>

### reference
> <p><strong style="font-size: 1.1em;"><p>Live binding to the current instance's 'reference' object from AsyncLocalStorage context.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime</code>](#at_cldmv_slash_slothlet_slash_runtime)

**Example**
```js
// Access current reference object
console.log(reference); // Current reference data
```







* * *

## Type Definitions

<a id="typedef_SlothletOptions"></a>

### SlothletOptions : <code>object</code>


**Kind**: typedef  
**Scope**: global


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [dir] | <code>string</code> | <code>api</code> | Directory to load API modules from. <ul> <li>Can be absolute or relative path.</li> <li>If relative, resolved from the calling file's location.</li> <li>Defaults to "api" directory relative to caller.</li> </ul> |
| [lazy] | <code>boolean</code> | <code>false</code> | Loading strategy: <ul> <li>`true`: Lazy loading - modules loaded on-demand when accessed (lower initial load, proxy overhead)</li> <li>`false`: Eager loading - all modules loaded immediately (default, higher initial load, direct access)</li> </ul> |
| [apiDepth] | <code>number</code> | <code>Infinity</code> | Directory traversal depth control: <ul> <li>`Infinity`: Traverse all subdirectories recursively (default)</li> <li>`0`: Only load files in root directory, no subdirectories</li> <li>`1`, `2`, etc.: Limit traversal to specified depth levels</li> </ul> |
| [debug] | <code>boolean</code> | <code>false</code> | Debug output control: <ul> <li>`true`: Enable verbose logging for module loading, API construction, and binding operations</li> <li>`false`: Silent operation (default)</li> <li>Can be set via command line flag `--slothletdebug`, environment variable `SLOTHLET_DEBUG=true`, or options parameter</li> <li>Command line and environment settings become the default for all instances unless overridden</li> </ul> |
| [mode] | <code>string</code> | <code>singleton</code> | Execution environment mode: <ul> <li>`"singleton"`: Single shared instance within current process (default, fastest)</li> <li>`"vm"`: Isolated VM context for security/isolation</li> <li>`"worker"`: Web Worker or Worker Thread execution</li> <li>`"fork"`: Child process execution for complete isolation</li> </ul> |
| [api_mode] | <code>string</code> | <code>auto</code> | API structure and calling convention: <ul> <li>`"auto"`: Auto-detect based on root module exports (function vs object) - recommended (default)</li> <li>`"function"`: Force API to be callable as function with properties attached</li> <li>`"object"`: Force API to be plain object with method properties</li> </ul> |
| [context] | <code>object</code> | <code>{}</code> | Context data object injected into live-binding `context` reference. <ul> <li>Available to all loaded modules via `import { context } from '@cldmv/slothlet/runtime'`. Useful for request data,</li> <li>user sessions, environment configs, etc.</li> </ul> |
| [reference] | <code>object</code> | <code>{}</code> | Reference object merged into the API root level. <ul> <li>Properties not conflicting with loaded modules are added directly to the API.</li> <li>Useful for utility functions, constants, or external service connections.</li> </ul> |
| [sanitize] | <code>object</code> |  | Filename sanitization options for API property names. <ul> <li>Controls how file names are converted to valid JavaScript identifiers.</li> <li>Default behavior: camelCase conversion with lowerFirst=true.</li> </ul> |
| [sanitize.lowerFirst] | <code>boolean</code> | <code>true</code> | Lowercase first character of first segment for camelCase convention. |
| [sanitize.rules] | <code>object</code> | <code>{}</code> | Advanced segment transformation rules with glob pattern support. |
| [sanitize.rules.leave] | <code>Array.<string></code> | <code>[]</code> | Segments to preserve exactly as-is (case-sensitive, supports * and ? globs). |
| [sanitize.rules.leaveInsensitive] | <code>Array.<string></code> | <code>[]</code> | Segments to preserve exactly as-is (case-insensitive, supports * and ? globs). |
| [sanitize.rules.upper] | <code>Array.<string></code> | <code>[]</code> | Segments to force to UPPERCASE (case-insensitive, supports * and ? globs). |
| [sanitize.rules.lower] | <code>Array.<string></code> | <code>[]</code> | Segments to force to lowercase (case-insensitive, supports * and ? globs). |


* * *


