/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/permission-baseline.mjs
 *	@Date: 2026-11-16T03:00:00-08:00 (1794826800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:51-08:00 (1794882531)
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
 * - `async-context-frame` (Node): Node's `AsyncContextFrame` is on. Where it is off (Node 22's default, or a later
 *   Node run with `--no-async-context-frame`), Node keeps what an `AsyncLocalStorage` holds on async resources module
 *   code can reach. Tested by running a storage of slothlet's own with a marker and looking for the marker on the
 *   running async resource and a fresh promise; the flags are never parsed, since a version's default and flags passed
 *   through `NODE_OPTIONS` decide it as well. Run once per process.
 * - `vitest-plugin` (Node, under vitest): the `slothletInstanceImports()` plugin is loaded: its records of who loaded
 *   each file have reached slothlet.
 *
 * The baseline holds only what slothlet needs to tell the caller and refuse correctly. In Node, slothlet tells `eval`
 * and `Function` code apart and refuses it without help, so `--disallow-code-generation-from-strings` is recommended
 * hardening, not a check. slothlet's own stack realm (`helpers/stack-read`) is always there on supported Node, and
 * without it caller checks fail closed, so it is not a check either.
 *
 * A check passed means only that what slothlet could test passed. Code that ran before slothlet (the page's own
 * scripts, an extension, a compromised dependency) can have changed what the checks read.
 *
 * @module @cldmv/slothlet/helpers/permission-baseline
 * @internal
 */

import { translate } from "#i18n";
import {
	ArrayMethods,
	Blob,
	EvalError,
	listPush,
	mapEntriesToArray,
	NativeFunction,
	NativeProcess,
	Objects,
	parseInt,
	Processes,
	Promises,
	Reflect,
	Set,
	SetMethods,
	Symbols,
	URL,
	URLs
} from "#helpers/intrinsics";

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
 * `node:async_hooks`, as slothlet loaded, or null where the platform has none (a browser).
 * @type {object|null}
 * @private
 */
const ASYNC_HOOKS = (() => {
	try {
		return Processes.getBuiltinModule?.("node:async_hooks") ?? null;
	} catch {
		// A platform that refuses the lookup has no async hooks to check.
		/* v8 ignore next */
		return null;
	}
})();

/**
 * What the `async-context-frame` probe uses, taken as slothlet loads: `AsyncLocalStorage` with its `run` and `disable`,
 * and `executionAsyncResource`. Null where any is missing.
 * @type {{Storage: Function, run: Function, disable: Function, executionAsyncResource: Function}|null}
 * @private
 */
const FRAME_PROBE_BUILTINS = (() => {
	const Storage = ASYNC_HOOKS?.AsyncLocalStorage;
	const run = Storage?.prototype?.run;
	const disable = Storage?.prototype?.disable;
	const executionAsyncResource = ASYNC_HOOKS?.executionAsyncResource;
	if (
		typeof Storage !== "function" ||
		typeof run !== "function" ||
		typeof disable !== "function" ||
		typeof executionAsyncResource !== "function"
	) {
		return null;
	}
	return Objects.freeze({ Storage, run, disable, executionAsyncResource });
})();

/**
 * Node's major version, as slothlet loaded, or 0 where it is not Node.
 * @type {number}
 * @private
 */
const NODE_MAJOR = parseInt(NativeProcess?.versions?.node ?? "0", 10) || 0;

/**
 * How many steps from an async resource the probe looks for its marker. Node keeps the value at one step
 * (`Symbol(kResourceStore)`) or two (a map under `Symbol(kAsyncLocalStorageContext)`, Node 24.22); the rest is margin.
 * @type {number}
 * @private
 */
const FRAME_PROBE_DEPTH = 4;

/**
 * Whether `marker` is found within a few steps of `value`, through own keys (symbols too, data properties only, so no
 * getter runs) and map entries.
 * @param {*} value - Where to look.
 * @param {object} marker - What to look for.
 * @param {number} depth - Steps taken so far.
 * @param {Set<object>} seen - What has been looked at.
 * @returns {boolean} True when the marker is there.
 * @private
 */
function holdsMarker(value, marker, depth, seen) {
	if (value === marker) return true;
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	if (depth > FRAME_PROBE_DEPTH || SetMethods.has(seen, value)) return false;
	SetMethods.add(seen, value);
	let entries;
	try {
		// Throws for anything that is not a map.
		entries = mapEntriesToArray(value);
	} catch {
		entries = null;
	}
	if (entries) {
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index];
			if (holdsMarker(entry[0], marker, depth + 1, seen) || holdsMarker(entry[1], marker, depth + 1, seen)) return true;
		}
	}
	let keys;
	try {
		keys = Reflect.ownKeys(value);
	} catch {
		return false;
	}
	for (let index = 0; index < keys.length; index++) {
		let descriptor;
		try {
			descriptor = Reflect.getOwnPropertyDescriptor(value, keys[index]);
		} catch {
			continue;
		}
		if (descriptor && "value" in descriptor && holdsMarker(descriptor.value, marker, depth + 1, seen)) return true;
	}
	return false;
}

