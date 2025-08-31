<a id="api_test_mixed"></a>

## @cldmv/slothlet/api\_tests/api\_test\_mixed
> <p>This module provides test objects and functions for validating slothlet's ability to load and manage both ESM (.mjs) and CommonJS (.cjs) modules within the same API structure. It includes math operations, interoperability testing utilities, and live binding validation across different module systems.</p>
> 


**Structure**

[api_test_mixed](#api_test_mixed)
  * [.interop](#api_test_mixed_dot_interop)
    * [.multiply(a, b)](#api_test_mixed_dot_mathCjs_dot_multiply) ⇒ <code><code>Promise.&lt;number&gt;</code></code>
    * [.divide(a, b)](#api_test_mixed_dot_mathCjs_dot_divide) ⇒ <code><code>Promise.&lt;number&gt;</code></code>
    * [.add(a, b)](#api_test_mixed_dot_mathEsm_dot_add) ⇒ <code><code>number</code></code>
    * [.subtract(a, b)](#api_test_mixed_dot_mathEsm_dot_subtract) ⇒ <code><code>number</code></code>


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

<a id="api_test_mixed"></a>

### api_test_mixed
> <p><strong style="font-size: 1.1em;"><p>Mixed ESM/CJS test modules for slothlet interoperability.</p></strong></p>
> 
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

<a id="api_test_mixed_dot_interop"></a>

### api_test_mixed.interop
> <p><strong style="font-size: 1.1em;">Auto-generated namespace for interop components.</strong></p>
> 
**Kind**: static namespace of [<code>api_test_mixed</code>](#api_test_mixed)


* * *

<a id="api_test_mixed_dot_interop_dot_interopCjs"></a>

### api_test_mixed.interop.interopCjs
> <p><strong style="font-size: 1.1em;"><p>CJS interoperability object for testing cross-module calls and live bindings.
> Tests interoperability between CJS and ESM modules via live bindings.
> Accessed as <code>api.interop.interopCjs</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test_mixed.interop</code>](#api_test_mixed_dot_interop)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
```



* * *

<a id="api_test_mixed_dot_interop_dot_interopEsm"></a>

### api_test_mixed.interop.interopEsm
> <p><strong style="font-size: 1.1em;"><p>ESM interoperability object for testing cross-module calls and live bindings.
> Tests interoperability between ESM and CJS modules via live bindings.
> Accessed as <code>api.interop.interopEsm</code> in the slothlet API.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test_mixed.interop</code>](#api_test_mixed_dot_interop)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
```



* * *

<a id="api_test_mixed_dot_mathCjs"></a>

### api_test_mixed.mathCjs
> <p><strong style="font-size: 1.1em;"><p>Math operations object accessed as <code>api.mathCjs</code>.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test_mixed</code>](#api_test_mixed)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
```



* * *

<a id="api_test_mixed_dot_mathCjs_dot_multiply"></a>

### api_test_mixed.mathCjs.multiply(a, b) ⇒ <code>Promise.&lt;number&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Multiplies two numbers with CJS live binding testing.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test_mixed.mathCjs</code>](#api_test_mixed_dot_mathCjs)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to multiply.</p> |
| b | <code>number</code> |  | <p>Second number to multiply.</p> |


**Returns**:

- <code>Promise.&lt;number&gt;</code> <p>The product of a and b.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
```



* * *

<a id="api_test_mixed_dot_mathCjs_dot_divide"></a>

### api_test_mixed.mathCjs.divide(a, b) ⇒ <code>Promise.&lt;number&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Divides two numbers with CJS live binding testing.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test_mixed.mathCjs</code>](#api_test_mixed_dot_mathCjs)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>Number to divide.</p> |
| b | <code>number</code> |  | <p>Number to divide by.</p> |


**Returns**:

- <code>Promise.&lt;number&gt;</code> <p>The quotient of a and b.</p>


**Throws**:

- <code>Error</code> <p>When dividing by zero.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
```



* * *

<a id="api_test_mixed_dot_mathEsm"></a>

### api_test_mixed.mathEsm
> <p><strong style="font-size: 1.1em;"><p>Math operations object accessed as <code>api.mathEsm</code>.</p></strong></p>
> 
**Kind**: static constant of [<code>api_test_mixed</code>](#api_test_mixed)

**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
```



* * *

<a id="api_test_mixed_dot_mathEsm_dot_add"></a>

### api_test_mixed.mathEsm.add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test_mixed.mathEsm</code>](#api_test_mixed_dot_mathEsm)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to add.</p> |
| b | <code>number</code> |  | <p>Second number to add.</p> |


**Returns**:

- <code>number</code> <p>The sum of a and b.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
```



* * *

<a id="api_test_mixed_dot_mathEsm_dot_subtract"></a>

### api_test_mixed.mathEsm.subtract(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Subtracts two numbers.</p></strong></p>
> 
**Kind**: inner method of [<code>api_test_mixed.mathEsm</code>](#api_test_mixed_dot_mathEsm)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>Number to subtract from.</p> |
| b | <code>number</code> |  | <p>Number to subtract.</p> |


**Returns**:

- <code>number</code> <p>The difference of a and b.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import('@cldmv/slothlet'));
  const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
  console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
```






