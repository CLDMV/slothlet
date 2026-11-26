/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/node-callback-context.mjs
 *	@Date: 2026-11-17T13:18:06-08:00 (1794950286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:44:42-08:00 (1795635882)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carries the run and the caller into the callbacks of Node's callback-style APIs, in the live runtime.
 * @module @cldmv/slothlet/helpers/node-callback-context
 * @internal
 *
 * @description
 * `fs.readFile(file, cb)`, `dns.lookup(host, cb)` and `crypto.randomBytes(n, cb)` hand their callback to Node's native
 * layer, which calls it from the event loop with an empty stack: no promise job, timer or listener carries it, so the
 * live runtime's patches never see it. Inside a `context.run()` the callback then read whatever context was in place
 * when it fired, not the run it was handed in, and a module's callback ran as no one.
 *
 * Each function listed in {@link COVERED} is replaced with a wrapper that, when its last argument is a function, pins
 * that callback to the current flow and caller (`pinToCurrentFlow` in `helpers/caller-pinning`), as the scheduler patches do for a
 * timer. Anything else passes straight through: the arguments, the receiver, the result and any throw are Node's own.
 * The wrapper keeps the original's `name` and `length` and carries its own properties across (`util.promisify.custom`,
 * the promisify argument names, `fs.realpath.native`), so `util.promisify` of a patched function works as before.
 *
 * The APIs whose callbacks Node already delivers through a carried boundary (an emitter, `process.nextTick` or a
 * promise reaction) are left alone: zlib's convenience forms, `child_process.exec`/`execFile`, `fs.cp`, `fs.glob`,
 * `fs.watch`/`fs.watchFile`, streams, sockets and `http`/`https`/`net` callbacks. `fs.promises`, `dns.promises` and
 * every `*Sync` form need nothing.
 *
 * The functions are replaced on the module objects, so `require("node:fs").readFile`, `fs.readFile` of a default import
 * and `import { readFile } from "node:fs"` all see the wrapper (ES module bindings of a builtin are refreshed through
 * `module.syncBuiltinESMExports()`). A reference taken before the first live instance installed the patch, such as a
 * destructured `const { readFile } = require("node:fs")`, keeps Node's function. Installed once per process through
 * the shared layer registry, removed when the last live instance shuts down; a wrapper another library has since
 * covered is left in place and passes through from then on. A browser has none of these modules, and nothing is
 * patched there.
 *
 * Node serves `crypto.randomInt(…, cb)` from a shared cache of random bytes; a call that finds it empty waits on one
 * shared refill, and every waiting callback is called from the async context of the call that started the refill, so
 * `AsyncLocalStorage`, and the async runtime with it, would hand a second flow the first one's store. While an instance
 * on the async runtime exists, the functions listed in {@link BATCHED} are wrapped too: a call with a callback takes its
 * value from the synchronous form (which refills the cache in place when it is empty) and hands it to the callback
 * through `process.nextTick()`, which carries the caller's async context. That is how Node delivers every value the
 * cache already holds. No other covered function mixes flows this way.
 */

import { holdForCurrentFlow, pinToCurrentFlow, releaseAfterCall } from "#helpers/caller-pinning";
import { openLayer, closeLayer, holdsValue, markLayer } from "#helpers/boundary-patch-layers";
import { copyList, listPush, listSplice, Objects, Processes, Reflect } from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * The functions patched: the object carrying them (a key of {@link HOSTS}) and their names. A name the running Node does
 * not have is skipped. `fs.realpath.native` is patched on the `fs.realpath` wrapper once that is installed.
 * @type {ReadonlyArray<{host: string, names: ReadonlyArray<string>}>}
 * @private
 */
