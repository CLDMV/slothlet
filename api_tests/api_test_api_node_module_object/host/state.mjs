/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_module_object/host/state.mjs
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
 * @fileoverview A data object the module changes itself, whose api node is compared with the same module imported as a
 * plain module.
 * @module api_test_api_node_module_object/state
 */

/**
 * A data object with a nested object and a getter that reads it through `this`.
 * @type {{port: number, nested: {a: number}, computed: number}}
 */
export const config = {
	port: 80,
	nested: { a: 1 },
	get computed() {
		return this.port + 1;
	}
};

/**
 * Change a member of the module's own object.
 * @param {number} port - The new port.
 * @returns {void}
 */
export const setPort = (port) => {
	config.port = port;
};

/**
 * Replace the object the module's own object holds.
 * @returns {void}
 */
export const replaceNested = () => {
	config.nested = { b: 2 };
};

/**
 * Change a member of the object the module's own object holds.
 * @param {number} a - The new value.
 * @returns {void}
 */
export const setNested = (a) => {
	config.nested.a = a;
};

/**
 * Add a member to the module's own object.
 * @returns {void}
 */
export const addMember = () => {
	config.extra = { deep: 1 };
};

/**
 * Delete a member of the module's own object.
 * @returns {void}
 */
export const removeMember = () => {
	delete config.port;
};

/**
 * Replace the getter of the module's own object with a value.
 * @returns {void}
 */
export const replaceGetter = () => {
	Object.defineProperty(config, "computed", { value: "fixed", writable: true, enumerable: true, configurable: true });
};

/**
 * Freeze the module's own object.
 * @returns {void}
 */
export const freeze = () => {
	Object.freeze(config);
};

/**
 * Give the module's own object a prototype.
 * @param {object} prototype - The prototype.
 * @returns {void}
 */
export const inherit = (prototype) => {
	Object.setPrototypeOf(config, prototype);
};

/**
 * What the module's own object is, as the module reads it.
 * @returns {{keys: string[], frozen: boolean, sealed: boolean, extensible: boolean, nestedFrozen: boolean, prototype: string, tag: *, ownProto: boolean}} Its keys,
 *   its integrity and its nested object's, the
 *   name of its prototype's `kind` (or "Object" for `Object.prototype`), what it inherits as `tag`, and whether it holds
 *   a member named `__proto__`.
 */
export const state = () => {
	const prototype = Object.getPrototypeOf(config);
	return {
		keys: Object.keys(config),
		frozen: Object.isFrozen(config),
		sealed: Object.isSealed(config),
		extensible: Object.isExtensible(config),
		nestedFrozen: Object.isFrozen(config.nested),
		prototype: prototype === Object.prototype ? "Object" : prototype === null ? "null" : (prototype.kind ?? "other"),
		tag: config.tag,
		ownProto: Object.prototype.hasOwnProperty.call(config, "__proto__")
	};
};
