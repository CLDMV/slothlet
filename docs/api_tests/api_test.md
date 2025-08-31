
<a name="module_api_test"></a>

## @cldmv/slothlet/api\_tests/api\_test
<p><strong style="font-size: 1.1em;"><p>ESM test modules for slothlet API testing.</p></strong></p>
<p>This module provides test objects and functions for validating slothlet's API loading capabilities with ESM modules. It includes math operations, configuration management, advanced nested structures, and various export patterns for comprehensive API testing.</p>


* [api_test](#module_api_test)
    * [.funcmod(name)](#module_api_test.funcmod) ⇒ <code>string</code>
    * [.rootFunctionShout(name)](#module_api_test.rootFunctionShout) ⇒ <code>string</code>
    * [.rootFunctionWhisper(name)](#module_api_test.rootFunctionWhisper) ⇒ <code>string</code>
        * [.advanced.nest](#api_test.advanced.module_nest) : <code>object</code>
            * [.alpha(name)](#api_test.advanced.module_nest.alpha) ⇒ <code>string</code>
            * [.alpha](#module_api_test.advanced.nest2.alpha) : <code>object</code>
            * [.beta](#module_api_test.advanced.nest2.beta) : <code>object</code>
        * [.advanced.nest3](#api_test.advanced.module_nest3) : <code>object</code>
            * [.module.exports(name)](#api_test.advanced.module_nest3.module.exports) ⇒ <code>string</code>
            * [.advanced.nest4.singlefile](#api_test.advanced.nest4.module_singlefile) : <code>object</code>
                * [.beta(name)](#api_test.advanced.nest4.module_singlefile.beta) ⇒ <code>string</code>
        * [.selfObject](#module_api_test.advanced.selfObject) : <code>object</code>
    * [.config](#module_api_test.config) : <code>object</code>
    * [.exportDefault](#api_test.module_exportDefault) : <code>object</code>
        * [.exportDefault()](#api_test.module_exportDefault.exportDefault) ⇒ <code>string</code>
        * [.extra()](#api_test.module_exportDefault.extra) ⇒ <code>string</code>
    * [.funcmod](#api_test.module_funcmod) : <code>object</code>
    * [.math](#module_api_test.math) : <code>object</code>
        * [.multi_func.alpha](#api_test.multi_func.module_alpha) : <code>object</code>
        * [.beta](#module_api_test.multi_func.beta) : <code>object</code>
    * [.multi_func](#module_api_test.multi_func) : <code>object</code>
        * [.alpha](#module_api_test.multi.alpha) : <code>object</code>
        * [.date](#module_api_test.nested.date) : <code>object</code>
    * [.objectDefaultMethod](#module_api_test.objectDefaultMethod) : <code>object</code>
    * [.rootFunction](#api_test.module_rootFunction) : <code>object</code>
        * [.greet(name)](#api_test.module_rootFunction.greet) ⇒ <code>string</code>
    * [.rootMath](#module_api_test.rootMath) : <code>object</code>
    * [.rootstring](#module_api_test.rootstring) : <code>object</code>
    * [.string](#module_api_test.string) : <code>object</code>
        * [.task.autoIp](#api_test.task.module_autoIp) : <code>object</code>
            * [.autoIP()](#api_test.task.module_autoIp.autoIP) ⇒ <code>Promise.&lt;string&gt;</code>
        * [.controller](#module_api_test.util.controller) : <code>object</code>
        * [.extract](#module_api_test.util.extract) : <code>object</code>
        * [.util.url](#api_test.util.module_url) : <code>object</code>
            * [.cleanEndpoint(endpoint, siteKey, variables, apiEndPointVersionOverride, apiEndPointTypeOverride)](#api_test.util.module_url.cleanEndpoint) ⇒ <code>string</code>
            * [.buildUrlWithParams(str, params)](#api_test.util.module_url.buildUrlWithParams) ⇒ <code>string</code>
        * [.util.util](#api_test.util.module_util) : <code>object</code>
            * [.size(variable)](#api_test.util.module_util.size) ⇒ <code>string</code>
            * [.secondFunc(variable)](#api_test.util.module_util.secondFunc) ⇒ <code>string</code>
    * [.advanced](#module_api_test_advanced) : <code>object</code>
        * [.nest](#api_test.advanced.module_nest) : <code>object</code>
        * [.nest3](#api_test.advanced.module_nest3) : <code>object</code>
        * [.nest2](#module_api_test_advanced_nest2) : <code>object</code>
        * [.nest4](#module_api_test_advanced_nest4) : <code>object</code>
            * [.singlefile](#api_test.advanced.nest4.module_singlefile) : <code>object</code>
    * [.multi](#module_api_test_multi) : <code>object</code>
    * [.nested](#module_api_test_nested) : <code>object</code>
    * [.task](#module_api_test_task) : <code>object</code>
        * [.autoIp](#api_test.task.module_autoIp) : <code>object</code>
    * [.util](#module_api_test_util) : <code>object</code>
        * [.url](#api_test.util.module_url) : <code>object</code>
        * [.util](#api_test.util.module_util) : <code>object</code>


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

<a name="api_test.advanced.module_nest"></a>

#### api_test.advanced.nest : <code>object</code>
<p>Nested alpha function for testing deeply nested module structures. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.advanced.module_nest.alpha"></a>

##### api_test.advanced.nest.alpha(name) ⇒ <code>string</code>
<p>Alpha function for testing nested module loading.
Accessed as <code>api.advanced.nest.alpha()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.advanced.nest</code>](#api_test.advanced.module_nest)

**Returns**:

- <code>string</code> <p>Formatted string with alpha prefix.</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name parameter for alpha function.</p> |


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

<a name="api_test.advanced.module_nest3"></a>

#### api_test.advanced.nest3 : <code>object</code>
<p>Single file function for testing nest3 deeply nested auto-flattening. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.advanced.module_nest3.module.exports"></a>

##### api_test.advanced.nest3.module.exports(name) ⇒ <code>string</code>
<p>Default function for testing nest3 auto-flattening behavior.
Accessed as <code>api_test.advanced.nest3()</code> in the slothlet API (auto-flattened).</p>

**Kind**: static method of [<code>api_test.advanced.nest3</code>](#api_test.advanced.module_nest3)

**Returns**:

- <code>string</code> <p>Greeting message.</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to greet.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.advanced.nest3('slothlet')); // 'Hello, slothlet!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.advanced.nest3('slothlet')); // 'Hello, slothlet!'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.advanced.nest3('slothlet')); // 'Hello, slothlet!'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.advanced.nest3('slothlet')); // 'Hello, slothlet!'
```



* * *

<a name="api_test.advanced.nest4.module_singlefile"></a>

#### api_test.advanced.nest4.singlefile : <code>object</code>
<p>Single beta function for testing nest4 deeply nested module structures. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.advanced.nest4.module_singlefile.beta"></a>

##### api_test.advanced.nest4.singlefile.beta(name) ⇒ <code>string</code>
<p>Beta function for testing nest4 nested module loading.
Accessed as <code>api_test.advanced.nest4.beta()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.advanced.nest4.singlefile</code>](#api_test.advanced.nest4.module_singlefile)

**Returns**:

- <code>string</code> <p>Greeting message.</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to greet.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'
```



* * *

<a name="module_api_test.config"></a>

### api_test.config : <code>object</code>
<p>Default configuration object for testing API modules.
Contains sample connection parameters and settings used across test modules.
Accessed as <code>api.config</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.module_exportDefault"></a>

### api_test.exportDefault : <code>object</code>
<p>Default export module for testing mixed default and named exports. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.module_exportDefault.exportDefault"></a>

#### api_test.exportDefault.exportDefault() ⇒ <code>string</code>
<p>Default export function for testing export behavior.
This function demonstrates how slothlet handles default exports with attached methods.</p>

**Kind**: static method of [<code>api_test.exportDefault</code>](#api_test.module_exportDefault)

**Returns**:

- <code>string</code> <p>Default export message</p>


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.exportDefault()); // 'exportDefault default'console.log(api_test.exportDefault.extra()); // 'extra method'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.exportDefault()); // 'exportDefault default'  console.log(api_test.exportDefault.extra()); // 'extra method'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.exportDefault()); // 'exportDefault default'  console.log(api_test.exportDefault.extra()); // 'extra method'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.exportDefault()); // 'exportDefault default'console.log(api_test.exportDefault.extra()); // 'extra method'
```



* * *

<a name="api_test.module_exportDefault.extra"></a>

#### api_test.exportDefault.extra() ⇒ <code>string</code>
<p>Named export for extra method that overrides the default export's extra method.
This tests how slothlet handles named exports that conflict with default export properties.</p>

**Kind**: static method of [<code>api_test.exportDefault</code>](#api_test.module_exportDefault)

**Returns**:

- <code>string</code> <p>Overridden extra method message</p>


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.exportDefaultExtra()); // 'extra method overridden'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.exportDefaultExtra()); // 'extra method overridden'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
```



* * *

<a name="api_test.module_funcmod"></a>

### api_test.funcmod : <code>object</code>
<p>Function module for testing slothlet loader with single function export. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="module_api_test.funcmod"></a>

### api_test.funcmod(name) ⇒ <code>string</code>
<p>Default function export for testing single function modules.
Accessed as <code>api.funcmod()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test</code>](#module_api_test)

**Returns**:

- <code>string</code> <p>Greeting message.</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to greet.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.funcmod('slothlet')); // 'Hello, slothlet!'
```



* * *

<a name="module_api_test.math"></a>

### api_test.math : <code>object</code>
<p>Math API object with basic arithmetic operations for testing auto-flattening.
This module tests slothlet's ability to flatten single-file folder structures.
Accessed as <code>api.math</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test</code>](#module_api_test)


* * *

<a name="module_api_test.math.add"></a>

#### api_test.math.add(a, b) ⇒ <code>number</code>
<p>Adds two numbers together.</p>

**Kind**: static method of [<code>api_test.math</code>](#module_api_test.math)
**Returns**:

- <code>number</code> <p>The sum of a and b</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to add</p> |
| b | <code>number</code> | <p>Second number to add</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.math.add(5, 7)); // 12
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.math.add(5, 7)); // 12}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.math.add(5, 7)); // 12})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.math.add(5, 7)); // 12
```



* * *

<a name="module_api_test.math.multiply"></a>

#### api_test.math.multiply(a, b) ⇒ <code>number</code>
<p>Multiplies two numbers together.</p>

**Kind**: static method of [<code>api_test.math</code>](#module_api_test.math)
**Returns**:

- <code>number</code> <p>The product of a and b</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to multiply</p> |
| b | <code>number</code> | <p>Second number to multiply</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.math.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.math.multiply(4, 6)); // 24}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.math.multiply(4, 6)); // 24})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.math.multiply(4, 6)); // 24
```



* * *

<a name="api_test.multi_func.module_alpha"></a>

#### api_test.multi_func.alpha : <code>object</code>
<p>Alpha function in multi_func for testing function flattening. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.multi_func.module_alpha.alpha"></a>

##### api_test.multi_func.alpha.alpha(name) ⇒ <code>string</code>
<p>Alpha function for multi-file API loader test.
Accessed as <code>api.multiFunc.alpha()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.multi_func.alpha</code>](#api_test.multi_func.module_alpha)

**Returns**:

- <code>string</code> <p>Formatted string with alpha prefix.</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name parameter for alpha function.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'
```



* * *

<a name="module_api_test.multi_func"></a>

### api_test.multi_func : <code>object</code>
<p>Multi-function object with test methods.</p>

**Kind**: static constant of [<code>api_test</code>](#module_api_test)


* * *

<a name="module_api_test.multi_func.uniqueOne"></a>

#### api_test.multi_func.uniqueOne(msg) ⇒ <code>string</code>
<p>Returns a uniqueOne message.
Accessed as <code>api.multiFunc.uniqueOne()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.multi_func</code>](#module_api_test.multi_func)
**Returns**:

- <code>string</code> <p>Formatted message with uniqueOne prefix.</p>



| Param | Type | Description |
| --- | --- | --- |
| msg | <code>string</code> | <p>Message to include.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.uniqueOne('test')); // 'uniqueOne: test'
```



* * *

<a name="module_api_test.multi_func.uniqueTwo"></a>

#### api_test.multi_func.uniqueTwo(msg) ⇒ <code>string</code>
<p>Returns a uniqueTwo message.
Accessed as <code>api.multiFunc.uniqueTwo()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.multi_func</code>](#module_api_test.multi_func)
**Returns**:

- <code>string</code> <p>Formatted message with uniqueTwo prefix.</p>



| Param | Type | Description |
| --- | --- | --- |
| msg | <code>string</code> | <p>Message to include.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.uniqueTwo('test')); // 'uniqueTwo: test'
```



* * *

<a name="module_api_test.multi_func.uniqueThree"></a>

#### api_test.multi_func.uniqueThree(msg) ⇒ <code>string</code>
<p>Returns a uniqueThree message.
Accessed as <code>api.multiFunc.uniqueThree()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.multi_func</code>](#module_api_test.multi_func)
**Returns**:

- <code>string</code> <p>Formatted message with uniqueThree prefix.</p>



| Param | Type | Description |
| --- | --- | --- |
| msg | <code>string</code> | <p>Message to include.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multiFunc.uniqueThree('test')); // 'uniqueThree: test'
```



* * *

<a name="module_api_test.multi_func.multi_func_hello"></a>

#### api_test.multi_func.multi_func_hello() ⇒ <code>string</code>
<p>Returns a test string.</p>

**Kind**: static method of [<code>api_test.multi_func</code>](#module_api_test.multi_func)
**Returns**:

- <code>string</code> <p>The string &quot;beta hello&quot;</p>


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
```



* * *

<a name="module_api_test.objectDefaultMethod"></a>

### api_test.objectDefaultMethod : <code>object</code>
<p>Object with a callable default method for API loader testing.
Accessed as <code>api.objectDefaultMethod</code> and <code>api.objectDefaultMethod()</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test</code>](#module_api_test)


* * *

<a name="module_api_test.objectDefaultMethod.default"></a>

#### api_test.objectDefaultMethod.default(message, level) ⇒ <code>string</code>
<p>Default method for objectDefaultMethod. Calls the named method based on level.</p>

**Kind**: static method of [<code>api_test.objectDefaultMethod</code>](#module_api_test.objectDefaultMethod)
**Returns**:

- <code>string</code> <p>Formatted message with appropriate level prefix</p>



| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | <p>Message to log.</p> |
| level | <code>string</code> | <p>Level to use ('info', 'warn', 'error').</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'  console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'  console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
```



* * *

<a name="module_api_test.objectDefaultMethod.info"></a>

#### api_test.objectDefaultMethod.info(message) ⇒ <code>string</code>
<p>Info method for objectDefaultMethod.</p>

**Kind**: static method of [<code>api_test.objectDefaultMethod</code>](#module_api_test.objectDefaultMethod)
**Returns**:

- <code>string</code> <p>Formatted message with INFO prefix</p>



| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | <p>Message to log.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
```



* * *

<a name="module_api_test.objectDefaultMethod.warn"></a>

#### api_test.objectDefaultMethod.warn(message) ⇒ <code>string</code>
<p>Warn method for objectDefaultMethod.</p>

**Kind**: static method of [<code>api_test.objectDefaultMethod</code>](#module_api_test.objectDefaultMethod)
**Returns**:

- <code>string</code> <p>Formatted message with WARN prefix</p>



| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | <p>Message to log.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
```



* * *

<a name="module_api_test.objectDefaultMethod.error"></a>

#### api_test.objectDefaultMethod.error(message) ⇒ <code>string</code>
<p>Error method for objectDefaultMethod.</p>

**Kind**: static method of [<code>api_test.objectDefaultMethod</code>](#module_api_test.objectDefaultMethod)
**Returns**:

- <code>string</code> <p>Formatted message with ERROR prefix</p>



| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | <p>Message to log.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
```



* * *

<a name="api_test.module_rootFunction"></a>

### api_test.rootFunction : <code>object</code>
<p>Root-level function exports for greeting functionality. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.module_rootFunction.greet"></a>

#### api_test.rootFunction.greet(name) ⇒ <code>string</code>
<p>Greets a name (default export).
This is the main callable API function.
Accessed as <code>api()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.rootFunction</code>](#api_test.module_rootFunction)

**Returns**:

- <code>string</code> <p>Greeting message</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to greet</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test('World')); // 'Hello, World!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test('World')); // 'Hello, World!'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test('World')); // 'Hello, World!'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test('World')); // 'Hello, World!'
```



* * *

<a name="module_api_test.rootFunctionShout"></a>

### api_test.rootFunctionShout(name) ⇒ <code>string</code>
<p>Shouts a greeting with uppercase formatting.
Accessed as <code>api.rootFunctionShout()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test</code>](#module_api_test)

**Returns**:

- <code>string</code> <p>Uppercase greeting message</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to greet loudly</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootFunctionShout('World')); // 'HELLO, WORLD!'
```



* * *

<a name="module_api_test.rootFunctionWhisper"></a>

### api_test.rootFunctionWhisper(name) ⇒ <code>string</code>
<p>Whispers a greeting with lowercase formatting.
Accessed as <code>api.rootFunctionWhisper()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test</code>](#module_api_test)

**Returns**:

- <code>string</code> <p>Lowercase greeting message</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to greet quietly</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootFunctionWhisper('World')); // 'hello, world.'
```



* * *

<a name="module_api_test.rootMath"></a>

### api_test.rootMath : <code>object</code>
<p>Math API object with basic arithmetic operations.
Provides add and multiply functions for testing mathematical operations in slothlet.
Accessed as <code>api.rootMath</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test</code>](#module_api_test)


* * *

<a name="module_api_test.rootMath.add"></a>

#### api_test.rootMath.add(a, b) ⇒ <code>number</code>
<p>Adds two numbers together.</p>

**Kind**: static method of [<code>api_test.rootMath</code>](#module_api_test.rootMath)
**Returns**:

- <code>number</code> <p>The sum of a and b</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to add</p> |
| b | <code>number</code> | <p>Second number to add</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootMath.add(5, 7)); // 12
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootMath.add(5, 7)); // 12}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootMath.add(5, 7)); // 12})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootMath.add(5, 7)); // 12
```



* * *

<a name="module_api_test.rootMath.multiply"></a>

#### api_test.rootMath.multiply(a, b) ⇒ <code>number</code>
<p>Multiplies two numbers together.</p>

**Kind**: static method of [<code>api_test.rootMath</code>](#module_api_test.rootMath)
**Returns**:

- <code>number</code> <p>The product of a and b</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to multiply</p> |
| b | <code>number</code> | <p>Second number to multiply</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootMath.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootMath.multiply(4, 6)); // 24}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootMath.multiply(4, 6)); // 24})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootMath.multiply(4, 6)); // 24
```



* * *

<a name="module_api_test.rootstring"></a>

### api_test.rootstring : <code>object</code>
<p>String manipulation API object with common string operations.
Provides uppercase and reverse functions for testing string operations in slothlet.
Accessed as <code>api.rootstring</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test</code>](#module_api_test)


* * *

<a name="module_api_test.rootstring.upper"></a>

#### api_test.rootstring.upper(str) ⇒ <code>string</code>
<p>Converts a string to uppercase.</p>

**Kind**: static method of [<code>api_test.rootstring</code>](#module_api_test.rootstring)
**Returns**:

- <code>string</code> <p>The uppercased string</p>



| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | <p>String to convert to uppercase</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootstring.upper('hello')); // 'HELLO'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootstring.upper('hello')); // 'HELLO'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootstring.upper('hello')); // 'HELLO'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootstring.upper('hello')); // 'HELLO'
```



* * *

<a name="module_api_test.rootstring.reverse"></a>

#### api_test.rootstring.reverse(str) ⇒ <code>string</code>
<p>Reverses a string character by character.</p>

**Kind**: static method of [<code>api_test.rootstring</code>](#module_api_test.rootstring)
**Returns**:

- <code>string</code> <p>The reversed string</p>



| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | <p>String to reverse</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootstring.reverse('hello')); // 'olleh'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootstring.reverse('hello')); // 'olleh'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.rootstring.reverse('hello')); // 'olleh'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.rootstring.reverse('hello')); // 'olleh'
```



* * *

<a name="module_api_test.string"></a>

### api_test.string : <code>object</code>
<p>String manipulation API object for testing auto-flattening.
This module tests slothlet's ability to flatten single-file folder structures.
Accessed as <code>api.string</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test</code>](#module_api_test)


* * *

<a name="module_api_test.string.upper"></a>

#### api_test.string.upper(str) ⇒ <code>string</code>
<p>Converts a string to uppercase.</p>

**Kind**: static method of [<code>api_test.string</code>](#module_api_test.string)
**Returns**:

- <code>string</code> <p>The uppercased string</p>



| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | <p>String to convert to uppercase</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.string.upper('world')); // 'WORLD'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.string.upper('world')); // 'WORLD'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.string.upper('world')); // 'WORLD'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.string.upper('world')); // 'WORLD'
```



* * *

<a name="module_api_test.string.reverse"></a>

#### api_test.string.reverse(str) ⇒ <code>string</code>
<p>Reverses a string character by character.</p>

**Kind**: static method of [<code>api_test.string</code>](#module_api_test.string)
**Returns**:

- <code>string</code> <p>The reversed string</p>



| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | <p>String to reverse</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.string.reverse('world')); // 'dlrow'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.string.reverse('world')); // 'dlrow'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.string.reverse('world')); // 'dlrow'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.string.reverse('world')); // 'dlrow'
```



* * *

<a name="api_test.task.module_autoIp"></a>

#### api_test.task.autoIp : <code>object</code>
<p>Auto IP detection functionality for testing task modules. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.task.module_autoIp.autoIP"></a>

##### api_test.task.autoIp.autoIP() ⇒ <code>Promise.&lt;string&gt;</code>
<p>Automatically detects IP configuration.
Accessed as <code>api.task.autoIp()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.task.autoIp</code>](#api_test.task.module_autoIp)

**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>The string &quot;testAutoIP&quot;.</p>


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(await api_test.task.autoIp()); // "testAutoIP"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(await api_test.task.autoIp()); // "testAutoIP"}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(await api_test.task.autoIp()); // "testAutoIP"})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(await api_test.task.autoIp()); // "testAutoIP"
```



* * *

<a name="api_test.util.module_url"></a>

#### api_test.util.url : <code>object</code>
<p>URL utility functions for testing endpoint cleaning and URL building. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.util.module_url.cleanEndpoint"></a>

##### api_test.util.url.cleanEndpoint(endpoint, siteKey, variables, apiEndPointVersionOverride, apiEndPointTypeOverride) ⇒ <code>string</code>
<p>Stub for cleanEndpoint. Returns the function name as a string.
Accessed as <code>api.util.url.cleanEndpoint()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.util.url</code>](#api_test.util.module_url)

**Returns**:

- <code>string</code> <p>The string &quot;cleanEndpoint&quot;.</p>



| Param | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | <p>The endpoint to clean.</p> |
| siteKey | <code>boolean | string</code> | <p>Site key or boolean flag.</p> |
| variables | <code>object</code> | <p>Variables object.</p> |
| apiEndPointVersionOverride | <code>boolean | string</code> | <p>API version override.</p> |
| apiEndPointTypeOverride | <code>boolean | string</code> | <p>API type override.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.url.cleanEndpoint('sites_list', { site: 'default' })); // "cleanEndpoint"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.url.cleanEndpoint('sites_list', { site: 'default' })); // "cleanEndpoint"}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.url.cleanEndpoint('sites_list', { site: 'default' })); // "cleanEndpoint"})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.url.cleanEndpoint('sites_list', { site: 'default' })); // "cleanEndpoint"
```



* * *

<a name="api_test.util.module_url.buildUrlWithParams"></a>

##### api_test.util.url.buildUrlWithParams(str, params) ⇒ <code>string</code>
<p>Stub for buildUrlWithParams. Returns the function name as a string.
Accessed as <code>api.util.url.buildUrlWithParams()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.util.url</code>](#api_test.util.module_url)

**Returns**:

- <code>string</code> <p>The string &quot;buildUrlWithParams&quot;.</p>



| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | <p>Base string/URL to build upon.</p> |
| params | <code>Object</code> | <p>Parameters object to append.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"
```



* * *

<a name="api_test.util.module_util"></a>

#### api_test.util.util : <code>object</code>
<p>Utility functions module for testing nested namespace behavior. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)


* * *

<a name="api_test.util.module_util.size"></a>

##### api_test.util.util.size(variable) ⇒ <code>string</code>
<p>Returns a string indicating size functionality.
Accessed as <code>api.util.size()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.util.util</code>](#api_test.util.module_util)

**Returns**:

- <code>string</code> <p>The string &quot;size&quot;.</p>



| Param | Type | Description |
| --- | --- | --- |
| variable | <code>*</code> | <p>Variable parameter (currently unused).</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.util.size('test')); // 'size'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.util.size('test')); // 'size'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.util.size('test')); // 'size'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.util.size('test')); // 'size'
```



* * *

<a name="api_test.util.module_util.secondFunc"></a>

##### api_test.util.util.secondFunc(variable) ⇒ <code>string</code>
<p>Returns a string indicating second function functionality.
Accessed as <code>api.util.secondFunc()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test.util.util</code>](#api_test.util.module_util)

**Returns**:

- <code>string</code> <p>The string &quot;secondFunc&quot;.</p>



| Param | Type | Description |
| --- | --- | --- |
| variable | <code>*</code> | <p>Variable parameter (currently unused).</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test = await slothlet({ dir: './api_tests/api_test' });  console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test = await slothlet({ dir: './api_tests/api_test' });console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'
```



* * *

<a name="module_api_test_advanced"></a>

### api_test.advanced : <code>object</code>
Namespace for advanced modules.

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)

* * *

<a name="module_api_test_advanced.nest2"></a>

### api_test.advanced.nest2 : <code>object</code>
Namespace for advanced.nest2 modules.

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)

* * *

<a name="module_api_test_advanced.nest4"></a>

### api_test.advanced.nest4 : <code>object</code>
Namespace for advanced.nest4 modules.

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)

* * *

<a name="module_api_test_multi"></a>

### api_test.multi : <code>object</code>
Namespace for multi modules.

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)

* * *

<a name="module_api_test_nested"></a>

### api_test.nested : <code>object</code>
Namespace for nested modules.

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)

* * *

<a name="module_api_test_task"></a>

### api_test.task : <code>object</code>
Namespace for task modules.

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)

* * *

<a name="module_api_test_util"></a>

### api_test.util : <code>object</code>
Namespace for util modules.

**Kind**: static namespace of [<code>api_test</code>](#module_api_test)

* * *


<!-- ORPHANED FUNCTIONS: 30 functions not attached to modules -->
<!-- Orphaned function names: hello (memberof: api_test.advanced.nest2.module:alpha), world (memberof: api_test.advanced.nest2.module:beta), addViaSelf (memberof: api_test.advanced.module:selfObject), add (memberof: api_test.module:math), multiply (memberof: api_test.module:math), hello (memberof: api_test.multi_func.module:beta), uniqueOne (memberof: api_test.module:multi_func), uniqueTwo (memberof: api_test.module:multi_func), uniqueThree (memberof: api_test.module:multi_func), multi_func_hello (memberof: api_test.module:multi_func), hello (memberof: api_test.multi.module:alpha), world (memberof: api_test.multi.module:beta), today (memberof: api_test.nested.module:date), default (memberof: api_test.module:objectDefaultMethod), info (memberof: api_test.module:objectDefaultMethod), warn (memberof: api_test.module:objectDefaultMethod), error (memberof: api_test.module:objectDefaultMethod), add (memberof: api_test.module:rootMath), multiply (memberof: api_test.module:rootMath), upper (memberof: api_test.module:rootstring), reverse (memberof: api_test.module:rootstring), upper (memberof: api_test.module:string), reverse (memberof: api_test.module:string), getDefault (memberof: api_test.util.module:controller), detectEndpointType (memberof: api_test.util.module:controller), detectDeviceType (memberof: api_test.util.module:controller), data (memberof: api_test.util.module:extract), section (memberof: api_test.util.module:extract), NVRSection (memberof: api_test.util.module:extract), parseDeviceName (memberof: api_test.util.module:extract) -->





