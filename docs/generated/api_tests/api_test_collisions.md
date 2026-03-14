<a id="api_test_collisions"></a>

## @cldmv/slothlet/api\_tests/api\_test\_collisions
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_collisions API surface documented for reference.</p>
> 


**Structure**

  * [.collections](#api_test_collisions_collections)
  * [.dir1](#api_test_collisions_dir1)
    * [.testFunc](#api_test_collisions_dot_dir1_testFunc)
  * [.dir2](#api_test_collisions_dir2)
    * [.testFunc](#api_test_collisions_dot_dir2_testFunc)
  * [.mathFile](#api_test_collisions_mathFile)
    * [.power(base, exponent)](#api_test_collisions_dot_mathFile_dot_power) ⇒ <code>*</code>
    * [.sqrt(n)](#api_test_collisions_dot_mathFile_dot_sqrt) ⇒ <code>number</code>
    * [.modulo(a, b)](#api_test_collisions_dot_mathFile_dot_modulo) ⇒ <code>number</code>
    * [.collisionVersion](#api_test_collisions_dot_mathFile_dot_collisionVersion)
  * [.math](#api_test_collisions_math)
    * [.add(a, b)](#api_test_collisions_dot_math_dot_add) ⇒ <code>number</code>
    * [.multiply(a, b)](#api_test_collisions_dot_math_dot_multiply) ⇒ <code>number</code>
    * [.divide(a, b)](#api_test_collisions_dot_math_dot_divide) ⇒ <code>number</code>
  * [.parent](#api_test_collisions_parent)
    * [.mathFile](#api_test_collisions_dot_parent_mathFile)
      * [.power(base, exponent)](#api_test_collisions_dot_parent_dot_mathFile_dot_power) ⇒ <code>*</code>
      * [.sqrt(num)](#api_test_collisions_dot_parent_dot_mathFile_dot_sqrt) ⇒ <code>*</code>
      * [.modulo(a, b)](#api_test_collisions_dot_parent_dot_mathFile_dot_modulo) ⇒ <code>*</code>
      * [.collisionVersion](#api_test_collisions_dot_mathFile_dot_collisionVersion)
    * [.math](#api_test_collisions_dot_parent_math)
      * [.add(a, b)](#api_test_collisions_dot_parent_dot_math_dot_add) ⇒ <code>*</code>
      * [.multiply(a, b)](#api_test_collisions_dot_parent_dot_math_dot_multiply) ⇒ <code>*</code>
      * [.divide(a, b)](#api_test_collisions_dot_parent_dot_math_dot_divide) ⇒ <code>*</code>


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

<a id="api_test_collisions_collections"></a>

### api_test_collisions.collections
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dir1"></a>

### api_test_collisions.dir1
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_dir1_testFunc"></a>

### testFunc
> 
**Kind**: inner namespace


* * *

<a id="api_test_collisions_dir2"></a>

### api_test_collisions.dir2
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_dir2_testFunc"></a>

### testFunc
> 
**Kind**: inner namespace


* * *

<a id="api_test_collisions_mathFile"></a>

### api_test_collisions.mathFile
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_mathFile_dot_power"></a>

### power(base, exponent) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>power.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| base | <code>*</code> |  | <p>base.</p> |
| exponent | <code>*</code> |  | <p>exponent.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.math.power(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.math.power(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.math.power(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.math.power(null, null);
```



* * *

<a id="api_test_collisions_dot_mathFile_dot_sqrt"></a>

### sqrt(n) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculate square root of a number.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| n | <code>number</code> |  | <p>The number.</p> |


**Returns**:

- <code>number</code> <p>The square root.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.math.sqrt(1);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.math.sqrt(1);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.math.sqrt(1);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.math.sqrt(1);
```



* * *

<a id="api_test_collisions_dot_mathFile_dot_modulo"></a>

### modulo(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculate modulo of two numbers.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  | <p>First number.</p> |
| b | <code>number</code> |  | <p>Second number.</p> |


**Returns**:

- <code>number</code> <p>The remainder.</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.math.modulo(1, 1);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.math.modulo(1, 1);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.math.modulo(1, 1);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.math.modulo(1, 1);
```



* * *

<a id="api_test_collisions_dot_mathFile_dot_collisionVersion"></a>

### collisionVersion
> <p><strong style="font-size: 1.1em;"><p>Version identifier for collision detection.</p></strong></p>
> 
**Kind**: static constant


* * *

<a id="api_test_collisions_math"></a>

### api_test_collisions.math
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_math_dot_add"></a>

### add(a, b) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Adds two numbers together.</p></strong></p>
> 
**Kind**: inner method


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
**Kind**: inner method


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
**Kind**: inner method


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

<a id="api_test_collisions_parent"></a>

### api_test_collisions.parent
> 
**Kind**: inner namespace of [<code>api_test_collisions</code>](#api_test_collisions)


* * *

<a id="api_test_collisions_dot_parent_mathFile"></a>

### mathFile
> 
**Kind**: inner namespace


* * *

<a id="api_test_collisions_dot_parent_dot_mathFile_dot_power"></a>

### power(base, exponent) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>power.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| base | <code>*</code> |  | <p>base.</p> |
| exponent | <code>*</code> |  | <p>exponent.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.power(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.power(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.power(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.power(null, null);
```



* * *

<a id="api_test_collisions_dot_parent_dot_mathFile_dot_sqrt"></a>

### sqrt(num) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>sqrt.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| num | <code>*</code> |  | <p>num.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.sqrt(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.sqrt(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.sqrt(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.sqrt(null);
```



* * *

<a id="api_test_collisions_dot_parent_dot_mathFile_dot_modulo"></a>

### modulo(a, b) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>modulo.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>*</code> |  | <p>a.</p> |
| b | <code>*</code> |  | <p>b.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.modulo(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.modulo(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.modulo(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.modulo(null, null);
```



* * *

<a id="api_test_collisions_dot_mathFile_dot_collisionVersion"></a>

### collisionVersion
> <p><strong style="font-size: 1.1em;"><p>Version identifier for collision detection.</p></strong></p>
> 
**Kind**: static constant


* * *

<a id="api_test_collisions_dot_parent_math"></a>

### math
> 
**Kind**: inner namespace


* * *

<a id="api_test_collisions_dot_parent_dot_math_dot_add"></a>

### add(a, b) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>add.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>*</code> |  | <p>a.</p> |
| b | <code>*</code> |  | <p>b.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.add(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.add(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.add(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.add(null, null);
```



* * *

<a id="api_test_collisions_dot_parent_dot_math_dot_multiply"></a>

### multiply(a, b) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>multiply.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>*</code> |  | <p>a.</p> |
| b | <code>*</code> |  | <p>b.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.multiply(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.multiply(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.multiply(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.multiply(null, null);
```



* * *

<a id="api_test_collisions_dot_parent_dot_math_dot_divide"></a>

### divide(a, b) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>divide.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>*</code> |  | <p>a.</p> |
| b | <code>*</code> |  | <p>b.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.divide(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.divide(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
  api_test_collisions.parent.math.divide(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
api_test_collisions.parent.math.divide(null, null);
```






