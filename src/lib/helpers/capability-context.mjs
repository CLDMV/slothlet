/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/capability-context.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:44:36-08:00 (1795635876)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Refuses module code the built-in capabilities a host has not opened for it, while an instance with the
 * permission system on is up.
 * @module @cldmv/slothlet/helpers/capability-context
 * @internal
 *
 * @description
 * The language and Node offer ways to turn a string into code, to import code a module writes out as a URL, and to
 * change how every later file loads. The permission system already refuses evaluated code any standing of a module's
 * (its frames name no file), but the code still runs. While an instance with the permission system configured is up,
 * this file wraps each entry point, the way the other boundary patches wrap theirs (see
 * {@link module:@cldmv/slothlet/helpers/boundary-patch-layers}), and asks every such instance first whether the code
 * calling it is a module's that no rule opens the capability for. Host code, and everything while the permission
 * system is off or disabled, passes straight through to the function wrapped, with exactly what it was given.
 *
 * - `capability:code`: the `Function`, `AsyncFunction`, `GeneratorFunction` and `AsyncGeneratorFunction`
 *   constructors, by every route to them (the global, each prototype's `constructor`, a subclass, `Reflect.construct`),
 *   a string given to `setTimeout` / `setInterval` (see the scheduler patch), the `vm` functions that compile a string,
 *   `Module.prototype._compile` called by anything but Node's own loader, and Node's `contextify` binding.
 * - `capability:imports`: an `import()` of a `data:` or `blob:` URL (see the resolve hook in `instance-imports`).
 * - `capability:loader`: `module.registerHooks()` and `module.register()`.
 *
 * Direct `eval` is not wrapped: wrapping the global would make every direct `eval` an indirect one. Its code names no
 * file, so it already has no module's standing.
 */

import { openLayer, closeLayer, holdsValue, markLayer } from "#helpers/boundary-patch-layers";
import {
	ArrayMethods,
	decodeURIComponent,
	FunctionMethods,
	listPush,
	listSplice,
	Map,
	MapMethods,
	mapValues,
	NativeProxy,
	Objects,
	Processes,
	Reflect,
	RegExpMethods,
	StringMethods,
	Symbol,
	Symbols,
	URL,
	URLMethods
} from "#helpers/intrinsics";
import { readStack, stackSites } from "#helpers/stack-read";
import { isOwnTopLevelOf, ownBindingsRefusal, internals as instanceImportsInternals } from "#helpers/instance-imports";

const { setCapabilityCheck, instanceClaimed } = instanceImportsInternals("lib/helpers/capability-context");

/**
 * The checks of the instances that are up with the permission system configured, by instance id: each throws
 * `PERMISSION_CAPABILITY_REFUSED` for module code of its own that no rule opens a capability for.
 * @type {Map<string, function(string, string, ?string): void>}
 * @private
 */
const CHECKS = new Map();

/**
 * Ask every instance whether the code running may use a capability.
 * @param {string} name - The capability.
 * @param {string} route - What the code used.
 * @param {string|null} [importer=null] - The importing file's URL, for an import being linked.
 * @param {*} [filename=null] - The file name the code is compiled under, when one is given.
 * @param {boolean|null} [runnerCompile=false] - Whether the compile is vitest's own compile of the code its server
 *   sent for that file (see {@link module:@cldmv/slothlet/helpers/vitest-worker-setup}); null, under vitest only, for
 *   a compile shaped as vitest's runner makes one when no worker setup records the server's replies, so it cannot be
 *   told either way.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
 * @internal
 * @example
 * checkCapability("code", "setTimeout");
 */
export function checkCapability(name, route, importer = null, filename = null, runnerCompile = false) {
	if (MapMethods.size(CHECKS) === 0) return;
	for (const check of mapValues(CHECKS)) check(name, route, importer, filename, runnerCompile);
}

/**
 * Whether an instance is up with a capability check of its own registered: code compiled under a name tagged with
 * that instance's id is then judged by that instance's check, not by any other's.
 * @param {*} instanceID - The instance id a name is tagged with.
 * @returns {boolean} True while that instance's check is registered.
 * @internal
 * @example
 * hasCapabilityCheck("b"); // true while instance "b" is up with the permission system configured
 */
export function hasCapabilityCheck(instanceID) {
	return typeof instanceID === "string" && MapMethods.has(CHECKS, instanceID);
}

/**
 * Whether an instance id is held by an instance that is up, in any permission mode (one with the permission system off
 * registers no capability check, see {@link hasCapabilityCheck}). An id no instance holds (an unknown one, or one
 * released as its instance shut down or took a new id) answers false.
 * @param {*} instanceID - The instance id a name is tagged with.
 * @returns {boolean} True while an instance holds that id.
 * @internal
 * @example
 * instanceIsUp("b"); // true while instance "b" is up
 */
export function instanceIsUp(instanceID) {
	return instanceClaimed(instanceID) === true;
}

/**
 * `node:fs`, `node:path` and `node:url`, as slothlet loaded: what a file name compiled under is resolved with.
 * @type {{fs: object|null, path: object|null, url: object|null}}
 * @private
 */
const FILES = (() => {
	const fs = runtime_builtin("node:fs");
	const path = runtime_builtin("node:path");
	const url = runtime_builtin("node:url");
	return {
		realpath: fs?.realpathSync ? FunctionMethods.bind(fs.realpathSync, fs) : null,
		exists: fs?.existsSync ? FunctionMethods.bind(fs.existsSync, fs) : null,
		resolve: path?.resolve ? FunctionMethods.bind(path.resolve, path) : null,
		dirname: path?.dirname ? FunctionMethods.bind(path.dirname, path) : null,
		sep: path?.sep ?? "/",
		fileURLToPath: url?.fileURLToPath ? FunctionMethods.bind(url.fileURLToPath, url) : null
	};
})();

/**
 * A name code is compiled under, as the real path of the file it names, or null for a name no file holds (or where
 * Node's file system is not there to tell). A `file:` URL is read as the file it names; a relative name is resolved
 * against the working directory; a symbolic link and `..` are followed to the file.
 * @param {*} filename - The name given.
 * @returns {string|null} The file's real path, or null.
 * @private
 */
function runtime_realFile(filename) {
	if (typeof filename !== "string" || filename === "" || !FILES.realpath || !FILES.resolve) return null;
	let candidate = filename;
	try {
		if (RegExpMethods.exec(/^file:/i, candidate) !== null) {
			if (!FILES.fileURLToPath) return null;
			candidate = FILES.fileURLToPath(RegExpMethods.symbolReplace(/[?#].*$/, candidate, ""));
		} else if (RegExpMethods.exec(/^[a-z][a-z0-9+.-]+:/i, candidate) !== null) return null;
		candidate = FILES.resolve(candidate);
		if (!FILES.exists(candidate)) return null;
		return FILES.realpath(candidate);
	} catch {
		/* v8 ignore next -- a name the file system cannot resolve names no file code could be taken for. */
		return null;
	}
}

/**
 * Whether code compiled under a name would name a real file outside a leaf's own folder: the folder holding the file
 * the leaf was built from, and everything beneath it. A name no file holds, or a file in that folder, is not.
 * @param {*} filename - The name code is compiled under.
 * @param {string} leafFile - The leaf's file.
 * @returns {boolean} True for a file outside the folder.
 * @internal
 * @example
 * namesForeignFile("/app/node_modules/pkg/index.js", "/app/api/ext/render.mjs"); // true
 */
export function namesForeignFile(filename, leafFile) {
	if (filename === BINDING_NAME) return true;
	const target = runtime_realFile(filename);
	if (target === null) return false;
	const own = typeof leafFile === "string" ? runtime_realFile(leafFile) : null;
	if (own === null || !FILES.dirname) return true;
	const folder = FILES.dirname(own);
	return target !== folder && !StringMethods.startsWith(target, StringMethods.endsWith(folder, FILES.sep) ? folder : folder + FILES.sep);
}

/**
 * The file name a `vm` function or `Module#_compile` is asked to compile under: its `filename` option or argument, a
 * `vm.SourceTextModule`'s `identifier`.
 * @param {string} key - The function.
 * @param {Array<*>} args - Its arguments.
 * @returns {*} The name, or undefined when none is given.
 * @private
 */
function runtime_compiledName(key, args) {
	const option = (value, field) => (typeof value === "string" ? value : value && typeof value === "object" ? value[field] : undefined);
	switch (key) {
		case "runInThisContext":
		case "createScript":
		case "Script":
			return option(args[1], "filename");
		case "runInNewContext":
		case "runInContext":
			return option(args[2], "filename");
		case "compileFunction":
			return option(args[2], "filename");
		case "SourceTextModule":
			return option(args[1], "identifier");
		default:
			return args[1];
	}
}

/**
 * Builds a builtin module's exports where the platform has the builtin; null elsewhere.
 * @param {string} id - The builtin's id.
 * @returns {object|null} Its exports, or null.
 * @private
 */
function runtime_builtin(id) {
	try {
		return Processes.getBuiltinModule?.(id) ?? null;
	} catch {
		/* v8 ignore next -- a platform that refuses the lookup has no such builtin to patch. */
		return null;
	}
}

/**
 * The verifier the vitest worker setup published (see {@link module:@cldmv/slothlet/helpers/vitest-worker-setup}): its
 * `verify(filename, code)`, bound, or null. The slot is fixed in place when the setup publishes it; when no setup ran
 * before slothlet loaded, slothlet fixes it in place as null, so no code running later can publish one.
 * @type {function(*, *): boolean|null}
 * @private
 */
const RUNNER_VERIFY = (() => {
	const slot = Symbols.for("@cldmv/slothlet.vitestFetched");
	let held;
	try {
		held = Reflect.getOwnPropertyDescriptor(globalThis, slot);
		if (held === undefined) {
			Reflect.defineProperty(globalThis, slot, { __proto__: null, value: null, writable: false, configurable: false, enumerable: false });
			return null;
		}
	} catch {
		/* v8 ignore next -- a global object that refuses the read or the definition gets no verifier. */
		return null;
	}
	if (!("value" in held) || held.writable !== false || held.configurable !== false) return null;
	const verifier = held.value;
	if (verifier === null || typeof verifier !== "object" || !Objects.isFrozen(verifier)) return null;
	const verify = Reflect.getOwnPropertyDescriptor(verifier, "verify")?.value;
	return typeof verify === "function" ? FunctionMethods.bind(verify, verifier) : null;
})();

/**
 * The `vm` functions vitest's module evaluator compiles a module with, and where each takes the code.
 * @type {ReadonlyArray<string>}
 * @private
 */
const RUNNER_COMPILES = ["runInThisContext", "runInContext", "Script", "createScript"];

/**
 * Whether this process is a vitest worker, read from vitest's worker global as slothlet loads (before any module code
 * runs). Outside vitest no module runner compiles module files, so there is no runner compile to leave to its caller.
 * @type {boolean}
 * @private
 */
const UNDER_VITEST_RUNNER = globalThis.__vitest_worker__ != null;

/**
 * Whether a `vm` call is vitest's compile of exactly the code its server last sent for the file it names (one use per
 * reply, see {@link RUNNER_VERIFY}). Under vitest with no verifier published (no worker setup ran first: vitest without
 * the `@cldmv/slothlet/vite` plugin), a compile of the shape vitest's runner makes cannot be told apart by its code,
 * and is answered null. Outside vitest no compile is the runner's.
 * @param {string} key - The `vm` function.
 * @param {Array<*>} args - Its arguments.
 * @param {*} filename - The name it compiles under.
 * @returns {boolean|null} True for that compile; null for a runner-shaped compile under vitest no verifier can check.
 * @private
 */
function runtime_runnerCompile(key, args, filename) {
	if (typeof filename !== "string" || !ArrayMethods.includes(RUNNER_COMPILES, key)) return false;
	if (RUNNER_VERIFY === null) return UNDER_VITEST_RUNNER ? null : false;
	try {
		return RUNNER_VERIFY(filename, args[0]) === true;
	} catch {
		/* v8 ignore next -- the setup's verifier does not throw; one that did verifies nothing. */
		return false;
	}
}

/** `node:vm`, `node:module` and `module.syncBuiltinESMExports`, as slothlet loaded. */
const VM = runtime_builtin("node:vm");
const NODE_MODULE = runtime_builtin("node:module");
const SYNC_BUILTIN_ESM_EXPORTS = NODE_MODULE?.syncBuiltinESMExports;
const MODULE_PROTOTYPE = NODE_MODULE?.Module?.prototype ?? null;

/**
 * The language's function constructors, as slothlet loaded, with the prototype each is reached through.
 * @type {Array<{label: string, prototype: object}>}
 * @private
 */
const CONSTRUCTORS = [
	{ label: "Function", prototype: Objects.getPrototypeOf(function () {}) },
	{ label: "AsyncFunction", prototype: Objects.getPrototypeOf(async function () {}) },
	{ label: "GeneratorFunction", prototype: Objects.getPrototypeOf(function* () {}) },
	{ label: "AsyncGeneratorFunction", prototype: Objects.getPrototypeOf(async function* () {}) }
];

/**
 * What this copy installed, for removal: each host, key, layer and the value installed.
 * @type {Array<{host: object, key: string, layer: object, value: *, descriptor: boolean}>}
 * @private
 */
const patched = [];

/**
 * The `Function` constructor this copy installed, which the other constructors' wrappers answer as their prototype.
 * @type {Function|null}
 * @private
 */
let functionWrapper = null;

const runtime_descriptorValue = (descriptor) => descriptor?.value;

/**
 * Wrap a function in a Proxy that asks first whether the code calling or constructing it may use a capability. The
 * Proxy keeps the function's identity in every other respect: its `prototype`, `name`, `length`, own members and
 * `Function.prototype.toString` (which answers native code for it, as for the function itself).
 * @param {Function} target - The function.
 * @param {object} layer - Its layer: an inactive one passes straight through.
 * @param {function(Array<*>): void} check - Throws for a caller that may not use it, given the arguments.
 * @param {boolean} [constructorOfFunctions=false] - One of the function constructors other than `Function`: its own
 *   prototype answers this copy's `Function`.
 * @returns {Function} The Proxy.
 * @private
 */
function runtime_guarded(target, layer, check, constructorOfFunctions = false) {
	const handler = {
		apply(fn, thisArg, args) {
			if (layer.active) check(args);
			return Reflect.apply(fn, thisArg, args);
		},
		construct(fn, args, newTarget) {
			if (layer.active) check(args);
			return Reflect.construct(fn, args, newTarget === proxy ? fn : newTarget);
		}
	};
	if (constructorOfFunctions)
		handler.getPrototypeOf = (fn) => (layer.active && functionWrapper !== null ? functionWrapper : Reflect.getPrototypeOf(fn));
	const proxy = new NativeProxy(target, handler);
	return proxy;
}

/**
 * Replace `host[key]` with a guarded copy of what is there, as an own data property, and remember it.
 * @param {object|null|undefined} host - The object carrying it.
 * @param {string} key - Its key.
 * @param {function(Array<*>): void} check - Throws for a caller that may not use it, given the arguments.
 * @param {boolean} [constructorOfFunctions=false] - See {@link runtime_guarded}.
 * @returns {Function|null} The guarded copy, or null when nothing was installed.
 * @private
 */
function runtime_install(host, key, check, constructorOfFunctions = false) {
	let descriptor;
	try {
		descriptor = host ? Reflect.getOwnPropertyDescriptor(host, key) : undefined;
	} catch {
		/* v8 ignore next -- a host whose descriptor cannot be read keeps what it has. */
		return null;
	}
	if (!descriptor || typeof descriptor.value !== "function" || (!descriptor.configurable && !descriptor.writable)) return null;
	const layer = openLayer(descriptor, runtime_descriptorValue);
	const value = runtime_guarded(layer.below.value, layer, check, constructorOfFunctions);
	try {
		if (!Reflect.defineProperty(host, key, { __proto__: null, ...descriptor, value })) return null;
	} catch {
		/* v8 ignore next -- a host that refuses the definition keeps what it has. */
		return null;
	}
	markLayer(value, layer);
	listPush(patched, { host, key, layer, value });
	return value;
}

/**
 * Slothlet's own code folder, as a URL and as a path: frames there are passed over when the caller is read.
 * @type {string[]}
 * @private
 */
const OWN_FOLDERS = (() => {
	const href = URLMethods.href(new URL("../../", import.meta.url));
	const path = StringMethods.startsWith(href, "file://") ? decodeURIComponent(StringMethods.slice(href, "file://".length)) : href;
	return [href, path];
})();

/**
 * Whether the code that called `Module#_compile` is Node's own module loader: the nearest frame with a location that
 * is not slothlet's own (the wrapper's) and not the engine's (a builtin has none).
 * @returns {boolean} True when that frame is a file of Node's own module loader.
 * @private
 */
function runtime_calledByNodeLoader() {
	const read = readStack(stackSites, { limit: 16 });
	const sites = read?.value;
	if (!sites || typeof sites[Symbol.iterator] !== "function") return false;
	for (let index = 0; index < sites.length; index++) {
		const site = sites[index];
		const location = site?.getFileName?.() ?? null;
		if (!location || ArrayMethods.some(OWN_FOLDERS, (folder) => StringMethods.startsWith(location, folder))) continue;
		return StringMethods.startsWith(location, "node:internal/modules/");
	}
	return false;
}

/**
 * What Node's `contextify` binding is checked as compiling under: a name {@link namesForeignFile} always finds foreign,
 * since the names the binding is later given cannot be read where it is taken.
 * @type {symbol}
 * @internal
 */
export const BINDING_NAME = Symbol("slothlet.capability.binding");

/**
 * Install every wrapper. Idempotent.
 * @returns {void}
 * @private
 */
function runtime_enable() {
	if (patched.length) return;
	// The function constructors: each prototype's `constructor`, and the global `Function`.
	for (let ofIndex = 0, ofList = CONSTRUCTORS; ofIndex < ofList.length; ofIndex++) {
		const { label, prototype } = ofList[ofIndex];
		const guarded = runtime_install(prototype, "constructor", () => checkCapability("code", label), label !== "Function");
		if (label === "Function" && guarded) {
			functionWrapper = guarded;
			let globalDescriptor;
			try {
				globalDescriptor = Reflect.getOwnPropertyDescriptor(globalThis, "Function");
			} catch {
				/* v8 ignore next */
				globalDescriptor = undefined;
			}
			if (globalDescriptor && "value" in globalDescriptor) {
				const layer = openLayer(globalDescriptor, runtime_descriptorValue);
				if (Reflect.defineProperty(globalThis, "Function", { __proto__: null, ...globalDescriptor, value: guarded })) {
					listPush(patched, { host: globalThis, key: "Function", layer, value: guarded });
				}
			}
		}
	}
	if (VM) {
		for (
			let ofIndex = 0,
				ofList = ["runInThisContext", "runInNewContext", "runInContext", "compileFunction", "createScript", "Script", "SourceTextModule"];
			ofIndex < ofList.length;
			ofIndex++
		) {
			const key = ofList[ofIndex];
			runtime_install(VM, key, (args) => {
				const filename = runtime_compiledName(key, args) ?? null;
				checkCapability("code", `vm.${key}`, null, filename, runtime_runnerCompile(key, args, filename));
			});
		}
	}
	// `Module#_compile` is how Node's own loader runs every CommonJS file: only a call from anything else is checked.
	runtime_install(MODULE_PROTOTYPE, "_compile", (args) => {
		if (!runtime_calledByNodeLoader()) checkCapability("code", "Module#_compile", null, runtime_compiledName("_compile", args) ?? null);
	});
	// Of Node's bindings, only the one that compiles strings is the capability.
	runtime_install(globalThis.process, "binding", (args) => {
		// It compiles under any name it is given, which cannot be read here: a file name it is given counts as foreign.
		if (args[0] === "contextify") checkCapability("code", "process.binding('contextify')", null, BINDING_NAME);
	});
	if (NODE_MODULE) {
		runtime_install(NODE_MODULE, "registerHooks", () => checkCapability("loader", "module.registerHooks"));
		runtime_install(NODE_MODULE, "register", () => checkCapability("loader", "module.register"));
	}
	runtime_syncBuiltins();
}

/**
 * Remove every wrapper this copy installed, putting back what it wrapped where it is still the one installed.
 * @returns {void}
 * @private
 */
function runtime_disable() {
	for (let ofIndex = 0, ofList = listSplice(patched, 0); ofIndex < ofList.length; ofIndex++) {
		const { host, key, layer, value } = ofList[ofIndex];
		const restore = closeLayer(layer, runtime_descriptorValue);
		try {
			if (holdsValue(host, key, value)) Reflect.defineProperty(host, key, restore);
		} catch {
			// A host that no longer lets the member be defined keeps the wrapper, which passes through.
		}
	}
	functionWrapper = null;
	runtime_syncBuiltins();
}

/**
 * Refresh the ES module namespaces of Node's builtins, so a named import of `vm` or `module` sees what is installed.
 * @returns {void}
 * @private
 */
function runtime_syncBuiltins() {
	if (typeof SYNC_BUILTIN_ESM_EXPORTS === "function") Reflect.apply(SYNC_BUILTIN_ESM_EXPORTS, NODE_MODULE, []);
}

/**
 * Start asking an instance about the capabilities, installing the wrappers with the first such instance.
 * @param {string} instanceID - The instance.
 * @param {function(string, string, ?string): void} check - Its check (see {@link CHECKS}).
 * @returns {void}
 * @internal
 * @example
 * registerCapabilityCheck(instanceID, (name, route, importer) => assertCapability(slothlet, name, route, importer));
 */
function registerCapabilityCheck(instanceID, check) {
	MapMethods.set(CHECKS, instanceID, check);
	runtime_enable();
}

/**
 * Stop asking an instance, removing the wrappers with the last one.
 * @param {string} instanceID - The instance.
 * @returns {void}
 * @internal
 * @example
 * releaseCapabilityCheck(instanceID);
 */
function releaseCapabilityCheck(instanceID) {
	if (!MapMethods.delete(CHECKS, instanceID) || MapMethods.size(CHECKS) > 0) return;
	runtime_disable();
}

setCapabilityCheck(checkCapability);

/**
 * This file's internal bindings, for the files of slothlet's own that use them (see `ownBindingsRefusal` in
 * `helpers/instance-imports`).
 * @param {string} consumer - The file asking.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["slothlet"])) throw ownBindingsRefusal("lib/helpers/capability-context", import.meta.url);
	return { registerCapabilityCheck, releaseCapabilityCheck };
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}).
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet.
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
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}
