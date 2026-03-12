<a id="api_test_single_root_fn"></a>

## @cldmv/slothlet/api\_tests/api\_test\_single\_root\_fn
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_single_root_fn API surface documented for reference.</p>
> 


**Structure**

  * [.helper](#api_test_single_root_fn~helper)
    * [.helperFn(value)](#api_test_single_root_fn_dot_helper_dot_helperFn) ⇒ <code>string</code>
  * [.root](#api_test_single_root_fn~root)
    * [.rootFn(input)](#api_test_single_root_fn_dot_root_dot_rootFn) ⇒ <code>string</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
```





* * *

<a id="api_test_single_root_fn~helper"></a>

### api_test_single_root_fn.helper
> 
**Kind**: inner namespace of [<code>api_test_single_root_fn</code>](#api_test_single_root_fn)


* * *

<a id="api_test_single_root_fn_dot_helper_dot_helperFn"></a>

### helperFn(value) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Named export helper functions.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>string</code> |  | <p>Input value</p> |


**Returns**:

- <code>string</code> <p>Processed value</p>



* * *

<a id="api_test_single_root_fn~root"></a>

### api_test_single_root_fn.root
> 
**Kind**: inner namespace of [<code>api_test_single_root_fn</code>](#api_test_single_root_fn)


* * *

<a id="api_test_single_root_fn_dot_root_dot_rootFn"></a>

### rootFn(input) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Single root function - acts as the callable API root.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [input] | <code>string</code> | <code>"world"</code> | <p>Input string</p> |


**Returns**:

- <code>string</code> <p>Greeting</p>


**Example**
```js
const api = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
api.root('world'); // 'root:world'
```






