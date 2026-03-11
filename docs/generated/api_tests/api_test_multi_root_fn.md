<a id="api_test_multi_root_fn"></a>

## @cldmv/slothlet/api\_tests/api\_test\_multi\_root\_fn
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_multi_root_fn API surface documented for reference.</p>
> 


**Structure**

[api_test_multi_root_fn](#api_test_multi_root_fn)
  * [.doA](#api_test_multi_root_fn~doA)
    * [.doA()](#api_test_multi_root_fn_dot_doA) ⇒ <code>string</code>
  * [.doB](#api_test_multi_root_fn~doB)
    * [.doB()](#api_test_multi_root_fn_dot_doB) ⇒ <code>string</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
```





* * *

<a id="api_test_multi_root_fn"></a>

### api_test_multi_root_fn
> <p><strong style="font-size: 1.1em;"><p>Multiple-root function modules for slothlet API testing.</p></strong></p>
> 
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
```



* * *

<a id="api_test_multi_root_fn~doA"></a>

### api_test_multi_root_fn.doA
> 
**Kind**: inner namespace of [<code>api_test_multi_root_fn</code>](#api_test_multi_root_fn)


* * *

<a id="api_test_multi_root_fn_dot_doA"></a>

### doA.doA() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns result-a string.</p></strong></p>
> 
**Kind**: static method of [<code>api_test_multi_root_fn.doA</code>](#api_test_multi_root_fn_dot_doA)

**Returns**:

- <code>string</code> <p>'result-a'</p>


**Example**
```js
const api = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
api.doA(); // 'result-a'
```



* * *

<a id="api_test_multi_root_fn~doB"></a>

### api_test_multi_root_fn.doB
> 
**Kind**: inner namespace of [<code>api_test_multi_root_fn</code>](#api_test_multi_root_fn)


* * *

<a id="api_test_multi_root_fn_dot_doB"></a>

### doB.doB() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Returns result-b string.</p></strong></p>
> 
**Kind**: static method of [<code>api_test_multi_root_fn.doB</code>](#api_test_multi_root_fn_dot_doB)

**Returns**:

- <code>string</code> <p>'result-b'</p>


**Example**
```js
const api = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
api.doB(); // 'result-b'
```






