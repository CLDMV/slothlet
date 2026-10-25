/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_array_capture/probe.mjs
 *	@Date: 2026-10-24T15:16:48-07:00 (1792880208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T22:45:27-07:00 (1792907127)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#655): a module reading `store` every way, and keeping references for later.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a read, reporting the JSON of what it gave or the code it threw.
 * @param {function(): *} read - The read.
 * @returns {{value?: string, error?: string}} The outcome.
 */
function attempt(read) {
	try {
		const value = read();
		return { value: typeof value === "function" ? "fn" : JSON.stringify(value) };
	} catch (error) {
		return { error: error.code ?? `${error.name}: ${error.message}` };
	}
}

/**
 * Read an array member of `store` by index, spread, map and JSON.stringify.
 * @param {string} name - The member.
 * @returns {Record<string, object>} The outcome of each read.
 */
export function readArray(name) {
	return {
		index: attempt(() => self.store[name][0]),
		spread: attempt(() => [...self.store[name]]),
		map: attempt(() => self.store[name].map((entry) => entry)),
		stringify: attempt(() => JSON.parse(JSON.stringify(self.store[name])))
	};
}

/**
 * Read a nested path off `store`.
 * @param {Array<string|number>} keys - The path below `store`.
 * @returns {{value?: string, error?: string}} The outcome.
 */
export function readPath(keys) {
	return attempt(() => keys.reduce((node, key) => node[key], self.store));
}

/**
 * Call a function at a path below `store` now.
 * @param {Array<string|number>} keys - The path to the function.
 * @returns {{value?: string, error?: string}} The outcome.
 */
export function callPath(keys) {
	return attempt(() => {
		const holder = keys.slice(0, -1).reduce((node, key) => node[key], self.store);
		return holder[keys.at(-1)]();
	});
}

/** @type {Record<string, *>} References kept for later. */
const kept = {};
/** @type {Record<string, object>} What the later uses gave. */
const outcomes = {};

/**
 * Keep the node at a path below `store`.
 * @param {string} id - Name to keep it under.
 * @param {Array<string|number>} keys - The path.
 * @returns {string} "kept".
 */
export function keep(id, keys) {
	kept[id] = keys.reduce((node, key) => node[key], self.store);
	outcomes[id] = null;
	return typeof kept[id];
}

/**
 * From a timer slothlet does not patch, use a kept reference: call it, or read a path below it and call the end
 * when `call` is set.
 * @param {string} id - The kept reference.
 * @param {Array<string|number>} keys - The path below it.
 * @param {boolean} call - Whether to call what the path ends at.
 * @returns {Promise<string>} "armed".
 */
export async function useLater(id, keys, call) {
	const timers = await import("node:timers");
	timers.setTimeout(() => {
		outcomes[id] = attempt(() => {
			if (keys.length === 0) return call ? kept[id]() : kept[id];
			const holder = keys.slice(0, -1).reduce((node, key) => node[key], kept[id]);
			return call ? holder[keys.at(-1)]() : holder[keys.at(-1)];
		});
	}, 5);
	return "armed";
}

/**
 * What a later use gave.
 * @param {string} id - The kept reference.
 * @returns {object|null} The outcome, or null before the timer fired.
 */
export function outcome(id) {
	return outcomes[id] ?? null;
}

/**
 * Use a node another module handed over: read a path below it, calling the end when `call` is set, now and from a
 * timer slothlet does not patch.
 * @param {string} id - Name to record the later outcome under.
 * @param {*} node - The node.
 * @param {Array<string|number>} keys - The path below it.
 * @param {boolean} call - Whether to call what the path ends at.
 * @returns {Promise<object>} The outcome of the use now.
 */
export async function useNode(id, node, keys, call) {
	kept[id] = node;
	outcomes[id] = null;
	await useLater(id, keys, call);
	return attempt(() => {
		const holder = keys.slice(0, -1).reduce((at, key) => at[key], node);
		return call ? holder[keys.at(-1)]() : holder[keys.at(-1)];
	});
}

/**
 * Read the node at a path below `store` and hand it to the other module's `useNode`.
 * @param {string} other - The other module (`friend` or `probe`).
 * @param {string} id - Name the other module records the later outcome under.
 * @param {Array<string|number>} at - Path below `store` to the node handed over.
 * @param {Array<string|number>} keys - Path below the node the other module uses.
 * @param {boolean} call - Whether the other module calls what the path ends at.
 * @returns {Promise<object>} The other module's outcome now.
 */
export async function handTo(other, id, at, keys, call) {
	const node = at.reduce((holder, key) => holder[key], self.store);
	return self[other].useNode(id, node, keys, call);
}

/**
 * Hand the node at a path below `store` back to whoever called.
 * @param {Array<string|number>} keys - The path.
 * @returns {{node: *}} The node, boxed so awaiting the result does not probe it.
 */
export function give(keys) {
	return { node: keys.reduce((holder, key) => holder[key], self.store) };
}

/**
 * From a timer slothlet does not patch, ask a kept reference what it holds of `prop`: its descriptor, `in`, and
 * its own keys.
 * @param {string} id - The kept reference.
 * @param {string} prop - The member to ask about.
 * @returns {Promise<string>} "armed".
 */
export async function describeLater(id, prop) {
	const timers = await import("node:timers");
	timers.setTimeout(() => {
		outcomes[id] = attempt(() => {
			const descriptor = Object.getOwnPropertyDescriptor(kept[id], prop);
			return {
				own: descriptor !== undefined,
				writable: descriptor?.writable,
				configurable: descriptor?.configurable,
				has: prop in kept[id],
				listed: Reflect.ownKeys(kept[id]).includes(prop)
			};
		});
	}, 0);
	return "armed";
}

/**
 * From a timer slothlet does not patch, construct a kept reference.
 * @param {string} id - The kept reference.
 * @returns {Promise<string>} "armed".
 */
export async function constructLater(id) {
	const timers = await import("node:timers");
	timers.setTimeout(() => {
		outcomes[id] = attempt(() => typeof new kept[id]());
	}, 0);
	return "armed";
}

/**
 * From a timer slothlet does not patch, describe a kept reference with `util.inspect`.
 * @param {string} id - The kept reference.
 * @returns {Promise<string>} "armed".
 */
export async function inspectLater(id) {
	const timers = await import("node:timers");
	const util = await import("node:util");
	timers.setTimeout(() => {
		outcomes[id] = attempt(() => util.inspect(kept[id]));
	}, 0);
	return "armed";
}

/**
 * From a timer slothlet does not patch, enumerate a kept reference: its keys, whether it has `prop`, its JSON and
 * its length.
 * @param {string} id - The kept reference.
 * @param {string} prop - The member to ask `in` about.
 * @param {string} [as=id] - The id to record the outcome under.
 * @returns {Promise<string>} "armed".
 */
export async function enumerateLater(id, prop, as = id) {
	const timers = await import("node:timers");
	outcomes[as] = null;
	timers.setTimeout(() => {
		outcomes[as] = attempt(() => ({
			keys: Object.keys(kept[id]),
			has: prop in kept[id],
			json: JSON.stringify(kept[id]),
			length: kept[id].length
		}));
	}, 0);
	return "armed";
}

/**
 * From a timer slothlet does not patch, survey a kept reference: read `prop`, its own keys, whether it has `prop`,
 * whether it is extensible, its prototype, and its JSON.
 * @param {string} id - The kept reference.
 * @param {string} prop - The member to read.
 * @param {string} as - The id to record the outcome under.
 * @returns {Promise<string>} "armed".
 */
export async function surveyLater(id, prop, as) {
	const timers = await import("node:timers");
	outcomes[as] = null;
	timers.setTimeout(() => {
		const view = kept[id];
		outcomes[as] = {
			read: attempt(() => view[prop]),
			keys: attempt(() => Reflect.ownKeys(view).filter((key) => typeof key === "string")),
			has: attempt(() => prop in view),
			extensible: attempt(() => Object.isExtensible(view)),
			proto: attempt(() => Object.getPrototypeOf(view) === null),
			json: attempt(() => JSON.parse(JSON.stringify(view)))
		};
	}, 0);
	return "armed";
}

/**
 * Ask a kept reference for its own keys now, in this call.
 * @param {string} id - The kept reference.
 * @returns {{value?: string, error?: string}} The outcome.
 */
export function touch(id) {
	return attempt(() => Reflect.ownKeys(kept[id]).filter((key) => typeof key === "string"));
}

/**
 * From a timer slothlet does not patch, list a kept reference's enumerable keys: `Object.keys` and `for…in`.
 * @param {string} id - The kept reference.
 * @param {string} as - The id to record the outcome under.
 * @returns {Promise<string>} "armed".
 */
export async function keysLater(id, as) {
	const timers = await import("node:timers");
	outcomes[as] = null;
	timers.setTimeout(() => {
		outcomes[as] = attempt(() => {
			const forIn = [];
			for (const key in kept[id]) forIn.push(key);
			return { keys: Object.keys(kept[id]), forIn };
		});
	}, 0);
	return "armed";
}

/**
 * Serialize a member of `store` now, in this call.
 * @param {string} name - The member.
 * @returns {{value?: string, error?: string}} The JSON, or what serializing threw.
 */
export function serializeNow(name) {
	return attempt(() => JSON.parse(JSON.stringify(self.store[name])));
}

/**
 * From a timer slothlet does not patch, read a member of a kept reference through its descriptor, and inspect it.
 * @param {string} id - The kept reference.
 * @param {string} prop - The member.
 * @param {string} as - The id to record the outcome under.
 * @returns {Promise<string>} "armed".
 */
export async function descriptorLater(id, prop, as) {
	const timers = await import("node:timers");
	const util = await import("node:util");
	outcomes[as] = null;
	timers.setTimeout(() => {
		outcomes[as] = {
			descriptor: attempt(() => Object.getOwnPropertyDescriptor(kept[id], prop)?.value),
			descriptors: attempt(() => Object.getOwnPropertyDescriptors(kept[id])[prop]?.value),
			inspect: attempt(() => util.inspect(kept[id], { depth: 4 }))
		};
	}, 0);
	return "armed";
}

/**
 * Describe a member of `store` now, in this call: its keys, the member's descriptor value, and all descriptors.
 * @param {string} name - The member of `store`.
 * @param {string} prop - The member of it to describe.
 * @returns {{keys: object, descriptor: object, descriptors: object}} The outcomes.
 */
export function describeNow(name, prop) {
	const node = self.store[name];
	return {
		keys: attempt(() => Object.keys(node)),
		descriptor: attempt(() => Object.getOwnPropertyDescriptor(node, prop)?.value),
		descriptors: attempt(() => Object.keys(Object.getOwnPropertyDescriptors(node)))
	};
}

/**
 * From a timer slothlet does not patch, describe a kept reference as {@link describeNow} does.
 * @param {string} id - The kept reference.
 * @param {string} prop - The member to describe.
 * @param {string} as - The id to record the outcome under.
 * @returns {Promise<string>} "armed".
 */
export async function describeKeptLater(id, prop, as) {
	const timers = await import("node:timers");
	outcomes[as] = null;
	timers.setTimeout(() => {
		const node = kept[id];
		outcomes[as] = {
			keys: attempt(() => Object.keys(node)),
			descriptor: attempt(() => Object.getOwnPropertyDescriptor(node, prop)?.value),
			descriptors: attempt(() => Object.keys(Object.getOwnPropertyDescriptors(node)))
		};
	}, 0);
	return "armed";
}

/**
 * Serialize a node another module handed over, and read its `secret`.
 * @param {object} node - The node.
 * @returns {{json: object, secret: object}} The outcomes.
 */
export function serializeGiven(node) {
	return { json: attempt(() => JSON.parse(JSON.stringify(node))), secret: attempt(() => node.secret) };
}

/**
 * Read a member of a node at a path below `store` through its descriptor, now.
 * @param {Array<string|number>} keys - The path to the node.
 * @param {string|number} prop - The member.
 * @returns {{value?: string, error?: string}} The descriptor's value, or what reading it threw.
 */
export function describePath(keys, prop) {
	return attempt(
		() =>
			Object.getOwnPropertyDescriptor(
				keys.reduce((node, key) => node[key], self.store),
				prop
			)?.value
	);
}
