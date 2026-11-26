/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/capability-context.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:41-08:00 (1795651541)
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
	URLMethods,
	Set,
	SetMethods,
	String,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { readStack, stackSites } from "#helpers/stack-read";
import { isOwnTopLevelOf, ownBindingsRefusal, internals as instanceImportsInternals } from "#helpers/instance-imports";
import { toComparablePath, internals as framePlacementInternals } from "#handlers/frame-placement";
const { fileNodes, frameDefiner, runtime_codeWritersOnStack, runtime_loadingFileRunning, runtime_loadingHelper } =
	framePlacementInternals("lib/helpers/capability-context");

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
			/* v8 ignore next -- a host that no longer lets the member be defined keeps the wrapper, which passes through. */
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
 * Reader of a node read through `self` by code the live runtime could not attribute to one call. It owns
 * nothing.
 * @type {object}
 * @private
 */
const UNATTRIBUTED_READER = Objects.freeze({ reader: "unattributed" });

/**
 * The loads whose file vitest's module runner has compiled (see {@link runnerCompilesLoad}).
 * @type {WeakSet<object>}
 * @private
 */
const RUNNER_COMPILED_LOADS = new WeakSet();

/**
 * The helper files of this instance's whose first compile shaped as vitest's runner makes one, with no worker setup to
 * verify it, was left to the code making it (see {@link runnerCompilesHelper}): by instance, each file as its
 * instance id and comparable path.
 * @type {WeakMap<object, Set<string>>}
 * @private
 */
const RUNNER_COMPILED_HELPERS = new WeakMap();

/**
 * Whether a name code is compiled under is a copy of a helper file this instance judges: tagged with this instance's
 * id, or with an id no instance that is up holds (an unknown instance, or one that has shut down or taken a new id,
 * whose copies are no running instance's), and naming a file the loader is not loading as a leaf and, for the instance's
 * own tag, no file its leaves were built from. The loader imports only leaves; every other file under an instance's tag
 * is a file a leaf imports, directly or through other helpers (see `helpers/instance-imports`).
 * @param {object} slothlet - The instance.
 * @param {*} filename - The name the code is compiled under.
 * @returns {"own"|"orphan"|null} "own" for a copy of a helper file of the instance's, "orphan" for a copy under an id no
 *   instance that is up holds, null otherwise.
 * @private
 */
