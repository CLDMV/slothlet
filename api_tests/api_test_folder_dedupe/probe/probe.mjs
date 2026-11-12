/**
 * @fileoverview A module that calls another by its api path, for rules written against that path (#743).
 * @module api_test_folder_dedupe.probe
 * @memberof module:api_test_folder_dedupe
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the function at a dotted api path through `self`.
 * @function call
 * @memberof module:api_test_folder_dedupe.probe
 * @param {string} apiPath - The dotted path of a function.
 * @returns {Promise<string>} What it returned, or the code of the error it threw.
 * @example
 * await api.probe.call("e.x.where"); // "e.x.where"
 */
export async function call(apiPath) {
	try {
		let node = self;
		for (const key of apiPath.split(".")) node = node[key];
		return await node();
	} catch (error) {
		return error.code ?? error.name;
	}
}
