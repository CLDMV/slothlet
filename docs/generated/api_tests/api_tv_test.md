<a id="api_tv_test"></a>

## @cldmv/slothlet/api\_tests/api\_tv\_test
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_tv_test API surface documented for reference.</p>
> 


**Structure**

[api_tv_test](#api_tv_test)
  * [.app](#api_tv_test~app)
  * [.channel](#api_tv_test~channel)
  * [.config](#api_tv_test~config)
    * [.get(key)](#api_tv_test_dot_config_dot_config_dot_get) ⇒ <code><code>*</code></code>
    * [.update(keyOrConfig, value)](#api_tv_test_dot_config_dot_config_dot_update) ⇒ <code><code>object</code></code>
    * [.set(key, value)](#api_tv_test_dot_config_dot_config_dot_set) ⇒ <code><code>object</code></code>
    * [.getDefaultPort()](#api_tv_test_dot_config_dot_config_dot_getDefaultPort) ⇒ <code><code>number</code></code>
    * [.validate(configToValidate, requiredKeys)](#api_tv_test_dot_config_dot_config_dot_validate) ⇒ <code><code>object</code></code>
    * [.merge(userConfig, _)](#api_tv_test_dot_config_dot_config_dot_merge) ⇒ <code><code>object</code></code>
    * [.createManufacturerConfig(manufacturer, options)](#api_tv_test_dot_config_dot_config_dot_createManufacturerConfig) ⇒ <code><code>object</code></code>
    * [.getInstanceInfo()](#api_tv_test_dot_config_dot_config_dot_getInstanceInfo) ⇒ <code><code>object</code></code>
  * [.connection](#api_tv_test~connection)
  * [.controllers](#api_tv_test~controllers)
    * [.tvControllers](#api_tv_test_dot_controllers~tvControllers)
      * [.module.exports](#api_tv_test_dot_controllers_dot_tvControllers)
  * [.devices](#api_tv_test~devices)
    * [.firetv](#api_tv_test_dot_devices~firetv)
      * [.powerOn(deviceId)](#api_tv_test_dot_devices_dot_firetv_dot_powerOn) ⇒ <code><code>Promise.&lt;boolean&gt;</code></code>
      * [.powerOff(deviceId)](#api_tv_test_dot_devices_dot_firetv_dot_powerOff) ⇒ <code><code>Promise.&lt;boolean&gt;</code></code>
      * [.sendKey(deviceId, keyCode)](#api_tv_test_dot_devices_dot_firetv_dot_sendKey) ⇒ <code><code>Promise.&lt;boolean&gt;</code></code>
      * [.REMOTE_KEYS](#api_tv_test_dot_devices_dot_firetv_dot_REMOTE_KEYS)
      * [.isValidRemoteKey(key)](#api_tv_test_dot_devices_dot_firetv_dot_isValidRemoteKey) ⇒ <code><code>boolean</code></code>
    * [.lg](#api_tv_test_dot_devices~lg)
      * [.module.exports](#api_tv_test_dot_devices_dot_lg)
    * [.mxnet](#api_tv_test_dot_devices~mxnet)
      * [.powerOn(deviceId)](#api_tv_test_dot_devices_dot_mxnet_dot_powerOn) ⇒ <code><code>Promise.&lt;boolean&gt;</code></code>
      * [.powerOff(deviceId)](#api_tv_test_dot_devices_dot_mxnet_dot_powerOff) ⇒ <code><code>Promise.&lt;boolean&gt;</code></code>
      * [.sendCommand(deviceId, command)](#api_tv_test_dot_devices_dot_mxnet_dot_sendCommand) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
      * [.getStatus(deviceId)](#api_tv_test_dot_devices_dot_mxnet_dot_getStatus) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
      * [.COMMANDS](#api_tv_test_dot_devices_dot_mxnet_dot_COMMANDS)
      * [.isValidCommand(command)](#api_tv_test_dot_devices_dot_mxnet_dot_isValidCommand) ⇒ <code><code>boolean</code></code>
  * [.input](#api_tv_test~input)
  * [.key](#api_tv_test~key)
  * [.lifecycle](#api_tv_test~lifecycle)
    * [.callAll(methodName, args, options)](#api_tv_test_dot_lifecycle_dot_callAll) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.getModules(methodName, exclude)](#api_tv_test_dot_lifecycle_dot_getModules) ⇒ <code><code>Array.&lt;string&gt;</code></code>
    * [.methods](#api_tv_test_dot_lifecycle_dot_methods)
  * [.manufacturer](#api_tv_test~manufacturer)
    * [.lg](#api_tv_test_dot_manufacturer~lg)
      * [.app](#api_tv_test_dot_manufacturer_dot_lg~app)
      * [.channel](#api_tv_test_dot_manufacturer_dot_lg~channel)
      * [.connect](#api_tv_test_dot_manufacturer_dot_lg~connect)
      * [.disconnect](#api_tv_test_dot_manufacturer_dot_lg~disconnect)
      * [.encryption](#api_tv_test_dot_manufacturer_dot_lg~encryption)
      * [.getInfo](#api_tv_test_dot_manufacturer_dot_lg~getInfo)
      * [.input](#api_tv_test_dot_manufacturer_dot_lg~input)
      * [.key](#api_tv_test_dot_manufacturer_dot_lg~key)
      * [.keys](#api_tv_test_dot_manufacturer_dot_lg~keys)
      * [.power](#api_tv_test_dot_manufacturer_dot_lg~power)
      * [.process](#api_tv_test_dot_manufacturer_dot_lg~process)
      * [.sendCommand](#api_tv_test_dot_manufacturer_dot_lg~sendCommand)
      * [.volume](#api_tv_test_dot_manufacturer_dot_lg~volume)
  * [.power](#api_tv_test~power)
  * [.proxyTest](#api_tv_test~proxyTest)
    * [.module.exports](#api_tv_test_dot_proxyTest)
  * [.state](#api_tv_test~state)
  * [.subfolder](#api_tv_test~subfolder)
    * [.app](#api_tv_test_dot_subfolder~app)
    * [.channel](#api_tv_test_dot_subfolder~channel)
    * [.config](#api_tv_test_dot_subfolder~config)
    * [.connection](#api_tv_test_dot_subfolder~connection)
    * [.input](#api_tv_test_dot_subfolder~input)
    * [.key](#api_tv_test_dot_subfolder~key)
    * [.power](#api_tv_test_dot_subfolder~power)
    * [.state](#api_tv_test_dot_subfolder~state)
    * [.volume](#api_tv_test_dot_subfolder~volume)
  * [.utilities](#api_tv_test~utilities)
    * [.commandQueue](#api_tv_test_dot_utilities~commandQueue)
    * [.failOperation](#api_tv_test_dot_utilities~failOperation)
    * [.wakeOnLan](#api_tv_test_dot_utilities~wakeOnLan)
  * [.utils](#api_tv_test~utils)
    * [.defaults](#api_tv_test_dot_utils~defaults)
      * [.getDefaults(dataSystemName)](#api_tv_test_dot_utils_dot_defaults_dot_getDefaults) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
      * [.getAllDefaults()](#api_tv_test_dot_utils_dot_defaults_dot_getAllDefaults) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
      * [.reloadDefaults()](#api_tv_test_dot_utils_dot_defaults_dot_reloadDefaults) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
      * [.createDefaultsAPI(dataSystemName, getCurrentValues, setValues)](#api_tv_test_dot_utils_dot_defaults_dot_createDefaultsAPI) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
      * [.restore(keys)](#api_tv_test_dot_utils_dot_defaults_dot_restore) ⇒ <code><code>Object</code></code>
      * [.isDefault(key)](#api_tv_test_dot_utils_dot_defaults_dot_isDefault) ⇒ <code><code>boolean</code></code>
      * [.customized()](#api_tv_test_dot_utils_dot_defaults_dot_customized) ⇒ <code><code>Object</code></code>
      * [.resetAll(exclude)](#api_tv_test_dot_utils_dot_defaults_dot_resetAll) ⇒ <code><code>Object</code></code>
    * [.lifecycle](#api_tv_test_dot_utils~lifecycle)
      * [.callAll(methodName, args, options)](#api_tv_test_dot_utils_dot_lifecycle_dot_callAll) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
      * [.getModules(methodName, exclude)](#api_tv_test_dot_utils_dot_lifecycle_dot_getModules) ⇒ <code><code>Array.&lt;string&gt;</code></code>
      * [.methods](#api_tv_test_dot_utils_dot_lifecycle_dot_methods)
  * [.volume](#api_tv_test~volume)


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
```





* * *

<a id="api_tv_test"></a>

### api_tv_test
> <p><strong style="font-size: 1.1em;"><p>TV Remote API dummy modules for slothlet hierarchical API testing.</p></strong></p>
> 
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
```



* * *

<a id="api_tv_test~app"></a>

### api_tv_test.app
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test~channel"></a>

### api_tv_test.channel
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test~config"></a>

### api_tv_test.config
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_config_dot_config_dot_get"></a>

### get(key) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>Get configuration value(s)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | <p>Specific key to get, or undefined to get all</p> |


**Returns**:

- <code>*</code> <p>The value or entire config object</p>



* * *

<a id="api_tv_test_dot_config_dot_config_dot_update"></a>

### update(keyOrConfig, value) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Update configuration with new values</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyOrConfig | <code>string | object</code> |  | <p>Key name or config object</p> |
| [value] | <code>*</code> |  | <p>Value if first param is key</p> |


**Returns**:

- <code>object</code> <p>Success response with updated values</p>



* * *

<a id="api_tv_test_dot_config_dot_config_dot_set"></a>

### set(key, value) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Set a single configuration value (alias for update)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Configuration key</p> |
| value | <code>*</code> |  | <p>Configuration value</p> |


**Returns**:

- <code>object</code> <p>Success response</p>



* * *

<a id="api_tv_test_dot_config_dot_config_dot_getDefaultPort"></a>

### getDefaultPort() ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Get the current port or default</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>number</code> <p>Port number</p>



* * *

<a id="api_tv_test_dot_config_dot_config_dot_validate"></a>

### validate(configToValidate, requiredKeys) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Validate configuration object</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| configToValidate | <code>object</code> |  | <p>Config to validate</p> |
| [requiredKeys] | <code>Array.&lt;string&gt;</code> |  | <p>Required keys</p> |


**Returns**:

- <code>object</code> <p>Validation result</p>



* * *

<a id="api_tv_test_dot_config_dot_config_dot_merge"></a>

### merge(userConfig, _) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Merge user config with current state</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [userConfig] | <code>object</code> |  | <p>User configuration</p> |
| [_] | <code>string</code> |  | <p>Context (unused)</p> |


**Returns**:

- <code>object</code> <p>Merged configuration</p>



* * *

<a id="api_tv_test_dot_config_dot_config_dot_createManufacturerConfig"></a>

### createManufacturerConfig(manufacturer, options) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Create manufacturer-specific configuration</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| manufacturer | <code>string</code> |  | <p>Manufacturer name</p> |
| [options] | <code>object</code> |  | <p>Additional options</p> |


**Returns**:

- <code>object</code> <p>Manufacturer config</p>



* * *

<a id="api_tv_test_dot_config_dot_config_dot_getInstanceInfo"></a>

### getInstanceInfo() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Get instance information for debugging</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>object</code> <p>Instance info</p>



* * *

<a id="api_tv_test~connection"></a>

### api_tv_test.connection
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test~controllers"></a>

### api_tv_test.controllers
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_controllers~tvControllers"></a>

### tvControllers
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_controllers_dot_tvControllers"></a>

### module.exports
> <p><strong style="font-size: 1.1em;"><p>Default export of SubfolderControllers proxy.</p></strong></p>
> 
**Kind**: static property of [<code></code>](#undefined)


* * *

<a id="api_tv_test~devices"></a>

### api_tv_test.devices
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_devices~firetv"></a>

### firetv
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_powerOn"></a>

### powerOn(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers on Fire TV device (mock)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>



* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_powerOff"></a>

### powerOff(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers off Fire TV device (mock)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>



* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_sendKey"></a>

### sendKey(deviceId, keyCode) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends key to Fire TV device (mock)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |
| keyCode | <code>string</code> |  | <p>Key to send</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>



* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_REMOTE_KEYS"></a>

### REMOTE_KEYS
> <p><strong style="font-size: 1.1em;"><p>Common remote control keys - constants for external use</p></strong></p>
> 
**Kind**: static namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_isValidRemoteKey"></a>

### isValidRemoteKey(key) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Helper function to validate remote key constants (demonstrates usage)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Key to validate</p> |


**Returns**:

- <code>boolean</code> <p>True if key is valid</p>


**Example**
```js
isValidRemoteKey(REMOTE_KEYS.POWER); // true
```



* * *

<a id="api_tv_test_dot_devices~lg"></a>

### lg
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_devices_dot_lg"></a>

### module.exports
> <p><strong style="font-size: 1.1em;"><p>Default export of LGTVControllers proxy.</p></strong></p>
> 
**Kind**: static property of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_devices~mxnet"></a>

### mxnet
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_powerOn"></a>

### powerOn(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers on MXNet device (mock)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_powerOff"></a>

### powerOff(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers off MXNet device (mock)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_sendCommand"></a>

### sendCommand(deviceId, command) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends command to MXNet device (mock)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |
| command | <code>string</code> |  | <p>Command to send</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Command response</p>



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_getStatus"></a>

### getStatus(deviceId) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device status (mock)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device status</p>



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_COMMANDS"></a>

### COMMANDS
> <p><strong style="font-size: 1.1em;"><p>Common MXNet commands - constants for external use</p></strong></p>
> 
**Kind**: static namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_isValidCommand"></a>

### isValidCommand(command) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Helper function to validate command constants (demonstrates usage)</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>string</code> |  | <p>Command to validate</p> |


**Returns**:

- <code>boolean</code> <p>True if command is valid</p>


**Example**
```js
isValidCommand(COMMANDS.POWER_ON); // true
```



* * *

<a id="api_tv_test~input"></a>

### api_tv_test.input
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test~key"></a>

### api_tv_test.key
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test~lifecycle"></a>

### api_tv_test.lifecycle
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_lifecycle_dot_callAll"></a>

### callAll(methodName, args, options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Scans the API surface for modules that implement the specified lifecycle method
> and calls them with consistent error handling and logging.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| methodName | <code>string</code> |  | <p>Name of the lifecycle method to call</p> |
| [args] | <code>Array</code> | <code>[]</code> | <p>Arguments to pass to the lifecycle method</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Options for the lifecycle call</p> |
| [options.exclude] | <code>Array.&lt;string&gt;</code> | <code>[]</code> | <p>Module names to exclude from lifecycle calls</p> |
| [options.parallel] | <code>boolean</code> | <code>true</code> | <p>Whether to call methods in parallel or series</p> |
| [options.continueOnError] | <code>boolean</code> | <code>true</code> | <p>Whether to continue if a module fails</p> |
| [options.reason] | <code>string</code> | <code>"lifecycle"</code> | <p>Reason for the lifecycle call</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Results object with success/failure counts and details</p>


**Example**
```js
// Initialize all modules
await self.utils.lifecycle.callAll('initialize');

// Start monitoring on all modules
await self.utils.lifecycle.callAll('startMonitoring', [{ initialized: true }]);

// Shutdown excluding connection module
await self.utils.lifecycle.callAll('shutdown', [], { exclude: ['connection'] });
```



* * *

<a id="api_tv_test_dot_lifecycle_dot_getModules"></a>

### getModules(methodName, exclude) ⇒ <code>Array.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Utility function to discover which modules implement a specific lifecycle method
> without actually calling them.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| methodName | <code>string</code> |  | <p>Name of the method to check for</p> |
| [exclude] | <code>Array.&lt;string&gt;</code> | <code>[]</code> | <p>Module names to exclude from scan</p> |


**Returns**:

- <code>Array.&lt;string&gt;</code> <p>Array of module names that implement the method</p>


**Example**
```js
const initModules = self.utils.lifecycle.getModules('initialize');
console.log('Modules with initialize:', initModules);
```



* * *

<a id="api_tv_test_dot_lifecycle_dot_methods"></a>

### methods
> <p><strong style="font-size: 1.1em;"><p>Common lifecycle method names used across modules.</p></strong></p>
> 
**Kind**: static constant of [<code></code>](#undefined)


* * *

<a id="api_tv_test~manufacturer"></a>

### api_tv_test.manufacturer
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_manufacturer~lg"></a>

### lg
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~app"></a>

### app
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~channel"></a>

### channel
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~connect"></a>

### connect
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~disconnect"></a>

### disconnect
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~encryption"></a>

### encryption
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~getInfo"></a>

### getInfo
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~input"></a>

### input
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~key"></a>

### key
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~keys"></a>

### keys
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~power"></a>

### power
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~process"></a>

### process
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~sendCommand"></a>

### sendCommand
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg~volume"></a>

### volume
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test~power"></a>

### api_tv_test.power
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test~proxyTest"></a>

### api_tv_test.proxyTest
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_proxyTest"></a>

### module.exports
> <p><strong style="font-size: 1.1em;"><p>Default export of LGTVControllers proxy for pure proxy testing.</p></strong></p>
> 
**Kind**: static property of [<code></code>](#undefined)


* * *

<a id="api_tv_test~state"></a>

### api_tv_test.state
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test~subfolder"></a>

### api_tv_test.subfolder
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_subfolder~app"></a>

### app
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~channel"></a>

### channel
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~config"></a>

### config
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~connection"></a>

### connection
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~input"></a>

### input
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~key"></a>

### key
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~power"></a>

### power
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~state"></a>

### state
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_subfolder~volume"></a>

### volume
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test~utilities"></a>

### api_tv_test.utilities
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_utilities~commandQueue"></a>

### commandQueue
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_utilities~failOperation"></a>

### failOperation
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_utilities~wakeOnLan"></a>

### wakeOnLan
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test~utils"></a>

### api_tv_test.utils
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_utils~defaults"></a>

### defaults
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_getDefaults"></a>

### getDefaults(dataSystemName) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets defaults for a specific data system.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system (config, device, etc.)</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Defaults for the data system</p>



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_getAllDefaults"></a>

### getAllDefaults() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets all defaults organized by data system.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>All defaults</p>



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_reloadDefaults"></a>

### reloadDefaults() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Reloads defaults from files (clears cache).</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Reloaded defaults</p>



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_createDefaultsAPI"></a>

### createDefaultsAPI(dataSystemName, getCurrentValues, setValues) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a defaults API object for a specific data system.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system</p> |
| getCurrentValues | <code>function</code> |  | <p>Function to get current values from the system</p> |
| setValues | <code>function</code> |  | <p>Function to set values in the system</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Defaults API for the data system</p>



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_restore"></a>

### restore(keys) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Restores specific keys to their default values.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keys | <code>string | Array.&lt;string&gt;</code> |  | <p>Key(s) to restore</p> |


**Returns**:

- <code>Object</code> <p>The restored values</p>



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_isDefault"></a>

### isDefault(key) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Checks if a value is at its default.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Key to check</p> |


**Returns**:

- <code>boolean</code> <p>True if at default value</p>



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_customized"></a>

### customized() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets all keys that have been customized (not at default).</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Object with customized keys and their current vs default values</p>



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_resetAll"></a>

### resetAll(exclude) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Resets all values to defaults.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [exclude] | <code>Array.&lt;string&gt;</code> |  | <p>Keys to exclude from reset</p> |


**Returns**:

- <code>Object</code> <p>The reset values</p>



* * *

<a id="api_tv_test_dot_utils~lifecycle"></a>

### lifecycle
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_tv_test_dot_utils_dot_lifecycle_dot_callAll"></a>

### callAll(methodName, args, options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Scans the API surface for modules that implement the specified lifecycle method
> and calls them with consistent error handling and logging.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| methodName | <code>string</code> |  | <p>Name of the lifecycle method to call</p> |
| [args] | <code>Array</code> | <code>[]</code> | <p>Arguments to pass to the lifecycle method</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Options for the lifecycle call</p> |
| [options.exclude] | <code>Array.&lt;string&gt;</code> | <code>[]</code> | <p>Module names to exclude from lifecycle calls</p> |
| [options.parallel] | <code>boolean</code> | <code>true</code> | <p>Whether to call methods in parallel or series</p> |
| [options.continueOnError] | <code>boolean</code> | <code>true</code> | <p>Whether to continue if a module fails</p> |
| [options.reason] | <code>string</code> | <code>"lifecycle"</code> | <p>Reason for the lifecycle call</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Results object with success/failure counts and details</p>


**Example**
```js
// Initialize all modules
await self.utils.lifecycle.callAll('initialize');

// Start monitoring on all modules
await self.utils.lifecycle.callAll('startMonitoring', [{ initialized: true }]);

// Shutdown excluding connection module
await self.utils.lifecycle.callAll('shutdown', [], { exclude: ['connection'] });
```



* * *

<a id="api_tv_test_dot_utils_dot_lifecycle_dot_getModules"></a>

### getModules(methodName, exclude) ⇒ <code>Array.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Utility function to discover which modules implement a specific lifecycle method
> without actually calling them.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| methodName | <code>string</code> |  | <p>Name of the method to check for</p> |
| [exclude] | <code>Array.&lt;string&gt;</code> | <code>[]</code> | <p>Module names to exclude from scan</p> |


**Returns**:

- <code>Array.&lt;string&gt;</code> <p>Array of module names that implement the method</p>


**Example**
```js
const initModules = self.utils.lifecycle.getModules('initialize');
console.log('Modules with initialize:', initModules);
```



* * *

<a id="api_tv_test_dot_utils_dot_lifecycle_dot_methods"></a>

### methods
> <p><strong style="font-size: 1.1em;"><p>Common lifecycle method names used across modules.</p></strong></p>
> 
**Kind**: static constant of [<code></code>](#undefined)


* * *

<a id="api_tv_test~volume"></a>

### api_tv_test.volume
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)





