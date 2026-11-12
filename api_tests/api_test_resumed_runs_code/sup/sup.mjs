/**
 * @fileoverview A module that awaits the bag's function and then runs it itself, in each way a call picks up again
 * after an `await`: in the exported function, in a function nested in it, and in a promise callback.
 * @module api_test_resumed_runs_code.sup
 * @memberof module:api_test_resumed_runs_code
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
 * Await the bag's function and run it in the exported function itself.
 * @function inExport
 * @memberof module:api_test_resumed_runs_code.sup
 * @returns {Promise<string>} What it returned, or the code of the refusal.
 * @example
 * await api.sup.inExport(); // "SECRET"
 */
export async function inExport() {
	try {
		const run = await self.bag.make();
		return await run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * Await the bag's function and run it in an unnamed function nested in the export.
 * @function inNested
 * @memberof module:api_test_resumed_runs_code.sup
 * @returns {Promise<string>} What it returned, or the code of the refusal.
 * @example
 * await api.sup.inNested(); // "SECRET"
 */
export const inNested = () => attempt(async () => (await self.bag.make())());

/**
 * Run the bag's function from a promise callback.
 * @function inThen
 * @memberof module:api_test_resumed_runs_code.sup
 * @returns {Promise<string>} What it returned, or the code of the refusal.
 * @example
 * await api.sup.inThen(); // "SECRET"
 */
export const inThen = () =>
	Promise.resolve(self.bag.make())
		.then(
			(run) => run(),
			(error) => error.code ?? error.name
		)
		.catch((error) => error.code ?? error.name);

/**
 * Read the vault from this module's own code after an `await`.
 * @function own
 * @memberof module:api_test_resumed_runs_code.sup
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 * @example
 * await api.sup.own(); // "SECRET"
 */
export const own = () =>
	attempt(async () => {
		await null;
		return self.vault.get();
	});