const COVERED = Objects.freeze([
	{
		host: "fs",
		names: [
			"access",
			"appendFile",
			"chmod",
			"chown",
			"close",
			"copyFile",
			"exists",
			"fchmod",
			"fchown",
			"fdatasync",
			"fstat",
			"fsync",
			"ftruncate",
			"futimes",
			"lchmod",
			"lchown",
			"link",
			"lstat",
			"lutimes",
			"mkdir",
			"mkdtemp",
			"open",
			"opendir",
			"read",
			"readdir",
			"readFile",
			"readlink",
			"readv",
			"realpath",
			"rename",
			"rm",
			"rmdir",
			"stat",
			"statfs",
			"symlink",
			"truncate",
			"unlink",
			"utimes",
			"write",
			"writeFile",
			"writev"
		]
	},
	{ host: "fs.Dir", names: ["read", "close"] },
	{
		host: "dns",
		names: [
			"lookup",
			"lookupService",
			"resolve",
			"resolve4",
			"resolve6",
			"resolveAny",
			"resolveCaa",
			"resolveCname",
			"resolveMx",
			"resolveNaptr",
			"resolveNs",
			"resolvePtr",
			"resolveSoa",
			"resolveSrv",
			"resolveTlsa",
			"resolveTxt",
			"reverse"
		]
	},
	{
		host: "dns.Resolver",
		names: [
			"resolve",
			"resolve4",
			"resolve6",
			"resolveAny",
			"resolveCaa",
			"resolveCname",
			"resolveMx",
			"resolveNaptr",
			"resolveNs",
			"resolvePtr",
			"resolveSoa",
			"resolveSrv",
			"resolveTlsa",
			"resolveTxt",
			"reverse"
		]
	},
	{
		host: "crypto",
		names: [
			"argon2",
			"checkPrime",
			"decapsulate",
			"diffieHellman",
			"encapsulate",
			"generateKey",
			"generateKeyPair",
			"generatePrime",
			"hkdf",
			"pbkdf2",
			"randomBytes",
			"randomFill",
			"randomInt",
			"scrypt",
			"sign",
			"verify"
		]
	}
]);

/**
 * The covered functions whose callbacks Node calls from another call's async context when calls overlap: concurrent
 * `crypto.randomInt` calls wait on one shared refill, and the callbacks run in the context of the call that started it.
 * Each one's synchronous form (the call without its callback) returns the value the callback is handed. Wrapped for the
 * async runtime as well (see {@link enableAsyncCallbackServing}).
 * @type {ReadonlyArray<{host: string, names: ReadonlyArray<string>}>}
 * @private
 */
const BATCHED = Objects.freeze([{ host: "crypto", names: ["randomInt"] }]);

/**
 * What is patched: the host object, the key, the wrapper installed and its layer, and what the wrapper does with a
 * trailing callback (`pin`: pin it to the live runtime's flow and caller; `serve`: take the value from the synchronous
 * form and hand it to the callback through `process.nextTick()`), in install order.
 * @type {Array<{host: object, name: string, layer: {active: boolean, below: *}, wrapper: Function, pin: boolean, serve: boolean}>}
 * @private
 */
const patched = [];

/**
 * Whether a live-runtime instance holds the patches.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Whether an async-runtime instance holds the {@link BATCHED} patches.
 * @type {boolean}
 * @private
 */
let isServingEnabled = false;

/**
 * A Node builtin, when the platform has it.
 * @param {string} id - The builtin's id.
 * @returns {object|null} Its exports, or null.
 * @private
 */
function runtime_builtin(id) {
	try {
		return Processes.getBuiltinModule?.(id) ?? null;
	} catch {
		// A platform that refuses the lookup has no such builtin to patch.
		/* v8 ignore next */
		return null;
	}
}

/**
 * `module.syncBuiltinESMExports`, taken as slothlet loads, so code that replaces it later does not run inside the patch.
 * Undefined where the platform has no such builtin.
 * @type {Function|undefined}
 * @private
 */
const SYNC_BUILTIN_ESM_EXPORTS = runtime_builtin("node:module")?.syncBuiltinESMExports;

/**
 * The objects carrying the patched functions, taken as slothlet loads (the builtin modules and the prototypes of
 * `fs.Dir` and `dns.Resolver`); the functions on them are read when the patch is turned on, as they are then. A host
 * the platform lacks is null.
 * @type {Readonly<Record<string, object|null>>}
 * @private
 */
const HOSTS = (() => {
	const fs = runtime_builtin("node:fs");
	const dns = runtime_builtin("node:dns");
	return Objects.freeze({
		__proto__: null,
		fs,
		"fs.Dir": fs?.Dir?.prototype ?? null,
		dns,
		"dns.Resolver": dns?.Resolver?.prototype ?? null,
		crypto: runtime_builtin("node:crypto")
	});
})();

/**
 * Give the wrapper the original's `name` and `length` and copy the original's other own properties onto it by
 * descriptor: `util.promisify.custom`, the promisify argument names, `fs.realpath.native`. The wrapper's own
 * `prototype` stays its own.
 * @param {Function} wrapper - The wrapper.
 * @param {Function} original - The function it wraps.
 * @returns {void}
 * @private
 */
