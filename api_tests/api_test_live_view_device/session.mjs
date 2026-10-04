/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_view_device/session.mjs
 *	@Date: 2026-09-28T06:11:59-07:00 (1790601119)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:49 -07:00 (1791082969)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live-view write fixture for an `api.slothlet.api.add()`-mounted leaf (#495).
 * Mounted with `api.slothlet.api.add("devices.d1", …)`, so it is reachable as
 * `api.devices.d1.session.*`. `open` publishes a module-held connection object at
 * `self.devices.d1.connection` (the droidsock `device.connection` pattern); `features` and
 * `dispatchRaw` read the module's own private reference, never the view.
 * @module api_test_live_view_device.session
 * @memberof module:api_test_live_view_device
 */

import { self } from "@cldmv/slothlet/runtime";

/** @type {object|null} The module's private reference to the published connection. */
let connection = null;

/**
 * Opens a connection object, keeps a private reference, and publishes it on the mounted leaf.
 * @returns {object} The raw connection object.
 * @example
 * const conn = await api.devices.d1.session.open();
 * api.devices.d1.connection.deviceFeatures = ["cmd"];
 * conn.deviceFeatures; // ["cmd"]
 */
export function open() {
	connection = {
		n: 1,
		deviceFeatures: [],
		nested: { inner: {} },
		onUnhandledPacket: null,
		/**
		 * Invokes the currently assigned `onUnhandledPacket` handler with `this` bound to the real object.
		 * @param {string} packet - Packet payload.
		 * @returns {unknown} The handler's result, or `"unhandled"` when none is set.
		 */
		dispatch(packet) {
			return typeof this.onUnhandledPacket === "function" ? this.onUnhandledPacket(packet) : "unhandled";
		}
	};
	self.devices.d1.connection = connection;
	return connection;
}

/**
 * Reads `deviceFeatures` from the module's own private connection reference.
 * @returns {unknown} The current value of `connection.deviceFeatures`.
 */
export function features() {
	return connection.deviceFeatures;
}

/**
 * Invokes `dispatch` on the module's own private connection reference.
 * @param {string} packet - Packet payload.
 * @returns {unknown} The handler's result.
 */
export function dispatchRaw(packet) {
	return connection.dispatch(packet);
}

/**
 * Writes `deviceFeatures` through the view from inside the owning module.
 * @param {unknown} value - Value to assign.
 * @returns {unknown} The value read back through the view.
 */
export function setFeaturesViaSelf(value) {
	self.devices.d1.connection.deviceFeatures = value;
	return self.devices.d1.connection.deviceFeatures;
}
