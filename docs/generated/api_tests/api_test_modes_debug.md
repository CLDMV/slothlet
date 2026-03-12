<a id="api_test_modes_debug"></a>

## @cldmv/slothlet/api\_tests/api\_test\_modes\_debug
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_modes_debug API surface documented for reference.</p>
> 


**Structure**

  * [.logger](#api_test_modes_debug~logger)
    * [.loggerMeta](#api_test_modes_debug_dot_logger~loggerMeta)
    * [.logger](#api_test_modes_debug_dot_logger~logger)
      * [.log(msg)](#api_test_modes_debug_dot_logger_dot_log) ⇒ <code>string</code>
      * [.source](#api_test_modes_debug_dot_logger_dot_source)
    * [.log(msg)](#api_test_modes_debug_dot_logger_dot_log) ⇒ <code>string</code>
    * [.source](#api_test_modes_debug_dot_logger_dot_source)
    * [.version](#api_test_modes_debug_dot_logger)
    * [.levels](#api_test_modes_debug_dot_logger)
    * [.module.exports()](#api_test_modes_debug_dot_logger)
    * [.level](#api_test_modes_debug_dot_logger)
  * [.string](#api_test_modes_debug~string)
    * [.stringUtils](#api_test_modes_debug_dot_string~stringUtils)
    * [.pad(s, len)](#api_test_modes_debug_dot_string) ⇒ <code>string</code>
    * [.string](#api_test_modes_debug_dot_string)
    * [.format(s)](#api_test_modes_debug_dot_string_dot_string_dot_format) ⇒ <code>string</code>
    * [.trim(s)](#api_test_modes_debug_dot_string_dot_string_dot_trim) ⇒ <code>string</code>
  * [.utils](#api_test_modes_debug~utils)
    * [.greet(name)](#api_test_modes_debug_dot_utils_dot_greet) ⇒ <code>string</code>
    * [.add(a, b)](#api_test_modes_debug_dot_utils_dot_add) ⇒ <code>number</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
```





* * *

<a id="api_test_modes_debug~logger"></a>

### api_test_modes_debug.logger
> 
**Kind**: inner namespace of [<code>api_test_modes_debug</code>](#api_test_modes_debug)


* * *

<a id="api_test_modes_debug_dot_logger~loggerMeta"></a>

### level.level.loggerMeta
> 
**Kind**: inner namespace of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug_dot_logger~logger"></a>

### level.level.logger
> 
**Kind**: inner namespace of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug_dot_logger_dot_log"></a>

### level.level.log(msg) ⇒ <code>string</code>
> 
**Kind**: static method of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| msg | <code>string</code> |  |  |


**Returns**:

- <code>string</code> <p></p>



* * *

<a id="api_test_modes_debug_dot_logger_dot_source"></a>

### level.level.source
> 
**Kind**: static constant of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug_dot_logger_dot_log"></a>

### level.level.log(msg) ⇒ <code>string</code>
> 
**Kind**: static method of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| msg | <code>string</code> |  |  |


**Returns**:

- <code>string</code> <p></p>



* * *

<a id="api_test_modes_debug_dot_logger_dot_source"></a>

### level.level.source
> 
**Kind**: static constant of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug_dot_logger"></a>

### level.level.version
> 
**Kind**: static constant of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug_dot_logger"></a>

### version.version.levels
> 
**Kind**: static constant of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug_dot_logger"></a>

### levels.levels.module.exports()
> <p><strong style="font-size: 1.1em;"><p>Logger API module for modes-processor debug coverage testing.
> Uses folder/folder.mjs pattern with a default export function (Case 2).</p></strong></p>
> 
**Kind**: static method of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug_dot_logger"></a>

### module.exports.module.exports.level
> 
**Kind**: static constant of [<code>module.exports.module.exports.level</code>](#api_test_modes_debug_dot_logger)


* * *

<a id="api_test_modes_debug~string"></a>

### api_test_modes_debug.string
> 
**Kind**: inner namespace of [<code>api_test_modes_debug</code>](#api_test_modes_debug)


* * *

<a id="api_test_modes_debug_dot_string~stringUtils"></a>

### string.string.stringUtils
> 
**Kind**: inner namespace of [<code>pad.pad.string</code>](#api_test_modes_debug_dot_string)


* * *

<a id="api_test_modes_debug_dot_string"></a>

### string.string.pad(s, len) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Pad a string to a fixed length.</p></strong></p>
> 
**Kind**: static method of [<code>pad.pad.string</code>](#api_test_modes_debug_dot_string)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| s | <code>string</code> |  | <p>Input string.</p> |
| len | <code>number</code> |  | <p>Target length.</p> |


**Returns**:

- <code>string</code> <p>Padded string.</p>



* * *

<a id="api_test_modes_debug_dot_string"></a>

### pad.pad.string
> <p><strong style="font-size: 1.1em;"><p>String utilities for modes-processor debug coverage testing.
> Uses folder/folder.mjs pattern with single named object export (Case 1).
> This exports a single const named &quot;string&quot; matching the folder name &quot;string&quot;
> to trigger the Case 1 single-file-folder-detected path, including the
> debug.modes guard for <code>categoryName === &quot;string&quot;</code>.</p></strong></p>
> 
**Kind**: static constant of [<code>pad.pad.string</code>](#api_test_modes_debug_dot_string)


* * *

<a id="api_test_modes_debug_dot_string_dot_string_dot_format"></a>

### string.string.format(s) ⇒ <code>string</code>
> 
**Kind**: static method of [<code>pad.pad.string</code>](#api_test_modes_debug_dot_string)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| s | <code>string</code> |  |  |


**Returns**:

- <code>string</code> <p></p>



* * *

<a id="api_test_modes_debug_dot_string_dot_string_dot_trim"></a>

### string.string.trim(s) ⇒ <code>string</code>
> 
**Kind**: static method of [<code>pad.pad.string</code>](#api_test_modes_debug_dot_string)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| s | <code>string</code> |  |  |


**Returns**:

- <code>string</code> <p></p>



* * *

<a id="api_test_modes_debug~utils"></a>

### api_test_modes_debug.utils
> 
**Kind**: inner namespace of [<code>api_test_modes_debug</code>](#api_test_modes_debug)


* * *

<a id="api_test_modes_debug_dot_utils_dot_greet"></a>

### greet(name) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>General utility functions for modes-processor debug coverage testing.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  |  |


**Returns**:

- <code>string</code> <p></p>



* * *

<a id="api_test_modes_debug_dot_utils_dot_add"></a>

### add(a, b) ⇒ <code>number</code>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| a | <code>number</code> |  |  |
| b | <code>number</code> |  |  |


**Returns**:

- <code>number</code> <p></p>






