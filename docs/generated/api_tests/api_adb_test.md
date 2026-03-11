<a id="api_adb_test"></a>

## @cldmv/slothlet/api\_tests/api\_adb\_test
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_adb_test API surface documented for reference.</p>
> 


**Structure**

[api_adb_test](#api_adb_test)
  * [.adb](#api_adb_test~adb)
    * [.initialize(host, port)](#api_adb_test_dot_adb_dot_initialize) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.getClient()](#api_adb_test_dot_adb_dot_getClient) ⇒ <code><code>Object</code></code>
    * [.getDevice()](#api_adb_test_dot_adb_dot_getDevice) ⇒ <code><code>Object</code></code>
    * [.getDeviceId()](#api_adb_test_dot_adb_dot_getDeviceId) ⇒ <code><code>string</code></code>
    * [.shell(command)](#api_adb_test_dot_adb_dot_shell) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.connect()](#api_adb_test_dot_adb_dot_connect) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.disconnect()](#api_adb_test_dot_adb_dot_disconnect) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.input(inputCommand)](#api_adb_test_dot_adb_dot_input) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
      * [.text(text)](#api_adb_test_dot_input_dot_text) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
      * [.key(key)](#api_adb_test_dot_input_dot_key) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
      * [.tap(x, y)](#api_adb_test_dot_input_dot_tap) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
      * [.swipe(startX, startY, endX, endY, duration)](#api_adb_test_dot_input_dot_swipe) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
      * [.getKeyboardKeys()](#api_adb_test_dot_input_dot_getKeyboardKeys) ⇒ <code><code>Object</code></code>
      * [.getKeycodes()](#api_adb_test_dot_input_dot_getKeycodes) ⇒ <code><code>Object</code></code>
    * [.screenshot()](#api_adb_test_dot_adb_dot_screenshot) ⇒ <code><code>Promise.&lt;Buffer&gt;</code></code>
    * [.listPackages()](#api_adb_test_dot_adb_dot_listPackages) ⇒ <code><code>Promise.&lt;Array.&lt;string&gt;&gt;</code></code>
    * [.getProperties()](#api_adb_test_dot_adb_dot_getProperties) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
  * [.app](#api_adb_test~app)
    * [.launch(packageName, options)](#api_adb_test_dot_app_dot_launch) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.stop(packageName)](#api_adb_test_dot_app_dot_stop) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.getCurrentApp(options)](#api_adb_test_dot_app_dot_getCurrentApp) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.refresh()](#api_adb_test_dot_app_dot_refresh) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.getInstalledPackages(options)](#api_adb_test_dot_app_dot_getInstalledPackages) ⇒ <code><code>Promise.&lt;Array.&lt;string&gt;&gt;</code></code>
    * [.startMonitoring(options)](#api_adb_test_dot_app_dot_startMonitoring) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.stopMonitoring()](#api_adb_test_dot_app_dot_stopMonitoring) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.clearData(packageName, options)](#api_adb_test_dot_app_dot_clearData) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.setEnabled(packageName, enabled)](#api_adb_test_dot_app_dot_setEnabled) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.getPackageInfo(packageName)](#api_adb_test_dot_app_dot_getPackageInfo) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.uninstall(packageName, options)](#api_adb_test_dot_app_dot_uninstall) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.getCurrentPackage()](#api_adb_test_dot_app_dot_getCurrentPackage) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.getCurrentActivity()](#api_adb_test_dot_app_dot_getCurrentActivity) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
  * [.config](#api_adb_test~config)
    * [.get(key)](#api_adb_test_dot_config_dot_get) ⇒ <code><code>any</code></code>
    * [.set(key, value)](#api_adb_test_dot_config_dot_set) ⇒ <code><code>void</code></code>
    * [.merge(configObject, deep)](#api_adb_test_dot_config_dot_merge) ⇒ <code><code>Object</code></code>
    * [.reset(keys)](#api_adb_test_dot_config_dot_reset) ⇒ <code><code>Object</code></code>
    * [.validate(configToValidate)](#api_adb_test_dot_config_dot_validate) ⇒ <code><code>Object</code></code>
    * [.snapshot()](#api_adb_test_dot_config_dot_snapshot) ⇒ <code><code>Object</code></code>
  * [.connection](#api_adb_test~connection)
    * [.ensureConnected()](#api_adb_test_dot_connection_dot_ensureConnected) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.disconnect(isAutoDisconnect)](#api_adb_test_dot_connection_dot_disconnect) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.isConnected()](#api_adb_test_dot_connection_dot_isConnected) ⇒ <code><code>boolean</code></code>
    * [.isAwake()](#api_adb_test_dot_connection_dot_isAwake) ⇒ <code><code>Promise.&lt;boolean&gt;</code></code>
    * [.ensureAwake()](#api_adb_test_dot_connection_dot_ensureAwake) ⇒ <code><code>Promise.&lt;boolean&gt;</code></code>
    * [.startHeartbeat()](#api_adb_test_dot_connection_dot_startHeartbeat) ⇒ <code><code>void</code></code>
    * [.stopHeartbeat()](#api_adb_test_dot_connection_dot_stopHeartbeat) ⇒ <code><code>void</code></code>
    * [.clearTimeouts()](#api_adb_test_dot_connection_dot_clearTimeouts) ⇒ <code><code>void</code></code>
    * [.shell(command, options)](#api_adb_test_dot_connection_dot_shell) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.getInfo()](#api_adb_test_dot_connection_dot_getInfo) ⇒ <code><code>Object</code></code>
    * [.getEmitter()](#api_adb_test_dot_connection_dot_getEmitter) ⇒ <code><code>EventEmitter</code></code>
  * [.device](#api_adb_test~device)
    * [.get(key)](#api_adb_test_dot_device_dot_get) ⇒ <code><code>Promise.&lt;any&gt;</code></code>
    * [.set(key, value)](#api_adb_test_dot_device_dot_set) ⇒ <code><code>void</code></code>
    * [.merge(dataObject, deep)](#api_adb_test_dot_device_dot_merge) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.refresh(keys, force)](#api_adb_test_dot_device_dot_refresh) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.clear(keys)](#api_adb_test_dot_device_dot_clear) ⇒ <code><code>void</code></code>
    * [.withDisplay()](#api_adb_test_dot_device_dot_withDisplay) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.basic()](#api_adb_test_dot_device_dot_basic) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.snapshot(options)](#api_adb_test_dot_device_dot_snapshot) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
  * [.display](#api_adb_test~display)
    * [.capture(options)](#api_adb_test_dot_display_dot_capture) ⇒ <code><code>Promise.&lt;Buffer&gt;</code></code>
    * [.getInfo()](#api_adb_test_dot_display_dot_getInfo) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.getResolution()](#api_adb_test_dot_display_dot_getResolution) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.analyzeScreenshot(options)](#api_adb_test_dot_display_dot_analyzeScreenshot) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.saveScreenshot(filepath, options)](#api_adb_test_dot_display_dot_saveScreenshot) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
  * [.helpers](#api_adb_test~helpers)
    * [.fetchDeviceProperties(properties)](#api_adb_test_dot_helpers_dot_fetchDeviceProperties) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.fetchCurrentAppInfo()](#api_adb_test_dot_helpers_dot_fetchCurrentAppInfo) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.fetchInstalledPackages(systemApps, thirdPartyOnly)](#api_adb_test_dot_helpers_dot_fetchInstalledPackages) ⇒ <code><code>Promise.&lt;Array.&lt;string&gt;&gt;</code></code>
    * [.fetchNetworkDetails()](#api_adb_test_dot_helpers_dot_fetchNetworkDetails) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.fetchAudioInfo()](#api_adb_test_dot_helpers_dot_fetchAudioInfo) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.resolveDefaultActivity(packageName)](#api_adb_test_dot_helpers_dot_resolveDefaultActivity) ⇒ <code><code>Promise.&lt;(string|null)&gt;</code></code>
    * [.refreshCurrentAppInfo(reason, options)](#api_adb_test_dot_helpers_dot_refreshCurrentAppInfo) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.collectStartupMetadata(reason)](#api_adb_test_dot_helpers_dot_collectStartupMetadata) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.scheduleAppInfoRefresh(context, options)](#api_adb_test_dot_helpers_dot_scheduleAppInfoRefresh) ⇒ <code><code>void</code></code>
  * [.input](#api_adb_test~input)
    * [.text(text)](#api_adb_test_dot_input_dot_text) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.key(key)](#api_adb_test_dot_input_dot_key) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.tap(x, y)](#api_adb_test_dot_input_dot_tap) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.swipe(startX, startY, endX, endY, duration)](#api_adb_test_dot_input_dot_swipe) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.getKeyboardKeys()](#api_adb_test_dot_input_dot_getKeyboardKeys) ⇒ <code><code>Object</code></code>
    * [.getKeycodes()](#api_adb_test_dot_input_dot_getKeycodes) ⇒ <code><code>Object</code></code>
  * [.inputHelpers](#api_adb_test~inputHelpers)
    * [.sendKeycode(keycode)](#api_adb_test_dot_inputHelpers_dot_sendKeycode) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.sendText(text)](#api_adb_test_dot_inputHelpers_dot_sendText) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.sendTap(x, y)](#api_adb_test_dot_inputHelpers_dot_sendTap) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.sendSwipe(x1, y1, x2, y2, duration)](#api_adb_test_dot_inputHelpers_dot_sendSwipe) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
    * [.sendLongPress(keycode)](#api_adb_test_dot_inputHelpers_dot_sendLongPress) ⇒ <code><code>Promise.&lt;string&gt;</code></code>
  * [.metadata](#api_adb_test~metadata)
    * [.get(key)](#api_adb_test_dot_metadata_dot_get) ⇒ <code><code>Promise.&lt;any&gt;</code></code>
    * [.set(key, value)](#api_adb_test_dot_metadata_dot_set) ⇒ <code><code>void</code></code>
    * [.merge(metaObject, deep)](#api_adb_test_dot_metadata_dot_merge) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.refresh(reason, force)](#api_adb_test_dot_metadata_dot_refresh) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.collect(reason)](#api_adb_test_dot_metadata_dot_collect) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.clear(keys)](#api_adb_test_dot_metadata_dot_clear) ⇒ <code><code>void</code></code>
    * [.age()](#api_adb_test_dot_metadata_dot_age) ⇒ <code><code>Object</code></code>
    * [.startup()](#api_adb_test_dot_metadata_dot_startup) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.deviceMeta()](#api_adb_test_dot_metadata_dot_deviceMeta) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.networkMeta()](#api_adb_test_dot_metadata_dot_networkMeta) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.packages()](#api_adb_test_dot_metadata_dot_packages) ⇒ <code><code>Promise.&lt;(Array|null)&gt;</code></code>
    * [.snapshot(includeAge)](#api_adb_test_dot_metadata_dot_snapshot) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
  * [.power](#api_adb_test~power)
  * [.press](#api_adb_test~press)
    * [.key(keyName)](#api_adb_test_dot_press_dot_key) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.power()](#api_adb_test_dot_press_dot_power) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.home()](#api_adb_test_dot_press_dot_home) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.back()](#api_adb_test_dot_press_dot_back) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.navigate(direction)](#api_adb_test_dot_press_dot_navigate) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.select()](#api_adb_test_dot_press_dot_select) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.getRemoteKeys()](#api_adb_test_dot_press_dot_getRemoteKeys) ⇒ <code><code>Object</code></code>
    * [.getKeycodes()](#api_adb_test_dot_press_dot_getKeycodes) ⇒ <code><code>Object</code></code>
  * [.state](#api_adb_test~state)
    * [.getConfig()](#api_adb_test_dot_state_dot_getConfig) ⇒ <code><code>Object</code></code>
    * [.getConnectionState()](#api_adb_test_dot_state_dot_getConnectionState) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.getDefaults()](#api_adb_test_dot_state_dot_getDefaults) ⇒ <code><code>Object</code></code>
    * [.getMetadata()](#api_adb_test_dot_state_dot_getMetadata) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.getDevice()](#api_adb_test_dot_state_dot_getDevice) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.getDeviceWithDisplay()](#api_adb_test_dot_state_dot_getDeviceWithDisplay) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.getCurrentApp()](#api_adb_test_dot_state_dot_getCurrentApp) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.getPowerState()](#api_adb_test_dot_state_dot_getPowerState) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
    * [.getAudioState()](#api_adb_test_dot_state_dot_getAudioState) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.getNetworkInfo()](#api_adb_test_dot_state_dot_getNetworkInfo) ⇒ <code><code>Promise.&lt;(Object|null)&gt;</code></code>
    * [.getInstalledPackages(options)](#api_adb_test_dot_state_dot_getInstalledPackages) ⇒ <code><code>Promise.&lt;Array.&lt;string&gt;&gt;</code></code>
    * [.refreshDeviceInfo(options)](#api_adb_test_dot_state_dot_refreshDeviceInfo) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.refreshAppInfo()](#api_adb_test_dot_state_dot_refreshAppInfo) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.refreshNetworkInfo()](#api_adb_test_dot_state_dot_refreshNetworkInfo) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.refreshAudioInfo()](#api_adb_test_dot_state_dot_refreshAudioInfo) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.refreshAll()](#api_adb_test_dot_state_dot_refreshAll) ⇒ <code><code>Promise.&lt;void&gt;</code></code>
    * [.createSnapshot(options)](#api_adb_test_dot_state_dot_createSnapshot) ⇒ <code><code>Promise.&lt;Object&gt;</code></code>
  * [.utils](#api_adb_test~utils)
    * [.defaults](#api_adb_test_dot_utils~defaults)
      * [.loadDefaultsFromFiles()](#api_adb_test_dot_utils_dot_defaults_dot_loadDefaultsFromFiles) ⇒ <code><code>Object</code></code>
      * [.getDefaults(dataSystemName)](#api_adb_test_dot_utils_dot_defaults_dot_getDefaults) ⇒ <code><code>Object</code></code>
      * [.getAllDefaults()](#api_adb_test_dot_utils_dot_defaults_dot_getAllDefaults) ⇒ <code><code>Object</code></code>
      * [.reloadDefaults()](#api_adb_test_dot_utils_dot_defaults_dot_reloadDefaults) ⇒ <code><code>Object</code></code>
      * [.createDefaultsAPI(dataSystemName, getCurrentValues, setValues)](#api_adb_test_dot_utils_dot_defaults_dot_createDefaultsAPI) ⇒ <code><code>Object</code></code>
      * [.restore(keys)](#api_adb_test_dot_utils_dot_defaults_dot_restore) ⇒ <code><code>Object</code></code>
      * [.isDefault(key)](#api_adb_test_dot_utils_dot_defaults_dot_isDefault) ⇒ <code><code>boolean</code></code>
      * [.customized()](#api_adb_test_dot_utils_dot_defaults_dot_customized) ⇒ <code><code>Object</code></code>
      * [.resetAll(exclude)](#api_adb_test_dot_utils_dot_defaults_dot_resetAll) ⇒ <code><code>Object</code></code>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
```





* * *

<a id="api_adb_test"></a>

### api_adb_test
> <p><strong style="font-size: 1.1em;"><p>ADB API dummy modules for Android TV Remote slothlet API testing.</p></strong></p>
> 
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
```



* * *

<a id="api_adb_test~adb"></a>

### api_adb_test.adb
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_adb_dot_initialize"></a>

### initialize(host, port) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Initializes ADB client and device connection.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| host | <code>string</code> |  | <p>Device host/IP</p> |
| [port] | <code>number</code> | <code>5555</code> | <p>ADB port</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_adb_dot_getClient"></a>

### getClient() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current ADB client instance.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>ADB client</p>



* * *

<a id="api_adb_test_dot_adb_dot_getDevice"></a>

### getDevice() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current device instance.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>ADB device</p>



* * *

<a id="api_adb_test_dot_adb_dot_getDeviceId"></a>

### getDeviceId() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current device ID.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>string</code> <p>Device ID</p>



* * *

<a id="api_adb_test_dot_adb_dot_shell"></a>

### shell(command) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Executes an ADB shell command.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>string</code> |  | <p>Shell command to execute</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Command output</p>



* * *

<a id="api_adb_test_dot_adb_dot_connect"></a>

### connect() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Connects to the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_adb_dot_disconnect"></a>

### disconnect() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Disconnects from the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_adb_dot_input"></a>

### input(inputCommand) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Executes an input command.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| inputCommand | <code>string</code> |  | <p>Input command (keyevent, text, tap, etc.)</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Command output</p>



* * *

<a id="api_adb_test_dot_input_dot_text"></a>

### text(text) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends text input to the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>string</code> |  | <p>Text to input</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_key"></a>

### key(key) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a key event.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string | number</code> |  | <p>Key name or code</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_tap"></a>

### tap(x, y) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a tap event at coordinates.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x | <code>number</code> |  | <p>X coordinate</p> |
| y | <code>number</code> |  | <p>Y coordinate</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_swipe"></a>

### swipe(startX, startY, endX, endY, duration) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a swipe gesture.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| startX | <code>number</code> |  | <p>Start X coordinate</p> |
| startY | <code>number</code> |  | <p>Start Y coordinate</p> |
| endX | <code>number</code> |  | <p>End X coordinate</p> |
| endY | <code>number</code> |  | <p>End Y coordinate</p> |
| [duration] | <code>number</code> | <code>300</code> | <p>Swipe duration in ms</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_getKeyboardKeys"></a>

### getKeyboardKeys() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets available keyboard keys.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Keyboard keys mapping</p>



* * *

<a id="api_adb_test_dot_input_dot_getKeycodes"></a>

### getKeycodes() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets keycodes mapping.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Keycodes mapping</p>



* * *

<a id="api_adb_test_dot_adb_dot_screenshot"></a>

### screenshot() ⇒ <code>Promise.&lt;Buffer&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Takes a screenshot and returns the buffer.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Buffer&gt;</code> <p>Screenshot buffer</p>



* * *

<a id="api_adb_test_dot_adb_dot_listPackages"></a>

### listPackages() ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Lists installed packages.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> <p>Array of package names</p>



* * *

<a id="api_adb_test_dot_adb_dot_getProperties"></a>

### getProperties() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device properties.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device properties</p>



* * *

<a id="api_adb_test~app"></a>

### api_adb_test.app
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_app_dot_launch"></a>

### launch(packageName, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Launches an application by package name.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>The package name of the app to launch</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Launch options</p> |
| [options.activity] | <code>string</code> |  | <p>Specific activity to launch (optional)</p> |
| [options.clearTop] | <code>boolean</code> | <code>false</code> | <p>Clear other activities on top</p> |
| [options.delay] | <code>number</code> | <code>2000</code> | <p>Delay after launch in ms</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await api.app.launch("com.netflix.ninja");

// Launch with specific activity
await api.app.launch("com.android.settings", {
  activity: ".Settings"
});
```



* * *

<a id="api_adb_test_dot_app_dot_stop"></a>

### stop(packageName) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Stops an application by package name.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>The package name of the app to stop</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_app_dot_getCurrentApp"></a>

### getCurrentApp(options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the currently running app.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Options</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Current app info</p>



* * *

<a id="api_adb_test_dot_app_dot_refresh"></a>

### refresh() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes the app state.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_app_dot_getInstalledPackages"></a>

### getInstalledPackages(options) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets installed packages.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Options</p> |


**Returns**:

- <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> <p>List of package names</p>



* * *

<a id="api_adb_test_dot_app_dot_startMonitoring"></a>

### startMonitoring(options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Starts monitoring app changes.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Monitor options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_app_dot_stopMonitoring"></a>

### stopMonitoring() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Stops monitoring app changes.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_app_dot_clearData"></a>

### clearData(packageName, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Clears app data.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name to clear</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Clear options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_app_dot_setEnabled"></a>

### setEnabled(packageName, enabled) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Enables or disables an app.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name</p> |
| enabled | <code>boolean</code> |  | <p>Whether to enable the app</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_app_dot_getPackageInfo"></a>

### getPackageInfo(packageName) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets package information.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name to get info for</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Package info</p>



* * *

<a id="api_adb_test_dot_app_dot_uninstall"></a>

### uninstall(packageName, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Uninstalls an app.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name to uninstall</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Uninstall options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_app_dot_getCurrentPackage"></a>

### getCurrentPackage() ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current package name.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Current package name</p>



* * *

<a id="api_adb_test_dot_app_dot_getCurrentActivity"></a>

### getCurrentActivity() ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current activity name.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Current activity name</p>



* * *

<a id="api_adb_test~config"></a>

### api_adb_test.config
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_config_dot_get"></a>

### get(key) ⇒ <code>any</code>
> <p><strong style="font-size: 1.1em;"><p>Gets configuration values.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | <p>Specific config key to get, or undefined for entire config</p> |


**Returns**:

- <code>any</code> <p>Configuration value(s)</p>


**Example**
```js
// Get entire config
const config = api.config.get();

// Get specific value
const host = api.config.get('host');
```



* * *

<a id="api_adb_test_dot_config_dot_set"></a>

### set(key, value) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Sets a configuration value.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string | Object</code> |  | <p>Config key to set, or object of key-value pairs</p> |
| [value] | <code>any</code> |  | <p>Value to set (if key is string)</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
// Set single value
api.config.set('quiet', true);

// Set multiple values
api.config.set({
  quiet: true,
  heartbeatInterval: 60000
});
```



* * *

<a id="api_adb_test_dot_config_dot_merge"></a>

### merge(configObject, deep) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Merges configuration values with existing config.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| configObject | <code>Object</code> |  | <p>Configuration object to merge</p> |
| [deep] | <code>boolean</code> | <code>false</code> | <p>Whether to perform deep merge</p> |


**Returns**:

- <code>Object</code> <p>Updated configuration</p>


**Example**
```js
// Shallow merge
api.config.merge({ quiet: true, port: 5556 });

// Deep merge
api.config.merge({ advanced: { timeout: 10000 } }, true);
```



* * *

<a id="api_adb_test_dot_config_dot_reset"></a>

### reset(keys) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Resets configuration to defaults.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [keys] | <code>string | Array.&lt;string&gt;</code> |  | <p>Specific keys to reset, or undefined to reset all</p> |


**Returns**:

- <code>Object</code> <p>Updated configuration</p>


**Example**
```js
// Reset all to defaults
api.config.reset();

// Reset specific keys
api.config.reset(['quiet', 'port']);
api.config.reset('host');
```



* * *

<a id="api_adb_test_dot_config_dot_validate"></a>

### validate(configToValidate) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Validates configuration values.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [configToValidate] | <code>Object</code> |  | <p>Config to validate, or current config if not provided</p> |


**Returns**:

- <code>Object</code> <p>Validation result with isValid boolean and errors array</p>


**Example**
```js
const validation = api.config.validate();
if (!validation.isValid) {
  console.log('Config errors:', validation.errors);
}
```



* * *

<a id="api_adb_test_dot_config_dot_snapshot"></a>

### snapshot() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets a snapshot of the current configuration state.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Configuration snapshot with metadata</p>


**Example**
```js
const snapshot = api.config.snapshot();
console.log('Config created:', snapshot.timestamp);
```



* * *

<a id="api_adb_test~connection"></a>

### api_adb_test.connection
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_connection_dot_ensureConnected"></a>

### ensureConnected() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Ensures the device is connected, attempting to connect if not.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await remote.connection.ensureConnected();
```



* * *

<a id="api_adb_test_dot_connection_dot_disconnect"></a>

### disconnect(isAutoDisconnect) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Disconnects from the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [isAutoDisconnect] | <code>boolean</code> | <code>false</code> | <p>Whether this is an automatic disconnection.</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await remote.connection.disconnect();
```



* * *

<a id="api_adb_test_dot_connection_dot_isConnected"></a>

### isConnected() ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current connection status.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>boolean</code> <p>True if connected, false otherwise.</p>


**Example**
```js
if (remote.connection.isConnected()) {
  // Device is connected
}
```



* * *

<a id="api_adb_test_dot_connection_dot_isAwake"></a>

### isAwake() ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Checks if the device is awake and responsive.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>True if device is awake, false otherwise.</p>


**Example**
```js
const awake = await remote.connection.isAwake();
```



* * *

<a id="api_adb_test_dot_connection_dot_ensureAwake"></a>

### ensureAwake() ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Ensures the device is awake, waking it if necessary.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>True if device is awake, false otherwise.</p>


**Example**
```js
await remote.connection.ensureAwake();
```



* * *

<a id="api_adb_test_dot_connection_dot_startHeartbeat"></a>

### startHeartbeat() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Starts the heartbeat mechanism to maintain connection.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
remote.connection.startHeartbeat();
```



* * *

<a id="api_adb_test_dot_connection_dot_stopHeartbeat"></a>

### stopHeartbeat() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Stops the heartbeat mechanism.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
remote.connection.stopHeartbeat();
```



* * *

<a id="api_adb_test_dot_connection_dot_clearTimeouts"></a>

### clearTimeouts() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Clears all active timers.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
remote.connection.clearTimeouts();
```



* * *

<a id="api_adb_test_dot_connection_dot_shell"></a>

### shell(command, options) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Executes a shell command on the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>string</code> |  | <p>The shell command to execute</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Command options</p> |
| [options.trim] | <code>boolean</code> | <code>true</code> | <p>Whether to trim the output</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Command output</p>


**Example**
```js
const output = await remote.connection.shell('getprop ro.product.model');
console.log('Device model:', output);
```



* * *

<a id="api_adb_test_dot_connection_dot_getInfo"></a>

### getInfo() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets connection information and statistics.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Connection information</p>


**Example**
```js
const info = remote.connection.getInfo();
console.log('Connection info:', info);
```



* * *

<a id="api_adb_test_dot_connection_dot_getEmitter"></a>

### getEmitter() ⇒ <code>EventEmitter</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the connection event emitter for subscribing to connection events.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>EventEmitter</code> <p>The connection event emitter</p>


**Example**
```js
const emitter = remote.connection.getEmitter();
emitter.on('connected', (event) => {
  console.log('Connected to', event.host);
});
```



* * *

<a id="api_adb_test~device"></a>

### api_adb_test.device
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_device_dot_get"></a>

### get(key) ⇒ <code>Promise.&lt;any&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device data.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | <p>Specific device data key, or undefined for entire device data</p> |


**Returns**:

- <code>Promise.&lt;any&gt;</code> <p>Device data value(s)</p>


**Example**
```js
// Get entire device data
const device = await api.device.get();

// Get specific data
const info = await api.device.get('info');
const network = await api.device.get('network');
```



* * *

<a id="api_adb_test_dot_device_dot_set"></a>

### set(key, value) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Sets device data (primarily for caching).</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string | Object</code> |  | <p>Device data key or object of key-value pairs</p> |
| [value] | <code>any</code> |  | <p>Value to set (if key is string)</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
// Set single value
api.device.set('info', deviceInfo);

// Set multiple values
api.device.set({
  info: deviceInfo,
  network: networkInfo
});
```



* * *

<a id="api_adb_test_dot_device_dot_merge"></a>

### merge(dataObject, deep) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Merges device data with existing data.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataObject | <code>Object</code> |  | <p>Device data object to merge</p> |
| [deep] | <code>boolean</code> | <code>false</code> | <p>Whether to perform deep merge</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Updated device data</p>


**Example**
```js
// Merge new device info
await api.device.merge({ info: newDeviceInfo });
```



* * *

<a id="api_adb_test_dot_device_dot_refresh"></a>

### refresh(keys, force) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes device data from the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [keys] | <code>string | Array.&lt;string&gt;</code> |  | <p>Specific keys to refresh, or undefined to refresh all</p> |
| [force] | <code>boolean</code> | <code>false</code> | <p>Force refresh even if recently updated</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Updated device data</p>


**Example**
```js
// Refresh all device data
await api.device.refresh();

// Refresh specific data
await api.device.refresh(['info', 'network']);
await api.device.refresh('power');
```



* * *

<a id="api_adb_test_dot_device_dot_clear"></a>

### clear(keys) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Clears cached device data.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [keys] | <code>string | Array.&lt;string&gt;</code> |  | <p>Specific keys to clear, or undefined to clear all</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
// Clear all cached data
api.device.clear();

// Clear specific data
api.device.clear(['info', 'network']);
api.device.clear('power');
```



* * *

<a id="api_adb_test_dot_device_dot_withDisplay"></a>

### withDisplay() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device data with display information included.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Complete device data including display</p>


**Example**
```js
const deviceWithDisplay = await api.device.withDisplay();
console.log('Display info:', deviceWithDisplay.display);
```



* * *

<a id="api_adb_test_dot_device_dot_basic"></a>

### basic() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets basic device data without display information.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Basic device data</p>


**Example**
```js
const basicDevice = await api.device.basic();
```



* * *

<a id="api_adb_test_dot_device_dot_snapshot"></a>

### snapshot(options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets a snapshot of the current device state.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Snapshot options</p> |
| [options.includeDisplay] | <code>boolean</code> | <code>true</code> | <p>Include display information</p> |
| [options.refresh] | <code>boolean</code> | <code>false</code> | <p>Refresh data before snapshot</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device data snapshot with metadata</p>


**Example**
```js
const snapshot = await api.device.snapshot();
console.log('Device snapshot:', snapshot);
```



* * *

<a id="api_adb_test~display"></a>

### api_adb_test.display
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_display_dot_capture"></a>

### capture(options) ⇒ <code>Promise.&lt;Buffer&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Captures a screenshot from the Android TV device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Screenshot capture options</p> |
| [options.format] | <code>string</code> | <code>"png"</code> | <p>Output format (&quot;png&quot;, &quot;jpg&quot;, &quot;webp&quot;)</p> |
| [options.quality] | <code>number</code> | <code>90</code> | <p>Image quality (1-100)</p> |
| [options.width] | <code>number</code> |  | <p>Resize width</p> |
| [options.height] | <code>number</code> |  | <p>Resize height</p> |
| [options.useSharp] | <code>boolean</code> | <code>true</code> | <p>Use Sharp for image processing</p> |


**Returns**:

- <code>Promise.&lt;Buffer&gt;</code> <p>Screenshot buffer</p>



* * *

<a id="api_adb_test_dot_display_dot_getInfo"></a>

### getInfo() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets display information.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Display info</p>



* * *

<a id="api_adb_test_dot_display_dot_getResolution"></a>

### getResolution() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets screen resolution.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Resolution info</p>



* * *

<a id="api_adb_test_dot_display_dot_analyzeScreenshot"></a>

### analyzeScreenshot(options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Analyzes screenshot for brightness/darkness.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Analysis options</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Analysis results</p>



* * *

<a id="api_adb_test_dot_display_dot_saveScreenshot"></a>

### saveScreenshot(filepath, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Saves screenshot to file.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filepath | <code>string</code> |  | <p>Path to save screenshot</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Save options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test~helpers"></a>

### api_adb_test.helpers
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_helpers_dot_fetchDeviceProperties"></a>

### fetchDeviceProperties(properties) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches device properties from the Android system.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [properties] | <code>Array.&lt;string&gt; | null</code> | <code>null</code> | <p>Specific properties to fetch, or null for all</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device properties object</p>


**Example**
```js
// Get all properties
const allProps = await api.helpers.fetchDeviceProperties();

// Get specific properties
const specificProps = await api.helpers.fetchDeviceProperties(['ro.product.model', 'ro.build.version.release']);
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchCurrentAppInfo"></a>

### fetchCurrentAppInfo() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches information about the currently running application.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Current app information or null</p>


**Example**
```js
const currentApp = await api.helpers.fetchCurrentAppInfo();
if (currentApp) {
  console.log('Current app:', currentApp.packageName);
}
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchInstalledPackages"></a>

### fetchInstalledPackages(systemApps, thirdPartyOnly) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches the list of installed packages.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [systemApps] | <code>boolean</code> | <code>false</code> | <p>Include system apps</p> |
| [thirdPartyOnly] | <code>boolean</code> | <code>true</code> | <p>Only third-party apps</p> |


**Returns**:

- <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> <p>Array of package names</p>


**Example**
```js
const packages = await api.helpers.fetchInstalledPackages();
console.log('Installed packages:', packages.length);

// Include system apps
const allPackages = await api.helpers.fetchInstalledPackages(true, false);
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchNetworkDetails"></a>

### fetchNetworkDetails() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches network connection details.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Network information object</p>


**Example**
```js
const network = await api.helpers.fetchNetworkDetails();
console.log('WiFi connected:', network.wifi.connected);
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchAudioInfo"></a>

### fetchAudioInfo() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches audio system information.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Audio information object</p>


**Example**
```js
const audio = await api.helpers.fetchAudioInfo();
console.log('Audio info:', audio);
```



* * *

<a id="api_adb_test_dot_helpers_dot_resolveDefaultActivity"></a>

### resolveDefaultActivity(packageName) ⇒ <code>Promise.&lt;(string|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Resolves the default activity for a given package.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>The package name to resolve</p> |


**Returns**:

- <code>Promise.&lt;(string|null)&gt;</code> <p>Default activity name or null</p>


**Example**
```js
const activity = await api.helpers.resolveDefaultActivity('com.netflix.ninja');
console.log('Default activity:', activity);
```



* * *

<a id="api_adb_test_dot_helpers_dot_refreshCurrentAppInfo"></a>

### refreshCurrentAppInfo(reason, options) ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes current app information and emits change events if needed.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>string</code> | <code>"manual"</code> | <p>Reason for refresh</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Refresh options</p> |
| [options.forceEmit] | <code>boolean</code> | <code>false</code> | <p>Force emit event even if app hasn't changed</p> |


**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Updated app information</p>


**Example**
```js
const appInfo = await api.helpers.refreshCurrentAppInfo();

// Force emit event
await api.helpers.refreshCurrentAppInfo("user_action", { forceEmit: true });
```



* * *

<a id="api_adb_test_dot_helpers_dot_collectStartupMetadata"></a>

### collectStartupMetadata(reason) ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Collects comprehensive startup metadata from the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>string</code> | <code>"init"</code> | <p>Reason for collection</p> |


**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Collected metadata or null on error</p>


**Example**
```js
const metadata = await api.helpers.collectStartupMetadata();
console.log('Device metadata:', metadata);
```



* * *

<a id="api_adb_test_dot_helpers_dot_scheduleAppInfoRefresh"></a>

### scheduleAppInfoRefresh(context, options) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Schedules an app info refresh with a delay.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| context | <code>string</code> |  | <p>Context for the refresh</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Schedule options</p> |
| [options.forceEmit] | <code>boolean</code> | <code>false</code> | <p>Force emit event</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
api.helpers.scheduleAppInfoRefresh("home_pressed", { forceEmit: true });
```



* * *

<a id="api_adb_test~input"></a>

### api_adb_test.input
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_input_dot_text"></a>

### text(text) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends text input to the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>string</code> |  | <p>Text to input</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_key"></a>

### key(key) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a key event.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string | number</code> |  | <p>Key name or code</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_tap"></a>

### tap(x, y) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a tap event at coordinates.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x | <code>number</code> |  | <p>X coordinate</p> |
| y | <code>number</code> |  | <p>Y coordinate</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_swipe"></a>

### swipe(startX, startY, endX, endY, duration) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a swipe gesture.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| startX | <code>number</code> |  | <p>Start X coordinate</p> |
| startY | <code>number</code> |  | <p>Start Y coordinate</p> |
| endX | <code>number</code> |  | <p>End X coordinate</p> |
| endY | <code>number</code> |  | <p>End Y coordinate</p> |
| [duration] | <code>number</code> | <code>300</code> | <p>Swipe duration in ms</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_input_dot_getKeyboardKeys"></a>

### getKeyboardKeys() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets available keyboard keys.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Keyboard keys mapping</p>



* * *

<a id="api_adb_test_dot_input_dot_getKeycodes"></a>

### getKeycodes() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets keycodes mapping.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Keycodes mapping</p>



* * *

<a id="api_adb_test~inputHelpers"></a>

### api_adb_test.inputHelpers
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendKeycode"></a>

### sendKeycode(keycode) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a keycode to the device using input keyevent.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keycode | <code>number</code> |  | <p>The Android keycode to send</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Shell command output</p>


**Example**
```js
await api.inputHelpers.sendKeycode(3); // KEYCODE_HOME
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendText"></a>

### sendText(text) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends text input to the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>string</code> |  | <p>The text to input</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Shell command output</p>


**Example**
```js
await api.inputHelpers.sendText('Hello World');
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendTap"></a>

### sendTap(x, y) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a tap gesture at specified coordinates.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x | <code>number</code> |  | <p>X coordinate</p> |
| y | <code>number</code> |  | <p>Y coordinate</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Shell command output</p>


**Example**
```js
await api.inputHelpers.sendTap(500, 300);
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendSwipe"></a>

### sendSwipe(x1, y1, x2, y2, duration) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a swipe gesture between two points.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x1 | <code>number</code> |  | <p>Start X coordinate</p> |
| y1 | <code>number</code> |  | <p>Start Y coordinate</p> |
| x2 | <code>number</code> |  | <p>End X coordinate</p> |
| y2 | <code>number</code> |  | <p>End Y coordinate</p> |
| [duration] | <code>number</code> | <code>300</code> | <p>Swipe duration in milliseconds</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Shell command output</p>


**Example**
```js
await api.inputHelpers.sendSwipe(100, 500, 900, 500, 500); // Horizontal swipe
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendLongPress"></a>

### sendLongPress(keycode) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends a long press keycode using sendevent.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keycode | <code>number</code> |  | <p>The keycode to long press</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Shell command output</p>


**Example**
```js
await api.inputHelpers.sendLongPress(26); // Long press power button
```



* * *

<a id="api_adb_test~metadata"></a>

### api_adb_test.metadata
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_metadata_dot_get"></a>

### get(key) ⇒ <code>Promise.&lt;any&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets metadata.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | <p>Specific metadata key, or undefined for entire metadata</p> |


**Returns**:

- <code>Promise.&lt;any&gt;</code> <p>Metadata value(s)</p>


**Example**
```js
// Get entire metadata
const metadata = await api.metadata.get();

// Get specific metadata
const deviceMeta = await api.metadata.get('device');
const networkMeta = await api.metadata.get('network');
```



* * *

<a id="api_adb_test_dot_metadata_dot_set"></a>

### set(key, value) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Sets metadata (primarily for caching).</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string | Object</code> |  | <p>Metadata key or object of key-value pairs</p> |
| [value] | <code>any</code> |  | <p>Value to set (if key is string)</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
// Set single value
api.metadata.set('device', deviceMetadata);

// Set multiple values
api.metadata.set({
  device: deviceMeta,
  network: networkMeta
});
```



* * *

<a id="api_adb_test_dot_metadata_dot_merge"></a>

### merge(metaObject, deep) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Merges metadata with existing metadata.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| metaObject | <code>Object</code> |  | <p>Metadata object to merge</p> |
| [deep] | <code>boolean</code> | <code>false</code> | <p>Whether to perform deep merge</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Updated metadata</p>


**Example**
```js
// Merge new metadata
await api.metadata.merge({ device: newDeviceMeta });
```



* * *

<a id="api_adb_test_dot_metadata_dot_refresh"></a>

### refresh(reason, force) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes metadata by collecting it from the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>string</code> | <code>"manual"</code> | <p>Reason for refresh</p> |
| [force] | <code>boolean</code> | <code>false</code> | <p>Force refresh even if recently updated</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Updated metadata</p>


**Example**
```js
// Refresh metadata
await api.metadata.refresh("user_requested");

// Force refresh
await api.metadata.refresh("force_update", true);
```



* * *

<a id="api_adb_test_dot_metadata_dot_collect"></a>

### collect(reason) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Collects fresh metadata from the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>string</code> | <code>"collect"</code> | <p>Reason for collection</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Collected metadata</p>


**Example**
```js
const freshMetadata = await api.metadata.collect("initialization");
```



* * *

<a id="api_adb_test_dot_metadata_dot_clear"></a>

### clear(keys) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Clears cached metadata.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [keys] | <code>string | Array.&lt;string&gt;</code> |  | <p>Specific keys to clear, or undefined to clear all</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
// Clear all metadata
api.metadata.clear();

// Clear specific metadata
api.metadata.clear(['device', 'network']);
api.metadata.clear('packages');
```



* * *

<a id="api_adb_test_dot_metadata_dot_age"></a>

### age() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the age of the metadata cache.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Cache age information</p>


**Example**
```js
const age = api.metadata.age();
console.log('Metadata is', age.minutes, 'minutes old');
```



* * *

<a id="api_adb_test_dot_metadata_dot_startup"></a>

### startup() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets startup-specific metadata.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Startup metadata</p>


**Example**
```js
const startup = await api.metadata.startup();
if (startup) {
  console.log('Startup reason:', startup.reason);
}
```



* * *

<a id="api_adb_test_dot_metadata_dot_deviceMeta"></a>

### deviceMeta() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device-specific metadata.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Device metadata</p>


**Example**
```js
const deviceMeta = await api.metadata.device();
```



* * *

<a id="api_adb_test_dot_metadata_dot_networkMeta"></a>

### networkMeta() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets network-specific metadata.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Network metadata</p>


**Example**
```js
const networkMeta = await api.metadata.network();
```



* * *

<a id="api_adb_test_dot_metadata_dot_packages"></a>

### packages() ⇒ <code>Promise.&lt;(Array|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets packages metadata.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Array|null)&gt;</code> <p>Packages metadata</p>


**Example**
```js
const packages = await api.metadata.packages();
console.log('Installed packages:', packages?.length);
```



* * *

<a id="api_adb_test_dot_metadata_dot_snapshot"></a>

### snapshot(includeAge) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets a snapshot of the current metadata state.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [includeAge] | <code>boolean</code> | <code>true</code> | <p>Include age information</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Metadata snapshot with metadata</p>


**Example**
```js
const snapshot = await api.metadata.snapshot();
console.log('Metadata snapshot:', snapshot);
```



* * *

<a id="api_adb_test~power"></a>

### api_adb_test.power
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test~press"></a>

### api_adb_test.press
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_press_dot_key"></a>

### key(keyName) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Presses a remote control key.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>string</code> |  | <p>Name of the key to press</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_press_dot_power"></a>

### power() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Presses the power button.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_press_dot_home"></a>

### home() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Presses the home button.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_press_dot_back"></a>

### back() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Presses the back button.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_press_dot_navigate"></a>

### navigate(direction) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Presses navigation keys.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| direction | <code>string</code> |  | <p>Direction (&quot;up&quot;, &quot;down&quot;, &quot;left&quot;, &quot;right&quot;)</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_press_dot_select"></a>

### select() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Presses the select/OK button.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="api_adb_test_dot_press_dot_getRemoteKeys"></a>

### getRemoteKeys() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets available remote keys.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Remote keys mapping</p>



* * *

<a id="api_adb_test_dot_press_dot_getKeycodes"></a>

### getKeycodes() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets keycodes mapping.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Keycodes mapping</p>



* * *

<a id="api_adb_test~state"></a>

### api_adb_test.state
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_state_dot_getConfig"></a>

### getConfig() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current configuration settings.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Configuration object</p>


**Example**
```js
const config = api.state.getConfig();
console.log('Host:', config.host);
console.log('Port:', config.port);
```



* * *

<a id="api_adb_test_dot_state_dot_getConnectionState"></a>

### getConnectionState() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current connection state.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Connection state information</p>


**Example**
```js
const connectionState = await api.state.getConnectionState();
console.log('Connected:', connectionState.connected);
console.log('Status:', connectionState.status);
```



* * *

<a id="api_adb_test_dot_state_dot_getDefaults"></a>

### getDefaults() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets default configuration values.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Default configuration object</p>


**Example**
```js
const defaults = api.state.getDefaults();
console.log('Default port:', defaults.port);
```



* * *

<a id="api_adb_test_dot_state_dot_getMetadata"></a>

### getMetadata() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device metadata collected during initialization.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device metadata object</p>


**Example**
```js
const metadata = await api.state.getMetadata();
console.log('Device model:', metadata.device?.model);
console.log('Android version:', metadata.device?.version);
```



* * *

<a id="api_adb_test_dot_state_dot_getDevice"></a>

### getDevice() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets basic device information without display info.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device information object</p>


**Example**
```js
const device = await api.state.getDevice();
console.log('Device info:', device);
```



* * *

<a id="api_adb_test_dot_state_dot_getDeviceWithDisplay"></a>

### getDeviceWithDisplay() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets comprehensive device information including display details.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Complete device information object</p>


**Example**
```js
const deviceWithDisplay = await api.state.getDeviceWithDisplay();
console.log('Display info:', deviceWithDisplay.display);
```



* * *

<a id="api_adb_test_dot_state_dot_getCurrentApp"></a>

### getCurrentApp() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current application state.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Current application information</p>


**Example**
```js
const currentApp = await api.state.getCurrentApp();
if (currentApp) {
  console.log('Current app:', currentApp.packageName);
}
```



* * *

<a id="api_adb_test_dot_state_dot_getPowerState"></a>

### getPowerState() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device power state information.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Power state information</p>


**Example**
```js
const powerState = await api.state.getPowerState();
console.log('Device awake:', powerState.mWakefulness === 'Awake');
```



* * *

<a id="api_adb_test_dot_state_dot_getAudioState"></a>

### getAudioState() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets current audio state information.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Audio state information</p>


**Example**
```js
const audioState = await api.state.getAudioState();
if (audioState) {
  console.log('Audio info:', audioState);
}
```



* * *

<a id="api_adb_test_dot_state_dot_getNetworkInfo"></a>

### getNetworkInfo() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets network information for the device.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;(Object|null)&gt;</code> <p>Network information</p>


**Example**
```js
const networkInfo = await api.state.getNetworkInfo();
if (networkInfo) {
  console.log('WiFi connected:', networkInfo.wifi.connected);
}
```



* * *

<a id="api_adb_test_dot_state_dot_getInstalledPackages"></a>

### getInstalledPackages(options) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the list of installed packages.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Options for package listing</p> |
| [options.systemApps] | <code>boolean</code> | <code>false</code> | <p>Include system apps</p> |
| [options.thirdPartyOnly] | <code>boolean</code> | <code>true</code> | <p>Only third-party apps</p> |


**Returns**:

- <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> <p>Array of package names</p>


**Example**
```js
const packages = await api.state.getInstalledPackages();
console.log('Installed apps:', packages.length);
```



* * *

<a id="api_adb_test_dot_state_dot_refreshDeviceInfo"></a>

### refreshDeviceInfo(options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes device information cache.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Refresh options</p> |
| [options.force] | <code>boolean</code> | <code>false</code> | <p>Force refresh even if recently updated</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// Refresh device info
await api.state.refreshDeviceInfo();

// Force refresh
await api.state.refreshDeviceInfo({ force: true });
```



* * *

<a id="api_adb_test_dot_state_dot_refreshAppInfo"></a>

### refreshAppInfo() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes application information cache.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await api.state.refreshAppInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshNetworkInfo"></a>

### refreshNetworkInfo() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes network information cache.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await api.state.refreshNetworkInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshAudioInfo"></a>

### refreshAudioInfo() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes audio information cache.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await api.state.refreshAudioInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshAll"></a>

### refreshAll() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes all cached information.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// Refresh everything
await api.state.refreshAll();
```



* * *

<a id="api_adb_test_dot_state_dot_createSnapshot"></a>

### createSnapshot(options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a complete snapshot of the current device state.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Snapshot options</p> |
| [options.includeDisplay] | <code>boolean</code> | <code>true</code> | <p>Include display information</p> |
| [options.compact] | <code>boolean</code> | <code>false</code> | <p>Create compact snapshot</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Complete device state snapshot</p>


**Example**
```js
const snapshot = await api.state.createSnapshot();
console.log('Device snapshot:', snapshot);

// Compact snapshot without display
const compactSnapshot = await api.state.createSnapshot({
  includeDisplay: false,
  compact: true
});
```



* * *

<a id="api_adb_test~utils"></a>

### api_adb_test.utils
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_utils~defaults"></a>

### defaults
> 
**Kind**: inner namespace of [<code></code>](#undefined)


* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_loadDefaultsFromFiles"></a>

### loadDefaultsFromFiles() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Auto-scans and loads defaults from JSON files in data/defaults/ directory.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Loaded defaults organized by data system</p>



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_getDefaults"></a>

### getDefaults(dataSystemName) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets defaults for a specific data system.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system (config, device, etc.)</p> |


**Returns**:

- <code>Object</code> <p>Defaults for the data system</p>



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_getAllDefaults"></a>

### getAllDefaults() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets all defaults organized by data system.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>All defaults</p>



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_reloadDefaults"></a>

### reloadDefaults() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Reloads defaults from files (clears cache).</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Reloaded defaults</p>



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_createDefaultsAPI"></a>

### createDefaultsAPI(dataSystemName, getCurrentValues, setValues) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a defaults API object for a specific data system.</p></strong></p>
> 
**Kind**: static method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system</p> |
| getCurrentValues | <code>function</code> |  | <p>Function to get current values from the system</p> |
| setValues | <code>function</code> |  | <p>Function to set values in the system</p> |


**Returns**:

- <code>Object</code> <p>Defaults API for the data system</p>



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_restore"></a>

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

<a id="api_adb_test_dot_utils_dot_defaults_dot_isDefault"></a>

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

<a id="api_adb_test_dot_utils_dot_defaults_dot_customized"></a>

### customized() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets all keys that have been customized (not at default).</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)

**Returns**:

- <code>Object</code> <p>Object with customized keys and their current vs default values</p>



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_resetAll"></a>

### resetAll(exclude) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Resets all values to defaults.</p></strong></p>
> 
**Kind**: inner method of [<code></code>](#undefined)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [exclude] | <code>Array.&lt;string&gt;</code> |  | <p>Keys to exclude from reset</p> |


**Returns**:

- <code>Object</code> <p>The reset values</p>






