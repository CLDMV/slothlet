/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_imports/host/host.cjs
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
 * @fileoverview The host-side twin of the api file `api/cjs.cjs`: the same loads, made by a CommonJS file of the host.
 * @module api_test_internal_imports.host.host-cjs
 */

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
 * @param {string} route - `require`, `requireResolve` or `import`.
 * @param {string} target - The specifier, URL or path.
 * @returns {Promise<string>} The outcome.
 */
function attempt(route, target) {
	return outcome(() => {
		if (route === "require") return require(target);
		if (route === "requireResolve") return require.resolve(target);
		if (route === "import") return import(target);
		throw new TypeError(route);
	});
}

module.exports = { attempt };
