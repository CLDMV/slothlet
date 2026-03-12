<a id="api_test_builtin_types"></a>

## @cldmv/slothlet/api\_tests/api\_test\_builtin\_types
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_builtin_types API surface documented for reference.</p>
> 


**Structure**

  * [.types](#api_test_builtin_types~types)
    * [.getVersion()](#api_test_builtin_types_dot_types_dot_getVersion)


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_builtin_types = await slothlet({ dir: './api_tests/api_test_builtin_types' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_builtin_types = await slothlet({ dir: './api_tests/api_test_builtin_types' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_builtin_types = await slothlet({ dir: './api_tests/api_test_builtin_types' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_builtin_types = await slothlet({ dir: './api_tests/api_test_builtin_types' });
```





* * *

<a id="api_test_builtin_types~types"></a>

### api_test_builtin_types.types
> 
**Kind**: inner namespace of [<code>api_test_builtin_types</code>](#api_test_builtin_types)


* * *

<a id="api_test_builtin_types_dot_types_dot_getVersion"></a>

### getVersion()
> <p><strong style="font-size: 1.1em;"><p>A plain async function to confirm that a normal callable also works in the same module.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)





