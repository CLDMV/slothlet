/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_imports/host/host.mjs
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
 * @fileoverview The host-side twin of the api file `api/esm.mjs`: the same loads, made by a file of the host, which
 * Node or vite answers as it answers any of the host's imports.
 * @module api_test_internal_imports.host.host
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** A `require` made from this file's path, without the query slothlet loads it with. */
const plainRequire = createRequire(fileURLToPath(import.meta.url));

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
 * await attempt("import", "@cldmv/slothlet/runtime"); // "loaded"
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
