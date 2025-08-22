<a name="module_@cldmv/slothlet"></a>

## @cldmv/slothlet
<p>Slothlet - Advanced module loader with lazy and eager loading capabilities</p>

**Version**: 2.0.0  
**Author**: CLDMV/Shinrai

Slothlet is a sophisticated module loading framework that provides both lazy and eager
loading strategies for JavaScript modules. It features copy-left materialization,
live-binding references, and comprehensive API management.

Key Features:
- Lazy loading with look-ahead materialization
- Eager loading for immediate module availability
- Copy-left approach preserving materialized functions
- Live-binding references (self, context, reference)
- Configurable debug output
- Multiple execution modes (vm, worker, fork)
- Bound API management with automatic cleanup
- Callable function interface for simplified usage

The main slothlet export is callable as a function for convenience, eliminating the need
to call slothlet.create() explicitly. Both slothlet(options) and slothlet.create(options)
work identically.  
**Example**  
```js
// Default import (recommended)
import slothlet from '@cldmv/slothlet';

// OR named import
import { slothlet } from '@cldmv/slothlet';

// OR both (they're the same)
import slothlet, { slothlet as namedSlothlet } from '@cldmv/slothlet';

// Usage
const api = await slothlet({
    dir: './api_test'
});
```
**Example**  
```js
// Basic require
const slothlet = require('@cldmv/slothlet');

// Usage
const api = await slothlet({
    dir: './api_test'
});
```
**Example**  
```js
// Create with context and reference (direct call)
const api = await slothlet({
  dir: './api_test',
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

* [@cldmv/slothlet](#module_@cldmv/slothlet)
    * [slothlet([options])](#exp_module_@cldmv/slothlet--slothlet) ⇒ <code>Promise.&lt;(object\|function())&gt;</code> ⏏
        * [.create([options])](#module_@cldmv/slothlet--slothlet.create) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.updateBindings(newContext, newReference, newSelf)](#module_@cldmv/slothlet--slothlet.updateBindings)
        * [.isLoaded()](#module_@cldmv/slothlet--slothlet.isLoaded) ⇒ <code>boolean</code>
        * [.getApi()](#module_@cldmv/slothlet--slothlet.getApi) ⇒ <code>object</code> \| <code>function</code>
        * [.getBoundApi()](#module_@cldmv/slothlet--slothlet.getBoundApi) ⇒ <code>object</code> \| <code>function</code>
        * [.shutdown()](#module_@cldmv/slothlet--slothlet.shutdown) ⇒ <code>Promise.&lt;void&gt;</code>


* * *

<a name="exp_module_@cldmv/slothlet--slothlet"></a>

### slothlet([options]) ⇒ <code>Promise.&lt;(object\|function())&gt;</code> ⏏
<p>Creates a slothlet API instance with the specified configuration.
This is the main entry point that can be called directly as a function.</p>

**Kind**: Exported function  
**Returns**: <code>Promise.&lt;(object\|function())&gt;</code> - <p>The bound API object or function</p>  
**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | [<code>SlothletOptions</code>](#SlothletOptions) | <code>{}</code> | <p>Configuration options for creating the API</p> |


* * *

<a name="module_@cldmv/slothlet--slothlet.create"></a>

#### slothlet.create([options]) ⇒ <code>Promise.&lt;object&gt;</code>
<p>Creates and initializes a slothlet API instance.</p>

**Kind**: static method of [<code>slothlet</code>](#exp_module_@cldmv/slothlet--slothlet)  
**Returns**: <code>Promise.&lt;object&gt;</code> - <p>The bound API object</p>  
**Access**: public  
**Internal**:   

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | [<code>SlothletOptions</code>](#SlothletOptions) | <code>{}</code> | <p>Configuration options for creating the API</p> |


* * *

<a name="module_@cldmv/slothlet--slothlet.updateBindings"></a>

#### slothlet.updateBindings(newContext, newReference, newSelf)
<p>Updates the live-binding references for self, context, and reference.
Mutates the function and its properties, preserving reference.</p>
<p><strong>IMPORTANT LIMITATIONS:</strong></p>
<ul>
<li><code>reference</code> does not add/remove functions from the API when called outside slothlet functions</li>
<li>Setting <code>self</code> manually is ill-advised and can break the API if not done correctly</li>
<li>These bindings are primarily for internal use during API initialization</li>
</ul>

**Kind**: static method of [<code>slothlet</code>](#exp_module_@cldmv/slothlet--slothlet)  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| newContext | <code>object</code> | <p>The current context object to bind as <code>context</code>.</p> |
| newReference | <code>object</code> | <p>The current reference object to bind as <code>reference</code>. Note: Does not modify API structure when called externally.</p> |
| newSelf | <code>object</code> \| <code>function</code> | <p>The current API object instance to bind as <code>self</code>. WARNING: Manual setting can break the API.</p> |

**Example**  
```js
// Safe usage - updating context only
slothlet.updateBindings({ user: 'alice' }, null, null);
context.user; // 'alice'
```
**Example**  
```js
// Potentially unsafe - manual self/reference modification
// Use with caution outside of slothlet initialization
slothlet.updateBindings(null, { custom: 123 }, customApiObject);
```

* * *

<a name="module_@cldmv/slothlet--slothlet.isLoaded"></a>

#### slothlet.isLoaded() ⇒ <code>boolean</code>
<p>Checks if the API has been loaded.</p>

**Kind**: static method of [<code>slothlet</code>](#exp_module_@cldmv/slothlet--slothlet)  
**Access**: public  

* * *

<a name="module_@cldmv/slothlet--slothlet.getApi"></a>

#### slothlet.getApi() ⇒ <code>object</code> \| <code>function</code>
<p>Returns the raw built API object (unbound, except in lazy mode where it's identical to boundapi).
This is the original API structure before processing and binding operations.
Most consumers should use getBoundApi() instead.</p>

**Kind**: static method of [<code>slothlet</code>](#exp_module_@cldmv/slothlet--slothlet)  
**Returns**: <code>object</code> \| <code>function</code> - <p>The raw API object or function</p>  
**Access**: public  

* * *

<a name="module_@cldmv/slothlet--slothlet.getBoundApi"></a>

#### slothlet.getBoundApi() ⇒ <code>object</code> \| <code>function</code>
<p>Returns the processed and bound API object that consumers should use.
This includes live-binding references, context/reference injection, and shutdown management.
This is what most applications should interact with.</p>

**Kind**: static method of [<code>slothlet</code>](#exp_module_@cldmv/slothlet--slothlet)  
**Returns**: <code>object</code> \| <code>function</code> - <p>The bound API object or function with live bindings and context</p>  
**Access**: public  

* * *

<a name="module_@cldmv/slothlet--slothlet.shutdown"></a>

#### slothlet.shutdown() ⇒ <code>Promise.&lt;void&gt;</code>
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

**Kind**: static method of [<code>slothlet</code>](#exp_module_@cldmv/slothlet--slothlet)  
**Returns**: <code>Promise.&lt;void&gt;</code> - <p>Resolves when shutdown is complete</p>  
**Throws**:

- <code>Error</code> <p>If recursive shutdown is detected or shutdown fails</p>

**Access**: public  
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

<a name="module_@cldmv/slothlet/eager"></a>

## @cldmv/slothlet/eager
<p>Slothlet Eager Mode - Immediate module loading and API construction</p>
<p>This module implements the eager loading strategy for slothlet, where all modules
are loaded and processed immediately during initialization. This provides instant
access to all API endpoints without the overhead of lazy materialization.</p>
<p>Key Features:</p>
<ul>
<li>Immediate loading of all modules in directory structure</li>
<li>Complete API construction during initialization</li>
<li>No proxy overhead - direct function access</li>
<li>Predictable loading behavior for production environments</li>
<li>Comprehensive module flattening and structuring</li>
<li>Support for nested directory traversal with depth control</li>
</ul>
<p>Technical Implementation:</p>
<ul>
<li>create(): Main entry point for eager API construction</li>
<li>_buildCompleteApi(): Builds callable API with proper function attachments</li>
<li>Utilizes slothlet._loadCategory() for consistent module loading</li>
<li>Maintains compatibility with lazy mode API structure</li>
</ul>
<p>Performance Characteristics:</p>
<ul>
<li>Higher initial load time (all modules loaded upfront)</li>
<li>Consistent runtime performance (no materialization overhead)</li>
<li>Ideal for production environments with predictable usage patterns</li>
<li>Lower memory overhead (no proxy objects)</li>
</ul>

**Version**: 1.0.0  
**Author**: CLDMV/Shinrai  
**Example**  
```js
// Basic slothlet usage with eager loading
import slothlet from '@cldmv/slothlet';
const api = await slothlet({ dir: './api_test', lazy: false });

