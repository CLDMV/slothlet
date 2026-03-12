<a id="api_test_reserved_name"></a>

## @cldmv/slothlet/api\_tests/api\_test\_reserved\_name
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_reserved_name API surface documented for reference.</p>
> 


**Structure**

  * [.slothlet](#api_test_reserved_name~slothlet)
    * [.greet()](#api_test_reserved_name_dot_slothlet_dot_greet) ⇒ <code>string</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
```





* * *

<a id="api_test_reserved_name~slothlet"></a>

### api_test_reserved_name.slothlet
> 
**Kind**: inner namespace of [<code>api_test_reserved_name</code>](#api_test_reserved_name)


* * *

<a id="api_test_reserved_name_dot_slothlet_dot_greet"></a>

### greet() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>A stub function — the filename &quot;slothlet&quot; conflicts with the reserved namespace.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>A simple string.</p>


**Example**
```js
slothlet.slothlet.greet(); // "hello"
```






