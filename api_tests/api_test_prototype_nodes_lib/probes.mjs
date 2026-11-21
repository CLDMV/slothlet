/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_nodes_lib/probes.mjs
 *	@Date: 2026-11-18T21:27:37-08:00 (1795066057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T21:57:36-08:00 (1795067856)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a caller reads, calls and writes of a class's prototype reached through an api root: the class's
 * `prototype`, an instance's prototype by `Object.getPrototypeOf`, `Reflect.getPrototypeOf` and `__proto__`, and the
 * class's `prototype` descriptor. The same probes run on `self` in a module, on `api` in the host, and on a plain import
 * of the owning module, so every answer can be compared with plain JS.
 * @module api_test_prototype_nodes_lib/probes
 */

/**
 * The routes to the prototype of the owner's `Box`, by name.
 * @type {Record<string, function(object): object>}
 */
export const ROUTES = {
	classPrototype: (owner) => owner.Box.prototype,
	instancePrototype: (owner) => Object.getPrototypeOf(owner.inst),
	reflectPrototype: (owner) => Reflect.getPrototypeOf(owner.inst),
	protoAccessor: (owner) => owner.inst.__proto__,
	described: (owner) => Object.getOwnPropertyDescriptor(owner.Box, "prototype").value,
	freshPrototype: (owner) => Object.getPrototypeOf(new owner.Box())
};

/** The route names. */
export const ROUTE_NAMES = Object.keys(ROUTES);

/** The private members the owner's prototype holds, one per name form. */
export const PRIVATE_NAMES = ["_hidden", "__hidden", "___hidden", "____hidden"];

/**
 * Run a step and report its outcome: its value, or the error code it threw.
 * @param {function(): *} step - The step.
 * @returns {*} The value, or `"threw <code>"`.
 */
export function attempt(step) {
	try {
		return step();
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Run every step of a record.
 * @param {Record<string, function(): *>} steps - The steps.
 * @returns {Record<string, *>} Each step's outcome.
 */
function attemptAll(steps) {
	return Object.fromEntries(Object.entries(steps).map(([name, step]) => [name, attempt(step)]));
}

/**
 * The public members a listing holds, sorted.
 * @param {Array<string|symbol>} keys - The listing.
 * @returns {string[]} Its public string keys.
 */
const publicKeys = (keys) => keys.filter((key) => typeof key === "string" && !key.startsWith("_")).sort();

/**
 * How the prototype reads by every route: its kind, its public members, its chain, and its methods called.
 * @param {object} owner - The owner's node, or the plain module.
 * @returns {object} The answers, per route.
 */
export function shape(owner) {
	const out = {};
	for (const [route, reach] of Object.entries(ROUTES)) {
		out[route] = attemptAll({
			kind: () => typeof reach(owner),
			keys: () => publicKeys(Object.keys(reach(owner))),
			names: () => publicKeys(Object.getOwnPropertyNames(reach(owner))),
			spread: () => publicKeys(Object.keys({ ...reach(owner) })),
			has: () => "label" in reach(owner),
			label: () => reach(owner).label.call(new owner.Box()),
			labelType: () => typeof Object.getOwnPropertyDescriptor(reach(owner), "label").value,
			getter: () => Object.getOwnPropertyDescriptor(reach(owner), "kind").get.call(new owner.Box()),
			chain: () => Object.getPrototypeOf(reach(owner)) === Object.prototype,
			constructorName: () => reach(owner).constructor.name,
			extensible: () => Object.isExtensible(reach(owner)),
			string: () => Object.prototype.toString.call(reach(owner))
		});
	}
	out.subclass = attemptAll({
		chain: () => Object.getPrototypeOf(owner.Sub.prototype) === owner.Box.prototype,
		instanceChain: () => Object.getPrototypeOf(Object.getPrototypeOf(owner.subInst)) === owner.Box.prototype,
		inherited: () => owner.Sub.prototype.label.call(new owner.Sub()),
		own: () => owner.subInst.sub()
	});
	return out;
}

/**
 * Whether the prototype is the same object by every route, as plain JS has it.
 * @param {object} owner - The owner's node, or the plain module.
 * @returns {object} The answers.
 */
export function identity(owner) {
	const proto = owner.Box.prototype;
	const out = {};
	for (const [route, reach] of Object.entries(ROUTES)) out[route] = attempt(() => reach(owner) === proto);
	return {
		...out,
		constructor: attempt(() => proto.constructor === owner.Box),
		freshInstanceOf: attempt(() => new owner.Box() instanceof owner.Box),
		instInstanceOf: attempt(() => owner.inst instanceof owner.Box),
		isPrototypeOf: attempt(() => Object.prototype.isPrototypeOf.call(proto, owner.inst)),
		aliasStable: attempt(() => owner.Alias.prototype === owner.Alias.prototype),
		aliasReads: attempt(() => owner.Alias.prototype.label === undefined || typeof owner.Alias.prototype.label === "function")
	};
}

/**
 * What reading each private member of the prototype answers, by every route, and whether the listings and descriptors
 * show it.
 * @param {object} owner - The owner's node, or the plain module.
 * @returns {object} The answers, per route and name.
 */
export function privacy(owner) {
	const out = {};
	for (const [route, reach] of Object.entries(ROUTES)) {
		const answers = {};
		for (const name of PRIVATE_NAMES) {
			answers[name] = attemptAll({
				read: () => reach(owner)[name],
				listed: () => Object.keys(reach(owner)).includes(name),
				named: () => Object.getOwnPropertyNames(reach(owner)).includes(name),
				described: () => Object.getOwnPropertyDescriptor(reach(owner), name)?.value
			});
		}
		out[route] = answers;
	}
	return out;
}

/**
 * Write `key` onto the prototype by a route and a kind of write.
 * @param {object} owner - The owner's node, or the plain module.
 * @param {string} route - A key of {@link ROUTES}.
 * @param {"set"|"define"|"delete"} how - The write.
 * @param {string} key - The member.
 * @returns {string} `"done"`, `"false"` when the write was declined, or the error code.
 */
export function write(owner, route, how, key) {
	return attempt(() => {
		const proto = ROUTES[route](owner);
		if (how === "set") proto[key] = 1;
		else if (how === "define") return String(Reflect.defineProperty(proto, key, { value: 1, configurable: true, writable: true }));
		else return String(delete proto[key]);
		return "done";
	});
}