/**
 * The probe's answer, once it has run in this process; undefined before.
 * @type {boolean|undefined}
 * @private
 */
let frameOnFound;

/**
 * Whether Node's `AsyncContextFrame` is on: inside a storage of the probe's own, run with a fresh marker, the marker is
 * not found on the running async resource or a fresh promise. Tested once per process.
 *
 * Where the frame is off, Node puts what every storage holds on each async resource as it is made, promises included.
 * Where it is on, a promise carries nothing a module can list, but an `AsyncResource` keeps the whole frame (a map of
 * every storage's value) under a symbol of its own, so a new `AsyncResource` holds the marker in both modes and is not
 * looked at.
 * @returns {boolean} True when the marker is out of reach.
 * @private
 */
function asyncContextFrameOn() {
	if (frameOnFound !== undefined) return frameOnFound;
	const { Storage, run, disable, executionAsyncResource } = FRAME_PROBE_BUILTINS;
	const marker = Objects.freeze(Objects.create(null));
	const storage = new Storage();
	let exposed = false;
	try {
		Reflect.apply(run, storage, [
			marker,
			() => {
				exposed = holdsMarker(executionAsyncResource(), marker, 0, new Set()) || holdsMarker(Promises.resolve(), marker, 0, new Set());
			}
		]);
	} finally {
		Reflect.apply(disable, storage, []);
	}
	frameOnFound = !exposed;
	return frameOnFound;
}

/**
 * The reason `async-context-frame` is not met, with the fix for this Node: Node 22 and 23 turn it on with
 * `--experimental-async-context-frame`; Node 24 and later have it on unless started with `--no-async-context-frame`.
 * @returns {string} The reason, translated.
 * @private
 */
function asyncContextFrameReason() {
	if (NODE_MAJOR !== 0 && NODE_MAJOR < 24) {
		return translate("PERMISSION_BASELINE_REASON_ASYNC_CONTEXT_FRAME_OFF_ENABLE", { flag: "--experimental-async-context-frame" });
	}
	return translate("PERMISSION_BASELINE_REASON_ASYNC_CONTEXT_FRAME_OFF_REMOVE_FLAG", {
		flag: "--no-async-context-frame",
		env: "NODE_OPTIONS"
	});
}

/**
 * What the checks ask of the host.
 * @typedef {object} BaselineProbes
 * @property {function(): boolean} codeFromStringsRefused - Whether making code from a string is refused.
 * @property {function(string): Promise<boolean>} importRefused - Whether a script from a `blob:` or `data:` URL is refused.
 * @property {object|null} vitestWorker - vitest's worker global, or null outside vitest.
 * @property {function(): (number|null)} viteRecords - How many vite plugin records slothlet accepted, or null.
 * @property {(function(): boolean)|null} [asyncContextFrameOn] - Whether Node's `AsyncContextFrame` is on; null (or
 *   absent) where there is no `node:async_hooks` to test, and then the check does not apply.
 * @private
 */

/**
 * The probes the checks use, as slothlet loaded them. A test passes stand-ins.
 * @type {BaselineProbes}
 * @private
 */
const PROBES = {
	codeFromStringsRefused,
	importRefused,
	vitestWorker: VITEST_WORKER,
	viteRecords,
	asyncContextFrameOn: FRAME_PROBE_BUILTINS ? asyncContextFrameOn : null
};

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
				() => translate("PERMISSION_BASELINE_REASON_CSP_EVAL_ALLOWED")
			)
		);
		listPush(
			checks,
			await check(
				"csp-blob-script",
				() => probes.importRefused("blob"),
				() => translate("PERMISSION_BASELINE_REASON_CSP_BLOB_ALLOWED")
			)
		);
		listPush(
			checks,
			await check(
				"csp-data-script",
				() => probes.importRefused("data"),
				() => translate("PERMISSION_BASELINE_REASON_CSP_DATA_ALLOWED")
			)
		);
	} else {
		if (typeof probes.asyncContextFrameOn === "function") {
			listPush(checks, await check("async-context-frame", () => probes.asyncContextFrameOn(), asyncContextFrameReason));
		}
		if (probes.vitestWorker) {
			listPush(
				checks,
				await check(
					"vitest-plugin",
					() => (probes.viteRecords() ?? 0) > 0,
					() => translate("PERMISSION_BASELINE_REASON_VITEST_PLUGIN_ABSENT")
				)
			);
		}
	}
	return { met: ArrayMethods.every(checks, (entry) => entry.met), checks };
}