// All modules are immediately loaded and available
console.log(typeof api.math); // 'object' (actual module)
console.log(Object.keys(api.math)); // ['add', 'multiply']
```
**Example**  
```js
// Direct function access - no materialization delay
const result = await api.math.add(2, 3); // Immediate execution
console.log(result); // 5

// All modules are pre-loaded and ready
console.log(typeof api.string); // 'object'
console.log(Object.keys(api.string)); // ['upper', 'reverse']
```
**Example**  
```js
UPON CREATION: API structure after creation

 [Function: bound] {
   _impl: [Function (anonymous)],
   config: { host: 'https:unifi.example.com', username: 'admin', ... },
   rootFunctionShout: [Function: rootFunctionShout],
   rootFunctionWhisper: [Function: rootFunctionWhisper],
   rootMath: { add: [Function: add], multiply: [Function: multiply] },
   rootstring: { upper: [Function: upper], reverse: [Function: reverse] },
   advanced: {
     selfObject: { addViaSelf: [Function: addViaSelf] },
     nest: [Function: nest],
     nest2: { alpha: [Object], beta: [Object] },
     nest3: [Function: nest3],
     nest4: { singlefile: [Function: beta] }
   },
   exportDefault: [Function: exportDefault] { extra: [Function: extra] },
   funcmod: [Function: funcmod],
   math: { add: [Function: add], multiply: [Function: multiply] },
   multi: {
     alpha: { hello: [Function: hello] },
     beta: { world: [Function: world] }
   },
   multi_func: {
     alpha: [Function: alpha],
     beta: { hello: [Function: hello] },
     multi_func_hello: [Function: multi_func_hello],
     uniqueOne: [Function: uniqueOne],
     uniqueThree: [Function: uniqueThree],
     uniqueTwo: [Function: uniqueTwo]
   },
   nested: { date: { today: [Function: today] } },
   objectDefaultMethod: [Function: objectDefaultMethod] {
     info: [Function: info],
     warn: [Function: warn],
     error: [Function: error]
   },
   string: { upper: [Function: upper], reverse: [Function: reverse] },
   util: {
     controller: {
       getDefault: [AsyncFunction: getDefault],
       detectEndpointType: [AsyncFunction: detectEndpointType],
       detectDeviceType: [AsyncFunction: detectDeviceType]
     },
     extract: {
       data: [Function: data],
       section: [Function: section],
       NVRSection: [Function: NVRSection],
       parseDeviceName: [Function: parseDeviceName]
     },
     url: {
       buildUrlWithParams: [Function: buildUrlWithParams],
       cleanEndpoint: [Function: cleanEndpoint]
     },
     secondFunc: [Function: secondFunc],
     size: [Function: size]
   },
   md5: [Function: md5],
   describe: [Function (anonymous)],
   shutdown: [Function: bound shutdown] AsyncFunction
 }
