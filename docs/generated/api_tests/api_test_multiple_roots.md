<a id="api_test_multiple_roots"></a>

## @cldmv/slothlet/api\_tests/api\_test\_multiple\_roots
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_multiple_roots API surface documented for reference.</p>
> 


**Structure**

[api_test_multiple_roots](#api_test_multiple_roots)
  * [.conflict1](#api_test_multiple_roots~conflict1)
    * [.conflictingName()](#api_test_multiple_roots_dot_conflict1_dot_conflictingName) ⇒ <code><code>string</code></code>
  * [.conflict2](#api_test_multiple_roots~conflict2)
    * [.conflictingName()](#api_test_multiple_roots_dot_conflict2_dot_conflictingName) ⇒ <code><code>string</code></code>
  * [.overwriteTest1](#api_test_multiple_roots~overwriteTest1)
    * [.overwriteTest()](#api_test_multiple_roots_dot_overwriteTest1_dot_overwriteTest) ⇒ <code><code>string</code></code>
    * [.conflictingName()](#api_test_multiple_roots_dot_overwriteTest1_dot_conflictingName) ⇒ <code><code>string</code></code>
  * [.overwriteTest2](#api_test_multiple_roots~overwriteTest2)
    * [.overwriteTest()](#api_test_multiple_roots_dot_overwriteTest2_dot_overwriteTest) ⇒ <code><code>string</code></code>
    * [.conflictingName()](#api_test_multiple_roots_dot_overwriteTest2_dot_conflictingName) ⇒ <code><code>string</code></code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
```





* * *

<a id="api_test_multiple_roots"></a>

### api_test_multiple_roots
> <p><strong style="font-size: 1.1em;"><p>Multiple-root conflict modules for slothlet collision and overwrite testing.</p></strong></p>
> 
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
```



* * *

<a id="api_test_multiple_roots~conflict1"></a>

### api_test_multiple_roots.conflict1
> 
**Kind**: inner namespace of [<code>api_test_multiple_roots</code>](#api_test_multiple_roots)


* * *

<a id="api_test_multiple_roots_dot_conflict1_dot_conflictingName"></a>

### conflictingName() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Default callable — returns the string identifier for this conflict module.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>'from-file-1'</p>


**Example**
```js
api.conflict1(); // 'from-file-1'
```



* * *

<a id="api_test_multiple_roots~conflict2"></a>

### api_test_multiple_roots.conflict2
> 
**Kind**: inner namespace of [<code>api_test_multiple_roots</code>](#api_test_multiple_roots)


* * *

<a id="api_test_multiple_roots_dot_conflict2_dot_conflictingName"></a>

### conflictingName() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Default callable — returns the string identifier for this conflict module.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>'from-file-2'</p>


**Example**
```js
api.conflict2(); // 'from-file-2'
```



* * *

<a id="api_test_multiple_roots~overwriteTest1"></a>

### api_test_multiple_roots.overwriteTest1
> 
**Kind**: inner namespace of [<code>api_test_multiple_roots</code>](#api_test_multiple_roots)


* * *

<a id="api_test_multiple_roots_dot_overwriteTest1_dot_overwriteTest"></a>

### overwriteTest() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns the overwrite-test-1 identifier.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>'overwrite-test-1'</p>



* * *

<a id="api_test_multiple_roots_dot_overwriteTest1_dot_conflictingName"></a>

### conflictingName() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Named export that will be overwritten</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>Version identifier</p>



* * *

<a id="api_test_multiple_roots~overwriteTest2"></a>

### api_test_multiple_roots.overwriteTest2
> 
**Kind**: inner namespace of [<code>api_test_multiple_roots</code>](#api_test_multiple_roots)


* * *

<a id="api_test_multiple_roots_dot_overwriteTest2_dot_overwriteTest"></a>

### overwriteTest() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns the overwrite-test-2 identifier.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>'overwrite-test-2'</p>



* * *

<a id="api_test_multiple_roots_dot_overwriteTest2_dot_conflictingName"></a>

### conflictingName() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Named export attempting to overwrite the one from file 1</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>Version identifier</p>






