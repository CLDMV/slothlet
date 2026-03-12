<a id="api_test"></a>

## @cldmv/slothlet/api\_tests/api\_test
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities with ESM modules. It includes math operations, configuration management, advanced nested structures, and various export patterns for comprehensive API testing.</p>
> 


**Structure**

[api_test(name)](#api_test) ⇒ <code>string</code>
  * [.advanced](#api_test_dot_advanced)
    * [.selfObject](#api_test_dot_advanced_dot_selfObject)
      * [.addViaSelf(a, b)](#api_test_dot_advanced_dot_selfObject_dot_addViaSelf) ⇒ <code>number</code>
      * [.getCurrentInstanceId()](#api_test_dot_advanced_dot_selfObject_dot_getCurrentInstanceId) ⇒ <code>string</code>
  * [.asyncTest](#api_test_dot_asyncTest)
    * [.asyncAdd(a, b)](#api_test_dot_asyncTest_dot_asyncAdd) ⇒ <code>Promise.&lt;number&gt;</code>
    * [.asyncEcho(value)](#api_test_dot_asyncTest_dot_asyncEcho) ⇒ <code>Promise.&lt;string&gt;</code>
  * [.callerTest](#api_test_dot_callerTest)
    * [.getCallerMeta()](#api_test_dot_callerTest_dot_getCallerMeta) ⇒ <code>object | null</code>
  * [config](#api_test_dot_config)
  * [.conflictingName1](#api_test_dot_conflictingName1)
    * [.conflictingName()](#api_test_dot_conflictingName1_dot_conflictingName) ⇒ <code>*</code>
  * [.conflictingName2](#api_test_dot_conflictingName2)
    * [.conflictingName()](#api_test_dot_conflictingName2_dot_conflictingName) ⇒ <code>*</code>
  * [.createTestService](#api_test_dot_createTestService)
    * [.createTestService(name)](#api_test_dot_createTestService) ⇒ <code>*</code>
  * [.exportDefault](#api_test_dot_exportDefault)
    * [.extra()](#api_test_dot_exportDefault_dot_extra) ⇒ <code>string</code>
  * [.funcmod(name)](#api_test_funcmod) ⇒ <code>string</code>
  * [.isolationTest](#api_test_dot_isolationTest)
    * [.isolationTestState](#api_test_dot_isolationTest_dot_isolationTestState)
    * [.isolationTest_getValue()](#api_test_dot_isolationTest_dot_isolationTest_getValue) ⇒ <code>*</code>
    * [.isolationTest_setValue(newValue)](#api_test_dot_isolationTest_dot_isolationTest_setValue) ⇒ <code>*</code>
    * [.isolationTest_increment()](#api_test_dot_isolationTest_dot_isolationTest_increment) ⇒ <code>*</code>
    * [.isolationTest_getCounter()](#api_test_dot_isolationTest_dot_isolationTest_getCounter) ⇒ <code>*</code>
    * [.isolationTest_setFlag(flag)](#api_test_dot_isolationTest_dot_isolationTest_setFlag) ⇒ <code>*</code>
    * [.isolationTest_getFlag()](#api_test_dot_isolationTest_dot_isolationTest_getFlag) ⇒ <code>*</code>
  * [.logger(message)](#api_test_logger) ⇒ <code>string</code>
    * [.utils](#api_test_dot_logger_utils)
      * [.debug(message)](#api_test_dot_logger_dot_utils_dot_debug) ⇒ <code>string</code>
      * [.error(message)](#api_test_dot_logger_dot_utils_dot_error) ⇒ <code>string</code>
  * [math](#api_test_dot_math)
    * [.add(a, b)](#api_test_dot_math_dot_add) ⇒ <code>number</code>
    * [.collisionVersion](#api_test_dot_math_dot_collisionVersion)
    * [.multiply(a, b)](#api_test_dot_math_dot_multiply) ⇒ <code>number</code>
    * [.divide(a, b)](#api_test_dot_math_dot_divide) ⇒ <code>number</code>
  * [.metadataTestHelper](#api_test_dot_metadataTestHelper)
    * [.getMetadata(path)](#api_test_dot_metadataTestHelper_dot_getMetadata) ⇒ <code>Promise.&lt;(object|null)&gt;</code>
    * [.getSelfMetadata()](#api_test_dot_metadataTestHelper_dot_getSelfMetadata) ⇒ <code>Promise.&lt;(object|null)&gt;</code>
    * [.testCaller()](#api_test_dot_metadataTestHelper_dot_testCaller) ⇒ <code>Promise.&lt;object&gt;</code>
    * [.verifyMetadata(path)](#api_test_dot_metadataTestHelper_dot_verifyMetadata) ⇒ <code>Promise.&lt;object&gt;</code>
    * [.invokeCallerTest()](#api_test_dot_metadataTestHelper_dot_invokeCallerTest) ⇒ <code>Promise.&lt;(object|null)&gt;</code>
  * [.mixed(message)](#api_test_mixed) ⇒ <code>string</code>
    * [.mixedNamed(value)](#api_test_dot_mixed_dot_mixedNamed) ⇒ <code>string</code>
    * [.mixedAnother(num)](#api_test_dot_mixed_dot_mixedAnother) ⇒ <code>number</code>
  * [multi_func](#api_test_dot_multi_func)
    * [.uniqueOne(msg)](#api_test_dot_multi_func_dot_uniqueOne) ⇒ <code>string</code>
    * [.uniqueTwo(msg)](#api_test_dot_multi_func_dot_uniqueTwo) ⇒ <code>string</code>
    * [.uniqueThree(msg)](#api_test_dot_multi_func_dot_uniqueThree) ⇒ <code>string</code>
    * [.multi_func_hello()](#api_test_dot_multi_func_dot_multi_func_hello) ⇒ <code>string</code>
  * [.objectDefaultMethod](#api_test_dot_objectDefaultMethod)
    * [.default(message, level)](#api_test_dot_objectDefaultMethod_dot_default) ⇒ <code>string</code>
    * [.info(message)](#api_test_dot_objectDefaultMethod_dot_info) ⇒ <code>string</code>
    * [.warn(message)](#api_test_dot_objectDefaultMethod_dot_warn) ⇒ <code>string</code>
    * [.error(message)](#api_test_dot_objectDefaultMethod_dot_error) ⇒ <code>string</code>
  * [.overwriteTest1](#api_test_dot_overwriteTest1)
    * [.overwriteTest()](#api_test_dot_overwriteTest1_dot_overwriteTest) ⇒ <code>*</code>
    * [.conflictingName()](#api_test_dot_overwriteTest1_dot_conflictingName) ⇒ <code>*</code>
  * [.overwriteTest2](#api_test_dot_overwriteTest2)
    * [.overwriteTest()](#api_test_dot_overwriteTest2_dot_overwriteTest) ⇒ <code>*</code>
    * [.conflictingName()](#api_test_dot_overwriteTest2_dot_conflictingName) ⇒ <code>*</code>
  * [.requestContext](#api_test_dot_requestContext)
  * [.rootFunction](#api_test_dot_rootFunction)
    * [.greet(name)](#api_test_dot_rootFunction_dot_greet) ⇒ <code>string</code>
  * [.rootFunctionShout(name)](#api_test_dot_rootFunctionShout) ⇒ <code>string</code>
  * [.rootFunctionWhisper(name)](#api_test_dot_rootFunctionWhisper) ⇒ <code>string</code>
  * [.rootMath](#api_test_dot_rootMath)
    * [.add(a, b)](#api_test_dot_rootMath_dot_add) ⇒ <code>number</code>
    * [.multiply(a, b)](#api_test_dot_rootMath_dot_multiply) ⇒ <code>number</code>
  * [rootstring](#api_test_dot_rootstring)
    * [.upper(str)](#api_test_dot_rootstring_dot_upper) ⇒ <code>string</code>
    * [.reverse(str)](#api_test_dot_rootstring_dot_reverse) ⇒ <code>string</code>
  * [.runtimeTest](#api_test_dot_runtimeTest)
    * [.verifyRuntime()](#api_test_dot_runtimeTest_dot_verifyRuntime) ⇒ <code>object</code>
    * [.testSelfCrossCall(a, b)](#api_test_dot_runtimeTest_dot_testSelfCrossCall) ⇒ <code>object</code>
    * [.testContextIsolation()](#api_test_dot_runtimeTest_dot_testContextIsolation) ⇒ <code>object</code>
    * [.testPerformance()](#api_test_dot_runtimeTest_dot_testPerformance) ⇒ <code>object</code>
    * [.comprehensiveRuntimeTest()](#api_test_dot_runtimeTest_dot_comprehensiveRuntimeTest) ⇒ <code>object</code>
    * [.testSelfAndReference()](#api_test_dot_runtimeTest_dot_testSelfAndReference) ⇒ <code>object</code>
    * [.getAsyncInstanceID()](#api_test_dot_runtimeTest_dot_getAsyncInstanceID) ⇒ <code>Object</code>
    * [.exerciseContextDispatcherTraps()](#api_test_dot_runtimeTest_dot_exerciseContextDispatcherTraps) ⇒ <code>Object</code>
    * [.exerciseInstanceIDDispatcherTraps()](#api_test_dot_runtimeTest_dot_exerciseInstanceIDDispatcherTraps) ⇒ <code>Object</code>
    * [.exerciseAsyncContextWriteTraps()](#api_test_dot_runtimeTest_dot_exerciseAsyncContextWriteTraps) ⇒ <code>Object</code>
  * [.string](#api_test_dot_string)
    * [.upper(str)](#api_test_dot_string_dot_upper) ⇒ <code>string</code>
    * [.reverse(str)](#api_test_dot_string_dot_reverse) ⇒ <code>string</code>
  * [.task](#api_test_dot_task)
    * [.autoIP()](#api_test_dot_task_dot_autoIP) ⇒ <code>Promise.&lt;string&gt;</code>
  * [tcp](#api_test_dot_tcp)
    * [.testContext()](#api_test_dot_tcp_dot_testContext) ⇒ <code>object</code>
    * [.createTestServer(port)](#api_test_dot_tcp_dot_createTestServer) ⇒ <code>Promise.&lt;{port: number, server: NetServer}&gt;</code>
  * [.util](#api_test_dot_util)
    * [.controller](#api_test_dot_util_dot_controller)
      * [.getDefault()](#api_test_dot_util_dot_controller_dot_getDefault) ⇒ <code>string</code>
      * [.detectEndpointType()](#api_test_dot_util_dot_controller_dot_detectEndpointType) ⇒ <code>string</code>
      * [.detectDeviceType()](#api_test_dot_util_dot_controller_dot_detectDeviceType) ⇒ <code>string</code>
    * [.extract](#api_test_dot_util_dot_extract)
      * [.data()](#api_test_dot_util_dot_extract_dot_data) ⇒ <code>string</code>
      * [.section()](#api_test_dot_util_dot_extract_dot_section) ⇒ <code>string</code>
      * [.NVRSection()](#api_test_dot_util_dot_extract_dot_NVRSection) ⇒ <code>string</code>
      * [.parseDeviceName()](#api_test_dot_util_dot_extract_dot_parseDeviceName) ⇒ <code>string</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
```





* * *

<a id="api_test"></a>

### api_test(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Greets a name (default export).
> This is the main callable API function.
> Accessed as <code>api()</code> in the slothlet API.</p></strong></p>
> 

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Name to greet</p> |


**Returns**:

- <code>string</code> <p>Greeting message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
```



* * *

<a id="api_test_dot_advanced"></a>

### api_test.advanced
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for advanced components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_advanced_dot_selfObject"></a>

### api_test.advanced.selfObject
> <p><strong style="font-size: 1.1em;"><p>Advanced API module for testing slothlet loader self-reference functionality.
> Provides methods to test live-binding of self object properties.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.advanced</code>](#api_test_dot_advanced)

**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
```



* * *

<a id="api_test_dot_advanced_dot_selfObject_dot_addViaSelf"></a>

### api_test.advanced.selfObject.addViaSelf(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers using live-binding through self.math.add reference.
> Tests that self-references work correctly in the slothlet loader system.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.advanced.selfObject</code>](#api_test_dot_advanced_dot_selfObject)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>The first number to add.</p> |
| b | <code>number</code> |  | <p>The second number to add.</p> |


**Returns**:

- <code>number</code> <p>The sum of a and b, or NaN if self.math.add is not available.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
```



* * *

<a id="api_test_dot_advanced_dot_selfObject_dot_getCurrentInstanceId"></a>

### api_test.advanced.selfObject.getCurrentInstanceId() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current instance ID using the runtime system.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.advanced.selfObject</code>](#api_test_dot_advanced_dot_selfObject)

**Returns**:

- <code>string</code> <p>The current instance ID
*</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.advanced.self-object.getCurrentInstanceId();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.advanced.self-object.getCurrentInstanceId();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.advanced.self-object.getCurrentInstanceId();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.advanced.self-object.getCurrentInstanceId();
```



* * *

<a id="api_test_dot_asyncTest"></a>

### api_test.asyncTest
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_asyncTest_dot_asyncAdd"></a>

### api_test.asyncTest.asyncAdd(a, b) ⇒ <code>Promise.&lt;number&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Async addition — returns a resolved Promise so the unified-wrapper
> enters the <code>result.then(...)</code> async path.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.asyncTest</code>](#api_test_dot_asyncTest)


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.async-await test.asyncAdd(1, 1);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.async-await test.asyncAdd(1, 1);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.async-await test.asyncAdd(1, 1);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.async-await test.asyncAdd(1, 1);
```



* * *

<a id="api_test_dot_asyncTest_dot_asyncEcho"></a>

### api_test.asyncTest.asyncEcho(value) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Async string echo — supplements asyncAdd for broader async hook coverage.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.asyncTest</code>](#api_test_dot_asyncTest)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>string</code> |  | <p>Value to echo back.</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>The same value.</p>


**Example**
```js
await asyncEcho("hello"); // "hello"
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.async-await test.asyncEcho('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.async-await test.asyncEcho('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.async-await test.asyncEcho('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.async-await test.asyncEcho('value');
```



* * *

<a id="api_test_dot_callerTest"></a>

### api_test.callerTest
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_callerTest_dot_getCallerMeta"></a>

### api_test.callerTest.getCallerMeta() ⇒ <code>object | null</code>
> <p><strong style="font-size: 1.1em;"><p>Returns the metadata of the slothlet function that invoked this function.</p>
> <p>Uses self.slothlet.metadata.caller() to read the callerWrapper from the
> active context-manager store. Returns null when called directly from
> outside any tracked slothlet execution (no caller in context).</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.callerTest</code>](#api_test_dot_callerTest)

**Returns**:

- <code>object \| null</code> <p>Metadata of the calling slothlet function, or null</p>


**Example**
```js
// Called directly — no tracked caller
const result = api.callerTest.getCallerMeta(); // → null
```
**Example**
```js
// Called from another slothlet function via self
const result = await api.metadataTestHelper.invokeCallerTest(); // → metadata object
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.caller-test.getCallerMeta();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.caller-test.getCallerMeta();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.caller-test.getCallerMeta();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.caller-test.getCallerMeta();
```



* * *

<a id="api_test_dot_config"></a>

### api_test.config
> <p><strong style="font-size: 1.1em;"><p>Default configuration object for testing API modules.
> Contains sample connection parameters and settings used across test modules.
> Accessed as <code>api.config</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)

**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.config.host); // "https://slothlet"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.config.host); // "https://slothlet"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.config.host); // "https://slothlet"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.config.host); // "https://slothlet"
```



* * *

<a id="api_test_dot_conflictingName1"></a>

### api_test.conflictingName1
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_conflictingName1_dot_conflictingName"></a>

### api_test.conflictingName1.conflictingName() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>conflictingName.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.conflictingName1</code>](#api_test_dot_conflictingName1)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.conflicting-name-1.conflictingName();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.conflicting-name-1.conflictingName();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.conflicting-name-1.conflictingName();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.conflicting-name-1.conflictingName();
```



* * *

<a id="api_test_dot_conflictingName2"></a>

### api_test.conflictingName2
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_conflictingName2_dot_conflictingName"></a>

### api_test.conflictingName2.conflictingName() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>conflictingName.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.conflictingName2</code>](#api_test_dot_conflictingName2)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.conflicting-name-2.conflictingName();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.conflicting-name-2.conflictingName();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.conflicting-name-2.conflictingName();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.conflicting-name-2.conflictingName();
```



* * *

<a id="api_test_dot_createTestService"></a>

### api_test.createTestService
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_createTestService"></a>

### api_test.createTestService.createTestService(name) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>createTestService.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.createTestService.createTestService</code>](#api_test_dot_createTestService)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>*</code> |  | <p>name.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.create-test-service.createTestService('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.create-test-service.createTestService('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.create-test-service.createTestService('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.create-test-service.createTestService('myName');
```



* * *

<a id="api_test_dot_exportDefault"></a>

### api_test.exportDefault
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_exportDefault_dot_extra"></a>

### api_test.exportDefault.extra() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Extra method attached to the default export function.
> This tests how slothlet handles function properties.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.exportDefault</code>](#api_test_dot_exportDefault)

**Returns**:

- <code>string</code> <p>Extra method message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
```



* * *

<a id="api_test_funcmod"></a>

### api_test.funcmod(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Main callable function for the funcmod module.
> Accessed as <code>api.funcmod(name)</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test</code>](#api_test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Name to use in greeting</p> |


**Returns**:

- <code>string</code> <p>Greeting message</p>


**Example**
```js
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.funcmod('World')); // 'Hello, World!'
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.funcmod.funcmod('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.funcmod.funcmod('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.funcmod.funcmod('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.funcmod.funcmod('myName');
```



* * *

<a id="api_test_dot_isolationTest"></a>

### api_test.isolationTest
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_isolationTest_dot_isolationTestState"></a>

### api_test.isolationTest.isolationTestState
> <p><strong style="font-size: 1.1em;"><p>Exported state object for testing isolation
> In partial mode: shared reference (mutations persist)
> In full mode: deep cloned (mutations don't persist)</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.isolationTest</code>](#api_test_dot_isolationTest)


* * *

<a id="api_test_dot_isolationTest_dot_isolationTest_getValue"></a>

### api_test.isolationTest.isolationTest_getValue() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isolationTest_getValue.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.isolationTest</code>](#api_test_dot_isolationTest)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_getValue();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_getValue();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_getValue();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_getValue();
```



* * *

<a id="api_test_dot_isolationTest_dot_isolationTest_setValue"></a>

### api_test.isolationTest.isolationTest_setValue(newValue) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isolationTest_setValue.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.isolationTest</code>](#api_test_dot_isolationTest)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| newValue | <code>*</code> |  | <p>newValue.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_setValue(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_setValue(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_setValue(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_setValue(null);
```



* * *

<a id="api_test_dot_isolationTest_dot_isolationTest_increment"></a>

### api_test.isolationTest.isolationTest_increment() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isolationTest_increment.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.isolationTest</code>](#api_test_dot_isolationTest)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_increment();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_increment();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_increment();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_increment();
```



* * *

<a id="api_test_dot_isolationTest_dot_isolationTest_getCounter"></a>

### api_test.isolationTest.isolationTest_getCounter() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isolationTest_getCounter.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.isolationTest</code>](#api_test_dot_isolationTest)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_getCounter();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_getCounter();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_getCounter();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_getCounter();
```



* * *

<a id="api_test_dot_isolationTest_dot_isolationTest_setFlag"></a>

### api_test.isolationTest.isolationTest_setFlag(flag) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isolationTest_setFlag.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.isolationTest</code>](#api_test_dot_isolationTest)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| flag | <code>*</code> |  | <p>flag.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_setFlag(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_setFlag(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_setFlag(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_setFlag(null);
```



* * *

<a id="api_test_dot_isolationTest_dot_isolationTest_getFlag"></a>

### api_test.isolationTest.isolationTest_getFlag() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isolationTest_getFlag.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.isolationTest</code>](#api_test_dot_isolationTest)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_getFlag();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_getFlag();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.isolation-test.isolationTest_getFlag();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.isolation-test.isolationTest_getFlag();
```



* * *

<a id="api_test_logger"></a>

### api_test.logger(message) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Main callable log function for the logger module.
> Accessed as <code>api.logger(message)</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test</code>](#api_test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Message to log</p> |


**Returns**:

- <code>string</code> <p>Formatted log string with ISO timestamp</p>


**Example**
```js
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.logger('hello')); // '[LOG] 2026-...: hello'
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.logger.logger('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.logger.logger('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.logger.logger('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.logger.logger('value');
```



* * *

<a id="api_test_dot_logger_utils"></a>

### utils
> 
**Kind**: inner namespace


* * *

<a id="api_test_dot_logger_dot_utils_dot_debug"></a>

### debug(message) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Debug level logging.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Debug message</p> |


**Returns**:

- <code>string</code> <p>Formatted debug message</p>


**Example**
```js
utils.debug("loaded"); // "[DEBUG] 2026-...: loaded"
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.logger.utils.debug('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.logger.utils.debug('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.logger.utils.debug('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.logger.utils.debug('value');
```



* * *

<a id="api_test_dot_logger_dot_utils_dot_error"></a>

### error(message) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Error level logging</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Error message</p> |


**Returns**:

- <code>string</code> <p>Formatted error message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.logger.utils.error('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.logger.utils.error('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.logger.utils.error('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.logger.utils.error('value');
```



* * *

<a id="api_test_dot_math"></a>

### api_test.math
> <p><strong style="font-size: 1.1em;"><p>Math API object with basic arithmetic operations for testing auto-flattening.
> This module tests slothlet's ability to flatten single-file folder structures.
> Accessed as <code>api.math</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)

**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(2, 3)); // 6
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(2, 3)); // 6
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(2, 3)); // 6
```



* * *

<a id="api_test_dot_math_dot_add"></a>

### api_test.math.add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers together with a +1000 offset.
> This implementation is the <strong>winning</strong> side of a file-vs-folder collision that
> tests slothlet's default collision resolution. The offset distinguishes this
> implementation from the folder module's plain <code>a + b</code> version at runtime.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.math</code>](#api_test_dot_math)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to add.</p> |
| b | <code>number</code> |  | <p>Second number to add.</p> |


**Returns**:

- <code>number</code> <p>The sum of <code>a</code> and <code>b</code> plus 1000.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
```



* * *

<a id="api_test_dot_math_dot_collisionVersion"></a>

### api_test.math.collisionVersion
> <p><strong style="font-size: 1.1em;"><p>Version identifier for collision detection.
> Merged into <code>api.math</code> alongside <code>multiply</code> and <code>divide</code> from the <code>math/</code> folder.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.math</code>](#api_test_dot_math)


* * *

<a id="api_test_dot_math_dot_multiply"></a>

### api_test.math.multiply(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Multiplies two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.math</code>](#api_test_dot_math)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to multiply</p> |
| b | <code>number</code> |  | <p>Second number to multiply</p> |


**Returns**:

- <code>number</code> <p>The product of a and b</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```



* * *

<a id="api_test_dot_math_dot_divide"></a>

### api_test.math.divide(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Divides two numbers.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.math</code>](#api_test_dot_math)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>Numerator</p> |
| b | <code>number</code> |  | <p>Denominator</p> |


**Returns**:

- <code>number</code> <p>The quotient of a divided by b</p>


**Throws**:

- <code>Error</code> <p>If denominator is zero</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.divide(10, 2)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.divide(10, 2)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.divide(10, 2)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.divide(10, 2)); // 5
```



* * *

<a id="api_test_dot_metadataTestHelper"></a>

### api_test.metadataTestHelper
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_metadataTestHelper_dot_getMetadata"></a>

### api_test.metadataTestHelper.getMetadata(path) ⇒ <code>Promise.&lt;(object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>This function runs inside the slothlet API context where runtime.self
> is available, allowing self.slothlet.metadata.get() to access the API root.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.metadataTestHelper</code>](#api_test_dot_metadataTestHelper)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| path | <code>string</code> |  | <p>Dot-notation path to function</p> |


**Returns**:

- <code>Promise.&lt;(object\|null)&gt;</code> <p>Metadata object or null</p>


**Example**
```js
// From test file
const meta = await api.metadataTestHelper.getMetadata("plugins.mathEsm.add");
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.getMetadata('./file.mjs');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.getMetadata('./file.mjs');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.getMetadata('./file.mjs');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.getMetadata('./file.mjs');
```



* * *

<a id="api_test_dot_metadataTestHelper_dot_getSelfMetadata"></a>

### api_test.metadataTestHelper.getSelfMetadata() ⇒ <code>Promise.&lt;(object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Returns the metadata of this helper function itself, demonstrating
> that self.slothlet.metadata.self() works within the slothlet context.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.metadataTestHelper</code>](#api_test_dot_metadataTestHelper)

**Returns**:

- <code>Promise.&lt;(object\|null)&gt;</code> <p>This function's metadata or null</p>


**Example**
```js
// From test file
const meta = await api.metadataTestHelper.getSelfMetadata();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.getSelfMetadata();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.getSelfMetadata();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.getSelfMetadata();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.getSelfMetadata();
```



* * *

<a id="api_test_dot_metadataTestHelper_dot_testCaller"></a>

### api_test.metadataTestHelper.testCaller() ⇒ <code>Promise.&lt;object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>This function calls an inner function which checks its caller's metadata
> using self.slothlet.metadata.caller(). Used to test the caller tracking functionality.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.metadataTestHelper</code>](#api_test_dot_metadataTestHelper)

**Returns**:

- <code>Promise.&lt;object&gt;</code> <p>Object with caller metadata and test results</p>


**Example**
```js
// From test file
const result = await api.metadataTestHelper.testCaller();
console.log(result.callerMeta); // Should show testCaller's metadata
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.testCaller();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.testCaller();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.testCaller();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.testCaller();
```



* * *

<a id="api_test_dot_metadataTestHelper_dot_verifyMetadata"></a>

### api_test.metadataTestHelper.verifyMetadata(path) ⇒ <code>Promise.&lt;object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Checks if a function exists and has the expected metadata properties.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.metadataTestHelper</code>](#api_test_dot_metadataTestHelper)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| path | <code>string</code> |  | <p>Dot-notation path to function</p> |


**Returns**:

- <code>Promise.&lt;object&gt;</code> <p>Verification results</p>


**Example**
```js
// From test file
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
```



* * *

<a id="api_test_dot_metadataTestHelper_dot_invokeCallerTest"></a>

### api_test.metadataTestHelper.invokeCallerTest() ⇒ <code>Promise.&lt;(object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Invokes callerTest.getCallerMeta() via the slothlet runtime self binding.</p>
> <p>When callerTest.getCallerMeta() executes, the context manager's callerWrapper
> is set to this function's wrapper. So caller() inside getCallerMeta returns
> this function's metadata (system metadata from metadata-test-helper.mjs).</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.metadataTestHelper</code>](#api_test_dot_metadataTestHelper)

**Returns**:

- <code>Promise.&lt;(object\|null)&gt;</code> <p>Metadata of this function as seen by the callee</p>


**Example**
```js
const meta = await api.metadataTestHelper.invokeCallerTest();
console.log(meta.filePath); // → path to metadata-test-helper.mjs
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.invokeCallerTest();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.invokeCallerTest();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.metadata-test-await helper.invokeCallerTest();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.metadata-test-await helper.invokeCallerTest();
```



* * *

<a id="api_test_mixed"></a>

### api_test.mixed(message) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Default callable function for the mixed module.
> Accessed as <code>api.mixed(message)</code> in the slothlet API.
> Demonstrates Rule 8 Pattern B: filename matches folder with mixed default+named exports.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test</code>](#api_test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Message to process</p> |


**Returns**:

- <code>string</code> <p>Processed message string</p>


**Example**
```js
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.mixed('hello')); // 'Mixed default: hello'
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.mixed.mixed('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.mixed.mixed('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.mixed.mixed('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.mixed.mixed('value');
```



* * *

<a id="api_test_dot_mixed_dot_mixedNamed"></a>

### mixedNamed(value) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Named function for mixed export test.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>string</code> |  | <p>Value to process</p> |


**Returns**:

- <code>string</code> <p>Processed value</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.mixed.mixedNamed('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.mixed.mixedNamed('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.mixed.mixedNamed('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.mixed.mixedNamed('value');
```



* * *

<a id="api_test_dot_mixed_dot_mixedAnother"></a>

### mixedAnother(num) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Another named function for mixed export test.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| num | <code>number</code> |  | <p>Number to process</p> |


**Returns**:

- <code>number</code> <p>Processed number</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.mixed.mixedAnother(1);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.mixed.mixedAnother(1);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.mixed.mixedAnother(1);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.mixed.mixedAnother(1);
```



* * *

<a id="api_test_dot_multi_func"></a>

### api_test.multi_func
> <p><strong style="font-size: 1.1em;"><p>Multi-function object with test methods.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_multi_func_dot_uniqueOne"></a>

### api_test.multi_func.uniqueOne(msg) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a uniqueOne message.
> Accessed as <code>api.multiFunc.uniqueOne()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.multi_func</code>](#api_test_dot_multi_func)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| msg | <code>string</code> |  | <p>Message to include.</p> |


**Returns**:

- <code>string</code> <p>Formatted message with uniqueOne prefix.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
```



* * *

<a id="api_test_dot_multi_func_dot_uniqueTwo"></a>

### api_test.multi_func.uniqueTwo(msg) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a uniqueTwo message.
> Accessed as <code>api.multiFunc.uniqueTwo()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.multi_func</code>](#api_test_dot_multi_func)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| msg | <code>string</code> |  | <p>Message to include.</p> |


**Returns**:

- <code>string</code> <p>Formatted message with uniqueTwo prefix.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
```



* * *

<a id="api_test_dot_multi_func_dot_uniqueThree"></a>

### api_test.multi_func.uniqueThree(msg) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a uniqueThree message.
> Accessed as <code>api.multiFunc.uniqueThree()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.multi_func</code>](#api_test_dot_multi_func)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| msg | <code>string</code> |  | <p>Message to include.</p> |


**Returns**:

- <code>string</code> <p>Formatted message with uniqueThree prefix.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
```



* * *

<a id="api_test_dot_multi_func_dot_multi_func_hello"></a>

### api_test.multi_func.multi_func_hello() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a test string.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.multi_func</code>](#api_test_dot_multi_func)

**Returns**:

- <code>string</code> <p>The string &quot;beta hello&quot;</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
```



* * *

<a id="api_test_dot_objectDefaultMethod"></a>

### api_test.objectDefaultMethod
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_objectDefaultMethod_dot_default"></a>

### api_test.objectDefaultMethod.default(message, level) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Default method for objectDefaultMethod. Calls the named method based on level.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.objectDefaultMethod</code>](#api_test_dot_objectDefaultMethod)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Message to log.</p> |
| [level] | <code>string</code> | <code>"info"</code> | <p>Level to use ('info', 'warn', 'error').</p> |


**Returns**:

- <code>string</code> <p>Formatted message with appropriate level prefix</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
  console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
  console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
```



* * *

<a id="api_test_dot_objectDefaultMethod_dot_info"></a>

### api_test.objectDefaultMethod.info(message) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Info method for objectDefaultMethod.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.objectDefaultMethod</code>](#api_test_dot_objectDefaultMethod)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Message to log.</p> |


**Returns**:

- <code>string</code> <p>Formatted message with INFO prefix</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
```



* * *

<a id="api_test_dot_objectDefaultMethod_dot_warn"></a>

### api_test.objectDefaultMethod.warn(message) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Warn method for objectDefaultMethod.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.objectDefaultMethod</code>](#api_test_dot_objectDefaultMethod)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Message to log.</p> |


**Returns**:

- <code>string</code> <p>Formatted message with WARN prefix</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
```



* * *

<a id="api_test_dot_objectDefaultMethod_dot_error"></a>

### api_test.objectDefaultMethod.error(message) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Error method for objectDefaultMethod.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.objectDefaultMethod</code>](#api_test_dot_objectDefaultMethod)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | <p>Message to log.</p> |


**Returns**:

- <code>string</code> <p>Formatted message with ERROR prefix</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
```



* * *

<a id="api_test_dot_overwriteTest1"></a>

### api_test.overwriteTest1
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_overwriteTest1_dot_overwriteTest"></a>

### api_test.overwriteTest1.overwriteTest() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>overwriteTest.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.overwriteTest1</code>](#api_test_dot_overwriteTest1)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-1.overwriteTest();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-1.overwriteTest();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-1.overwriteTest();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-1.overwriteTest();
```



* * *

<a id="api_test_dot_overwriteTest1_dot_conflictingName"></a>

### api_test.overwriteTest1.conflictingName() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>conflictingName.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.overwriteTest1</code>](#api_test_dot_overwriteTest1)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-1.conflictingName();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-1.conflictingName();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-1.conflictingName();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-1.conflictingName();
```



* * *

<a id="api_test_dot_overwriteTest2"></a>

### api_test.overwriteTest2
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_overwriteTest2_dot_overwriteTest"></a>

### api_test.overwriteTest2.overwriteTest() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>overwriteTest.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.overwriteTest2</code>](#api_test_dot_overwriteTest2)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-2.overwriteTest();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-2.overwriteTest();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-2.overwriteTest();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-2.overwriteTest();
```



* * *

<a id="api_test_dot_overwriteTest2_dot_conflictingName"></a>

### api_test.overwriteTest2.conflictingName() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>conflictingName.</p></strong></p>
> 
**Kind**: static method of [<code>api_test.overwriteTest2</code>](#api_test_dot_overwriteTest2)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-2.conflictingName();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-2.conflictingName();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.overwrite-test-2.conflictingName();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.overwrite-test-2.conflictingName();
```



* * *

<a id="api_test_dot_requestContext"></a>

### api_test.requestContext
> <p><strong style="font-size: 1.1em;"><p>Request context testing utilities</p></strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_rootFunction"></a>

### api_test.rootFunction
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_rootFunction_dot_greet"></a>

### api_test.rootFunction.greet(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Greets a name (default export).
> This is the main callable API function.
> Accessed as <code>api()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.rootFunction</code>](#api_test_dot_rootFunction)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Name to greet</p> |


**Returns**:

- <code>string</code> <p>Greeting message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test("World")); // 'Hello, World!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test("World")); // 'Hello, World!'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test("World")); // 'Hello, World!'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test("World")); // 'Hello, World!'
```



* * *

<a id="api_test_dot_rootFunctionShout"></a>

### api_test.rootFunctionShout(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Shouts a greeting with uppercase formatting.
> Accessed as <code>api.rootFunctionShout()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static method of [<code>api_test</code>](#api_test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Name to greet loudly</p> |


**Returns**:

- <code>string</code> <p>Uppercase greeting message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionShout("World")); // 'HELLO, WORLD!'
```



* * *

<a id="api_test_dot_rootFunctionWhisper"></a>

### api_test.rootFunctionWhisper(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Whispers a greeting with lowercase formatting.
> Accessed as <code>api.rootFunctionWhisper()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static method of [<code>api_test</code>](#api_test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Name to greet quietly</p> |


**Returns**:

- <code>string</code> <p>Lowercase greeting message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionWhisper("World")); // 'hello, world.'
```



* * *

<a id="api_test_dot_rootMath"></a>

### api_test.rootMath
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_rootMath_dot_add"></a>

### api_test.rootMath.add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.rootMath</code>](#api_test_dot_rootMath)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to add</p> |
| b | <code>number</code> |  | <p>Second number to add</p> |


**Returns**:

- <code>number</code> <p>The sum of a and b</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
```



* * *

<a id="api_test_dot_rootMath_dot_multiply"></a>

### api_test.rootMath.multiply(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Multiplies two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.rootMath</code>](#api_test_dot_rootMath)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to multiply</p> |
| b | <code>number</code> |  | <p>Second number to multiply</p> |


**Returns**:

- <code>number</code> <p>The product of a and b</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootMath.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.multiply(4, 6)); // 24
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.multiply(4, 6)); // 24
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootMath.multiply(4, 6)); // 24
```



* * *

<a id="api_test_dot_rootstring"></a>

### api_test.rootstring
> <p><strong style="font-size: 1.1em;"><p>String manipulation API object with common string operations.
> Provides uppercase and reverse functions for testing string operations in slothlet.
> Accessed as <code>api.rootstring</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)

**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper("abc")); // 'ABC'
console.log(api_test.rootstring.reverse("abc")); // 'cba'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper("abc")); // 'ABC'
  console.log(api_test.rootstring.reverse("abc")); // 'cba'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper("abc")); // 'ABC'
  console.log(api_test.rootstring.reverse("abc")); // 'cba'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper("abc")); // 'ABC'
console.log(api_test.rootstring.reverse("abc")); // 'cba'
```



* * *

<a id="api_test_dot_rootstring_dot_upper"></a>

### api_test.rootstring.upper(str) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Converts a string to uppercase.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.rootstring</code>](#api_test_dot_rootstring)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| str | <code>string</code> |  | <p>String to convert to uppercase</p> |


**Returns**:

- <code>string</code> <p>The uppercased string</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper("hello")); // 'HELLO'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper("hello")); // 'HELLO'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper("hello")); // 'HELLO'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper("hello")); // 'HELLO'
```



* * *

<a id="api_test_dot_rootstring_dot_reverse"></a>

### api_test.rootstring.reverse(str) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Reverses a string character by character.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.rootstring</code>](#api_test_dot_rootstring)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| str | <code>string</code> |  | <p>String to reverse</p> |


**Returns**:

- <code>string</code> <p>The reversed string</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.reverse("hello")); // 'olleh'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.reverse("hello")); // 'olleh'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.reverse("hello")); // 'olleh'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.reverse("hello")); // 'olleh'
```



* * *

<a id="api_test_dot_runtimeTest"></a>

### api_test.runtimeTest
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_runtimeTest_dot_verifyRuntime"></a>

### api_test.runtimeTest.verifyRuntime() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Comprehensive runtime verification that tests all aspects of the runtime system.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>object</code> <p>Complete runtime verification results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.verifyRuntime();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.verifyRuntime();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.verifyRuntime();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.verifyRuntime();
```



* * *

<a id="api_test_dot_runtimeTest_dot_testSelfCrossCall"></a>

### api_test.runtimeTest.testSelfCrossCall(a, b) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Test self cross-calls using math operations.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number</p> |
| b | <code>number</code> |  | <p>Second number</p> |


**Returns**:

- <code>object</code> <p>Cross-call test results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testSelfCrossCall(1, 1);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testSelfCrossCall(1, 1);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testSelfCrossCall(1, 1);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testSelfCrossCall(1, 1);
```



* * *

<a id="api_test_dot_runtimeTest_dot_testContextIsolation"></a>

### api_test.runtimeTest.testContextIsolation() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Test context isolation by checking for unique context data.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>object</code> <p>Context isolation test results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testContextIsolation();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testContextIsolation();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testContextIsolation();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testContextIsolation();
```



* * *

<a id="api_test_dot_runtimeTest_dot_testPerformance"></a>

### api_test.runtimeTest.testPerformance() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Performance test to help distinguish between runtime types.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>object</code> <p>Performance test results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testPerformance();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testPerformance();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testPerformance();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testPerformance();
```



* * *

<a id="api_test_dot_runtimeTest_dot_comprehensiveRuntimeTest"></a>

### api_test.runtimeTest.comprehensiveRuntimeTest() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Comprehensive runtime test that combines all verification methods.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>object</code> <p>Complete runtime test results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.comprehensiveRuntimeTest();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.comprehensiveRuntimeTest();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.comprehensiveRuntimeTest();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.comprehensiveRuntimeTest();
```



* * *

<a id="api_test_dot_runtimeTest_dot_testSelfAndReference"></a>

### api_test.runtimeTest.testSelfAndReference() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Test self and reference propagation through API function calls.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>object</code> <p>Self and reference test results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testSelfAndReference();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testSelfAndReference();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.testSelfAndReference();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.testSelfAndReference();
```



* * *

<a id="api_test_dot_runtimeTest_dot_getAsyncInstanceID"></a>

### api_test.runtimeTest.getAsyncInstanceID() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Exercise all proxy traps on the <code>instanceID</code> export from the async runtime.
> Must be called within an active slothlet async-runtime context so the in-context
> branches of the get/has traps are reached.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>Object</code> <p>Proxy trap results</p>


**Example**
```js
const result = api.runtimeTest.getAsyncInstanceID();
// result.id === api.slothlet.instanceID
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.getAsyncInstanceID();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.getAsyncInstanceID();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.getAsyncInstanceID();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.getAsyncInstanceID();
```



* * *

<a id="api_test_dot_runtimeTest_dot_exerciseContextDispatcherTraps"></a>

### api_test.runtimeTest.exerciseContextDispatcherTraps() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Exercise the context proxy traps on the dispatcher (runtime.mjs) that are only
> hit via the live runtime path: ownKeys, has, getOwnPropertyDescriptor, and set.
> Must be called while a live-runtime context is active (runtime: &quot;live&quot; instance,
> called directly — no async scope wrapping).</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>Object</code> <p>Results of each trap</p>


**Example**
```js
const result = api.runtimeTest.exerciseContextDispatcherTraps();
expect(result.hasUserId).toBe(true);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.exerciseContextDispatcherTraps();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.exerciseContextDispatcherTraps();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.exerciseContextDispatcherTraps();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.exerciseContextDispatcherTraps();
```



* * *

<a id="api_test_dot_runtimeTest_dot_exerciseInstanceIDDispatcherTraps"></a>

### api_test.runtimeTest.exerciseInstanceIDDispatcherTraps() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Exercise the instanceID proxy traps on the dispatcher (runtime.mjs).
> Must be called while a live-runtime context is active so getCurrentRuntime()
> resolves to liveRuntimeModule and instanceID is a non-null string.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>Object</code> <p>Trap results</p>


**Example**
```js
const result = api.runtimeTest.exerciseInstanceIDDispatcherTraps();
expect(result.id).toBeTruthy();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.exerciseInstanceIDDispatcherTraps();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.exerciseInstanceIDDispatcherTraps();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.exerciseInstanceIDDispatcherTraps();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.exerciseInstanceIDDispatcherTraps();
```



* * *

<a id="api_test_dot_runtimeTest_dot_exerciseAsyncContextWriteTraps"></a>

### api_test.runtimeTest.exerciseAsyncContextWriteTraps() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Exercise the async runtime context proxy traps that require an active ALS context:
> <code>set</code> (write to context) and <code>getOwnPropertyDescriptor</code>.
> MUST be called within <code>api.slothlet.context.run()</code> so ALS is active — otherwise
> the set trap throws RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.runtimeTest</code>](#api_test_dot_runtimeTest)

**Returns**:

- <code>Object</code> <p>Trap exercise results</p>


**Example**
```js
await api.slothlet.context.run({ userId: 99 }, async () => {
  return api.runtimeTest.exerciseAsyncContextWriteTraps();
});
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.exerciseAsyncContextWriteTraps();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.exerciseAsyncContextWriteTraps();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.runtime-test.exerciseAsyncContextWriteTraps();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.runtime-test.exerciseAsyncContextWriteTraps();
```



* * *

<a id="api_test_dot_string"></a>

### api_test.string
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_string_dot_upper"></a>

### api_test.string.upper(str) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Converts a string to uppercase.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.string</code>](#api_test_dot_string)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| str | <code>string</code> |  | <p>String to convert to uppercase</p> |


**Returns**:

- <code>string</code> <p>The uppercased string</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.upper("World")); // 'WORLD'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.upper("World")); // 'WORLD'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.upper("World")); // 'WORLD'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.upper("World")); // 'WORLD'
```



* * *

<a id="api_test_dot_string_dot_reverse"></a>

### api_test.string.reverse(str) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Reverses a string character by character.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.string</code>](#api_test_dot_string)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| str | <code>string</code> |  | <p>String to reverse</p> |


**Returns**:

- <code>string</code> <p>The reversed string</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.reverse("World")); // 'dlrow'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.reverse("World")); // 'dlrow'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.reverse("World")); // 'dlrow'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.reverse("World")); // 'dlrow'
```



* * *

<a id="api_test_dot_task"></a>

### api_test.task
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for task components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_task_dot_autoIP"></a>

### autoIP.autoIP() ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Automatically detects IP configuration.
> Accessed as <code>api.task.autoIp()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>autoIP.autoIP</code>](#api_test_dot_task_dot_autoIP)

**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>The string &quot;testAutoIP&quot;.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.task.autoIp()); // "testAutoIP"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.task.autoIp()); // "testAutoIP"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.task.autoIp()); // "testAutoIP"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.task.autoIp()); // "testAutoIP"
```



* * *

<a id="api_test_dot_tcp"></a>

### api_test.tcp
> <p><strong style="font-size: 1.1em;"><p>TCP server API object for testing automatic EventEmitter context propagation.
> This module tests slothlet's ability to preserve AsyncLocalStorage context
> across EventEmitter callbacks without requiring consumer changes.
> Accessed as <code>api.tcp</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_tcp_dot_testContext"></a>

### api_test.tcp.testContext() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Test context availability in the tcp module.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.tcp</code>](#api_test_dot_tcp)

**Returns**:

- <code>object</code> <p>Context test results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.tcp.testContext();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.tcp.testContext();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  api_test.tcp.testContext();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
api_test.tcp.testContext();
```



* * *

<a id="api_test_dot_tcp_dot_createTestServer"></a>

### api_test.tcp.createTestServer(port) ⇒ <code>Promise.&lt;{port: number, server: NetServer}&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Create a test TCP server that tests context propagation in EventEmitter callbacks.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.tcp</code>](#api_test_dot_tcp)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [port] | <code>number</code> | <code>0</code> | <p>Port to listen on (0 for random)</p> |


**Returns**:

- <code>Promise.&lt;{port: number, server: NetServer}&gt;</code> <p>Server instance and port</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
await api_test.tcp.createTestServer();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  await api_test.tcp.createTestServer();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  await api_test.tcp.createTestServer();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
await api_test.tcp.createTestServer();
```



* * *

<a id="api_test_dot_util"></a>

### api_test.util
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for util components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_util_dot_controller"></a>

### api_test.util.controller
> <p><strong style="font-size: 1.1em;"><p>Controller object with device and endpoint detection methods.
> Accessed as <code>api.util.controller</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.util</code>](#api_test_dot_util)

**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.getDefault()); // "getDefault"
console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.getDefault()); // "getDefault"
  console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.getDefault()); // "getDefault"
  console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.getDefault()); // "getDefault"
console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
```



* * *

<a id="api_test_dot_util_dot_controller_dot_getDefault"></a>

### api_test.util.controller.getDefault() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the default value.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.util.controller</code>](#api_test_dot_util_dot_controller)

**Returns**:

- <code>string</code> <p>The string &quot;getDefault&quot;.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.getDefault()); // "getDefault"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.getDefault()); // "getDefault"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.getDefault()); // "getDefault"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.getDefault()); // "getDefault"
```



* * *

<a id="api_test_dot_util_dot_controller_dot_detectEndpointType"></a>

### api_test.util.controller.detectEndpointType() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Detects the endpoint type.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.util.controller</code>](#api_test_dot_util_dot_controller)

**Returns**:

- <code>string</code> <p>The string &quot;detectEndpointType&quot;.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
```



* * *

<a id="api_test_dot_util_dot_controller_dot_detectDeviceType"></a>

### api_test.util.controller.detectDeviceType() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Detects the device type.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.util.controller</code>](#api_test_dot_util_dot_controller)

**Returns**:

- <code>string</code> <p>The string &quot;detectDeviceType&quot;.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
```



* * *

<a id="api_test_dot_util_dot_extract"></a>

### api_test.util.extract
> <p><strong style="font-size: 1.1em;"><p>Data extraction API object with various parsing and extraction methods.
> This module tests slothlet's ability to handle nested folder structures.
> Accessed as <code>api.util.extract</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.util</code>](#api_test_dot_util)

**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.data()); // 'data'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.data()); // 'data'
```



* * *

<a id="api_test_dot_util_dot_extract_dot_data"></a>

### api_test.util.extract.data() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Extracts data from a source.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.util.extract</code>](#api_test_dot_util_dot_extract)

**Returns**:

- <code>string</code> <p>Data extraction result</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.data()); // 'data'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.data()); // 'data'
```



* * *

<a id="api_test_dot_util_dot_extract_dot_section"></a>

### api_test.util.extract.section() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Extracts sections from content.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.util.extract</code>](#api_test_dot_util_dot_extract)

**Returns**:

- <code>string</code> <p>Section extraction result</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.section()); // 'section'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.section()); // 'section'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.section()); // 'section'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.section()); // 'section'
```



* * *

<a id="api_test_dot_util_dot_extract_dot_NVRSection"></a>

### api_test.util.extract.NVRSection() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Extracts NVR (Network Video Recorder) sections.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.util.extract</code>](#api_test_dot_util_dot_extract)

**Returns**:

- <code>string</code> <p>NVR section extraction result</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
```



* * *

<a id="api_test_dot_util_dot_extract_dot_parseDeviceName"></a>

### api_test.util.extract.parseDeviceName() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Parses device names from input.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.util.extract</code>](#api_test_dot_util_dot_extract)

**Returns**:

- <code>string</code> <p>Device name parsing result</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
```







* * *

## Type Definitions

<a id="typedef_NetServer"></a>

### NetServer : <code>object</code>
<p>A Node.js TCP server instance (net.Server).</p>

**Kind**: typedef  
**Scope**: global


* * *