```

* * *

<a name="module_@cldmv/slothlet/lazy"></a>

## @cldmv/slothlet/lazy
<p>Slothlet Lazy Mode - Look-ahead materialization with copy-left preservation</p>
<p>This module implements the lazy loading strategy for slothlet with intelligent
look-ahead materialization and copy-left preservation of already materialized functions.</p>
<p>Key Features:</p>
<ul>
<li>Look-ahead proxy creation for deferred module loading</li>
<li>Copy-left materialization preserving existing functions</li>
<li>Bubble-up strategy for parent API synchronization</li>
<li>Performance optimization preventing re-processing</li>
<li>Configurable debug output for development</li>
<li>Proper function name preservation throughout materialization</li>
</ul>
<p>Technical Implementation:</p>
<ul>
<li>createLookAheadProxy(): Creates intelligent proxies that materialize on access</li>
<li>materializeWithLookAhead(): On-demand module loading and processing</li>
<li>bubbleUpMaterialization(): Copy-left updates to parent APIs</li>
<li>Copy-left logic: Only replaces proxies, preserves materialized functions</li>
</ul>
<p>Performance Results:</p>
<ul>
<li>564-657x speed improvement on repeated function calls</li>
<li>Zero re-processing of materialized modules</li>
<li>Clean API structure matching eager mode exactly</li>
</ul>

**Version**: 1.0.0  
**Author**: CLDMV/Shinrai  
**Example**  
```js
// Basic slothlet usage with lazy loading
import slothlet from '@cldmv/slothlet';
const api = await slothlet({ dir: './api_test', lazy: true });

