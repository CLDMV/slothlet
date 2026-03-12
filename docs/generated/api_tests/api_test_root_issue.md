<a id="api_test_root_issue"></a>

## @cldmv/slothlet/api\_tests/api\_test\_root\_issue
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_root_issue API surface documented for reference.</p>
> 


**Structure**

  * [.config](#api_test_root_issue~config)
    * [.config](#api_test_root_issue_dot_config)
    * [.defaults](#api_test_root_issue_dot_config_dot_config_dot_defaults)
    * [.getConfig(key)](#api_test_root_issue_dot_config_dot_config_dot_getConfig) ⇒ <code>*</code>
    * [.update(keyOrConfig, value)](#api_test_root_issue_dot_config_dot_config_dot_update)
    * [.set(key, value)](#api_test_root_issue_dot_config_dot_config_dot_set)
    * [.getDefaultPort(manufacturer)](#api_test_root_issue_dot_config_dot_config_dot_getDefaultPort) ⇒ <code>number</code>
    * [.validate(config, required)](#api_test_root_issue_dot_config_dot_config_dot_validate) ⇒ <code>Object</code>
    * [.merge(userConfig, manufacturer)](#api_test_root_issue_dot_config_dot_config_dot_merge) ⇒ <code>Object</code>
    * [.createManufacturerConfig(manufacturer, options)](#api_test_root_issue_dot_config_dot_config_dot_createManufacturerConfig) ⇒ <code>Object</code>
  * [.connection](#api_test_root_issue~connection)
  * [.order](#api_test_root_issue~order)
    * [.createOrder(userId, products)](#api_test_root_issue_dot_order_dot_createOrder) ⇒ <code>object</code>
    * [.calculateTotal(order, products)](#api_test_root_issue_dot_order_dot_calculateTotal) ⇒ <code>number</code>
    * [.updateStatus(order, status)](#api_test_root_issue_dot_order_dot_updateStatus) ⇒ <code>object</code>
  * [.product](#api_test_root_issue~product)
    * [.createProduct(name, price)](#api_test_root_issue_dot_product_dot_createProduct) ⇒ <code>object</code>
    * [.calculateTax(product, rate)](#api_test_root_issue_dot_product_dot_calculateTax) ⇒ <code>number</code>
    * [.formatProduct(product)](#api_test_root_issue_dot_product_dot_formatProduct) ⇒ <code>string</code>
  * [.subfolder](#api_test_root_issue~subfolder)
    * [.config](#api_test_root_issue_dot_subfolder~config)
      * [.config](#api_test_root_issue_dot_subfolder_dot_config)
        * [.config](#api_test_root_issue_dot_config)
      * [.defaults](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_defaults)
      * [.getConfig(key)](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_getConfig) ⇒ <code>*</code>
      * [.update(keyOrConfig, value)](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_update)
      * [.set(key, value)](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_set)
      * [.getDefaultPort(manufacturer)](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_getDefaultPort) ⇒ <code>number</code>
      * [.validate(config, required)](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_validate) ⇒ <code>Object</code>
      * [.merge(userConfig, manufacturer)](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_merge) ⇒ <code>Object</code>
      * [.createManufacturerConfig(manufacturer, options)](#api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_createManufacturerConfig) ⇒ <code>Object</code>
    * [.order](#api_test_root_issue_dot_subfolder~order)
      * [.createOrder(userId, products)](#api_test_root_issue_dot_subfolder_dot_order_dot_createOrder) ⇒ <code>object</code>
      * [.calculateTotal(order, products)](#api_test_root_issue_dot_subfolder_dot_order_dot_calculateTotal) ⇒ <code>number</code>
      * [.updateStatus(order, status)](#api_test_root_issue_dot_subfolder_dot_order_dot_updateStatus) ⇒ <code>object</code>
    * [.product](#api_test_root_issue_dot_subfolder~product)
      * [.createProduct(name, price)](#api_test_root_issue_dot_subfolder_dot_product_dot_createProduct) ⇒ <code>object</code>
      * [.calculateTax(product, rate)](#api_test_root_issue_dot_subfolder_dot_product_dot_calculateTax) ⇒ <code>number</code>
      * [.formatProduct(product)](#api_test_root_issue_dot_subfolder_dot_product_dot_formatProduct) ⇒ <code>string</code>
    * [.user](#api_test_root_issue_dot_subfolder~user)
      * [.createUser(name, email)](#api_test_root_issue_dot_user_dot_createUser) ⇒ <code>object</code>
      * [.validateUser(user)](#api_test_root_issue_dot_user_dot_validateUser) ⇒ <code>boolean</code>
      * [.formatUser(user)](#api_test_root_issue_dot_user_dot_formatUser) ⇒ <code>string</code>
  * [.user](#api_test_root_issue~user)
    * [.createUser(name, email)](#api_test_root_issue_dot_user_dot_createUser) ⇒ <code>object</code>
    * [.validateUser(user)](#api_test_root_issue_dot_user_dot_validateUser) ⇒ <code>boolean</code>
    * [.formatUser(user)](#api_test_root_issue_dot_user_dot_formatUser) ⇒ <code>string</code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
```





* * *

<a id="api_test_root_issue~config"></a>

### api_test_root_issue.config
> 
**Kind**: inner namespace of [<code>api_test_root_issue</code>](#api_test_root_issue)


* * *

<a id="api_test_root_issue_dot_config"></a>

### config.config
> <p><strong style="font-size: 1.1em;"><p>Config API object containing all configuration functions</p></strong></p>
> 
**Kind**: static constant of [<code>config.config</code>](#api_test_root_issue_dot_config)


* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_defaults"></a>

### config.config.defaults
> <p><strong style="font-size: 1.1em;"><p>Default configuration values for TV control</p></strong></p>
> 
**Kind**: static property of [<code>config.config</code>](#api_test_root_issue_dot_config)


* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_getConfig"></a>

### config.config.getConfig(key) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>Retrieves configuration from the TV Control instance. Supports dot notation
> for nested values like 'lg.activeKeycode' or 'state.refreshDelayMs'.</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | <p>Optional dot-notation key to get specific value</p> |


**Returns**:

- <code>*</code> <p>Configuration value or entire config object</p>


**Example**
```js
// Get entire config
const config = get();
```
**Example**
```js
// Get specific value
const manufacturer = get('manufacturer');
const keycode = get('lg.activeKeycode');
```



* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_update"></a>

### config.config.update(keyOrConfig, value)
> <p><strong style="font-size: 1.1em;"><p>Updates configuration either by merging an object or setting a specific key.
> Supports dot notation for nested keys like 'lg.activeKeycode'.</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyOrConfig | <code>Object | string</code> |  | <p>Configuration object or dot-notation key</p> |
| [value] | <code>*</code> |  | <p>Value to set (if keyOrConfig is a string)</p> |


**Example**
```js
// Update multiple values
update({ host: '192.168.1.100', maxVolume: 75 });
```
**Example**
```js
// Update specific nested value
update('lg.activeKeycode', '12345678');
```



* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_set"></a>

### config.config.set(key, value)
> <p><strong style="font-size: 1.1em;"><p>Convenience function for setting a single configuration value.</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Dot-notation key to set</p> |
| value | <code>*</code> |  | <p>Value to set</p> |


**Example**
```js
set('manufacturer', 'samsung');
set('lg.activeKeycode', '87654321');
```



* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_getDefaultPort"></a>

### config.config.getDefaultPort(manufacturer) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Get the default port for a specific manufacturer</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| manufacturer | <code>string</code> |  | <p>Manufacturer name (lg, sony, samsung, etc.)</p> |


**Returns**:

- <code>number</code> <p>Default port number</p>



* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_validate"></a>

### config.config.validate(config, required) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Validate that required configuration is present</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| config | <code>Object</code> |  | <p>Configuration to validate</p> |
| required | <code>Array.&lt;string&gt;</code> |  | <p>Required configuration keys</p> |


**Returns**:

- <code>Object</code> <p>Validation result</p>



* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_merge"></a>

### config.config.merge(userConfig, manufacturer) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Get a merged configuration with defaults</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| userConfig | <code>Object</code> |  | <p>User-provided configuration</p> |
| manufacturer | <code>string</code> |  | <p>Manufacturer name</p> |


**Returns**:

- <code>Object</code> <p>Merged configuration</p>



* * *

<a id="api_test_root_issue_dot_config_dot_config_dot_createManufacturerConfig"></a>

### config.config.createManufacturerConfig(manufacturer, options) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Create a manufacturer-specific configuration</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| manufacturer | <code>string</code> |  | <p>Manufacturer name</p> |
| options | <code>Object</code> |  | <p>Manufacturer-specific options</p> |


**Returns**:

- <code>Object</code> <p>Manufacturer configuration</p>



* * *

<a id="api_test_root_issue~connection"></a>

### api_test_root_issue.connection
> 
**Kind**: inner namespace of [<code>api_test_root_issue</code>](#api_test_root_issue)


* * *

<a id="api_test_root_issue~order"></a>

### api_test_root_issue.order
> 
**Kind**: inner namespace of [<code>api_test_root_issue</code>](#api_test_root_issue)


* * *

<a id="api_test_root_issue_dot_order_dot_createOrder"></a>

### createOrder(userId, products) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a new order (default export).
> With multiple root-level defaults, this creates a conflict that needs proper resolution.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| userId | <code>string</code> |  | <p>User ID</p> |
| products | <code>Array.&lt;string&gt;</code> |  | <p>Array of product IDs</p> |


**Returns**:

- <code>object</code> <p>Order object</p>



* * *

<a id="api_test_root_issue_dot_order_dot_calculateTotal"></a>

### calculateTotal(order, products) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculates order total (named export).
> Should be accessible as api.calculateTotal().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| order | <code>object</code> |  | <p>Order object</p> |
| products | <code>Array.&lt;object&gt;</code> |  | <p>Array of product objects</p> |


**Returns**:

- <code>number</code> <p>Total order amount</p>



* * *

<a id="api_test_root_issue_dot_order_dot_updateStatus"></a>

### updateStatus(order, status) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Updates order status (named export).
> Should be accessible as api.updateStatus().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| order | <code>object</code> |  | <p>Order object</p> |
| status | <code>string</code> |  | <p>New status</p> |


**Returns**:

- <code>object</code> <p>Updated order object</p>



* * *

<a id="api_test_root_issue~product"></a>

### api_test_root_issue.product
> 
**Kind**: inner namespace of [<code>api_test_root_issue</code>](#api_test_root_issue)


* * *

<a id="api_test_root_issue_dot_product_dot_createProduct"></a>

### createProduct(name, price) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a new product (default export).
> Should cause conflicts with multi-default detection when multiple root defaults exist.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Product name</p> |
| price | <code>number</code> |  | <p>Product price</p> |


**Returns**:

- <code>object</code> <p>Product object</p>



* * *

<a id="api_test_root_issue_dot_product_dot_calculateTax"></a>

### calculateTax(product, rate) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculates product tax (named export).
> Should be accessible as api.calculateTax().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| product | <code>object</code> |  | <p>Product object</p> |
| rate | <code>number</code> |  | <p>Tax rate (0.1 for 10%)</p> |


**Returns**:

- <code>number</code> <p>Tax amount</p>



* * *

<a id="api_test_root_issue_dot_product_dot_formatProduct"></a>

### formatProduct(product) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Formats product for display (named export).
> Should be accessible as api.formatProduct().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| product | <code>object</code> |  | <p>Product object</p> |


**Returns**:

- <code>string</code> <p>Formatted product string</p>



* * *

<a id="api_test_root_issue~subfolder"></a>

### api_test_root_issue.subfolder
> 
**Kind**: inner namespace of [<code>api_test_root_issue</code>](#api_test_root_issue)


* * *

<a id="api_test_root_issue_dot_subfolder~config"></a>

### config
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_root_issue_dot_subfolder_dot_config"></a>

### config.config
> <p><strong style="font-size: 1.1em;"><p>Config API object containing all configuration functions</p></strong></p>
> 
**Kind**: static constant of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


* * *

<a id="api_test_root_issue_dot_config"></a>

### config.config
> <p><strong style="font-size: 1.1em;"><p>Config API object containing all configuration functions</p></strong></p>
> 
**Kind**: static constant of [<code>config.config</code>](#api_test_root_issue_dot_config)


* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_defaults"></a>

### config.config.defaults
> <p><strong style="font-size: 1.1em;"><p>Default configuration values for TV control</p></strong></p>
> 
**Kind**: static property of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_getConfig"></a>

### config.config.getConfig(key) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>Retrieves configuration from the TV Control instance. Supports dot notation
> for nested values like 'lg.activeKeycode' or 'state.refreshDelayMs'.</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | <p>Optional dot-notation key to get specific value</p> |


**Returns**:

- <code>*</code> <p>Configuration value or entire config object</p>


**Example**
```js
// Get entire config
const config = get();
```
**Example**
```js
// Get specific value
const manufacturer = get('manufacturer');
const keycode = get('lg.activeKeycode');
```



* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_update"></a>

### config.config.update(keyOrConfig, value)
> <p><strong style="font-size: 1.1em;"><p>Updates configuration either by merging an object or setting a specific key.
> Supports dot notation for nested keys like 'lg.activeKeycode'.</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyOrConfig | <code>Object | string</code> |  | <p>Configuration object or dot-notation key</p> |
| [value] | <code>*</code> |  | <p>Value to set (if keyOrConfig is a string)</p> |


**Example**
```js
// Update multiple values
update({ host: '192.168.1.100', maxVolume: 75 });
```
**Example**
```js
// Update specific nested value
update('lg.activeKeycode', '12345678');
```



* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_set"></a>

### config.config.set(key, value)
> <p><strong style="font-size: 1.1em;"><p>Convenience function for setting a single configuration value.</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Dot-notation key to set</p> |
| value | <code>*</code> |  | <p>Value to set</p> |


**Example**
```js
set('manufacturer', 'samsung');
set('lg.activeKeycode', '87654321');
```



* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_getDefaultPort"></a>

### config.config.getDefaultPort(manufacturer) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Get the default port for a specific manufacturer</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| manufacturer | <code>string</code> |  | <p>Manufacturer name (lg, sony, samsung, etc.)</p> |


**Returns**:

- <code>number</code> <p>Default port number</p>



* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_validate"></a>

### config.config.validate(config, required) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Validate that required configuration is present</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| config | <code>Object</code> |  | <p>Configuration to validate</p> |
| required | <code>Array.&lt;string&gt;</code> |  | <p>Required configuration keys</p> |


**Returns**:

- <code>Object</code> <p>Validation result</p>



* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_merge"></a>

### config.config.merge(userConfig, manufacturer) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Get a merged configuration with defaults</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| userConfig | <code>Object</code> |  | <p>User-provided configuration</p> |
| manufacturer | <code>string</code> |  | <p>Manufacturer name</p> |


**Returns**:

- <code>Object</code> <p>Merged configuration</p>



* * *

<a id="api_test_root_issue_dot_subfolder_dot_config_dot_config_dot_createManufacturerConfig"></a>

### config.config.createManufacturerConfig(manufacturer, options) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Create a manufacturer-specific configuration</p></strong></p>
> 
**Kind**: static method of [<code>config.config</code>](#api_test_root_issue_dot_subfolder_dot_config)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| manufacturer | <code>string</code> |  | <p>Manufacturer name</p> |
| options | <code>Object</code> |  | <p>Manufacturer-specific options</p> |


**Returns**:

- <code>Object</code> <p>Manufacturer configuration</p>



* * *

<a id="api_test_root_issue_dot_subfolder~order"></a>

### order
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_root_issue_dot_subfolder_dot_order_dot_createOrder"></a>

### createOrder(userId, products) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a new order (default export).
> Should be accessible as api.subfolder.order() with multi-default detection.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| userId | <code>string</code> |  | <p>User ID</p> |
| products | <code>Array.&lt;string&gt;</code> |  | <p>Array of product IDs</p> |


**Returns**:

- <code>object</code> <p>Order object</p>



* * *

<a id="api_test_root_issue_dot_subfolder_dot_order_dot_calculateTotal"></a>

### calculateTotal(order, products) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculates order total (named export).
> Should be accessible as api.subfolder.order.calculateTotal().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| order | <code>object</code> |  | <p>Order object</p> |
| products | <code>Array.&lt;object&gt;</code> |  | <p>Array of product objects</p> |


**Returns**:

- <code>number</code> <p>Total order amount</p>



* * *

<a id="api_test_root_issue_dot_subfolder_dot_order_dot_updateStatus"></a>

### updateStatus(order, status) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Updates order status (named export).
> Should be accessible as api.subfolder.order.updateStatus().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| order | <code>object</code> |  | <p>Order object</p> |
| status | <code>string</code> |  | <p>New status</p> |


**Returns**:

- <code>object</code> <p>Updated order object</p>



* * *

<a id="api_test_root_issue_dot_subfolder~product"></a>

### product
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_root_issue_dot_subfolder_dot_product_dot_createProduct"></a>

### createProduct(name, price) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a new product (default export).
> Should be accessible as api.subfolder.product() with multi-default detection.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>Product name</p> |
| price | <code>number</code> |  | <p>Product price</p> |


**Returns**:

- <code>object</code> <p>Product object</p>



* * *

<a id="api_test_root_issue_dot_subfolder_dot_product_dot_calculateTax"></a>

### calculateTax(product, rate) ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Calculates product tax (named export).
> Should be accessible as api.subfolder.product.calculateTax().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| product | <code>object</code> |  | <p>Product object</p> |
| rate | <code>number</code> |  | <p>Tax rate (0.1 for 10%)</p> |


**Returns**:

- <code>number</code> <p>Tax amount</p>



* * *

<a id="api_test_root_issue_dot_subfolder_dot_product_dot_formatProduct"></a>

### formatProduct(product) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Formats product for display (named export).
> Should be accessible as api.subfolder.product.formatProduct().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| product | <code>object</code> |  | <p>Product object</p> |


**Returns**:

- <code>string</code> <p>Formatted product string</p>



* * *

<a id="api_test_root_issue_dot_subfolder~user"></a>

### user
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_test_root_issue_dot_user_dot_createUser"></a>

### createUser(name, email) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a new user (default export).
> Should be accessible as api() at root level due to root flattening.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>User name</p> |
| email | <code>string</code> |  | <p>User email</p> |


**Returns**:

- <code>object</code> <p>User object</p>



* * *

<a id="api_test_root_issue_dot_user_dot_validateUser"></a>

### validateUser(user) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Validates user data (named export).
> Should be accessible as api.validateUser().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| user | <code>object</code> |  | <p>User object to validate</p> |


**Returns**:

- <code>boolean</code> <p>True if valid</p>



* * *

<a id="api_test_root_issue_dot_user_dot_formatUser"></a>

### formatUser(user) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Formats user for display (named export).
> Should be accessible as api.formatUser().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| user | <code>object</code> |  | <p>User object to format</p> |


**Returns**:

- <code>string</code> <p>Formatted user string</p>



* * *

<a id="api_test_root_issue~user"></a>

### api_test_root_issue.user
> 
**Kind**: inner namespace of [<code>api_test_root_issue</code>](#api_test_root_issue)


* * *

<a id="api_test_root_issue_dot_user_dot_createUser"></a>

### createUser(name, email) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a new user (default export).
> Should be accessible as api() at root level due to root flattening.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | <p>User name</p> |
| email | <code>string</code> |  | <p>User email</p> |


**Returns**:

- <code>object</code> <p>User object</p>



* * *

<a id="api_test_root_issue_dot_user_dot_validateUser"></a>

### validateUser(user) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Validates user data (named export).
> Should be accessible as api.validateUser().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| user | <code>object</code> |  | <p>User object to validate</p> |


**Returns**:

- <code>boolean</code> <p>True if valid</p>



* * *

<a id="api_test_root_issue_dot_user_dot_formatUser"></a>

### formatUser(user) ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Formats user for display (named export).
> Should be accessible as api.formatUser().</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| user | <code>object</code> |  | <p>User object to format</p> |


**Returns**:

- <code>string</code> <p>Formatted user string</p>






