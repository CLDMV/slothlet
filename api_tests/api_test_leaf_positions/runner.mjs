/**
 * @fileoverview A module the rules allow the vault, which runs a function another file handed out.
 * @module api_test_leaf_positions.runner
 * @memberof module:api_test_leaf_positions
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Ask a file's export for its function and run it.
 * @function run
 * @memberof module:api_test_leaf_positions.runner
 * @param {string} file - The file's api name.
 * @param {string} [name] - The export; the file's default export when omitted.
 * @returns {Promise<string>} What the function returned, or the code of the error it threw.
 * @example
 * await api.runner.run("dup", "shown"); // "SECRET"
 */
export async function run(file, name) {
	try {
		const node = file.split(".").reduce((at, key) => at[key], self);
		const made = await (name ? node[name]() : node());
		return await made();
	} catch (error) {
		return error.code ?? error.name;
	}
}