// Initial API structure - modules are lazy-loaded proxies
console.log(typeof api.math); // 'function' (proxy function)
console.log(api.math.name);   // 'lazyFolder_math'
```
**Example**  
```js
// Accessing a function triggers materialization
const result = await api.math.add(2, 3); // Materializes math module
console.log(result); // 5

// After materialization - proxy is replaced with actual module
console.log(typeof api.math); // 'object'
console.log(Object.keys(api.math)); // ['add', 'multiply']
```
**Example**  
```js
BEFORE: API structure with lazy proxies (before any access)

 [Function: bound] {
   _impl: [Function (anonymous)],
   config: { host: 'https:unifi.example.com', username: 'admin', ... },
   rootFunctionShout: [Function: rootFunctionShout],
   rootFunctionWhisper: [Function: rootFunctionWhisper],
   rootMath: { add: [Function: add], multiply: [Function: multiply] },
   rootstring: { upper: [Function: upper], reverse: [Function: reverse] },
   advanced: [Function: lazyFolder_advanced] {
     __materialized: null,
     __promise: null,
     _updateParentAPI: [Function (anonymous)]
   },
   math: [Function: lazyFolder_math] {
     __materialized: null,
     __promise: null,
     _updateParentAPI: [Function (anonymous)]
   },
   string: [Function: lazyFolder_string] {
     __materialized: null,
     __promise: null,
     _updateParentAPI: [Function (anonymous)]
   },
   util: [Function: lazyFolder_util] {
     __materialized: null,
     __promise: null,
     _updateParentAPI: [Function (anonymous)]
   }
 }
```
**Example**  
```js
AFTER: API structure after materialization (after accessing modules)

 [Function: bound] {
   _impl: [Function (anonymous)],
   config: { host: 'https:unifi.example.com', username: 'admin', ... },
   rootFunctionShout: [Function: rootFunctionShout],
   rootFunctionWhisper: [Function: rootFunctionWhisper],
   rootMath: { add: [Function: add], multiply: [Function: multiply] },
   rootstring: { upper: [Function: upper], reverse: [Function: reverse] },
   advanced: {
     selfObject: { addViaSelf: [Function: addViaSelf] },
     nest: [Function: nest],
     nest2: { alpha: [Object], beta: [Object] },
     nest3: [Function: nest3],
     nest4: { singlefile: [Function: beta] }
   },
   exportDefault: [Function: exportDefault] { extra: [Function: extra] },
   funcmod: [Function: funcmod],
   math: { add: [Function: add], multiply: [Function: multiply] },
   multi: {
     alpha: { hello: [Function: hello] },
     beta: { world: [Function: world] }
   },
   multi_func: {
     alpha: [Function: alpha],
     beta: { hello: [Function: hello] },
     multi_func_hello: [Function: multi_func_hello],
     uniqueOne: [Function: uniqueOne],
     uniqueThree: [Function: uniqueThree],
     uniqueTwo: [Function: uniqueTwo]
   },
   nested: { date: { today: [Function: today] } },
   objectDefaultMethod: [Function: objectDefaultMethod] {
     info: [Function: info],
     warn: [Function: warn],
     error: [Function: error]
   },
   string: { upper: [Function: upper], reverse: [Function: reverse] },
   util: {
     controller: {
       getDefault: [AsyncFunction: getDefault],
       detectEndpointType: [AsyncFunction: detectEndpointType],
       detectDeviceType: [AsyncFunction: detectDeviceType]
     },
     extract: {
       data: [Function: data],
       section: [Function: section],
       NVRSection: [Function: NVRSection],
       parseDeviceName: [Function: parseDeviceName]
     },
     url: {
       buildUrlWithParams: [Function: buildUrlWithParams],
       cleanEndpoint: [Function: cleanEndpoint]
     },
     secondFunc: [Function: secondFunc],
     size: [Function: size]
   },
   md5: [Function: md5],
   describe: [Function (anonymous)],
   shutdown: [Function: bound shutdown] AsyncFunction
 }
