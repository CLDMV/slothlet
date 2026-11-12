/**
 * @fileoverview A module that hands out a function which has Node's own code call the vault from deep inside a
 * recursion of Node's own, so many frames of Node's sit between the call and the code that started it.
 * @module api_test_deep_stack.bag
 * @memberof module:api_test_deep_stack
 */
import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * An object nested `depth` levels deep whose innermost level has an accessor whose getter is the vault's own node:
 * `util.inspect` with `getters: true` calls it from inside its recursion, with no frame of any module in between.
 * @param {number} depth - How many levels.
 * @returns {object} The object.
 */
function nested(depth) {
	const inner = {};
	Object.defineProperty(inner, "value", { get: self.vault.get, enumerable: true });
	let outer = inner;
	for (let level = 0; level < depth; level++) outer = { next: outer };
	return outer;
}

/**
 * Whether inspecting the nested object showed the vault's answer, or the getter threw.
 * @param {number} depth - How many levels.
 * @returns {"SECRET"|"THREW"|"OTHER"} What the inspection showed.
 */
function inspectDeep(depth) {
	const shown = util.inspect(nested(depth), { depth: Infinity, getters: true, breakLength: Infinity });
	if (shown.includes("SECRET")) return "SECRET";
	return shown.includes("Inspection threw") ? "THREW" : "OTHER";
}

/**
 * A function of this module's that inspects the nested object.
 * @function deep
 * @memberof module:api_test_deep_stack.bag
 * @param {number} depth - How many levels.
 * @returns {function(): string} The function.
 * @example
 * const fn = await api.bag.deep(40);
 */
export const deep = (depth) => () => inspectDeep(depth);

/**
 * Inspect the nested object from this module's own leaf.
 * @function own
 * @memberof module:api_test_deep_stack.bag
 * @param {number} depth - How many levels.
 * @returns {string} What the inspection showed.
 * @example
 * api.bag.own(40); // "THREW" when the rules deny this module the vault
 */
export const own = (depth) => inspectDeep(depth);
