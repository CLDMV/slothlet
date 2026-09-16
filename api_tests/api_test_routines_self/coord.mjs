/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_self/coord.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coordinator leaf a routine contributor reaches through AMBIENT `self.coord.*`
 * (the shape rummage#61's `initialize` and the driver `activate` use). Records into a global so a
 * test can assert the contributor's `self.*` actually resolved — the point of #393. `register` never
 * runs unless the caller's extent is active, so an entry in the log proves the extent was live.
 * @module api_test_routines_self.coord
 * @memberof module:api_test_routines_self
 */

/**
 * @function register
 * @memberof module:api_test_routines_self
 * @param {string} tag - Marker identifying the contributor that reached this coordinator.
 * @returns {void}
 */
export function register(tag) {
	(globalThis.__slothletSelfLog ??= []).push(tag);
}

/**
 * @function getRegistered
 * @memberof module:api_test_routines_self
 * @returns {string[]} A copy of every tag registered so far.
 */
export function getRegistered() {
	return [...(globalThis.__slothletSelfLog ??= [])];
}
