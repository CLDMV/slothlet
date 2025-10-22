<a id="api_test_cjs"></a>

## @cldmv/slothlet/api_tests/api_test_cjs

> <p>This module provides test objects and functions for validating slothlet's ability to load and manage CommonJS (.cjs) modules. It includes math operations, string utilities, and advanced nested structures for comprehensive CJS API testing.</p>

**Structure**

[api_test_cjs](#api_test_cjs)

- [.advanced](#api_test_cjs_dot_advanced)
  - [.addViaSelf(a, b)](#api_test_cjs_dot_advanced_dot_selfObject_dot_addViaSelf) ⇒ <code><code>number</code></code>
  - [.add(a, b)](#api_test_cjs_dot_math_dot_add) ⇒ <code><code>number</code></code>
  - [.multiply(a, b)](#api_test_cjs_dot_math_dot_multiply) ⇒ <code><code>number</code></code>
- [.shout(name)](#api_test_cjs_dot_shout) ⇒ <code><code>string</code></code>
  - [.add(a, b)](#api_test_cjs_dot_rootMath_dot_add) ⇒ <code><code>number</code></code>
  - [.multiply(a, b)](#api_test_cjs_dot_rootMath_dot_multiply) ⇒ <code><code>number</code></code>
  - [.upper(str)](#api_test_cjs_dot_string_dot_upper) ⇒ <code><code>string</code></code>
  - [.reverse(str)](#api_test_cjs_dot_string_dot_reverse) ⇒ <code><code>string</code></code>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
```

---

<a id="api_test_cjs"></a>

### api_test_cjs

> <p><strong style="font-size: 1.1em;"><p>CommonJS test modules for slothlet CJS interoperability.</p></strong></p>
>
> **Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
```

---

<a id="api_test_cjs_dot_advanced"></a>

### api_test_cjs.advanced

> <p><strong style="font-size: 1.1em;">Auto-generated namespace for advanced components.</strong></p>
>
> **Kind**: static namespace of [<code>api_test_cjs</code>](#api_test_cjs)

---

<a id="api_test_cjs_dot_advanced_dot_selfObject"></a>

### api_test_cjs.advanced.selfObject

> <p><strong style="font-size: 1.1em;"><p>Advanced self-object API for testing CJS live-binding functionality.
> Accessed as <code>api.advanced.selfObject</code> in the slothlet API.</p></strong></p>
>
> **Kind**: static constant of [<code>api_test_cjs.advanced</code>](#api_test_cjs_dot_advanced)

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
```

---

<a id="api_test_cjs_dot_advanced_dot_selfObject_dot_addViaSelf"></a>

### api_test_cjs.advanced.selfObject.addViaSelf(a, b) ⇒ <code>number</code>

> <p><strong style="font-size: 1.1em;"><p>Returns the result of self.math.add(a, b) using live-binding via runtime import.
> Adds two numbers.</p></strong></p>
>
> **Kind**: inner method of [<code>api_test_cjs.advanced.selfObject</code>](#api_test_cjs_dot_advanced_dot_selfObject)

| Param | Type                | Default | Description                 |
| ----- | ------------------- | ------- | --------------------------- |
| a     | <code>number</code> |         | <p>First number to add</p>  |
| b     | <code>number</code> |         | <p>Second number to add</p> |

**Returns**:

- <code>number</code> <p>Sum of a and b via self reference</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
```

---

<a id="api_test_cjs_dot_math"></a>

### api_test_cjs.math

> <p><strong style="font-size: 1.1em;"><p>Math API object with basic arithmetic operations for testing auto-flattening (CJS version).
> This module tests slothlet's ability to flatten single-file folder structures.
> Accessed as <code>api.math</code> in the slothlet API.</p></strong></p>
>
> **Kind**: static constant of [<code>api_test_cjs</code>](#api_test_cjs)

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.math.add(2, 3)); // 5
console.log(api_test_cjs.math.multiply(2, 3)); // 6
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.math.add(2, 3)); // 5
	console.log(api_test_cjs.math.multiply(2, 3)); // 6
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.math.add(2, 3)); // 5
	console.log(api_test_cjs.math.multiply(2, 3)); // 6
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.math.add(2, 3)); // 5
console.log(api_test_cjs.math.multiply(2, 3)); // 6
```

---

<a id="api_test_cjs_dot_math_dot_add"></a>

### api_test_cjs.math.add(a, b) ⇒ <code>number</code>

> <p><strong style="font-size: 1.1em;"><p>Adds two numbers.</p></strong></p>
>
> **Kind**: inner method of [<code>api_test_cjs.math</code>](#api_test_cjs_dot_math)

| Param | Type                | Default | Description                  |
| ----- | ------------------- | ------- | ---------------------------- |
| a     | <code>number</code> |         | <p>First number to add.</p>  |
| b     | <code>number</code> |         | <p>Second number to add.</p> |

**Returns**:

- <code>number</code> <p>The sum of a and b.</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.math.add(2, 3)); // 5
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.math.add(2, 3)); // 5
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.math.add(2, 3)); // 5
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.math.add(2, 3)); // 5
```

---

<a id="api_test_cjs_dot_math_dot_multiply"></a>

### api_test_cjs.math.multiply(a, b) ⇒ <code>number</code>

> <p><strong style="font-size: 1.1em;"><p>Multiplies two numbers.</p></strong></p>
>
> **Kind**: inner method of [<code>api_test_cjs.math</code>](#api_test_cjs_dot_math)

| Param | Type                | Default | Description                       |
| ----- | ------------------- | ------- | --------------------------------- |
| a     | <code>number</code> |         | <p>First number to multiply.</p>  |
| b     | <code>number</code> |         | <p>Second number to multiply.</p> |

**Returns**:

- <code>number</code> <p>The product of a and b.</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.math.multiply(2, 3)); // 6
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.math.multiply(2, 3)); // 6
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.math.multiply(2, 3)); // 6
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.math.multiply(2, 3)); // 6
```

---

<a id="api_test_cjs_dot_shout"></a>

### api_test_cjs.shout(name) ⇒ <code>string</code>

> <p><strong style="font-size: 1.1em;"><p>Shouts a greeting.
> Accessed as <code>api.rootFunctionShout()</code> in the slothlet API.</p></strong></p>
>
> **Kind**: static method of [<code>api_test_cjs</code>](#api_test_cjs)

| Param | Type                | Default | Description                        |
| ----- | ------------------- | ------- | ---------------------------------- |
| name  | <code>string</code> |         | <p>Name to shout greeting for.</p> |

**Returns**:

- <code>string</code> <p>Uppercased greeting message.</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
```

---

<a id="api_test_cjs_dot_rootMath"></a>

### api_test_cjs.rootMath

> <p><strong style="font-size: 1.1em;"><p>Math API object with basic arithmetic operations (CJS version).
> Provides add and multiply functions for testing mathematical operations in slothlet.
> Accessed as <code>api.rootMath</code> in the slothlet API.</p></strong></p>
>
> **Kind**: static constant of [<code>api_test_cjs</code>](#api_test_cjs)

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootMath.add(2, 3)); // 5
console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootMath.add(2, 3)); // 5
	console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootMath.add(2, 3)); // 5
	console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootMath.add(2, 3)); // 5
console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
```

---

<a id="api_test_cjs_dot_rootMath_dot_add"></a>

### api_test_cjs.rootMath.add(a, b) ⇒ <code>number</code>

> <p><strong style="font-size: 1.1em;"><p>Adds two numbers.</p></strong></p>
>
> **Kind**: inner method of [<code>api_test_cjs.rootMath</code>](#api_test_cjs_dot_rootMath)

| Param | Type                | Default | Description                  |
| ----- | ------------------- | ------- | ---------------------------- |
| a     | <code>number</code> |         | <p>First number to add.</p>  |
| b     | <code>number</code> |         | <p>Second number to add.</p> |

**Returns**:

- <code>number</code> <p>The sum of a and b.</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootMath.add(2, 3)); // 5
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootMath.add(2, 3)); // 5
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootMath.add(2, 3)); // 5
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootMath.add(2, 3)); // 5
```

---

<a id="api_test_cjs_dot_rootMath_dot_multiply"></a>

### api_test_cjs.rootMath.multiply(a, b) ⇒ <code>number</code>

> <p><strong style="font-size: 1.1em;"><p>Multiplies two numbers.</p></strong></p>
>
> **Kind**: inner method of [<code>api_test_cjs.rootMath</code>](#api_test_cjs_dot_rootMath)

| Param | Type                | Default | Description                       |
| ----- | ------------------- | ------- | --------------------------------- |
| a     | <code>number</code> |         | <p>First number to multiply.</p>  |
| b     | <code>number</code> |         | <p>Second number to multiply.</p> |

**Returns**:

- <code>number</code> <p>The product of a and b.</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.rootMath.multiply(2, 3)); // 6
```

---

<a id="api_test_cjs_dot_string"></a>

### api_test_cjs.string

> <p><strong style="font-size: 1.1em;"><p>String API object with string manipulation operations for testing auto-flattening (CJS version).
> This module tests slothlet's ability to flatten single-file folder structures.
> Accessed as <code>api.string</code> in the slothlet API.</p></strong></p>
>
> **Kind**: static constant of [<code>api_test_cjs</code>](#api_test_cjs)

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.string.upper("abc")); // 'ABC'
console.log(api_test_cjs.string.reverse("abc")); // 'cba'
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.string.upper("abc")); // 'ABC'
	console.log(api_test_cjs.string.reverse("abc")); // 'cba'
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.string.upper("abc")); // 'ABC'
	console.log(api_test_cjs.string.reverse("abc")); // 'cba'
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.string.upper("abc")); // 'ABC'
console.log(api_test_cjs.string.reverse("abc")); // 'cba'
```

---

<a id="api_test_cjs_dot_string_dot_upper"></a>

### api_test_cjs.string.upper(str) ⇒ <code>string</code>

> <p><strong style="font-size: 1.1em;"><p>Converts a string to uppercase.</p></strong></p>
>
> **Kind**: inner method of [<code>api_test_cjs.string</code>](#api_test_cjs_dot_string)

| Param | Type                | Default | Description                            |
| ----- | ------------------- | ------- | -------------------------------------- |
| str   | <code>string</code> |         | <p>String to convert to uppercase.</p> |

**Returns**:

- <code>string</code> <p>The uppercased string.</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.string.upper("abc")); // 'ABC'
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.string.upper("abc")); // 'ABC'
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.string.upper("abc")); // 'ABC'
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.string.upper("abc")); // 'ABC'
```

---

<a id="api_test_cjs_dot_string_dot_reverse"></a>

### api_test_cjs.string.reverse(str) ⇒ <code>string</code>

> <p><strong style="font-size: 1.1em;"><p>Reverses a string.</p></strong></p>
>
> **Kind**: inner method of [<code>api_test_cjs.string</code>](#api_test_cjs_dot_string)

| Param | Type                | Default | Description               |
| ----- | ------------------- | ------- | ------------------------- |
| str   | <code>string</code> |         | <p>String to reverse.</p> |

**Returns**:

- <code>string</code> <p>The reversed string.</p>

**Example**

```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.string.reverse("abc")); // 'cba'
```

**Example**

```js
// ESM usage via slothlet API (inside async function)
async function example() {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.string.reverse("abc")); // 'cba'
}
```

**Example**

```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
	({ slothlet } = await import("@cldmv/slothlet"));
	const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
	console.log(api_test_cjs.string.reverse("abc")); // 'cba'
})();
```

**Example**

```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
console.log(api_test_cjs.string.reverse("abc")); // 'cba'
```
