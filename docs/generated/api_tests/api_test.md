<a id="api_test_slash_collision-math"></a>

## api\_test/collision-math
> <p><strong style="font-size: 1.1em;"><p>File-level collision test - collides with math/ folder.
> This file exports at the same path as the math/ folder, creating a collision.</p></strong></p>
> 


**Structure**

[api_test/collision-math](#api_test_slash_collision-math)
  * [.add(a, b)](#api_test_slash_collision-math_dot_add) ⇒ <code><code>number</code></code>


**Exported Constants**

  * [api_test/collision-math.collisionVersion](#api_test_slash_collision-math_dot_collisionVersion) ⇒ <code>string</code>





* * *

<a id="api_test_slash_collision-math"></a>

### api_test/collision-math
> <p><strong style="font-size: 1.1em;"><p>File-level collision test - collides with math/ folder.
> This file exports at the same path as the math/ folder, creating a collision.</p></strong></p>
> 

* * *

<a id="api_test_slash_collision-math_dot_add"></a>

### api_test/collision-math.add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Alternative math implementation that collides with math/ folder.</p></strong></p>
> 
**Kind**: static method of [<code>api_test/collision-math</code>](#api_test_slash_collision-math)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number.</p> |
| b | <code>number</code> |  | <p>Second number.</p> |


**Returns**:

- <code>number</code> <p>Sum of the two numbers.</p>



* * *

<a id="api_test_slash_collision-math_dot_collisionVersion"></a>

### api_test/collision-math.collisionVersion
> <p><strong style="font-size: 1.1em;"><p>Version identifier for collision detection.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test/collision-math</code>](#api_test_slash_collision-math)



<a id="api_test_slash_task_slash_sync-throw"></a>

## api\_test/task/sync-throw
> <p><strong style="font-size: 1.1em;"><p>Synchronous function that always throws.
> Used to test the synchronous error suppression path in the apply trap.</p></strong></p>
> 


**Structure**

[api_test/task/sync-throw](#api_test_slash_task_slash_sync-throw)
  * [.module](#api_test_slash_task_slash_sync-throw_dot_module)
    * [.module.exports(message)](#api_test_slash_task_slash_sync-throw) ⇒ <code><code>never</code></code>





* * *

<a id="api_test_slash_task_slash_sync-throw"></a>

### api_test/task/sync-throw
> <p><strong style="font-size: 1.1em;"><p>Synchronous function that always throws.
> Used to test the synchronous error suppression path in the apply trap.</p></strong></p>
> 

* * *

<a id="api_test_slash_task_slash_sync-throw_dot_module"></a>

### api_test/task/sync-throw.module
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for module components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test/task/sync-throw</code>](#api_test_slash_task_slash_sync-throw)


* * *

<a id="api_test_slash_task_slash_sync-throw"></a>

### api_test/task/sync-throw.module.exports(message) ⇒ <code>never</code>
> <p><strong style="font-size: 1.1em;"><p>Synchronous function that always throws an error.
> Used to exercise the catch block in the apply trap (unified-wrapper lines ~2691-2713).</p></strong></p>
> 
**Kind**: static method of [<code>api_test/task/sync-throw</code>](#api_test_slash_task_slash_sync-throw)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [message] | <code>string</code> | <code>"sync-threw"</code> | <p>Custom error message.</p> |


**Returns**:

- <code>never</code> <p>Always throws.</p>


**Example**
```js
// Expect this to throw when called without suppressErrors
api.task.syncThrow();
```




<a id="api_tests_slash_api_test_slash_async-test"></a>

## api\_tests/api\_test/async-test
> <p><strong style="font-size: 1.1em;"><p>Async API module for hook coverage tests.</p>
> <p>Provides genuinely async functions (returning Promises) so that the
> unified-wrapper's <code>.then()</code> async result branch is exercised. This is
> needed to reach line 2644 (suppressErrors inside the async after-hook
> error handler), which only fires when:</p>
> <ol>
> <li>The function returns a Promise that resolves successfully.</li>
> <li>An after-hook throws during the <code>.then()</code> success handler.</li>
> <li><code>config.hook.suppressErrors === true</code>.</li>
> </ol></strong></p>
> 


**Structure**

[api_tests/api_test/async-test](#api_tests_slash_api_test_slash_async-test)
  * [.asyncAdd(a, b)](#api_tests_slash_api_test_slash_async-test_dot_asyncAdd) ⇒ <code><code>Promise.&lt;number&gt;</code></code>
  * [.asyncEcho(value)](#api_tests_slash_api_test_slash_async-test_dot_asyncEcho) ⇒ <code><code>Promise.&lt;string&gt;</code></code>





* * *

<a id="api_tests_slash_api_test_slash_async-test"></a>

### api_tests/api_test/async-test
> <p><strong style="font-size: 1.1em;"><p>Async API module for hook coverage tests.</p>
> <p>Provides genuinely async functions (returning Promises) so that the
> unified-wrapper's <code>.then()</code> async result branch is exercised. This is
> needed to reach line 2644 (suppressErrors inside the async after-hook
> error handler), which only fires when:</p>
> <ol>
> <li>The function returns a Promise that resolves successfully.</li>
> <li>An after-hook throws during the <code>.then()</code> success handler.</li>
> <li><code>config.hook.suppressErrors === true</code>.</li>
> </ol></strong></p>
> 

* * *

<a id="api_tests_slash_api_test_slash_async-test_dot_asyncAdd"></a>

### api_tests/api_test/async-test.asyncAdd(a, b) ⇒ <code>Promise.&lt;number&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Async addition — returns a resolved Promise so the unified-wrapper
> enters the <code>result.then(...)</code> async path.</p></strong></p>
> 
**Kind**: static method of [<code>api_tests/api_test/async-test</code>](#api_tests_slash_api_test_slash_async-test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First operand.</p> |
| b | <code>number</code> |  | <p>Second operand.</p> |


**Returns**:

- <code>Promise.&lt;number&gt;</code> <p>Resolved sum.</p>


**Example**
```js
await asyncAdd(2, 3); // 5
```



* * *

<a id="api_tests_slash_api_test_slash_async-test_dot_asyncEcho"></a>

### api_tests/api_test/async-test.asyncEcho(value) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Async string echo — supplements asyncAdd for broader async hook coverage.</p></strong></p>
> 
**Kind**: static method of [<code>api_tests/api_test/async-test</code>](#api_tests_slash_api_test_slash_async-test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>string</code> |  | <p>Value to echo back.</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>The same value.</p>


**Example**
```js
await asyncEcho("hello"); // "hello"
```







* * *

## Type Definitions

<a id="typedef_NetServer"></a>

### NetServer : <code>object</code>
<p>A Node.js TCP server instance (net.Server).</p>

**Kind**: typedef  
**Scope**: global


* * *


