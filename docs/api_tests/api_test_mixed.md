
<a name="module_api_test_mixed"></a>

## @cldmv/slothlet/api\_tests/api\_test\_mixed
<p><strong style="font-size: 1.1em;"><p>Mixed ESM/CJS test modules for slothlet interoperability.</p></strong></p>
<p>This module provides test objects and functions for validating slothlet's ability to load and manage both ESM (.mjs) and CommonJS (.cjs) modules within the same API structure. It includes math operations, interoperability testing utilities, and live binding validation across different module systems.</p>


* [api_test_mixed](#module_api_test_mixed)
        * [.interopCjs](#module_api_test_mixed.interop.interopCjs) : <code>object</code>
        * [.interopEsm](#module_api_test_mixed.interop.interopEsm) : <code>object</code>
    * [.mathCjs](#module_api_test_mixed.mathCjs) : <code>object</code>
    * [.mathEsm](#module_api_test_mixed.mathEsm) : <code>object</code>
    * [.interop](#module_api_test_mixed_interop) : <code>object</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
```




* * *

<a name="module_api_test_mixed.mathCjs"></a>

### api_test_mixed.mathCjs : <code>object</code>
<p>Math operations object accessed as <code>api.mathCjs</code>.</p>

**Kind**: static constant of [<code>api_test_mixed</code>](#module_api_test_mixed)


* * *

<a name="module_api_test_mixed.mathCjs.multiply"></a>

#### api_test_mixed.mathCjs.multiply(a, b) ⇒ <code>Promise.&lt;number&gt;</code>
<p>Multiplies two numbers with CJS live binding testing.</p>

**Kind**: static method of [<code>api_test_mixed.mathCjs</code>](#module_api_test_mixed.mathCjs)
**Returns**:

- <code>Promise.&lt;number&gt;</code> <p>The product of a and b.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to multiply.</p> |
| b | <code>number</code> | <p>Second number to multiply.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });  console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });  console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
```



* * *

<a name="module_api_test_mixed.mathCjs.divide"></a>

#### api_test_mixed.mathCjs.divide(a, b) ⇒ <code>Promise.&lt;number&gt;</code>
<p>Divides two numbers with CJS live binding testing.</p>

**Kind**: static method of [<code>api_test_mixed.mathCjs</code>](#module_api_test_mixed.mathCjs)
**Returns**:

- <code>Promise.&lt;number&gt;</code> <p>The quotient of a and b.</p>


**Throws**:

- <code>Error</code> <p>When dividing by zero.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>Number to divide.</p> |
| b | <code>number</code> | <p>Number to divide by.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });  console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });  console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
```



* * *

<a name="module_api_test_mixed.mathEsm"></a>

### api_test_mixed.mathEsm : <code>object</code>
<p>Math operations object accessed as <code>api.mathEsm</code>.</p>

**Kind**: static constant of [<code>api_test_mixed</code>](#module_api_test_mixed)


* * *

<a name="module_api_test_mixed.mathEsm.add"></a>

#### api_test_mixed.mathEsm.add(a, b) ⇒ <code>number</code>
<p>Adds two numbers.</p>

**Kind**: static method of [<code>api_test_mixed.mathEsm</code>](#module_api_test_mixed.mathEsm)
**Returns**:

- <code>number</code> <p>The sum of a and b.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to add.</p> |
| b | <code>number</code> | <p>Second number to add.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });  console.log(api_test_mixed.mathEsm.add(2, 3)); // 5}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {	({ slothlet } = await import("@cldmv/slothlet"));	const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });	console.log(api_test_mixed.mathEsm.add(2, 3)); // 5})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
```



* * *

<a name="module_api_test_mixed.mathEsm.subtract"></a>

#### api_test_mixed.mathEsm.subtract(a, b) ⇒ <code>number</code>
<p>Subtracts two numbers.</p>

**Kind**: static method of [<code>api_test_mixed.mathEsm</code>](#module_api_test_mixed.mathEsm)
**Returns**:

- <code>number</code> <p>The difference of a and b.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>Number to subtract from.</p> |
| b | <code>number</code> | <p>Number to subtract.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });  console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });  console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
```



* * *

<a name="module_api_test_mixed_interop"></a>

### api_test_mixed.interop : <code>object</code>
Namespace for interop modules.

**Kind**: static namespace of [<code>api_test_mixed</code>](#module_api_test_mixed)

* * *


<!-- ORPHANED FUNCTIONS: 6 functions not attached to modules -->
<!-- Orphaned function names: testCrossCall (memberof: api_test_mixed.interop.module:interopCjs), testCrossCall (memberof: api_test_mixed.interop.module:interopEsm), multiply (memberof: api_test_mixed.module:mathCjs), divide (memberof: api_test_mixed.module:mathCjs), add (memberof: api_test_mixed.module:mathEsm), subtract (memberof: api_test_mixed.module:mathEsm) -->