function runtime_carryOwn(wrapper, original) {
	const keys = Reflect.ownKeys(original);
	for (let index = 0; index < keys.length; index++) {
		const key = keys[index];
		if (key === "prototype") continue;
		const descriptor = Reflect.getOwnPropertyDescriptor(original, key);
		/* v8 ignore if -- a key from Reflect.ownKeys always has a descriptor; guards an exotic host. */
		if (!descriptor) continue;
		Objects.defineProperty(wrapper, key, descriptor);
	}
}

/**
 * The entry of `host[name]` in {@link patched}, if it is patched.
 * @param {object} host - The object carrying the function.
 * @param {string} name - Its key.
 * @returns {object|null} The entry, or null.
 * @private
 */
function runtime_entry(host, name) {
	for (let index = 0; index < patched.length; index++) {
		const entry = patched[index];
		if (entry.host === host && entry.name === name) return entry;
	}
	return null;
}

/**
 * Replace `host[name]` with a wrapper that pins or serves a trailing callback, as its entry says, and remember it for
 * removal. A function patched already only has its entry updated.
 * @param {object} host - The object carrying the function.
 * @param {string} name - Its key.
 * @param {boolean} pin - Whether the callback is pinned to the live runtime's flow and caller.
 * @param {boolean} serve - Whether the value is taken from the synchronous form and handed to the callback through
 *   `process.nextTick()`.
 * @returns {Function|null} The wrapper in place, or null when none is.
 * @private
 */
function runtime_patch(host, name, pin, serve) {
	const existing = runtime_entry(host, name);
	if (existing !== null) {
		existing.pin = existing.pin || pin;
		existing.serve = existing.serve || serve;
		return existing.wrapper;
	}
	const installed = host[name];
	if (typeof installed !== "function") return null;
	// Shared with any other copy of slothlet in the realm (see boundary-patch-layers).
	const layer = openLayer(installed);
	const below = layer.below;
	const entry = { host, name, layer, wrapper: null, pin, serve };
	const wrapper = function (...args) {
		const last = args.length - 1;
		// A call with no callback, or a wrapper switched off under another copy's, is Node's own call; outside every flow
		// and module call the callback is handed on as it is (see pinToCurrentFlow).
		if (last < 0 || typeof args[last] !== "function" || !layer.active) return Reflect.apply(below, this, args);
		let callback = entry.pin ? pinToCurrentFlow(args[last]) : args[last];
		// Called once: in a run() / scope() it is the run's work until then (see holdForCurrentFlow).
		const release = entry.pin ? holdForCurrentFlow() : null;
		if (release !== null) callback = releaseAfterCall(callback, release);
		// A call with nothing before its callback is malformed: Node's own call reports it.
		if (entry.serve && last > 0) {
			// The same checks and the same value as Node's own call; only the delivery differs, as Node's own does for a
			// value its cache already holds. A refill the synchronous form needs is done in place.
			const value = Reflect.apply(below, this, copyList(args, 0, last));
			Processes.nextTick(callback, undefined, value);
			return undefined;
		}
		args[last] = callback;
		if (release === null) return Reflect.apply(below, this, args);
		try {
			return Reflect.apply(below, this, args);
		} catch (error) {
			// Refused before it began: the callback is never called.
			release();
			throw error;
		}
	};
	entry.wrapper = wrapper;
	runtime_carryOwn(wrapper, below);
	markLayer(wrapper, layer);
	try {
		host[name] = wrapper;
	} catch {
		// A host that refuses the write keeps its own function.
		/* v8 ignore next 2 */
		layer.active = false;
		return null;
	}
	// A read-only property ignores the write outside strict mode.
	/* v8 ignore if */
	if (!holdsValue(host, name, wrapper)) {
		layer.active = false;
		return null;
	}
	listPush(patched, entry);
	return wrapper;
}

/**
 * Pin the callbacks of Node's callback-style APIs to the flow and caller that handed them in.
 *
 * Called when an instance on the live runtime is created; later calls are ignored. Does nothing where the builtins are
 * absent (a browser).
 *
 * @returns {void}
 * @public
 * @example
 * enableNodeCallbackPatching();
 */
function enableNodeCallbackPatching() {
	if (isPatchingEnabled) return;
	isPatchingEnabled = true;
	runtime_install(COVERED, true, false);
}

/**
 * Deliver the callbacks of the functions in {@link BATCHED} through `process.nextTick()`, in the async context they
 * were handed in, so overlapping calls in different flows each see their own.
 *
 * Called when an instance on the async runtime is created; later calls are ignored. Does nothing where the builtins
 * are absent (a browser).
 *
 * @returns {void}
 * @public
 * @example
 * enableAsyncCallbackServing();
 */
