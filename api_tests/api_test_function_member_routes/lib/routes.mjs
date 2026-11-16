/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_member_routes/lib/routes.mjs
 *	@Date: 2026-11-15T13:40:33-08:00 (1794778833)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T17:00:30-08:00 (1794790830)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file (no api file) the readers use: reads a node's `tag` member directly and through each
 * route the node's function members lead back to the function.
 * @module api_test_function_member_routes.lib.routes
 */

/**
 * What an attempt answered: `"fn"`, `"object"`, a primitive as a string, or `"threw:<code>"`.
 * @param {function(): *} attempt - The attempt.
 * @returns {string} The outcome.
 */
function outcome(attempt) {
	try {
		const value = attempt();
		if (typeof value === "function") return "fn";
		if (typeof value === "object" && value !== null) return "object";
		return String(value);
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * Read `node.tag` directly and by every route back to the node's function.
 * @param {Function} node - The node.
 * @returns {Record<string, string>} What each route answered.
 */
export function routes(node) {
	return {
		direct: outcome(() => node.tag),
		receiver: outcome(() => Reflect.get(node, "tag", {})),
		constructor: outcome(() => node.prototype.constructor.tag),
		constructorTwice: outcome(() => node.prototype.constructor.prototype.constructor.tag),
		constructorDescribed: outcome(() => Object.getOwnPropertyDescriptor(node.prototype, "constructor").value.tag),
		constructorDescriptors: outcome(() => Object.getOwnPropertyDescriptors(node.prototype).constructor.value.tag),
		constructorWithReceiver: outcome(() => Reflect.get(node.prototype, "constructor", {}).tag),
		constructorReflect: outcome(() => Reflect.get(node.prototype.constructor, "tag")),
		constructorDescribesTag: outcome(() => Object.getOwnPropertyDescriptor(node.prototype.constructor, "tag")?.value),
		constructorListsTag: outcome(() => Object.keys(node.prototype.constructor).includes("tag")),
		constructorEntries: outcome(() => Object.entries(node.prototype.constructor).find(([key]) => key === "tag")?.[1]),
		prototypeDescribed: outcome(() => Object.getOwnPropertyDescriptor(node, "prototype")?.value.constructor.tag),
		prototypeChain: outcome(() => Object.getPrototypeOf(node.prototype).constructor === Object),
		instance: outcome(() => new node().constructor.tag),
		instanceUsed: outcome(() => {
			const instance = new node();
			instance.w = 2;
			return instance.w;
		}),
		instancePrototype: outcome(() => Object.getPrototypeOf(new node()).constructor.tag)
	};
}

/**
 * Read the `tag` of an instance's class through the instance, and use the instance.
 * @param {object} instance - The instance.
 * @returns {Record<string, string>} What each route answered.
 */
export function instanceRoutes(instance) {
	return {
		constructor: outcome(() => instance.constructor.tag),
		prototype: outcome(() => Object.getPrototypeOf(instance).constructor.tag),
		own: outcome(() => instance.v),
		written: outcome(() => {
			instance.w = 2;
			return instance.w;
		})
	};
}
