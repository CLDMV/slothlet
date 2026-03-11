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




<a id="handlers_slash_hook-manager"></a>

## handlers/hook-manager
> <p><strong style="font-size: 1.1em;"><p>Hook manager for intercepting API function calls</p></strong></p>
> 


**Structure**

[handlers/hook-manager](#handlers_slash_hook-manager)


**Type Definitions**

  * [undefined](#)





* * *

<a id="handlers_slash_hook-manager"></a>

### handlers/hook-manager
> <p><strong style="font-size: 1.1em;"><p>Hook manager for intercepting API function calls</p></strong></p>
> 

* * *

<a id="typedef_module_handlers_slash_hook-manager~HookExecutionResult"></a>

### handlers/hook-manager.HookExecutionResult
> <p><strong style="font-size: 1.1em;"><p>Result returned by hook execution methods.</p></strong></p>
> 
**Kind**: inner typedef of [<code>handlers/hook-manager</code>](#handlers_slash_hook-manager)


* * *

<a id="handlers_slash_hook-manager_dot_HookManager"></a>

### handlers/hook-manager.HookManager
> 
**Kind**: static class of [<code>handlers/hook-manager</code>](#handlers_slash_hook-manager)



<a id="processors_slash_flatten"></a>

## processors/flatten
> <p><strong style="font-size: 1.1em;"><p>Provides the Flatten class for determining when and how to flatten API structures
> based on comprehensive rule set. Implements 18 core conditions (C01-C18) from
> API-RULES-CONDITIONS.md. Extends ComponentBase for access to Slothlet configuration.</p></strong></p>
> 


**Structure**

[processors/flatten](#processors_slash_flatten)


**Example**
```js
// Flatten is instantiated by Slothlet and passed to processors
const flatten = new Flatten(slothlet);
const decision = flatten.getFlatteningDecision(options);
const categoryDecisions = flatten.buildCategoryDecisions(options);
```





* * *

<a id="processors_slash_flatten"></a>

### processors/flatten
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



* * *

<a id="processors_slash_flatten_dot_Flatten"></a>

### processors/flatten.Flatten
> 
**Kind**: static class of [<code>processors/flatten</code>](#processors_slash_flatten)



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

* * *

<a id="at_cldmv_slash_slothlet_slash_errors_dot_SlothletError"></a>

### @cldmv/slothlet/errors.SlothletError
> <p><strong style="font-size: 1.1em;"><p>Custom error class for Slothlet-specific errors with context and i18n</p></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/errors</code>](#at_cldmv_slash_slothlet_slash_errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_errors_dot_SlothletWarning"></a>

### @cldmv/slothlet/errors.SlothletWarning
> <p><strong style="font-size: 1.1em;"><p>Warning class for non-fatal issues with i18n support</p></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/errors</code>](#at_cldmv_slash_slothlet_slash_errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_errors_dot_SlothletDebug"></a>

### @cldmv/slothlet/errors.SlothletDebug
> <p><strong style="font-size: 1.1em;"><p>Debug utility class for centralized conditional console output with i18n</p></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/errors</code>](#at_cldmv_slash_slothlet_slash_errors)



<a id="at_cldmv_slash_slothlet_slash_i18n"></a>

## @cldmv/slothlet/i18n
> <p><strong style="font-size: 1.1em;"><p>i18n translation system for Slothlet errors</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/i18n](#at_cldmv_slash_slothlet_slash_i18n)
  * [.setLanguage(lang)](#at_cldmv_slash_slothlet_slash_i18n_dot_setLanguage)
  * [.getLanguage()](#at_cldmv_slash_slothlet_slash_i18n_dot_getLanguage) ⇒ <code><code>string</code></code>
  * [.translate(errorCode, params)](#at_cldmv_slash_slothlet_slash_i18n_dot_translate) ⇒ <code><code>string</code></code>
  * [.initI18n(options)](#at_cldmv_slash_slothlet_slash_i18n_dot_initI18n)


**Exported Constants**

  * [@cldmv/slothlet/i18n.t](#at_cldmv_slash_slothlet_slash_i18n_dot_t)





* * *

<a id="at_cldmv_slash_slothlet_slash_i18n"></a>

### @cldmv/slothlet/i18n
> <p><strong style="font-size: 1.1em;"><p>i18n translation system for Slothlet errors</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_i18n_dot_setLanguage"></a>

### @cldmv/slothlet/i18n.setLanguage(lang)
> <p><strong style="font-size: 1.1em;"><p>Set current language (synchronous)
> Merges requested language translations over default English translations</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/i18n</code>](#at_cldmv_slash_slothlet_slash_i18n)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| lang | <code>string</code> |  | <p>Language code</p> |



* * *

<a id="at_cldmv_slash_slothlet_slash_i18n_dot_getLanguage"></a>

### @cldmv/slothlet/i18n.getLanguage() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Get current language</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/i18n</code>](#at_cldmv_slash_slothlet_slash_i18n)

**Returns**:

- <code>string</code> <p>Language code</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_i18n_dot_translate"></a>

### @cldmv/slothlet/i18n.translate(errorCode, params) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Translate error message with interpolation</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/i18n</code>](#at_cldmv_slash_slothlet_slash_i18n)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| errorCode | <code>string</code> |  | <p>Error code</p> |
| params | <code>Object</code> |  | <p>Parameters for interpolation</p> |


**Returns**:

- <code>string</code> <p>Translated message</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_i18n_dot_initI18n"></a>

### @cldmv/slothlet/i18n.initI18n(options)
> <p><strong style="font-size: 1.1em;"><p>Initialize i18n system (synchronous)</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/i18n</code>](#at_cldmv_slash_slothlet_slash_i18n)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | <p>Options</p> |
| [options.language] | <code>string</code> |  | <p>Language code (auto-detect if not provided)</p> |



* * *

<a id="at_cldmv_slash_slothlet_slash_i18n_dot_t"></a>

### @cldmv/slothlet/i18n.t
> <p><strong style="font-size: 1.1em;"><p>Shorthand for translate</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/i18n</code>](#at_cldmv_slash_slothlet_slash_i18n)



<a id="at_cldmv_slash_slothlet_slash_ownership"></a>

## @cldmv/slothlet/ownership
> <p><strong style="font-size: 1.1em;"><p>Centralized ownership tracking for hot reload</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/ownership](#at_cldmv_slash_slothlet_slash_ownership)


**Type Definitions**

  * [undefined](#)





* * *

<a id="at_cldmv_slash_slothlet_slash_ownership"></a>

### @cldmv/slothlet/ownership
> <p><strong style="font-size: 1.1em;"><p>Centralized ownership tracking for hot reload</p></strong></p>
> 

* * *

<a id="typedef_module_at_cldmv_slash_slothlet_slash_ownership~UnregisterResult"></a>

### @cldmv/slothlet/ownership.UnregisterResult
> <p><strong style="font-size: 1.1em;"><p>Summary result of an unregister operation.</p></strong></p>
> 
**Kind**: inner typedef of [<code>@cldmv/slothlet/ownership</code>](#at_cldmv_slash_slothlet_slash_ownership)


* * *

<a id="at_cldmv_slash_slothlet_slash_ownership~OwnershipManager"></a>

### @cldmv/slothlet/ownership.OwnershipManager
> 
**Kind**: inner class of [<code>@cldmv/slothlet/ownership</code>](#at_cldmv_slash_slothlet_slash_ownership)



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



<a id="at_cldmv_slash_slothlet_slash_builders_slash_api_builder"></a>

## @cldmv/slothlet/builders/api\_builder
> <p><strong style="font-size: 1.1em;"><p>Clones the user API, attaches built-in helpers, and wires lifecycle utilities for
> each Slothlet instance.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/builders/api_builder](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder)
  * [._resolvePathOrModuleId(slothlet, pathOrModuleId)](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder~_resolvePathOrModuleId) ⇒ <code><code>string</code></code>
  * [.enabled](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder~enabled)
  * [.compilePattern(pattern)](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder~compilePattern) ⇒ <code><code>function</code></code>


**Type Definitions**

  * [undefined](#)


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



* * *

<a id="typedef_module_at_cldmv_slash_slothlet_slash_builders_slash_api_builder~I18nNamespace"></a>

### @cldmv/slothlet/builders/api_builder.I18nNamespace
> <p><strong style="font-size: 1.1em;"><p>i18n translation helpers exposed on every Slothlet namespace.</p></strong></p>
> 
**Kind**: inner typedef of [<code>@cldmv/slothlet/builders/api_builder</code>](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder)


* * *

<a id="at_cldmv_slash_slothlet_slash_builders_slash_api_builder~_resolvePathOrModuleId"></a>

### @cldmv/slothlet/builders/api_builder._resolvePathOrModuleId(slothlet, pathOrModuleId) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Checks whether the given string matches a moduleID recorded in <code>addHistory</code>.
> If it does, returns the <code>apiPath</code> that was registered with it. Otherwise
> returns the string as-is (treating it as a dot-notation path), consistent
> with the resolution logic used by <code>api.reload()</code> and <code>api.remove()</code>.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/builders/api_builder</code>](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| slothlet | <code>object</code> |  | <p>Slothlet instance</p> |
| pathOrModuleId | <code>string</code> |  | <p>Dot-notation API path or a registered moduleID</p> |


**Returns**:

- <code>string</code> <p>Resolved dot-notation apiPath</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_builders_slash_api_builder~enabled"></a>

### @cldmv/slothlet/builders/api_builder.enabled
> <p><strong style="font-size: 1.1em;"><p>Hook manager enabled state</p></strong></p>
> 
**Kind**: inner property of [<code>@cldmv/slothlet/builders/api_builder</code>](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder)


* * *

<a id="at_cldmv_slash_slothlet_slash_builders_slash_api_builder~compilePattern"></a>

### @cldmv/slothlet/builders/api_builder.compilePattern(pattern) ⇒ <code>function</code>
> <p><strong style="font-size: 1.1em;"><p>Compile a glob pattern into a matcher function for diagnostic use.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/builders/api_builder</code>](#at_cldmv_slash_slothlet_slash_builders_slash_api_builder)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| pattern | <code>string</code> |  | <p>Glob pattern</p> |


**Returns**:

- <code>function</code> <p>Compiled matcher function</p>




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
  * [.getContextManager(runtime)](#at_cldmv_slash_slothlet_slash_factories_slash_context_dot_getContextManager) ⇒ <code><code>Object</code></code>


**Exported Constants**

  * [@cldmv/slothlet/factories/context.contextManager](#at_cldmv_slash_slothlet_slash_factories_slash_context_dot_contextManager)
  * [@cldmv/slothlet/factories/context.asyncRuntime](#at_cldmv_slash_slothlet_slash_factories_slash_context_dot_asyncRuntime)
  * [@cldmv/slothlet/factories/context.liveRuntime](#at_cldmv_slash_slothlet_slash_factories_slash_context_dot_liveRuntime)





* * *

<a id="at_cldmv_slash_slothlet_slash_factories_slash_context"></a>

### @cldmv/slothlet/factories/context
> <p><strong style="font-size: 1.1em;"><p>Context management factory - selects appropriate manager based on runtime</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_factories_slash_context_dot_getContextManager"></a>

### @cldmv/slothlet/factories/context.getContextManager(runtime) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Get context manager for specified runtime type</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/factories/context</code>](#at_cldmv_slash_slothlet_slash_factories_slash_context)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| runtime | <code>string</code> |  | <p>Runtime type (&quot;async&quot; or &quot;live&quot;)</p> |


**Returns**:

- <code>Object</code> <p>Context manager instance</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_factories_slash_context_dot_contextManager"></a>

### @cldmv/slothlet/factories/context.contextManager
> <p><strong style="font-size: 1.1em;"><p>Default context manager (async)</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/factories/context</code>](#at_cldmv_slash_slothlet_slash_factories_slash_context)


* * *

<a id="at_cldmv_slash_slothlet_slash_factories_slash_context_dot_asyncRuntime"></a>

### @cldmv/slothlet/factories/context.asyncRuntime
> <p><strong style="font-size: 1.1em;"><p>Async runtime for runtime exports</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/factories/context</code>](#at_cldmv_slash_slothlet_slash_factories_slash_context)


* * *

<a id="at_cldmv_slash_slothlet_slash_factories_slash_context_dot_liveRuntime"></a>

### @cldmv/slothlet/factories/context.liveRuntime
> <p><strong style="font-size: 1.1em;"><p>Live runtime for runtime exports</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/factories/context</code>](#at_cldmv_slash_slothlet_slash_factories_slash_context)



<a id="at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager"></a>

## @cldmv/slothlet/handlers/api-cache-manager
> <p><strong style="font-size: 1.1em;"><p>Manages complete buildAPI result caches per moduleID. The cache system is the single
> source of truth for all API trees - the live API references cached trees, not copies.
> Each cache stores the complete buildAPI result with all parameters needed for rebuild.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/api-cache-manager](#at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager)


**Type Definitions**

  * [undefined](#)


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



* * *

<a id="typedef_module_at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager~CacheEntry"></a>

### @cldmv/slothlet/handlers/api-cache-manager.CacheEntry
> <p><strong style="font-size: 1.1em;"><p>Cache entry structure for API tree storage and rebuild parameters.</p></strong></p>
> 
**Kind**: inner typedef of [<code>@cldmv/slothlet/handlers/api-cache-manager</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager)


* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager_dot_ApiCacheManager"></a>

### @cldmv/slothlet/handlers/api-cache-manager.ApiCacheManager
> 
**Kind**: static class of [<code>@cldmv/slothlet/handlers/api-cache-manager</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_api-cache-manager)



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


**Exported Constants**

  * [@cldmv/slothlet/handlers/context-async.asyncContextManager](#at_cldmv_slash_slothlet_slash_handlers_slash_context-async_dot_asyncContextManager)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-async"></a>

### @cldmv/slothlet/handlers/context-async
> <p><strong style="font-size: 1.1em;"><p>AsyncLocalStorage-based context manager</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-async_dot_AsyncContextManager"></a>

### @cldmv/slothlet/handlers/context-async.AsyncContextManager
> <p><strong style="font-size: 1.1em;"><p>AsyncLocalStorage-based context manager for async runtime
> Uses ALS for full context isolation across async operations</p></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/handlers/context-async</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_context-async)


* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-async_dot_asyncContextManager"></a>

### @cldmv/slothlet/handlers/context-async.asyncContextManager
> <p><strong style="font-size: 1.1em;"><p>Singleton async context manager</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/handlers/context-async</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_context-async)



<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-live"></a>

## @cldmv/slothlet/handlers/context-live
> <p><strong style="font-size: 1.1em;"><p>Live bindings context manager (no AsyncLocalStorage)</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/context-live](#at_cldmv_slash_slothlet_slash_handlers_slash_context-live)


**Exported Constants**

  * [@cldmv/slothlet/handlers/context-live.liveContextManager](#at_cldmv_slash_slothlet_slash_handlers_slash_context-live_dot_liveContextManager)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-live"></a>

### @cldmv/slothlet/handlers/context-live
> <p><strong style="font-size: 1.1em;"><p>Live bindings context manager (no AsyncLocalStorage)</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-live_dot_LiveContextManager"></a>

### @cldmv/slothlet/handlers/context-live.LiveContextManager
> <p><strong style="font-size: 1.1em;"><p>Live bindings context manager (direct global state)
> Uses direct instance tracking without AsyncLocalStorage overhead</p></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/handlers/context-live</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_context-live)


* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_context-live_dot_liveContextManager"></a>

### @cldmv/slothlet/handlers/context-live.liveContextManager
> <p><strong style="font-size: 1.1em;"><p>Singleton live context manager</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/handlers/context-live</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_context-live)



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


**Exported Constants**

  * [@cldmv/slothlet/handlers/lifecycle-token.instanceTokens](#at_cldmv_slash_slothlet_slash_handlers_slash_lifecycle-token~instanceTokens) ⇒ <code>WeakMap.&lt;object, symbol&gt;</code>





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

* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_lifecycle-token~instanceTokens"></a>

### @cldmv/slothlet/handlers/lifecycle-token.instanceTokens
> <p><strong style="font-size: 1.1em;"><p>Module-private map of Slothlet instance → per-instance capability token.
> Never exported — the only way to interact with it is through the three functions below.</p></strong></p>
> 
**Kind**: inner constant of [<code>@cldmv/slothlet/handlers/lifecycle-token</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_lifecycle-token)



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

* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_metadata_dot_Metadata"></a>

### @cldmv/slothlet/handlers/metadata.Metadata
> 
**Kind**: static class of [<code>@cldmv/slothlet/handlers/metadata</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_metadata)



<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper"></a>

## @cldmv/slothlet/handlers/unified-wrapper
> <p><strong style="font-size: 1.1em;"><p>Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/handlers/unified-wrapper](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper)
  * [.getSafeFunctionName(apiPath, fallback)](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper~getSafeFunctionName) ⇒ <code><code>string</code></code>
  * [.createNamedProxyTarget(nameHint, fallback)](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper~createNamedProxyTarget) ⇒ <code><code>function</code></code>
  * [.resolveWrapper(value)](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper_dot_resolveWrapper) ⇒ <code><code>UnifiedWrapper | null</code></code>


**Exported Constants**

  * [@cldmv/slothlet/handlers/unified-wrapper.TYPE_STATES](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper_dot_TYPE_STATES)





* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper"></a>

### @cldmv/slothlet/handlers/unified-wrapper
> <p><strong style="font-size: 1.1em;"><p>Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper_dot_TYPE_STATES"></a>

### @cldmv/slothlet/handlers/unified-wrapper.TYPE_STATES
> <p><strong style="font-size: 1.1em;"><p>Symbols for __type property states</p></strong></p>
> 
**Kind**: static constant of [<code>@cldmv/slothlet/handlers/unified-wrapper</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper)


* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper~getSafeFunctionName"></a>

### @cldmv/slothlet/handlers/unified-wrapper.getSafeFunctionName(apiPath, fallback) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Build a safe function name for debugging and inspection output.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/handlers/unified-wrapper</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| apiPath | <code>string</code> |  | <p>API path to derive a name from.</p> |
| fallback | <code>string</code> |  | <p>Fallback name when a safe name cannot be derived.</p> |


**Returns**:

- <code>string</code> <p>Safe function name.</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper~createNamedProxyTarget"></a>

### @cldmv/slothlet/handlers/unified-wrapper.createNamedProxyTarget(nameHint, fallback) ⇒ <code>function</code>
> <p><strong style="font-size: 1.1em;"><p>Create a named proxy target function for clearer debug output.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/handlers/unified-wrapper</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| nameHint | <code>string</code> |  | <p>Name hint derived from apiPath.</p> |
| fallback | <code>string</code> |  | <p>Fallback function name if nameHint is unusable.</p> |


**Returns**:

- <code>function</code> <p>Named proxy target function.</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper_dot_UnifiedWrapper"></a>

### @cldmv/slothlet/handlers/unified-wrapper.UnifiedWrapper
> <p><strong style="font-size: 1.1em;"><p>Unified wrapper class that handles all proxy concerns in one place:</p>
> <ul>
> <li>__impl pattern for reload support</li>
> <li>Lazy/eager mode materialization</li>
> <li>Recursive waiting proxy for deep lazy loading</li>
> <li>Context binding through contextManager</li>
> </ul></strong></p>
> 
**Kind**: static class of [<code>@cldmv/slothlet/handlers/unified-wrapper</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper)


* * *

<a id="at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper_dot_resolveWrapper"></a>

### @cldmv/slothlet/handlers/unified-wrapper.resolveWrapper(value) ⇒ <code>UnifiedWrapper | null</code>
> <p><strong style="font-size: 1.1em;"><p>Resolves a value to its backing UnifiedWrapper instance.
> Accepts a proxy registered via createProxy() or a raw UnifiedWrapper instance.
> Returns null for any other value.</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/handlers/unified-wrapper</code>](#at_cldmv_slash_slothlet_slash_handlers_slash_unified-wrapper)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>unknown</code> |  | <p>Value to resolve</p> |


**Returns**:

- <code>UnifiedWrapper | null</code> <p>The backing wrapper, or null</p>


**Example**
```js
const wrapper = resolveWrapper(someProxy);
if (wrapper) wrapper.____slothletInternal.impl = newImpl;
```




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
  * [.generateTypes(api, options)](#at_cldmv_slash_slothlet_slash_processors_slash_type-generator_dot_generateTypes) ⇒ <code><code>Promise.&lt;{output: string, filePath: string}&gt;</code></code>





* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_type-generator"></a>

### @cldmv/slothlet/processors/type-generator
> <p><strong style="font-size: 1.1em;"><p>TypeScript declaration file (.d.ts) generation</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_type-generator_dot_generateTypes"></a>

### @cldmv/slothlet/processors/type-generator.generateTypes(api, options) ⇒ <code>Promise.&lt;{output: string, filePath: string}&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Generate TypeScript declaration file for a Slothlet API</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/processors/type-generator</code>](#at_cldmv_slash_slothlet_slash_processors_slash_type-generator)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| api | <code>object</code> |  | <p>The loaded Slothlet API</p> |
| options | <code>object</code> |  | <p>Generation options</p> |
| options.output | <code>string</code> |  | <p>Output file path for .d.ts</p> |
| options.interfaceName | <code>string</code> |  | <p>Name of the interface to generate</p> |
| [options.includeDocumentation] | <code>boolean</code> | <code>true</code> | <p>Include JSDoc comments</p> |


**Returns**:

- <code>Promise.&lt;{output: string, filePath: string}&gt;</code> <p>Generated declaration and output path</p>




<a id="at_cldmv_slash_slothlet_slash_processors_slash_typescript"></a>

## @cldmv/slothlet/processors/typescript
> <p><strong style="font-size: 1.1em;"><p>TypeScript file transformation using esbuild (fast mode)</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/processors/typescript](#at_cldmv_slash_slothlet_slash_processors_slash_typescript)
  * [.transformTypeScript(filePath, options)](#at_cldmv_slash_slothlet_slash_processors_slash_typescript_dot_transformTypeScript) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
  * [.createDataUrl(code)](#at_cldmv_slash_slothlet_slash_processors_slash_typescript_dot_createDataUrl) ⇒ <code><code>string</code></code>
  * [.transformTypeScriptStrict(filePath, options)](#at_cldmv_slash_slothlet_slash_processors_slash_typescript_dot_transformTypeScriptStrict) ⇒ <code><code>Promise.&lt;{code: string, diagnostics: Array.&lt;object&gt;}&gt;</code></code>





* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_typescript"></a>

### @cldmv/slothlet/processors/typescript
> <p><strong style="font-size: 1.1em;"><p>TypeScript file transformation using esbuild (fast mode)</p></strong></p>
> 

* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_typescript_dot_transformTypeScript"></a>

### @cldmv/slothlet/processors/typescript.transformTypeScript(filePath, options) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Transform TypeScript code to JavaScript using esbuild</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/processors/typescript</code>](#at_cldmv_slash_slothlet_slash_processors_slash_typescript)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | <code>string</code> |  | <p>Path to the TypeScript file</p> |
| [options] | <code>object</code> | <code>{}</code> | <p>esbuild transform options</p> |
| [options.target] | <code>string</code> |  | <p>ECMAScript target version (default: &quot;es2020&quot;)</p> |
| [options.format] | <code>string</code> |  | <p>Module format (default: &quot;esm&quot;)</p> |
| [options.sourcemap] | <code>boolean</code> |  | <p>Generate source maps (default: false)</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Transformed JavaScript code</p>


**Throws**:

- <code>SlothletError</code> <p>If transformation fails</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_typescript_dot_createDataUrl"></a>

### @cldmv/slothlet/processors/typescript.createDataUrl(code) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Create a data URL for dynamic import with cache busting</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/processors/typescript</code>](#at_cldmv_slash_slothlet_slash_processors_slash_typescript)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| code | <code>string</code> |  | <p>JavaScript code to encode</p> |


**Returns**:

- <code>string</code> <p>Data URL suitable for dynamic import</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_processors_slash_typescript_dot_transformTypeScriptStrict"></a>

### @cldmv/slothlet/processors/typescript.transformTypeScriptStrict(filePath, options) ⇒ <code>Promise.&lt;{code: string, diagnostics: Array.&lt;object&gt;}&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Transform TypeScript code to JavaScript using tsc with type checking</p></strong></p>
> 
**Kind**: static method of [<code>@cldmv/slothlet/processors/typescript</code>](#at_cldmv_slash_slothlet_slash_processors_slash_typescript)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | <code>string</code> |  | <p>Path to the TypeScript file</p> |
| [options] | <code>object</code> | <code>{}</code> | <p>TypeScript compiler options</p> |
| [options.target] | <code>string</code> |  | <p>ECMAScript target version (default: &quot;ES2020&quot;)</p> |
| [options.module] | <code>string</code> |  | <p>Module format (default: &quot;ESNext&quot;)</p> |
| [options.strict] | <code>boolean</code> |  | <p>Enable strict type checking (default: true)</p> |
| [options.skipTypeCheck] | <code>boolean</code> |  | <p>Skip type checking and only transform (default: false)</p> |
| [options.typeDefinitionPath] | <code>string</code> |  | <p>Path to .d.ts file for type checking</p> |


**Returns**:

- <code>Promise.&lt;{code: string, diagnostics: Array.&lt;object&gt;}&gt;</code> <p>Transformed code and type diagnostics</p>


**Throws**:

- <code>SlothletError</code> <p>If transformation fails</p>




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




<a id="at_cldmv_slash_slothlet_slash_lib_slash_builders_slash_api-assignment"></a>

## @cldmv/slothlet/lib/builders/api-assignment
> <p><strong style="font-size: 1.1em;"><p>This module provides a single source of truth for assigning values to API paths.
> Used by both initial API build (processFiles) and hot reload (mutateApiValue).</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/lib/builders/api-assignment](#at_cldmv_slash_slothlet_slash_lib_slash_builders_slash_api-assignment)


**Example**
```js
const assignment = new ApiAssignment(slothlet);
assignment.assignToApiPath(api, "math", mathWrapper, {});
```





* * *

<a id="at_cldmv_slash_slothlet_slash_lib_slash_builders_slash_api-assignment"></a>

### @cldmv/slothlet/lib/builders/api-assignment
> <p><strong style="font-size: 1.1em;"><p>This module provides a single source of truth for assigning values to API paths.
> Used by both initial API build (processFiles) and hot reload (mutateApiValue).</p></strong></p>
> 
**Example**
```js
const assignment = new ApiAssignment(slothlet);
assignment.assignToApiPath(api, "math", mathWrapper, {});
```






