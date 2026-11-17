/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/node-callback-context.mjs
 *	@Date: 2026-11-17T13:18:06-08:00 (1794950286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:32:41-08:00 (1794951161)
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
 */

import { pinToCurrentFlow } from "#helpers/caller-pinning";
import { openLayer, closeLayer, holdsValue, markLayer } from "#helpers/boundary-patch-layers";
import { listPush, Objects, Processes, Reflect } from "#helpers/intrinsics";
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
 * What is patched: the host object, the key, the wrapper installed and its layer, in install order.
 * @type {Array<{host: object, name: string, layer: {active: boolean, below: *}, wrapper: Function}>}
 * @private
 */
const patched = [];

/**
 * Whether the patches are installed.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

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
		/* v8 ignore next -- a key from Reflect.ownKeys always has a descriptor; guards an exotic host. */
		if (!descriptor) continue;
		Objects.defineProperty(wrapper, key, descriptor);
	}
}

/**
 * Replace `host[name]` with a wrapper that pins a trailing callback, and remember it for removal.
 * @param {object} host - The object carrying the function.
 * @param {string} name - Its key.
 * @returns {Function|null} The wrapper installed, or null when none was.
 * @private
 */
function runtime_patch(host, name) {
	const installed = host[name];
	if (typeof installed !== "function") return null;
	// Shared with any other copy of slothlet in the realm (see boundary-patch-layers).
	const layer = openLayer(installed);
	const below = layer.below;
	const wrapper = function (...args) {
		const last = args.length - 1;
		// A call with no callback, or a wrapper switched off under another copy's, is Node's own call; outside every flow
		// and module call the callback is handed on as it is (see pinToCurrentFlow).
		if (last < 0 || typeof args[last] !== "function" || !layer.active) return Reflect.apply(below, this, args);
		args[last] = pinToCurrentFlow(args[last]);
		return Reflect.apply(below, this, args);
	};
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
	/* v8 ignore next 4 */
	if (!holdsValue(host, name, wrapper)) {
		layer.active = false;
		return null;
	}
	listPush(patched, { host, name, layer, wrapper });
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
	for (let entryIndex = 0; entryIndex < COVERED.length; entryIndex++) {
		const { host: key, names } = COVERED[entryIndex];
		const host = HOSTS[key];
		if (host == null) continue;
		for (let nameIndex = 0; nameIndex < names.length; nameIndex++) {
			const wrapper = runtime_patch(host, names[nameIndex]);
			// `fs.realpath.native` was copied onto the `fs.realpath` wrapper, and is patched there.
			if (wrapper !== null && key === "fs" && names[nameIndex] === "realpath") runtime_patch(wrapper, "native");
		}
	}
	// ES modules read a builtin's exports through bindings Node refreshes on request.
	if (patched.length !== 0) SYNC_BUILTIN_ESM_EXPORTS?.();
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
	let restored = false;
	for (let index = patched.length - 1; index >= 0; index--) {
		const { host, name, layer, wrapper } = patched[index];
		const below = closeLayer(layer);
		if (holdsValue(host, name, wrapper)) {
			host[name] = below;
			restored = true;
		}
	}
	patched.length = 0;
	isPatchingEnabled = false;
	if (restored) SYNC_BUILTIN_ESM_EXPORTS?.();
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
	return { disableNodeCallbackPatching, enableNodeCallbackPatching };
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
export {
	guarded_enableNodeCallbackPatching as enableNodeCallbackPatching,
	guarded_disableNodeCallbackPatching as disableNodeCallbackPatching
};
