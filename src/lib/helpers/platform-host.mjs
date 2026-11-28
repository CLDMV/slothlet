/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/platform-host.mjs
 *	@Date: 2026-05-29T22:02:43-07:00 (1780117363)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:44-08:00 (1795869044)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Single source of truth for Node.js-vs-browser host differences: what `#helpers/platform` hands out.
 * @module @cldmv/slothlet/helpers/platform-host
 * @internal
 *
 * @description
 * Slothlet runs in two hosts: Node.js (full filesystem access) and browser /
 * Electron-renderer "browser mode" (no `node:*` builtins, manifest-based loading).
 * Rather than scatter `typeof process` checks and gated `import("node:*")` calls
 * across a dozen modules (#123), every host difference is decided ONCE and the rest
 * of the codebase imports the resolved builtins (or browser shims) plus `isNode`
 * from `#helpers/platform` via plain static imports.
 *
 * `#helpers/platform` resolves by package condition (package.json `imports`) to one of two small files that fill this
 * one in as they load: `platform.mjs` (Node) imports the builtins statically and hands them to {@link useNodeBuiltins};
 * `platform.browser.mjs` (the `browser` condition, and the fallback) hands over the browser stand-ins
 * ({@link useBrowserStandIns}), or Node's builtins through `process.getBuiltinModule` where a page has a Node `process`
 * (an Electron renderer with Node integration). Nothing in slothlet's graph awaits at its top level, so Node's
 * synchronous `require(esm)` can load a package that imports slothlet (#1034), and no `node:*` specifier enters the
 * static-import graph a browser parses. In a browser the Node-only exports are `null` (every call site is
 * `isNode`-guarded) and `util` is a minimal shim (consumed in both hosts for `inspect` / `types.isProxy`).
 *
 * Anything that genuinely cannot run outside Node and is never reachable from a
 * browser module graph (TypeScript compilation, type generation, manifest
 * generation) keeps its own direct `node:*` imports — routing those through here
 * would only drag build-time-only builtins (`crypto`, `os`) into the shared hub.
 *
 * ## Browser-only branches & coverage (policy)
 * The browser arms here — and in the modules that import `isNode` (the browser shims, the
 * i18n browser paths, the live-mode null-ALS arm) — are UNREACHABLE under the Node coverage run:
 * `process.versions.node` is always truthy there, even in the `platform:"browser"` node-side suites.
 *
 * They are now genuinely covered+counted by a **vitest browser-mode** run (real headless Chromium,
 * Playwright provider — `.configs/vitest.browser.config.mjs`, `tests/browser/*.browser.test.mjs`).
 * Because that run uses the SAME `@vitest/coverage-v8` provider over vite-transformed source as the
 * node run, the two `coverage-final.json` maps align and merge cleanly
 * (`tools/coverage/merge-browser-coverage.mjs`, wired as `npm run coverage:all`). An earlier merge was
 * rejected, but that was of the raw-source Playwright *smoke* (`npm run test:browser`), whose importmap
 * serves raw `src/` — those maps don't align with node's. The vitest-browser run does, which is what
 * makes the merge correct. Only arms unreachable in BOTH hosts (e.g. an exotic non-Node host with no
 * `process`/`navigator`) keep a precise v8 ignore-next comment. The smoke remains as a raw-importmap
 * load check (the path a real consumer uses), not the coverage justification.
 */

import {
	ArrayBuffers,
	ArrayMethods,
	Boolean,
	CryptoKey,
	Error,
	Errors,
	filterList,
	FunctionMethods,
	JSON,
	Map,
	mapList,
	MessageChannel,
	NativeProcess,
	ObjectMethods,
	Objects,
	Promise,
	PrototypeFunctions,
	Reflect,
	RegExp,
	Set,
	setImmediate,
	setTimeout,
	StringMethods,
	Symbol,
	Symbols
} from "#helpers/intrinsics";
import { pinToCurrentCaller } from "#helpers/caller-pinning";

/**
 * Whether the host is Node.js: set once, by whichever of `platform.mjs` / `platform.browser.mjs` loaded, before any
 * other file of slothlet's reads it. In a browser/worker `process` is absent and it is false; the vitest browser run
 * exercises that arm (the node run cannot — `process` is always present there).
 * @type {boolean}
 * @private
 */
let isNode = false;

/**
 * Whether the platform values have been filled in. They are filled in once, as the platform file loads.
 * @type {boolean}
 * @private
 */
let installed = false;

/**
 * Whether the current host has Node's `process`: the same test as before the split, read once by each platform file.
 * @returns {boolean} True when it does.
 * @internal
 */
function hostHasNodeProcess() {
	return typeof NativeProcess !== "undefined" && Boolean(NativeProcess?.versions?.node);
}

/**
 * Resolved Node.js builtins (Node host) or browser shims / `null` (browser host).
 *
 * Each is initialized to `null` and set to the real builtin by {@link useNodeBuiltins}; in a
 * browser the Node-only ones stay `null` (every call site is `isNode`-guarded) and `util`
 * becomes a minimal shim ({@link useBrowserStandIns}). Annotated `any` (not bare `null`,
 * which would make a TS consumer treat them as non-callable, nor the precise
 * `typeof import("node:*")` shape, which would force `@types/node` onto every consumer —
 * including browser ones — and break the no-extra-types export contract). `any` keeps them
 * usable from TS while the polymorphic real-module / shim / `null` behavior is documented here.
 * @private
 */
/** @type {any} */
let fs = null;
/** @type {any} */
let fsp = null;
/** @type {any} */
let path = null;
/** @type {any} */
let url = null;
/** @type {any} */
let util = null;
/** @type {any} */
let EventEmitter = null;
/** @type {any} */
let AsyncLocalStorage = null;
/** @type {any} */
let AsyncResource = null;
/** @type {any} */
let executionAsyncResource = null;
/** @type {any} */
let executionAsyncId = null;
/** @type {any} */
let createHook = null;
/** @type {any} */
let createRequire = null;
/** @type {any} */
let vm = null;
/** @type {any} */
let childProcess = null;

/**
 * Fill in the platform values from Node's builtin modules, once, as the platform file loads (#1034): `platform.mjs`
 * hands over its static imports, so a host's loader hooks and a test's module mocks apply as they do to any import.
 * @param {{fs: object, fsp: object, path: object, url: object, util: object, events: object, asyncHooks: object,
 *   module: object, vm: object, childProcess: object}} modules - The modules.
 * @returns {void}
 * @internal
 */
function useNodeBuiltins(modules) {
	if (installed) return;
	installed = true;
	isNode = true;
	const fsMod = modules.fs,
		fspMod = modules.fsp,
		pathMod = modules.path,
		urlMod = modules.url,
		utilMod = modules.util,
		eventsMod = modules.events,
		asyncHooksMod = modules.asyncHooks,
		moduleMod = modules.module;
	// Frozen copies of the namespaces, taken now: slothlet's files read their members when they run, and code that
	// replaces `fs.readFileSync` or `path.join` on Node's module object later (and refreshes the namespaces with
	// `module.syncBuiltinESMExports()`) does not reach them.
	fs = Objects.freeze({ ...fsMod });
	fsp = Objects.freeze({ ...fspMod });
	path = Objects.freeze({ ...pathMod });
	url = Objects.freeze({ ...urlMod });
	// `util.types` is an object of its own on Node's module, and `util.inspect.custom` a member of the function: both
	// taken now too. The `inspect` here calls Node's own. The copy of `util.types` is slothlet's own object, which only
	// slothlet's files reach (tests stand in a browser's answers on it), so it is not frozen.
	const nodeInspect = utilMod.inspect;
	const inspect = function inspect(...args) {
		return Reflect.apply(nodeInspect, undefined, args);
	};
	Objects.defineProperty(inspect, "custom", { __proto__: null, value: nodeInspect.custom, enumerable: true });
	util = Objects.freeze({ ...utilMod, inspect: Objects.freeze(inspect), types: { ...utilMod.types } });
	({ EventEmitter } = eventsMod);
	({ AsyncLocalStorage, AsyncResource, executionAsyncResource, executionAsyncId, createHook } = asyncHooksMod);
	({ createRequire } = moduleMod);
	// `node:vm` and `child_process` for the loader, as they were imported: code that replaces `vm.compileFunction` or
	// `child_process.fork` on Node's modules later does not run inside the loader.
	vm = modules.vm;
	childProcess = modules.childProcess;
}

/**
 * Fill in the platform values with the browser stand-ins, once, as the platform file loads: the Node-only values stay
 * `null` and `util` is the minimal shim. The browser host's arm, exercised by the vitest browser run.
 * @returns {void}
 * @internal
 */
function useBrowserStandIns() {
	if (installed) return;
	installed = true;
	isNode = false;
	// What every generator object and every async generator object inherits from.
	const GENERATOR_PROTOTYPES = [Objects.getPrototypeOf(function* () {}).prototype, Objects.getPrototypeOf(async function* () {}).prototype];
	// What every generator function and every async generator function inherits from.
	const GENERATOR_FUNCTION_PROTOTYPES = [Objects.getPrototypeOf(function* () {}), Objects.getPrototypeOf(async function* () {})];
	// What every `Map` iterator and every `Set` iterator inherits from.
	const MAP_ITERATOR = Objects.getPrototypeOf(new Map()[Symbol.iterator]());
	const SET_ITERATOR = Objects.getPrototypeOf(new Set()[Symbol.iterator]());
	/**
	 * A brand check made by calling one of a kind's own methods on the value: the method reads only the internal data of
	 * an object of its kind and throws a `TypeError` for anything else.
	 * @param {Function} method - The method, taken now so replacing it later changes no answer.
	 * @param {Array<*>} [args] - What to call it with.
	 * @returns {function(*): boolean} The check.
	 */
	const brand =
		(method, args = []) =>
		(value) => {
			if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
			try {
				Reflect.apply(method, value, args);
				return true;
			} catch {
				return false;
			}
		};
	// The getters and `valueOf`s of the built-in prototypes, as slothlet took them when it loaded.
	const IS_REGEXP = brand(PrototypeFunctions.RegExp.source);
	const IS_ARRAY_BUFFER = brand(PrototypeFunctions.ArrayBuffer.byteLength);
	const IS_SHARED_ARRAY_BUFFER =
		typeof PrototypeFunctions.SharedArrayBuffer.byteLength === "function"
			? brand(PrototypeFunctions.SharedArrayBuffer.byteLength)
			: () => false;
	const IS_DATA_VIEW = brand(PrototypeFunctions.DataView.byteLength);
	const BOXED_BRANDS = mapList(
		filterList(
			[
				PrototypeFunctions.Number.valueOf,
				PrototypeFunctions.String.valueOf,
				PrototypeFunctions.Boolean.valueOf,
				PrototypeFunctions.Symbol.valueOf,
				PrototypeFunctions.BigInt.valueOf
			],
			(valueOf) => typeof valueOf === "function"
		),
		(valueOf) => brand(valueOf)
	);
	// `util` is the one builtin consumed in both hosts: `inspect` (with its custom
	// symbol) for value formatting and `types.isProxy` for proxy detection. Slothlet's
	// own wrappers are resolved via resolveWrapper(), so a browser-side `isProxy()`
	// that always returns false only loses detection of *arbitrary user* proxies —
	// a documented browser limitation, not a correctness bug for slothlet internals.
	util = {
		inspect: Objects.assign((value) => value, { custom: Symbols.for("nodejs.util.inspect.custom") }),
		types: {
			isProxy: () => false,
			// A native promise of any realm (an iframe's), by its built-in tag: the browser stand-in for
			// Node's brand check. A plain object that sets `Symbol.toStringTag` to "Promise" passes too.
			// Reading the tag runs a value's own `Symbol.toStringTag` getter; one that throws is simply not
			// a promise, so the check never changes what an ordinary return value does.
			isPromise: (value) => {
				if (inheritsFrom(value, Promise)) return true;
				try {
					return ObjectMethods.toString(value) === "[object Promise]";
				} catch {
					return false;
				}
			},
			// Constructor-name check: the browser stand-in for Node's native brand check. Its
			// false negatives (a bound or wrapped async function) are the same detection blind
			// spots the Node check has, and fail in the same conservative direction — the sync
			// pipeline, whose thenable refusal names the `{ async: true }` declaration fix.
			isAsyncFunction: (fn) => typeof fn === "function" && fn.constructor?.name === "AsyncFunction",
			// Prototype check: the browser stand-in for Node's brand check of a generator object, an async
			// generator's included. An object merely inheriting from a generator function's `prototype` passes too.
			isGeneratorObject: (value) =>
				value !== null &&
				typeof value === "object" &&
				ArrayMethods.some(GENERATOR_PROTOTYPES, (prototype) =>
					FunctionMethods.call(PrototypeFunctions.Object.isPrototypeOf, prototype, value)
				),
			// Prototype check: the browser stand-in for Node's brand check of a generator function, an async one included.
			isGeneratorFunction: (fn) =>
				typeof fn === "function" &&
				ArrayMethods.some(GENERATOR_FUNCTION_PROTOTYPES, (prototype) =>
					FunctionMethods.call(PrototypeFunctions.Object.isPrototypeOf, prototype, fn)
				),
			// The rest are the engine's own brand checks, made by calling a method of the kind that reads nothing but the
			// object's internal data and throws for any other object: none of a value's own code runs, and a Proxy never
			// passes, as with Node's checks.
			isMap: brand(PrototypeFunctions.Map.has, [undefined]),
			isSet: brand(PrototypeFunctions.Set.has, [undefined]),
			isWeakMap: brand(PrototypeFunctions.WeakMap.has, [undefined]),
			isWeakSet: brand(PrototypeFunctions.WeakSet.has, [undefined]),
			isDate: brand(PrototypeFunctions.Date.getTime),
			isRegExp: (value) => value !== RegExp.prototype && IS_REGEXP(value),
			isArrayBuffer: IS_ARRAY_BUFFER,
			isSharedArrayBuffer: IS_SHARED_ARRAY_BUFFER,
			isAnyArrayBuffer: (value) => IS_ARRAY_BUFFER(value) || IS_SHARED_ARRAY_BUFFER(value),
			isArrayBufferView: (value) => ArrayBuffers.isView(value),
			isDataView: IS_DATA_VIEW,
			isTypedArray: (value) => ArrayBuffers.isView(value) && !IS_DATA_VIEW(value),
			isBoxedPrimitive: (value) => value !== null && typeof value === "object" && ArrayMethods.some(BOXED_BRANDS, (is) => is(value)),
			// `Error.isError` where the engine has it; the prototype chain otherwise, which an object merely inheriting
			// from `Error.prototype` passes too.
			isNativeError: typeof Errors.isError === "function" ? (value) => Errors.isError(value) : (value) => inheritsFrom(value, Error),
			isMapIterator: (value) =>
				value !== null && typeof value === "object" && FunctionMethods.call(PrototypeFunctions.Object.isPrototypeOf, MAP_ITERATOR, value),
			isSetIterator: (value) =>
				value !== null && typeof value === "object" && FunctionMethods.call(PrototypeFunctions.Object.isPrototypeOf, SET_ITERATOR, value),
			// Node's own key objects do not exist in a browser; a Web Crypto key is told by its class.
			isKeyObject: () => false,
			isCryptoKey: (value) => typeof CryptoKey === "function" && inheritsFrom(value, CryptoKey)
		}
	};
}

/**
 * Load and parse JSON, branching on host — this is the single place that knows how each
 * environment reads JSON.
 *
 * @description
 * - **Node**: synchronous `fs.readFileSync` + parse. Returns the parsed object directly (or
 *   `null` on a read/parse failure). `ref` is a filesystem path or `file:` URL.
 * - **Browser**: asynchronous dynamic `import(ref, { with: { type: "json" } })`. Returns a
 *   `Promise<object|null>` — a miss resolves to `null` (callers keep their bundled default;
 *   a failed import also surfaces a console error, which is harmless). `ref` is a module
 *   specifier resolvable via the page's importmap (e.g. `@cldmv/slothlet/i18n/language/es-mx.json`).
 *
 * The return type is therefore polymorphic by host: `object|null` in Node, `Promise<object|null>`
 * in a browser. Callers that already branch on `isNode` consume the matching form directly;
 * `await loadJson(...)` is safe in both (awaiting a non-promise is a no-op).
 *
 * @param {string} ref - Filesystem path / `file:` URL (Node) or importmap specifier (browser).
 * @returns {object|null|Promise<object|null>} Parsed JSON (Node, sync) or a promise of it (browser).
 * @internal
 *
 * @example
 * // Node (sync):
 * const pkg = loadJson(new URL("../../package.json", import.meta.url));
 * // Browser (async):
 * const es = await loadJson("@cldmv/slothlet/i18n/language/es-mx.json");
 */
function loadJson(ref) {
	// Browser host: async dynamic JSON import, delegated to loadJsonBrowser (exercised by the vitest
	// browser run via loadJson()). Delegated rather than inlined as `import(...).then().catch()` so the
	// `import(...)` expression is the LAST token on its line: vitest's browser transform wraps dynamic
	// imports and shifts the columns of anything after them, which moves trailing `.then`/`.catch`
	// callbacks off the positions the node (SSR) transform maps them to — defeating the location-based
	// coverage merge. The await form keeps every coverable entry starting at/before the import.
	if (!isNode) {
		return loadJsonBrowser(ref);
	}
	try {
		return JSON.parse(fs.readFileSync(ref, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Browser host helper for {@link loadJson}: dynamic JSON import.
 *
 * @description
 * `import(ref, { with: { type: "json" } })` — a JSON module always exposes the parsed value as
 * `default`, so that is returned (coalesced to `null` to uphold the `object | null` contract); a failed import resolves to `null` so the caller keeps its
 * bundled default. Kept separate from {@link loadJson} so the import expression ends its own line (see
 * the note in loadJson on vitest's dynamic-import wrapping and the coverage merge).
 *
 * @param {string} ref - Importmap specifier (e.g. "@cldmv/slothlet/i18n/language/es-mx.json").
 * @returns {Promise<object|null>} Parsed JSON, or null on a failed import.
 * @private
 */
async function loadJsonBrowser(ref) {
	try {
		const mod = await import(ref, { with: { type: "json" } });
		// A JSON module always default-exports its parsed value, so for a real locale (always an object)
		// `mod.default` is never nullish here; the `?? null` only upholds the documented `object | null`
		// return contract and is therefore unreachable, so its arm is honestly ignored (no contrived
		// null-JSON fixture needed). A failed import is handled by the catch below.
		return /* v8 ignore next */ mod.default ?? null;
	} catch {
		return null;
	}
}

/**
 * The macrotask schedulers of this host, as they were when slothlet loaded.
 * @type {{setImmediate: Function|undefined, MessageChannel: Function|undefined, setTimeout: Function}}
 * @private
 */
const MACROTASK_HOSTS = Objects.freeze({ setImmediate, MessageChannel, setTimeout });

/**
 * Run `fn` on a later macrotask, in any host.
 *
 * @description
 * `setImmediate` is Node-only: a browser has none, and neither does an Electron context-isolated
 * renderer, so calling it directly from browser-reachable code throws (#578). This picks the best
 * macrotask primitive the host offers, in order:
 * - `setImmediate` (Node);
 * - a `MessageChannel` post (browsers, workers), which runs ahead of clamped timers;
 * - `setTimeout(fn, 0)` as the last resort.
 *
 * The schedulers are the host's as they were when slothlet loaded, and `fn` is pinned to its caller as the
 * context-carrying versions installed by `helpers/scheduler-context` pin a callback. All three run `fn` only after the
 * current call stack and every queued microtask have drained, which is the guarantee callers rely on.
 *
 * An instance whose host gave it a `setTimeout` in the `clock` option (see `helpers/clock`) runs its deferred work on
 * that timer instead, so a host faking timers drives it with its own clock.
 *
 * @param {Function} fn - Callback to run.
 * @param {{setImmediate: Function|undefined, MessageChannel: Function|undefined, setTimeout: Function}} [hosts] - The
 *   schedulers to pick from: the host's own unless a test hands in others.
 * @param {import("#helpers/clock").Clock} [clock] - The instance's clock.
 * @returns {void}
 * @internal
 *
 * @example
 * scheduleMacrotask(() => patchAfterAssignment(), undefined, this.clock);
 */
function scheduleMacrotask(fn, hosts = MACROTASK_HOSTS, clock = undefined) {
	if (clock?.hostTimers) {
		clock.setTimeout(pinToCurrentCaller(fn), 0);
		return;
	}
	// Called detached: a browser's schedulers refuse any receiver but the global object.
	const { setImmediate: immediate, MessageChannel: Channel, setTimeout: timeout } = hosts;
	if (typeof immediate === "function") {
		immediate(pinToCurrentCaller(fn));
		return;
	}
	if (typeof Channel === "function") {
		// Pinned here like the other two branches, not left to whatever the port's `onmessage` setter does with it.
		const pinned = pinToCurrentCaller(fn);
		const channel = new Channel();
		channel.port1.onmessage = () => {
			// Closing the port releases it; in Node an open port would keep the event loop alive.
			channel.port1.close();
			pinned();
		};
		channel.port2.postMessage(null);
		return;
	}
	timeout(pinToCurrentCaller(fn), 0);
}

/**
 * The language's own `Function.prototype[Symbol.hasInstance]`, taken when this file loads, before any module runs.
 * @type {Function}
 * @private
 */
const INTRINSIC_HAS_INSTANCE = PrototypeFunctions.Function.hasInstance;

/**
 * The language's own `Reflect.apply`, taken when this file loads, before any module runs: a module replacing
 * `globalThis.Reflect` cannot run code from {@link inheritsFrom}.
 * @type {Function}
 * @private
 */
const REFLECT_APPLY = Reflect.apply;

/**
 * `value instanceof ctor` as the language answers it, without any `Symbol.hasInstance` a module gave the class: a
 * module can give a global class (`Promise`, `Error`) one of its own, which an `instanceof` in slothlet's code would run
 * with the value slothlet is checking.
 * @param {*} value - The value.
 * @param {Function|null|undefined} ctor - The class; anything not a function answers false.
 * @returns {boolean} Whether `ctor.prototype` is on the value's prototype chain.
 * @public
 * @example
 * inheritsFrom(Promise.resolve(), Promise); // true
 */
function inheritsFrom(value, ctor) {
	if (typeof ctor !== "function" || value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	return REFLECT_APPLY(INTRINSIC_HAS_INSTANCE, ctor, [value]);
}

/**
 * The folder, name and extension of a file's path, in any host.
 *
 * @description
 * Node answers with `node:path` (`dirname`, `basename`, `extname`), so a Windows path splits on either separator. A
 * browser has no `node:path`; there a file is named by a URL or a `/`-separated path, so the parts come from the
 * string: the folder is everything before the last `/` (`.` for a bare name and `/` for a name right after a leading
 * `/`, as `path.dirname` answers), the name everything after it, and the extension the name's last `.` onward. A
 * name whose only dot is its first character has no extension, as `path.extname(".mjs")` answers.
 *
 * @param {string} filePath - A filesystem path (Node), or a URL or `/`-separated path (browser).
 * @returns {{dir: string, name: string, ext: string}} The folder, the file's name with its extension, and the extension.
 * @internal
 *
 * @example
 * fileParts("https://example.com/api/calc.mjs"); // { dir: "https://example.com/api", name: "calc.mjs", ext: ".mjs" }
 */
function fileParts(filePath) {
	if (isNode) return { dir: path.dirname(filePath), name: path.basename(filePath), ext: path.extname(filePath) };
	const cut = StringMethods.lastIndexOf(filePath, "/");
	const name = StringMethods.slice(filePath, cut + 1);
	const dot = StringMethods.lastIndexOf(name, ".");
	return { dir: cut < 0 ? "." : StringMethods.slice(filePath, 0, cut) || "/", name, ext: dot > 0 ? StringMethods.slice(name, dot) : "" };
}

export {
	isNode,
	fs,
	fsp,
	path,
	url,
	util,
	EventEmitter,
	AsyncLocalStorage,
	AsyncResource,
	executionAsyncResource,
	executionAsyncId,
	createHook,
	createRequire,
	vm,
	childProcess,
	loadJson,
	fileParts,
	scheduleMacrotask,
	inheritsFrom,
	hostHasNodeProcess,
	useNodeBuiltins,
	useBrowserStandIns
};
