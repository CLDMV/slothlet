/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vitest_runner_compile/probe.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module file whose top-level code, as it loads under vitest, tries to compile code under its own name
 * the way vitest's module runner compiles the file, and reports how each try went.
 *
 * @module api_tests/api_test_vitest_runner_compile/probe
 */

import vm from "node:vm";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const OWN_PATH = fileURLToPath(import.meta.url);
const FORGED_FLAG = Symbol.for("slothlet.test.vitestRunnerCompile.forgedRan");
const REPLAY_FLAG = Symbol.for("slothlet.test.vitestRunnerCompile.replayRan");

/**
 * The argument names vitest's module evaluator compiles a module's code with.
 * @type {string[]}
 */
const ARGUMENTS = [
	"__vite_ssr_exports__",
	"__vite_ssr_import_meta__",
	"__vite_ssr_import__",
	"__vite_ssr_dynamic_import__",
	"__vite_ssr_exportAll__",
	"__vite_ssr_exportName__"
];

/**
 * The code wrapped as vitest's evaluator wraps a module's code.
 * @param {string} code - The module's code.
 * @returns {string} The wrapped code.
 */
const wrap = (code) => `'use strict';async (${ARGUMENTS.join(",")})=>{{${code}\n}}`;

/**
 * Try one route, as the file's own top-level code.
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
 * vitest's record of this copy of the file, as it is being evaluated: the module node whose file is this one and which
 * has not finished evaluating.
 * @returns {object|null} The node, or null outside vitest.
 */
function ownNode() {
	const modules = globalThis.__vitest_mocker__?.moduleRunner?.evaluatedModules?.idToModuleMap;
	if (!modules) return null;
	for (const node of modules.values()) {
		if (node?.file === OWN_PATH && node.evaluated !== true && String(node.id).includes("slothlet_instance=")) return node;
	}
	return null;
}

const node = ownNode();
const ownId = node?.id ?? null;

const outcomes = {
	runner: node !== null,
	// The file's own source, compiled under its real path and under the id vitest compiles it under.
	ownCodeAtPath: await attempt(() => vm.runInThisContext(fs.readFileSync(OWN_PATH, "utf8"), { filename: OWN_PATH })),
	ownCodeAtId: await attempt(() => vm.runInThisContext(wrap(fs.readFileSync(OWN_PATH, "utf8")), { filename: ownId ?? OWN_PATH })),
	// The code vitest's server sent for this file and vitest compiled already, wrapped as vitest wraps it, run with
	// imports this code chose.
	replay: await attempt(async () => {
		const code = node?.meta?.code;
		if (typeof code !== "string") throw new Error("no recorded code");
		const fn = vm.runInThisContext(wrap(code), { filename: ownId });
		const exports = {};
		await fn(
			exports,
			{ url: import.meta.url },
			async () => ({}),
			async () => ({}),
			() => {},
			(name, get) => {
				Object.defineProperty(exports, name, { get, enumerable: true });
				globalThis[REPLAY_FLAG] = true;
			}
		);
	}),
	// A reply to vitest's pending fetch of another copy of this file, its code changed before vitest's runner reads it.
	forged: await attempt(async () => {
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
			// Another copy of this file under this instance's tag, so the copy's compile is one of a file the instance is
			// loading.
			const query = ownId === null ? "" : String(ownId).slice(String(ownId).indexOf("?") + 1);
			const specifier = OWN_PATH + "?" + query + "&forged=1";
			await import(/* @vite-ignore */ specifier);
		} finally {
			Map.prototype.set = set;
		}
	}),
	forgedRan: () => globalThis[FORGED_FLAG] === true,
	replayRan: () => globalThis[REPLAY_FLAG] === true
};

/**
 * How the file's top-level tries went.
 * @returns {Record<string, boolean|string>} Each try's outcome.
 * @public
 * @example
 * api.probe.result(); // { runner: true, ownCodeAtPath: "CAPABILITY_REFUSED", ... }
 */
export function result() {
	return {
		runner: outcomes.runner,
		ownCodeAtPath: outcomes.ownCodeAtPath,
		ownCodeAtId: outcomes.ownCodeAtId,
		replay: outcomes.replay,
		forged: outcomes.forged,
		forgedRan: outcomes.forgedRan(),
		replayRan: outcomes.replayRan()
	};
}
