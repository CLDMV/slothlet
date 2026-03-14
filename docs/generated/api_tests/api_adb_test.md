<a id="api_adb_test"></a>

## @cldmv/slothlet/api\_tests/api\_adb\_test
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_adb_test API surface documented for reference.</p>
> 


**Structure**

  * [.adb](#api_adb_test_adb)
    * [.initialize(host, port)](#api_adb_test_dot_adb_dot_initialize) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getClient()](#api_adb_test_dot_adb_dot_getClient) ⇒ <code>Object</code>
    * [.getDevice()](#api_adb_test_dot_adb_dot_getDevice) ⇒ <code>Object</code>
    * [.getDeviceId()](#api_adb_test_dot_adb_dot_getDeviceId) ⇒ <code>string</code>
    * [.shell(command)](#api_adb_test_dot_adb_dot_shell) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.connect()](#api_adb_test_dot_adb_dot_connect) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.disconnect()](#api_adb_test_dot_adb_dot_disconnect) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.input(inputCommand)](#api_adb_test_dot_adb_dot_input) ⇒ <code>Promise.&lt;string&gt;</code>
      * [.text(text)](#api_adb_test_dot_input_dot_text) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.key(key)](#api_adb_test_dot_input_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.tap(x, y)](#api_adb_test_dot_input_dot_tap) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.swipe(startX, startY, endX, endY, duration)](#api_adb_test_dot_input_dot_swipe) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getKeyboardKeys()](#api_adb_test_dot_input_dot_getKeyboardKeys) ⇒ <code>*</code>
      * [.getKeycodes()](#api_adb_test_dot_input_dot_getKeycodes) ⇒ <code>*</code>
    * [.screenshot()](#api_adb_test_dot_adb_dot_screenshot) ⇒ <code>Promise.&lt;Buffer&gt;</code>
    * [.listPackages()](#api_adb_test_dot_adb_dot_listPackages) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.getProperties()](#api_adb_test_dot_adb_dot_getProperties) ⇒ <code>Promise.&lt;Object&gt;</code>
  * [.app](#api_adb_test_app)
    * [.launch(packageName, options)](#api_adb_test_dot_app_dot_launch) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.stop(packageName)](#api_adb_test_dot_app_dot_stop) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getCurrentApp(options)](#api_adb_test_dot_app_dot_getCurrentApp) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.refresh()](#api_adb_test_dot_app_dot_refresh) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getInstalledPackages(options)](#api_adb_test_dot_app_dot_getInstalledPackages) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.startMonitoring(options)](#api_adb_test_dot_app_dot_startMonitoring) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.stopMonitoring()](#api_adb_test_dot_app_dot_stopMonitoring) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.clearData(packageName, options)](#api_adb_test_dot_app_dot_clearData) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.setEnabled(packageName, enabled)](#api_adb_test_dot_app_dot_setEnabled) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getPackageInfo(packageName)](#api_adb_test_dot_app_dot_getPackageInfo) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.uninstall(packageName, options)](#api_adb_test_dot_app_dot_uninstall) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getCurrentPackage()](#api_adb_test_dot_app_dot_getCurrentPackage) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.getCurrentActivity()](#api_adb_test_dot_app_dot_getCurrentActivity) ⇒ <code>Promise.&lt;string&gt;</code>
  * [.config](#api_adb_test_config)
    * [.get(key)](#api_adb_test_dot_config_dot_get) ⇒ <code>*</code>
    * [.set(key, value)](#api_adb_test_dot_config_dot_set) ⇒ <code>*</code>
    * [.merge(configObject, deep)](#api_adb_test_dot_config_dot_merge) ⇒ <code>*</code>
    * [.reset(keys)](#api_adb_test_dot_config_dot_reset) ⇒ <code>*</code>
    * [.validate(configToValidate)](#api_adb_test_dot_config_dot_validate) ⇒ <code>*</code>
    * [.snapshot()](#api_adb_test_dot_config_dot_snapshot) ⇒ <code>*</code>
  * [.connection](#api_adb_test_connection)
    * [.ensureConnected()](#api_adb_test_dot_connection_dot_ensureConnected) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.disconnect(isAutoDisconnect)](#api_adb_test_dot_connection_dot_disconnect) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.isConnected()](#api_adb_test_dot_connection_dot_isConnected) ⇒ <code>boolean</code>
    * [.isAwake()](#api_adb_test_dot_connection_dot_isAwake) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.ensureAwake()](#api_adb_test_dot_connection_dot_ensureAwake) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.startHeartbeat()](#api_adb_test_dot_connection_dot_startHeartbeat) ⇒ <code>void</code>
    * [.stopHeartbeat()](#api_adb_test_dot_connection_dot_stopHeartbeat) ⇒ <code>void</code>
    * [.clearTimeouts()](#api_adb_test_dot_connection_dot_clearTimeouts) ⇒ <code>void</code>
    * [.shell(command, options)](#api_adb_test_dot_connection_dot_shell) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.getInfo()](#api_adb_test_dot_connection_dot_getInfo) ⇒ <code>Object</code>
    * [.getEmitter()](#api_adb_test_dot_connection_dot_getEmitter) ⇒ <code>EventEmitter</code>
  * [.device](#api_adb_test_device)
    * [.get(key)](#api_adb_test_dot_device_dot_get) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.set(key, value)](#api_adb_test_dot_device_dot_set) ⇒ <code>void</code>
    * [.merge(dataObject, deep)](#api_adb_test_dot_device_dot_merge) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.refresh(keys, force)](#api_adb_test_dot_device_dot_refresh) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.clear(keys)](#api_adb_test_dot_device_dot_clear) ⇒ <code>void</code>
    * [.withDisplay()](#api_adb_test_dot_device_dot_withDisplay) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.basic()](#api_adb_test_dot_device_dot_basic) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.snapshot(options)](#api_adb_test_dot_device_dot_snapshot) ⇒ <code>Promise.&lt;Object&gt;</code>
  * [.display](#api_adb_test_display)
    * [.capture(options)](#api_adb_test_dot_display_dot_capture) ⇒ <code>Promise.&lt;Buffer&gt;</code>
    * [.getInfo()](#api_adb_test_dot_display_dot_getInfo) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getResolution()](#api_adb_test_dot_display_dot_getResolution) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.analyzeScreenshot(options)](#api_adb_test_dot_display_dot_analyzeScreenshot) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.saveScreenshot(filepath, options)](#api_adb_test_dot_display_dot_saveScreenshot) ⇒ <code>Promise.&lt;void&gt;</code>
  * [.helpers](#api_adb_test_helpers)
    * [.fetchDeviceProperties(properties)](#api_adb_test_dot_helpers_dot_fetchDeviceProperties) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.fetchCurrentAppInfo()](#api_adb_test_dot_helpers_dot_fetchCurrentAppInfo) ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
    * [.fetchInstalledPackages(systemApps, thirdPartyOnly)](#api_adb_test_dot_helpers_dot_fetchInstalledPackages) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.fetchNetworkDetails()](#api_adb_test_dot_helpers_dot_fetchNetworkDetails) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.fetchAudioInfo()](#api_adb_test_dot_helpers_dot_fetchAudioInfo) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.resolveDefaultActivity(packageName)](#api_adb_test_dot_helpers_dot_resolveDefaultActivity) ⇒ <code>Promise.&lt;(string|null)&gt;</code>
    * [.refreshCurrentAppInfo(reason, options)](#api_adb_test_dot_helpers_dot_refreshCurrentAppInfo) ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
    * [.collectStartupMetadata(reason)](#api_adb_test_dot_helpers_dot_collectStartupMetadata) ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
    * [.scheduleAppInfoRefresh(context, options)](#api_adb_test_dot_helpers_dot_scheduleAppInfoRefresh) ⇒ <code>void</code>
  * [.input](#api_adb_test_input)
    * [.text(text)](#api_adb_test_dot_input_dot_text) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.key(key)](#api_adb_test_dot_input_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.tap(x, y)](#api_adb_test_dot_input_dot_tap) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.swipe(startX, startY, endX, endY, duration)](#api_adb_test_dot_input_dot_swipe) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getKeyboardKeys()](#api_adb_test_dot_input_dot_getKeyboardKeys) ⇒ <code>*</code>
    * [.getKeycodes()](#api_adb_test_dot_input_dot_getKeycodes) ⇒ <code>*</code>
  * [.inputHelpers](#api_adb_test_inputHelpers)
    * [.sendKeycode(keycode)](#api_adb_test_dot_inputHelpers_dot_sendKeycode) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.sendText(text)](#api_adb_test_dot_inputHelpers_dot_sendText) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.sendTap(x, y)](#api_adb_test_dot_inputHelpers_dot_sendTap) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.sendSwipe(x1, y1, x2, y2, duration)](#api_adb_test_dot_inputHelpers_dot_sendSwipe) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.sendLongPress(keycode)](#api_adb_test_dot_inputHelpers_dot_sendLongPress) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.metadata](#api_adb_test_metadata)
    * [.get(key)](#api_adb_test_dot_metadata_dot_get) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.set(key, value)](#api_adb_test_dot_metadata_dot_set) ⇒ <code>*</code>
    * [.merge(metaObject, deep)](#api_adb_test_dot_metadata_dot_merge) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.refresh(reason, force)](#api_adb_test_dot_metadata_dot_refresh) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.collect(reason)](#api_adb_test_dot_metadata_dot_collect) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.clear(keys)](#api_adb_test_dot_metadata_dot_clear) ⇒ <code>*</code>
    * [.age()](#api_adb_test_dot_metadata_dot_age) ⇒ <code>*</code>
    * [.startup()](#api_adb_test_dot_metadata_dot_startup) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.deviceMeta()](#api_adb_test_dot_metadata_dot_deviceMeta) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.networkMeta()](#api_adb_test_dot_metadata_dot_networkMeta) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.packages()](#api_adb_test_dot_metadata_dot_packages) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.snapshot(includeAge)](#api_adb_test_dot_metadata_dot_snapshot) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.power](#api_adb_test_power)
    * [.sleep()](#api_adb_test_dot_power_dot_sleep) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.press](#api_adb_test_press)
    * [.key(keyName)](#api_adb_test_dot_press_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.power()](#api_adb_test_dot_press_dot_power) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.sleep()](#api_adb_test_dot_power_dot_sleep) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.home()](#api_adb_test_dot_press_dot_home) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.back()](#api_adb_test_dot_press_dot_back) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.navigate(direction)](#api_adb_test_dot_press_dot_navigate) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.select()](#api_adb_test_dot_press_dot_select) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getRemoteKeys()](#api_adb_test_dot_press_dot_getRemoteKeys) ⇒ <code>*</code>
    * [.getKeycodes()](#api_adb_test_dot_press_dot_getKeycodes) ⇒ <code>*</code>
  * [.state](#api_adb_test_state)
    * [.getConfig()](#api_adb_test_dot_state_dot_getConfig) ⇒ <code>*</code>
    * [.getConnectionState()](#api_adb_test_dot_state_dot_getConnectionState) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getDefaults()](#api_adb_test_dot_state_dot_getDefaults) ⇒ <code>*</code>
    * [.getMetadata()](#api_adb_test_dot_state_dot_getMetadata) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getDevice()](#api_adb_test_dot_state_dot_getDevice) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getDeviceWithDisplay()](#api_adb_test_dot_state_dot_getDeviceWithDisplay) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getCurrentApp()](#api_adb_test_dot_state_dot_getCurrentApp) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getPowerState()](#api_adb_test_dot_state_dot_getPowerState) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getAudioState()](#api_adb_test_dot_state_dot_getAudioState) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getNetworkInfo()](#api_adb_test_dot_state_dot_getNetworkInfo) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getInstalledPackages(options)](#api_adb_test_dot_state_dot_getInstalledPackages) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.refreshDeviceInfo(options)](#api_adb_test_dot_state_dot_refreshDeviceInfo) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.refreshAppInfo()](#api_adb_test_dot_state_dot_refreshAppInfo) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.refreshNetworkInfo()](#api_adb_test_dot_state_dot_refreshNetworkInfo) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.refreshAudioInfo()](#api_adb_test_dot_state_dot_refreshAudioInfo) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.refreshAll()](#api_adb_test_dot_state_dot_refreshAll) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.createSnapshot(options)](#api_adb_test_dot_state_dot_createSnapshot) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.utils](#api_adb_test_utils)
    * [.defaults](#api_adb_test_dot_utils_defaults)
      * [.loadDefaultsFromFiles()](#api_adb_test_dot_utils_dot_defaults_dot_loadDefaultsFromFiles) ⇒ <code>Object</code>
      * [.getDefaults(dataSystemName)](#api_adb_test_dot_utils_dot_defaults_dot_getDefaults) ⇒ <code>Object</code>
      * [.getAllDefaults()](#api_adb_test_dot_utils_dot_defaults_dot_getAllDefaults) ⇒ <code>Object</code>
      * [.reloadDefaults()](#api_adb_test_dot_utils_dot_defaults_dot_reloadDefaults) ⇒ <code>Object</code>
      * [.createDefaultsAPI(dataSystemName, getCurrentValues, setValues)](#api_adb_test_dot_utils_dot_defaults_dot_createDefaultsAPI) ⇒ <code>Object</code>
      * [.restore(keys)](#api_adb_test_dot_utils_dot_defaults_dot_restore) ⇒ <code>Object</code>
      * [.isDefault(key)](#api_adb_test_dot_utils_dot_defaults_dot_isDefault) ⇒ <code>boolean</code>
      * [.customized()](#api_adb_test_dot_utils_dot_defaults_dot_customized) ⇒ <code>Object</code>
      * [.resetAll(exclude)](#api_adb_test_dot_utils_dot_defaults_dot_resetAll) ⇒ <code>Object</code>


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

<a id="api_adb_test_adb"></a>

### api_adb_test.adb
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_adb_dot_initialize"></a>

### initialize(host, port) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Initializes ADB client and device connection.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| host | <code>string</code> |  | <p>Device host/IP</p> |
| [port] | <code>number</code> | <code>5555</code> | <p>ADB port</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.initialize('192.168.1.1');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.initialize('192.168.1.1');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.initialize('192.168.1.1');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.initialize('192.168.1.1');
```



* * *

<a id="api_adb_test_dot_adb_dot_getClient"></a>

### getClient() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current ADB client instance.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Object</code> <p>ADB client</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.adb.getClient();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.adb.getClient();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.adb.getClient();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.adb.getClient();
```



* * *

<a id="api_adb_test_dot_adb_dot_getDevice"></a>

### getDevice() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current device instance.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Object</code> <p>ADB device</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.adb.getDevice();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.adb.getDevice();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.adb.getDevice();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.adb.getDevice();
```



* * *

<a id="api_adb_test_dot_adb_dot_getDeviceId"></a>

### getDeviceId() ⇒ <code>string</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current device ID.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>string</code> <p>Device ID</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.adb.getDeviceId();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.adb.getDeviceId();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.adb.getDeviceId();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.adb.getDeviceId();
```



* * *

<a id="api_adb_test_dot_adb_dot_shell"></a>

### shell(command) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Executes an ADB shell command.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>string</code> |  | <p>Shell command to execute</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Command output</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.shell('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.shell('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.shell('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.shell('value');
```



* * *

<a id="api_adb_test_dot_adb_dot_connect"></a>

### connect() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Connects to the device.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.connect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.connect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.connect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.connect();
```



* * *

<a id="api_adb_test_dot_adb_dot_disconnect"></a>

### disconnect() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Disconnects from the device.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.disconnect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.disconnect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.disconnect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.disconnect();
```



* * *

<a id="api_adb_test_dot_adb_dot_input"></a>

### input(inputCommand) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Executes an input command.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| inputCommand | <code>string</code> |  | <p>Input command (keyevent, text, tap, etc.)</p> |


**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Command output</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.input('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.input('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.input('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.input('value');
```



* * *

<a id="api_adb_test_dot_input_dot_text"></a>

### text(text) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>text.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>*</code> |  | <p>text.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.text('hello');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.text('hello');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.text('hello');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.text('hello');
```



* * *

<a id="api_adb_test_dot_input_dot_key"></a>

### key(key) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>*</code> |  | <p>key.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.key('myKey');
```



* * *

<a id="api_adb_test_dot_input_dot_tap"></a>

### tap(x, y) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>tap.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x | <code>*</code> |  | <p>x.</p> |
| y | <code>*</code> |  | <p>y.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.tap(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.tap(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.tap(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.tap(null, null);
```



* * *

<a id="api_adb_test_dot_input_dot_swipe"></a>

### swipe(startX, startY, endX, endY, duration) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>swipe.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| startX | <code>*</code> |  | <p>startX.</p> |
| startY | <code>*</code> |  | <p>startY.</p> |
| endX | <code>*</code> |  | <p>endX.</p> |
| endY | <code>*</code> |  | <p>endY.</p> |
| [duration] | <code>*</code> |  | <p>duration.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.swipe(null, null, null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.swipe(null, null, null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.swipe(null, null, null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.swipe(null, null, null, null);
```



* * *

<a id="api_adb_test_dot_input_dot_getKeyboardKeys"></a>

### getKeyboardKeys() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyboardKeys.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeyboardKeys();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeyboardKeys();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeyboardKeys();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeyboardKeys();
```



* * *

<a id="api_adb_test_dot_input_dot_getKeycodes"></a>

### getKeycodes() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeycodes.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeycodes();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeycodes();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeycodes();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeycodes();
```



* * *

<a id="api_adb_test_dot_adb_dot_screenshot"></a>

### screenshot() ⇒ <code>Promise.&lt;Buffer&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Takes a screenshot and returns the buffer.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Buffer&gt;</code> <p>Screenshot buffer</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.screenshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.screenshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.screenshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.screenshot();
```



* * *

<a id="api_adb_test_dot_adb_dot_listPackages"></a>

### listPackages() ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Lists installed packages.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> <p>Array of package names</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.listPackages();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.listPackages();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.listPackages();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.listPackages();
```



* * *

<a id="api_adb_test_dot_adb_dot_getProperties"></a>

### getProperties() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device properties.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device properties</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.getProperties();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.getProperties();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.adb.getProperties();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.adb.getProperties();
```



* * *

<a id="api_adb_test_app"></a>

### api_adb_test.app
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_app_dot_launch"></a>

### launch(packageName, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Launches an application by package name.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.launch('com.example.app');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.launch('com.example.app');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.launch('com.example.app');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.launch('com.example.app');
```



* * *

<a id="api_adb_test_dot_app_dot_stop"></a>

### stop(packageName) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Stops an application by package name.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>The package name of the app to stop</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.stop('com.example.app');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.stop('com.example.app');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.stop('com.example.app');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.stop('com.example.app');
```



* * *

<a id="api_adb_test_dot_app_dot_getCurrentApp"></a>

### getCurrentApp(options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the currently running app.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Options</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Current app info</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getCurrentApp();
```



* * *

<a id="api_adb_test_dot_app_dot_refresh"></a>

### refresh() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes the app state.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.refresh();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.refresh();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.refresh();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.refresh();
```



* * *

<a id="api_adb_test_dot_app_dot_getInstalledPackages"></a>

### getInstalledPackages(options) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets installed packages.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Options</p> |


**Returns**:

- <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> <p>List of package names</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getInstalledPackages();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getInstalledPackages();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getInstalledPackages();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getInstalledPackages();
```



* * *

<a id="api_adb_test_dot_app_dot_startMonitoring"></a>

### startMonitoring(options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Starts monitoring app changes.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Monitor options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.startMonitoring();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.startMonitoring();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.startMonitoring();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.startMonitoring();
```



* * *

<a id="api_adb_test_dot_app_dot_stopMonitoring"></a>

### stopMonitoring() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Stops monitoring app changes.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.stopMonitoring();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.stopMonitoring();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.stopMonitoring();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.stopMonitoring();
```



* * *

<a id="api_adb_test_dot_app_dot_clearData"></a>

### clearData(packageName, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Clears app data.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name to clear</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Clear options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.clearData('com.example.app');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.clearData('com.example.app');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.clearData('com.example.app');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.clearData('com.example.app');
```



* * *

<a id="api_adb_test_dot_app_dot_setEnabled"></a>

### setEnabled(packageName, enabled) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Enables or disables an app.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name</p> |
| enabled | <code>boolean</code> |  | <p>Whether to enable the app</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.setEnabled('com.example.app', true);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.setEnabled('com.example.app', true);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.setEnabled('com.example.app', true);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.setEnabled('com.example.app', true);
```



* * *

<a id="api_adb_test_dot_app_dot_getPackageInfo"></a>

### getPackageInfo(packageName) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets package information.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name to get info for</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Package info</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getPackageInfo('com.example.app');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getPackageInfo('com.example.app');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getPackageInfo('com.example.app');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getPackageInfo('com.example.app');
```



* * *

<a id="api_adb_test_dot_app_dot_uninstall"></a>

### uninstall(packageName, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Uninstalls an app.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>Package name to uninstall</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Uninstall options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.uninstall('com.example.app');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.uninstall('com.example.app');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.uninstall('com.example.app');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.uninstall('com.example.app');
```



* * *

<a id="api_adb_test_dot_app_dot_getCurrentPackage"></a>

### getCurrentPackage() ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current package name.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Current package name</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getCurrentPackage();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getCurrentPackage();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getCurrentPackage();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getCurrentPackage();
```



* * *

<a id="api_adb_test_dot_app_dot_getCurrentActivity"></a>

### getCurrentActivity() ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current activity name.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;string&gt;</code> <p>Current activity name</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getCurrentActivity();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getCurrentActivity();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.app.getCurrentActivity();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.app.getCurrentActivity();
```



* * *

<a id="api_adb_test_config"></a>

### api_adb_test.config
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_config_dot_get"></a>

### get(key) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>get.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>*</code> |  | <p>key.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.get('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.get('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.get('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.get('myKey');
```



* * *

<a id="api_adb_test_dot_config_dot_set"></a>

### set(key, value) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>set.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>*</code> |  | <p>key.</p> |
| value | <code>*</code> |  | <p>value.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.set('myKey', null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.set('myKey', null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.set('myKey', null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.set('myKey', null);
```



* * *

<a id="api_adb_test_dot_config_dot_merge"></a>

### merge(configObject, deep) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>merge.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| configObject | <code>*</code> |  | <p>configObject.</p> |
| [deep] | <code>*</code> |  | <p>deep.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.merge(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.merge(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.merge(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.merge(null);
```



* * *

<a id="api_adb_test_dot_config_dot_reset"></a>

### reset(keys) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>reset.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keys | <code>*</code> |  | <p>keys.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.reset('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.reset('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.reset('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.reset('myKey');
```



* * *

<a id="api_adb_test_dot_config_dot_validate"></a>

### validate(configToValidate) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>validate.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| configToValidate | <code>*</code> |  | <p>configToValidate.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.validate('item1');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.validate('item1');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.validate('item1');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.validate('item1');
```



* * *

<a id="api_adb_test_dot_config_dot_snapshot"></a>

### snapshot() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>snapshot.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.snapshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.snapshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.config.snapshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.config.snapshot();
```



* * *

<a id="api_adb_test_connection"></a>

### api_adb_test.connection
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_connection_dot_ensureConnected"></a>

### ensureConnected() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Ensures the device is connected, attempting to connect if not.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await remote.connection.ensureConnected();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.ensureConnected();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.ensureConnected();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.ensureConnected();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.ensureConnected();
```



* * *

<a id="api_adb_test_dot_connection_dot_disconnect"></a>

### disconnect(isAutoDisconnect) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Disconnects from the device.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [isAutoDisconnect] | <code>boolean</code> | <code>false</code> | <p>Whether this is an automatic disconnection.</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
await remote.connection.disconnect();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.disconnect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.disconnect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.disconnect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.disconnect();
```



* * *

<a id="api_adb_test_dot_connection_dot_isConnected"></a>

### isConnected() ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the current connection status.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>boolean</code> <p>True if connected, false otherwise.</p>


**Example**
```js
if (remote.connection.isConnected()) {
  // Device is connected
}
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.isConnected();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.isConnected();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.isConnected();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.isConnected();
```



* * *

<a id="api_adb_test_dot_connection_dot_isAwake"></a>

### isAwake() ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Checks if the device is awake and responsive.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>True if device is awake, false otherwise.</p>


**Example**
```js
const awake = await remote.connection.isAwake();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.isAwake();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.isAwake();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.isAwake();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.isAwake();
```



* * *

<a id="api_adb_test_dot_connection_dot_ensureAwake"></a>

### ensureAwake() ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Ensures the device is awake, waking it if necessary.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>True if device is awake, false otherwise.</p>


**Example**
```js
await remote.connection.ensureAwake();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.ensureAwake();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.ensureAwake();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.ensureAwake();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.ensureAwake();
```



* * *

<a id="api_adb_test_dot_connection_dot_startHeartbeat"></a>

### startHeartbeat() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Starts the heartbeat mechanism to maintain connection.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
remote.connection.startHeartbeat();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.startHeartbeat();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.startHeartbeat();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.startHeartbeat();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.startHeartbeat();
```



* * *

<a id="api_adb_test_dot_connection_dot_stopHeartbeat"></a>

### stopHeartbeat() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Stops the heartbeat mechanism.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
remote.connection.stopHeartbeat();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.stopHeartbeat();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.stopHeartbeat();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.stopHeartbeat();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.stopHeartbeat();
```



* * *

<a id="api_adb_test_dot_connection_dot_clearTimeouts"></a>

### clearTimeouts() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Clears all active timers.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
remote.connection.clearTimeouts();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.clearTimeouts();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.clearTimeouts();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.clearTimeouts();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.clearTimeouts();
```



* * *

<a id="api_adb_test_dot_connection_dot_shell"></a>

### shell(command, options) ⇒ <code>Promise.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Executes a shell command on the device.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.shell('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.shell('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.connection.shell('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.connection.shell('value');
```



* * *

<a id="api_adb_test_dot_connection_dot_getInfo"></a>

### getInfo() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets connection information and statistics.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Object</code> <p>Connection information</p>


**Example**
```js
const info = remote.connection.getInfo();
console.log('Connection info:', info);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.getInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.getInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.getInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.getInfo();
```



* * *

<a id="api_adb_test_dot_connection_dot_getEmitter"></a>

### getEmitter() ⇒ <code>EventEmitter</code>
> <p><strong style="font-size: 1.1em;"><p>Gets the connection event emitter for subscribing to connection events.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>EventEmitter</code> <p>The connection event emitter</p>


**Example**
```js
const emitter = remote.connection.getEmitter();
emitter.on('connected', (event) => {
  console.log('Connected to', event.host);
});
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.getEmitter();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.getEmitter();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.connection.getEmitter();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.connection.getEmitter();
```



* * *

<a id="api_adb_test_device"></a>

### api_adb_test.device
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_device_dot_get"></a>

### get(key) ⇒ <code>Promise.&lt;any&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device data.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.get();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.get();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.get();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.get();
```



* * *

<a id="api_adb_test_dot_device_dot_set"></a>

### set(key, value) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Sets device data (primarily for caching).</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string \| Object</code> |  | <p>Device data key or object of key-value pairs</p> |
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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.device.set(value);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.device.set(value);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.device.set(value);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.device.set(value);
```



* * *

<a id="api_adb_test_dot_device_dot_merge"></a>

### merge(dataObject, deep) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Merges device data with existing data.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.merge({});
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.merge({});
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.merge({});
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.merge({});
```



* * *

<a id="api_adb_test_dot_device_dot_refresh"></a>

### refresh(keys, force) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes device data from the device.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [keys] | <code>string \| Array.&lt;string&gt;</code> |  | <p>Specific keys to refresh, or undefined to refresh all</p> |
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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.refresh();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.refresh();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.refresh();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.refresh();
```



* * *

<a id="api_adb_test_dot_device_dot_clear"></a>

### clear(keys) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Clears cached device data.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [keys] | <code>string \| Array.&lt;string&gt;</code> |  | <p>Specific keys to clear, or undefined to clear all</p> |


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.device.clear();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.device.clear();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.device.clear();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.device.clear();
```



* * *

<a id="api_adb_test_dot_device_dot_withDisplay"></a>

### withDisplay() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device data with display information included.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Complete device data including display</p>


**Example**
```js
const deviceWithDisplay = await api.device.withDisplay();
console.log('Display info:', deviceWithDisplay.display);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.withDisplay();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.withDisplay();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.withDisplay();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.withDisplay();
```



* * *

<a id="api_adb_test_dot_device_dot_basic"></a>

### basic() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets basic device data without display information.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Basic device data</p>


**Example**
```js
const basicDevice = await api.device.basic();
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.basic();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.basic();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.basic();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.basic();
```



* * *

<a id="api_adb_test_dot_device_dot_snapshot"></a>

### snapshot(options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets a snapshot of the current device state.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.snapshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.snapshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.device.snapshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.device.snapshot();
```



* * *

<a id="api_adb_test_display"></a>

### api_adb_test.display
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_display_dot_capture"></a>

### capture(options) ⇒ <code>Promise.&lt;Buffer&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Captures a screenshot from the Android TV device.</p></strong></p>
> 
**Kind**: static method


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


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.capture();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.capture();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.capture();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.capture();
```



* * *

<a id="api_adb_test_dot_display_dot_getInfo"></a>

### getInfo() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets display information.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Display info</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.getInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.getInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.getInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.getInfo();
```



* * *

<a id="api_adb_test_dot_display_dot_getResolution"></a>

### getResolution() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets screen resolution.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Resolution info</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.getResolution();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.getResolution();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.getResolution();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.getResolution();
```



* * *

<a id="api_adb_test_dot_display_dot_analyzeScreenshot"></a>

### analyzeScreenshot(options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Analyzes screenshot for brightness/darkness.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | <p>Analysis options</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Analysis results</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.analyzeScreenshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.analyzeScreenshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.analyzeScreenshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.analyzeScreenshot();
```



* * *

<a id="api_adb_test_dot_display_dot_saveScreenshot"></a>

### saveScreenshot(filepath, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Saves screenshot to file.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filepath | <code>string</code> |  | <p>Path to save screenshot</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Save options</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.saveScreenshot('./file.mjs');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.saveScreenshot('./file.mjs');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.display.saveScreenshot('./file.mjs');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.display.saveScreenshot('./file.mjs');
```



* * *

<a id="api_adb_test_helpers"></a>

### api_adb_test.helpers
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_helpers_dot_fetchDeviceProperties"></a>

### fetchDeviceProperties(properties) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches device properties from the Android system.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [properties] | <code>Array.&lt;string&gt; \| null</code> | <code>null</code> | <p>Specific properties to fetch, or null for all</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device properties object</p>


**Example**
```js
// Get all properties
const allProps = await api.helpers.fetchDeviceProperties();

// Get specific properties
const specificProps = await api.helpers.fetchDeviceProperties(['ro.product.model', 'ro.build.version.release']);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchDeviceProperties();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchDeviceProperties();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchDeviceProperties();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchDeviceProperties();
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchCurrentAppInfo"></a>

### fetchCurrentAppInfo() ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches information about the currently running application.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;(Object\|null)&gt;</code> <p>Current app information or null</p>


**Example**
```js
const currentApp = await api.helpers.fetchCurrentAppInfo();
if (currentApp) {
  console.log('Current app:', currentApp.packageName);
}
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchCurrentAppInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchCurrentAppInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchCurrentAppInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchCurrentAppInfo();
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchInstalledPackages"></a>

### fetchInstalledPackages(systemApps, thirdPartyOnly) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches the list of installed packages.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchInstalledPackages();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchInstalledPackages();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchInstalledPackages();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchInstalledPackages();
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchNetworkDetails"></a>

### fetchNetworkDetails() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches network connection details.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Network information object</p>


**Example**
```js
const network = await api.helpers.fetchNetworkDetails();
console.log('WiFi connected:', network.wifi.connected);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchNetworkDetails();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchNetworkDetails();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchNetworkDetails();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchNetworkDetails();
```



* * *

<a id="api_adb_test_dot_helpers_dot_fetchAudioInfo"></a>

### fetchAudioInfo() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Fetches audio system information.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Audio information object</p>


**Example**
```js
const audio = await api.helpers.fetchAudioInfo();
console.log('Audio info:', audio);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchAudioInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchAudioInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.fetchAudioInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.fetchAudioInfo();
```



* * *

<a id="api_adb_test_dot_helpers_dot_resolveDefaultActivity"></a>

### resolveDefaultActivity(packageName) ⇒ <code>Promise.&lt;(string|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Resolves the default activity for a given package.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| packageName | <code>string</code> |  | <p>The package name to resolve</p> |


**Returns**:

- <code>Promise.&lt;(string\|null)&gt;</code> <p>Default activity name or null</p>


**Example**
```js
const activity = await api.helpers.resolveDefaultActivity('com.netflix.ninja');
console.log('Default activity:', activity);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.resolveDefaultActivity('com.example.app');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.resolveDefaultActivity('com.example.app');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.resolveDefaultActivity('com.example.app');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.resolveDefaultActivity('com.example.app');
```



* * *

<a id="api_adb_test_dot_helpers_dot_refreshCurrentAppInfo"></a>

### refreshCurrentAppInfo(reason, options) ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Refreshes current app information and emits change events if needed.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>string</code> | <code>"manual"</code> | <p>Reason for refresh</p> |
| [options] | <code>Object</code> | <code>{}</code> | <p>Refresh options</p> |
| [options.forceEmit] | <code>boolean</code> | <code>false</code> | <p>Force emit event even if app hasn't changed</p> |


**Returns**:

- <code>Promise.&lt;(Object\|null)&gt;</code> <p>Updated app information</p>


**Example**
```js
const appInfo = await api.helpers.refreshCurrentAppInfo();

// Force emit event
await api.helpers.refreshCurrentAppInfo("user_action", { forceEmit: true });
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.refreshCurrentAppInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.refreshCurrentAppInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.refreshCurrentAppInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.refreshCurrentAppInfo();
```



* * *

<a id="api_adb_test_dot_helpers_dot_collectStartupMetadata"></a>

### collectStartupMetadata(reason) ⇒ <code>Promise.&lt;(Object|null)&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Collects comprehensive startup metadata from the device.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>string</code> | <code>"init"</code> | <p>Reason for collection</p> |


**Returns**:

- <code>Promise.&lt;(Object\|null)&gt;</code> <p>Collected metadata or null on error</p>


**Example**
```js
const metadata = await api.helpers.collectStartupMetadata();
console.log('Device metadata:', metadata);
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.collectStartupMetadata();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.collectStartupMetadata();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.helpers.collectStartupMetadata();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.helpers.collectStartupMetadata();
```



* * *

<a id="api_adb_test_dot_helpers_dot_scheduleAppInfoRefresh"></a>

### scheduleAppInfoRefresh(context, options) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Schedules an app info refresh with a delay.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.helpers.scheduleAppInfoRefresh('hello');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.helpers.scheduleAppInfoRefresh('hello');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.helpers.scheduleAppInfoRefresh('hello');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.helpers.scheduleAppInfoRefresh('hello');
```



* * *

<a id="api_adb_test_input"></a>

### api_adb_test.input
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_input_dot_text"></a>

### text(text) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>text.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>*</code> |  | <p>text.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.text('hello');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.text('hello');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.text('hello');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.text('hello');
```



* * *

<a id="api_adb_test_dot_input_dot_key"></a>

### key(key) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>*</code> |  | <p>key.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.key('myKey');
```



* * *

<a id="api_adb_test_dot_input_dot_tap"></a>

### tap(x, y) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>tap.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x | <code>*</code> |  | <p>x.</p> |
| y | <code>*</code> |  | <p>y.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.tap(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.tap(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.tap(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.tap(null, null);
```



* * *

<a id="api_adb_test_dot_input_dot_swipe"></a>

### swipe(startX, startY, endX, endY, duration) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>swipe.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| startX | <code>*</code> |  | <p>startX.</p> |
| startY | <code>*</code> |  | <p>startY.</p> |
| endX | <code>*</code> |  | <p>endX.</p> |
| endY | <code>*</code> |  | <p>endY.</p> |
| [duration] | <code>*</code> |  | <p>duration.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.swipe(null, null, null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.swipe(null, null, null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.input.swipe(null, null, null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.input.swipe(null, null, null, null);
```



* * *

<a id="api_adb_test_dot_input_dot_getKeyboardKeys"></a>

### getKeyboardKeys() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyboardKeys.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeyboardKeys();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeyboardKeys();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeyboardKeys();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeyboardKeys();
```



* * *

<a id="api_adb_test_dot_input_dot_getKeycodes"></a>

### getKeycodes() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeycodes.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeycodes();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeycodes();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.input.getKeycodes();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.input.getKeycodes();
```



* * *

<a id="api_adb_test_inputHelpers"></a>

### api_adb_test.inputHelpers
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendKeycode"></a>

### sendKeycode(keycode) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendKeycode.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keycode | <code>*</code> |  | <p>keycode.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendKeycode('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendKeycode('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendKeycode('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendKeycode('myKey');
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendText"></a>

### sendText(text) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendText.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>*</code> |  | <p>text.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendText('hello');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendText('hello');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendText('hello');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendText('hello');
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendTap"></a>

### sendTap(x, y) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendTap.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x | <code>*</code> |  | <p>x.</p> |
| y | <code>*</code> |  | <p>y.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendTap(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendTap(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendTap(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendTap(null, null);
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendSwipe"></a>

### sendSwipe(x1, y1, x2, y2, duration) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendSwipe.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| x1 | <code>*</code> |  | <p>x1.</p> |
| y1 | <code>*</code> |  | <p>y1.</p> |
| x2 | <code>*</code> |  | <p>x2.</p> |
| y2 | <code>*</code> |  | <p>y2.</p> |
| [duration] | <code>*</code> |  | <p>duration.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendSwipe(null, null, null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendSwipe(null, null, null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendSwipe(null, null, null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendSwipe(null, null, null, null);
```



* * *

<a id="api_adb_test_dot_inputHelpers_dot_sendLongPress"></a>

### sendLongPress(keycode) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendLongPress.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keycode | <code>*</code> |  | <p>keycode.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendLongPress('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendLongPress('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.inputHelpers.sendLongPress('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.inputHelpers.sendLongPress('myKey');
```



* * *

<a id="api_adb_test_metadata"></a>

### api_adb_test.metadata
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_metadata_dot_get"></a>

### get(key) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>get.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>*</code> |  | <p>key.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.get('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.get('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.get('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.get('myKey');
```



* * *

<a id="api_adb_test_dot_metadata_dot_set"></a>

### set(key, value) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>set.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>*</code> |  | <p>key.</p> |
| value | <code>*</code> |  | <p>value.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.metadata.set('myKey', null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.metadata.set('myKey', null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.metadata.set('myKey', null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.metadata.set('myKey', null);
```



* * *

<a id="api_adb_test_dot_metadata_dot_merge"></a>

### merge(metaObject, deep) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>merge.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| metaObject | <code>*</code> |  | <p>metaObject.</p> |
| [deep] | <code>*</code> |  | <p>deep.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.merge(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.merge(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.merge(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.merge(null);
```



* * *

<a id="api_adb_test_dot_metadata_dot_refresh"></a>

### refresh(reason, force) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>refresh.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>*</code> |  | <p>reason.</p> |
| [force] | <code>*</code> |  | <p>force.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.refresh();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.refresh();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.refresh();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.refresh();
```



* * *

<a id="api_adb_test_dot_metadata_dot_collect"></a>

### collect(reason) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>collect.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [reason] | <code>*</code> |  | <p>reason.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.collect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.collect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.collect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.collect();
```



* * *

<a id="api_adb_test_dot_metadata_dot_clear"></a>

### clear(keys) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>clear.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keys | <code>*</code> |  | <p>keys.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.metadata.clear('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.metadata.clear('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.metadata.clear('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.metadata.clear('myKey');
```



* * *

<a id="api_adb_test_dot_metadata_dot_age"></a>

### age() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>age.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.metadata.age();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.metadata.age();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.metadata.age();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.metadata.age();
```



* * *

<a id="api_adb_test_dot_metadata_dot_startup"></a>

### startup() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>startup.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.startup();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.startup();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.startup();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.startup();
```



* * *

<a id="api_adb_test_dot_metadata_dot_deviceMeta"></a>

### deviceMeta() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>deviceMeta.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.deviceMeta();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.deviceMeta();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.deviceMeta();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.deviceMeta();
```



* * *

<a id="api_adb_test_dot_metadata_dot_networkMeta"></a>

### networkMeta() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>networkMeta.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.networkMeta();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.networkMeta();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.networkMeta();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.networkMeta();
```



* * *

<a id="api_adb_test_dot_metadata_dot_packages"></a>

### packages() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>packages.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.packages();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.packages();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.packages();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.packages();
```



* * *

<a id="api_adb_test_dot_metadata_dot_snapshot"></a>

### snapshot(includeAge) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>snapshot.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [includeAge] | <code>*</code> |  | <p>includeAge.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.snapshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.snapshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.metadata.snapshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.metadata.snapshot();
```



* * *

<a id="api_adb_test_power"></a>

### api_adb_test.power
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_power_dot_sleep"></a>

### sleep() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sleep.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.power.sleep();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.power.sleep();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.power.sleep();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.power.sleep();
```



* * *

<a id="api_adb_test_press"></a>

### api_adb_test.press
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_press_dot_key"></a>

### key(keyName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.key('myKey');
```



* * *

<a id="api_adb_test_dot_press_dot_power"></a>

### power() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>power.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.power();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.power();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.power();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.power();
```



* * *

<a id="api_adb_test_dot_power_dot_sleep"></a>

### sleep() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sleep.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.power.sleep();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.power.sleep();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.power.sleep();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.power.sleep();
```



* * *

<a id="api_adb_test_dot_press_dot_home"></a>

### home() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>home.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.home();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.home();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.home();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.home();
```



* * *

<a id="api_adb_test_dot_press_dot_back"></a>

### back() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>back.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.back();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.back();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.back();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.back();
```



* * *

<a id="api_adb_test_dot_press_dot_navigate"></a>

### navigate(direction) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>navigate.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| direction | <code>*</code> |  | <p>direction.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.navigate('./');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.navigate('./');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.navigate('./');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.navigate('./');
```



* * *

<a id="api_adb_test_dot_press_dot_select"></a>

### select() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>select.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.select();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.select();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.press.select();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.press.select();
```



* * *

<a id="api_adb_test_dot_press_dot_getRemoteKeys"></a>

### getRemoteKeys() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getRemoteKeys.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.press.getRemoteKeys();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.press.getRemoteKeys();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.press.getRemoteKeys();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.press.getRemoteKeys();
```



* * *

<a id="api_adb_test_dot_press_dot_getKeycodes"></a>

### getKeycodes() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeycodes.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.press.getKeycodes();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.press.getKeycodes();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.press.getKeycodes();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.press.getKeycodes();
```



* * *

<a id="api_adb_test_state"></a>

### api_adb_test.state
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_state_dot_getConfig"></a>

### getConfig() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getConfig.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.state.getConfig();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.state.getConfig();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.state.getConfig();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.state.getConfig();
```



* * *

<a id="api_adb_test_dot_state_dot_getConnectionState"></a>

### getConnectionState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getConnectionState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getConnectionState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getConnectionState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getConnectionState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getConnectionState();
```



* * *

<a id="api_adb_test_dot_state_dot_getDefaults"></a>

### getDefaults() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getDefaults.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.state.getDefaults();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.state.getDefaults();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.state.getDefaults();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.state.getDefaults();
```



* * *

<a id="api_adb_test_dot_state_dot_getMetadata"></a>

### getMetadata() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getMetadata.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getMetadata();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getMetadata();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getMetadata();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getMetadata();
```



* * *

<a id="api_adb_test_dot_state_dot_getDevice"></a>

### getDevice() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getDevice.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getDevice();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getDevice();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getDevice();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getDevice();
```



* * *

<a id="api_adb_test_dot_state_dot_getDeviceWithDisplay"></a>

### getDeviceWithDisplay() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getDeviceWithDisplay.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getDeviceWithDisplay();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getDeviceWithDisplay();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getDeviceWithDisplay();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getDeviceWithDisplay();
```



* * *

<a id="api_adb_test_dot_state_dot_getCurrentApp"></a>

### getCurrentApp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentApp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getCurrentApp();
```



* * *

<a id="api_adb_test_dot_state_dot_getPowerState"></a>

### getPowerState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getPowerState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getPowerState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getPowerState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getPowerState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getPowerState();
```



* * *

<a id="api_adb_test_dot_state_dot_getAudioState"></a>

### getAudioState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getAudioState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getAudioState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getAudioState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getAudioState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getAudioState();
```



* * *

<a id="api_adb_test_dot_state_dot_getNetworkInfo"></a>

### getNetworkInfo() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getNetworkInfo.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getNetworkInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getNetworkInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getNetworkInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getNetworkInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_getInstalledPackages"></a>

### getInstalledPackages(options) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getInstalledPackages.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>*</code> |  | <p>options.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getInstalledPackages();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getInstalledPackages();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.getInstalledPackages();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.getInstalledPackages();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshDeviceInfo"></a>

### refreshDeviceInfo(options) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>refreshDeviceInfo.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>*</code> |  | <p>options.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshDeviceInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshDeviceInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshDeviceInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshDeviceInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshAppInfo"></a>

### refreshAppInfo() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>refreshAppInfo.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshAppInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshAppInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshAppInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshAppInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshNetworkInfo"></a>

### refreshNetworkInfo() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>refreshNetworkInfo.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshNetworkInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshNetworkInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshNetworkInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshNetworkInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshAudioInfo"></a>

### refreshAudioInfo() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>refreshAudioInfo.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshAudioInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshAudioInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshAudioInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshAudioInfo();
```



* * *

<a id="api_adb_test_dot_state_dot_refreshAll"></a>

### refreshAll() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>refreshAll.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshAll();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshAll();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.refreshAll();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.refreshAll();
```



* * *

<a id="api_adb_test_dot_state_dot_createSnapshot"></a>

### createSnapshot(options) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>createSnapshot.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>*</code> |  | <p>options.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.createSnapshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.createSnapshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  await api_adb_test.state.createSnapshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
await api_adb_test.state.createSnapshot();
```



* * *

<a id="api_adb_test_utils"></a>

### api_adb_test.utils
> 
**Kind**: inner namespace of [<code>api_adb_test</code>](#api_adb_test)


* * *

<a id="api_adb_test_dot_utils_defaults"></a>

### defaults
> 
**Kind**: inner namespace


* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_loadDefaultsFromFiles"></a>

### loadDefaultsFromFiles() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Auto-scans and loads defaults from JSON files in data/defaults/ directory.</p></strong></p>
> 
**Kind**: inner method

**Returns**:

- <code>Object</code> <p>Loaded defaults organized by data system</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.loadDefaultsFromFiles();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.loadDefaultsFromFiles();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.loadDefaultsFromFiles();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.loadDefaultsFromFiles();
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_getDefaults"></a>

### getDefaults(dataSystemName) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets defaults for a specific data system.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system (config, device, etc.)</p> |


**Returns**:

- <code>Object</code> <p>Defaults for the data system</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.getDefaults('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.getDefaults('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.getDefaults('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.getDefaults('myName');
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_getAllDefaults"></a>

### getAllDefaults() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets all defaults organized by data system.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Object</code> <p>All defaults</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.getAllDefaults();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.getAllDefaults();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.getAllDefaults();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.getAllDefaults();
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_reloadDefaults"></a>

### reloadDefaults() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Reloads defaults from files (clears cache).</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Object</code> <p>Reloaded defaults</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.reloadDefaults();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.reloadDefaults();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.reloadDefaults();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.reloadDefaults();
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_createDefaultsAPI"></a>

### createDefaultsAPI(dataSystemName, getCurrentValues, setValues) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a defaults API object for a specific data system.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system</p> |
| getCurrentValues | <code>function</code> |  | <p>Function to get current values from the system</p> |
| setValues | <code>function</code> |  | <p>Function to set values in the system</p> |


**Returns**:

- <code>Object</code> <p>Defaults API for the data system</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_restore"></a>

### restore(keys) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Restores specific keys to their default values.</p></strong></p>
> 
**Kind**: inner method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keys | <code>string \| Array.&lt;string&gt;</code> |  | <p>Key(s) to restore</p> |


**Returns**:

- <code>Object</code> <p>The restored values</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.restore([]);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.restore([]);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.restore([]);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.restore([]);
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_isDefault"></a>

### isDefault(key) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Checks if a value is at its default.</p></strong></p>
> 
**Kind**: inner method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Key to check</p> |


**Returns**:

- <code>boolean</code> <p>True if at default value</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.isDefault('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.isDefault('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.isDefault('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.isDefault('myKey');
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_customized"></a>

### customized() ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Gets all keys that have been customized (not at default).</p></strong></p>
> 
**Kind**: inner method

**Returns**:

- <code>Object</code> <p>Object with customized keys and their current vs default values</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.customized();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.customized();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.customized();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.customized();
```



* * *

<a id="api_adb_test_dot_utils_dot_defaults_dot_resetAll"></a>

### resetAll(exclude) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Resets all values to defaults.</p></strong></p>
> 
**Kind**: inner method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [exclude] | <code>Array.&lt;string&gt;</code> |  | <p>Keys to exclude from reset</p> |


**Returns**:

- <code>Object</code> <p>The reset values</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.resetAll();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.resetAll();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
  api_adb_test.utils.defaults.resetAll();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
api_adb_test.utils.defaults.resetAll();
```






