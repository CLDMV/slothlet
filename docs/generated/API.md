<a id="at_cldmv_slash_slothlet"></a>

## @cldmv/slothlet
> <p><strong style="font-size: 1.1em;"><p>Main Slothlet orchestrator</p></strong></p>
> 


**Structure**

[@cldmv/slothlet](#at_cldmv_slash_slothlet)
  * [.slothlet(config)](#at_cldmv_slash_slothlet_dot_slothlet) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>





* * *

<a id="at_cldmv_slash_slothlet"></a>

### @cldmv/slothlet
> <p><strong style="font-size: 1.1em;"><p>Main Slothlet orchestrator</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_dot_slothlet"></a>

### @cldmv/slothlet.slothlet(config) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Create new Slothlet instance and load API
> Middleware function that delegates to Slothlet class</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet</code>](#at_cldmv_slash_slothlet)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| config | <code>Object</code> |  | <p>Configuration options</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Bound API object with control methods</p>


**Example**
```js
const api = await slothlet({ dir: "./api_tests/api_test" });
// Use API
const result = api.math.add(2, 3);
// Hot reload
await api.api.reload();
// Full reload
await api.reload();
// Shutdown when done
await api.api.shutdown();
```




<a id="at_cldmv_slash_slothlet_slash_runtime"></a>

## @cldmv/slothlet/runtime
> <p><strong style="font-size: 1.1em;"><p>Runtime dispatcher - proxies to async or live runtime based on configuration</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/runtime](#at_cldmv_slash_slothlet_slash_runtime)


**Exported Constants**

  * [@cldmv/slothlet/runtime.self](#at_cldmv_slash_slothlet_slash_runtime_dot_self) ⇒ <code>Proxy</code>
  * [@cldmv/slothlet/runtime.context](#at_cldmv_slash_slothlet_slash_runtime_dot_context) ⇒ <code>Proxy</code>
  * [@cldmv/slothlet/runtime.instanceID](#at_cldmv_slash_slothlet_slash_runtime_dot_instanceID) ⇒ <code>Proxy</code>





* * *

<a id="at_cldmv_slash_slothlet_slash_runtime"></a>

### @cldmv/slothlet/runtime
> <p><strong style="font-size: 1.1em;"><p>Runtime dispatcher - proxies to async or live runtime based on configuration</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_dot_self"></a>

### @cldmv/slothlet/runtime.self
> <p><strong style="font-size: 1.1em;"><p>Live binding to the current API (self-reference)
> Proxies to the appropriate runtime's self export</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime</code>](#at_cldmv_slash_slothlet_slash_runtime)


* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_dot_context"></a>

### @cldmv/slothlet/runtime.context
> <p><strong style="font-size: 1.1em;"><p>User-provided context data for live bindings
> Proxies to the appropriate runtime's context export</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime</code>](#at_cldmv_slash_slothlet_slash_runtime)


* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_dot_instanceID"></a>

### @cldmv/slothlet/runtime.instanceID
> <p><strong style="font-size: 1.1em;"><p>Current instance ID
> Proxies to the appropriate runtime's instanceID export</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime</code>](#at_cldmv_slash_slothlet_slash_runtime)



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

* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_config~Config"></a>

### @cldmv/slothlet/helpers/config.Config
> 
**Kind**: inner class of [<code>@cldmv/slothlet/helpers/config</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_config)



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
  * [.setApiContextChecker(checker)](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_setApiContextChecker)
  * [.enableEventEmitterPatching()](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_enableEventEmitterPatching)
  * [.disableEventEmitterPatching()](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_disableEventEmitterPatching)
  * [.cleanupEventEmitterResources()](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_cleanupEventEmitterResources)





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context"></a>

### @cldmv/slothlet/helpers/eventemitter-context
> <p><strong style="font-size: 1.1em;"><p>Node.js EventEmitter does NOT automatically propagate AsyncLocalStorage context
> to event listeners. This module patches EventEmitter.prototype methods to wrap
> all listeners with AsyncResource, preserving the context where they were registered.</p>
> <p>Additionally tracks EventEmitters created within slothlet API context so they can
> be cleaned up on shutdown.</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_setApiContextChecker"></a>

### @cldmv/slothlet/helpers/eventemitter-context.setApiContextChecker(checker)
> <p><strong style="font-size: 1.1em;"><p>Set the context checker callback
> Called by the runtime to register a way to detect API context</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/helpers/eventemitter-context</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| checker | <code>function</code> |  | <p>Function that returns true if in API context</p> |



* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_enableEventEmitterPatching"></a>

### @cldmv/slothlet/helpers/eventemitter-context.enableEventEmitterPatching()
> <p><strong style="font-size: 1.1em;"><p>Enable EventEmitter context propagation by patching EventEmitter.prototype.
> This should be called ONCE globally when the first slothlet instance is created.
> Subsequent calls will be ignored (patching is global).</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/helpers/eventemitter-context</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context)


* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_disableEventEmitterPatching"></a>

### @cldmv/slothlet/helpers/eventemitter-context.disableEventEmitterPatching()
> <p><strong style="font-size: 1.1em;"><p>Disable EventEmitter context propagation and restore original methods.
> This should only be called when ALL slothlet instances have been shut down.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/helpers/eventemitter-context</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context)


* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context_dot_cleanupEventEmitterResources"></a>

### @cldmv/slothlet/helpers/eventemitter-context.cleanupEventEmitterResources()
> <p><strong style="font-size: 1.1em;"><p>Cleanup all tracked EventEmitters created within slothlet API context.
> This removes all listeners from tracked emitters and clears tracking structures.
> Should be called during shutdown to prevent memory leaks and hanging processes.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/helpers/eventemitter-context</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_eventemitter-context)



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

* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_modes-utils_dot_ModesUtils"></a>

### @cldmv/slothlet/helpers/modes-utils.ModesUtils
> <p><strong style="font-size: 1.1em;"><p>Mode processing utilities component class</p></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/helpers/modes-utils</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_modes-utils)



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
  * [.sanitizePropertyName(input, options)](#at_cldmv_slash_slothlet_slash_helpers_slash_sanitize_dot_sanitizePropertyName) ⇒ <code><code>string</code></code>





* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_sanitize"></a>

### @cldmv/slothlet/helpers/sanitize
> <p><strong style="font-size: 1.1em;"><p>Advanced filename sanitization with rule-based transformation</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_sanitize_dot_Sanitize"></a>

### @cldmv/slothlet/helpers/sanitize.Sanitize
> <p><strong style="font-size: 1.1em;"><p>Advanced filename sanitization with rule-based transformation</p></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/helpers/sanitize</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_sanitize)


* * *

<a id="at_cldmv_slash_slothlet_slash_helpers_slash_sanitize_dot_sanitizePropertyName"></a>

### @cldmv/slothlet/helpers/sanitize.sanitizePropertyName(input, options) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Standalone sanitizePropertyName function for backward compatibility</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/helpers/sanitize</code>](#at_cldmv_slash_slothlet_slash_helpers_slash_sanitize)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| input | <code>string</code> |  | <p>Input string to sanitize</p> |
| options | <code>object</code> |  | <p>Sanitization options</p> |


**Returns**:

- <code>string</code> <p>Sanitized property name</p>




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


<a id="at_cldmv_slash_slothlet_slash_runtime_slash_async"></a>

## @cldmv/slothlet/runtime/async
> <p><strong style="font-size: 1.1em;"><p>Provides live bindings (<code>self</code>, <code>context</code>, <code>reference</code>) for use in API modules.
> Uses AsyncLocalStorage for context isolation across async operations.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/runtime/async](#at_cldmv_slash_slothlet_slash_runtime_slash_async)


**Exported Constants**

  * [@cldmv/slothlet/runtime/async.self](#at_cldmv_slash_slothlet_slash_runtime_slash_async_dot_self) ⇒ <code>Proxy</code>
  * [@cldmv/slothlet/runtime/async.context](#at_cldmv_slash_slothlet_slash_runtime_slash_async_dot_context) ⇒ <code>Proxy</code>
  * [@cldmv/slothlet/runtime/async.instanceID](#at_cldmv_slash_slothlet_slash_runtime_slash_async_dot_instanceID) ⇒ <code>Proxy</code>


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



* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_slash_async_dot_self"></a>

### @cldmv/slothlet/runtime/async.self
> <p><strong style="font-size: 1.1em;"><p>A proxy that provides access to the full API object within the current context.
> Automatically resolves to the correct instance's API in AsyncLocalStorage context.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime/async</code>](#at_cldmv_slash_slothlet_slash_runtime_slash_async)

**Example**
```js
import { self } from "@cldmv/slothlet/runtime/async";

export function callOtherFunction() {
  // Call another function in the same API
  return self.otherFunction();
}
```



* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_slash_async_dot_context"></a>

### @cldmv/slothlet/runtime/async.context
> <p><strong style="font-size: 1.1em;"><p>A proxy that provides access to user-provided context data (e.g., request data, user info).
> Can be set via <code>slothlet.run()</code> or <code>slothlet.scope()</code>.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime/async</code>](#at_cldmv_slash_slothlet_slash_runtime_slash_async)

**Example**
```js
import { context } from "@cldmv/slothlet/runtime/async";

export function getUserInfo() {
  // Access user-provided context
  return {
    userId: context.userId,
    userName: context.userName
  };
}
```



* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_slash_async_dot_instanceID"></a>

### @cldmv/slothlet/runtime/async.instanceID
> <p><strong style="font-size: 1.1em;"><p>A proxy that provides access to the current slothlet instance ID.
> Useful for debugging and tracking which instance is handling a request.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime/async</code>](#at_cldmv_slash_slothlet_slash_runtime_slash_async)

**Example**
```js
import { instanceID } from "@cldmv/slothlet/runtime/async";

export function getInstanceInfo() {
  return { instanceID };
}
```




<a id="at_cldmv_slash_slothlet_slash_runtime_slash_live"></a>

## @cldmv/slothlet/runtime/live
> <p><strong style="font-size: 1.1em;"><p>Provides live bindings (<code>self</code>, <code>context</code>, <code>reference</code>) for use in API modules.
> Uses direct global bindings (no AsyncLocalStorage) for maximum performance.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/runtime/live](#at_cldmv_slash_slothlet_slash_runtime_slash_live)


**Exported Constants**

  * [@cldmv/slothlet/runtime/live.self](#at_cldmv_slash_slothlet_slash_runtime_slash_live_dot_self) ⇒ <code>Proxy</code>
  * [@cldmv/slothlet/runtime/live.context](#at_cldmv_slash_slothlet_slash_runtime_slash_live_dot_context) ⇒ <code>Proxy</code>


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

<a id="at_cldmv_slash_slothlet_slash_runtime_slash_live_dot_self"></a>

### @cldmv/slothlet/runtime/live.self
> <p><strong style="font-size: 1.1em;"><p>A proxy that provides direct access to the current instance's API.
> In live mode, this directly references the active instance without AsyncLocalStorage.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime/live</code>](#at_cldmv_slash_slothlet_slash_runtime_slash_live)

**Example**
```js
import { self } from "@cldmv/slothlet/runtime/live";

export function callOtherFunction() {
  return self.otherFunction();
}
```



* * *

<a id="at_cldmv_slash_slothlet_slash_runtime_slash_live_dot_context"></a>

### @cldmv/slothlet/runtime/live.context
> <p><strong style="font-size: 1.1em;"><p>A proxy that provides access to user-provided context data.
> In live mode, this directly accesses the current instance's context.</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/runtime/live</code>](#at_cldmv_slash_slothlet_slash_runtime_slash_live)

**Example**
```js
import { context } from "@cldmv/slothlet/runtime/live";

export function getUserInfo() {
  return {
    userId: context.userId,
    userName: context.userName
  };
}
```






