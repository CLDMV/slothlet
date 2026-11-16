/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/permission-baseline.mjs
 *	@Date: 2026-11-16T03:00:00-08:00 (1794826800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T03:00:00-08:00 (1794826800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The permission baseline: the facts about the host an instance checks as it starts with permissions on
 * or strict.
 *
 * @description
 * Each check is a fact slothlet can test for itself, by trying the thing and seeing it refused:
 *
 * - `csp-eval` (browser): the page refuses code made from a string (`Function`, and so `eval`): its Content Security
 *   Policy has no `'unsafe-eval'`.
 * - `csp-blob-script` and `csp-data-script` (browser): the page refuses scripts from `blob:` and `data:` URLs.
 * - `node-code-generation` (Node): the process refuses code made from a string
 *   (`--disallow-code-generation-from-strings`).
 * - `node-stack-realm` (Node): slothlet reads call stacks from a realm of its own, so what the global `Error` and its
 *   stack settings hold does not change whose code an access is taken for.
 * - `vitest-plugin` (Node, under vitest): the `slothletInstanceImports()` plugin is loaded: its records of who loaded
 *   each file have reached slothlet.
 *
 * A check passed means only that what slothlet could test passed. Code that ran before slothlet (the page's own
 * scripts, an extension, a compromised dependency) can have changed what the checks read.
 *
 * @module @cldmv/slothlet/helpers/permission-baseline
 * @internal
 */

import { translate } from "@cldmv/slothlet/i18n";
import { ownRealmInUse } from "@cldmv/slothlet/helpers/stack-read";
import { ArrayMethods, Blob, EvalError, listPush, NativeFunction, Reflect, Symbols, URL, URLs } from "@cldmv/slothlet/helpers/intrinsics";

/**
 * The global key of the record of who loaded each file vite transformed (#714), as `helpers/instance-imports` names it.
 * @type {string}
 * @private
 */
const VITE_LOADED_BY = "@cldmv/slothlet.viteLoadedBy";

/**
 * `URL.createObjectURL` and `URL.revokeObjectURL`, as they were when slothlet loaded; undefined where the host has none.
 * @type {Function|undefined}
 * @private
 */
const CREATE_OBJECT_URL = URLs.createObjectURL;
const REVOKE_OBJECT_URL = URLs.revokeObjectURL;

/**
 * vitest's worker global, as it was when slothlet loaded, or null outside vitest.
 * @type {object|null}
 * @private
 */
const VITEST_WORKER = globalThis.__vitest_worker__ ?? null;

/**
 * Whether making code from a string is refused here, tried with the `Function` constructor slothlet loaded with.
 * @returns {boolean} True when it throws an `EvalError`.
 * @private
 */
function codeFromStringsRefused() {
	try {
		new NativeFunction("return 1");
		return false;
	} catch (error) {
		return error instanceof EvalError || error?.name === "EvalError";
	}
}

/**
 * Whether a script from a `blob:` or `data:` URL is refused here, tried with a module that exports nothing.
 * @param {"blob"|"data"} kind - The URL scheme.
 * @returns {Promise<boolean>} True when the import is refused.
 * @private
 */
async function importRefused(kind) {
	let url = "data:text/javascript,export%20%7B%7D";
	if (kind === "blob") {
		if (typeof Blob !== "function" || typeof CREATE_OBJECT_URL !== "function") return true;
		url = Reflect.apply(CREATE_OBJECT_URL, URL, [new Blob(["export {}"], { type: "text/javascript" })]);
	}
	try {
		await import(/* @vite-ignore */ url);
		return false;
	} catch {
		return true;
	} finally {
		if (kind === "blob" && typeof REVOKE_OBJECT_URL === "function") Reflect.apply(REVOKE_OBJECT_URL, URL, [url]);
	}
}

/**
 * How many records of who loaded a file the vite plugin's virtual modules made and slothlet accepted, or null when the
 * registry offers no count.
 * @returns {number|null} The count.
 * @private
 */
function viteRecords() {
	const recorded = globalThis[Symbols.for(VITE_LOADED_BY)]?.recorded;
	return typeof recorded === "function" ? recorded() : null;
}

/**
 * What the checks ask of the host.
 * @typedef {object} BaselineProbes
 * @property {function(): boolean} codeFromStringsRefused - Whether making code from a string is refused.
 * @property {function(string): Promise<boolean>} importRefused - Whether a script from a `blob:` or `data:` URL is refused.
 * @property {function(): boolean} stackRealm - Whether stacks are read from slothlet's own realm.
 * @property {object|null} vitestWorker - vitest's worker global, or null outside vitest.
 * @property {function(): (number|null)} viteRecords - How many vite plugin records slothlet accepted, or null.
 * @private
 */

/**
 * The probes the checks use, as slothlet loaded them. A test passes stand-ins.
 * @type {BaselineProbes}
 * @private
 */
const PROBES = { codeFromStringsRefused, importRefused, stackRealm: ownRealmInUse, vitestWorker: VITEST_WORKER, viteRecords };

/**
 * One check's result.
 * @param {string} id - The check.
 * @param {function(): (boolean|Promise<boolean>)} probe - Whether it is met; a probe that throws is not met.
 * @param {function(): string} reason - The reason it is not met, translated.
 * @returns {Promise<{id: string, met: boolean, reason: string|null}>} The result.
 * @private
 */
async function check(id, probe, reason) {
	let met;
	try {
		met = (await probe()) === true;
	} catch {
		met = false;
	}
	return { id, met, reason: met ? null : reason() };
}

/**
 * Run the baseline checks for where the instance runs.
 * @param {"node"|"browser"} envTarget - Where the instance runs.
 * @param {BaselineProbes} [probes] - Stand-ins for the probes, for a test.
 * @returns {Promise<{met: boolean, checks: Array<{id: string, met: boolean, reason: string|null}>}>} Whether every check
 *   is met, and each check.
 * @internal
 * @example
 * const { met, checks } = await runBaseline("node");
 */
export async function runBaseline(envTarget, probes = PROBES) {
	const checks = [];
	if (envTarget === "browser") {
		listPush(
			checks,
			await check(
				"csp-eval",
				() => probes.codeFromStringsRefused(),
				() => translate("BASELINE_CSP_EVAL_ALLOWED")
			)
		);
		listPush(
			checks,
			await check(
				"csp-blob-script",
				() => probes.importRefused("blob"),
				() => translate("BASELINE_CSP_BLOB_ALLOWED")
			)
		);
		listPush(
			checks,
			await check(
				"csp-data-script",
				() => probes.importRefused("data"),
				() => translate("BASELINE_CSP_DATA_ALLOWED")
			)
		);
	} else {
		listPush(
			checks,
			await check(
				"node-code-generation",
				() => probes.codeFromStringsRefused(),
				() => translate("BASELINE_NODE_CODE_GENERATION_ALLOWED")
			)
		);
		listPush(
			checks,
			await check(
				"node-stack-realm",
				() => probes.stackRealm(),
				() => translate("BASELINE_NODE_STACK_REALM_MISSING")
			)
		);
		if (probes.vitestWorker) {
			listPush(
				checks,
				await check(
					"vitest-plugin",
					() => (probes.viteRecords() ?? 0) > 0,
					() => translate("BASELINE_VITEST_PLUGIN_ABSENT")
				)
			);
		}
	}
	return { met: ArrayMethods.every(checks, (entry) => entry.met), checks };
}
