/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_module_object/owner/owner.mjs
 *	@Date: 2026-11-13T10:00:00-08:00 (1794592800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T10:00:00-08:00 (1794592800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose data object other modules try to close and give a prototype through the api.
 * @module api_test_api_node_module_object/owner
 */

/**
 * The owner's data object.
 * @type {{port: number, nested: {a: number}}}
 */
export const config = { port: 80, nested: { a: 1 } };

/**
 * What the owner's own object is, as the owner reads it.
 * @returns {{frozen: boolean, sealed: boolean, extensible: boolean, nestedExtensible: boolean, plainPrototype: boolean, ownProto: boolean}} Its integrity, the
 *   nested object's, whether its prototype is still `Object.prototype`, and whether it holds a member named `__proto__`.
 */
export const state = () => ({
	frozen: Object.isFrozen(config),
	sealed: Object.isSealed(config),
	extensible: Object.isExtensible(config),
	nestedExtensible: Object.isExtensible(config.nested),
	plainPrototype: Object.getPrototypeOf(config) === Object.prototype,
	ownProto: Object.prototype.hasOwnProperty.call(config, "__proto__")
});
