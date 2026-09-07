/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/mod.mjs
 *	@Date: 2026-09-07T00:00:49-07:00 (1788764449)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-07 08:25:33 -07:00 (1788794733)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Wrap-on-set live-delegation fixture (#340). Exposed as `self.mod.*`.
 * `assignX` grafts a plain object onto `self.mod.x` at runtime; `readXY` reads it back
 * through the wrapper so a caller-identity test can assert permission gating on the
 * live-delegated path. `assignDriver`/`driverDoWork` cover an EventEmitter-derived
 * instance grafted the same way, proving it still gets working `self`-context access.
 * @module api_test_permissions.mod
 * @memberof module:api_test_permissions
 */

import { EventEmitter } from "node:events";
import { self } from "@cldmv/slothlet/runtime";

/**
 * A trivial EventEmitter subclass used to prove wrap-on-set no longer excludes
 * EventEmitter-derived instances from `self`-context access (#340, formerly #339).
 * @class SimpleDriver
 * @memberof module:api_test_permissions.mod
 */
export class SimpleDriver extends EventEmitter {
	constructor() {
		super();
		this.label = "simple-driver";
	}

	/**
	 * Calls back into `self` from an instance method — only possible if this
	 * instance actually received context-binding treatment when wrapped.
	 * @returns {string} The label from `self.mod.driverLabel()`, reached via `self`.
	 * @example
	 * const driver = new SimpleDriver();
	 * driver.doWork(); // "mod-label" (only inside a slothlet-bound call)
	 */
	doWork() {
		return self.mod.driverLabel();
	}
}

/**
 * Grafts a plain object onto `self.mod.x` at runtime.
 * @returns {object} The raw object that was assigned (retained by the caller for
 *   external mutation in the test).
 * @example
 * const obj = await api.mod.assignX();
 * obj.y = 2;
 */
export function assignX() {
	const obj = { y: 1, nested: { z: 1 } };
	self.mod.x = obj;
	return obj;
}

/**
 * Reads `self.mod.x.y` from inside the module — the read-gated path a permission
 * rule targets.
 * @returns {number} The current value of `x.y`.
 */
export function readXY() {
	return self.mod.x.y;
}

/**
 * Reads `self.mod.x.nested.z` — two levels of nesting under the same wrap-on-set root.
 * @returns {number} The current value of `x.nested.z`.
 */
export function readNestedZ() {
	return self.mod.x.nested.z;
}

/**
 * Returns this module's own label — a plain `self` access, used as the target of
 * `SimpleDriver#doWork` so it proves the driver instance actually resolves `self`.
 * @returns {string} A constant label.
 */
export function driverLabel() {
	return "mod-label";
}

/**
 * Grafts a `SimpleDriver` instance onto `self.mod.driver`.
 * @returns {SimpleDriver} The raw driver instance retained by the caller.
 */
export function assignDriver() {
	const driver = new SimpleDriver();
	self.mod.driver = driver;
	return driver;
}

/**
 * Calls `self.mod.driver.doWork()` through the wrapper.
 * @returns {Promise<string>} The driver's own label, proving `self` resolved inside
 *   its instance method.
 */
export async function driverDoWork() {
	return self.mod.driver.doWork();
}
