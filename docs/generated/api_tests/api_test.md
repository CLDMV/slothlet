<a id="api_test"></a>

## @cldmv/slothlet/api\_tests/api\_test
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities with ESM modules. It includes math operations, configuration management, advanced nested structures, and various export patterns for comprehensive API testing.</p>
> 


**Structure**

[api_test](#api_test)
  * [.advanced](#api_test_dot_advanced)
      * [.addViaSelf(a, b)](#api_test_dot_advanced_dot_selfObject_dot_addViaSelf) ⇒ <code><code>number</code></code>
      * [.getCurrentInstanceId()](#api_test_dot_advanced_dot_selfObject_dot_getCurrentInstanceId) ⇒ <code><code>string</code></code>
    * [.add(a, b)](#api_test_dot_math_dot_add) ⇒ <code><code>number</code></code>
    * [.multiply(a, b)](#api_test_dot_math_dot_multiply) ⇒ <code><code>number</code></code>
    * [.divide(a, b)](#api_test_dot_math_dot_divide) ⇒ <code><code>number</code></code>
    * [.uniqueOne(msg)](#api_test_dot_multi_func_dot_uniqueOne) ⇒ <code><code>string</code></code>
    * [.uniqueTwo(msg)](#api_test_dot_multi_func_dot_uniqueTwo) ⇒ <code><code>string</code></code>
    * [.uniqueThree(msg)](#api_test_dot_multi_func_dot_uniqueThree) ⇒ <code><code>string</code></code>
    * [.multi_func_hello()](#api_test_dot_multi_func_dot_multi_func_hello) ⇒ <code><code>string</code></code>
  * [.requestContext](#api_test_dot_requestContext)
  * [.rootFunctionShout(name)](#api_test_dot_rootFunctionShout) ⇒ <code><code>string</code></code>
  * [.rootFunctionWhisper(name)](#api_test_dot_rootFunctionWhisper) ⇒ <code><code>string</code></code>
    * [.upper(str)](#api_test_dot_rootstring_dot_upper) ⇒ <code><code>string</code></code>
    * [.reverse(str)](#api_test_dot_rootstring_dot_reverse) ⇒ <code><code>string</code></code>
  * [.task](#api_test_dot_task)
    * [.autoIP()](#api_test_dot_task_dot_autoIP) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.testContext()](#api_test_dot_tcp_dot_testContext) ⇒ <code><code>object</code></code>
    * [.createTestServer(port)](#api_test_dot_tcp_dot_createTestServer) ⇒ <code><code>Promise.&lt;{port: number, server: NetServer}&gt;</code></code>
  * [.util](#api_test_dot_util)
      * [.getDefault()](#api_test_dot_util_dot_controller_dot_getDefault) ⇒ <code><code>string</code></code>
      * [.detectEndpointType()](#api_test_dot_util_dot_controller_dot_detectEndpointType) ⇒ <code><code>string</code></code>
      * [.detectDeviceType()](#api_test_dot_util_dot_controller_dot_detectDeviceType) ⇒ <code><code>string</code></code>
      * [.data()](#api_test_dot_util_dot_extract_dot_data) ⇒ <code><code>string</code></code>
      * [.section()](#api_test_dot_util_dot_extract_dot_section) ⇒ <code><code>string</code></code>
      * [.NVRSection()](#api_test_dot_util_dot_extract_dot_NVRSection) ⇒ <code><code>string</code></code>
      * [.parseDeviceName()](#api_test_dot_util_dot_extract_dot_parseDeviceName) ⇒ <code><code>string</code></code>


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

### api_test
> <p><strong style="font-size: 1.1em;"><p>ESM test modules for slothlet API testing.</p></strong></p>
> 
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

- <code>string</code> <p>The current instance ID</p>



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
console.log(api_test.math.add(2, 3)); // 5
console.log(api_test.math.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(2, 3)); // 5
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
  console.log(api_test.math.add(2, 3)); // 5
  console.log(api_test.math.multiply(2, 3)); // 6
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(2, 3)); // 5
console.log(api_test.math.multiply(2, 3)); // 6
```



* * *

<a id="api_test_dot_math_dot_add"></a>

### api_test.math.add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.math</code>](#api_test_dot_math)


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
console.log(api_test.math.add(5, 7)); // 12
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(5, 7)); // 12
```



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

<a id="api_test_dot_requestContext"></a>

### api_test.requestContext
> <p><strong style="font-size: 1.1em;"><p>Request context testing utilities</p></strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


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
**Kind**: inner method of [<code>api_test.task.autoIP</code>](#api_test_dot_task_dot_autoIP)

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


