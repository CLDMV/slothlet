/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_leaf_import_refused/lib/probe.mjs
 *	@Date: 2026-11-23T19:59:51-08:00 (1795492791)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:38-08:00 (1795868918)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Under Node's own loader: every case of the fixture, in every mode and runtime, printed as JSON.
 * Each entry is the refusal's code and the files its message names, or the value the importer returned.
 * @module api_tests/api_test_leaf_import_refused/probe
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const here = path.dirname(fileURLToPath(import.meta.url));
const CASES = ["static", "sibling", "subfolder", "reexport", "cjs", "launder", "ts", "ts-mjs", "dynamic", "create-require", "clean"];

/**
 * The code of the refusal in an error's causes, or of the error.
 * @param {*} error - What was thrown.
 * @returns {string} The code.
 */
function codeOf(error) {
	for (let at = error, depth = 0; at && depth < 10; at = at.cause, depth++) if (at.code === "MODULE_LEAF_IMPORT_REFUSED") return at.code;
	return error?.code ?? String(error?.message ?? error);
}

const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const name of CASES) {
			const typescript = name === "ts" || name === "ts-mjs" ? { typescript: "fast" } : {};
			let api;
			let result;
			try {
				api = await slothlet({ base: path.join(here, "..", "api", "cases", name), mode, runtime, silent: true, ...typescript });
				result = { value: await api.importer.run() };
			} catch (error) {
				result = { code: codeOf(error) };
			} finally {
				// In a lazy tree, nothing builds a folder nothing reached.
				if (mode === "lazy" && api) result.unrelatedBuilt = api.slothlet.node(api.unrelated).materialized;
				await api?.shutdown();
			}
			out[`${mode}/${runtime}/${name}`] = result;
		}
process.stdout.write(JSON.stringify(out));
