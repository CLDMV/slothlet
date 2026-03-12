<a id="api_test_primitives"></a>

## @cldmv/slothlet/api\_tests/api\_test\_primitives
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_primitives API surface documented for reference.</p>
> 


**Structure**

  * [.boolval](#api_test_primitives~boolval)
  * [.numval](#api_test_primitives~numval)
  * [.strval](#api_test_primitives~strval)


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_primitives = await slothlet({ dir: './api_tests/api_test_primitives' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_primitives = await slothlet({ dir: './api_tests/api_test_primitives' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_primitives = await slothlet({ dir: './api_tests/api_test_primitives' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_primitives = await slothlet({ dir: './api_tests/api_test_primitives' });
```





* * *

<a id="api_test_primitives~boolval"></a>

### api_test_primitives.boolval
> 
**Kind**: inner namespace of [<code>api_test_primitives</code>](#api_test_primitives)


* * *

<a id="api_test_primitives~numval"></a>

### api_test_primitives.numval
> 
**Kind**: inner namespace of [<code>api_test_primitives</code>](#api_test_primitives)


* * *

<a id="api_test_primitives~strval"></a>

### api_test_primitives.strval
> 
**Kind**: inner namespace of [<code>api_test_primitives</code>](#api_test_primitives)





