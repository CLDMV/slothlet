/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_array_capture/probe.mjs
 *	@Date: 2026-10-24T15:16:48-07:00 (1792880208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T15:17:10-07:00 (1792880230)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Scratch fixture (#656 review): a module reading `store` every way, and keeping references for later.
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
