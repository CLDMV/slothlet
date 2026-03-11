<a id="api_test_collisions"></a>

## @cldmv/slothlet/api\_tests/api\_test\_collisions
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_collisions API surface documented for reference.</p>
> 


**Structure**

[api_test_collisions](#api_test_collisions)
  * [.collections](#api_test_collisions~collections)
  * [.dir1](#api_test_collisions~dir1)
    * [.testFunc](#api_test_collisions_dot_dir1~testFunc)
  * [.dir2](#api_test_collisions~dir2)
    * [.testFunc](#api_test_collisions_dot_dir2~testFunc)
  * [.mathFile](#api_test_collisions~mathFile)
    * [.sqrt(n)](#api_test_collisions_dot_mathFile_dot_sqrt) ⇒ <code><code>number</code></code>
    * [.modulo(a, b)](#api_test_collisions_dot_mathFile_dot_modulo) ⇒ <code><code>number</code></code>
    * [.collisionVersion](#api_test_collisions_dot_mathFile_dot_collisionVersion)
  * [.math](#api_test_collisions~math)
    * [.add(a, b)](#api_test_collisions_dot_math_dot_add) ⇒ <code><code>number</code></code>
    * [.multiply(a, b)](#api_test_collisions_dot_math_dot_multiply) ⇒ <code><code>number</code></code>
    * [.divide(a, b)](#api_test_collisions_dot_math_dot_divide) ⇒ <code><code>number</code></code>
  * [.parent](#api_test_collisions~parent)
    * [.mathFile](#api_test_collisions_dot_parent~mathFile)
      * [.sqrt(n)](#api_test_collisions_dot_mathFile_dot_sqrt) ⇒ <code><code>number</code></code>
      * [.modulo(a, b)](#api_test_collisions_dot_mathFile_dot_modulo) ⇒ <code><code>number</code></code>
      * [.collisionVersion](#api_test_collisions_dot_mathFile_dot_collisionVersion)
    * [.math](#api_test_collisions_dot_parent~math)
      * [.add(a, b)](#api_test_collisions_dot_math_dot_add) ⇒ <code><code>number</code></code>
      * [.multiply(a, b)](#api_test_collisions_dot_math_dot_multiply) ⇒ <code><code>number</code></code>
      * [.divide(a, b)](#api_test_collisions_dot_math_dot_divide) ⇒ <code><code>number</code></code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
```





* * *

<a id="api_test_collisions"></a>

### api_test_collisions
> <p><strong style="font-size: 1.1em;"><p>Collision scenario modules for slothlet file-vs-folder collision testing.</p></strong></p>
> 
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
```



* * *

<a id="api_test_collisions~collections"></a>

### api_test_collisions.collections
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions~dir1"></a>

### api_test_collisions.dir1
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_dir1~testFunc"></a>

### testFunc
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_collisions~dir2"></a>

### api_test_collisions.dir2
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_dir2~testFunc"></a>

### testFunc
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_collisions~mathFile"></a>

### api_test_collisions.mathFile
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_mathFile_dot_sqrt"></a>

### sqrt(n) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculate square root of a number.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| n | <code>number</code> |  | <p>The number.</p> |


**Returns**:

- <code>number</code> <p>The square root.</p>



* * *

<a id="api_test_collisions_dot_mathFile_dot_modulo"></a>

### modulo(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculate modulo of two numbers.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number.</p> |
| b | <code>number</code> |  | <p>Second number.</p> |


**Returns**:

- <code>number</code> <p>The remainder.</p>



* * *

<a id="api_test_collisions_dot_mathFile_dot_collisionVersion"></a>

### collisionVersion
> <p><strong style="font-size: 1.1em;"><p>Version identifier for collision detection.</p></strong></p>
> 
**Kind**: static constant of [<code></code>](#undefined)


* * *

<a id="api_test_collisions~math"></a>

### api_test_collisions.math
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_math_dot_add"></a>

### add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to add</p> |
| b | <code>number</code> |  | <p>Second number to add</p> |


**Returns**:

- <code>number</code> <p>The sum of a and b</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(5, 7)); // 12
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(5, 7)); // 12
```



* * *

<a id="api_test_collisions_dot_math_dot_multiply"></a>

### multiply(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Multiplies two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to multiply</p> |
| b | <code>number</code> |  | <p>Second number to multiply</p> |


**Returns**:

- <code>number</code> <p>The product of a and b</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```



* * *

<a id="api_test_collisions_dot_math_dot_divide"></a>

### divide(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Divides two numbers.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>Numerator</p> |
| b | <code>number</code> |  | <p>Denominator</p> |


**Returns**:

- <code>number</code> <p>The quotient of a divided by b</p>


**Throws**:

- <code>Error</code> <p>If denominator is zero</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.divide(10, 2)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.divide(10, 2)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.divide(10, 2)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.divide(10, 2)); // 5
```



* * *

<a id="api_test_collisions~parent"></a>

### api_test_collisions.parent
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_parent~mathFile"></a>

### mathFile
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_collisions_dot_mathFile_dot_sqrt"></a>

### sqrt(n) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculate square root of a number.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| n | <code>number</code> |  | <p>The number.</p> |


**Returns**:

- <code>number</code> <p>The square root.</p>



* * *

<a id="api_test_collisions_dot_mathFile_dot_modulo"></a>

### modulo(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculate modulo of two numbers.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number.</p> |
| b | <code>number</code> |  | <p>Second number.</p> |


**Returns**:

- <code>number</code> <p>The remainder.</p>



* * *

<a id="api_test_collisions_dot_mathFile_dot_collisionVersion"></a>

### collisionVersion
> <p><strong style="font-size: 1.1em;"><p>Version identifier for collision detection.</p></strong></p>
> 
**Kind**: static constant of [<code></code>](#undefined)


* * *

<a id="api_test_collisions_dot_parent~math"></a>

### math
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_collisions_dot_math_dot_add"></a>

### add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to add</p> |
| b | <code>number</code> |  | <p>Second number to add</p> |


**Returns**:

- <code>number</code> <p>The sum of a and b</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(5, 7)); // 12
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.add(5, 7)); // 12
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.add(5, 7)); // 12
```



* * *

<a id="api_test_collisions_dot_math_dot_multiply"></a>

### multiply(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Multiplies two numbers together.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number to multiply</p> |
| b | <code>number</code> |  | <p>Second number to multiply</p> |


**Returns**:

- <code>number</code> <p>The product of a and b</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.multiply(4, 6)); // 24
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.multiply(4, 6)); // 24
```



* * *

<a id="api_test_collisions_dot_math_dot_divide"></a>

### divide(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Divides two numbers.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>Numerator</p> |
| b | <code>number</code> |  | <p>Denominator</p> |


**Returns**:

- <code>number</code> <p>The quotient of a divided by b</p>


**Throws**:

- <code>Error</code> <p>If denominator is zero</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.divide(10, 2)); // 5
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.divide(10, 2)); // 5
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test = await slothlet({ dir: './api_tests/api_test' });
  console.log(api_test.math.divide(10, 2)); // 5
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test = await slothlet({ dir: './api_tests/api_test' });
console.log(api_test.math.divide(10, 2)); // 5
```






