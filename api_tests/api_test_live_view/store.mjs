/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_view/store.mjs
 *	@Date: 2026-09-28T06:11:59-07:00 (1790601119)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:38-07:00 (1791090878)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live-view write fixture (#495). Exposed as `self.store.*`. `assign` grafts a
 * module-held object onto `self.store.x` via wrap-on-set; `features` and `dispatchRaw` read the
 * module's own private reference (never the view), so a test can assert that an object- or
 * function-valued write made THROUGH the view actually landed on the underlying object.
 * @module api_test_live_view.store
 * @memberof module:api_test_live_view
 */

import { self } from "@cldmv/slothlet/runtime";

/** @type {object|null} The module's private reference to the object it published. */
let held = null;

/**
 * Builds the shared live-view test shape.
 * @returns {object} A fresh connection-like object.
 */
function buildShape() {
	return {
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
}

/**
 * Builds a fresh object, keeps a private reference to it, and publishes it at `self.store.x`.
 * @returns {object} The raw object that was assigned.
 * @example
 * const held = await api.store.assign();
 * api.store.x.deviceFeatures = ["cmd"];
 * held.deviceFeatures; // ["cmd"]
 */
export function assign() {
	held = buildShape();
	self.store.x = held;
	return held;
}

/**
 * Reads `deviceFeatures` from the module's own private reference.
 * @returns {unknown} The current value of `held.deviceFeatures`.
 */
export function features() {
	return held.deviceFeatures;
}

/**
 * Invokes `dispatch` on the module's own private reference.
 * @param {string} packet - Packet payload.
 * @returns {unknown} The handler's result.
 */
export function dispatchRaw(packet) {
	return held.dispatch(packet);
}

/**
 * Writes `deviceFeatures` through the view from inside the owning module.
 * @param {unknown} value - Value to assign.
 * @returns {unknown} The value read back through the view.
 */
export function setFeaturesViaSelf(value) {
	self.store.x.deviceFeatures = value;
	return self.store.x.deviceFeatures;
}

/**
 * Reads `self.store.x.nested.inner.c.a` through the view from inside the owning module.
 * @returns {unknown} The value served through the view.
 */
export function peek() {
	return self.store.x.nested.inner.c.a;
}
