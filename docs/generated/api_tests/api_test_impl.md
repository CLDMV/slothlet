<a id="api_test_impl"></a>

## @cldmv/slothlet/api\_tests/api\_test\_impl
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_impl API surface documented for reference.</p>
> 


**Structure**

  * [.math](#api_test_impl~math)
    * [.add(a, b)](#api_test_impl_dot_math_dot_add) ⇒ <code>number</code>
    * [.collisionVersion](#api_test_impl_dot_math_dot_collisionVersion)


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_impl = await slothlet({ dir: './api_tests/api_test_impl' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_impl = await slothlet({ dir: './api_tests/api_test_impl' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_impl = await slothlet({ dir: './api_tests/api_test_impl' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_impl = await slothlet({ dir: './api_tests/api_test_impl' });
```





* * *

<a id="api_test_impl~math"></a>

### api_test_impl.math
> 
**Kind**: inner namespace of [<code>api_test_impl</code>](#api_test_impl)


* * *

<a id="api_test_impl_dot_math_dot_add"></a>

### add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers together with a +2000 offset.
> Used to test collision resolution — this implementation co-exists with other math modules.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number</p> |
| b | <code>number</code> |  | <p>Second number</p> |


**Returns**:

- <code>number</code> <p>a + b + 2000</p>


**Example**
```js
const api = await slothlet({ dir: './api_tests/api_test_impl' });
api.math.add(1, 2); // 2003
```



* * *

<a id="api_test_impl_dot_math_dot_collisionVersion"></a>

### collisionVersion
> <p><strong style="font-size: 1.1em;"><p>Version identifier for collision detection.</p></strong></p>
> 
**Kind**: static constant of [<code></code>](#undefined)





