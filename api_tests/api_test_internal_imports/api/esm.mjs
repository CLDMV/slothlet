/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_imports/api/esm.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An ES module api file that loads a file of slothlet's by each route an ES module has, and through the
 * helper files it loads.
 * @module api_test_internal_imports.esm
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { attempt as taggedAttempt } from "../helpers/tagged.mjs";

/** A `require` made from this file's path, without the query slothlet loads it with. */
const plainRequire = createRequire(fileURLToPath(import.meta.url));
const plain = plainRequire("../helpers/plain.cjs");

/**
 * What a load gave: "loaded", or the code of the error it threw.
 * @param {Function} load - The load.
 * @returns {Promise<string>} The outcome.
 */
async function outcome(load) {
	try {
		await load();
		return "loaded";
	} catch (error) {
		// An error vite's module runner hands on keeps its message, which slothlet starts with the code.
		return error?.code ?? error?.cause?.code ?? /^\[([A-Z_]+)\]/.exec(String(error?.message))?.[1] ?? String(error?.message ?? error);
	}
}

/**
 * Load a file by one route.
 * @param {string} route - `import`, `importData` (a `data:` module that re-exports the target), `importMetaResolve`,
 *   `require`, `requirePlain`, `requireResolve` or `requireFrom`.
 * @param {string} target - The specifier, URL or path.
 * @param {string} [from] - For `requireFrom`: the path the `require` is made from.
 * @returns {Promise<string>} The outcome.
 * @example
 * await api.esm.attempt("import", "@cldmv/slothlet/runtime"); // "loaded"
 */
export function attempt(route, target, from) {
	return outcome(() => {
		switch (route) {
			case "import":
				return import(target);
			case "importData":
				return import(`data:text/javascript,${encodeURIComponent(`export * from ${JSON.stringify(target)};`)}`);
			case "importMetaResolve":
				return import.meta.resolve(target);
			case "require":
				return createRequire(import.meta.url)(target);
			case "requirePlain":
				return plainRequire(target);
			case "requireResolve":
				return createRequire(import.meta.url).resolve(target);
			case "requireFrom":
				return globalThis.process.getBuiltinModule("node:module").createRequire(from)(target);
			default:
				throw new TypeError(route);
		}
	});
}

/**
 * Load a file through a helper this file loads.
 * @param {string} helper - `tagged` (imported) or `plain` (required through a `require` made from a plain path).
 * @param {string} target - The specifier, URL or path.
 * @returns {Promise<string>} The outcome.
 * @example
 * await api.esm.through("tagged", "@cldmv/slothlet/runtime"); // "loaded"
 */
export function through(helper, target) {
	return outcome(() => (helper === "tagged" ? taggedAttempt(target) : plain.attempt(target)));
}