```

* * *

<a name="SlothletOptions"></a>

## SlothletOptions : <code>object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [dir] | <code>string</code> | <code>&quot;api&quot;</code> | <p>Directory to load API modules from. Can be absolute or relative path. If relative, resolved from process.cwd(). Defaults to &quot;api&quot; directory in current working directory.</p> |
| [lazy] | <code>boolean</code> | <code>false</code> | <p>Loading strategy:</p> <ul> <li><code>true</code>: Lazy loading - modules loaded on-demand when accessed (lower initial load, proxy overhead)</li> <li><code>false</code>: Eager loading - all modules loaded immediately (default, higher initial load, direct access)</li> </ul> |
| [apiDepth] | <code>number</code> | <code>Infinity</code> | <p>Directory traversal depth control:</p> <ul> <li><code>Infinity</code>: Traverse all subdirectories recursively (default)</li> <li><code>0</code>: Only load files in root directory, no subdirectories</li> <li><code>1</code>, <code>2</code>, etc.: Limit traversal to specified depth levels</li> </ul> |
| [debug] | <code>boolean</code> | <code>false</code> | <p>Debug output control:</p> <ul> <li><code>true</code>: Enable verbose logging for module loading, API construction, and binding operations</li> <li><code>false</code>: Silent operation (default)</li> <li>Can be set via command line flag <code>--slothletdebug</code>, environment variable <code>SLOTHLET_DEBUG=true</code>, or options parameter</li> <li>Command line and environment settings become the default for all instances unless overridden</li> </ul> |
| [mode] | <code>string</code> | <code>&quot;singleton&quot;</code> | <p>Execution environment mode:</p> <ul> <li><code>&quot;singleton&quot;</code>: Single shared instance within current process (default, fastest)</li> <li><code>&quot;vm&quot;</code>: Isolated VM context for security/isolation</li> <li><code>&quot;worker&quot;</code>: Web Worker or Worker Thread execution</li> <li><code>&quot;fork&quot;</code>: Child process execution for complete isolation</li> </ul> |
| [api_mode] | <code>string</code> | <code>&quot;auto&quot;</code> | <p>API structure and calling convention:</p> <ul> <li><code>&quot;auto&quot;</code>: Auto-detect based on root module exports (function vs object) - recommended (default)</li> <li><code>&quot;function&quot;</code>: Force API to be callable as function with properties attached</li> <li><code>&quot;object&quot;</code>: Force API to be plain object with method properties</li> </ul> |
| [context] | <code>object</code> | <code>{}</code> | <p>Context data object injected into live-binding <code>context</code> reference. Available to all loaded modules via <code>import { context } from 'slothlet'</code>. Useful for request data, user sessions, environment configs, etc.</p> |
| [reference] | <code>object</code> | <code>{}</code> | <p>Reference object merged into the API root level. Properties not conflicting with loaded modules are added directly to the API. Useful for utility functions, constants, or external service connections.</p> |
| [entry] | <code>string</code> |  | <p>Entry module URL for advanced use cases. Defaults to slothlet's own module URL. Only modify if implementing custom loaders. <strong>Warning</strong>: This parameter is experimental and not officially supported. Use at your own risk.</p> |


* * *

