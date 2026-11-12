/**
 * @fileoverview A module the rules allow the vault, which runs code the author hands it.
 * @module api_test_fast_no_provenance.runner
 * @memberof module:api_test_fast_no_provenance
 */
import { self } from "@cldmv/slothlet/runtime";

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
 * Run the function the author returns directly.
 * @function direct
 * @memberof module:api_test_fast_no_provenance.runner
 * @returns {Promise<string>} What it returned, or the code of the refusal.
 * @example
 * await api.runner.direct(); // "PERMISSION_DENIED" under "precise"
 */
export const direct = () => attempt(async () => (await self.author.make())());

/**
 * Run the function nested in the data the author returns.
 * @function nested
 * @memberof module:api_test_fast_no_provenance.runner
 * @returns {Promise<string>} What it returned, or the code of the refusal.
 * @example
 * await api.runner.nested(); // "PERMISSION_DENIED" under "precise"
 */
export const nested = () => attempt(async () => (await self.author.box()).run());

/**
 * Read the vault from this module's own leaf.
 * @function own
 * @memberof module:api_test_fast_no_provenance.runner
 * @returns {Promise<string>} What the vault answered.
 * @example
 * await api.runner.own(); // "SECRET"
 */
export const own = () => attempt(() => self.vault.get());
