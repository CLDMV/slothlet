/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwa_made/api/settings.mjs
 *	@Date: 2026-11-25T01:51:37-08:00 (1795600297)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:00-08:00 (1795869000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that changes its own exported object after it loaded (#757): adds and replaces members with
 * accessors, and deletes members.
 */

/** The module's settings object. */
export const config = { port: 80, host: "local", nested: { n: 1 } };

/**
 * Add an accessor member to the object.
 * @returns {void}
 * @example
 * addAccessor();
 */
export function addAccessor() {
	Object.defineProperty(config, "live", {
		get() {
			return "live";
		},
		enumerable: true,
		configurable: true
	});
}

/**
 * Replace a data member with an accessor.
 * @returns {void}
 * @example
 * portToAccessor();
 */
export function portToAccessor() {
	Object.defineProperty(config, "port", {
		get() {
			return 91;
		},
		enumerable: true,
		configurable: true
	});
}

/**
 * Delete members of the object.
 * @returns {void}
 * @example
 * drop();
 */
export function drop() {
	delete config.host;
	delete config.nested;
}

/**
 * Replace the nested object.
 * @returns {void}
 * @example
 * replaceNested();
 */
export function replaceNested() {
	config.nested = { n: 2 };
}
