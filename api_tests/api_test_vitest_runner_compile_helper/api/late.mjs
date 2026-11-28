/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_vitest_runner_compile_helper/api/late.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:09-08:00 (1795869009)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module file whose function, called once the instance has loaded, imports copies of a lib file under
 * the instance's tag: one as vitest's server sends it, one whose fetch reply it changes before vitest's runner reads
 * it, and compiles the lib file's source under a copy's name.
 *
 * @module api_tests/api_test_vitest_runner_compile_helper/api/late
 */

import vm from "node:vm";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "../lib/twin.mjs";

const OWN_PATH = fileURLToPath(import.meta.url);
const COPY_PATH = fileURLToPath(new URL("../lib/twin.mjs", import.meta.url));
const FORGED_FLAG = Symbol.for("slothlet.test.vitestRunnerCompileHelper.forgedRan");

/**
 * The code wrapped as vitest's evaluator wraps a module's code.
 * @param {string} code - The module's code.
 * @returns {string} The wrapped code.
 */
const wrap = (code) =>
	`'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__)=>{{${code}\n}}`;

/**
 * Try one route.
 * @param {function(): *} run - The route.
 * @returns {Promise<string>} "done", or the code of what was thrown.
 */
async function attempt(run) {
	try {
		await run();
		return "done";
	} catch (error) {
		return error?.code ?? error?.cause?.code ?? String(error?.message ?? error);
	}
}

/**
 * The query this copy of the file was loaded under, as vitest's runner records it: read as the copy's top-level code
 * runs, from the module node of this file that has not finished evaluating.
 * @returns {string|null} The query, or null outside vitest.
 */
function ownQuery() {
	const modules = globalThis.__vitest_mocker__?.moduleRunner?.evaluatedModules?.idToModuleMap;
	if (!modules) return null;
	for (const node of modules.values()) {
		const id = String(node?.id ?? "");
		if (node?.file === OWN_PATH && node.evaluated !== true && id.includes("slothlet_instance=")) return id.slice(id.indexOf("?") + 1);
	}
	return null;
}

const QUERY = ownQuery();

/**
 * Import copies of the lib file under this instance's tag, once the instance has loaded, and report how each went.
 * @returns {Promise<Record<string, boolean|string>>} Each try's outcome.
 * @public
 * @example
 * await api.late.forge(); // { runner: true, genuine: "done", forged: "PERMISSION_CAPABILITY_REFUSED", ... }
 */
export async function forge() {
	const runner = QUERY !== null;
	// A copy as vitest's server sends it.
	const genuine = await attempt(async () => {
		if (!runner) throw new Error("no runner");
		const module = await import(/* @vite-ignore */ `${COPY_PATH}?${QUERY}&late=genuine`);
		if (module.copy !== true) throw new Error("not the copy");
	});
	// A copy whose fetch reply is changed before vitest's runner reads it.
	const forged = await attempt(async () => {
		if (!runner) throw new Error("no runner");
		const set = Map.prototype.set;
		Map.prototype.set = function (key, value) {
			if (value && typeof value === "object" && value.method === "fetch" && typeof value.resolve === "function") {
				const resolve = value.resolve;
				value.resolve = (result) =>
					resolve(
						result && typeof result === "object"
							? { ...result, code: `globalThis[Symbol.for(${JSON.stringify(FORGED_FLAG.description)})] = true;` }
							: result
					);
			}
			return Reflect.apply(set, this, [key, value]);
		};
		try {
			await import(/* @vite-ignore */ `${COPY_PATH}?${QUERY}&late=forged`);
		} finally {
			Map.prototype.set = set;
		}
	});
	// The lib file's source compiled under the name of a copy of it.
	const sourceAtCopy = await attempt(() =>
		vm.runInThisContext(wrap(fs.readFileSync(COPY_PATH, "utf8")), { filename: `${COPY_PATH}?${QUERY ?? ""}&late=source` })
	);
	return { runner, genuine, forged, forgedRan: globalThis[FORGED_FLAG] === true, sourceAtCopy };
}
