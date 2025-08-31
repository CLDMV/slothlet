
<a name="module_api_test_cjs"></a>

## @cldmv/slothlet/api\_tests/api\_test\_cjs
<p><strong style="font-size: 1.1em;"><p>CommonJS test modules for slothlet CJS interoperability.</p></strong></p>
<p>This module provides test objects and functions for validating slothlet's ability to load and manage CommonJS (.cjs) modules. It includes math operations, string utilities, and advanced nested structures for comprehensive CJS API testing.</p>


* [api_test_cjs](#module_api_test_cjs)
    * [.shout(name)](#module_api_test_cjs.shout) ⇒ <code>string</code>
        * [.selfObject](#module_api_test_cjs.advanced.selfObject) : <code>object</code>
    * [.math](#module_api_test_cjs.math) : <code>object</code>
    * [.rootFunction](#api_test_cjs.module_rootFunction) : <code>object</code>
        * [.greet(name)](#api_test_cjs.module_rootFunction.greet) ⇒ <code>string</code>
    * [.rootMath](#module_api_test_cjs.rootMath) : <code>object</code>
    * [.string](#module_api_test_cjs.string) : <code>object</code>
    * [.advanced](#module_api_test_cjs_advanced) : <code>object</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from '@cldmv/slothlet';
const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import('@cldmv/slothlet');
  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require('@cldmv/slothlet');
const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
```




* * *

<a name="module_api_test_cjs.math"></a>

### api_test_cjs.math : <code>object</code>
<p>Math API object with basic arithmetic operations for testing auto-flattening (CJS version).
This module tests slothlet's ability to flatten single-file folder structures.
Accessed as <code>api.math</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test_cjs</code>](#module_api_test_cjs)


* * *

<a name="module_api_test_cjs.math.add"></a>

#### api_test_cjs.math.add(a, b) ⇒ <code>number</code>
<p>Adds two numbers.</p>

**Kind**: static method of [<code>api_test_cjs.math</code>](#module_api_test_cjs.math)
**Returns**:

- <code>number</code> <p>The sum of a and b.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to add.</p> |
| b | <code>number</code> | <p>Second number to add.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.math.add(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.math.add(2, 3)); // 5}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.math.add(2, 3)); // 5})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.math.add(2, 3)); // 5
```



* * *

<a name="module_api_test_cjs.math.multiply"></a>

#### api_test_cjs.math.multiply(a, b) ⇒ <code>number</code>
<p>Multiplies two numbers.</p>

**Kind**: static method of [<code>api_test_cjs.math</code>](#module_api_test_cjs.math)
**Returns**:

- <code>number</code> <p>The product of a and b.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to multiply.</p> |
| b | <code>number</code> | <p>Second number to multiply.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.math.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.math.multiply(2, 3)); // 6}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.math.multiply(2, 3)); // 6})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.math.multiply(2, 3)); // 6
```



* * *

<a name="api_test_cjs.module_rootFunction"></a>

### api_test_cjs.rootFunction : <code>object</code>
<p>Root-level function module (CJS version) for testing slothlet loader with CommonJS modules. Internal file (not exported in package.json).</p>

**Kind**: static namespace of [<code>api_test_cjs</code>](#module_api_test_cjs)


* * *

<a name="api_test_cjs.module_rootFunction.greet"></a>

#### api_test_cjs.rootFunction.greet(name) ⇒ <code>string</code>
<p>Greets a name (default export, CJS version).
Accessed as the callable function <code>api()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test_cjs.rootFunction</code>](#api_test_cjs.module_rootFunction)

**Returns**:

- <code>string</code> <p>Greeting message.</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to greet.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs('World')); // 'Hello, World!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs('World')); // 'Hello, World!'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs('World')); // 'Hello, World!'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs('World')); // 'Hello, World!'
```



* * *

<a name="module_api_test_cjs.shout"></a>

### api_test_cjs.shout(name) ⇒ <code>string</code>
<p>Shouts a greeting.
Accessed as <code>api.rootFunctionShout()</code> in the slothlet API.</p>

**Kind**: static method of [<code>api_test_cjs</code>](#module_api_test_cjs)

**Returns**:

- <code>string</code> <p>Uppercased greeting message.</p>



| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | <p>Name to shout greeting for.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.rootFunctionShout('World')); // 'HELLO, WORLD!'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.rootFunctionShout('World')); // 'HELLO, WORLD!'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import('@cldmv/slothlet'));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.rootFunctionShout('World')); // 'HELLO, WORLD!'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.rootFunctionShout('World')); // 'HELLO, WORLD!'
```



* * *

<a name="module_api_test_cjs.rootMath"></a>

### api_test_cjs.rootMath : <code>object</code>
<p>Math API object with basic arithmetic operations (CJS version).
Provides add and multiply functions for testing mathematical operations in slothlet.
Accessed as <code>api.rootMath</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test_cjs</code>](#module_api_test_cjs)


* * *

<a name="module_api_test_cjs.rootMath.add"></a>

#### api_test_cjs.rootMath.add(a, b) ⇒ <code>number</code>
<p>Adds two numbers.</p>

**Kind**: static method of [<code>api_test_cjs.rootMath</code>](#module_api_test_cjs.rootMath)
**Returns**:

- <code>number</code> <p>The sum of a and b.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to add.</p> |
| b | <code>number</code> | <p>Second number to add.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.rootMath.add(2, 3)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.rootMath.add(2, 3)); // 5}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import("@cldmv/slothlet"));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.rootMath.add(2, 3)); // 5})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.rootMath.add(2, 3)); // 5
```



* * *

<a name="module_api_test_cjs.rootMath.multiply"></a>

#### api_test_cjs.rootMath.multiply(a, b) ⇒ <code>number</code>
<p>Multiplies two numbers.</p>

**Kind**: static method of [<code>api_test_cjs.rootMath</code>](#module_api_test_cjs.rootMath)
**Returns**:

- <code>number</code> <p>The product of a and b.</p>



| Param | Type | Description |
| --- | --- | --- |
| a | <code>number</code> | <p>First number to multiply.</p> |
| b | <code>number</code> | <p>Second number to multiply.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import("@cldmv/slothlet"));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
```



* * *

<a name="module_api_test_cjs.string"></a>

### api_test_cjs.string : <code>object</code>
<p>String API object with string manipulation operations for testing auto-flattening (CJS version).
This module tests slothlet's ability to flatten single-file folder structures.
Accessed as <code>api.string</code> in the slothlet API.</p>

**Kind**: static constant of [<code>api_test_cjs</code>](#module_api_test_cjs)


* * *

<a name="module_api_test_cjs.string.upper"></a>

#### api_test_cjs.string.upper(str) ⇒ <code>string</code>
<p>Converts a string to uppercase.</p>

**Kind**: static method of [<code>api_test_cjs.string</code>](#module_api_test_cjs.string)
**Returns**:

- <code>string</code> <p>The uppercased string.</p>



| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | <p>String to convert to uppercase.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.string.upper('abc')); // 'ABC'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.string.upper('abc')); // 'ABC'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import("@cldmv/slothlet"));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.string.upper('abc')); // 'ABC'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.string.upper('abc')); // 'ABC'
```



* * *

<a name="module_api_test_cjs.string.reverse"></a>

#### api_test_cjs.string.reverse(str) ⇒ <code>string</code>
<p>Reverses a string.</p>

**Kind**: static method of [<code>api_test_cjs.string</code>](#module_api_test_cjs.string)
**Returns**:

- <code>string</code> <p>The reversed string.</p>



| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | <p>String to reverse.</p> |


**Example**
```js
// ESM usage via slothlet APIimport slothlet from '@cldmv/slothlet';const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.string.reverse('abc')); // 'cba'
```
**Example**
```js
// ESM usage via slothlet API (inside async function)async function example() {  const { default: slothlet } = await import('@cldmv/slothlet');  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.string.reverse('abc')); // 'cba'}
```
**Example**
```js
// CJS usage via slothlet API (top-level)let slothlet;(async () => {  ({ slothlet } = await import("@cldmv/slothlet"));  const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });  console.log(api_test_cjs.string.reverse('abc')); // 'cba'})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)const slothlet = require('@cldmv/slothlet');const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });console.log(api_test_cjs.string.reverse('abc')); // 'cba'
```



* * *

<a name="module_api_test_cjs_advanced"></a>

### api_test_cjs.advanced : <code>object</code>
Namespace for advanced modules.

**Kind**: static namespace of [<code>api_test_cjs</code>](#module_api_test_cjs)

* * *


<!-- ORPHANED FUNCTIONS: 7 functions not attached to modules -->
<!-- Orphaned function names: addViaSelf (memberof: api_test_cjs.advanced.module:selfObject), add (memberof: api_test_cjs.module:math), multiply (memberof: api_test_cjs.module:math), add (memberof: api_test_cjs.module:rootMath), multiply (memberof: api_test_cjs.module:rootMath), upper (memberof: api_test_cjs.module:string), reverse (memberof: api_test_cjs.module:string) -->





