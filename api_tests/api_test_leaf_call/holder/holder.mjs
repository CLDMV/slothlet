/**
 * @fileoverview A module that takes the service's functions once and keeps them, to run them again later, after the
 * host has changed the rules.
 * @module api_test_leaf_call.holder
 * @memberof module:api_test_leaf_call
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * What {@link keep} took from the service.
 * @type {{leafRef: Function, boundLeaf: Function, inData: {run: Function}, closure: Function}|null}
 */
let kept = null;

/**
 * Run code and report a refusal by its code.
 * @param {function(): *} run - The code.
 * @returns {Promise<*>} What it returned, or the code of the error it threw.
 */
async function attempt(run) {
	try {
		return await run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * Take each of the service's hand-outs and keep it.
 * @function keep
 * @memberof module:api_test_leaf_call.holder
 * @returns {Promise<string[]>} The names of the kept hand-outs.
 * @example
 * await api.holder.keep(); // ["leafRef", "boundLeaf", "inData", "closure"]
 */
export async function keep() {
	kept = {
		leafRef: await self.bag.leafRef(),
		boundLeaf: await self.bag.boundLeaf(),
		inData: await self.bag.inData(),
		closure: await self.bag.closure()
	};
	return Object.keys(kept);
}

/**
 * Run what {@link keep} took, and the service's node, once more.
 * @function runKept
 * @memberof module:api_test_leaf_call.holder
 * @returns {Promise<{node: string, leafRef: string, boundLeaf: string, inData: string, closure: string}>} What each
 *   answered, or the code of its refusal.
 * @example
 * await api.holder.runKept();
 */
export async function runKept() {
	return {
		node: await attempt(() => self.bag.viaLeaf()),
		leafRef: await attempt(() => kept.leafRef()),
		boundLeaf: await attempt(() => kept.boundLeaf()),
		inData: await attempt(() => kept.inData.run()),
		closure: await attempt(() => kept.closure())
	};
}