function namesHelperCopy(slothlet, filename) {
	if (typeof filename !== "string") return null;
	const tag = RegExpMethods.exec(/[?&]slothlet_instance=([^&#]+)/, filename)?.[1] ?? null;
	if (tag === null) return null;
	const kind = tag === String(slothlet.instanceID) ? "own" : instanceIsUp(tag) ? null : "orphan";
	if (kind === null) return null;
	const loader = slothlet?.processors?.loader;
	if (typeof loader?.loadsOfFile !== "function") return null;
	if (loader.loadsOfFile(toComparablePath(filename)).length !== 0) return null;
	// A file the instance built leaves from is a leaf file, not a helper, once its load is over: code compiled under its
	// name is placed by the frames it runs in, as any code is (a supplier's code under a leaf's name runs as the supplier,
	// with the leaf's call as its ceiling).
	if (kind === "own" && fileNodes(slothlet, filename).length !== 0) return null;
	return kind;
}

/**
 * Whether a compile vitest's module runner makes of the code its server sent (see `helpers/vitest-worker-setup`) is
 * the loader's: the compile of a file this instance is loading now (the name it compiles under carries this instance's
 * tag and names a file the loader is loading, and that load's file has not been compiled yet; the load is then marked
 * compiled), or of this instance's own `self` module, which the vite plugin writes for a runtime import of one of the
 * instance's files (`slothlet-self:<instanceID>|…`), while the instance has a load running.
 * @param {object} slothlet - The instance.
 * @param {*} filename - The name the code is compiled under (the module's id).
 * @returns {boolean} True for such a compile.
 * @private
 */
function runnerCompilesLoad(slothlet, filename) {
	if (typeof filename !== "string") return false;
	// vite names a virtual module with a leading NUL.
	const selfName = StringMethods.startsWith(filename, "\0") ? StringMethods.slice(filename, 1) : filename;
	if (StringMethods.startsWith(selfName, "slothlet-self:")) {
		if (!StringMethods.startsWith(selfName, `slothlet-self:${String(slothlet.instanceID)}|`)) return false;
		const loader = slothlet?.processors?.loader;
		return typeof loader?.isLoading === "function" && loader.isLoading();
	}
	if (RegExpMethods.exec(/[?&]slothlet_instance=([^&#]+)/, filename)?.[1] !== String(slothlet.instanceID)) return false;
	const load = runtime_loadingFileRunning(slothlet, filename);
	if (load === null || WeakSetMethods.has(RUNNER_COMPILED_LOADS, load)) return false;
	WeakSetMethods.add(RUNNER_COMPILED_LOADS, load);
	return true;
}

/**
 * Whether a compile vitest's module runner would make of a copy of a helper file of this instance's is left to the code
 * making it, as any other code's is, rather than placed as the helper's code. A verified compile (`runnerCompile` true:
 * exactly the code vitest's server sent for the name, one compile per reply) always is. An unverified one (no worker
 * setup records what the server sent) is so only for the name slothlet gives the instance's copy of a helper file (the
 * file's path with the instance's id as its only query parameter), while the helper is evaluated for the first time
 * inside a load of a file importing it, as the instance's import record has it (see `runtime_loadingHelper` in
 * `frame-placement`), and only for the first compile of the helper file: an instance has one copy of each helper file,
 * which vitest compiles once, and every other compile under a name of a copy of the file is placed as the helper's, as
 * every later compile of a loading file is.
 * @param {object} slothlet - The instance.
 * @param {*} filename - The name the code is compiled under (the module's id).
 * @param {boolean|null} runnerCompile - See {@link assertCapability}.
 * @returns {boolean} True for such a compile.
 * @private
 */
function runnerCompilesHelper(slothlet, filename, runnerCompile) {
	if (runnerCompile === false || namesHelperCopy(slothlet, filename) !== "own") return false;
	if (runnerCompile === true) return true;
	if (RegExpMethods.exec(/^[^?#]*\?slothlet_instance=[^&#]+$/, filename) === null) return false;
	if (!runtime_loadingHelper(slothlet, toComparablePath(filename))?.paths?.length) return false;
	let compiled = WeakMapMethods.get(RUNNER_COMPILED_HELPERS, slothlet);
	if (compiled === undefined) WeakMapMethods.set(RUNNER_COMPILED_HELPERS, slothlet, (compiled = new Set()));
	const key = `${String(slothlet.instanceID)}\u0000${toComparablePath(filename)}`;
	if (SetMethods.has(compiled, key)) return false;
	SetMethods.add(compiled, key);
	return true;
}

/**
 * Refuse code compiled under the name of a file this instance is loading now (every load of it) a capability that no
 * rule opens for that load's module path; a load whose paths are not known yet is refused it. Code compiled under the
 * name of a copy of one of the instance's helper files is placed as that helper's code: decided as the paths of the
 * api files importing it while one of them loads, and refused otherwise; under the name of a helper copy tagged with an
 * id no instance that is up holds, it is refused. A name tagged with another instance's id is
 * that instance's to judge while it is up with a check of its own registered (two instances load the same file under
 * their own tags, and the compile hooks are shared by the process); a name tagged with an id no registered check holds
 * (an unknown instance, or one that has shut down) is judged here as any other.
 * @param {object} slothlet - The instance.
 * @param {object} permissionManager - Its permission manager.
 * @param {string} name - The capability.
 * @param {string} route - What the code used.
 * @param {*} filename - The name the code is compiled under.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
 * @private
 */
function assertNamedLoads(slothlet, permissionManager, name, route, filename) {
	if (typeof filename !== "string") return;
	const loader = slothlet?.processors?.loader;
	if (typeof loader?.loadsOfFile !== "function") return;
	const tag = RegExpMethods.exec(/[?&]slothlet_instance=([^&#]+)/, filename)?.[1] ?? null;
	if (tag !== null && tag !== String(slothlet.instanceID) && hasCapabilityCheck(tag)) return;
	const loads = loader.loadsOfFile(toComparablePath(filename));
	for (let index = 0; index < loads.length; index++) {
		const paths = loads[index].paths;
		if (paths?.length) permissionManager.assertCapabilityForPaths(paths, name, route);
		else permissionManager.assertCapability(UNATTRIBUTED_READER, name, route);
	}
	if (loads.length) return;
	const copy = namesHelperCopy(slothlet, filename);
	if (copy === null) return;
	const helper = copy === "own" ? runtime_loadingHelper(slothlet, toComparablePath(filename)) : null;
	if (helper?.paths?.length) permissionManager.assertCapabilityForPaths(helper.paths, name, route);
	else permissionManager.assertCapability(UNATTRIBUTED_READER, name, route);
}

/**
 * Refuse module code of this instance a built-in capability no rule opens for it (see
 * `PermissionManager#assertCapability`), told as any other access is: the call running, read from the stack where
 * calls are in flight; while no call runs, the code's own frames (a function a module handed out, run by the host, is
 * its definer's). Code the live runtime cannot attribute is refused; the host's own code, a package's run by the host,
 * and another instance's code are left to their own checks.
 *
 * @param {object} slothlet - The instance.
 * @param {string} name - The capability.
 * @param {string} route - What the code used, for the error.
 * @param {string|null} [moduleFile=null] - A file of this instance's the code is known to belong to (an import it
 *   makes as it links), so that code is never taken for the host's.
 * @param {*} [filename=null] - The file name the code is compiled under, when one is given: a real file outside the
 *   caller's own folder is refused even where a rule opens the capability.
 * @param {boolean|null} [runnerCompile=false] - Whether the call is vitest's compile of exactly the code its server sent
 *   for `filename` (see `helpers/vitest-worker-setup`): allowed once for a file of this instance's that is loading now,
 *   as Node's own loader compiling the file would be. Null when no worker setup records what the server sent: the first
 *   such compile of a loading file is then decided by the code that makes it, as any other code is.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
 * @internal
 * @example
 * assertCapability(slothlet, "code", "new Function");
 */
function assertCapability(slothlet, name, route, moduleFile = null, filename = null, runnerCompile = false) {
	const permissionManager = slothlet?.handlers?.permissionManager;
	if (!permissionManager?.isEnabled?.()) return;
	// vitest's module runner compiling the code its server sent for a file of this instance's that is loading now: the
	// loader's own compile of the file, as Node's loader compiling it would be. One such compile per load.
	if (runnerCompile === true && runnerCompilesLoad(slothlet, filename)) return;
	// With no worker setup recording what vitest's server sent (vitest without the vite plugin, `server.deps.inline`
	// only), the runner's compile of a loading file cannot be told from other code by what it compiles. The first
	// runner-shaped compile of each load is then decided by the code making it, as below: vitest's runner is no
	// module's code, and a module's own code compiling under the name is still its own and refused. Every later compile
	// under the name is placed as the file's code.
	const unverifiedRunnerCompile = runnerCompile === null && runnerCompilesLoad(slothlet, filename);
	// vitest's runner compiling a copy of one of the instance's helper files: decided by the code making it, as below
	// (vitest's runner is no module's code). A helper is no load, so the verified compile is not answered above.
	const runnerHelperCompile = runnerCompilesHelper(slothlet, filename, runnerCompile);
	// Any other code compiled under the name of a file this instance is loading now, or of a copy of one of its helper
	// files, is placed as that file's code, whoever compiles it: decided as the file's module path, as its own top-level
	// code is.
	if (!unverifiedRunnerCompile && !runnerHelperCompile) assertNamedLoads(slothlet, permissionManager, name, route, filename);
	const contextManager = slothlet.contextManager;
	let caller = null;
	const identity = contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (identity?.currentWrapper) caller = identity.currentWrapper;
	// Calls the live runtime cannot tell apart are in flight: code that is no file of the instance's (the host's, a
	// package's, Node's own) is still not a module's; anything else could be any of them, and is refused.
	else if (identity?.unresolved && !identity.unaccounted) {
		const writers = runtime_codeWritersOnStack(slothlet);
		caller = writers === null || writers.length > 1 ? UNATTRIBUTED_READER : writers.length ? writers[0] : null;
	} else {
		const definer = frameDefiner(contextManager?.runningInstanceID?.() ?? null);
		if (definer?.wrapper) caller = definer.wrapper.____slothlet === slothlet ? definer.wrapper : null;
		else if (definer?.unplaced || definer?.leaves) caller = UNATTRIBUTED_READER;
		// Code of a file of the instance's no node stands for yet (a file's top level as it first loads) or no leaf
		// accounts for is the instance's, never the host's.
		else if (runtime_codeWritersOnStack(slothlet) === null) caller = UNATTRIBUTED_READER;
	}
	// A file of the instance's linking an import: its own code, whatever the stack says (nothing of the file's runs yet).
	if (caller === null && moduleFile !== null) caller = UNATTRIBUTED_READER;
	// A file's own top-level code as it first loads, or an import it links, before any node stands for it: decided as the
	// file's module path (S4), as the loader reads it ahead of the build. Code that names no file loading (a helper's top
	// level, code no load accounts for) stays refused.
	if (caller === UNATTRIBUTED_READER) {
		const load = runtime_loadingFileRunning(slothlet, moduleFile);
		if (load?.paths?.length) {
			permissionManager.assertCapabilityForPaths(load.paths, name, route);
			if (filename !== null && namesForeignFile(filename, load.path)) {
				permissionManager.assertCapabilityForPaths(load.paths, name, route, filename === BINDING_NAME ? "binding" : "foreign-filename");
			}
			return;
		}
	}
	permissionManager.assertCapability(caller, name, route);
	// Opened for the caller: compiling under the name of a real file outside its own folder is still refused, since the
	// code would be placed as that file's (a package's, another module's, the host's).
	if (filename === null || caller === null || caller === UNATTRIBUTED_READER) return;
	if (namesForeignFile(filename, caller.____slothletInternal?.filePath ?? null)) {
		permissionManager.assertCapability(caller, name, route, filename === BINDING_NAME ? "binding" : "foreign-filename");
	}
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them (see `ownBindingsRefusal` in
 * `helpers/instance-imports`).
 * @param {string} consumer - The file asking.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["lib/handlers/unified-wrapper/rules", "lib/handlers/unified-wrapper/views", "slothlet"]))
		throw ownBindingsRefusal("lib/helpers/capability-context", import.meta.url);
	if (consumer !== "slothlet") return { UNATTRIBUTED_READER };
	return { registerCapabilityCheck, releaseCapabilityCheck, assertCapability };
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
