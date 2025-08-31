<a id="api_test"></a>

## @cldmv/slothlet/api\_tests/api\_test
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities with ESM modules. It includes math operations, configuration management, advanced nested structures, and various export patterns for comprehensive API testing.</p>
> 


**Structure**

[api_test](#api_test)
  * [.advanced](#api_test_dot_advanced)
    * [.nest](#api_test_dot_advanced_dot_nest)
      * [.alpha(name)](#api_test_dot_advanced_dot_nest_dot_alpha) ⇒ <code><code>string</code></code>
    * [.nest2](#api_test_dot_advanced_dot_nest2)
        * [.hello()](#api_test_dot_advanced_dot_nest2_dot_alpha_dot_hello) ⇒ <code><code>string</code></code>
        * [.world()](#api_test_dot_advanced_dot_nest2_dot_beta_dot_world) ⇒ <code><code>string</code></code>
      * [.addViaSelf(a, b)](#api_test_dot_advanced_dot_selfObject_dot_addViaSelf) ⇒ <code><code>number</code></code>
  * [.exportDefault()](#api_test_dot_exportDefault) ⇒ <code><code>string</code></code>
    * [.extra()](#api_test_dot_exportDefault_dot_extra) ⇒ <code><code>string</code></code>
  * [.funcmod(name)](#api_test_dot_funcmod) ⇒ <code><code>string</code></code>
    * [.add(a, b)](#api_test_dot_math_dot_add) ⇒ <code><code>number</code></code>
    * [.multiply(a, b)](#api_test_dot_math_dot_multiply) ⇒ <code><code>number</code></code>
    * [.uniqueOne(msg)](#api_test_dot_multi_func_dot_uniqueOne) ⇒ <code><code>string</code></code>
    * [.uniqueTwo(msg)](#api_test_dot_multi_func_dot_uniqueTwo) ⇒ <code><code>string</code></code>
    * [.uniqueThree(msg)](#api_test_dot_multi_func_dot_uniqueThree) ⇒ <code><code>string</code></code>
    * [.multi_func_hello()](#api_test_dot_multi_func_dot_multi_func_hello) ⇒ <code><code>string</code></code>
  * [.multi](#api_test_dot_multi)
      * [.hello()](#api_test_dot_multi_dot_alpha_dot_hello) ⇒ <code><code>string</code></code>
      * [.world()](#api_test_dot_multi_dot_beta_dot_world) ⇒ <code><code>string</code></code>
  * [.nested](#api_test_dot_nested)
      * [.today()](#api_test_dot_nested_dot_date_dot_today) ⇒ <code><code>string</code></code>
    * [.default(message, level)](#api_test_dot_objectDefaultMethod_dot_default) ⇒ <code><code>string</code></code>
    * [.info(message)](#api_test_dot_objectDefaultMethod_dot_info) ⇒ <code><code>string</code></code>
    * [.warn(message)](#api_test_dot_objectDefaultMethod_dot_warn) ⇒ <code><code>string</code></code>
    * [.error(message)](#api_test_dot_objectDefaultMethod_dot_error) ⇒ <code><code>string</code></code>
  * [.rootFunctionShout(name)](#api_test_dot_rootFunctionShout) ⇒ <code><code>string</code></code>
  * [.rootFunctionWhisper(name)](#api_test_dot_rootFunctionWhisper) ⇒ <code><code>string</code></code>
    * [.add(a, b)](#api_test_dot_rootMath_dot_add) ⇒ <code><code>number</code></code>
    * [.multiply(a, b)](#api_test_dot_rootMath_dot_multiply) ⇒ <code><code>number</code></code>
    * [.upper(str)](#api_test_dot_rootstring_dot_upper) ⇒ <code><code>string</code></code>
    * [.reverse(str)](#api_test_dot_rootstring_dot_reverse) ⇒ <code><code>string</code></code>
    * [.upper(str)](#api_test_dot_string_dot_upper) ⇒ <code><code>string</code></code>
    * [.reverse(str)](#api_test_dot_string_dot_reverse) ⇒ <code><code>string</code></code>
  * [.task](#api_test_dot_task)
    * [.autoIP()](#api_test_dot_task_dot_autoIP) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
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
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
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
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
```



* * *

<a id="api_test_dot_advanced"></a>

### api_test.advanced
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for advanced components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_advanced_dot_nest"></a>

### api_test.advanced.nest
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for nest components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test.advanced</code>](#api_test_dot_advanced)


* * *

<a id="api_test_dot_advanced_dot_nest_dot_alpha"></a>

### api_test.advanced.nest.alpha(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Alpha function for testing nested module loading.
> Accessed as <code>api.advanced.nest.alpha()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.advanced.nest</code>](#api_test_dot_advanced_dot_nest)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Name parameter for alpha function.</p> |


**Returns**:

- <code>string</code> <p>Formatted string with alpha prefix.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest.alpha('test')); // 'alpha: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest.alpha('test')); // 'alpha: test'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest.alpha('test')); // 'alpha: test'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest.alpha('test')); // 'alpha: test'
```



* * *

<a id="api_test_dot_advanced_dot_nest2"></a>

### api_test.advanced.nest2
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for nest2 components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test.advanced</code>](#api_test_dot_advanced)


* * *

<a id="api_test_dot_advanced_dot_nest2_dot_alpha"></a>

### api_test.advanced.nest2.alpha
> <p><strong style="font-size: 1.1em;"><p>Alpha object for nest2 nested module loading test.
> Accessed as <code>api.advanced.nest2.alpha</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.advanced.nest2</code>](#api_test_dot_advanced_dot_nest2)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
```



* * *

<a id="api_test_dot_advanced_dot_nest2_dot_alpha_dot_hello"></a>

### api_test.advanced.nest2.alpha.hello() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a test string.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.advanced.nest2.alpha</code>](#api_test_dot_advanced_dot_nest2_dot_alpha)

**Returns**:

- <code>string</code> <p>The string 'alpha hello'.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
```



* * *

<a id="api_test_dot_advanced_dot_nest2_dot_beta"></a>

### api_test.advanced.nest2.beta
> <p><strong style="font-size: 1.1em;"><p>Beta object for nest2 nested module loading test.
> Accessed as <code>api.advanced.nest2.beta</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.advanced.nest2</code>](#api_test_dot_advanced_dot_nest2)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
```



* * *

<a id="api_test_dot_advanced_dot_nest2_dot_beta_dot_world"></a>

### api_test.advanced.nest2.beta.world() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a test string.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.advanced.nest2.beta</code>](#api_test_dot_advanced_dot_nest2_dot_beta)

**Returns**:

- <code>string</code> <p>The string 'beta world'.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
```



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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.config.host); // "https://slothlet"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.config.host); // "https://slothlet"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.config.host); // "https://slothlet"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.config.host); // "https://slothlet"
```



* * *

<a id="api_test_dot_exportDefault"></a>

### exportDefault.exportDefault() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Default export function for testing export behavior.
> This function demonstrates how slothlet handles default exports with attached methods.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.exportDefault</code>](#api_test_dot_exportDefault)

**Returns**:

- <code>string</code> <p>Default export message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.exportDefault()); // 'exportDefault default'
console.log(api_test.exportDefault.extra()); // 'extra method'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.exportDefault()); // 'exportDefault default'
  console.log(api_test.exportDefault.extra()); // 'extra method'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.exportDefault()); // 'exportDefault default'
  console.log(api_test.exportDefault.extra()); // 'extra method'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.exportDefault()); // 'exportDefault default'
console.log(api_test.exportDefault.extra()); // 'extra method'
```



* * *

<a id="api_test_dot_exportDefault_dot_extra"></a>

### exportDefault.exportDefault.extra() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Named export for extra method that overrides the default export's extra method.
> This tests how slothlet handles named exports that conflict with default export properties.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.exportDefault</code>](#api_test_dot_exportDefault)

**Returns**:

- <code>string</code> <p>Overridden extra method message</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
```



* * *

<a id="api_test_dot_funcmod"></a>

### api_test.funcmod(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Default function export for testing single function modules.
> Accessed as <code>api.funcmod()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static method of [<code>api_test</code>](#api_test)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Name to greet.</p> |


**Returns**:

- <code>string</code> <p>Greeting message.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(2, 3)); // 5
console.log(api_test.math.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
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
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(2, 3)); // 5
  console.log(api_test.math.multiply(2, 3)); // 6
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(5, 7)); // 12
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```



* * *

<a id="api_test_dot_multi_func"></a>

### api_test.multi_func
> <p><strong style="font-size: 1.1em;"><p>Multi-function object with test methods.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_multi_func_dot_beta"></a>

### api_test.multi_func.beta
> <p><strong style="font-size: 1.1em;"><p>Beta object for multi-file API loader test.
> Accessed as <code>api.multi_func.beta</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.multi_func</code>](#api_test_dot_multi_func)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
```



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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
```



* * *

<a id="api_test_dot_multi"></a>

### api_test.multi
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for multi components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_multi_dot_alpha"></a>

### api_test.multi.alpha
> <p><strong style="font-size: 1.1em;"><p>Alpha object for multi-file API loader test.
> Accessed as <code>api.multi.alpha</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.multi</code>](#api_test_dot_multi)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.alpha.hello()); // 'alpha hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.alpha.hello()); // 'alpha hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.alpha.hello()); // 'alpha hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.alpha.hello()); // 'alpha hello'
```



* * *

<a id="api_test_dot_multi_dot_alpha_dot_hello"></a>

### api_test.multi.alpha.hello() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a test string.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.multi.alpha</code>](#api_test_dot_multi_dot_alpha)

**Returns**:

- <code>string</code> <p>The string 'alpha hello'.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.alpha.hello()); // 'alpha hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.alpha.hello()); // 'alpha hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.alpha.hello()); // 'alpha hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.alpha.hello()); // 'alpha hello'
```



* * *

<a id="api_test_dot_multi_dot_beta"></a>

### api_test.multi.beta
> <p><strong style="font-size: 1.1em;"><p>Beta object for multi-file API loader test.
> Accessed as <code>api.multi.beta</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.multi</code>](#api_test_dot_multi)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.beta.world()); // 'beta world'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.beta.world()); // 'beta world'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.beta.world()); // 'beta world'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.beta.world()); // 'beta world'
```



* * *

<a id="api_test_dot_multi_dot_beta_dot_world"></a>

### api_test.multi.beta.world() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns a test string.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.multi.beta</code>](#api_test_dot_multi_dot_beta)

**Returns**:

- <code>string</code> <p>The string 'beta world'.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.beta.world()); // 'beta world'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.beta.world()); // 'beta world'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.multi.beta.world()); // 'beta world'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.multi.beta.world()); // 'beta world'
```



* * *

<a id="api_test_dot_nested"></a>

### api_test.nested
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for nested components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test</code>](#api_test)


* * *

<a id="api_test_dot_nested_dot_date"></a>

### api_test.nested.date
> <p><strong style="font-size: 1.1em;"><p>Date API object for testing nested folder structures.
> This module tests slothlet's ability to handle deeply nested directories (nested/date/date.mjs).
> Accessed as <code>api.nested.date</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test.nested</code>](#api_test_dot_nested)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.nested.date.today()); // '2025-08-15'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.nested.date.today()); // '2025-08-15'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.nested.date.today()); // '2025-08-15'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.nested.date.today()); // '2025-08-15'
```



* * *

<a id="api_test_dot_nested_dot_date_dot_today"></a>

### api_test.nested.date.today() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns today's date as a YYYY-MM-DD formatted string.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test.nested.date</code>](#api_test_dot_nested_dot_date)

**Returns**:

- <code>string</code> <p>Today's date in YYYY-MM-DD format</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.nested.date.today()); // '2025-08-15'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.nested.date.today()); // '2025-08-15'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.nested.date.today()); // '2025-08-15'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.nested.date.today()); // '2025-08-15'
```



* * *

<a id="api_test_dot_objectDefaultMethod"></a>

### api_test.objectDefaultMethod
> <p><strong style="font-size: 1.1em;"><p>Object with a callable default method for API loader testing.
> Accessed as <code>api.objectDefaultMethod</code> and <code>api.objectDefaultMethod()</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod('Hello')); // calls default
console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod('Hello')); // calls default
  console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod('Hello')); // calls default
  console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod('Hello')); // calls default
console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
```



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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
  console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
  console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'
```



* * *

<a id="api_test_dot_rootMath"></a>

### api_test.rootMath
> <p><strong style="font-size: 1.1em;"><p>Math API object with basic arithmetic operations.
> Provides add and multiply functions for testing mathematical operations in slothlet.
> Accessed as <code>api.rootMath</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootMath.add(2, 3)); // 5
console.log(api_test.rootMath.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.add(2, 3)); // 5
  console.log(api_test.rootMath.multiply(2, 3)); // 6
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.add(2, 3)); // 5
  console.log(api_test.rootMath.multiply(2, 3)); // 6
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootMath.add(2, 3)); // 5
console.log(api_test.rootMath.multiply(2, 3)); // 6
```



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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootMath.add(5, 7)); // 12
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.add(5, 7)); // 12
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.add(5, 7)); // 12
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootMath.add(5, 7)); // 12
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootMath.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.multiply(4, 6)); // 24
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootMath.multiply(4, 6)); // 24
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper('abc')); // 'ABC'
console.log(api_test.rootstring.reverse('abc')); // 'cba'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper('abc')); // 'ABC'
  console.log(api_test.rootstring.reverse('abc')); // 'cba'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper('abc')); // 'ABC'
  console.log(api_test.rootstring.reverse('abc')); // 'cba'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper('abc')); // 'ABC'
console.log(api_test.rootstring.reverse('abc')); // 'cba'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper('hello')); // 'HELLO'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper('hello')); // 'HELLO'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.upper('hello')); // 'HELLO'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.upper('hello')); // 'HELLO'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.reverse('hello')); // 'olleh'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.reverse('hello')); // 'olleh'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.rootstring.reverse('hello')); // 'olleh'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.rootstring.reverse('hello')); // 'olleh'
```



* * *

<a id="api_test_dot_string"></a>

### api_test.string
> <p><strong style="font-size: 1.1em;"><p>String manipulation API object for testing auto-flattening.
> This module tests slothlet's ability to flatten single-file folder structures.
> Accessed as <code>api.string</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test</code>](#api_test)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.upper('hello')); // 'HELLO'
console.log(api_test.string.reverse('hello')); // 'olleh'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.upper('hello')); // 'HELLO'
  console.log(api_test.string.reverse('hello')); // 'olleh'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.upper('hello')); // 'HELLO'
  console.log(api_test.string.reverse('hello')); // 'olleh'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.upper('hello')); // 'HELLO'
console.log(api_test.string.reverse('hello')); // 'olleh'
```



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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.upper('world')); // 'WORLD'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.upper('world')); // 'WORLD'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.upper('world')); // 'WORLD'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.upper('world')); // 'WORLD'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.reverse('world')); // 'dlrow'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.reverse('world')); // 'dlrow'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.string.reverse('world')); // 'dlrow'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.string.reverse('world')); // 'dlrow'
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.task.autoIp()); // "testAutoIP"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.task.autoIp()); // "testAutoIP"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(await api_test.task.autoIp()); // "testAutoIP"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(await api_test.task.autoIp()); // "testAutoIP"
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.getDefault()); // "getDefault"
console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
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
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.getDefault()); // "getDefault"
  console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.getDefault()); // "getDefault"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.getDefault()); // "getDefault"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.getDefault()); // "getDefault"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.data()); // 'data'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.data()); // 'data'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.data()); // 'data'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.section()); // 'section'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.section()); // 'section'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.section()); // 'section'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
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
import slothlet from '@cldmv/slothlet';
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
```