function enableAsyncCallbackServing() {
	if (isServingEnabled) return;
	isServingEnabled = true;
	runtime_install(BATCHED, false, true);
}

/**
 * Patch every function listed, or add to what the wrapper of one patched already does.
 * @param {ReadonlyArray<{host: string, names: ReadonlyArray<string>}>} list - The functions.
 * @param {boolean} pin - Whether their callbacks are pinned to the live runtime's flow and caller.
 * @param {boolean} serve - Whether their values are taken from the synchronous form and handed to the callback through
 *   `process.nextTick()`.
 * @returns {void}
 * @private
 */
function runtime_install(list, pin, serve) {
	const before = patched.length;
	for (let entryIndex = 0; entryIndex < list.length; entryIndex++) {
		const { host: key, names } = list[entryIndex];
		const host = HOSTS[key];
		if (host == null) continue;
		for (let nameIndex = 0; nameIndex < names.length; nameIndex++) {
			const wrapper = runtime_patch(host, names[nameIndex], pin, serve);
			// `fs.realpath.native` was copied onto the `fs.realpath` wrapper, and is patched there.
			if (wrapper !== null && key === "fs" && names[nameIndex] === "realpath") runtime_patch(wrapper, "native", pin, serve);
		}
	}
	// ES modules read a builtin's exports through bindings Node refreshes on request.
	if (patched.length !== before) SYNC_BUILTIN_ESM_EXPORTS?.();
}

/**
 * Take one job off every wrapper, and put back the functions whose wrapper is left with none, where that wrapper is
 * still the one in place, last installed first. A wrapper something else has since covered passes through from then on.
 * @param {"pin"|"serve"} job - The job taken off.
 * @returns {void}
 * @private
 */
function runtime_uninstall(job) {
	let restored = false;
	for (let index = patched.length - 1; index >= 0; index--) {
		const entry = patched[index];
		entry[job] = false;
		if (entry.pin || entry.serve) continue;
		const { host, name, layer, wrapper } = entry;
		const below = closeLayer(layer);
		if (holdsValue(host, name, wrapper)) {
			host[name] = below;
			restored = true;
		}
		listSplice(patched, index, 1);
	}
	if (restored) SYNC_BUILTIN_ESM_EXPORTS?.();
}

/**
 * Put back what {@link enableNodeCallbackPatching} replaced, where its wrapper is still the one in place, last installed
 * first. A wrapper something else has since covered passes through from then on.
 * @returns {void}
 * @public
 * @example
 * disableNodeCallbackPatching();
 */
function disableNodeCallbackPatching() {
	if (!isPatchingEnabled) return;
	isPatchingEnabled = false;
	runtime_uninstall("pin");
}

/**
 * Take back what {@link enableAsyncCallbackServing} added: a wrapper left with nothing to do is removed as
 * {@link disableNodeCallbackPatching} removes one.
 * @returns {void}
 * @public
 * @example
 * disableAsyncCallbackServing();
 */
function disableAsyncCallbackServing() {
	if (!isServingEnabled) return;
	isServingEnabled = false;
	runtime_uninstall("serve");
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["slothlet"])) throw ownBindingsRefusal("lib/helpers/node-callback-context", import.meta.url);
	return { disableAsyncCallbackServing, disableNodeCallbackPatching, enableAsyncCallbackServing, enableNodeCallbackPatching };
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof enableNodeCallbackPatching} */
const guarded_enableNodeCallbackPatching = guardInternal(enableNodeCallbackPatching, "enableNodeCallbackPatching", import.meta.url);
/** @type {typeof disableNodeCallbackPatching} */
const guarded_disableNodeCallbackPatching = guardInternal(disableNodeCallbackPatching, "disableNodeCallbackPatching", import.meta.url);
/** @type {typeof enableAsyncCallbackServing} */
const guarded_enableAsyncCallbackServing = guardInternal(enableAsyncCallbackServing, "enableAsyncCallbackServing", import.meta.url);
/** @type {typeof disableAsyncCallbackServing} */
const guarded_disableAsyncCallbackServing = guardInternal(disableAsyncCallbackServing, "disableAsyncCallbackServing", import.meta.url);
export {
	guarded_enableNodeCallbackPatching as enableNodeCallbackPatching,
	guarded_disableNodeCallbackPatching as disableNodeCallbackPatching,
	guarded_enableAsyncCallbackServing as enableAsyncCallbackServing,
	guarded_disableAsyncCallbackServing as disableAsyncCallbackServing
};
