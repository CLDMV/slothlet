/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/manufacturer/lg/send-command.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:18 -08:00 (1772425278)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Command sending API module for LG TV manufacturer testing.
 * @module api_tv_test.manufacturer.lg.sendCommand
 * @memberof module:api_tv_test
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
