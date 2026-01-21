/**
 * @fileoverview Simplified LG TV send-command functionality for testing.
 */

export async function sendCommand(command, payload, _ = {}) {
	return { success: true, command: command, payload: payload };
}

export async function sendUserCommand(command, payload, _ = {}) {
	return { success: true, type: "user", command: command, payload: payload };
}

export async function sendUpdateCommand(command, payload, _ = {}) {
	return { success: true, type: "update", command: command, payload: payload };
}

export async function sendWebOSCommand(type, uri, payload = {}, id = null, _ = {}) {
	return { success: true, type: type, uri: uri, payload: payload, id: id };
}

export async function sendKeyCommand(keyCode, _ = {}) {
	return { success: true, type: "key", keyCode: keyCode };
}

export async function sendPowerCommand(on, _ = {}) {
	return { success: true, type: "power", on: on };
}

export async function sendVolumeCommand(action, value, _ = {}) {
	return { success: true, type: "volume", action: action, value: value };
}

export async function sendInputCommand(input, _ = {}) {
	return { success: true, type: "input", input: input };
}

export async function sendAppCommand(appId, _ = {}) {
	return { success: true, type: "app", appId: appId };
}

export async function sendChannelCommand(channel, _ = {}) {
	return { success: true, type: "channel", channel: channel };
}

export default sendCommand;