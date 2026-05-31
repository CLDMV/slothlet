<a id="api_tv_test"></a>

## @cldmv/slothlet/api\_tests/api\_tv\_test
> <p>This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_tv_test API surface documented for reference.</p>
> 


**Structure**

  * [.app](#api_tv_test_app)
    * [.setApp(appName)](#api_tv_test_dot_app_dot_setApp) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getCurrentApp()](#api_tv_test_dot_app_dot_getCurrentApp) ⇒ <code>*</code>
    * [.getAllApps()](#api_tv_test_dot_app_dot_getAllApps) ⇒ <code>*</code>
    * [.retrieveCurrentApp()](#api_tv_test_dot_app_dot_retrieveCurrentApp) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.channel](#api_tv_test_channel)
    * [.setChannel(channel)](#api_tv_test_dot_channel_dot_setChannel) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.up()](#api_tv_test_dot_channel_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.down()](#api_tv_test_dot_channel_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getCurrentChannel()](#api_tv_test_dot_channel_dot_getCurrentChannel) ⇒ <code>*</code>
    * [.retrieveCurrentChannel()](#api_tv_test_dot_channel_dot_retrieveCurrentChannel) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.config](#api_tv_test_config)
    * [.get(key)](#api_tv_test_dot_config_dot_config_dot_get) ⇒ <code>*</code>
    * [.update(keyOrConfig, value)](#api_tv_test_dot_config_dot_config_dot_update) ⇒ <code>object</code>
    * [.set(key, value)](#api_tv_test_dot_config_dot_config_dot_set) ⇒ <code>object</code>
    * [.getDefaultPort()](#api_tv_test_dot_config_dot_config_dot_getDefaultPort) ⇒ <code>number</code>
    * [.validate(configToValidate, requiredKeys)](#api_tv_test_dot_config_dot_config_dot_validate) ⇒ <code>object</code>
    * [.merge(userConfig, _)](#api_tv_test_dot_config_dot_config_dot_merge) ⇒ <code>object</code>
    * [.createManufacturerConfig(manufacturer, options)](#api_tv_test_dot_config_dot_config_dot_createManufacturerConfig) ⇒ <code>object</code>
    * [.getInstanceInfo()](#api_tv_test_dot_config_dot_config_dot_getInstanceInfo) ⇒ <code>object</code>
  * [.connection](#api_tv_test_connection)
    * [.connect(host)](#api_tv_test_dot_connection_dot_connect) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.disconnect()](#api_tv_test_dot_connection_dot_disconnect) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.isConnected()](#api_tv_test_dot_connection_dot_isConnected) ⇒ <code>*</code>
    * [.getConnectionInfo()](#api_tv_test_dot_connection_dot_getConnectionInfo) ⇒ <code>*</code>
  * [.controllers](#api_tv_test_controllers)
    * [.tvControllers](#api_tv_test_dot_controllers_tvControllers)
      * [.module.exports](#api_tv_test_dot_controllers_dot_tvControllers)
  * [.devices](#api_tv_test_devices)
    * [.firetv](#api_tv_test_dot_devices_firetv)
      * [.initialize(config)](#api_tv_test_dot_devices_dot_firetv_dot_initialize) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.powerOn(deviceId)](#api_tv_test_dot_devices_dot_firetv_dot_powerOn) ⇒ <code>Promise.&lt;boolean&gt;</code>
      * [.powerOff(deviceId)](#api_tv_test_dot_devices_dot_firetv_dot_powerOff) ⇒ <code>Promise.&lt;boolean&gt;</code>
      * [.sendKey(deviceId, keyCode)](#api_tv_test_dot_devices_dot_firetv_dot_sendKey) ⇒ <code>Promise.&lt;boolean&gt;</code>
      * [.REMOTE_KEYS](#api_tv_test_dot_devices_dot_firetv_dot_REMOTE_KEYS)
      * [.isValidRemoteKey(key)](#api_tv_test_dot_devices_dot_firetv_dot_isValidRemoteKey) ⇒ <code>boolean</code>
    * [.lg](#api_tv_test_dot_devices_lg)
      * [.module.exports](#api_tv_test_dot_devices_dot_lg)
    * [.mxnet](#api_tv_test_dot_devices_mxnet)
      * [.initialize(config)](#api_tv_test_dot_devices_dot_mxnet_dot_initialize) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.powerOn(deviceId)](#api_tv_test_dot_devices_dot_mxnet_dot_powerOn) ⇒ <code>Promise.&lt;boolean&gt;</code>
      * [.powerOff(deviceId)](#api_tv_test_dot_devices_dot_mxnet_dot_powerOff) ⇒ <code>Promise.&lt;boolean&gt;</code>
      * [.sendCommand(deviceId, command)](#api_tv_test_dot_devices_dot_mxnet_dot_sendCommand) ⇒ <code>Promise.&lt;Object&gt;</code>
      * [.getStatus(deviceId)](#api_tv_test_dot_devices_dot_mxnet_dot_getStatus) ⇒ <code>Promise.&lt;Object&gt;</code>
      * [.COMMANDS](#api_tv_test_dot_devices_dot_mxnet_dot_COMMANDS)
      * [.isValidCommand(command)](#api_tv_test_dot_devices_dot_mxnet_dot_isValidCommand) ⇒ <code>boolean</code>
  * [.input](#api_tv_test_input)
    * [.setInput(inputName)](#api_tv_test_dot_input_dot_setInput) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getAllInputNames()](#api_tv_test_dot_input_dot_getAllInputNames) ⇒ <code>*</code>
    * [.getCurrentInput()](#api_tv_test_dot_input_dot_getCurrentInput) ⇒ <code>*</code>
  * [.key](#api_tv_test_key)
    * [.key(keyName)](#api_tv_test_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getAllKeyNames()](#api_tv_test_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
      * [.getKeyCode(keyName)](#api_tv_test_dot_key_dot_getKeyCode) ⇒ <code>*</code>
    * [.getAllKeyNames()](#api_tv_test_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
    * [.getKeyCode(keyName)](#api_tv_test_dot_key_dot_getKeyCode) ⇒ <code>*</code>
  * [.lifecycle](#api_tv_test_lifecycle)
    * [.callAll(methodName, args, options)](#api_tv_test_dot_lifecycle_dot_callAll) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getModules(methodName, exclude)](#api_tv_test_dot_lifecycle_dot_getModules) ⇒ <code>Array.&lt;string&gt;</code>
    * [.methods](#api_tv_test_dot_lifecycle_dot_methods)
  * [.manufacturer](#api_tv_test_manufacturer)
    * [.lg](#api_tv_test_dot_manufacturer_lg)
      * [.app](#api_tv_test_dot_manufacturer_dot_lg_app)
        * [.setApp(appName)](#api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_setApp) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getCurrentApp()](#api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_getCurrentApp) ⇒ <code>*</code>
        * [.getAllApps()](#api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_getAllApps) ⇒ <code>*</code>
        * [.retrieveCurrentApp()](#api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_retrieveCurrentApp) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.channel](#api_tv_test_dot_manufacturer_dot_lg_channel)
        * [.setChannel(channel)](#api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_setChannel) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.up()](#api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.down()](#api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getCurrentChannel()](#api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_getCurrentChannel) ⇒ <code>*</code>
        * [.retrieveCurrentChannel()](#api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_retrieveCurrentChannel) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.connect](#api_tv_test_dot_manufacturer_dot_lg_connect)
        * [.connect(host, options)](#api_tv_test_dot_manufacturer_dot_lg_dot_connect) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.disconnect()](#api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_disconnect) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getConnection()](#api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_getConnection) ⇒ <code>*</code>
        * [.isConnectedToTV()](#api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_isConnectedToTV) ⇒ <code>*</code>
        * [.isReadyForCommands()](#api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_isReadyForCommands) ⇒ <code>*</code>
        * [.sendReceiveRawData(data, timeout)](#api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_sendReceiveRawData) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.disconnect](#api_tv_test_dot_manufacturer_dot_lg_disconnect)
        * [.disconnect()](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.forceDisconnect()](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_forceDisconnect) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.isConnected()](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_isConnected) ⇒ <code>*</code>
        * [.isReady()](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_isReady) ⇒ <code>*</code>
        * [.getStatus()](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_getStatus) ⇒ <code>*</code>
      * [.encryption](#api_tv_test_dot_manufacturer_dot_lg_encryption)
        * [.deriveKey(keycode)](#api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_deriveKey) ⇒ <code>*</code>
        * [.generateRandomBytes(length)](#api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_generateRandomBytes) ⇒ <code>*</code>
        * [.addPadding(message)](#api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_addPadding) ⇒ <code>*</code>
        * [.removePadding(message)](#api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_removePadding) ⇒ <code>*</code>
        * [.encrypt(message)](#api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_encrypt) ⇒ <code>*</code>
        * [.decrypt(encryptedData)](#api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_decrypt) ⇒ <code>*</code>
        * [.clearKeyCache()](#api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_clearKeyCache) ⇒ <code>*</code>
      * [.getInfo](#api_tv_test_dot_manufacturer_dot_lg_getInfo)
        * [.getInfo()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getPowerState()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getPowerState) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getConnectionStatus()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getConnectionStatus) ⇒ <code>*</code>
        * [.getKeysInfo()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getKeysInfo) ⇒ <code>*</code>
        * [.getStatus()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getStatus) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.retrieveInitialState()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_retrieveInitialState) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.retrieveCurrentChannel()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_retrieveCurrentChannel) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.retrieveCurrentApp()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_retrieveCurrentApp) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.testResponsiveness()](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_testResponsiveness) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.input](#api_tv_test_dot_manufacturer_dot_lg_input)
        * [.setInput(inputName)](#api_tv_test_dot_manufacturer_dot_lg_dot_input_dot_setInput) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getAllInputNames()](#api_tv_test_dot_manufacturer_dot_lg_dot_input_dot_getAllInputNames) ⇒ <code>*</code>
        * [.getCurrentInput()](#api_tv_test_dot_manufacturer_dot_lg_dot_input_dot_getCurrentInput) ⇒ <code>*</code>
      * [.key](#api_tv_test_dot_manufacturer_dot_lg_key)
        * [.key(keyName)](#api_tv_test_dot_manufacturer_dot_lg_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.key(keyName)](#api_tv_test_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
            * [.getAllKeyNames()](#api_tv_test_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
            * [.getKeyCode(keyName)](#api_tv_test_dot_key_dot_getKeyCode) ⇒ <code>*</code>
          * [.getAllKeyNames()](#api_tv_test_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
          * [.getKeyCode(keyName)](#api_tv_test_dot_key_dot_getKeyCode) ⇒ <code>*</code>
        * [.getAllKeyNames()](#api_tv_test_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
        * [.getKeyCode(keyName)](#api_tv_test_dot_key_dot_getKeyCode) ⇒ <code>*</code>
        * [.sequence(keyNames)](#api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_sequence) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.navigation(direction)](#api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_navigation) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.number(number)](#api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_number) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.volume(action)](#api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_volume) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.up()](#api_tv_test_dot_volume_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.down()](#api_tv_test_dot_volume_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.set(level)](#api_tv_test_dot_volume_dot_set) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.mute(mute)](#api_tv_test_dot_volume_dot_mute) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.unmute()](#api_tv_test_dot_volume_dot_unmute) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.toggleMute()](#api_tv_test_dot_volume_dot_toggleMute) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.pseudoMute(mute)](#api_tv_test_dot_volume_dot_pseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.pseudoUnmute()](#api_tv_test_dot_volume_dot_pseudoUnmute) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.togglePseudoMute()](#api_tv_test_dot_volume_dot_togglePseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.change(delta)](#api_tv_test_dot_volume_dot_change) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.getPseudoMuteState()](#api_tv_test_dot_volume_dot_getPseudoMuteState) ⇒ <code>*</code>
          * [.getMaxVolume()](#api_tv_test_dot_volume_dot_getMaxVolume) ⇒ <code>*</code>
          * [.setMaxVolume(level)](#api_tv_test_dot_volume_dot_setMaxVolume) ⇒ <code>*</code>
          * [.retrieveCurrentVolume()](#api_tv_test_dot_volume_dot_retrieveCurrentVolume) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.retrieveCurrentMute()](#api_tv_test_dot_volume_dot_retrieveCurrentMute) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.keyUp()](#api_tv_test_dot_volume_dot_keyUp) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.keyDown()](#api_tv_test_dot_volume_dot_keyDown) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.channel(action)](#api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_channel) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.setChannel(channel)](#api_tv_test_dot_channel_dot_setChannel) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.up()](#api_tv_test_dot_channel_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.down()](#api_tv_test_dot_channel_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.getCurrentChannel()](#api_tv_test_dot_channel_dot_getCurrentChannel) ⇒ <code>*</code>
          * [.retrieveCurrentChannel()](#api_tv_test_dot_channel_dot_retrieveCurrentChannel) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.color(color)](#api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_color) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.keys](#api_tv_test_dot_manufacturer_dot_lg_keys)
        * [.getKeyCode(keyName)](#api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getKeyCode) ⇒ <code>*</code>
        * [.getKeyCommand(keyName)](#api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getKeyCommand) ⇒ <code>*</code>
        * [.isValidKey(keyName)](#api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_isValidKey) ⇒ <code>*</code>
        * [.getAllKeyNames()](#api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getAllKeyNames) ⇒ <code>*</code>
        * [.getAllInputNames()](#api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getAllInputNames) ⇒ <code>*</code>
        * [.getInputCode(inputName)](#api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getInputCode) ⇒ <code>*</code>
        * [.isValidInput(inputName)](#api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_isValidInput) ⇒ <code>*</code>
      * [.power](#api_tv_test_dot_manufacturer_dot_lg_power)
        * [.on()](#api_tv_test_dot_power_dot_on) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.off()](#api_tv_test_dot_power_dot_off) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.toggle()](#api_tv_test_dot_power_dot_toggle) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getState()](#api_tv_test_dot_power_dot_getState) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.process](#api_tv_test_dot_manufacturer_dot_lg_process)
        * [.processInboundData(data, meta)](#api_tv_test_dot_manufacturer_dot_lg_dot_process_dot_processInboundData) ⇒ <code>*</code>
      * [.sendCommand](#api_tv_test_dot_manufacturer_dot_lg_sendCommand)
        * [.sendCommand(command, payload)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendUserCommand(command, payload)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendUserCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendUpdateCommand(command, payload)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendUpdateCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendWebOSCommand(type, uri, payload, id)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendWebOSCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendKeyCommand(keyCode)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendKeyCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendPowerCommand(on)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendPowerCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendVolumeCommand(action, value)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendVolumeCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendInputCommand(input)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendInputCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendAppCommand(appId)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendAppCommand) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.sendChannelCommand(channel)](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendChannelCommand) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.volume](#api_tv_test_dot_manufacturer_dot_lg_volume)
        * [.up()](#api_tv_test_dot_volume_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.down()](#api_tv_test_dot_volume_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.set(level)](#api_tv_test_dot_volume_dot_set) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.mute(mute)](#api_tv_test_dot_volume_dot_mute) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.unmute()](#api_tv_test_dot_volume_dot_unmute) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.toggleMute()](#api_tv_test_dot_volume_dot_toggleMute) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.pseudoMute(mute)](#api_tv_test_dot_volume_dot_pseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.pseudoUnmute()](#api_tv_test_dot_volume_dot_pseudoUnmute) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.togglePseudoMute()](#api_tv_test_dot_volume_dot_togglePseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.getPseudoMuteState()](#api_tv_test_dot_volume_dot_getPseudoMuteState) ⇒ <code>*</code>
        * [.getMaxVolume()](#api_tv_test_dot_volume_dot_getMaxVolume) ⇒ <code>*</code>
        * [.setMaxVolume(level)](#api_tv_test_dot_volume_dot_setMaxVolume) ⇒ <code>*</code>
        * [.change(delta)](#api_tv_test_dot_volume_dot_change) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.retrieveCurrentVolume()](#api_tv_test_dot_volume_dot_retrieveCurrentVolume) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.retrieveCurrentMute()](#api_tv_test_dot_volume_dot_retrieveCurrentMute) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.keyUp()](#api_tv_test_dot_volume_dot_keyUp) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.keyDown()](#api_tv_test_dot_volume_dot_keyDown) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.power](#api_tv_test_power)
    * [.on()](#api_tv_test_dot_power_dot_on) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.off()](#api_tv_test_dot_power_dot_off) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.toggle()](#api_tv_test_dot_power_dot_toggle) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getState()](#api_tv_test_dot_power_dot_getState) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.proxyTest](#api_tv_test_proxyTest)
    * [.module.exports](#api_tv_test_dot_proxyTest)
  * [.state](#api_tv_test_state)
    * [.cloneState()](#api_tv_test_dot_state_dot_cloneState) ⇒ <code>*</code>
    * [.emitLog(level, message)](#api_tv_test_dot_state_dot_emitLog) ⇒ <code>*</code>
    * [.getSnapshot()](#api_tv_test_dot_state_dot_getSnapshot) ⇒ <code>*</code>
    * [.reset()](#api_tv_test_dot_state_dot_reset) ⇒ <code>*</code>
    * [.getMaxVolume()](#api_tv_test_dot_state_dot_getMaxVolume) ⇒ <code>*</code>
    * [.setMaxVolume(level)](#api_tv_test_dot_state_dot_setMaxVolume) ⇒ <code>*</code>
    * [.getPseudoMuteState()](#api_tv_test_dot_state_dot_getPseudoMuteState) ⇒ <code>*</code>
    * [.setPseudoMuteState(pseudoMuted, savedVolume)](#api_tv_test_dot_state_dot_setPseudoMuteState) ⇒ <code>*</code>
    * [.initializeVolumeState()](#api_tv_test_dot_state_dot_initializeVolumeState) ⇒ <code>*</code>
    * [.recordUserCommand(partial)](#api_tv_test_dot_state_dot_recordUserCommand) ⇒ <code>*</code>
    * [.recordUpdateCommand(partial)](#api_tv_test_dot_state_dot_recordUpdateCommand) ⇒ <code>*</code>
    * [.shutdown()](#api_tv_test_dot_state_dot_shutdown) ⇒ <code>*</code>
    * [.update(partial)](#api_tv_test_dot_state_dot_update) ⇒ <code>*</code>
    * [.processInboundData(data)](#api_tv_test_dot_state_dot_processInboundData) ⇒ <code>*</code>
  * [.subfolder](#api_tv_test_subfolder)
    * [.app](#api_tv_test_dot_subfolder_app)
      * [.setApp(appName)](#api_tv_test_dot_subfolder_dot_app_dot_setApp) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getCurrentApp()](#api_tv_test_dot_subfolder_dot_app_dot_getCurrentApp) ⇒ <code>*</code>
      * [.getAllApps()](#api_tv_test_dot_subfolder_dot_app_dot_getAllApps) ⇒ <code>*</code>
      * [.retrieveCurrentApp()](#api_tv_test_dot_subfolder_dot_app_dot_retrieveCurrentApp) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.channel](#api_tv_test_dot_subfolder_channel)
      * [.setChannel(channel)](#api_tv_test_dot_subfolder_dot_channel_dot_setChannel) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.up()](#api_tv_test_dot_subfolder_dot_channel_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.down()](#api_tv_test_dot_subfolder_dot_channel_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getCurrentChannel()](#api_tv_test_dot_subfolder_dot_channel_dot_getCurrentChannel) ⇒ <code>*</code>
      * [.retrieveCurrentChannel()](#api_tv_test_dot_subfolder_dot_channel_dot_retrieveCurrentChannel) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.config](#api_tv_test_dot_subfolder_config)
    * [.connection](#api_tv_test_dot_subfolder_connection)
      * [.connect(host)](#api_tv_test_dot_subfolder_dot_connection_dot_connect) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.disconnect()](#api_tv_test_dot_subfolder_dot_connection_dot_disconnect) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.isConnected()](#api_tv_test_dot_subfolder_dot_connection_dot_isConnected) ⇒ <code>*</code>
      * [.getConnectionInfo()](#api_tv_test_dot_subfolder_dot_connection_dot_getConnectionInfo) ⇒ <code>*</code>
    * [.input](#api_tv_test_dot_subfolder_input)
      * [.setInput(inputName)](#api_tv_test_dot_subfolder_dot_input_dot_setInput) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getAllInputNames()](#api_tv_test_dot_subfolder_dot_input_dot_getAllInputNames) ⇒ <code>*</code>
      * [.getCurrentInput()](#api_tv_test_dot_subfolder_dot_input_dot_getCurrentInput) ⇒ <code>*</code>
    * [.key](#api_tv_test_dot_subfolder_key)
      * [.key(keyName)](#api_tv_test_dot_subfolder_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
        * [.key(keyName)](#api_tv_test_dot_key) ⇒ <code>Promise.&lt;*&gt;</code>
          * [.getAllKeyNames()](#api_tv_test_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
          * [.getKeyCode(keyName)](#api_tv_test_dot_key_dot_getKeyCode) ⇒ <code>*</code>
        * [.getAllKeyNames()](#api_tv_test_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
        * [.getKeyCode(keyName)](#api_tv_test_dot_key_dot_getKeyCode) ⇒ <code>*</code>
      * [.getAllKeyNames()](#api_tv_test_dot_subfolder_dot_key_dot_getAllKeyNames) ⇒ <code>*</code>
      * [.getKeyCode(keyName)](#api_tv_test_dot_subfolder_dot_key_dot_getKeyCode) ⇒ <code>*</code>
    * [.power](#api_tv_test_dot_subfolder_power)
      * [.on()](#api_tv_test_dot_subfolder_dot_power_dot_on) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.off()](#api_tv_test_dot_subfolder_dot_power_dot_off) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.toggle()](#api_tv_test_dot_subfolder_dot_power_dot_toggle) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getState()](#api_tv_test_dot_subfolder_dot_power_dot_getState) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.state](#api_tv_test_dot_subfolder_state)
      * [.cloneState()](#api_tv_test_dot_subfolder_dot_state_dot_cloneState) ⇒ <code>*</code>
      * [.emitLog(level, message)](#api_tv_test_dot_subfolder_dot_state_dot_emitLog) ⇒ <code>*</code>
      * [.getSnapshot()](#api_tv_test_dot_subfolder_dot_state_dot_getSnapshot) ⇒ <code>*</code>
      * [.reset()](#api_tv_test_dot_subfolder_dot_state_dot_reset) ⇒ <code>*</code>
      * [.getMaxVolume()](#api_tv_test_dot_subfolder_dot_state_dot_getMaxVolume) ⇒ <code>*</code>
      * [.setMaxVolume(level)](#api_tv_test_dot_subfolder_dot_state_dot_setMaxVolume) ⇒ <code>*</code>
      * [.getPseudoMuteState()](#api_tv_test_dot_subfolder_dot_state_dot_getPseudoMuteState) ⇒ <code>*</code>
      * [.setPseudoMuteState(pseudoMuted, savedVolume)](#api_tv_test_dot_subfolder_dot_state_dot_setPseudoMuteState) ⇒ <code>*</code>
      * [.initializeVolumeState()](#api_tv_test_dot_subfolder_dot_state_dot_initializeVolumeState) ⇒ <code>*</code>
      * [.recordUserCommand(partial)](#api_tv_test_dot_subfolder_dot_state_dot_recordUserCommand) ⇒ <code>*</code>
      * [.recordUpdateCommand(partial)](#api_tv_test_dot_subfolder_dot_state_dot_recordUpdateCommand) ⇒ <code>*</code>
      * [.shutdown()](#api_tv_test_dot_subfolder_dot_state_dot_shutdown) ⇒ <code>*</code>
      * [.update(partial)](#api_tv_test_dot_subfolder_dot_state_dot_update) ⇒ <code>*</code>
      * [.processInboundData(data)](#api_tv_test_dot_subfolder_dot_state_dot_processInboundData) ⇒ <code>*</code>
    * [.volume](#api_tv_test_dot_subfolder_volume)
      * [.up()](#api_tv_test_dot_volume_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.down()](#api_tv_test_dot_volume_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.set(level)](#api_tv_test_dot_volume_dot_set) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.mute(mute)](#api_tv_test_dot_volume_dot_mute) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.unmute()](#api_tv_test_dot_volume_dot_unmute) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.toggleMute()](#api_tv_test_dot_volume_dot_toggleMute) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.pseudoMute(mute)](#api_tv_test_dot_volume_dot_pseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.pseudoUnmute()](#api_tv_test_dot_volume_dot_pseudoUnmute) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.togglePseudoMute()](#api_tv_test_dot_volume_dot_togglePseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.change(delta)](#api_tv_test_dot_volume_dot_change) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getPseudoMuteState()](#api_tv_test_dot_volume_dot_getPseudoMuteState) ⇒ <code>*</code>
      * [.getMaxVolume()](#api_tv_test_dot_volume_dot_getMaxVolume) ⇒ <code>*</code>
      * [.setMaxVolume(level)](#api_tv_test_dot_volume_dot_setMaxVolume) ⇒ <code>*</code>
      * [.retrieveCurrentVolume()](#api_tv_test_dot_volume_dot_retrieveCurrentVolume) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.retrieveCurrentMute()](#api_tv_test_dot_volume_dot_retrieveCurrentMute) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.keyUp()](#api_tv_test_dot_volume_dot_keyUp) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.keyDown()](#api_tv_test_dot_volume_dot_keyDown) ⇒ <code>Promise.&lt;*&gt;</code>
  * [.utilities](#api_tv_test_utilities)
    * [.commandQueue](#api_tv_test_dot_utilities_commandQueue)
      * [.addUserCommand(commandFunction)](#api_tv_test_dot_utilities_dot_commandQueue_dot_addUserCommand) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.addUpdateCommand(commandFunction)](#api_tv_test_dot_utilities_dot_commandQueue_dot_addUpdateCommand) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.queueUpdateCommands(updateCommands)](#api_tv_test_dot_utilities_dot_commandQueue_dot_queueUpdateCommands) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.getPendingUserCommandCount()](#api_tv_test_dot_utilities_dot_commandQueue_dot_getPendingUserCommandCount) ⇒ <code>*</code>
      * [.getPendingUpdateCommandCount()](#api_tv_test_dot_utilities_dot_commandQueue_dot_getPendingUpdateCommandCount) ⇒ <code>*</code>
      * [.isUpdateCommandPending()](#api_tv_test_dot_utilities_dot_commandQueue_dot_isUpdateCommandPending) ⇒ <code>*</code>
      * [.clearPendingUpdateCommands()](#api_tv_test_dot_utilities_dot_commandQueue_dot_clearPendingUpdateCommands) ⇒ <code>*</code>
      * [.getQueueStats()](#api_tv_test_dot_utilities_dot_commandQueue_dot_getQueueStats) ⇒ <code>*</code>
    * [.failOperation](#api_tv_test_dot_utilities_failOperation)
      * [.failOperation(message)](#api_tv_test_dot_utilities_dot_failOperation) ⇒ <code>*</code>
    * [.wakeOnLan](#api_tv_test_dot_utilities_wakeOnLan)
      * [.wake(macAddress)](#api_tv_test_dot_utilities_dot_wakeOnLan_dot_wake) ⇒ <code>Promise.&lt;*&gt;</code>
      * [.isValidMacAddress(macAddress)](#api_tv_test_dot_utilities_dot_wakeOnLan_dot_isValidMacAddress) ⇒ <code>*</code>
      * [.normalizeMacAddress(macAddress)](#api_tv_test_dot_utilities_dot_wakeOnLan_dot_normalizeMacAddress) ⇒ <code>*</code>
  * [.utils](#api_tv_test_utils)
    * [.defaults](#api_tv_test_dot_utils_defaults)
      * [.getDefaults(dataSystemName)](#api_tv_test_dot_utils_dot_defaults_dot_getDefaults) ⇒ <code>Promise.&lt;Object&gt;</code>
      * [.getAllDefaults()](#api_tv_test_dot_utils_dot_defaults_dot_getAllDefaults) ⇒ <code>Promise.&lt;Object&gt;</code>
      * [.reloadDefaults()](#api_tv_test_dot_utils_dot_defaults_dot_reloadDefaults) ⇒ <code>Promise.&lt;Object&gt;</code>
      * [.createDefaultsAPI(dataSystemName, getCurrentValues, setValues)](#api_tv_test_dot_utils_dot_defaults_dot_createDefaultsAPI) ⇒ <code>Promise.&lt;Object&gt;</code>
      * [.restore(keys)](#api_tv_test_dot_utils_dot_defaults_dot_restore) ⇒ <code>Object</code>
      * [.isDefault(key)](#api_tv_test_dot_utils_dot_defaults_dot_isDefault) ⇒ <code>boolean</code>
      * [.customized()](#api_tv_test_dot_utils_dot_defaults_dot_customized) ⇒ <code>Object</code>
      * [.resetAll(exclude)](#api_tv_test_dot_utils_dot_defaults_dot_resetAll) ⇒ <code>Object</code>
    * [.lifecycle](#api_tv_test_dot_utils_lifecycle)
      * [.callAll(methodName, args, options)](#api_tv_test_dot_utils_dot_lifecycle_dot_callAll) ⇒ <code>Promise.&lt;Object&gt;</code>
      * [.getModules(methodName, exclude)](#api_tv_test_dot_utils_dot_lifecycle_dot_getModules) ⇒ <code>Array.&lt;string&gt;</code>
      * [.methods](#api_tv_test_dot_utils_dot_lifecycle_dot_methods)
  * [.volume](#api_tv_test_volume)
    * [.up()](#api_tv_test_dot_volume_dot_up) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.down()](#api_tv_test_dot_volume_dot_down) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.set(level)](#api_tv_test_dot_volume_dot_set) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.mute(mute)](#api_tv_test_dot_volume_dot_mute) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.unmute()](#api_tv_test_dot_volume_dot_unmute) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.toggleMute()](#api_tv_test_dot_volume_dot_toggleMute) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.pseudoMute(mute)](#api_tv_test_dot_volume_dot_pseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.pseudoUnmute()](#api_tv_test_dot_volume_dot_pseudoUnmute) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.togglePseudoMute()](#api_tv_test_dot_volume_dot_togglePseudoMute) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.change(delta)](#api_tv_test_dot_volume_dot_change) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.getPseudoMuteState()](#api_tv_test_dot_volume_dot_getPseudoMuteState) ⇒ <code>*</code>
    * [.getMaxVolume()](#api_tv_test_dot_volume_dot_getMaxVolume) ⇒ <code>*</code>
    * [.setMaxVolume(level)](#api_tv_test_dot_volume_dot_setMaxVolume) ⇒ <code>*</code>
    * [.retrieveCurrentVolume()](#api_tv_test_dot_volume_dot_retrieveCurrentVolume) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.retrieveCurrentMute()](#api_tv_test_dot_volume_dot_retrieveCurrentMute) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.keyUp()](#api_tv_test_dot_volume_dot_keyUp) ⇒ <code>Promise.&lt;*&gt;</code>
    * [.keyDown()](#api_tv_test_dot_volume_dot_keyDown) ⇒ <code>Promise.&lt;*&gt;</code>


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

<a id="api_tv_test_app"></a>

### api_tv_test.app
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_app_dot_setApp"></a>

### setApp(appName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setApp.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| appName | <code>*</code> |  | <p>appName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.app.setApp('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.app.setApp('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.app.setApp('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.app.setApp('myName');
```



* * *

<a id="api_tv_test_dot_app_dot_getCurrentApp"></a>

### getCurrentApp() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentApp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.app.getCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.app.getCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.app.getCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.app.getCurrentApp();
```



* * *

<a id="api_tv_test_dot_app_dot_getAllApps"></a>

### getAllApps() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllApps.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.app.getAllApps();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.app.getAllApps();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.app.getAllApps();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.app.getAllApps();
```



* * *

<a id="api_tv_test_dot_app_dot_retrieveCurrentApp"></a>

### retrieveCurrentApp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentApp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.app.retrieveCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.app.retrieveCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.app.retrieveCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.app.retrieveCurrentApp();
```



* * *

<a id="api_tv_test_channel"></a>

### api_tv_test.channel
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_channel_dot_setChannel"></a>

### setChannel(channel) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setChannel.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| channel | <code>*</code> |  | <p>channel.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.setChannel(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.setChannel(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.setChannel(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.setChannel(null);
```



* * *

<a id="api_tv_test_dot_channel_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.up();
```



* * *

<a id="api_tv_test_dot_channel_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.down();
```



* * *

<a id="api_tv_test_dot_channel_dot_getCurrentChannel"></a>

### getCurrentChannel() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.channel.getCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.channel.getCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.channel.getCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.channel.getCurrentChannel();
```



* * *

<a id="api_tv_test_dot_channel_dot_retrieveCurrentChannel"></a>

### retrieveCurrentChannel() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.retrieveCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.retrieveCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.retrieveCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.retrieveCurrentChannel();
```



* * *

<a id="api_tv_test_config"></a>

### api_tv_test.config
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_config_dot_config_dot_get"></a>

### get(key) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>Get configuration value(s)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | <p>Specific key to get, or undefined to get all</p> |


**Returns**:

- <code>*</code> <p>The value or entire config object</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.get();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.get();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.get();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.get();
```



* * *

<a id="api_tv_test_dot_config_dot_config_dot_update"></a>

### update(keyOrConfig, value) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Update configuration with new values</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyOrConfig | <code>string \| object</code> |  | <p>Key name or config object</p> |
| [value] | <code>*</code> |  | <p>Value if first param is key</p> |


**Returns**:

- <code>object</code> <p>Success response with updated values</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.update(value);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.update(value);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.update(value);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.update(value);
```



* * *

<a id="api_tv_test_dot_config_dot_config_dot_set"></a>

### set(key, value) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Set a single configuration value (alias for update)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Configuration key</p> |
| value | <code>*</code> |  | <p>Configuration value</p> |


**Returns**:

- <code>object</code> <p>Success response</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.set('myKey', null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.set('myKey', null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.set('myKey', null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.set('myKey', null);
```



* * *

<a id="api_tv_test_dot_config_dot_config_dot_getDefaultPort"></a>

### getDefaultPort() ⇒ <code>number</code>
> <p><strong style="font-size: 1.1em;"><p>Get the current port or default</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>number</code> <p>Port number</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.getDefaultPort();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.getDefaultPort();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.getDefaultPort();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.getDefaultPort();
```



* * *

<a id="api_tv_test_dot_config_dot_config_dot_validate"></a>

### validate(configToValidate, requiredKeys) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Validate configuration object</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| configToValidate | <code>object</code> |  | <p>Config to validate</p> |
| [requiredKeys] | <code>Array.&lt;string&gt;</code> |  | <p>Required keys</p> |


**Returns**:

- <code>object</code> <p>Validation result</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.validate({});
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.validate({});
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.validate({});
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.validate({});
```



* * *

<a id="api_tv_test_dot_config_dot_config_dot_merge"></a>

### merge(userConfig, _) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Merge user config with current state</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [userConfig] | <code>object</code> |  | <p>User configuration</p> |
| [_] | <code>string</code> |  | <p>Context (unused)</p> |


**Returns**:

- <code>object</code> <p>Merged configuration</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.merge();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.merge();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.merge();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.merge();
```



* * *

<a id="api_tv_test_dot_config_dot_config_dot_createManufacturerConfig"></a>

### createManufacturerConfig(manufacturer, options) ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Create manufacturer-specific configuration</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| manufacturer | <code>string</code> |  | <p>Manufacturer name</p> |
| [options] | <code>object</code> |  | <p>Additional options</p> |


**Returns**:

- <code>object</code> <p>Manufacturer config</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.createManufacturerConfig('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.createManufacturerConfig('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.createManufacturerConfig('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.createManufacturerConfig('value');
```



* * *

<a id="api_tv_test_dot_config_dot_config_dot_getInstanceInfo"></a>

### getInstanceInfo() ⇒ <code>object</code>
> <p><strong style="font-size: 1.1em;"><p>Get instance information for debugging</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>object</code> <p>Instance info</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.getInstanceInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.getInstanceInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.config.getInstanceInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.config.getInstanceInfo();
```



* * *

<a id="api_tv_test_connection"></a>

### api_tv_test.connection
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_connection_dot_connect"></a>

### connect(host) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>connect.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| host | <code>*</code> |  | <p>host.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.connection.connect('192.168.1.1');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.connection.connect('192.168.1.1');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.connection.connect('192.168.1.1');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.connection.connect('192.168.1.1');
```



* * *

<a id="api_tv_test_dot_connection_dot_disconnect"></a>

### disconnect() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>disconnect.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.connection.disconnect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.connection.disconnect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.connection.disconnect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.connection.disconnect();
```



* * *

<a id="api_tv_test_dot_connection_dot_isConnected"></a>

### isConnected() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isConnected.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.connection.isConnected();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.connection.isConnected();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.connection.isConnected();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.connection.isConnected();
```



* * *

<a id="api_tv_test_dot_connection_dot_getConnectionInfo"></a>

### getConnectionInfo() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getConnectionInfo.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.connection.getConnectionInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.connection.getConnectionInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.connection.getConnectionInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.connection.getConnectionInfo();
```



* * *

<a id="api_tv_test_controllers"></a>

### api_tv_test.controllers
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_controllers_tvControllers"></a>

### tvControllers
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_controllers_dot_tvControllers"></a>

### module.exports
> <p><strong style="font-size: 1.1em;"><p>Default export of SubfolderControllers proxy.</p></strong></p>
> 
**Kind**: static property


* * *

<a id="api_tv_test_devices"></a>

### api_tv_test.devices
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_devices_firetv"></a>

### firetv
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_initialize"></a>

### initialize(config) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>initialize.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| config | <code>*</code> |  | <p>config.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.initialize(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.initialize(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.initialize(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.initialize(null);
```



* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_powerOn"></a>

### powerOn(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers on Fire TV device (mock)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.powerOn('emulator-5554');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.powerOn('emulator-5554');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.powerOn('emulator-5554');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.powerOn('emulator-5554');
```



* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_powerOff"></a>

### powerOff(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers off Fire TV device (mock)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.powerOff('emulator-5554');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.powerOff('emulator-5554');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.powerOff('emulator-5554');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.powerOff('emulator-5554');
```



* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_sendKey"></a>

### sendKey(deviceId, keyCode) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends key to Fire TV device (mock)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |
| keyCode | <code>string</code> |  | <p>Key to send</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.sendKey('emulator-5554', 'myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.sendKey('emulator-5554', 'myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.firetv.sendKey('emulator-5554', 'myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.firetv.sendKey('emulator-5554', 'myKey');
```



* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_REMOTE_KEYS"></a>

### REMOTE_KEYS
> <p><strong style="font-size: 1.1em;"><p>Common remote control keys - constants for external use</p></strong></p>
> 
**Kind**: static namespace


* * *

<a id="api_tv_test_dot_devices_dot_firetv_dot_isValidRemoteKey"></a>

### isValidRemoteKey(key) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Helper function to validate remote key constants (demonstrates usage)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | <p>Key to validate</p> |


**Returns**:

- <code>boolean</code> <p>True if key is valid</p>


**Example**
```js
isValidRemoteKey(REMOTE_KEYS.POWER); // true
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.devices.firetv.isValidRemoteKey('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.devices.firetv.isValidRemoteKey('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.devices.firetv.isValidRemoteKey('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.devices.firetv.isValidRemoteKey('myKey');
```



* * *

<a id="api_tv_test_dot_devices_lg"></a>

### lg
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_devices_dot_lg"></a>

### module.exports
> <p><strong style="font-size: 1.1em;"><p>Default export of LGTVControllers proxy.</p></strong></p>
> 
**Kind**: static property


* * *

<a id="api_tv_test_dot_devices_mxnet"></a>

### mxnet
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_initialize"></a>

### initialize(config) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>initialize.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| config | <code>*</code> |  | <p>config.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.initialize(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.initialize(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.initialize(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.initialize(null);
```



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_powerOn"></a>

### powerOn(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers on MXNet device (mock)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.powerOn('emulator-5554');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.powerOn('emulator-5554');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.powerOn('emulator-5554');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.powerOn('emulator-5554');
```



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_powerOff"></a>

### powerOff(deviceId) ⇒ <code>Promise.&lt;boolean&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Powers off MXNet device (mock)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;boolean&gt;</code> <p>Success status</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.powerOff('emulator-5554');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.powerOff('emulator-5554');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.powerOff('emulator-5554');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.powerOff('emulator-5554');
```



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_sendCommand"></a>

### sendCommand(deviceId, command) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Sends command to MXNet device (mock)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |
| command | <code>string</code> |  | <p>Command to send</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Command response</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.sendCommand('emulator-5554', 'value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.sendCommand('emulator-5554', 'value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.sendCommand('emulator-5554', 'value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.sendCommand('emulator-5554', 'value');
```



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_getStatus"></a>

### getStatus(deviceId) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets device status (mock)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deviceId | <code>string</code> |  | <p>Device identifier</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Device status</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.getStatus('emulator-5554');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.getStatus('emulator-5554');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.devices.mxnet.getStatus('emulator-5554');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.devices.mxnet.getStatus('emulator-5554');
```



* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_COMMANDS"></a>

### COMMANDS
> <p><strong style="font-size: 1.1em;"><p>Common MXNet commands - constants for external use</p></strong></p>
> 
**Kind**: static namespace


* * *

<a id="api_tv_test_dot_devices_dot_mxnet_dot_isValidCommand"></a>

### isValidCommand(command) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Helper function to validate command constants (demonstrates usage)</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>string</code> |  | <p>Command to validate</p> |


**Returns**:

- <code>boolean</code> <p>True if command is valid</p>


**Example**
```js
isValidCommand(COMMANDS.POWER_ON); // true
```
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.devices.mxnet.isValidCommand('value');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.devices.mxnet.isValidCommand('value');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.devices.mxnet.isValidCommand('value');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.devices.mxnet.isValidCommand('value');
```



* * *

<a id="api_tv_test_input"></a>

### api_tv_test.input
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_input_dot_setInput"></a>

### setInput(inputName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setInput.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| inputName | <code>*</code> |  | <p>inputName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.input.setInput('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.input.setInput('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.input.setInput('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.input.setInput('myName');
```



* * *

<a id="api_tv_test_dot_input_dot_getAllInputNames"></a>

### getAllInputNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllInputNames.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.input.getAllInputNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.input.getAllInputNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.input.getAllInputNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.input.getAllInputNames();
```



* * *

<a id="api_tv_test_dot_input_dot_getCurrentInput"></a>

### getCurrentInput() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentInput.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.input.getCurrentInput();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.input.getCurrentInput();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.input.getCurrentInput();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.input.getCurrentInput();
```



* * *

<a id="api_tv_test_key"></a>

### api_tv_test.key
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_key"></a>

### key.key(keyName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.key.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.key.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.key.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.key.key('myKey');
```



* * *

<a id="api_tv_test_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_lifecycle"></a>

### api_tv_test.lifecycle
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_lifecycle_dot_callAll"></a>

### callAll(methodName, args, options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Scans the API surface for modules that implement the specified lifecycle method
> and calls them with consistent error handling and logging.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.lifecycle.callAll('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.lifecycle.callAll('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.lifecycle.callAll('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.lifecycle.callAll('myName');
```



* * *

<a id="api_tv_test_dot_lifecycle_dot_getModules"></a>

### getModules(methodName, exclude) ⇒ <code>Array.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Utility function to discover which modules implement a specific lifecycle method
> without actually calling them.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.lifecycle.getModules('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.lifecycle.getModules('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.lifecycle.getModules('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.lifecycle.getModules('myName');
```



* * *

<a id="api_tv_test_dot_lifecycle_dot_methods"></a>

### methods
> <p><strong style="font-size: 1.1em;"><p>Common lifecycle method names used across modules.</p></strong></p>
> 
**Kind**: static constant


* * *

<a id="api_tv_test_manufacturer"></a>

### api_tv_test.manufacturer
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_manufacturer_lg"></a>

### lg
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_app"></a>

### app
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_setApp"></a>

### setApp(appName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setApp.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| appName | <code>*</code> |  | <p>appName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.app.setApp('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.app.setApp('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.app.setApp('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.app.setApp('myName');
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_getCurrentApp"></a>

### getCurrentApp() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentApp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.app.getCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.app.getCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.app.getCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.app.getCurrentApp();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_getAllApps"></a>

### getAllApps() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllApps.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.app.getAllApps();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.app.getAllApps();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.app.getAllApps();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.app.getAllApps();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_app_dot_retrieveCurrentApp"></a>

### retrieveCurrentApp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentApp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.app.retrieveCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.app.retrieveCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.app.retrieveCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.app.retrieveCurrentApp();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_channel"></a>

### channel
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_setChannel"></a>

### setChannel(channel) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setChannel.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| channel | <code>*</code> |  | <p>channel.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.setChannel(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.setChannel(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.setChannel(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.setChannel(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.up();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.down();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_getCurrentChannel"></a>

### getCurrentChannel() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.channel.getCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.channel.getCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.channel.getCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.channel.getCurrentChannel();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_channel_dot_retrieveCurrentChannel"></a>

### retrieveCurrentChannel() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.retrieveCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.retrieveCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.channel.retrieveCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.channel.retrieveCurrentChannel();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_connect"></a>

### connect
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_connect"></a>

### connect.connect(host, options) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>connect.</p></strong></p>
> 
**Kind**: static method of [<code>connect.connect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_connect)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| host | <code>*</code> |  | <p>host.</p> |
| [options] | <code>*</code> |  | <p>options.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.connect.connect('192.168.1.1');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.connect.connect('192.168.1.1');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.connect.connect('192.168.1.1');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.connect.connect('192.168.1.1');
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_disconnect"></a>

### connect.connect.disconnect() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>disconnect.</p></strong></p>
> 
**Kind**: static method of [<code>connect.connect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_connect)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.connect.disconnect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.connect.disconnect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.connect.disconnect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.connect.disconnect();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_getConnection"></a>

### connect.connect.getConnection() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getConnection.</p></strong></p>
> 
**Kind**: static method of [<code>connect.connect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_connect)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.connect.getConnection();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.connect.getConnection();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.connect.getConnection();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.connect.getConnection();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_isConnectedToTV"></a>

### connect.connect.isConnectedToTV() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isConnectedToTV.</p></strong></p>
> 
**Kind**: static method of [<code>connect.connect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_connect)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.connect.isConnectedToTV();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.connect.isConnectedToTV();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.connect.isConnectedToTV();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.connect.isConnectedToTV();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_isReadyForCommands"></a>

### connect.connect.isReadyForCommands() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isReadyForCommands.</p></strong></p>
> 
**Kind**: static method of [<code>connect.connect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_connect)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.connect.isReadyForCommands();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.connect.isReadyForCommands();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.connect.isReadyForCommands();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.connect.isReadyForCommands();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_connect_dot_sendReceiveRawData"></a>

### connect.connect.sendReceiveRawData(data, timeout) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendReceiveRawData.</p></strong></p>
> 
**Kind**: static method of [<code>connect.connect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_connect)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>*</code> |  | <p>data.</p> |
| [timeout] | <code>*</code> |  | <p>timeout.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.connect.sendReceiveRawData(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.connect.sendReceiveRawData(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.connect.sendReceiveRawData(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.connect.sendReceiveRawData(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_disconnect"></a>

### disconnect
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_disconnect"></a>

### disconnect.disconnect() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>disconnect.</p></strong></p>
> 
**Kind**: static method of [<code>disconnect.disconnect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.disconnect.disconnect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.disconnect.disconnect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.disconnect.disconnect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.disconnect.disconnect();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_forceDisconnect"></a>

### disconnect.disconnect.forceDisconnect() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>forceDisconnect.</p></strong></p>
> 
**Kind**: static method of [<code>disconnect.disconnect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.disconnect.forceDisconnect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.disconnect.forceDisconnect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.disconnect.forceDisconnect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.disconnect.forceDisconnect();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_isConnected"></a>

### disconnect.disconnect.isConnected() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isConnected.</p></strong></p>
> 
**Kind**: static method of [<code>disconnect.disconnect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.disconnect.isConnected();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.disconnect.isConnected();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.disconnect.isConnected();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.disconnect.isConnected();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_isReady"></a>

### disconnect.disconnect.isReady() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isReady.</p></strong></p>
> 
**Kind**: static method of [<code>disconnect.disconnect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.disconnect.isReady();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.disconnect.isReady();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.disconnect.isReady();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.disconnect.isReady();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_disconnect_dot_getStatus"></a>

### disconnect.disconnect.getStatus() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getStatus.</p></strong></p>
> 
**Kind**: static method of [<code>disconnect.disconnect</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_disconnect)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.disconnect.getStatus();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.disconnect.getStatus();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.disconnect.getStatus();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.disconnect.getStatus();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_encryption"></a>

### encryption
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_deriveKey"></a>

### deriveKey(keycode) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>deriveKey.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keycode | <code>*</code> |  | <p>keycode.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.deriveKey('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.deriveKey('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.deriveKey('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.deriveKey('myKey');
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_generateRandomBytes"></a>

### generateRandomBytes(length) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>generateRandomBytes.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| length | <code>*</code> |  | <p>length.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.generateRandomBytes(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.generateRandomBytes(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.generateRandomBytes(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.generateRandomBytes(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_addPadding"></a>

### addPadding(message) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>addPadding.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>*</code> |  | <p>message.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.addPadding(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.addPadding(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.addPadding(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.addPadding(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_removePadding"></a>

### removePadding(message) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>removePadding.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>*</code> |  | <p>message.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.removePadding(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.removePadding(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.removePadding(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.removePadding(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_encrypt"></a>

### encrypt(message) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>encrypt.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>*</code> |  | <p>message.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.encrypt(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.encrypt(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.encrypt(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.encrypt(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_decrypt"></a>

### decrypt(encryptedData) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>decrypt.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| encryptedData | <code>*</code> |  | <p>encryptedData.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.decrypt(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.decrypt(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.decrypt(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.decrypt(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_encryption_dot_clearKeyCache"></a>

### clearKeyCache() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>clearKeyCache.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.clearKeyCache();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.clearKeyCache();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.encryption.clearKeyCache();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.encryption.clearKeyCache();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_getInfo"></a>

### getInfo
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo"></a>

### getInfo.getInfo() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getInfo.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.getInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.getInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.getInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.getInfo();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getPowerState"></a>

### getInfo.getInfo.getPowerState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getPowerState.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.getPowerState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.getPowerState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.getPowerState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.getPowerState();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getConnectionStatus"></a>

### getInfo.getInfo.getConnectionStatus() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getConnectionStatus.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.get-info.getConnectionStatus();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.get-info.getConnectionStatus();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.get-info.getConnectionStatus();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.get-info.getConnectionStatus();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getKeysInfo"></a>

### getInfo.getInfo.getKeysInfo() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeysInfo.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.get-info.getKeysInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.get-info.getKeysInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.get-info.getKeysInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.get-info.getKeysInfo();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_getStatus"></a>

### getInfo.getInfo.getStatus() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getStatus.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.getStatus();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.getStatus();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.getStatus();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.getStatus();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_retrieveInitialState"></a>

### getInfo.getInfo.retrieveInitialState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveInitialState.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.retrieveInitialState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.retrieveInitialState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.retrieveInitialState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.retrieveInitialState();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_retrieveCurrentChannel"></a>

### getInfo.getInfo.retrieveCurrentChannel() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentChannel.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.retrieveCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.retrieveCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.retrieveCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.retrieveCurrentChannel();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_retrieveCurrentApp"></a>

### getInfo.getInfo.retrieveCurrentApp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentApp.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.retrieveCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.retrieveCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.retrieveCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.retrieveCurrentApp();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_getInfo_dot_testResponsiveness"></a>

### getInfo.getInfo.testResponsiveness() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>testResponsiveness.</p></strong></p>
> 
**Kind**: static method of [<code>getInfo.getInfo</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_getInfo)

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.testResponsiveness();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.testResponsiveness();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.get-info.testResponsiveness();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.get-info.testResponsiveness();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_input"></a>

### input
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_input_dot_setInput"></a>

### setInput(inputName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setInput.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| inputName | <code>*</code> |  | <p>inputName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.input.setInput('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.input.setInput('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.input.setInput('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.input.setInput('myName');
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_input_dot_getAllInputNames"></a>

### getAllInputNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllInputNames.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.input.getAllInputNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.input.getAllInputNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.input.getAllInputNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.input.getAllInputNames();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_input_dot_getCurrentInput"></a>

### getCurrentInput() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentInput.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.input.getCurrentInput();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.input.getCurrentInput();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.input.getCurrentInput();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.input.getCurrentInput();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_key"></a>

### key
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_key"></a>

### key.key(keyName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.key('myKey');
```



* * *

<a id="api_tv_test_dot_key"></a>

### key.key(keyName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.key.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.key.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.key.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.key.key('myKey');
```



* * *

<a id="api_tv_test_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_sequence"></a>

### key.key.sequence(keyNames) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sequence.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyNames | <code>*</code> |  | <p>keyNames.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.sequence([]);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.sequence([]);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.sequence([]);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.sequence([]);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_navigation"></a>

### key.key.navigation(direction) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>navigation.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| direction | <code>*</code> |  | <p>direction.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.navigation(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.navigation(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.navigation(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.navigation(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_number"></a>

### key.key.number(number) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>number.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| number | <code>*</code> |  | <p>number.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.number(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.number(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.number(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.number(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_volume"></a>

### key.key.volume(action) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>volume.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| action | <code>*</code> |  | <p>action.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.volume(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.volume(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.volume(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.volume(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```



* * *

<a id="api_tv_test_dot_volume_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```



* * *

<a id="api_tv_test_dot_volume_dot_set"></a>

### set(level) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>set.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_mute"></a>

### mute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>mute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```



* * *

<a id="api_tv_test_dot_volume_dot_unmute"></a>

### unmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>unmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_toggleMute"></a>

### toggleMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>toggleMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoMute"></a>

### pseudoMute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoMute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoUnmute"></a>

### pseudoUnmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoUnmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_togglePseudoMute"></a>

### togglePseudoMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>togglePseudoMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_change"></a>

### change(delta) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>change.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| delta | <code>*</code> |  | <p>delta.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_getPseudoMuteState"></a>

### getPseudoMuteState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPseudoMuteState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```



* * *

<a id="api_tv_test_dot_volume_dot_getMaxVolume"></a>

### getMaxVolume() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getMaxVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_setMaxVolume"></a>

### setMaxVolume(level) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setMaxVolume.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentVolume"></a>

### retrieveCurrentVolume() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentMute"></a>

### retrieveCurrentMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyUp"></a>

### keyUp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyUp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyDown"></a>

### keyDown() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyDown.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_channel"></a>

### key.key.channel(action) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>channel.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| action | <code>*</code> |  | <p>action.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.channel(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.channel(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.channel(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.channel(null);
```



* * *

<a id="api_tv_test_dot_channel_dot_setChannel"></a>

### setChannel(channel) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setChannel.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| channel | <code>*</code> |  | <p>channel.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.setChannel(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.setChannel(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.setChannel(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.setChannel(null);
```



* * *

<a id="api_tv_test_dot_channel_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.up();
```



* * *

<a id="api_tv_test_dot_channel_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.down();
```



* * *

<a id="api_tv_test_dot_channel_dot_getCurrentChannel"></a>

### getCurrentChannel() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.channel.getCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.channel.getCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.channel.getCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.channel.getCurrentChannel();
```



* * *

<a id="api_tv_test_dot_channel_dot_retrieveCurrentChannel"></a>

### retrieveCurrentChannel() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.retrieveCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.retrieveCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.channel.retrieveCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.channel.retrieveCurrentChannel();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_key_dot_color"></a>

### key.key.color(color) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>color.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| color | <code>*</code> |  | <p>color.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.color(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.color(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.key.color(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.key.color(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_keys"></a>

### keys
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getKeyCode"></a>

### getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getKeyCommand"></a>

### getKeyCommand(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCommand.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_isValidKey"></a>

### isValidKey(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isValidKey.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.isValidKey(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.isValidKey(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.isValidKey(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.isValidKey(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getAllKeyNames"></a>

### getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getAllInputNames"></a>

### getAllInputNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllInputNames.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getAllInputNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getAllInputNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getAllInputNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getAllInputNames();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_getInputCode"></a>

### getInputCode(inputName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getInputCode.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| inputName | <code>*</code> |  | <p>inputName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getInputCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getInputCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.getInputCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.getInputCode(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_keys_dot_isValidInput"></a>

### isValidInput(inputName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isValidInput.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| inputName | <code>*</code> |  | <p>inputName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.isValidInput(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.isValidInput(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.keys.isValidInput(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.keys.isValidInput(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_power"></a>

### power
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_power_dot_on"></a>

### on() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>on.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.on();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.on();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.on();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.on();
```



* * *

<a id="api_tv_test_dot_power_dot_off"></a>

### off() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>off.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.off();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.off();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.off();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.off();
```



* * *

<a id="api_tv_test_dot_power_dot_toggle"></a>

### toggle() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>toggle.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.toggle();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.toggle();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.toggle();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.toggle();
```



* * *

<a id="api_tv_test_dot_power_dot_getState"></a>

### getState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.getState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.getState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.getState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.getState();
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_process"></a>

### process
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_process_dot_processInboundData"></a>

### processInboundData(data, meta) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>processInboundData.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>*</code> |  | <p>data.</p> |
| [meta] | <code>*</code> |  | <p>meta.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.process.processInboundData(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.process.processInboundData(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.manufacturer.lg.process.processInboundData(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.manufacturer.lg.process.processInboundData(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_sendCommand"></a>

### sendCommand
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand"></a>

### sendCommand.sendCommand(command, payload) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>*</code> |  | <p>command.</p> |
| payload | <code>*</code> |  | <p>payload.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendCommand(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendCommand(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendCommand(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendCommand(null, null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendUserCommand"></a>

### sendCommand.sendCommand.sendUserCommand(command, payload) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendUserCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>*</code> |  | <p>command.</p> |
| payload | <code>*</code> |  | <p>payload.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendUserCommand(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendUserCommand(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendUserCommand(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendUserCommand(null, null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendUpdateCommand"></a>

### sendCommand.sendCommand.sendUpdateCommand(command, payload) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendUpdateCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>*</code> |  | <p>command.</p> |
| payload | <code>*</code> |  | <p>payload.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendUpdateCommand(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendUpdateCommand(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendUpdateCommand(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendUpdateCommand(null, null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendWebOSCommand"></a>

### sendCommand.sendCommand.sendWebOSCommand(type, uri, payload, id) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendWebOSCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| type | <code>*</code> |  | <p>type.</p> |
| uri | <code>*</code> |  | <p>uri.</p> |
| [payload] | <code>*</code> |  | <p>payload.</p> |
| [id] | <code>*</code> |  | <p>id.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendWebOSCommand(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendWebOSCommand(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendWebOSCommand(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendWebOSCommand(null, null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendKeyCommand"></a>

### sendCommand.sendCommand.sendKeyCommand(keyCode) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendKeyCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyCode | <code>*</code> |  | <p>keyCode.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendKeyCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendKeyCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendKeyCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendKeyCommand(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendPowerCommand"></a>

### sendCommand.sendCommand.sendPowerCommand(on) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendPowerCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| on | <code>*</code> |  | <p>on.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendPowerCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendPowerCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendPowerCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendPowerCommand(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendVolumeCommand"></a>

### sendCommand.sendCommand.sendVolumeCommand(action, value) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendVolumeCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| action | <code>*</code> |  | <p>action.</p> |
| value | <code>*</code> |  | <p>value.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendVolumeCommand(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendVolumeCommand(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendVolumeCommand(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendVolumeCommand(null, null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendInputCommand"></a>

### sendCommand.sendCommand.sendInputCommand(input) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendInputCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| input | <code>*</code> |  | <p>input.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendInputCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendInputCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendInputCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendInputCommand(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendAppCommand"></a>

### sendCommand.sendCommand.sendAppCommand(appId) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendAppCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| appId | <code>*</code> |  | <p>appId.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendAppCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendAppCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendAppCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendAppCommand(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand_dot_sendChannelCommand"></a>

### sendCommand.sendCommand.sendChannelCommand(channel) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>sendChannelCommand.</p></strong></p>
> 
**Kind**: static method of [<code>sendCommand.sendCommand</code>](#api_tv_test_dot_manufacturer_dot_lg_dot_sendCommand)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| channel | <code>*</code> |  | <p>channel.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendChannelCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendChannelCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.manufacturer.lg.send-command.sendChannelCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.manufacturer.lg.send-command.sendChannelCommand(null);
```



* * *

<a id="api_tv_test_dot_manufacturer_dot_lg_volume"></a>

### volume
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_volume_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```



* * *

<a id="api_tv_test_dot_volume_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```



* * *

<a id="api_tv_test_dot_volume_dot_set"></a>

### set(level) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>set.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_mute"></a>

### mute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>mute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```



* * *

<a id="api_tv_test_dot_volume_dot_unmute"></a>

### unmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>unmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_toggleMute"></a>

### toggleMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>toggleMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoMute"></a>

### pseudoMute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoMute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoUnmute"></a>

### pseudoUnmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoUnmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_togglePseudoMute"></a>

### togglePseudoMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>togglePseudoMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_getPseudoMuteState"></a>

### getPseudoMuteState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPseudoMuteState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```



* * *

<a id="api_tv_test_dot_volume_dot_getMaxVolume"></a>

### getMaxVolume() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getMaxVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_setMaxVolume"></a>

### setMaxVolume(level) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setMaxVolume.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_change"></a>

### change(delta) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>change.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| delta | <code>*</code> |  | <p>delta.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentVolume"></a>

### retrieveCurrentVolume() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentMute"></a>

### retrieveCurrentMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyUp"></a>

### keyUp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyUp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyDown"></a>

### keyDown() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyDown.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```



* * *

<a id="api_tv_test_power"></a>

### api_tv_test.power
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_power_dot_on"></a>

### on() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>on.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.on();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.on();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.on();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.on();
```



* * *

<a id="api_tv_test_dot_power_dot_off"></a>

### off() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>off.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.off();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.off();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.off();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.off();
```



* * *

<a id="api_tv_test_dot_power_dot_toggle"></a>

### toggle() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>toggle.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.toggle();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.toggle();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.toggle();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.toggle();
```



* * *

<a id="api_tv_test_dot_power_dot_getState"></a>

### getState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.getState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.getState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.power.getState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.power.getState();
```



* * *

<a id="api_tv_test_proxyTest"></a>

### api_tv_test.proxyTest
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_proxyTest"></a>

### module.exports
> <p><strong style="font-size: 1.1em;"><p>Default export of LGTVControllers proxy for pure proxy testing.</p></strong></p>
> 
**Kind**: static property


* * *

<a id="api_tv_test_state"></a>

### api_tv_test.state
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_state_dot_cloneState"></a>

### cloneState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>cloneState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.cloneState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.cloneState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.cloneState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.cloneState();
```



* * *

<a id="api_tv_test_dot_state_dot_emitLog"></a>

### emitLog(level, message) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>emitLog.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |
| message | <code>*</code> |  | <p>message.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.emitLog(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.emitLog(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.emitLog(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.emitLog(null, null);
```



* * *

<a id="api_tv_test_dot_state_dot_getSnapshot"></a>

### getSnapshot() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getSnapshot.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.getSnapshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.getSnapshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.getSnapshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.getSnapshot();
```



* * *

<a id="api_tv_test_dot_state_dot_reset"></a>

### reset() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>reset.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.reset();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.reset();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.reset();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.reset();
```



* * *

<a id="api_tv_test_dot_state_dot_getMaxVolume"></a>

### getMaxVolume() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getMaxVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.getMaxVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.getMaxVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.getMaxVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.getMaxVolume();
```



* * *

<a id="api_tv_test_dot_state_dot_setMaxVolume"></a>

### setMaxVolume(level) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setMaxVolume.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.setMaxVolume(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.setMaxVolume(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.setMaxVolume(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.setMaxVolume(null);
```



* * *

<a id="api_tv_test_dot_state_dot_getPseudoMuteState"></a>

### getPseudoMuteState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPseudoMuteState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.getPseudoMuteState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.getPseudoMuteState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.getPseudoMuteState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.getPseudoMuteState();
```



* * *

<a id="api_tv_test_dot_state_dot_setPseudoMuteState"></a>

### setPseudoMuteState(pseudoMuted, savedVolume) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setPseudoMuteState.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| pseudoMuted | <code>*</code> |  | <p>pseudoMuted.</p> |
| [savedVolume] | <code>*</code> |  | <p>savedVolume.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.setPseudoMuteState(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.setPseudoMuteState(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.setPseudoMuteState(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.setPseudoMuteState(null);
```



* * *

<a id="api_tv_test_dot_state_dot_initializeVolumeState"></a>

### initializeVolumeState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>initializeVolumeState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.initializeVolumeState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.initializeVolumeState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.initializeVolumeState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.initializeVolumeState();
```



* * *

<a id="api_tv_test_dot_state_dot_recordUserCommand"></a>

### recordUserCommand(partial) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>recordUserCommand.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [partial] | <code>*</code> |  | <p>partial.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.recordUserCommand();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.recordUserCommand();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.recordUserCommand();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.recordUserCommand();
```



* * *

<a id="api_tv_test_dot_state_dot_recordUpdateCommand"></a>

### recordUpdateCommand(partial) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>recordUpdateCommand.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [partial] | <code>*</code> |  | <p>partial.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.recordUpdateCommand();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.recordUpdateCommand();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.recordUpdateCommand();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.recordUpdateCommand();
```



* * *

<a id="api_tv_test_dot_state_dot_shutdown"></a>

### shutdown() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>shutdown.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.shutdown();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.shutdown();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.shutdown();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.shutdown();
```



* * *

<a id="api_tv_test_dot_state_dot_update"></a>

### update(partial) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>update.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [partial] | <code>*</code> |  | <p>partial.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.update();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.update();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.update();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.update();
```



* * *

<a id="api_tv_test_dot_state_dot_processInboundData"></a>

### processInboundData(data) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>processInboundData.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>*</code> |  | <p>data.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.processInboundData(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.processInboundData(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.state.processInboundData(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.state.processInboundData(null);
```



* * *

<a id="api_tv_test_subfolder"></a>

### api_tv_test.subfolder
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_subfolder_app"></a>

### app
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_dot_app_dot_setApp"></a>

### setApp(appName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setApp.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| appName | <code>*</code> |  | <p>appName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.app.setApp('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.app.setApp('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.app.setApp('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.app.setApp('myName');
```



* * *

<a id="api_tv_test_dot_subfolder_dot_app_dot_getCurrentApp"></a>

### getCurrentApp() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentApp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.app.getCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.app.getCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.app.getCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.app.getCurrentApp();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_app_dot_getAllApps"></a>

### getAllApps() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllApps.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.app.getAllApps();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.app.getAllApps();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.app.getAllApps();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.app.getAllApps();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_app_dot_retrieveCurrentApp"></a>

### retrieveCurrentApp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentApp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.app.retrieveCurrentApp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.app.retrieveCurrentApp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.app.retrieveCurrentApp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.app.retrieveCurrentApp();
```



* * *

<a id="api_tv_test_dot_subfolder_channel"></a>

### channel
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_dot_channel_dot_setChannel"></a>

### setChannel(channel) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setChannel.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| channel | <code>*</code> |  | <p>channel.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.setChannel(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.setChannel(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.setChannel(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.setChannel(null);
```



* * *

<a id="api_tv_test_dot_subfolder_dot_channel_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.up();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_channel_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.down();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_channel_dot_getCurrentChannel"></a>

### getCurrentChannel() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.channel.getCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.channel.getCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.channel.getCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.channel.getCurrentChannel();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_channel_dot_retrieveCurrentChannel"></a>

### retrieveCurrentChannel() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentChannel.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.retrieveCurrentChannel();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.retrieveCurrentChannel();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.channel.retrieveCurrentChannel();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.channel.retrieveCurrentChannel();
```



* * *

<a id="api_tv_test_dot_subfolder_config"></a>

### config
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_connection"></a>

### connection
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_dot_connection_dot_connect"></a>

### connect(host) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>connect.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| host | <code>*</code> |  | <p>host.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.connection.connect('192.168.1.1');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.connection.connect('192.168.1.1');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.connection.connect('192.168.1.1');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.connection.connect('192.168.1.1');
```



* * *

<a id="api_tv_test_dot_subfolder_dot_connection_dot_disconnect"></a>

### disconnect() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>disconnect.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.connection.disconnect();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.connection.disconnect();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.connection.disconnect();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.connection.disconnect();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_connection_dot_isConnected"></a>

### isConnected() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isConnected.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.connection.isConnected();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.connection.isConnected();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.connection.isConnected();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.connection.isConnected();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_connection_dot_getConnectionInfo"></a>

### getConnectionInfo() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getConnectionInfo.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.connection.getConnectionInfo();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.connection.getConnectionInfo();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.connection.getConnectionInfo();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.connection.getConnectionInfo();
```



* * *

<a id="api_tv_test_dot_subfolder_input"></a>

### input
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_dot_input_dot_setInput"></a>

### setInput(inputName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>setInput.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| inputName | <code>*</code> |  | <p>inputName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.input.setInput('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.input.setInput('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.input.setInput('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.input.setInput('myName');
```



* * *

<a id="api_tv_test_dot_subfolder_dot_input_dot_getAllInputNames"></a>

### getAllInputNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllInputNames.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.input.getAllInputNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.input.getAllInputNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.input.getAllInputNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.input.getAllInputNames();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_input_dot_getCurrentInput"></a>

### getCurrentInput() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getCurrentInput.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.input.getCurrentInput();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.input.getCurrentInput();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.input.getCurrentInput();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.input.getCurrentInput();
```



* * *

<a id="api_tv_test_dot_subfolder_key"></a>

### key
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_dot_key"></a>

### key.key(keyName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_subfolder_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.key.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.key.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.key.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.key.key('myKey');
```



* * *

<a id="api_tv_test_dot_key"></a>

### key.key(keyName) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>key.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.key.key('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.key.key('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.key.key('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.key.key('myKey');
```



* * *

<a id="api_tv_test_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_subfolder_dot_key_dot_getAllKeyNames"></a>

### key.key.getAllKeyNames() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getAllKeyNames.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_subfolder_dot_key)

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.key.getAllKeyNames();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.key.getAllKeyNames();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.key.getAllKeyNames();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.key.getAllKeyNames();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_key_dot_getKeyCode"></a>

### key.key.getKeyCode(keyName) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getKeyCode.</p></strong></p>
> 
**Kind**: static method of [<code>key.key</code>](#api_tv_test_dot_subfolder_dot_key)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| keyName | <code>*</code> |  | <p>keyName.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.key.getKeyCode(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.key.getKeyCode(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.key.getKeyCode(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.key.getKeyCode(null);
```



* * *

<a id="api_tv_test_dot_subfolder_power"></a>

### power
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_dot_power_dot_on"></a>

### on() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>on.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.on();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.on();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.on();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.on();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_power_dot_off"></a>

### off() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>off.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.off();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.off();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.off();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.off();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_power_dot_toggle"></a>

### toggle() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>toggle.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.toggle();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.toggle();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.toggle();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.toggle();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_power_dot_getState"></a>

### getState() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>getState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.getState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.getState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.subfolder.power.getState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.subfolder.power.getState();
```



* * *

<a id="api_tv_test_dot_subfolder_state"></a>

### state
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_cloneState"></a>

### cloneState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>cloneState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.cloneState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.cloneState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.cloneState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.cloneState();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_emitLog"></a>

### emitLog(level, message) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>emitLog.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |
| message | <code>*</code> |  | <p>message.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.emitLog(null, null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.emitLog(null, null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.emitLog(null, null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.emitLog(null, null);
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_getSnapshot"></a>

### getSnapshot() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getSnapshot.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.getSnapshot();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.getSnapshot();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.getSnapshot();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.getSnapshot();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_reset"></a>

### reset() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>reset.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.reset();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.reset();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.reset();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.reset();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_getMaxVolume"></a>

### getMaxVolume() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getMaxVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.getMaxVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.getMaxVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.getMaxVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.getMaxVolume();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_setMaxVolume"></a>

### setMaxVolume(level) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setMaxVolume.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.setMaxVolume(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.setMaxVolume(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.setMaxVolume(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.setMaxVolume(null);
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_getPseudoMuteState"></a>

### getPseudoMuteState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPseudoMuteState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.getPseudoMuteState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.getPseudoMuteState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.getPseudoMuteState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.getPseudoMuteState();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_setPseudoMuteState"></a>

### setPseudoMuteState(pseudoMuted, savedVolume) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setPseudoMuteState.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| pseudoMuted | <code>*</code> |  | <p>pseudoMuted.</p> |
| [savedVolume] | <code>*</code> |  | <p>savedVolume.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.setPseudoMuteState(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.setPseudoMuteState(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.setPseudoMuteState(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.setPseudoMuteState(null);
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_initializeVolumeState"></a>

### initializeVolumeState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>initializeVolumeState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.initializeVolumeState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.initializeVolumeState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.initializeVolumeState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.initializeVolumeState();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_recordUserCommand"></a>

### recordUserCommand(partial) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>recordUserCommand.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [partial] | <code>*</code> |  | <p>partial.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.recordUserCommand();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.recordUserCommand();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.recordUserCommand();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.recordUserCommand();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_recordUpdateCommand"></a>

### recordUpdateCommand(partial) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>recordUpdateCommand.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [partial] | <code>*</code> |  | <p>partial.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.recordUpdateCommand();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.recordUpdateCommand();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.recordUpdateCommand();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.recordUpdateCommand();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_shutdown"></a>

### shutdown() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>shutdown.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.shutdown();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.shutdown();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.shutdown();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.shutdown();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_update"></a>

### update(partial) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>update.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [partial] | <code>*</code> |  | <p>partial.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.update();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.update();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.update();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.update();
```



* * *

<a id="api_tv_test_dot_subfolder_dot_state_dot_processInboundData"></a>

### processInboundData(data) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>processInboundData.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>*</code> |  | <p>data.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.processInboundData(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.processInboundData(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.subfolder.state.processInboundData(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.subfolder.state.processInboundData(null);
```



* * *

<a id="api_tv_test_dot_subfolder_volume"></a>

### volume
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_volume_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```



* * *

<a id="api_tv_test_dot_volume_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```



* * *

<a id="api_tv_test_dot_volume_dot_set"></a>

### set(level) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>set.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_mute"></a>

### mute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>mute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```



* * *

<a id="api_tv_test_dot_volume_dot_unmute"></a>

### unmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>unmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_toggleMute"></a>

### toggleMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>toggleMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoMute"></a>

### pseudoMute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoMute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoUnmute"></a>

### pseudoUnmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoUnmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_togglePseudoMute"></a>

### togglePseudoMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>togglePseudoMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_change"></a>

### change(delta) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>change.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| delta | <code>*</code> |  | <p>delta.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_getPseudoMuteState"></a>

### getPseudoMuteState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPseudoMuteState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```



* * *

<a id="api_tv_test_dot_volume_dot_getMaxVolume"></a>

### getMaxVolume() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getMaxVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_setMaxVolume"></a>

### setMaxVolume(level) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setMaxVolume.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentVolume"></a>

### retrieveCurrentVolume() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentMute"></a>

### retrieveCurrentMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyUp"></a>

### keyUp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyUp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyDown"></a>

### keyDown() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyDown.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```



* * *

<a id="api_tv_test_utilities"></a>

### api_tv_test.utilities
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_utilities_commandQueue"></a>

### commandQueue
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_addUserCommand"></a>

### addUserCommand(commandFunction) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>addUserCommand.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| commandFunction | <code>*</code> |  | <p>commandFunction.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.command-queue.addUserCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.command-queue.addUserCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.command-queue.addUserCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.command-queue.addUserCommand(null);
```



* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_addUpdateCommand"></a>

### addUpdateCommand(commandFunction) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>addUpdateCommand.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| commandFunction | <code>*</code> |  | <p>commandFunction.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.command-queue.addUpdateCommand(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.command-queue.addUpdateCommand(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.command-queue.addUpdateCommand(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.command-queue.addUpdateCommand(null);
```



* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_queueUpdateCommands"></a>

### queueUpdateCommands(updateCommands) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>queueUpdateCommands.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| updateCommands | <code>*</code> |  | <p>updateCommands.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.command-queue.queueUpdateCommands([]);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.command-queue.queueUpdateCommands([]);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.command-queue.queueUpdateCommands([]);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.command-queue.queueUpdateCommands([]);
```



* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_getPendingUserCommandCount"></a>

### getPendingUserCommandCount() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPendingUserCommandCount.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.getPendingUserCommandCount();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.getPendingUserCommandCount();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.getPendingUserCommandCount();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.getPendingUserCommandCount();
```



* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_getPendingUpdateCommandCount"></a>

### getPendingUpdateCommandCount() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPendingUpdateCommandCount.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.getPendingUpdateCommandCount();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.getPendingUpdateCommandCount();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.getPendingUpdateCommandCount();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.getPendingUpdateCommandCount();
```



* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_isUpdateCommandPending"></a>

### isUpdateCommandPending() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isUpdateCommandPending.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.isUpdateCommandPending();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.isUpdateCommandPending();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.isUpdateCommandPending();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.isUpdateCommandPending();
```



* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_clearPendingUpdateCommands"></a>

### clearPendingUpdateCommands() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>clearPendingUpdateCommands.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.clearPendingUpdateCommands();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.clearPendingUpdateCommands();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.clearPendingUpdateCommands();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.clearPendingUpdateCommands();
```



* * *

<a id="api_tv_test_dot_utilities_dot_commandQueue_dot_getQueueStats"></a>

### getQueueStats() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getQueueStats.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.getQueueStats();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.getQueueStats();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.command-queue.getQueueStats();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.command-queue.getQueueStats();
```



* * *

<a id="api_tv_test_dot_utilities_failOperation"></a>

### failOperation
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_utilities_dot_failOperation"></a>

### failOperation.failOperation(message) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>failOperation.</p></strong></p>
> 
**Kind**: static method of [<code>failOperation.failOperation</code>](#api_tv_test_dot_utilities_dot_failOperation)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>*</code> |  | <p>message.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.fail-operation.failOperation('hello');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.fail-operation.failOperation('hello');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.fail-operation.failOperation('hello');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.fail-operation.failOperation('hello');
```



* * *

<a id="api_tv_test_dot_utilities_wakeOnLan"></a>

### wakeOnLan
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_utilities_dot_wakeOnLan_dot_wake"></a>

### wake(macAddress) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>wake.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| macAddress | <code>*</code> |  | <p>macAddress.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.wake-on-lan.wake(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.wake-on-lan.wake(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utilities.wake-on-lan.wake(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utilities.wake-on-lan.wake(null);
```



* * *

<a id="api_tv_test_dot_utilities_dot_wakeOnLan_dot_isValidMacAddress"></a>

### isValidMacAddress(macAddress) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>isValidMacAddress.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| macAddress | <code>*</code> |  | <p>macAddress.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.wake-on-lan.isValidMacAddress([]);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.wake-on-lan.isValidMacAddress([]);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.wake-on-lan.isValidMacAddress([]);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.wake-on-lan.isValidMacAddress([]);
```



* * *

<a id="api_tv_test_dot_utilities_dot_wakeOnLan_dot_normalizeMacAddress"></a>

### normalizeMacAddress(macAddress) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>normalizeMacAddress.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| macAddress | <code>*</code> |  | <p>macAddress.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.wake-on-lan.normalizeMacAddress([]);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.wake-on-lan.normalizeMacAddress([]);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utilities.wake-on-lan.normalizeMacAddress([]);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utilities.wake-on-lan.normalizeMacAddress([]);
```



* * *

<a id="api_tv_test_utils"></a>

### api_tv_test.utils
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_utils_defaults"></a>

### defaults
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_getDefaults"></a>

### getDefaults(dataSystemName) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets defaults for a specific data system.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system (config, device, etc.)</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Defaults for the data system</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.getDefaults('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.getDefaults('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.getDefaults('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.getDefaults('myName');
```



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_getAllDefaults"></a>

### getAllDefaults() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Gets all defaults organized by data system.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>All defaults</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.getAllDefaults();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.getAllDefaults();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.getAllDefaults();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.getAllDefaults();
```



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_reloadDefaults"></a>

### reloadDefaults() ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Reloads defaults from files (clears cache).</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Reloaded defaults</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.reloadDefaults();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.reloadDefaults();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.reloadDefaults();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.reloadDefaults();
```



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_createDefaultsAPI"></a>

### createDefaultsAPI(dataSystemName, getCurrentValues, setValues) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Creates a defaults API object for a specific data system.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dataSystemName | <code>string</code> |  | <p>Name of the data system</p> |
| getCurrentValues | <code>function</code> |  | <p>Function to get current values from the system</p> |
| setValues | <code>function</code> |  | <p>Function to set values in the system</p> |


**Returns**:

- <code>Promise.&lt;Object&gt;</code> <p>Defaults API for the data system</p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.defaults.createDefaultsAPI('myName', () => {}, () => {});
```



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_restore"></a>

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
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.restore([]);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.restore([]);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.restore([]);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.restore([]);
```



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_isDefault"></a>

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
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.isDefault('myKey');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.isDefault('myKey');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.isDefault('myKey');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.isDefault('myKey');
```



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_customized"></a>

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
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.customized();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.customized();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.customized();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.customized();
```



* * *

<a id="api_tv_test_dot_utils_dot_defaults_dot_resetAll"></a>

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
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.resetAll();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.resetAll();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.defaults.resetAll();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.defaults.resetAll();
```



* * *

<a id="api_tv_test_dot_utils_lifecycle"></a>

### lifecycle
> 
**Kind**: inner namespace


* * *

<a id="api_tv_test_dot_utils_dot_lifecycle_dot_callAll"></a>

### callAll(methodName, args, options) ⇒ <code>Promise.&lt;Object&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Scans the API surface for modules that implement the specified lifecycle method
> and calls them with consistent error handling and logging.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.lifecycle.callAll('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.lifecycle.callAll('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.utils.lifecycle.callAll('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.utils.lifecycle.callAll('myName');
```



* * *

<a id="api_tv_test_dot_utils_dot_lifecycle_dot_getModules"></a>

### getModules(methodName, exclude) ⇒ <code>Array.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Utility function to discover which modules implement a specific lifecycle method
> without actually calling them.</p></strong></p>
> 
**Kind**: static method


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
**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.lifecycle.getModules('myName');
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.lifecycle.getModules('myName');
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.utils.lifecycle.getModules('myName');
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.utils.lifecycle.getModules('myName');
```



* * *

<a id="api_tv_test_dot_utils_dot_lifecycle_dot_methods"></a>

### methods
> <p><strong style="font-size: 1.1em;"><p>Common lifecycle method names used across modules.</p></strong></p>
> 
**Kind**: static constant


* * *

<a id="api_tv_test_volume"></a>

### api_tv_test.volume
> 
**Kind**: inner namespace of [<code>api_tv_test</code>](#api_tv_test)


* * *

<a id="api_tv_test_dot_volume_dot_up"></a>

### up() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>up.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.up();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.up();
```



* * *

<a id="api_tv_test_dot_volume_dot_down"></a>

### down() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>down.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.down();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.down();
```



* * *

<a id="api_tv_test_dot_volume_dot_set"></a>

### set(level) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>set.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.set(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.set(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_mute"></a>

### mute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>mute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.mute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.mute();
```



* * *

<a id="api_tv_test_dot_volume_dot_unmute"></a>

### unmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>unmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.unmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.unmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_toggleMute"></a>

### toggleMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>toggleMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.toggleMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.toggleMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoMute"></a>

### pseudoMute(mute) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoMute.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [mute] | <code>*</code> |  | <p>mute.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_pseudoUnmute"></a>

### pseudoUnmute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>pseudoUnmute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.pseudoUnmute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.pseudoUnmute();
```



* * *

<a id="api_tv_test_dot_volume_dot_togglePseudoMute"></a>

### togglePseudoMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>togglePseudoMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.togglePseudoMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.togglePseudoMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_change"></a>

### change(delta) ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>change.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| delta | <code>*</code> |  | <p>delta.</p> |


**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.change(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.change(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_getPseudoMuteState"></a>

### getPseudoMuteState() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getPseudoMuteState.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getPseudoMuteState();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getPseudoMuteState();
```



* * *

<a id="api_tv_test_dot_volume_dot_getMaxVolume"></a>

### getMaxVolume() ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>getMaxVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.getMaxVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.getMaxVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_setMaxVolume"></a>

### setMaxVolume(level) ⇒ <code>*</code>
> <p><strong style="font-size: 1.1em;"><p>setMaxVolume.</p></strong></p>
> 
**Kind**: static method


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| level | <code>*</code> |  | <p>level.</p> |


**Returns**:

- <code>*</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  api_tv_test.volume.setMaxVolume(null);
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
api_tv_test.volume.setMaxVolume(null);
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentVolume"></a>

### retrieveCurrentVolume() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentVolume.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentVolume();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentVolume();
```



* * *

<a id="api_tv_test_dot_volume_dot_retrieveCurrentMute"></a>

### retrieveCurrentMute() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>retrieveCurrentMute.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.retrieveCurrentMute();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.retrieveCurrentMute();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyUp"></a>

### keyUp() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyUp.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyUp();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyUp();
```



* * *

<a id="api_tv_test_dot_volume_dot_keyDown"></a>

### keyDown() ⇒ <code>Promise.&lt;*&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>keyDown.</p></strong></p>
> 
**Kind**: static method

**Returns**:

- <code>Promise.&lt;*&gt;</code> <p></p>


**Example**
```js
// ESM usage via slothlet API
import slothlet from "@cldmv/slothlet";
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```
**Example**
```js
// ESM usage via slothlet API (inside async function)
async function example() {
  const { default: slothlet } = await import("@cldmv/slothlet");
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
}
```
**Example**
```js
// CJS usage via slothlet API (top-level)
let slothlet;
(async () => {
  ({ slothlet } = await import("@cldmv/slothlet"));
  const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
  await api_tv_test.volume.keyDown();
})();
```
**Example**
```js
// CJS usage via slothlet API (inside async function)
const slothlet = require("@cldmv/slothlet");
const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
await api_tv_test.volume.keyDown();
```






