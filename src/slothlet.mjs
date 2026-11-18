/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/slothlet.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T20:34:24-08:00 (1794976464)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Slothlet — transform a directory of ESM/CJS/TypeScript files into a unified, proxy-based API object.
 * @module @cldmv/slothlet
 * @typicalname slothlet
 * @version 3.0.0
 * @author CLDMV/Shinrai
 * @public
 * @simpleName
 *
 * @description
 * Slothlet is a module-loading framework for Node.js (ESM-first) that scans a directory of source files
 * and assembles them into a single, cohesive API object with zero runtime dependencies.
 *
 * Key Features:
 * - Eager and lazy loading strategies with configurable traversal depth
 * - Proxy-based API object with hot-reload, dynamic add/remove, and ownership tracking
 * - AsyncLocalStorage-based per-request context isolation (or experimental live bindings)
 * - Declarative hook system for intercepting and modifying API calls
 * - TypeScript file support (esbuild fast mode or tsc strict mode)
 * - Collision handling with merge / replace / skip / warn / error modes
 * - Rich lifecycle events, metadata annotations, and diagnostics
 * - Full i18n support for all framework messages (11 languages)
 *
 * @example
 * // ESM default import (recommended)
 * import slothlet from "@cldmv/slothlet";
 *
 * const api = await slothlet({ base: "./api" });
 * await api.math.add(2, 3);  // 5
 * await api.slothlet.shutdown();
 *
 * @example
 * // ESM named import
 * import { slothlet } from "@cldmv/slothlet";
 *
 * @example
 * // CommonJS require
 * const slothlet = require("@cldmv/slothlet");
 *
 * @example
 * // Lazy loading mode — modules loaded on first access
 * const api = await slothlet({ base: "./api", mode: "lazy" });
 *
 * @example
 * // With per-request context isolation
 * const api = await slothlet({
 *   base: "./api",
 *   context: { db, logger },
 *   runtime: "async"
 * });
 *
 * // Inside an API module, access context via:
 * // import { context } from "@cldmv/slothlet/runtime";
 *
 * @example
 * // With hook interception
 * const api = await slothlet({ base: "./api", hook: true });
 * api.slothlet.hook.on("before", "math.*", (endpoint, args) => {
 *   console.log("calling:", endpoint, args);
 * });
 *
 * @example
 * // Multiple independent instances
 * const api1 = await slothlet({ base: "./api" });
 * const api2 = await slothlet({ base: "./other-api" });
 *
 * @example
 * // Shutdown when done
 * await api.slothlet.shutdown();
 */
// Node-only builtins resolved once in the platform module so no `node:*` specifier
// enters the static-import graph a browser must parse (#123). Only the Node
// component-init path (_initializeComponents) touches fs/path/url; browser mode uses
// _initializeComponentsBrowser.
import { isNode, fs, fsp, path, url, createRequire, AsyncLocalStorage } from "#helpers/platform";
import { internals as contextInternals } from "#factories/context";
import { warnIfCoverageWithoutImporter } from "#processors/loader";
import { SlothletError, SlothletWarning } from "#errors";
import { SlothletDebug } from "#helpers/debug";
import {
	countHeldCopy,
	countReadThrough,
	CURRENT_COPY,
	endRun,
	FORK,
	forgetFlowStores,
	INHERIT_COPY,
	INSTANCE_FIELD,
	newRecord,
	reparentFlowStores,
	RUN_COPY,
	RUN_DONE,
	RUN_OPENED,
	whenIdle,
	WRITE_TARGET
} from "#helpers/flow-stores";
import { registerInstance } from "#handlers/lifecycle-token";
import { isCallableValue, internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { isFrameworkInternal, internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import { internals as trustedRootInternals } from "#handlers/trusted-root";
import { internals as translationsInternals } from "#i18n";
import { internals as eventemitterContextInternals } from "#helpers/eventemitter-context";
import { internals as schedulerContextInternals } from "#helpers/scheduler-context";
import { internals as eventtargetContextInternals } from "#helpers/eventtarget-context";
import { internals as eventtargetPropertyContextInternals } from "#helpers/eventtarget-property-context";
import { internals as observerContextInternals } from "#helpers/observer-context";
import { internals as promiseContextInternals } from "#helpers/promise-context";
import { internals as cloneContextInternals } from "#helpers/clone-context";
import { internals as asyncResourceContextInternals } from "#helpers/async-resource-context";
import { internals as nodeCallbackContextInternals } from "#helpers/node-callback-context";
import { internals as functionSourceContextInternals } from "#helpers/function-source-context";
import { internals as capabilityContextInternals } from "#helpers/capability-context";
import { DEFAULT_ROUTINES, RESERVED_EXPORTS } from "#helpers/defaults";
import { dataMemberOf, isFrameworkReservedKey } from "#helpers/reserved-keys";
import { isGuardedInternal, internals as instanceImportsInternals } from "#helpers/instance-imports";
import { normalizePermissionsConfig, normalizeClockConfig } from "#helpers/config";
import { assertConfigKeys, assertOptionKeys } from "#helpers/config-schema";
import { DEFAULT_CLOCK } from "#helpers/clock";
import { internals as framePlacementInternals } from "#handlers/frame-placement";
import {
	ArrayMethods,
	Arrays,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	listPush,
	listSplice,
	Map,
	mapEntries,
	mapList,
	MapMethods,
	NativeProcess,
	NativeProxy,
	Objects,
	Promise,
	promiseAllSettled,
	PromiseMethods,
	Reflect,
	Set,
	setFrom,
	settledWith,
	SetMethods,
	setToArray,
	splitText,
	StringMethods,
	URLSearchParams,
	URLSearchParamsMethods,
	WeakMap,
	WeakMapMethods
} from "#helpers/intrinsics";
import { segmentsOf } from "#helpers/segments";
const {
	resolveWrapper,
	releaseModuleMakers,
	releaseStandInChanges,
	runtime_assertRootChange,
	runtime_defineRootInspect,
	runtime_frameworkWrite,
	runtime_registerRoot,
	runtime_rootCall,
	runtime_rootCallCheck,
	runtime_rootClose,
	runtime_rootDefine,
	runtime_rootAssign,
	runtime_rootFixedMember,
	runtime_rootListing,
	runtime_rootMemberDescriptor,
	runtime_rootMemberRead,
	runtime_rootWithheld,
	runtime_rootPrototypeFor,
	runtime_rootInheritedRead,
	runtime_behindGivenView,
	runtime_unwrapSelfView,
	runtime_assertCapability
} = unifiedWrapperInternals("slothlet");
const { markSlothletProxy } = frameworkInternalsInternals("slothlet");
const trustedRootOwn = trustedRootInternals("slothlet");
const { initI18n } = translationsInternals("slothlet");
const { enableEventEmitterPatching, disableEventEmitterPatching, cleanupEventEmitterResources, setApiContextChecker } =
	eventemitterContextInternals("slothlet");
const { enableSchedulerPatching, disableSchedulerPatching } = schedulerContextInternals("slothlet");
const { enableEventTargetPatching, disableEventTargetPatching } = eventtargetContextInternals("slothlet");
const { enableEventTargetPropertyPatching, disableEventTargetPropertyPatching } = eventtargetPropertyContextInternals("slothlet");
const { enableObserverPatching, disableObserverPatching } = observerContextInternals("slothlet");
const { enablePromisePatching, disablePromisePatching } = promiseContextInternals("slothlet");
const { enableClonePatching, disableClonePatching } = cloneContextInternals("slothlet");
const { enableAsyncResourcePatching, disableAsyncResourcePatching } = asyncResourceContextInternals("slothlet");
const { enableNodeCallbackPatching, disableNodeCallbackPatching, enableAsyncCallbackServing, disableAsyncCallbackServing } =
	nodeCallbackContextInternals("slothlet");
const { enableFunctionSourcePatching, disableFunctionSourcePatching } = functionSourceContextInternals("slothlet");
const { registerCapabilityCheck, releaseCapabilityCheck } = capabilityContextInternals("slothlet");
const { claimInstanceScope, setInstanceSelfKind, closeInstanceSelf } = instanceImportsInternals("slothlet");
const { forgetInstanceScripts, recordInstanceOwner } = framePlacementInternals("slothlet");
const { getContextManager } = contextInternals("slothlet");

/**
 * The TypeScript processor's internal bindings, taken once, the first time an instance's shutdown needs them (the
 * processor is Node-only, so it is not imported where slothlet's own files load).
 * @type {Promise<{releaseSecureFallbackRoot: function(): Promise<void>}>|null}
 * @private
 */
let typescriptInternals = null;

/**
 * The async flow a full reload builds its new copy in (see {@link Slothlet#reload}): while a reload runs, the build reads
 * and writes the new copy's components, config and api tree, and every other caller reads the copy the instance has.
 * Null where the host has no AsyncLocalStorage (a browser), where a reload cannot keep the two apart.
 * @type {AsyncLocalStorage|null}
 * @private
 */
const reloadBuildStorage = AsyncLocalStorage ? new AsyncLocalStorage() : null;

/**
 * The instance ID a lazy node's load runs under when it was asked for by code in a run that keeps a copy a reload
 * swapped out (see {@link Slothlet#loadAsCaller}): a load runs apart from the flow that asked for it, so the ID is
 * carried to it here. Null where the host has no AsyncLocalStorage.
 * @type {import("node:async_hooks").AsyncLocalStorage<string>|null}
 * @private
 */
const loadAsStorage = AsyncLocalStorage ? new AsyncLocalStorage() : null;

/**
 * The instance's own fields, besides its component namespaces, that a full reload builds anew and swaps in at its end.
 * @type {string[]}
 * @private
 */
const RELOAD_COPY_FIELDS = ["config", "api", "debugLogger", "envTarget", "reference", "isLoaded"];

/**
 * The handlers a `run()` / `scope()` keeps a copy of its own of once it writes them (see {@link FORK}): permission rules,
 * event rules, mode, read gating, seal and principals; hooks; user and global metadata; event subscriptions; lifecycle
 * subscriptions. Each is a handler in the `handlers` namespace, by its property name there.
 * @type {string[]}
 * @private
 */
const FORKABLE_HANDLERS = ["permissionManager", "hookManager", "metadata", "eventManager", "lifecycle"];

/**
 * The copy a run record reads through to once its copy is torn down: none, so what still runs in its store (code
 * reached through the runtime `context` export) answers from the instance's own.
 * @type {{values: null, users: number}}
 * @private
 */
const TORN_DOWN = Objects.freeze({ __proto__: null, values: null, users: 0 });

/**
 * Instances currently relying on the globally-patched boundaries.
 *
 * The boundary patches — EventEmitter registration, the schedulers, `EventTarget` — are process-global
 * because that is where the functions being patched live. Unpatching is therefore global too, so one
 * instance shutting down must not take them away from instances still running: their deferred work
 * would stop carrying caller identity, and enforcement would start refusing reads that ought to
 * succeed. Held as a set of instance IDs rather than a counter so a repeated enable or a double
 * shutdown cannot skew the count.
 *
 * @type {Set<string>}
 * @private
 */
const boundaryPatchHolders = new Set();

/**
 * Live-runtime instances holding the `Promise.prototype.then` patch. Only the live runtime needs it, and it
 * runs on every `then` in the process, so it is removed once no live instance holds it even while
 * async-runtime instances keep the other boundary patches.
 * @type {Set<string>}
 * @private
 */
const promisePatchHolders = new Set();

/**
 * Async-runtime instances holding the `crypto.randomInt` patch that hands each callback its value in the caller's async
 * context (see `enableAsyncCallbackServing` in `helpers/node-callback-context`), removed once no async instance holds it.
 * @type {Set<string>}
 * @private
 */
const asyncCallbackHolders = new Set();

/**
 * Top-level config keys retained by identity when the original config is snapshotted for
 * `restart()`: `reference` and `context` are user-owned live objects the instance exposes as-is, so
 * a restart hands the new instance the same objects the original `slothlet({...})` call received.
 *
 * @type {ReadonlySet<string>}
 * @private
 */
const CONFIG_IDENTITY_KEYS = setFrom(["reference", "context"]);

/**
 * Resolved-config fields slothlet derives for itself, left out of `diag.inspect().config` (D-7): `dir` repeats `base`,
 * and `envTarget` is what `env` resolved to.
 * @type {Set<string>}
 * @private
 */
const INTERNAL_CONFIG_KEYS = setFrom(["dir", "envTarget"]);

/**
 * Copy a config value for the retained original-config snapshot (#504).
 *
 * @description
 * Plain objects (`Object.prototype` or null prototype, the two shapes the config schema walks) and
 * arrays are copied recursively so a later mutation of the caller's own options object (or of
 * anything config normalization touches) cannot change what `restart()` rebuilds from. A plain
 * object's copy carries its own enumerable string keys — the keys the schema and every option read —
 * and keeps its prototype (`metadata` accepts null-prototype objects). Everything else — functions,
 * class instances, `Map`/`Set`, `Date`, `RegExp`, `URL` — is kept by identity, as the original call
 * passed it (`metadata` values may be any of these). With `freeze`, every copied container is frozen
 * so the retained snapshot itself is immutable; `restart()` takes an unfrozen copy of it for each
 * rebuild, because normalization receives a config it is free to read into new objects.
 *
 * `seen` maps each source container to its copy, so a container referenced twice is copied once and
 * stays shared in the copy. It also ends cycles: the snapshot is taken before the config is
 * validated, so a cyclic value that validation later refuses (`metadata` refuses a cycle through
 * plain objects and arrays alike with `INVALID_ARGUMENT`) is copied without recursing forever.
 *
 * @param {unknown} value - Value to copy.
 * @param {boolean} freeze - Freeze each copied container.
 * @param {Map<object, object>} [seen=new Map()] - Source container → its copy (shared references, cycles).
 * @returns {unknown} The copy (or the value itself for anything that is not a plain container).
 * @private
 *
 * @example
 * const snapshot = copyConfigValue({ base: "./api", permissions: { rules: [] } }, true);
 */
function copyConfigValue(value, freeze, seen = new Map()) {
	if (!value || typeof value !== "object") return value;
	if (MapMethods.has(seen, value)) return MapMethods.get(seen, value);
	if (Arrays.isArray(value)) {
		const out = [];
		MapMethods.set(seen, value, out);
		for (let ofIndex = 0, ofList = value; ofIndex < ofList.length; ofIndex++) {
			const item = ofList[ofIndex];
			listPush(out, copyConfigValue(item, freeze, seen));
		}
		return freeze ? Objects.freeze(out) : out;
	}
	const proto = Objects.getPrototypeOf(value);
	if (proto !== Objects.prototype && proto !== null) return value;
	const out = proto === null ? Objects.create(null) : {};
	MapMethods.set(seen, value, out);
	// Own enumerable keys, symbols included (user data in `metadata` may carry them). Each is defined, never assigned:
	// an own "__proto__" key (JSON.parse makes one) stays a key instead of setting the copy's prototype.
	for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (!Objects.getOwnPropertyDescriptor(value, key).enumerable) continue;
		Objects.defineProperty(out, key, {
			__proto__: null,
			value: copyConfigValue(value[key], freeze, seen),
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	return freeze ? Objects.freeze(out) : out;
}

/**
 * Copy a top-level config object for the retained snapshot, keeping {@link CONFIG_IDENTITY_KEYS} by
 * identity.
 *
 * @param {object} config - Top-level config.
 * @param {boolean} freeze - Freeze the copied containers.
 * @returns {object} The copy.
 * @private
 *
 * @example
 * const snapshot = copyTopLevelConfig({ base: "./api", context: ctx }, true); // snapshot.context === ctx
 */
function copyTopLevelConfig(config, freeze) {
	const out = {};
	for (let ofIndex = 0, ofList = Objects.keys(config); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		out[key] = SetMethods.has(CONFIG_IDENTITY_KEYS, key) ? config[key] : copyConfigValue(config[key], freeze);
	}
	return freeze ? Objects.freeze(out) : out;
}

/**
 * Slothlet instance - clean architecture prototype
 * @private
 */
class Slothlet {
	// Reserved root-level API keys that should be skipped by recursive functions
	// Only applies at the root level (path depth 0) - nested keys with same name are allowed
	static RESERVED_ROOT_KEYS = ["slothlet", "shutdown", "destroy"];

	// Properties to skip during recursive operations (at any depth)
	static SKIP_PROPS = ["___materialize", "____impl", "____slothletInternal"];

	/**
	 * The handle this instance claimed for its instance ID (see claimInstanceScope in helpers/instance-imports): how
	 * its CommonJS files are loaded as its own, and how what slothlet keeps about its files is released. Held here
	 * alone.
	 * @type {{instanceID: string, require: function(string, object=): *, release: function(): void}|null}
	 */
	#importScope = null;

	/**
	 * The id this instance's capability check was registered under (see helpers/capability-context), or null.
	 * @type {string|null}
	 * @private
	 */
	#capabilityHolder = null;

	/**
	 * Whether a URL is one of this instance's own files: it carries this instance's tag, or that of the instance it was
	 * reloaded from.
	 * @param {string|null} url - An importer's URL.
	 * @returns {boolean} True for this instance's file.
	 * @private
	 */
	#importsAsOwnFile(url) {
		if (typeof url !== "string") return false;
		const tag = URLSearchParamsMethods.get(
			new URLSearchParams(StringMethods.includes(url, "?") ? StringMethods.slice(url, StringMethods.indexOf(url, "?") + 1) : ""),
			"slothlet_instance"
		);
		if (!tag) return false;
		const own = `${this.instanceID ?? ""}`;
		return (
			tag === own || StringMethods.startsWith(own, `${tag}_reload_`) || StringMethods.startsWith(tag, `${splitText(own, "_reload_")[0]}`)
		);
	}

	/**
	 * The clock this instance reads the time and schedules its deferred work with (the `clock` option): held here alone,
	 * never part of the config the instance hands out, so only the host that created the instance can supply it.
	 * @type {import("#helpers/clock").Clock}
	 */
	#clock = DEFAULT_CLOCK;

	/**
	 * The fresh scope a normal reload has claimed and switches the instance to once the new ID's context is set up (see
	 * {@link Slothlet#load}); null when no reload is under way. Until then the instance stays on its ID and context, so a
	 * reload that fails before that context exists leaves it as it was.
	 * @type {{instanceID: string, require: Function, release: Function}|null}
	 * @private
	 */
	#pendingScope = null;

	/**
	 * The full reload under way, while it builds its new copy (see {@link Slothlet#openReloadWindow}); null otherwise.
	 * @type {{mark: object, next: object, nextCopy: object|null, settled: Promise<void>, finish: Function, closed: boolean}|null}
	 * @private
	 */
	#reloadWindow = null;

	/**
	 * The instance's own values of the copy fields (its component namespaces and {@link RELOAD_COPY_FIELDS}) while those
	 * are accessors (see {@link Slothlet#installCopyFields}); null while they are plain fields.
	 * @type {object|null}
	 * @private
	 */
	#fields = null;

	/**
	 * The token of the copy the instance has, once a `run()` / `scope()` recorded it (see {@link CURRENT_COPY}); null
	 * until one does.
	 * @type {{values: object|null}|null}
	 * @private
	 */
	#copy = null;

	/**
	 * How many copies are held apart from what the instance has: tokens that kept what the instance had (a reload
	 * swapped another copy in, or the instance changed a forkable handler after runs recorded the token) while a run
	 * still reads through one, and records of runs that hold a fork of their own. While any is, the copy fields answer
	 * through {@link Slothlet#readField}. Each is let go when the last run reading it is torn down (see
	 * {@link Slothlet#teardownRun}).
	 * @type {number}
	 * @private
	 */
	#heldCopies = 0;

	/**
	 * Set while {@link Slothlet#runRecord} tells which store is running.
	 * @type {boolean}
	 * @private
	 */
	#resolvingCopy = false;

	/**
	 * For each forkable handler (see {@link FORKABLE_HANDLERS}), the handlers namespaces of the copies that hold it
	 * without owning it: kept tokens' and runs'. Before the handler's owner writes it, each of them gets a fork of its
	 * own (see {@link Slothlet#keepSharers}). A copy torn down leaves every set it is in (see
	 * {@link Slothlet#unshareHandlers}).
	 * @type {WeakMap<object, Set<object>>}
	 * @private
	 */
	#sharers = new WeakMap();

	/**
	 * The handlers namespace that owns each fork: the run's (or the kept token's) that the fork was made for. The
	 * instance owns the handlers in its own namespace, which are not recorded here.
	 * @type {WeakMap<object, object>}
	 * @private
	 */
	#owners = new WeakMap();

	/**
	 * Every copy held apart from the instance's (see {@link Slothlet#holdCopy}), for a restart to update what goes with
	 * the shared api tree in each (see {@link Slothlet#copiesFollowTree}). A copy leaves it when it is torn down.
	 * @type {Set<object>}
	 * @private
	 */
	#held = new Set();

	/**
	 * The records of the runs whose work is not done yet (see `holdRunWork` in `helpers/flow-stores`), for
	 * `shutdown()` to tear down what they still hold.
	 * @type {Set<object>}
	 * @private
	 */
	#runs = new Set();

	/**
	 * Records of runs whose work is done, waiting for the instance to be idle to have their copies torn down (see
	 * {@link Slothlet#teardownWhenIdle}).
	 * @type {Array<object>}
	 * @private
	 */
	#retiring = [];

	/**
	 * Whether a teardown of {@link Slothlet#retiring} is scheduled.
	 * @type {boolean}
	 * @private
	 */
	#teardownScheduled = false;

	/**
	 * The import scopes of IDs a reload left that kept copies still load from, by ID (see
	 * {@link Slothlet#keepReplacedScope}).
	 * @type {Map<string, object>}
	 * @private
	 */
	#keptScopes = new Map();

	/**
	 * The ALS mark of instance work that must read and write the instance's own fields even when called from a run: a
	 * restart's teardown and rebuild.
	 * @type {object}
	 * @private
	 */
	#instanceWork = {};

	/**
	 * Set by a reload with no window (see {@link Slothlet#carryIntoBuild}) for load() to call once the new copy's components
	 * exist, before any of its modules load; null otherwise.
	 * @type {Function|null}
	 * @private
	 */
	#carryOnLoad = null;

	/**
	 * The context a reload carries into the instance it rebuilds, so values `context.set()` made survive it.
	 * @type {object|null}
	 * @private
	 */
	#carriedContext = null;

	/**
	 * The instance's clock: the functions the host gave in the `clock` option, or the ones slothlet loaded with.
	 * @returns {import("#helpers/clock").Clock} The frozen clock.
	 * @internal
	 * @example
	 * slothlet.clock.now();
	 */
	get clock() {
		return this.#clock;
	}

	/**
	 * Claim the instance's ID for its files, before any of them load. An ID this instance already holds stays held;
	 * one it held before is released.
	 * @returns {void}
	 * @throws {SlothletError} INSTANCE_ID_IN_USE when the ID is held by something else in the process.
	 * @private
	 */
	#claimImportScope() {
		if (this.#importScope?.instanceID === this.instanceID) return;
		const scope = claimInstanceScope(this.instanceID);
		if (!scope) throw new this.SlothletError("INSTANCE_ID_IN_USE", { instance: this.instanceID });
		this.#adoptImportScope(scope);
	}

	/**
	 * The most fresh IDs {@link Slothlet#claimFreshScope} tries before it gives up.
	 * @type {number}
	 * @private
	 */
	static #FRESH_ID_ATTEMPTS = 8;

	/**
	 * Claim a fresh instance ID for the instance's files, without taking it yet: the instance stays on the ID and scope
	 * it holds until {@link Slothlet#adoptImportScope} switches. An ID something else already holds is passed over for
	 * another fresh one, a bounded number of times.
	 * @param {string} [prefix] - What the ID starts with (`<id>_reload` for a reload); `slothlet` when omitted.
	 * @returns {{instanceID: string, require: Function, release: Function}} The claimed handle.
	 * @throws {SlothletError} INSTANCE_ID_IN_USE when every ID tried is held; the instance is left as it was.
	 * @private
	 */
	#claimFreshScope(prefix) {
		let instanceID = null;
		for (let attempt = 0; attempt < Slothlet.#FRESH_ID_ATTEMPTS; attempt++) {
			instanceID = this.helpers.utilities.generateId(prefix);
			const scope = claimInstanceScope(instanceID);
			if (scope) return scope;
		}
		throw new this.SlothletError("INSTANCE_ID_IN_USE", { instance: instanceID });
	}

	/**
	 * Switch the instance to a scope it has claimed: its ID becomes the scope's, and the scope it held before is released.
	 * @param {{instanceID: string, require: Function, release: Function}} scope - The claimed handle.
	 * @returns {void}
	 * @private
	 */
	#adoptImportScope(scope) {
		if (this.#importScope !== scope) this.#releaseImportScope();
		this.instanceID = scope.instanceID;
		this.#importScope = scope;
		// A reload's files get the form of `self` the api took when it was first built, from their first import (#803).
		if (this.boundApi) setInstanceSelfKind(this.instanceID, typeof this.boundApi === "function");
	}

	/**
	 * Release what slothlet keeps about the files loaded under the instance ID this instance holds.
	 * @returns {void}
	 * @private
	 */
	#releaseImportScope() {
		if (this.#importScope) setInstanceSelfKind(this.#importScope.instanceID, null);
		this.#importScope?.release();
		this.#importScope = null;
	}

	/**
	 * Run a CommonJS file of this instance through the instance's private CommonJS cache (see scopeRequire in
	 * helpers/instance-imports).
	 * @param {string} filePath - Absolute path of the CommonJS file.
	 * @param {object} [options] - `fresh`, `importer` and `mount`, as scopeRequire takes them.
	 * @param {string} [instanceID] - The ID to load under: the instance's own, or one a kept copy loads from.
	 * @returns {*} The file's `module.exports`.
	 * @package
	 * @example
	 * slothlet.requireInScope("/app/api/counter.cjs", { fresh: true });
	 */
	requireInScope(filePath, options, instanceID = this.instanceID) {
		// A kept copy's lazy node loads through the scope of the ID it was loaded under (see Slothlet#loadID).
		if (instanceID !== this.instanceID) {
			const kept = MapMethods.get(this.#keptScopes, instanceID);
			if (kept !== undefined) return kept.scope.require(filePath, options);
		}
		this.#claimImportScope();
		return this.#importScope.require(filePath, options);
	}

	/**
	 * Whether the instance holds the import scope of an ID: its own, or one a kept copy still loads from (see
	 * {@link Slothlet#keepReplacedScope}).
	 * @param {string} instanceID - The ID.
	 * @returns {boolean} True when it does.
	 * @package
	 */
	holdsScope(instanceID) {
		return instanceID === this.instanceID || MapMethods.has(this.#keptScopes, instanceID);
	}

	constructor() {
		// Expose error classes to components (no imports needed)
		this.SlothletError = SlothletError;
		// The warnings raised through this instance, read by `api.slothlet.warnings.get()` (#819).
		this.warnings = [];
		// Per-instance subclass: every warning is recorded on this instance (#819), and printed unless the instance's
		// `silent` option is on (#838).
		this.SlothletWarning = SlothletWarning.forInstance(
			() => this.config?.silent === true,
			(warning) => listPush(this.warnings, warning)
		);
		// Debug logger will be initialized in load() with config
		this.debugLogger = null;

		// Instance properties
		this.instanceID = null;
		this.config = null;
		this.envTarget = "node"; // Default to node; overridden early in load() before _initializeComponents
		this.api = null;
		this.boundApi = null; // Created in load(), forwards to this.api
		this.contextManager = null;
		this.isLoaded = false;
		this.reference = null;
		this.context = null;

		// Environment snapshot (captured before any module lifecycle in load())
		this.envSnapshot = null;

		// Clean-slate restart (#504). `_originalConfig` is the frozen snapshot of the config the
		// `slothlet({...})` call received; `_originalBase` is its base as resolved against that call's
		// caller (a relative base must not be re-resolved against whoever calls restart()).
		this._originalConfig = null;
		this._originalBase = undefined;
		// Restart epochs: every UnifiedWrapper records `_buildEpoch` at construction; a wrapper whose
		// epoch is below `_liveEpoch` belongs to a tree a restart replaced, and its proxy forwards to the
		// node at the same path in the live tree (see unified-wrapper.mjs).
		this._buildEpoch = 0;
		this._liveEpoch = 0;
		// Module incarnations (#625): for each moduleID mounted with api.add, a token that stands for that mount for
		// as long as the module is there. Every wrapper records its module's token at construction; code whose token
		// is not the module's current one belongs to a removed module, and has no standing, even once another module
		// takes the id. Kept across a reload, which keeps the modules it rebuilds; a restart starts over.
		this._moduleIncarnations = new Map();
		// The last token of each id whose module was removed, until a module is mounted under the id again: what that
		// module subscribed still hears about its own removal (#625).
		this._retiredIncarnations = new Map();
		// In-flight restart() promise — concurrent calls share it.
		this._restartPromise = null;
		// True for the duration of restart() (tags the `shutdown` / `init` lifecycle events).
		this._restarting = false;

		// Lazy materialization tracking (for api.slothlet.materialize)
		this._totalLazyCount = 0; // Total lazy wrappers created
		this._unmaterializedLazyCount = 0; // Currently unmaterialized lazy wrappers
		this._materializationComplete = false; // Set to true when all lazy wrappers materialized
		this._materializationWaiters = []; // Promises waiting for full materialization
		this._materializationCompleteEmitted = false; // Track if event was already emitted
		this._materializeCallbackCalled = false; // The `loader.materialize` callback ran (once per instance)

		// Component categories
		this.componentCategories = ["helpers", "handlers", "builders", "processors", "modes"];

		// Component namespaces (populated by _initializeComponents)
		for (let ofIndex = 0, ofList = this.componentCategories; ofIndex < ofList.length; ofIndex++) {
			const category = ofList[ofIndex];
			this[category] = {};
		}
	}

	/**
	 * Initialize all component class instances via auto-discovery
	 * Organizes components into namespaces: helpers.*, handlers.*, builders.*, processors.*
	 * @private
	 */
	async _initializeComponents() {
		// Auto-discover helpers, handlers, builders, processors
		// NOTE: Does NOT auto-discover:
		//   - errors/ (throw-able classes, not instance components)
		//   - runtime/ (context managers set manually during load)
		//   - i18n/ (translation utilities, not instance components)

		// Browser mode: readdirSync is unavailable; use a static specifier list so bundlers
		// can statically analyse imports and tree-shake unused components.
		if (this.envTarget === "browser") {
			await this._initializeComponentsBrowser();
			return;
		}

		const baseDir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "lib");

		for (let ofIndex = 0, ofList = this.componentCategories; ofIndex < ofList.length; ofIndex++) {
			const category = ofList[ofIndex];
			const categoryDir = path.join(baseDir, category);
			const files = filterList(fs.readdirSync(categoryDir), (f) => StringMethods.endsWith(f, ".mjs"));

			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const filePath = path.join(categoryDir, file);

				try {
					const module = await import(url.pathToFileURL(filePath).href);

					// Find ALL exported classes with slothletProperty (supports multiple per file)
					// A guarded internal export is no component, and is passed over without being used (it answers only the host).
					const classExports = filterList(
						Objects.values(module),
						(exp) => typeof exp === "function" && !isGuardedInternal(exp) && exp.slothletProperty
					);

					for (let ofIndex = 0, ofList = classExports; ofIndex < ofList.length; ofIndex++) {
						const ClassExport = ofList[ofIndex];
						const propName = ClassExport.slothletProperty;
						// Organize into category namespace
						this[category][propName] = new ClassExport(this);

						if (this.config?.debug?.initialization) {
							this.debug("initialization", {
								key: "DEBUG_MODE_COMPONENT_INITIALIZED",
								component: ClassExport.name,
								category,
								propertyName: propName
							});
						}
					}
				} catch (error) {
					// A component that refuses the config it was built with (a permission rule naming nothing, for one)
					// throws its own error, which is the one the host has to see.
					if (error instanceof SlothletError) throw error;
					// Component file failed to import - this is fatal
					// unreachable via tests (2026-03-05): framework component files are always
					// present in the installed package; this guard exists for corrupt installs.
					/* v8 ignore next */
					throw new this.SlothletError(
						"MODULE_IMPORT_FAILED",
						{
							file: filePath
						},
						{ cause: error }
					);
				}
			}
		}
	}

	/**
	 * Browser-safe component initialisation that uses static specifiers instead of
	 * `readdirSync`. Bundlers (webpack, vite, rollup) can statically analyse these
	 * `import()` calls and include only the referenced modules in the bundle.
	 *
	 * The category is derived from the third path segment of each specifier so this
	 * list can grow without any extra bookkeeping.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	async _initializeComponentsBrowser() {
		// Static list of [specifier, category] pairs — every file that contains a class
		// with a `slothletProperty` static field. Files without such a class are silently
		// skipped by the filter below, so extras in this list are harmless.
		const BROWSER_COMPONENT_SPECIFIERS = [
			// builders
			"#builders/api-assignment",
			"#builders/api_builder",
			"#builders/builder",
			"#builders/modes-processor",
			// handlers
			"#handlers/api-cache-manager",
			"#handlers/api-manager",
			"#handlers/event-manager",
			"#handlers/hook-manager",
			"#handlers/lifecycle",
			"#handlers/materialize-manager",
			"#handlers/metadata",
			"#handlers/module-manager",
			"#handlers/ownership",
			"#handlers/permission-manager",
			"#handlers/routine-manager",
			"#handlers/version-manager",
			// helpers
			"#helpers/config",
			"#helpers/hint-detector",
			"#helpers/modes-utils",
			"#helpers/resolve-from-caller",
			"#helpers/sanitize",
			"#helpers/utilities",
			// modes
			"#modes/eager",
			"#modes/lazy",
			// processors
			"#processors/flatten",
			"#processors/loader"
		];

		for (let ofIndex = 0, ofList = BROWSER_COMPONENT_SPECIFIERS; ofIndex < ofList.length; ofIndex++) {
			const specifier = ofList[ofIndex];
			// Derive category from the specifier: public exports use "@cldmv/slothlet/<category>/...";
			// internal-only handlers/factories use the package `imports` form "#<category>/...".
			const parts = splitText(specifier, "/");
			const category = StringMethods.startsWith(specifier, "#") ? StringMethods.slice(parts[0], 1) : parts[2]; // e.g. "builders", "handlers", "helpers"

			const module = await import(specifier);
			// A guarded internal export is no component, and is passed over without being used (it answers only the host).
			const classExports = filterList(
				Objects.values(module),
				(exp) => typeof exp === "function" && !isGuardedInternal(exp) && exp.slothletProperty
			);

			for (let ofIndex = 0, ofList = classExports; ofIndex < ofList.length; ofIndex++) {
				const ClassExport = ofList[ofIndex];
				const propName = ClassExport.slothletProperty;
				this[category][propName] = new ClassExport(this);
			}
		}
	}

	/**
	 * Register construction-time lifecycle subscribers supplied via the `lifecycle` config option (#148).
	 *
	 * @description
	 * Runs after the Lifecycle emitter exists (auto-discovered in `_initializeComponents`) and after
	 * config normalization, but BEFORE `buildAPI`, so handlers catch events emitted during the cold-start
	 * build (init-time `impl:warning` / `impl:created` / …). `config.lifecycle` maps an event name to a
	 * handler function or an array of functions; each is attached via `lifecycle.subscribe(event, fn)`.
	 * Because they are ordinary subscribers, they also receive runtime events afterward. Shape validation
	 * lives in `Config.normalizeLifecycle`.
	 * @returns {void}
	 * @private
	 */
	_setupConfigLifecycleSubscribers() {
		const map = this.config.lifecycle;
		if (!map) {
			return;
		}
		const lifecycle = this.handlers.lifecycle;
		for (let ofIndex = 0, ofList = Objects.entries(map); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				event = ofEntry[0],
				handler = ofEntry[1];
			const handlers = Arrays.isArray(handler) ? handler : [handler];
			for (let ofIndex = 0, ofList = handlers; ofIndex < ofList.length; ofIndex++) {
				const fn = ofList[ofIndex];
				lifecycle.subscribe(event, fn);
			}
		}
	}

	/**
	 * Set up lifecycle event subscribers for cross-system coordination
	 * @private
	 */
	_setupLifecycleSubscribers() {
		// Defensive: lifecycle is always auto-registered via slothletProperty; return-guard unreachable.
		/* v8 ignore start */
		if (!this.handlers.lifecycle) {
			return; // Lifecycle handler not available
		}
		/* v8 ignore stop */

		// Subscribe metadata system to impl:created and impl:changed events
		// metadata is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.metadata) {
			// #398: the metadata system rides the INTERNAL contribution stream (pre-placement, every
			// contribution). It tags the same target the pre-#398 `data.impl` field carried on this
			// event: the real wrapper (`____wrapperRef`) — which under LAZY is present at construction even
			// though `wrapper.____impl` is still null — falling back to the leaf impl when there is no
			// wrapper (the lazy-materialization emit carries a raw function value, no `____wrapperRef`).
			// Tagging the wrapper here is load-bearing: adoption propagates a parent wrapper's baseModuleID
			// to its children, so tagging null instead left lazily-materialized children with no moduleID.
			// subscribeInternal, not subscribe, so this never fires from the public post-placement re-emit.
			this.handlers.lifecycle.subscribeInternal("impl:created", (data, token) => {
				this.handlers.metadata.tagSystemMetadata(
					data.____wrapperRef ?? data.wrapper?.____impl,
					{
						filePath: data.filePath,
						apiPath: data.apiPath,
						moduleID: data.moduleID,
						sourceFolder: data.sourceFolder
					},
					token
				);
			});

			this.handlers.lifecycle.subscribeInternal("impl:changed", (data, token) => {
				this.handlers.metadata.tagSystemMetadata(
					data.wrapper?.____impl,
					{
						filePath: data.filePath,
						apiPath: data.apiPath,
						moduleID: data.moduleID,
						sourceFolder: data.sourceFolder
					},
					token
				);
			});

			this.handlers.lifecycle.subscribe("impl:removed", (data) => {
				// Clean up user metadata for the removed impl, keyed by its root segment. The payload's `path` is the
				// removed member's api path as segments.
				this.handlers.metadata.removeUserMetadataByApiPath(data.path[0]);
			});
		}

		// Subscribe the routine manager (#341) to impl:created/impl:changed/impl:removed so every
		// mounted module's contribution to a configured routine name is captured — including a
		// losing contributor's own value, which ordinary collision resolution would otherwise drop
		// before it could ever be observed, and a later direct reassignment (`self.auth.shutdown =
		// fn`), which fires impl:changed rather than impl:created.
		// routineManager is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.routineManager) {
			// #398: the routine manager needs every contribution (merge-losers included, with the raw
			// fn) BEFORE placement — so it rides the INTERNAL contribution stream. impl:removed stays a
			// public event (a single post-removal notification), so it uses the public subscribe.
			this.handlers.lifecycle.subscribeInternal("impl:created", (data) => {
				this.handlers.routineManager.onImplCreated(data);
			});
			this.handlers.lifecycle.subscribeInternal("impl:changed", (data) => {
				this.handlers.routineManager.onImplCreated(data);
			});
			this.handlers.lifecycle.subscribe("impl:removed", (data) => {
				// The public payload names the removed member by `path` (segments) and `module`; the routine manager prunes by
				// dotted api path and module ID.
				this.handlers.routineManager.onImplRemoved({
					apiPath: ArrayMethods.join(data.path, "."),
					moduleID: data.module
				});
			});
		}

		// Subscribe ownership system to impl:created and impl:changed events
		// ownership is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.ownership) {
			// The api node a public impl:created / impl:changed is about. A subscriber a module subscribed is
			// handed its module's view of it instead of the implementation (#625).
			const nodeOf = (data) => ({ impl: data.____wrapperRef?.____slothletInternal?.proxy ?? null });
			// What ownership records for a contribution that is an object: the node itself, as the load's subtree
			// confirmation records it in eager mode. The node adopts the object's members as its own, which leaves
			// the object empty, so a record of the object would hold nothing to restore once another module's add
			// over the path is removed (#815). A function or a primitive is recorded as itself, as before (a leaf's
			// kind is read from it). The node's proxy is made after its construction event, so the wrapper stands
			// in until then; ownership resolves either to the node.
			const recordedValue = (data, implValue) =>
				implValue !== null && typeof implValue === "object"
					? (data.____wrapperRef?.____slothletInternal?.proxy ?? data.____wrapperRef ?? implValue)
					: implValue;
			// #398: rides the INTERNAL contribution stream (every contribution, pre-placement) so it can
			// see and register merge-losers too, then decides placement and surfaces the PUBLIC event.
			// Stays SYNCHRONOUS: ownership.register() below runs during the same synchronous emitInternal()
			// dispatch a wrapper's construction fires, so the composed tree is fully registered by the time
			// the constructor returns — exactly as before #398. The public re-emit is fire-and-forget (it
			// never rejects; emit() isolates its own handler errors), so it never makes this handler async
			// and never defers the registration into a later microtask (which raced settle/leaves()).
			this.handlers.lifecycle.subscribeInternal("impl:created", (data) => {
				// Read at dispatch, not at subscription: the ownership handler can be gone by the time a leaf is built (an
				// instance whose ownership tracking was taken away), and then there is nothing to register with.
				const ownership = this.handlers.ownership;
				if (!ownership) return;
				// Get collision mode from config or use default
				// config.api.collision.mode.api is always set after normalization; "merge" fallback never reached.
				/* v8 ignore next */
				const configCollisionMode = this.config?.api?.collision?.mode?.api || "merge";
				// This subscriber fires synchronously during wrapper construction — BEFORE a caller's
				// own per-call override (e.g. api.add()'s forceOverwrite → "replace") has a chance to
				// reach this registration, since that override isn't threaded through UnifiedWrapper's
				// constructor/impl:created payload. Clamp to "replace"/"merge-replace" only, exactly
				// like ModesProcessor#resolveOwnershipCollisionMode already does for its own leaf
				// registrations: "error"/"skip"/"warn" must never throw/reject HERE, or a
				// forceOverwrite-driven build throws OWNERSHIP_CONFLICT before its own override is
				// ever applied. The authoritative "error" enforcement point is the top-level
				// setValueAtPath check, which runs with the real resolved mode directly (#366 review).
				// A module an api.add() placed under "replace"/"merge-replace" (forceOverwrite included)
				// registers with that mode instead: its content is what is live at the paths it provides,
				// and without the real mode it was recorded as a merge loser wherever another module's
				// function already sat — including a lazy leaf materializing after the add returned (#524).
				const collisionMode =
					ownership.getPlacementMode(data.moduleID, data.apiPath) ??
					(configCollisionMode === "replace" || configCollisionMode === "merge-replace" ? configCollisionMode : "merge");
				// The leaf's impl. On a LAZY construction event `wrapper.____impl` is still null (the leaf
				// hasn't materialized), so fall back to the real wrapper (`____wrapperRef`) exactly as the
				// former `?? data.impl` did — `data.impl` used to be `this` on the construction emit, and
				// `____wrapperRef` now carries that same reference (#398). Ownership's kind detection needs a
				// non-null value here, or a lazy leaf registers with no recorded kind.
				const implValue = data.wrapper?.____impl ?? data.____wrapperRef;
				// RoutineManager#rebuildStacks() installs a stacked callable directly onto the live
				// tree (`target[key] = ...`), guarding only ITS OWN raw capture via `recording = false`
				// — this subscriber has no equivalent guard, so without this check the write is
				// misattributed to whatever module owns the CONTAINER (e.g. the base module), polluting
				// the ownership stack with a phantom "the stacked callable is its own contribution"
				// entry on every rebuild. Mirrors RoutineManager#onImplCreated's identical check
				// (#372/#373 review, suppressed finding).
				if (typeof implValue === "function" && implValue.____slothletRoutineStack === true) {
					return;
				}
				ownership.register({
					moduleID: data.moduleID,
					apiPath: data.apiPath,
					value: recordedValue(data, implValue),
					source: data.source,
					filePath: data.filePath,
					// Where the value sits in its file's module namespace (#484), resolved by the wrapper.
					exportPath: data.exportPath ?? null,
					memberExportPaths: data.memberExportPaths ?? null,
					collisionMode: collisionMode
				});
				// #398: ownership has now decided placement — surface the PUBLIC, post-placement
				// impl:created to consumers, but ONLY for the contribution that actually won this path.
				// A merge-loser or a skipped/"warn" registration never becomes the current owner, so it
				// never fires publicly (fixing "impl:created announces a leaf that merge then discards").
				// The public payload carries the wrapped callable + metadata, never the raw impl.
				if (ownership.getCurrentOwner(data.apiPath)?.moduleID === data.moduleID) {
					// Fire-and-forget: keeps this handler synchronous (see the note above) — emit() isolates
					// its own handler errors and never rejects, so no unhandled rejection can escape.
					void this.handlers.lifecycle.emit(
						"impl:created",
						{
							path: segmentsOf(data.apiPath),
							// #433: the public tier carries the WRAPPED callable on a stable `impl` field — never the
							// raw impl (#398), and no longer the reserved internal `wrapper.____impl` handle, which is
							// dropped from the PUBLIC event entirely: it was redundant with `impl` and re-exposed an
							// internal name (the very coupling #433 removes). `null` before a lazy wrapper materializes.
							// The INTERNAL event still carries `wrapper` — ownership/metadata/routine subscribers read
							// it via subscribeInternal — and `____wrapperRef` is never surfaced (it would leak the instance).
							// `impl` is the implementation the wrapper holds, handed to host subscribers only: a
							// subscriber a module subscribed gets its module's view of the node (`nodeOf`) instead (#625).
							impl: data.wrapper?.____impl ?? null,
							source: data.source,
							module: data.moduleID,
							file: data.filePath,
							folder: data.sourceFolder
						},
						nodeOf(data)
					);
				}
			});

			// Also subscribe (INTERNAL) to impl:changed for replacements (when wrapper already exists but
			// impl changes) — handles a module replacing another module's impl on reload/reassignment.
			this.handlers.lifecycle.subscribeInternal("impl:changed", (data) => {
				// Read at dispatch, as the impl:created subscriber above does.
				const ownership = this.handlers.ownership;
				if (!ownership) return;
				// Get collision mode from config or use default
				// config.api.collision.mode.api is always set after normalization; "merge" fallback never reached.
				/* v8 ignore next */
				const configCollisionMode = this.config?.api?.collision?.mode?.api || "merge";
				// Same placement lookup and clamp as the impl:created subscriber above, and for the same
				// reasons — see its comments.
				const collisionMode =
					ownership.getPlacementMode(data.moduleID, data.apiPath) ??
					(configCollisionMode === "replace" || configCollisionMode === "merge-replace" ? configCollisionMode : "merge");
				// The leaf's impl. data.wrapper.____impl is normally set for impl:changed events; the
				// `?? data.____wrapperRef` fallback mirrors the impl:created subscriber (see its note) — the
				// former `?? data.impl` referenced the wrapper `this`, now carried on `____wrapperRef` (#398).
				const implValue = data.wrapper?.____impl ?? data.____wrapperRef;
				// See the identical guard in the impl:created subscriber above — rebuildStacks()'s own
				// property write reaches THIS subscriber too (#372/#373 review, suppressed finding).
				if (typeof implValue === "function" && implValue.____slothletRoutineStack === true) {
					return;
				}

				// Only register if this moduleID doesn't already own this path
				// This prevents duplicate registrations from multiple impl:changed events
				const currentOwner = ownership.getCurrentOwner(data.apiPath);
				if (currentOwner?.moduleID !== data.moduleID) {
					ownership.register({
						moduleID: data.moduleID,
						apiPath: data.apiPath,
						value: recordedValue(data, implValue),
						source: data.source,
						filePath: data.filePath,
						exportPath: data.exportPath ?? null,
						memberExportPaths: data.memberExportPaths ?? null,
						collisionMode: collisionMode
					});
				} else {
					// Same owner, new impl (a lazy leaf materializing, a hot reload): the entry stays put, but
					// its module origin follows the impl that actually arrived (#484).
					ownership.refreshOrigin(data.moduleID, data.apiPath, {
						filePath: data.filePath,
						exportPath: data.exportPath ?? null,
						memberExportPaths: data.memberExportPaths ?? null
					});
				}
				// #398: surface the PUBLIC, post-placement impl:changed — only when this contribution is
				// the placed owner of the path (a change to a shadowed/merge-lost contribution is not a
				// public change). Wrapped callable + metadata, never the raw impl.
				if (ownership.getCurrentOwner(data.apiPath)?.moduleID === data.moduleID) {
					// Fire-and-forget — see the impl:created subscriber's note.
					void this.handlers.lifecycle.emit(
						"impl:changed",
						{
							path: segmentsOf(data.apiPath),
							// #433: stable public callable field, no public `wrapper` — see the impl:created re-emit above,
							// also for what a subscriber a module subscribed gets instead (#625).
							impl: data.wrapper?.____impl ?? null,
							source: data.source,
							module: data.moduleID,
							file: data.filePath,
							folder: data.sourceFolder
						},
						nodeOf(data)
					);
				}
			});
		}
	}

	/**
	 * Register a lazy wrapper for materialization tracking
	 * Called by UnifiedWrapper constructor when mode === "lazy"
	 * @private
	 */
	_registerLazyWrapper() {
		this._totalLazyCount++;
		this._unmaterializedLazyCount++;
		// A wrapper registered after everything loaded (an api.add(), a reload) reopens completion, so the
		// load that brings the count back to zero resolves the wait() callers queued meanwhile (#594).
		this._materializationComplete = false;

		if (this.config?.debug?.materialize) {
			this.debug("materialize", {
				key: "DEBUG_MODE_LAZY_WRAPPER_REGISTERED",
				total: this._totalLazyCount,
				unmaterialized: this._unmaterializedLazyCount
			});
		}
	}

	/**
	 * Count a lazy wrapper that is already loaded, such as one a forced replace hid that loaded through a
	 * reference held to it and is now put back (#585 review). It joins the total but is not waited on, so
	 * completion is left as it is.
	 * @private
	 */
	_registerLoadedLazyWrapper() {
		this._totalLazyCount++;
	}

	/**
	 * Stop counting a loaded lazy wrapper that a forced replace hides from the api (#585 review). It is out
	 * of the total while hidden; nothing waits on it, so completion is left as it is.
	 * @private
	 */
	_onLoadedLazyWrapperParked() {
		this._totalLazyCount--;
	}

	/**
	 * Notify that a lazy wrapper has materialized
	 * Called by UnifiedWrapper.___materialize() after materialization completes
	 * @private
	 */
	_onWrapperMaterialized() {
		this._unmaterializedLazyCount--;

		if (this.config?.debug?.materialize) {
			this.debug("materialize", {
				key: "DEBUG_MODE_LAZY_WRAPPER_MATERIALIZED",
				total: this._totalLazyCount,
				unmaterialized: this._unmaterializedLazyCount,
				// _totalLazyCount is always > 0 when this callback fires (at least one wrapper was registered).
				/* v8 ignore next */
				percentage: this._totalLazyCount > 0 ? ((this._totalLazyCount - this._unmaterializedLazyCount) / this._totalLazyCount) * 100 : 100
			});
		}

		this._checkMaterializationComplete();
	}

	/**
	 * Count a loaded lazy wrapper as unloaded again after a reload re-armed it (#588). Completion is
	 * reset, so wait() callers block until it loads again.
	 * @private
	 */
	_onLazyWrapperRearmed() {
		this._unmaterializedLazyCount++;
		this._materializationComplete = false;
	}

	/**
	 * Stop counting an unloaded lazy wrapper that was discarded before it loaded, such as a rejected
	 * collision candidate or the child of a re-armed wrapper (#588).
	 * @private
	 */
	_onLazyWrapperDiscarded() {
		this._totalLazyCount--;
		this._unmaterializedLazyCount--;
		this._checkMaterializationComplete();
	}

	/**
	 * Resolve wait() callers and emit `materialized:complete` once no counted lazy wrapper is unloaded.
	 * @private
	 */
	_checkMaterializationComplete() {
		// Check if all lazy wrappers are materialized
		if (this._unmaterializedLazyCount === 0 && !this._materializationComplete) {
			this._materializationComplete = true;

			if (this.config?.debug?.materialize) {
				this.debug("materialize", {
					key: "DEBUG_MODE_ALL_LAZY_WRAPPERS_MATERIALIZED",
					total: this._totalLazyCount
				});
			}

			// Resolve all waiting promises
			const waiters = listSplice(this._materializationWaiters, 0);
			for (let ofIndex = 0, ofList = waiters; ofIndex < ofList.length; ofIndex++) {
				const resolve = ofList[ofIndex];
				resolve();
			}

			// Emit lifecycle event if tracking enabled and not already emitted
			if (this.config?.tracking?.materialization && !this._materializationCompleteEmitted) {
				this._materializationCompleteEmitted = true;
				// lifecycle is always auto-registered via slothletProperty; false arm unreachable.
				/* v8 ignore next */
				if (this.handlers?.lifecycle) {
					this.handlers.lifecycle.emit("materialized:complete", {
						total: this._totalLazyCount,
						at: this.#clock.now()
					});
				}
			}

			// Before the instance has finished loading, load() calls it at its end instead.
			if (this.isLoaded) this._callMaterializeCallback();
		}
	}

	/**
	 * Call the `loader.materialize` callback, when one was given, the first time everything is materialized and the
	 * instance has loaded. It runs once per instance; what it throws or rejects with is reported as a
	 * `WARNING_LIFECYCLE_HANDLER_ERROR` warning, like a `materialized:complete` handler that fails.
	 * @returns {void}
	 * @private
	 */
	_callMaterializeCallback() {
		const callback = this.config?.loader?.materialize;
		if (typeof callback !== "function" || this._materializeCallbackCalled || this._unmaterializedLazyCount !== 0) return;
		this._materializeCallbackCalled = true;
		const warn = (error) => {
			new this.SlothletWarning("WARNING_LIFECYCLE_HANDLER_ERROR", { event: "materialized:complete" }, { cause: error });
		};
		try {
			PromiseMethods.then(settledWith(callback({ total: this._totalLazyCount, timestamp: this.#clock.now() })), undefined, warn);
		} catch (error) {
			warn(error);
		}
	}

	/**
	 * Capture a frozen snapshot of `process.env` at initialization time.
	 *
	 * @description
	 * Called at the very start of `load()`, before config normalization and before any
	 * module `register()` / `init()` lifecycle hooks run. When `envConfig.include` is
	 * provided only the listed keys are captured; otherwise every key present in
	 * `process.env` is included.
	 *
	 * @param {Object|undefined} envConfig - Raw env option from user config.
	 * @param {string[]} [envConfig.include] - Allowlist of env key names to capture.
	 * @returns {Object} Frozen shallow copy of the selected environment variables.
	 * @private
	 *
	 * @example
	 * // Full snapshot (default — no include filter)
	 * this.envSnapshot = this._captureEnvSnapshot(undefined);
	 * // => Object.freeze({ NODE_ENV: "test", PATH: "/usr/bin", ... })
	 *
	 * @example
	 * // Filtered snapshot via include allowlist
	 * this.envSnapshot = this._captureEnvSnapshot({ include: ["NODE_ENV"] });
	 * // => Object.freeze({ NODE_ENV: "test" })
	 */
	_captureEnvSnapshot(envConfig) {
		const rawInclude = envConfig?.include;
		const include = Arrays.isArray(rawInclude) ? filterList(rawInclude, (key) => typeof key === "string") : null;
		const useAllowlist = include !== null && include.length > 0;
		const raw = useAllowlist
			? ArrayMethods.reduce(
					include,
					(acc, key) => {
						if (Objects.hasOwn(NativeProcess.env, key)) {
							acc[key] = NativeProcess.env[key];
						}
						return acc;
					},
					Objects.create(null)
				)
			: { ...NativeProcess.env };
		return Objects.freeze(raw);
	}

	/**
	 * Load API from directory
	 * @param {Object} config - Configuration options
	 * @param {string} [config.base] - Directory (node mode) or base URL (browser mode) to load API modules from. Required in both modes.
	 * @param {string} [config.mode="eager"] - Loading mode (eager or lazy)
	 * @param {string} [config.runtime="async"] - Runtime type (async or live)
	 * @param {string} [preservedInstanceID] - Optional instance ID to preserve (used by reload)
	 * @returns {Promise<Object>} Bound API object
	 * @public
	 * @example
	 * const slothlet = new Slothlet();
	 * const api = await slothlet.load({
	 *   base: "./api_tests/api_test",
	 *   mode: "eager",
	 *   runtime: "async"
	 * });
	 */
	async load(config = {}, preservedInstanceID = null) {
		// Every key must be one the v4 config has: a misspelled or renamed option would otherwise read as its default.
		assertConfigKeys(config);

		// The host's clock is read once and kept on the instance, never in the config the instance hands out. A reload
		// passes the normalised config back in, which has none: the instance keeps the clock it has.
		if (config.clock !== undefined) {
			this.#clock = normalizeClockConfig(config.clock);
			const { clock: _, ...rest } = config;
			config = rest;
		}

		// Store raw config for components to access if needed
		this.config = config;

		// Detect execution-environment target early — before _initializeComponents — so that
		// the browser-mode component initialisation path can skip readdirSync.
		// normalizeEnvTarget is not yet available (Config component not constructed), so we
		// check the raw value directly. This stays in sync with Config.normalizeEnvTarget.
		// A browser file list acts as a fallback browser-mode signal (mirrors normalizeEnvTarget).
		const platform = config.loader?.platform;
		this.envTarget = platform === "browser" || (platform !== "node" && config.loader?.files != null) ? "browser" : "node";

		// Capture process.env snapshot before any module lifecycle runs.
		// Uses raw config.env so the snapshot precedes config normalization and
		// any module register()/init() calls.
		// Guard: preserve the snapshot across reloads — the spec requires it to be
		// immutable for the lifetime of the instance.
		// Browser mode skips the capture entirely — `process` may not exist in a real
		// browser, and even when running browser-mode tests under Node we must not
		// leak Node env into the browser-mode api.slothlet.env surface.
		if (!this.envSnapshot) {
			this.envSnapshot = this.envTarget === "browser" ? Objects.freeze(Objects.create(null)) : this._captureEnvSnapshot(config.env);
		}

		// Early-init debug logger with raw config so that debug.initialization messages
		// produced inside _initializeComponents() are visible even before transformConfig runs.
		// Will be re-initialised below with the fully normalised config.
		this.debugLogger = new SlothletDebug(config);

		// Normalise `permissions` once, up front, so the PermissionManager built by _initializeComponents() reads the
		// normalised section (#772) and transformConfig() below normalises that same snapshot, never a second read of the
		// raw value. An invalid value is left raw here: transformConfig() reports it as INVALID_CONFIG.
		let normalizedConfig = config;
		if (config.permissions !== undefined) {
			try {
				normalizedConfig = { ...config, permissions: normalizePermissionsConfig(config.permissions) };
			} catch {
				normalizedConfig = config;
			}
		}
		this.config = normalizedConfig;

		// Initialize all components via auto-discovery BEFORE transforming config
		// This allows config helpers to be component classes
		await this._initializeComponents();

		// Register per-instance lifecycle capability token (must be before any tagSystemMetadata calls)
		registerInstance(this);

		// Discard any routine chain state from a previous load() cycle (reload() re-invokes load()
		// on the same instance) before the fresh cold-start build re-populates it via impl:created.
		// routineManager is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.routineManager) {
			this.handlers.routineManager.reset();
		}

		// Set up lifecycle event subscribers for cross-system coordination
		this._setupLifecycleSubscribers();

		// Transform and validate config using component classes
		this.config = this.helpers.config.transformConfig(normalizedConfig);

		// Default routines present in the normalized routines config make their root paths host-only
		// (#529) — decided here, per load, once the effective list is known.
		this.handlers.permissionManager?.applyDefaultRoutineRules(this.config.routines.entries);

		// A reload in a host with no AsyncLocalStorage: the new components take the instance's permission state, hooks and
		// metadata now, as calls made while the reload runs reach them.
		if (this.#carryOnLoad !== null) this.#carryOnLoad();

		// Pin the original base as resolved against the creating call's caller, so restart() rebuilds
		// from the same directory rather than re-resolving a relative base from its own call site (#504).
		if (this._originalConfig && this._originalBase === undefined) {
			this._originalBase = this.config.base;
		}

		// One-shot DX hint (#235): under a vitest COVERAGE run with this slothlet copy externalized
		// and no injectable importer configured, the consumer's leaf coverage will misattribute —
		// say so at boot, pointing at the fix, instead of leaving a mysteriously low report.
		if (this.envTarget === "node") {
			warnIfCoverageWithoutImporter(this.config, { Warning: this.SlothletWarning });
		}

		// The permission baseline (docs/PERMISSIONS.md): with permissions on, each check not met is a warning; under strict
		// the instance does not start, before any module's code is loaded.
		// The live runtime keeps nothing in an AsyncLocalStorage, so the async-context-frame check is the async runtime's alone.
		await this.handlers.permissionManager?.checkBaseline(this.envTarget, this.config.runtime === "live" ? "live" : "async");

		// Register construction-time lifecycle subscribers (config.lifecycle) on the freshly-built
		// Lifecycle emitter BEFORE buildAPI runs, so events emitted during the cold-start build
		// (init-time impl:warning / impl:created / …) are observable. These are normal subscribers,
		// so they also receive runtime events afterward. (#148)
		this._setupConfigLifecycleSubscribers();

		// Apply i18n configuration (dev-facing; process-global)
		if (this.config?.i18n?.language) {
			initI18n({ language: this.config.i18n.language, SlothletWarning: this.SlothletWarning });
		}

		// Re-initialise debug logger with the fully normalised config (includes all flags).
		// This replaces the early-init created above and ensures post-transform flags are active.
		this.debugLogger = new SlothletDebug(this.config);

		// Use preserved instance ID (from reload) or generate new one. The ID is claimed for this instance's files
		// before any of them load.
		// A normal reload's fresh ID is taken only once its context is set up, below.
		const pendingScope = this.#pendingScope?.instanceID === preservedInstanceID ? this.#pendingScope : null;
		if (pendingScope) {
			// Taken below.
		} else if (preservedInstanceID) {
			this.instanceID = preservedInstanceID;
			this.#claimImportScope();
		} else {
			this.#adoptImportScope(this.#claimFreshScope());
		}

		// Store reference and context from config
		this.reference = this.config.reference;
		// The instance's own copy of the context passed in: `context.set()` changes it, the caller's object stays as it
		// was. Top-level keys are copied; their values are the ones given. A reload keeps what `context.set()` made.
		this.context = this.#carriedContext ?? { ...(this.config.context ?? {}) };
		this.#carriedContext = null;

		// Get appropriate context manager based on runtime
		// Browser has no AsyncLocalStorage; force the live-binding context there.
		this.contextManager = getContextManager(this.envTarget === "browser" ? "live" : this.config.runtime);
		// The async runtime's store is made now, before any file of this instance loads; the live runtime has none.
		if (typeof this.contextManager.openStore === "function") this.contextManager.openStore();

		// Set up a generic fallback EventEmitter context checker. This callback body is
		// dead code in practice: both AsyncContextManager and LiveContextManager define
		// registerEventEmitterContextChecker(), which is called a few lines below and
		// immediately overwrites this checker via a second setApiContextChecker() call.
		// The callback is registered then discarded synchronously — no EventEmitter
		// activity occurs between these two calls, so lines below can never execute.
		// The callback is synchronously overwritten by registerEventEmitterContextChecker(); it can never execute.
		/* v8 ignore start */
		setApiContextChecker(() => {
			const ctx = this.contextManager.tryGetContext();
			return !!(ctx && ctx.self);
		});
		/* v8 ignore stop */

		// Initialize context (or reuse existing if preservedInstanceID provided)
		let store;
		if (pendingScope) {
			// A normal reload: the new ID's context first, then the switch to it, so a reload that cannot set the context up
			// leaves the instance on the ID and context it has.
			store = this.contextManager.initialize(pendingScope.instanceID, this.config, this.#clock);
			await this.#switchToPendingScope(pendingScope);
		} else if (preservedInstanceID && MapMethods.has(this.contextManager.instances, preservedInstanceID)) {
			// Reload: DONT reuse store, delete old and create fresh. The instance keeps its ID, so its run() / scope()
			// stores stay where they are.
			this.contextManager.cleanup(preservedInstanceID, { keepFlows: true });
			store = this.contextManager.initialize(this.instanceID, this.config, this.#clock);
		} else {
			// Fresh load: initialize new store
			store = this.contextManager.initialize(this.instanceID, this.config, this.#clock);
		}
		// A reload: until the new copy is built, the context answers calls with the api the instance has (the root proxy,
		// which reads the tree in place), not an empty one.
		if (this.boundApi) {
			store.self = this.boundApi;
			store.context = this.context || {};
			store.slothlet = this;
		}
		// Mark this base store as the trusted root immediately, before any internal tree walk
		// (ownership registration, materialization) reads through the permission read-gate. A
		// call/read with no active module caller is treated as host-initiated (allowed) only when the
		// resolved context carries this marker — the basis for failing closed on absent caller.
		// Non-enumerable so async execution-store shallow copies (`{ ...baseStore }`) do NOT inherit it:
		// only the genuine base store and scope stores explicitly descended from it are trusted.
		Objects.defineProperty(store, trustedRootOwn.TRUSTED_ROOT, { __proto__: null, value: true, configurable: true });

		// Enable EventEmitter context patching (once globally, safe to call multiple times)
		// This ensures EventEmitter callbacks preserve AsyncLocalStorage context
		enableEventEmitterPatching();

		// Carry the scheduling module's identity across timers and microtasks. Same reason as the
		// EventEmitter patch above: a callback registered inside a module call runs after that call has
		// returned, so the identity has to be captured while it still exists.
		enableSchedulerPatching();

		// Same for DOM-style events, the boundary a browser reaches for. Also restores the async store,
		// which `EventTarget` drops entirely — `self` was unusable inside a listener.
		enableEventTargetPatching();

		// `addEventListener` only covers listener registration; assigning `thing.onmessage = fn` writes
		// straight to the interface's own IDL accessor and bypasses it entirely.
		enableEventTargetPropertyPatching();

		// Observer constructors (Mutation/Resize/Intersection) take their callback as a constructor
		// argument rather than a registered listener or an assigned property — a third boundary shape.
		enableObserverPatching();

		// A fire-and-forget promise reaction (`p.then(cb)` nobody awaits) runs after the registering call
		// returned, the same way a timer callback does (#595). `catch`/`finally` register through `then`.
		// Live runtime only: the async runtime carries identity through promise reactions itself, so it pays
		// nothing for this patch, which runs on every `then` in the process (#601 review).
		if (typeof this.contextManager.runRegisteredAsHost === "function") {
			enablePromisePatching();
			// `AsyncLocalStorage.snapshot()` / `bind()` and `AsyncResource` restore Node's async context, which the live
			// runtime's identity is not part of: what they run is pinned to the caller that made them. Live runtime
			// only, as the promise patch is, and released with it.
			enableAsyncResourcePatching();
			// `fs.readFile(file, cb)`, `dns.lookup(host, cb)`, `crypto.randomBytes(n, cb)`: Node calls these callbacks from
			// the event loop, past every boundary above, so each is pinned to the flow and caller that handed it in.
			enableNodeCallbackPatching();
			SetMethods.add(promisePatchHolders, this.instanceID);
		} else {
			// Node calls the callbacks of overlapping `crypto.randomInt(n, cb)` calls from the async context of the one that
			// started its shared refill: each is handed its value through `process.nextTick()` in the caller's own.
			enableAsyncCallbackServing();
			SetMethods.add(asyncCallbackHolders, this.instanceID);
		}

		// The platform's cloning functions (`structuredClone`, `v8.serialize`, `postMessage`) refuse a Proxy, and what one
		// module hands another is a view while the permission system is on: the patch lets them copy the data behind it.
		enableClonePatching();

		// `Function.prototype.toString.call(node)` answers native code for any Proxy, and an api node of a function is
		// one: the patch answers the function's source, as `node.toString()` does (#750).
		enableFunctionSourcePatching();

		// Built-in capabilities (code from strings, `data:`/`blob:` imports, module hooks): refused to module code while
		// the permission system is on, unless a rule opens one. The entry points are wrapped while any instance with a
		// permission config that can be on is up, and unwrapped with the last.
		// A reload loads again under a new instanceID: the check held under the previous one goes once the new one is
		// registered, so the instance is checked once per call and the entry points are not unwrapped in between.
		const previousCapabilityHolder = this.#capabilityHolder;
		this.#capabilityHolder = null;
		if (this.config?.permissions && this.config.permissions.mode !== "disabled") {
			const instanceID = this.instanceID;
			registerCapabilityCheck(instanceID, (name, route, importer, filename, runnerCompile) =>
				runtime_assertCapability(this, name, route, this.#importsAsOwnFile(importer) ? importer : null, filename, runnerCompile)
			);
			this.#capabilityHolder = instanceID;
		}
		if (previousCapabilityHolder !== null && previousCapabilityHolder !== this.#capabilityHolder) {
			releaseCapabilityCheck(previousCapabilityHolder);
		}

		// Claim a share in the global patches, released on this instance's shutdown.
		SetMethods.add(boundaryPatchHolders, this.instanceID);

		// Register context checker for EventEmitter tracking (must be after patching)
		// registerEventEmitterContextChecker is always defined in both context managers.
		/* v8 ignore next */
		if (typeof this.contextManager.registerEventEmitterContextChecker === "function") {
			this.contextManager.registerEventEmitterContextChecker();
		}

		// Note: ownership manager and hook manager already initialized via auto-discovery

		// Generate base moduleID for ownership tracking
		const baseModuleId = `base_${StringMethods.substring(this.helpers.utilities.generateId(), 0, 8)}`;

		// A reload: the copy the instance has keeps answering calls while the new one builds, and its code is the same base
		// module's. The fresh ownership records the base module's mount now, so that code is not taken for a removed
		// module's until the build records it again.
		if (preservedInstanceID && this.boundApi) this.handlers.ownership?.setModuleEndpoint(baseModuleId, ".");

		// Build raw API (with context manager and instance ID for unified wrapper)
		// UnifiedWrapper handles context binding internally - no separate wrapper needed!
		const baseApi = await this.builders.builder.buildAPI({
			dir: this.config.base,
			// #471: a null dir means the instance has no base directory — an empty root.
			noBase: this.config.base === null,
			mode: this.config.mode,
			moduleID: baseModuleId,
			hidden: this.config.hidden ?? null
		});

		// Temporarily assign baseApi to this.api for buildFinalAPI
		// (buildFinalAPI mutates this.api in place by adding builtins)
		this.api = baseApi;

		// Build final API with builtins attached (mutates this.api in place)
		const apiWithBuiltins = await this.buildFinalAPI(this.api);

		// NOW store in cache AFTER builtins are attached
		// Cache stores the complete API tree with builtins
		// apiCacheManager is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.apiCacheManager) {
			this.handlers.apiCacheManager.set(baseModuleId, {
				endpoint: ".",
				moduleID: baseModuleId,
				api: this.api, // Store complete API with builtins
				folderPath: this.config.base,
				mode: this.config.mode,
				sanitizeOptions: this.config.sanitize || {},
				// The base entry's own build context is "initial" (api-cache-manager.mjs's reload
				// passes collisionContext: "initial" for endpoint "."), so its stored override must
				// reflect collision.initial, not collision.api — the two can differ, and using the
				// wrong one made a base-API reload apply API-level collision semantics to the
				// original initial-load file/folder and export conflicts (PR #366 review).
				// config.api.collision.mode.initial is always set after config normalization; "merge" fallback never reached.
				/* v8 ignore next */
				collisionMode: this.config.api.collision.mode.initial || "merge",
				config: { ...this.config },
				timestamp: this.#clock.now()
			});
		}

		// Inject runtime-aware metadata functions that have proper context access
		this.injectRuntimeMetadataFunctions(apiWithBuiltins);

		// Apply init metadata if provided in config
		if (this.config.metadata && typeof this.config.metadata === "object") {
			// Set as global metadata so it's inherited by all future api.add() calls
			for (let ofIndex = 0, ofList = Objects.entries(this.config.metadata); ofIndex < ofList.length; ofIndex++) {
				const ofEntry = ofList[ofIndex],
					key = ofEntry[0],
					value = ofEntry[1];
				this.handlers.metadata.setGlobalMetadata(key, value);
			}

			// Register user metadata for base moduleID
			this.handlers.metadata.registerUserMetadata(baseModuleId, this.config.metadata);
		}

		// Register all API paths with ownership manager AFTER building final API
		// This ensures builtins (slothlet, shutdown, destroy) are also registered
		// ownership is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.ownership) {
			this.handlers.ownership.registerSubtree(apiWithBuiltins, baseModuleId, "");
			// Base module owns the whole tree — endpoint ".".
			this.handlers.ownership.setModuleEndpoint(baseModuleId, ".");
		}

		// Note: apiWithBuiltins IS this.api (buildFinalAPI now mutates in place, no clone)
		// this.api already has builtins attached from buildFinalAPI

		// Create boundApi proxy if first load (preserves reference across reloads)
		if (!this.boundApi) {
			// V8 fork-pool coverage gaps with isCallable cond-expr; proxy trap null guards are defensive dead code.
			/* v8 ignore start */
			// Determine proxy target type based on this.api (like UnifiedWrapper does)
			const isCallable = typeof this.api === "function" || (this.api && typeof this.api.default === "function");
			// A bound function for a callable root, as an api node's own target is: callable and constructible, with no
			// `prototype` of its own, so the traps report the root's function as it is (an async function, an arrow, a
			// bound function or a method has none) without breaking an invariant of the target's.
			const proxyTarget = isCallable ? FunctionMethods.bind(function () {}) : {};
			// A function root's prototype, on a record of the root's own as a function node's is on its node's: the root
			// file's function's until the root is given one (`Object.setPrototypeOf(api, …)`), which the record then holds,
			// so the function is never changed through the root. A load that gives the root a value starts it again.
			const rootPrototype = { of: null, given: false, prototype: null };
			const rootPrototypeNow = () => {
				if (rootPrototype.of !== this.api) {
					rootPrototype.of = this.api;
					rootPrototype.given = false;
				}
				if (!rootPrototype.given) rootPrototype.prototype = Reflect.getPrototypeOf(this.api);
				return rootPrototype.prototype;
			};
			// Whether a member is read from a prototype the function root was given: one the root does not hold itself.
			const rootInherits = (prop) => {
				if (!isCallable) return false;
				rootPrototypeNow();
				return rootPrototype.given && !Objects.hasOwn(this.api, prop);
			};
			// The prototype the root has now, as the root itself holds it: an object root's is its api's.
			const rootHeld = () => (isCallable ? rootPrototypeNow() : Reflect.getPrototypeOf(this.api));
			// Whether the root has a prototype it was given (an object root starts with `Object.prototype`).
			const rootGiven = () =>
				isCallable ? (rootPrototypeNow(), rootPrototype.given) : Reflect.getPrototypeOf(this.api) !== Objects.prototype;
			// The views module code is handed of a prototype the root was given, kept for as long as the root has it, and
			// the prototype as whoever reads the root now is handed it: the host the object, a module its own view.
			const rootViews = { prototypeViews: null };
			const rootReported = (target) => {
				if (!this.api || !Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target);
				return rootGiven() ? runtime_rootPrototypeFor(this, rootViews, rootHeld()) : rootHeld();
			};
			// Node inspects a Proxy's target: the target shows the root as a node's shows the node.
			runtime_defineRootInspect(this, proxyTarget);

			this.boundApi = markSlothletProxy(
				runtime_registerRoot(
					new NativeProxy(proxyTarget, {
						// A member is read as a node reads its own: the same gate, at the member's name (see unified-wrapper.mjs).
						// A member the target holds fixed is read as the target holds it (proxy invariant).
						get: (target, prop) => {
							if (!this.api) return undefined;
							const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
							if (fixed && !fixed.configurable) return runtime_rootFixedMember(this, prop, fixed, false);
							// A key only the target holds (its inspect hook, which `util.inspect` reads through the proxy when the root
							// is the target of another proxy) is the target's.
							if (fixed && typeof prop === "symbol" && !(prop in this.api)) return fixed.value;
							// The root's `__proto__` is the prototype it reports, as an object's or a function's is.
							if (prop === "__proto__" && !Objects.hasOwn(this.api, prop)) {
								const from = rootHeld();
								return from === null ? undefined : Reflect.get(from, prop, this.boundApi);
							}
							// A member a function root inherits from a prototype it was given is read from there, on the root, and
							// one an object root inherits from one through its api: either under the rules a member of the root is.
							if (rootInherits(prop)) {
								const from = rootPrototype.prototype;
								if (from === null) return runtime_rootMemberRead(this, prop, undefined);
								return runtime_rootInheritedRead(this, rootViews, from, prop, Reflect.get(from, prop, this.boundApi));
							}
							if (!isCallable && rootGiven() && !Objects.hasOwn(this.api, prop)) {
								const from = rootHeld();
								if (from !== null) return runtime_rootInheritedRead(this, rootViews, from, prop, this.api[prop]);
							}
							return runtime_rootMemberRead(this, prop, this.api[prop]);
						},
						// A change to the root is a change to the api, held to the rules the same change at a node is held to.
						set: (target, prop, value) => {
							if (!this.api) return true;
							return runtime_rootAssign(this, target, prop, value);
						},
						has: (target, prop) => {
							if (!this.api) return false;
							if (rootInherits(prop)) {
								if (rootPrototype.prototype !== null && Reflect.has(rootPrototype.prototype, prop)) return true;
							} else if (prop in this.api) return true;
							const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
							return fixed !== undefined && (!fixed.configurable || !Reflect.isExtensible(target));
						},
						// The root lists what a node lists of its own: a member the reader may not read is left out. A closed root
						// lists what it holds, to every reader (proxy invariant).
						ownKeys: (target) => {
							if (!this.api) return [];
							if (!Reflect.isExtensible(target)) return Reflect.ownKeys(target);
							return runtime_rootListing(this, target, Reflect.ownKeys(this.api));
						},
						defineProperty: (target, prop, descriptor) => (this.api ? runtime_rootDefine(this, target, prop, descriptor) : false),
						deleteProperty: (target, prop) => {
							if (!this.api) return true;
							runtime_assertRootChange(this, prop);
							const held = Objects.hasOwn(this.api, prop);
							if (!Reflect.deleteProperty(this.api, prop)) return false;
							if (!held && Reflect.isExtensible(target)) return true;
							return Reflect.deleteProperty(target, prop);
						},
						// A call of the root's function is checked as a call of a function node is.
						apply: (target, thisArg, args) => {
							if (!this.api) return undefined;
							runtime_rootCallCheck(this, args);
							return runtime_rootCall(this, thisArg, args);
						},
						construct: (target, args) => {
							if (!this.api) return {};
							runtime_rootCallCheck(this, args);
							return runtime_rootCall(this, undefined, args, true);
						},
						// The root's function's own prototype (an async function's `AsyncFunction.prototype`), as its api node reports it,
						// or the one the root was given.
						getPrototypeOf: (target) => rootReported(target),
						// A prototype set on an object root is set on the api, whose members inherit from it, and on its target, which
						// reports it. A function root takes it on its own record, and its function keeps the one it has.
						setPrototypeOf: (target, proto) => {
							if (!this.api) return Reflect.setPrototypeOf(target, proto);
							runtime_assertRootChange(this, null);
							if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === proto;
							proto = runtime_behindGivenView(runtime_unwrapSelfView(proto));
							if (isCallable) {
								rootPrototypeNow();
								rootPrototype.given = proto !== Reflect.getPrototypeOf(this.api);
								rootPrototype.prototype = proto;
								return true;
							}
							return Reflect.setPrototypeOf(this.api, proto) && Reflect.setPrototypeOf(target, proto);
						},
						// Closing the root closes the api (see runtime_rootClose).
						preventExtensions: (target) => {
							if (!this.api) return Reflect.preventExtensions(target);
							const closed = runtime_rootClose(
								this,
								target,
								isCallable,
								rootGiven() ? runtime_rootPrototypeFor(this, rootViews, rootHeld(), true) : rootHeld()
							);
							// A module's `self` is closed as the root it stands for is (#827).
							if (closed) closeInstanceSelf(this.instanceID, target);
							return closed;
						},
						getOwnPropertyDescriptor: (target, prop) => {
							const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
							if (fixed && !fixed.configurable) return runtime_rootFixedMember(this, prop, fixed, true);
							if (this.api && prop in this.api) {
								const desc = Objects.getOwnPropertyDescriptor(this.api, prop);
								const described = desc ? runtime_rootMemberDescriptor(this, prop, desc) : undefined;
								if (described) return { __proto__: null, ...described, configurable: true };
							}
							// A closed root reports every member it holds (proxy invariant): one the reader may not read is described
							// with its value withheld (#825).
							if (fixed && !Reflect.isExtensible(target)) {
								if (runtime_rootWithheld(this, prop)) return { __proto__: null, ...fixed, value: undefined };
								runtime_rootMemberRead(this, prop, this.api?.[prop]);
								return fixed;
							}
							return undefined;
						}
					})
				)
			);
			/* v8 ignore stop */
		}

		// The instance's files get the form of `self` its api takes: a function for a function root (#803).
		setInstanceSelfKind(this.instanceID, typeof this.boundApi === "function");

		// Set self and context in store
		store.self = this.boundApi;
		store.context = this.context || {}; // User-provided context from config
		// Stash the slothlet instance on the store so runtime set-traps can reach
		// `apiManager.setOwnedProperty` when handling `self.X = …` assignments.
		store.slothlet = this;

		// TODO: Merge reference object using add API system for ownership tracking
		// For now, directly assign to boundApi (will be replaced with proper add API)
		if (this.reference && typeof this.reference === "object") {
			runtime_frameworkWrite(this.boundApi, () => Objects.assign(this.boundApi, this.reference));
		}

		// Stackable lifecycle routines (#341): fold every mounted module's contribution to a
		// configured routine name into its namespace's stacked callable and each routine's root
		// cascade, then run every `mode: "startup"` routine's cascade as the final awaited step of
		// composition — `await slothlet(...)` resolves only once this completes.
		// routineManager is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.routineManager) {
			await this.handlers.routineManager.rebuildStacks(this.boundApi);
			await this.handlers.routineManager.runStartupModeRoutines();
		}

		this.isLoaded = true;

		// `loader.materialize` given a function: call it now when everything is already materialized (eager mode, or a lazy
		// tree that finished during load); otherwise _checkMaterializationComplete() calls it when the last wrapper loads.
		this._callMaterializeCallback();

		// `init` (#504): a new instance finished building — the cold start, and the rebuild inside
		// restart(). A reload (which always passes an instance ID to preserve or rotate) is the same
		// instance re-reading its modules, not a new one, so it does not emit this.
		if (!preservedInstanceID) {
			await this.handlers.lifecycle.emit("init", { instance: this.instanceID, restart: this._restarting });
		}

		return this.boundApi;
	}

	/**
	 * Reload entire instance (fresh load with preserved instance ID)
	 * @public
	 *
	 * @description
	 * Reloads all modules in the API by clearing caches and doing a fresh load().
	 * Preserves instance ID (so context is maintained), hooks, and API reference.
	 * Replays all add/remove operations in chronological order.
	 *
	 * @param {Object} [options={}] - Reload options.
	 * @param {"keep"|"new"} [options.instance="new"] - `"keep"` reuses the existing instanceID
	 *   instead of generating a new `_reload_` ID. This causes
	 *   `contextManager.instances.has(preservedInstanceID)` to be TRUE inside `load()`,
	 *   triggering the cleanup-then-reinitialise branch. Useful for testing and for callers
	 *   that need the context store reset in place rather than migrated to a new ID.
	 *
	 * @example
	 * // Normal hot-reload (new instanceID each time)
	 * await api.slothlet.reload();
	 *
	 * @example
	 * // Reload while resetting the context store in place (same instanceID)
	 * await api.slothlet.reload({ instance: "keep" });
	 */
	async reload(options = {}) {
		const given = options == null ? {} : options;
		assertOptionKeys(given, "slothlet.reload");
		const { instance = "new" } = given;
		if (instance !== "keep" && instance !== "new") {
			throw new SlothletError("INVALID_ARGUMENT", {
				argument: "options.instance",
				expected: '"keep" | "new"',
				received: typeof instance === "string" ? instance : typeof instance
			});
		}
		const keepInstanceID = instance === "keep";

		// One full reload at a time: a reload asked for while another builds starts once that one has finished. One asked
		// for by the build itself (a startup routine's) could never start, so it is refused.
		while (this.#reloadWindow !== null) {
			if (reloadBuildStorage.getStore() === this.#reloadWindow.mark) {
				throw new SlothletError("RELOAD_IN_PROGRESS", { operation: ["slothlet", "reload"] });
			}
			await this.#reloadWindow.settled;
		}

		// Allow reload from shutdown state as long as config was previously loaded.
		// Reject only if the instance was never loaded at all. A loaded config always carries `dir` —
		// a path, or null for an instance with no base directory (#471) — so `undefined` means "never
		// loaded".
		if (this.config?.base === undefined) {
			throw new SlothletError("INSTANCE_NOT_LOADED", { operation: ["slothlet", "reload"] });
		}

		// A closed api root keeps the members it holds, as a closed object does, so it cannot take the ones a rebuild makes.
		this._assertRootOpen(["slothlet", "reload"]);

		// A normal reload rotates to a fresh random ID, claimed before anything else changes: when no ID can be claimed,
		// the reload fails with the instance still on the ID and scope it holds, and still working.
		const oldInstanceID = this.instanceID;
		// Every reload's ID is the first ID plus one fresh `_reload_<time>_<random>` part, never the previous ID plus
		// another: an ID that grew on each reload would soon be too long for the folders named after it.
		const nextScope = keepInstanceID ? null : this.#claimFreshScope(`${splitText(`${oldInstanceID}`, "_reload_")[0]}_reload`);
		// Until the new copy is built and swapped in, every call is answered by the copy the instance has, with its
		// components (permission rules and mode, hooks, metadata, ownership), config and api tree: the build works on a
		// set of its own (see openReloadWindow). A host with no AsyncLocalStorage cannot keep the two apart: there the
		// build replaces the instance's own, and what it had is kept to put back if the reload fails.
		const window = reloadBuildStorage === null ? null : this.#openReloadWindow();
		const kept = window === null ? this.#keepForFailedReload() : null;
		this.#pendingScope = nextScope;
		try {
			// The build is framework work, run as the host even when a module's call asked for the reload (as restart()'s is,
			// #903): the module's call belongs to the copy being replaced.
			if (window === null) {
				// The build writes the instance's own handlers as it goes: the token runs recorded is set aside first, so
				// those writes keep nothing half built for them, and takes the set from before the build once it is done.
				const token = this.#copy;
				this.#copy = null;
				let built;
				try {
					built = await this._runAsHost(() => this.#reloadOnto(nextScope, oldInstanceID, null));
				} catch (error) {
					this.#copy ??= token;
					throw error;
				}
				this.#keepCopyForRuns(kept, token);
				return built;
			}
			return await reloadBuildStorage.run(window.mark, () => this._runAsHost(() => this.#reloadOnto(nextScope, oldInstanceID, window)));
		} catch (error) {
			this.#pendingScope = null;
			if (window !== null) this.#closeReloadWindow(window, false);
			this.#restoreFailedReload(kept);
			// The fresh scope was claimed but never taken: let the ID go again.
			if (nextScope !== null && this.#importScope !== nextScope) nextScope.release();
			if (nextScope !== null) this.#settleFailedReload(oldInstanceID);
			if (window !== null) await this.#retireReplacedScope(window);
			throw error;
		} finally {
			this.#pendingScope = null;
			if (window !== null) {
				// A reload that ended any other way (it cannot, but nothing is left half-split) answers from the copy it had.
				this.#closeReloadWindow(window, false);
				this.#reloadWindow = null;
				window.finish();
			}
		}
	}

	/**
	 * After a reload with no window (a host with no AsyncLocalStorage, where the build replaced the instance's own set),
	 * the runs that recorded the instance's copy token keep the set the instance had before the reload: the token takes
	 * it, and the fields answer through {@link Slothlet#readField} until no such token is left.
	 * @param {object} kept - What {@link Slothlet#keepForFailedReload} took before the build.
	 * @param {object|null} old - The token runs recorded before the build, if any.
	 * @returns {void}
	 * @private
	 */
	#keepCopyForRuns(kept, old) {
		if (old === null) return;
		// No run reads through the token any more: there is nothing to keep it for.
		if (!old.users) return;
		const values = { __proto__: null, ...kept.components };
		for (let ofIndex = 0; ofIndex < RELOAD_COPY_FIELDS.length; ofIndex++)
			values[RELOAD_COPY_FIELDS[ofIndex]] = kept[RELOAD_COPY_FIELDS[ofIndex]];
		old.values = values;
		this.#copy = null;
		this.#shareHandlers(values.handlers);
		this.#ownReplacedHandlers(values.handlers);
		this.#holdCopy(old);
	}

	/**
	 * Wait for a full reload under way to settle, unless the reload's own build is the caller.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #reloadSettled() {
		while (this.#reloadWindow !== null && reloadBuildStorage.getStore() !== this.#reloadWindow.mark) {
			await this.#reloadWindow.settled;
		}
	}

	/**
	 * Start a full reload's window: from now until {@link Slothlet#closeReloadWindow}, the instance's component namespaces
	 * and {@link RELOAD_COPY_FIELDS} answer the reload's build (code running in its {@link reloadBuildStorage} flow) from
	 * a set of its own, and everyone else as {@link Slothlet#readField} says. The build's set starts as a copy of the
	 * current one (each namespace a shallow copy), which load() then replaces piece by piece, as it replaced the
	 * instance's own before.
	 * @returns {object} The window.
	 * @private
	 */
	#openReloadWindow() {
		let finish;
		const settled = new Promise((resolve) => {
			finish = resolve;
		});
		this.#installCopyFields();
		const window = { mark: {}, next: this.#copyOfFields(this.#fields), nextCopy: null, settled, finish, closed: false };
		this.#reloadWindow = window;
		return window;
	}

	/**
	 * End a full reload's window. On a swap (`swap`, the reload succeeded) the instance's set becomes the build's, all at
	 * once: the component namespace objects stay the instance's own and take the build's components. A run opened before
	 * the swap keeps the copy it started with: when one may still hold the instance's copy token, the token takes the set
	 * the instance had, and the fields keep answering through {@link Slothlet#readField} until no such token is left.
	 * Otherwise the fields become plain fields again.
	 * @param {object} window - The window {@link Slothlet#openReloadWindow} opened.
	 * @param {boolean} swap - Whether the new copy takes over.
	 * @returns {void}
	 * @private
	 */
	#closeReloadWindow(window, swap) {
		if (window.closed) return;
		window.closed = true;
		if (swap) {
			this.#swapCopy(window.next, window.nextCopy);
			this.#keepReplacedScope(window);
		}
		this.#settleCopyFields();
	}

	/**
	 * At a reload's swap: every copy kept for runs that was loaded under the ID the reload left keeps that ID's import
	 * scope, so a lazy node of it that loads later loads as that copy (see {@link Slothlet#loadID}). The scope is
	 * retired when the last of those copies is torn down (see {@link Slothlet#releaseCopy}), instead of at the swap.
	 * @param {object} window - The reload's window.
	 * @returns {void}
	 * @private
	 */
	#keepReplacedScope(window) {
		const replaced = window.replaced;
		if (!replaced) return;
		let users = 0;
		for (let heldIndex = 0, held = setToArray(this.#held); heldIndex < held.length; heldIndex++) {
			const holder = held[heldIndex];
			if (holder.ns !== undefined || holder.values === null || holder.loadID !== undefined) continue;
			holder.loadID = replaced.instanceID;
			holder.replaced = replaced;
			users++;
		}
		if (users === 0) return;
		replaced.users = users;
		window.replaced = null;
		if (replaced.scope) MapMethods.set(this.#keptScopes, replaced.scope.instanceID, replaced);
	}

	/**
	 * Run a lazy node's load (which runs apart from the flow that asked for it) under the ID the asking code's copy loads
	 * under (see {@link Slothlet#loadID}).
	 * @param {Function} load - The load.
	 * @returns {*} What it returns.
	 * @package
	 */
	loadAsCaller(load) {
		const id = this.#heldCopies === 0 ? this.instanceID : this.loadID;
		if (id === this.instanceID || loadAsStorage === null) return load();
		return loadAsStorage.run(id, load);
	}

	/**
	 * Retire the import scope a kept copy held, once the last such copy is torn down (see
	 * {@link Slothlet#keepReplacedScope}).
	 * @param {object} replaced - What the reload left (see {@link Slothlet#switchToPendingScope}).
	 * @returns {void}
	 * @private
	 */
	#retireKeptScope(replaced) {
		if (replaced.scope && MapMethods.get(this.#keptScopes, replaced.scope.instanceID) !== replaced) return;
		if (replaced.scope) MapMethods.delete(this.#keptScopes, replaced.scope.instanceID);
		// Nothing awaits it: what it removes from disk is stale either way, and a failure there is not the caller's.
		PromiseMethods.catch(this.#retireScope(replaced), () => {});
	}

	/**
	 * The instance ID a lazy node that loads now loads under: the ID a kept copy was loaded under, for code running in a
	 * run that keeps a copy a reload swapped out (see {@link Slothlet#keepReplacedScope}); the instance's own otherwise.
	 * @type {string}
	 * @package
	 */
	get loadID() {
		if (this.#heldCopies !== 0) {
			const carried = loadAsStorage?.getStore();
			if (carried !== undefined && MapMethods.has(this.#keptScopes, carried)) return carried;
			const mark = reloadBuildStorage?.getStore();
			if (mark === undefined || mark !== this.#reloadWindow?.mark) {
				const id = this.#runRecord()?.from.loadID;
				if (id !== undefined && MapMethods.has(this.#keptScopes, id)) return id;
			}
		}
		return this.instanceID;
	}

	/**
	 * Swap a new set in for the one the instance has (see {@link Slothlet#closeReloadWindow}). The instance's copy token,
	 * when it handed one out, keeps the set the instance had, for the runs that recorded it.
	 * @param {object} next - The new set, one value per field.
	 * @param {object|null} nextCopy - The token the build handed out for the new set, if any.
	 * @returns {void}
	 * @private
	 */
	#swapCopy(next, nextCopy) {
		const fields = this.#fields;
		// A token no run reads through any more keeps nothing.
		const old = this.#copy !== null && this.#copy.users ? this.#copy : null;
		if (old !== null) {
			old.values = this.#copyOfFields(fields);
			// A handler the new copy carries over unchanged is still the instance's: the kept copy holds it as a sharer.
			this.#shareHandlers(old.values.handlers);
			this.#holdCopy(old);
		}
		this.#copy = nextCopy;
		const swappedOut = old?.values?.handlers;
		for (let ofIndex = 0, ofList = this.#copyFieldNames(); ofIndex < ofList.length; ofIndex++) {
			const field = ofList[ofIndex];
			if (ArrayMethods.includes(this.componentCategories, field)) {
				const value = fields[field];
				const taken = next[field];
				for (let keyIndex = 0, keys = Objects.keys(value); keyIndex < keys.length; keyIndex++) {
					if (!Objects.hasOwn(taken, keys[keyIndex])) delete value[keys[keyIndex]];
				}
				Objects.assign(value, taken);
			} else {
				fields[field] = next[field];
			}
		}
		if (swappedOut !== undefined) this.#ownReplacedHandlers(swappedOut);
	}

	/**
	 * The fields a copy of the instance is made of: its component namespaces and {@link RELOAD_COPY_FIELDS}.
	 * @returns {string[]} The field names.
	 * @private
	 */
	#copyFieldNames() {
		return concatLists(this.componentCategories, RELOAD_COPY_FIELDS);
	}

	/**
	 * A copy of a set of fields, each component namespace a shallow copy of its own, so later changes to the namespace
	 * objects leave it as it is.
	 * @param {object} fields - The set, one value per field.
	 * @returns {object} The copy.
	 * @private
	 */
	#copyOfFields(fields) {
		const copy = { __proto__: null };
		for (let ofIndex = 0, ofList = this.#copyFieldNames(); ofIndex < ofList.length; ofIndex++) {
			const field = ofList[ofIndex];
			copy[field] = ArrayMethods.includes(this.componentCategories, field) ? { ...fields[field] } : fields[field];
		}
		return copy;
	}

	/**
	 * Make the copy fields accessors that read through {@link Slothlet#readField}, holding the instance's own values in
	 * {@link Slothlet#fields}. Done only while a reload builds or a run keeps a copy the instance no longer has; otherwise
	 * they are plain fields, read at no extra cost.
	 * @returns {void}
	 * @private
	 */
	#installCopyFields() {
		if (this.#fields !== null) return;
		const fields = { __proto__: null };
		for (let ofIndex = 0, ofList = this.#copyFieldNames(); ofIndex < ofList.length; ofIndex++) {
			const field = ofList[ofIndex];
			fields[field] = this[field];
			Objects.defineProperty(this, field, {
				__proto__: null,
				configurable: true,
				enumerable: true,
				get: () => this.#readField(field),
				set: (value) => {
					this.#writeField(field, value);
				}
			});
		}
		this.#fields = fields;
		countReadThrough(1);
	}

	/**
	 * Make the copy fields plain fields again once nothing needs them read through {@link Slothlet#readField}: no reload
	 * window open and no run keeping a copy the instance no longer has.
	 * @returns {void}
	 * @private
	 */
	#settleCopyFields() {
		const fields = this.#fields;
		if (fields === null || this.#heldCopies !== 0) return;
		if (this.#reloadWindow !== null && !this.#reloadWindow.closed) return;
		this.#fields = null;
		countReadThrough(-1);
		for (let ofIndex = 0, ofList = this.#copyFieldNames(); ofIndex < ofList.length; ofIndex++) {
			const field = ofList[ofIndex];
			Objects.defineProperty(this, field, { __proto__: null, configurable: true, enumerable: true, writable: true, value: fields[field] });
		}
	}

	/**
	 * Read one of the copy fields while they are accessors. The value comes from, in order:
	 * 1. the reload's build set, when the reading code runs in the build of a reload under way; the instance's own set,
	 *    when it runs in instance work (a restart's teardown and rebuild);
	 * 2. for the reading code's `run()` / `scope()` (its calls, and work it left behind, which holds its store): the
	 *    run's own handlers namespace once it holds a fork (for `handlers`), else the copy the run recorded when it
	 *    started, once the instance no longer has that copy;
	 * 3. the instance's own set.
	 * @param {string} field - The field.
	 * @returns {*} The value.
	 * @private
	 */
	#readField(field) {
		const mark = reloadBuildStorage?.getStore();
		if (mark !== undefined) {
			if (mark === this.#instanceWork) return this.#fields[field];
			const window = this.#reloadWindow;
			if (window !== null && !window.closed && mark === window.mark) return window.next[field];
		}
		if (this.#heldCopies !== 0) {
			const record = this.#runRecord();
			if (record !== null) {
				if (record.ns !== null && field === "handlers") return record.ns;
				const values = record.from.values;
				if (values !== null) return values[field];
			}
		}
		return this.#fields[field];
	}

	/**
	 * Write one of the copy fields while they are accessors: into the reload's build set from its build, else into the
	 * instance's own set.
	 * @param {string} field - The field.
	 * @param {*} value - The value.
	 * @returns {void}
	 * @private
	 */
	#writeField(field, value) {
		const window = this.#reloadWindow;
		if (window !== null && !window.closed && reloadBuildStorage?.getStore() === window.mark) window.next[field] = value;
		else this.#fields[field] = value;
	}

	/**
	 * The copy record of the running code's `run()` / `scope()`, if it runs in one.
	 * @returns {object|null} The record, or null when the code runs in no run.
	 * @private
	 */
	#runRecord() {
		// Telling the running store apart can read the instance's fields itself: those reads answer from its own set.
		if (this.#resolvingCopy) return null;
		this.#resolvingCopy = true;
		try {
			const contextManager = this.contextManager;
			let record = contextManager?.tryGetContext?.(this.instanceID)?.[RUN_COPY];
			if (record === undefined || record === null) {
				// A run opened under an ID the instance has since left (a restart starts a new one) still runs this
				// instance's code: its store, when active, is found by the instance object it records.
				const active = contextManager?.tryGetContext?.();
				record = active?.slothlet === this ? (active[RUN_COPY] ?? null) : null;
			}
			// A run whose copy is torn down keeps none: what still runs in its store (code reached through the runtime
			// `context` export) answers as the instance.
			return record === null || record.torn ? null : record;
		} finally {
			this.#resolvingCopy = false;
		}
	}

	/**
	 * Count a copy held apart from what the instance has (a kept token, or a run's record holding a fork) until it is
	 * collected, and make the copy fields read through {@link Slothlet#readField} meanwhile.
	 * @param {object} holder - The token or record.
	 * @returns {void}
	 * @private
	 */
	#holdCopy(holder) {
		this.#installCopyFields();
		if (SetMethods.has(this.#held, holder)) return;
		SetMethods.add(this.#held, holder);
		this.#heldCopies++;
		countHeldCopy(1);
	}

	/**
	 * Let go of a copy {@link Slothlet#holdCopy} held, once no run reads it any more: it leaves the sets of the handlers
	 * it shared, a kept token lets go of the import scope of the ID it was loaded under when it is the last to use it,
	 * and the copy fields become plain fields again once nothing else is held.
	 * @param {object} holder - The token or record.
	 * @returns {void}
	 * @private
	 */
	#releaseCopy(holder) {
		if (!SetMethods.delete(this.#held, holder)) return;
		this.#heldCopies--;
		countHeldCopy(-1);
		const ns = holder.ns !== undefined ? holder.ns : holder.values?.handlers;
		if (ns !== null && ns !== undefined) this.#unshareHandlers(ns);
		const replaced = holder.replaced;
		if (replaced !== undefined && replaced !== null) {
			holder.replaced = null;
			if (--replaced.users === 0) this.#retireKeptScope(replaced);
		}
		this.#settleCopyFields();
	}

	/**
	 * [RUN_OPENED] - Note a new run record, so `shutdown()` can tear down what it holds (see `copyForRun` in
	 * `helpers/flow-stores`).
	 * @param {object} record - The record.
	 * @returns {void}
	 * @internal
	 */
	[RUN_OPENED](record) {
		SetMethods.add(this.#runs, record);
	}

	/**
	 * [RUN_DONE] - A run's work is done (see `releaseRunWork` in `helpers/flow-stores`): its copy is torn down once the
	 * instance is idle, never in the middle of the work that finished it.
	 * @param {object} record - The record.
	 * @returns {void}
	 * @internal
	 */
	[RUN_DONE](record) {
		SetMethods.delete(this.#runs, record);
		listPush(this.#retiring, record);
		this.#teardownWhenIdle();
	}

	/**
	 * Tear down the copies of the runs whose work is done (see {@link Slothlet#retiring}) on a later macrotask, in one
	 * batch: after the work that finished them, and every microtask it queued, has run.
	 * @returns {void}
	 * @private
	 */
	#teardownWhenIdle() {
		if (this.#teardownScheduled) return;
		this.#teardownScheduled = true;
		whenIdle(() => {
			this.#teardownScheduled = false;
			this.#teardownRetiring();
		});
	}

	/**
	 * Tear down the copies of every run waiting in {@link Slothlet#retiring}.
	 * @returns {void}
	 * @private
	 */
	#teardownRetiring() {
		const retiring = this.#retiring;
		this.#retiring = [];
		// A run that took on new work since (its last piece of work began more) is live again, and stays.
		for (let index = 0; index < retiring.length; index++) if (retiring[index].done) this.#teardownRun(retiring[index]);
	}

	/**
	 * Tear down a done run's copy: its forked handlers go, and the copy it read through to is let go when it was the last
	 * run to read it. The record then reads through to nothing, so code still running in its store (reached through the
	 * runtime `context` export) answers from the instance.
	 * @param {object} record - The record.
	 * @returns {void}
	 * @private
	 */
	#teardownRun(record) {
		if (record.torn) return;
		record.torn = true;
		this.#releaseCopy(record);
		record.ns = null;
		record.parent = null;
		const token = record.from;
		record.from = TORN_DOWN;
		if (--token.users === 0 && SetMethods.has(this.#held, token)) {
			this.#releaseCopy(token);
			token.values = null;
		}
	}

	/**
	 * At `shutdown()`: end every run still holding work and tear down every copy at once (the stop gap for work that
	 * never finishes, such as a listener left on an emitter), then let go of the import scopes kept copies held.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #teardownAllRuns() {
		for (let index = 0, runs = setToArray(this.#runs); index < runs.length; index++) endRun(runs[index]);
		this.#teardownRetiring();
		for (let index = 0, held = setToArray(this.#held); index < held.length; index++) this.#releaseCopy(held[index]);
		if (this.#copy !== null) this.#copy = null;
		const kept = [];
		for (const entry of mapEntries(this.#keptScopes)) listPush(kept, entry[1]);
		MapMethods.clear(this.#keptScopes);
		for (let index = 0; index < kept.length; index++) await this.#retireScope(kept[index]);
	}

	/**
	 * Remove a copy's handlers namespace from the sharer sets of the forkable handlers in it (see
	 * {@link Slothlet#shareHandlers}).
	 * @param {object} ns - The namespace.
	 * @returns {void}
	 * @private
	 */
	#unshareHandlers(ns) {
		for (let ofIndex = 0; ofIndex < FORKABLE_HANDLERS.length; ofIndex++) {
			const handler = ns[FORKABLE_HANDLERS[ofIndex]];
			if (handler === null || typeof handler !== "object") continue;
			const sharers = WeakMapMethods.get(this.#sharers, handler);
			if (sharers === undefined) continue;
			SetMethods.delete(sharers, ns);
			if (SetMethods.size(sharers) === 0) WeakMapMethods.delete(this.#sharers, handler);
		}
	}

	/**
	 * After a restart rebuilt the instance: in every copy held apart from it, everything but the forkable handlers
	 * becomes the rebuilt instance's (the api tree is still shared, and what answers for it goes with it). A kept
	 * metadata handler reads the system facts of the rebuilt tree's nodes from the instance's.
	 * @returns {void}
	 * @private
	 */
	#copiesFollowTree() {
		const own = this.#fields ?? this;
		for (let heldIndex = 0, held = setToArray(this.#held); heldIndex < held.length; heldIndex++) {
			const holder = held[heldIndex];
			if (holder.ns !== undefined) {
				if (holder.ns !== null) this.#followTree(holder.ns, own.handlers);
				continue;
			}
			const values = holder.values;
			if (values === null) continue;
			for (let ofIndex = 0, ofList = this.#copyFieldNames(); ofIndex < ofList.length; ofIndex++) {
				const field = ofList[ofIndex];
				if (field === "handlers") this.#followTree(values.handlers, own.handlers);
				else values[field] = ArrayMethods.includes(this.componentCategories, field) ? { ...own[field] } : own[field];
			}
		}
	}

	/**
	 * Point a copy's handlers namespace at the instance's handlers, except the forkable ones the copy keeps.
	 * @param {object} ns - The copy's handlers namespace.
	 * @param {object} handlers - The instance's.
	 * @returns {void}
	 * @private
	 */
	#followTree(ns, handlers) {
		for (let ofIndex = 0, keys = Objects.keys(ns); ofIndex < keys.length; ofIndex++) {
			if (!ArrayMethods.includes(FORKABLE_HANDLERS, keys[ofIndex]) && !Objects.hasOwn(handlers, keys[ofIndex])) delete ns[keys[ofIndex]];
		}
		for (let ofIndex = 0, keys = Objects.keys(handlers); ofIndex < keys.length; ofIndex++) {
			const key = keys[ofIndex];
			if (!ArrayMethods.includes(FORKABLE_HANDLERS, key) || ns[key] === undefined) ns[key] = handlers[key];
		}
		const metadata = ns.metadata;
		if (metadata !== handlers.metadata && typeof metadata?.readThrough === "function") metadata.readThrough(handlers.metadata);
	}

	/**
	 * Before the instance first changes after runs recorded its copy token, make the token keep what the instance has
	 * now: those runs started on it, and the change must not reach them.
	 * @returns {void}
	 * @private
	 */
	#keepCurrentCopy() {
		const token = this.#copy;
		if (token === null) return;
		// No run reads through the token any more: there is nothing to keep it for.
		if (!token.users) {
			this.#copy = null;
			return;
		}
		this.#installCopyFields();
		token.values = this.#copyOfFields(this.#fields);
		this.#shareHandlers(token.values.handlers);
		this.#copy = null;
		this.#holdCopy(token);
	}

	/**
	 * Record a handlers namespace as holding each forkable handler in it, so the handler's owner forks it for the
	 * namespace before writing (see {@link Slothlet#keepSharers}).
	 * @param {object} ns - The namespace (a kept token's or a run's).
	 * @returns {void}
	 * @private
	 */
	#shareHandlers(ns) {
		for (let ofIndex = 0; ofIndex < FORKABLE_HANDLERS.length; ofIndex++) {
			const handler = ns[FORKABLE_HANDLERS[ofIndex]];
			if (handler === null || typeof handler !== "object") continue;
			let sharers = WeakMapMethods.get(this.#sharers, handler);
			if (sharers === undefined) {
				sharers = new Set();
				WeakMapMethods.set(this.#sharers, handler, sharers);
			}
			SetMethods.add(sharers, ns);
		}
	}

	/**
	 * Give every copy that holds a forkable handler without owning it a fork of its own, before the handler is written.
	 * Each fork is a copy of the handler as it is now, which is what each of those copies started with.
	 * @param {object} handler - The handler about to be written.
	 * @param {string} slot - Its property name in the handlers namespace.
	 * @returns {void}
	 * @private
	 */
	#keepSharers(handler, slot) {
		const sharers = WeakMapMethods.get(this.#sharers, handler);
		if (sharers === undefined) return;
		WeakMapMethods.delete(this.#sharers, handler);
		for (let sharerIndex = 0, list = setToArray(sharers); sharerIndex < list.length; sharerIndex++) {
			const ns = list[sharerIndex];
			if (ns[slot] !== handler) continue;
			const fork = handler[FORK]();
			ns[slot] = fork;
			WeakMapMethods.set(this.#owners, fork, ns);
		}
	}

	/**
	 * Which object a write to a forkable handler goes to (see `writeTarget` in `helpers/flow-stores`).
	 *
	 * - Code in a `run()` / `scope()` writes the run's own fork. The run's first write to the handler makes the fork, a
	 *   copy of the handler as the run sees it (its parent's, or the copy it started on); its handlers namespace becomes
	 *   one of its own then. Nested runs that hold the run's fork get forks of their own before it changes.
	 * - Code outside any run writes the instance's own handler: first, the token runs recorded keeps what the instance
	 *   has (see {@link Slothlet#keepCurrentCopy}), and every copy that holds the handler gets a fork of its own.
	 *
	 * A write reaching another copy of the same handler (an unsubscribe function handed out by the instance's handler,
	 * called in a run; one a run handed out, called outside it) goes where a write from that code goes. A handler that
	 * is no copy's (a reload's build, one being constructed) is written as it is.
	 *
	 * A run() costs nothing here until something writes; a fork costs a copy of the one handler written.
	 * @param {object} handler - The handler about to be written.
	 * @param {boolean} instanceOnly - True for the instance's teardown of its own handler, which never forks for a run.
	 * @returns {object} The handler to write.
	 * @internal
	 */
	[WRITE_TARGET](handler, instanceOnly) {
		if (this.#copy === null && this.#fields === null) return handler;
		const slot = handler.constructor.slothletProperty;
		const mark = reloadBuildStorage?.getStore();
		const window = this.#reloadWindow;
		if (mark !== undefined && window !== null && !window.closed && mark === window.mark) return handler;
		const own = (this.#fields ?? this).handlers;
		const known = own?.[slot] === handler || WeakMapMethods.has(this.#owners, handler);
		if (!known) return handler;
		const record = instanceOnly || (mark !== undefined && mark === this.#instanceWork) ? null : this.#runRecord();
		if (record === null) {
			if (instanceOnly && own[slot] !== handler) return handler;
			const target = own[slot];
			this.#keepCurrentCopy();
			this.#keepSharers(target, slot);
			return target;
		}
		const view = record.ns ?? record.from.values?.handlers ?? own;
		const current = view[slot];
		if (record.ns !== null && WeakMapMethods.get(this.#owners, current) === record.ns) {
			this.#keepSharers(current, slot);
			return current;
		}
		const fork = current[FORK]();
		if (record.ns === null) {
			record.ns = { ...view };
			this.#shareHandlers(record.ns);
			this.#holdCopy(record);
		}
		record.ns[slot] = fork;
		WeakMapMethods.set(this.#owners, fork, record.ns);
		return fork;
	}

	/**
	 * Mark the forkable handlers a kept copy holds that the instance no longer has as that copy's: a write reaching one
	 * of them (through something it handed out) goes where the writing code's writes go (see
	 * {@link Slothlet#[WRITE_TARGET]}).
	 * @param {object} ns - The kept copy's handlers namespace.
	 * @returns {void}
	 * @private
	 */
	#ownReplacedHandlers(ns) {
		const own = (this.#fields ?? this).handlers;
		for (let ofIndex = 0; ofIndex < FORKABLE_HANDLERS.length; ofIndex++) {
			const handler = ns[FORKABLE_HANDLERS[ofIndex]];
			if (handler !== null && typeof handler === "object" && own?.[FORKABLE_HANDLERS[ofIndex]] !== handler) {
				if (!WeakMapMethods.has(this.#owners, handler)) WeakMapMethods.set(this.#owners, handler, ns);
			}
		}
	}

	/**
	 * One of the copy fields as the instance has it, whichever copy the calling code answers from.
	 * @param {string} field - The field.
	 * @returns {*} The value.
	 * @internal
	 */
	[INSTANCE_FIELD](field) {
		return (this.#fields ?? this)[field];
	}

	/**
	 * The copy record of a run opened in a run that holds a fork (see `copyForRun` in `helpers/flow-stores`): it starts
	 * with a copy of the parent's handlers namespace, so neither run's later writes reach the other.
	 * @param {object} parent - The parent run's record.
	 * @returns {object} The new run's record.
	 * @internal
	 */
	[INHERIT_COPY](parent) {
		const record = newRecord(parent.from, parent, { ...parent.ns }, this);
		this.#shareHandlers(record.ns);
		this.#holdCopy(record);
		return record;
	}

	/**
	 * The token of the copy the instance has now, which the copy record each `run()` / `scope()` gets when it starts
	 * reads through to (see `RUN_COPY` and `copyForRun` in `helpers/flow-stores`). Made the first time a run asks for it after a swap, so a reload with no run open swaps
	 * nothing out for runs to keep. A run opened by the build of a reload under way records the build's copy.
	 * @returns {{values: object|null}} The token.
	 * @internal
	 */
	[CURRENT_COPY]() {
		const window = this.#reloadWindow;
		if (window !== null && !window.closed && reloadBuildStorage.getStore() === window.mark) {
			window.nextCopy ??= { values: null };
			return window.nextCopy;
		}
		this.#copy ??= { values: null };
		return this.#copy;
	}

	/**
	 * Switch the instance to the fresh scope a normal reload claimed, once the new ID's context is set up: the instance's
	 * code runs there from now on, and what was kept under the ID it leaves goes.
	 * @param {{instanceID: string, require: Function, release: Function}} scope - The claimed scope.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #switchToPendingScope(scope) {
		const oldInstanceID = this.instanceID;
		const oldScope = this.#importScope;
		this.#pendingScope = null;
		const window = this.#reloadWindow;
		if (window !== null) {
			// The copy the instance has keeps answering calls until the swap: what slothlet keeps about its files (its
			// import graph, its CommonJS copies, its share of the global patches, its TS transform cache) stays until then.
			window.replaced = {
				instanceID: oldInstanceID,
				scope: oldScope,
				typescriptCacheDirs: this._typescriptCacheDirs?.size ? setToArray(this._typescriptCacheDirs) : []
			};
			if (this._typescriptCacheDirs?.size) SetMethods.clear(this._typescriptCacheDirs);
			this.#importScope = null;
			this.#adoptImportScope(scope);
			return;
		}
		// The previous instanceID's private CommonJS helper copies (#518, #534) can no longer be served.
		forgetInstanceScripts(oldInstanceID);
		this.#adoptImportScope(scope);
		// The global patches are held under the new ID once load() goes on; the old ID's share goes now, or the patches
		// could never be released. Nothing is unpatched here: the new ID takes the share straight back.
		SetMethods.delete(boundaryPatchHolders, oldInstanceID);
		SetMethods.delete(promisePatchHolders, oldInstanceID);
		SetMethods.delete(asyncCallbackHolders, oldInstanceID);

		// The TS transform cache dirs from the previous instanceID are stale: the startup sweep only removes dirs whose
		// owning PID is dead (same-PID dirs from prior rotations are kept), so without this they'd accumulate one dir per
		// reload until shutdown — an unbounded leak in long-lived dev processes that reload frequently.
		if (isNode && this._typescriptCacheDirs?.size) {
			await promiseAllSettled(mapList(setToArray(this._typescriptCacheDirs), (dir) => fsp.rm(dir, { recursive: true, force: true })));
			SetMethods.clear(this._typescriptCacheDirs);
		}
	}

	/**
	 * Let go of what slothlet kept about the files of the ID a reload switched the instance away from (see
	 * {@link Slothlet#switchToPendingScope}), once that copy no longer answers calls: when the reload has swapped its new
	 * copy in, or has failed after switching (the instance stays on the new ID, answering from the copy it had).
	 * @param {object} window - The reload's window.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #retireReplacedScope(window) {
		const replaced = window.replaced;
		if (!replaced) return;
		window.replaced = null;
		await this.#retireScope(replaced);
	}

	/**
	 * Let go of what slothlet kept about the files of an ID the instance left (see {@link Slothlet#retireReplacedScope}).
	 * @param {{instanceID: string, scope: object|null, typescriptCacheDirs: string[]}} replaced - What was left.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #retireScope(replaced) {
		const { instanceID } = replaced;
		// The previous instanceID's private CommonJS helper copies (#518, #534) can no longer be served.
		forgetInstanceScripts(instanceID);
		if (replaced.scope) {
			setInstanceSelfKind(replaced.scope.instanceID, null);
			replaced.scope.release();
		}
		// The global patches are held under the new ID; the old ID's share goes, or the patches could never be released.
		// Nothing is unpatched here: the new ID holds its share.
		SetMethods.delete(boundaryPatchHolders, instanceID);
		SetMethods.delete(promisePatchHolders, instanceID);
		SetMethods.delete(asyncCallbackHolders, instanceID);
		// The TS transform cache dirs of the previous instanceID are stale (see switchToPendingScope).
		if (isNode && replaced.typescriptCacheDirs.length) {
			await promiseAllSettled(mapList(replaced.typescriptCacheDirs, (dir) => fsp.rm(dir, { recursive: true, force: true })));
		}
	}

	/**
	 * What the instance answers calls with, taken before a reload: load() replaces the components, the config and the
	 * api tree before it knows whether the new copy loads.
	 * @returns {object} The kept state, for {@link Slothlet#restoreFailedReload}.
	 * @private
	 */
	#keepForFailedReload() {
		const components = {};
		for (let ofIndex = 0, ofList = this.componentCategories; ofIndex < ofList.length; ofIndex++) {
			const category = ofList[ofIndex];
			components[category] = { ...this[category] };
		}
		return {
			components,
			config: this.config,
			api: this.api,
			debugLogger: this.debugLogger,
			envTarget: this.envTarget,
			reference: this.reference,
			context: this.context,
			isLoaded: this.isLoaded
		};
	}

	/**
	 * Put back what the instance answered calls with before a reload that failed: a failed reload leaves the instance as it
	 * was, answering from the copy it had (docs/RELOAD.md), on whichever ID it is on now.
	 * @param {object} kept - What {@link Slothlet#keepForFailedReload} took.
	 * @returns {void}
	 * @private
	 */
	#restoreFailedReload(kept) {
		if (kept !== null) {
			for (let ofIndex = 0, ofList = this.componentCategories; ofIndex < ofList.length; ofIndex++) {
				const category = ofList[ofIndex];
				const now = this[category];
				for (let keyIndex = 0, keys = Objects.keys(now); keyIndex < keys.length; keyIndex++) {
					if (!Objects.hasOwn(kept.components[category], keys[keyIndex])) delete now[keys[keyIndex]];
				}
				Objects.assign(now, kept.components[category]);
			}
			this.config = kept.config;
			this.api = kept.api;
			this.debugLogger = kept.debugLogger;
			this.envTarget = kept.envTarget;
			this.reference = kept.reference;
			this.context = kept.context;
			this.isLoaded = kept.isLoaded;
		}
		this.#carriedContext = null;
		// The context the instance's code runs in now answers with that copy: a reload that switched IDs set the new ID's
		// context up for the copy it did not finish. A reload that keeps the ID (`instance: "keep"`) drops the ID's context
		// before setting it up again: when that failed, it is set up once more here, as the trusted root load() makes.
		let store = MapMethods.get(this.contextManager.instances, this.instanceID);
		if (store === undefined) {
			store = this.contextManager.initialize(this.instanceID, this.config, this.#clock);
			Objects.defineProperty(store, trustedRootOwn.TRUSTED_ROOT, { __proto__: null, value: true, configurable: true });
		}
		store.self = this.boundApi;
		store.context = this.context || {};
		store.slothlet = this;
	}

	/**
	 * After a normal reload failed: a reload that switched to its new ID (load() switches once that ID's context is set up,
	 * before any module loads) leaves the instance's code running there, so the context it ran in before goes and the
	 * `run()` / `scope()` stores made in it follow it. A reload that failed before the switch left the instance on its ID
	 * and context, and there is nothing to do.
	 * @param {string} oldInstanceID - The instance's ID when the reload started.
	 * @returns {void}
	 * @private
	 */
	#settleFailedReload(oldInstanceID) {
		const current = this.instanceID;
		if (current === oldInstanceID) return;
		const instances = this.contextManager.instances;
		for (const ofEntry of mapEntries(instances)) {
			const store = ofEntry[1];
			if (store.parentInstanceID === oldInstanceID) store.parentInstanceID = current;
		}
		reparentFlowStores(this, [oldInstanceID], current);
		if (MapMethods.has(instances, oldInstanceID)) this.contextManager.cleanup(oldInstanceID);
	}

	/**
	 * The body of {@link Slothlet#reload}, run once the reload's fresh scope (if any) is claimed: in the reload's build
	 * flow when the instance has a window open (see {@link Slothlet#openReloadWindow}), where `this` answers with the new
	 * copy's set while every other caller is answered by the set the instance has.
	 * @param {{instanceID: string, require: Function, release: Function}|null} nextScope - The claimed scope a normal
	 *   reload switches to, or null for `instance: "keep"`.
	 * @param {string} oldInstanceID - The instance's ID when the reload started.
	 * @param {object|null} window - The reload's window, or null where the host has no AsyncLocalStorage.
	 * @returns {Promise<Object>} The bound API.
	 * @private
	 */
	async #reloadOnto(nextScope, oldInstanceID, window) {
		const keepInstanceID = nextScope === null;

		// Changes queued through lazy stand-ins, and refusals of those made, belong to the nodes this reload replaces;
		// eager mode's changes go with those nodes too (#653).
		releaseStandInChanges(this);

		// 1. The components the instance has. With a window open they keep answering every call until the swap, so what
		//    the new copy takes from them (history, hooks, metadata, the permission state) is read as late as it can be,
		//    and takes in changes calls made while the reload ran. Without one, load() replaces them on the instance.
		const oldHandlers = { ...this.handlers };
		/* v8 ignore next */
		const oldApiState = oldHandlers.apiManager?.state ?? null;

		// 2. Clear CommonJS module caches to force re-import
		await this._clearModuleCaches();

		// 3. The instanceID load() runs under.
		//    Normal reload: the fresh ID claimed in reload() (busts internal caches; old ID cleaned up below). load() sets
		//    its context up and only then switches the instance to it (#pendingScope).
		//    instance "keep": reuse the current ID so instances.has() is TRUE inside load(),
		//    which triggers the cleanup-then-reinitialise branch of the context store.
		const loadInstanceID = keepInstanceID ? this.instanceID : nextScope.instanceID;

		// Without a window, calls made while the new copy builds reach its components: they take the permission state,
		// hooks, metadata and event-delivery strategy the instance has before any module of the new copy loads (see
		// Slothlet#carryIntoBuild), never a fresh set.
		const carried = window === null ? { history: null } : null;
		if (carried !== null) this.#carryOnLoad = () => this.#carryIntoBuild(oldHandlers, oldApiState, carried);

		// 4. Do a FRESH load() with the new permanent instanceID
		this.#carriedContext = this.context;
		try {
			await this.load(this.config, loadInstanceID);
		} finally {
			this.#carryOnLoad = null;
		}

		// 4b. Restore the user-managed metadata (metadata.global() and metadata.set() values) into the new Metadata
		//     instance, BEFORE replay so that registerUserMetadata() from replay merges over it correctly.
		// savedMetadataState is always truthy (metadata always exports state); metadata handler always present.
		const savedMetadataState = oldHandlers.metadata?.exportUserState?.();
		/* v8 ignore next */
		if (savedMetadataState && this.handlers.metadata) {
			this.handlers.metadata.importUserState(savedMetadataState);
		}

		// 4c. The host's event-delivery strategy (#497) — host configuration, like hooks. Subscriptions themselves are not
		//     carried: modules re-register theirs, and listener ids are stable across that re-registration.
		if (carried === null) {
			const savedEventStrategy = oldHandlers.eventManager?.exportStrategy?.() ?? null;
			if (savedEventStrategy) this.handlers.eventManager.strategy(savedEventStrategy);
		}

		// 5. Reparent any child __run_ context stores that were created before reload.
		//    Their parentInstanceID points to the old base instanceID; updating it lets
		//    context.get() still find them for callers that call reload() inside a .run() scope.
		for (const ofEntry of mapEntries(this.contextManager.instances)) {
			const store = ofEntry[1];
			if (store.parentInstanceID === oldInstanceID) {
				store.parentInstanceID = this.instanceID;
			}
		}
		// The stores of runs that have returned are no longer among the instances, but work they left behind (a timer, a
		// listener, a promise chain) still holds them and runs in them: they move to the new ID too.
		reparentFlowStores(this, [oldInstanceID], this.instanceID);

		// 6. Clean up the old base context store now that the new one is active.
		//    Guard with .has() because shutdown() may have already removed the store.
		if (
			oldInstanceID &&
			oldInstanceID !== this.instanceID &&
			(this.contextManager.instances == null ? undefined : MapMethods.has(this.contextManager.instances, oldInstanceID))
		) {
			this.contextManager.cleanup(oldInstanceID);
		}

		// 7. Replay operation history in chronological order. With a window, that is everything the instance's api manager
		//    recorded, read until nothing new is left, so an add(), remove() or rule change a call made while this reload
		//    ran (which reached that api manager) comes along. Without one, the build carried the history's permission
		//    operations already, and its add() / remove() operations replay here.
		let operationHistory;
		if (carried === null) {
			operationHistory = [];
			/* v8 ignore next */
			const recorded = () => oldApiState?.operationHistory ?? [];
			while (operationHistory.length < recorded().length) {
				const operation = recorded()[operationHistory.length];
				listPush(operationHistory, operation);
				await this.#replayOperation(operation);
			}
		} else {
			operationHistory = carried.history;
			for (let ofIndex = 0, ofList = operationHistory; ofIndex < ofList.length; ofIndex++) {
				const operation = ofList[ofIndex];
				if (operation.type === "add" || operation.type === "remove") await this.#replayOperation(operation);
			}
		}

		// The fresh api manager load() built starts with no history, and the replay above records nothing
		// into it, so the saved history is carried over as it was: without it the next reload would have
		// nothing to replay, and every add() and remove() would be lost from the second reload on.
		/* v8 ignore else */
		if (this.handlers.apiManager?.state) {
			this.handlers.apiManager.state.operationHistory = operationHistory;
			/* v8 ignore next */
			this.handlers.apiManager.state.addHistory = oldApiState?.addHistory ? copyList(oldApiState.addHistory) : [];
		}

		// Runtime `self.X = …` writes are intentionally NOT replayed: a reload
		// rebuilds from disk + operation history, and a runtime write is not part
		// of that history. Module-init writes reappear naturally because the
		// module body re-executes during the rebuild.

		// 8. Hook registrations (hook.on()) carry into the new HookManager, read last so hooks registered while the
		//    reload ran come along.
		if (carried === null) {
			const savedHooks = oldHandlers.hookManager?.exportHooks?.();
			// savedHooks always has entries when exported after hooks are registered; hookManager always present.
			/* v8 ignore next */
			if (savedHooks?.length && this.handlers.hookManager) {
				this.handlers.hookManager.importHooks(savedHooks);
			}
		}

		// 9. The mode the host moved the system to (`control.mode(value)`) holds across the reload, so a system the host
		//    turned on from "disabled" does not fall back to it (#625). The seal goes back on AFTER rule replay (replay
		//    re-adds rules via addRule, which a sealed manager would reject): seal() is a one-way lock, and the fresh
		//    PermissionManager starts unsealed, so without this a reload would silently unseal the control surface.
		const wasSealed = oldHandlers.permissionManager?.isSealed?.() === true;
		const savedMode = oldHandlers.permissionManager?.mode?.() ?? null;
		const permissionManager = this.handlers.permissionManager;
		if (savedMode === "on" && permissionManager?.mode?.() !== "on") permissionManager.enable();
		else if (savedMode === "off" && permissionManager?.mode?.() !== "off") permissionManager.disable();
		if (wasSealed) this.handlers.permissionManager?.seal?.();

		// 10. The swap: from here every call, whoever makes it, is answered by the new copy.
		if (window !== null) {
			this.#closeReloadWindow(window, true);
			await this.#retireReplacedScope(window);
		} else {
			this.handlers.metadata?.readThrough?.(null);
		}

		return this.boundApi;
	}

	/**
	 * Replay one recorded operation onto the new copy's components (see {@link Slothlet#reloadOnto}).
	 * @param {object} operation - The recorded operation.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #replayOperation(operation) {
		if (operation.type === "add") {
			await this.handlers.apiManager.addApiComponent({
				apiPath: operation.apiPath,
				folderPath: operation.folderPath,
				// operation.options carries the ORIGINAL moduleID recorded at add time; addApiComponent
				// reuses it (there is no top-level moduleID param), so a module keeps the same id across a
				// reload — for user-supplied ids and auto-generated `<path>_<hash>` ids alike. That stable
				// id is what lets a scoped remove op below resolve on replay.
				// operation.options is always provided during api.add() replay; {} fallback is dead code.
				/* v8 ignore next */
				options: { ...(operation.options || {}), recordHistory: false },
				versionConfig: operation.versionConfig || null
			});
		} else if (operation.type === "remove") {
			// Route the replayed remove through the full removeApiComponent path so
			// it performs the SAME cleanup a live remove does — api + boundApi tree,
			// apiCacheManager entry, ownership records, metadata, version registration.
			// A bare deletePath would prune only `this.api` and leave boundApi / cache /
			// ownership remnants, so the rebuilt tree would not match a clean
			// build-up-to-this-point. recordHistory:false avoids re-appending the op.
			if (operation.scopedModuleID) {
				// Scoped removal (remove(moduleID, apiPath)): replay the two-argument form so only this
				// module's nodes go. The module's id survives the add replay above, so it resolves; a
				// plain apiPath removal here would over-delete other modules sharing the path.
				await this.handlers.apiManager.removeApiComponent(operation.scopedModuleID, {
					scopedApiPath: operation.apiPath,
					recordHistory: false
				});
			} else {
				await this.handlers.apiManager.removeApiComponent(operation.apiPath, { recordHistory: false });
			}
		} else {
			this.#replayPermissionOperation(operation);
		}
	}

	/**
	 * Replay one recorded permission operation (a rule, an event rule or a principal) onto the new copy's permission
	 * manager (see {@link Slothlet#reloadOnto}).
	 * @param {object} operation - The recorded operation, anything but an `add` / `remove`.
	 * @returns {void}
	 * @private
	 */
	#replayPermissionOperation(operation) {
		if (operation.type === "addPermissionRule") {
			// permissionManager is always re-registered by load() before replay (slothletProperty); the absent-manager arm is unreachable.
			/* v8 ignore else */
			if (this.handlers.permissionManager) {
				// A module's write rule keeps the module layer it was added at (#625).
				this.handlers.permissionManager.addRule(operation.rule, operation.ownerModuleID, operation.ruleId, operation.layer);
			}
		} else if (operation.type === "removePermissionRule") {
			// permissionManager is always re-registered by load() before replay (slothletProperty); the absent-manager arm is unreachable.
			/* v8 ignore else */
			if (this.handlers.permissionManager) {
				this.handlers.permissionManager.removeRule(operation.ruleId, operation.callerModuleID);
			}
		} else if (operation.type === "addEventRule") {
			// Event rules (#407) replay through the same permissionManager; absent-manager arm unreachable.
			/* v8 ignore else */
			if (this.handlers.permissionManager) {
				// An event rule keeps the layer it was added at (#625).
				this.handlers.permissionManager.addEventRule(operation.rule, operation.ownerModuleID, operation.ruleId, operation.layer ?? null);
			}
		} else if (operation.type === "registerPrincipal") {
			// Principals (#459). A host registration replays as-is — host code is not reloaded. A module's
			// recorded resolver is a closure over the module as it was BEFORE the reload, so replaying it
			// would answer from stale module state; the name is reserved for its owner instead (dormant,
			// fail-closed) until the reloaded module registers again.
			/* v8 ignore else */
			if (this.handlers.permissionManager) {
				if (operation.ownerModuleID === null) {
					this.handlers.permissionManager.registerPrincipal(operation.name, operation.definition, null, null);
				} else {
					this.handlers.permissionManager.reservePrincipal(operation.name, operation.ownerModuleID);
				}
			}
		} else if (operation.type === "unregisterPrincipal") {
			/* v8 ignore else */
			if (this.handlers.permissionManager) {
				this.handlers.permissionManager.unregisterPrincipal(operation.name, operation.callerModuleID);
			}
		} else {
			// The op type is necessarily removeEventRule here — the replay records only
			// add/remove/add|removePermissionRule/add|removeEventRule/register|unregisterPrincipal —
			// so this final else is that.
			/* v8 ignore else */
			if (operation.type === "removeEventRule") {
				// permissionManager is always re-registered by load() before replay (slothletProperty); the absent-manager arm is unreachable.
				/* v8 ignore else */
				if (this.handlers.permissionManager) {
					this.handlers.permissionManager.removeEventRule(operation.ruleId, operation.callerModuleID);
				}
			}
		}
	}

	/**
	 * Without a window (a host with no AsyncLocalStorage), the new copy's freshly made components take, before any of its
	 * modules load, the permission state (rules, event rules, principals, mode), hooks, metadata and event-delivery
	 * strategy the instance has, so a call made while the reload runs, which reaches them, is held to the same rules and
	 * hooks as before it. Called from load() once the components exist. The seal goes on at the end of the reload, as the
	 * replayed `add()` history registers rules of its own.
	 * @param {object} oldHandlers - The handlers the instance had.
	 * @param {object|null} oldApiState - Their api manager's state.
	 * @param {{history: Array<object>|null}} carried - Receives the operations carried.
	 * @returns {void}
	 * @private
	 */
	#carryIntoBuild(oldHandlers, oldApiState, carried) {
		/* v8 ignore next */
		carried.history = oldApiState?.operationHistory ? copyList(oldApiState.operationHistory) : [];
		const savedMetadataState = oldHandlers.metadata?.exportUserState?.();
		/* v8 ignore next */
		if (savedMetadataState && this.handlers.metadata) this.handlers.metadata.importUserState(savedMetadataState);
		// The nodes calls run until the reload ends are the copy the instance has, tagged in its handler.
		this.handlers.metadata?.readThrough?.(oldHandlers.metadata ?? null);
		const savedHooks = oldHandlers.hookManager?.exportHooks?.();
		/* v8 ignore next */
		if (savedHooks?.length && this.handlers.hookManager) this.handlers.hookManager.importHooks(savedHooks);
		const savedEventStrategy = oldHandlers.eventManager?.exportStrategy?.() ?? null;
		if (savedEventStrategy) this.handlers.eventManager.strategy(savedEventStrategy);
		for (let ofIndex = 0, ofList = carried.history; ofIndex < ofList.length; ofIndex++) {
			const operation = ofList[ofIndex];
			if (operation.type !== "add" && operation.type !== "remove") this.#replayPermissionOperation(operation);
		}
		const savedMode = oldHandlers.permissionManager?.mode?.() ?? null;
		const permissionManager = this.handlers.permissionManager;
		if (savedMode === "on" && permissionManager?.mode?.() !== "on") permissionManager.enable();
		else if (savedMode === "off" && permissionManager?.mode?.() !== "off") permissionManager.disable();
	}

	/**
	 * Retain an immutable snapshot of the config a `slothlet({...})` call received, for restart() (#504).
	 *
	 * @param {object} [config={}] - The config exactly as the creating call passed it.
	 * @returns {void}
	 * @private
	 *
	 * @example
	 * instance._retainOriginalConfig({ base: "./api", mode: "lazy" });
	 */
	_retainOriginalConfig(config = {}) {
		this._originalConfig = copyTopLevelConfig(config ?? {}, true);
	}

	/**
	 * Clean-slate restart: tear this instance down and build a new one from its ORIGINAL config,
	 * behind the same `api` reference (#504).
	 * @public
	 *
	 * @description
	 * Unlike {@link Slothlet#reload}, nothing runtime survives: no replayed `add()` / `remove()`
	 * history, no runtime hooks, permission rules, event subscriptions, principals, metadata or
	 * lifecycle subscribers, no `self.x = …` assignments, and no module-scope state (every module is
	 * re-imported under a new instance ID). Everything declared in the original config is applied
	 * again, because the new instance is built from it. That includes the permission policy: the new
	 * instance has exactly the original config's rules and is NOT sealed, even if the old one was —
	 * exactly as a fresh `slothlet({...})` call would be. When a `permissions` config is present,
	 * modules cannot call it (a built-in rule denies `slothlet.restart`; the host can allow a trusted
	 * module explicitly); with no `permissions` config the permission system is off and it is reachable.
	 *
	 * Sequence: `restart` lifecycle event (old instance, nothing torn down yet) → the normal teardown
	 * (`mode: "shutdown"` routines, the root `shutdown` hook, then the internal teardown, which emits
	 * `shutdown`) → a fresh load from the original config (emits `init` on the new instance) → held
	 * child references from the old tree are re-pointed at the new tree → `restarted`.
	 *
	 * Events on the old instance reach the old instance's subscribers (config-declared and runtime);
	 * `init` and `restarted` fire on the new instance, where only config-declared (`lifecycle` option)
	 * subscribers exist — runtime subscribers were dropped with the old instance.
	 *
	 * Calls already running when restart() starts finish on the old implementation; restart() does not
	 * wait for them (as with reload(), only in-flight lazy materializations are drained). Concurrent
	 * restart() calls share one restart. A failing teardown step (a throwing shutdown routine or hook)
	 * does not stop the rebuild; its error is re-thrown once the new instance is in place.
	 *
	 * @returns {Promise<Object>} The same bound API reference.
	 * @throws {SlothletError} INSTANCE_NOT_LOADED when the instance was never created via `slothlet()`.
	 *
	 * @example
	 * await api.slothlet.restart();
	 */
	restart() {
		if (this._restartPromise) return this._restartPromise;
		this._restartPromise = PromiseMethods.finally(this._restart(), () => {
			this._restartPromise = null;
		});
		return this._restartPromise;
	}

	/**
	 * Refuse an operation that rebuilds the api root while the root is closed (`Object.preventExtensions`, `seal` or
	 * `freeze` on the api): a closed root keeps the members it holds, so it cannot take the ones a rebuild makes.
	 * @param {string[]} operation - The method refused, as path segments.
	 * @returns {void}
	 * @throws {SlothletError} API_ROOT_CLOSED when the root is closed.
	 * @private
	 *
	 * @example
	 * this._assertRootOpen(["slothlet", "reload"]);
	 */
	_assertRootOpen(operation) {
		if (this.boundApi && !Reflect.isExtensible(this.boundApi)) {
			throw new SlothletError("API_ROOT_CLOSED", { operation });
		}
	}

	/**
	 * restart() body — see {@link Slothlet#restart}.
	 * @returns {Promise<Object>} The same bound API reference.
	 * @private
	 *
	 * @example
	 * await this._restart();
	 */
	async _restart() {
		if (this.#reloadWindow !== null) await this.#reloadSettled();
		if (!this._originalConfig) {
			throw new SlothletError("INSTANCE_NOT_LOADED", { operation: ["slothlet", "restart"] });
		}

		this._assertRootOpen(["slothlet", "restart"]);

		// A run() / scope() open now keeps the copy it started with: the restart replaces the instance's, not the runs'.
		// The teardown and rebuild below are the instance's own work, also when a run's code asked for them: they read
		// and write the instance's own set, never the calling run's copy.
		this.#keepCurrentCopy();
		return reloadBuildStorage === null ? this.#restartOnto() : reloadBuildStorage.run(this.#instanceWork, () => this.#restartOnto());
	}

	/**
	 * restart()'s teardown and rebuild (see {@link Slothlet#_restart}).
	 * @returns {Promise<Object>} The same bound API reference.
	 * @private
	 */
	async #restartOnto() {
		const previousInstanceID = this.instanceID;
		let teardownError = null;
		this._restarting = true;
		try {
			// 1. `restart` — before anything is torn down.
			await this.handlers.lifecycle.emit("restart", { instance: previousInstanceID });

			// 2. Normal teardown of the old instance — the same steps as the root `api.shutdown()` dispose
			//    path: `mode: "shutdown"` routines, the root shutdown hook (whatever the user's routines
			//    config makes of it), then the internal teardown that emits `shutdown`. Run directly rather
			//    than through the root builtin, and as the host: this is framework-internal teardown, so a
			//    module that was allowed to call restart() must not be refused halfway by a routine's or
			//    hook's own call gate. A throwing routine/hook is captured and re-thrown at the end.
			if (this.isLoaded) {
				teardownError = await this._runAsHost(async () => {
					let firstError = null;
					try {
						await this.handlers.routineManager?.runShutdownModeRoutines();
					} catch (error) {
						firstError = error;
					}
					try {
						// Skipped when the routine run above already invoked it as a `mode: "shutdown"`
						// contribution, so it runs once per restart (#542).
						if (
							(await isCallableValue(this.userHooks?.shutdown)) &&
							!this.handlers.routineManager?.ranInModeRun("shutdown", this.userHooks.shutdown)
						) {
							await this.userHooks.shutdown();
						}
					} catch (error) {
						firstError ??= error;
					}
					await this.shutdown();
					return firstError;
				});
			}

			// 3. Reset the per-instance state the Slothlet shell carries between loads, so the new
			//    instance starts exactly as a fresh `slothlet({...})` would.
			await this._clearModuleCaches();
			this.envSnapshot = null;
			this._typesGenerated = false;
			this._totalLazyCount = 0;
			this._unmaterializedLazyCount = 0;
			this._materializationComplete = false;
			this._materializationCompleteEmitted = false;
			this._materializeCallbackCalled = false;

			// 4. Build the new instance from the original config. New wrappers carry the next epoch;
			//    the old tree's wrappers keep answering as themselves until the swap below.
			const config = copyTopLevelConfig(this._originalConfig, false);
			if (this._originalBase !== undefined) {
				config.base = this._originalBase;
			}
			this._buildEpoch = this._liveEpoch + 1;
			// A restart mounts none of the modules added before it: a module added later under one of their ids is new.
			this._moduleIncarnations = new Map();
			this._retiredIncarnations = new Map();
			// As the host too: the rebuild is framework work. A module's call that triggered the restart belongs to the
			// instance it was made in, which is still this one, so without this the new copy would be built as that module
			// — removed by the teardown above, and refused every read of the framework's own surface.
			await this._runAsHost(() => this.load(config));

			// 5. Swap complete: every wrapper from an earlier epoch now forwards to the node at its path
			//    in the new tree (or throws RESTART_REFERENCE_UNRESOLVED if the path is gone).
			this._liveEpoch = this._buildEpoch;
			// The runs open across the restart, kept by the teardown, run on under the new ID.
			const flows = this.contextManager?.instances;
			if (flows) {
				for (const ofEntry of mapEntries(flows)) {
					if (ofEntry[1].parentInstanceID === previousInstanceID) ofEntry[1].parentInstanceID = this.instanceID;
				}
			}
			reparentFlowStores(this, [previousInstanceID], this.instanceID);
			// The api tree is shared with every run until phase 4 gives a run its own: what goes with the tree (its
			// managers, the config, the tree itself) is the rebuilt one for every copy too. The forkable handlers stay
			// each copy's own.
			this.#copiesFollowTree();
		} finally {
			this._restarting = false;
		}

		// 6. `restarted` — on the new instance.
		await this.handlers.lifecycle.emit("restarted", { instance: this.instanceID, previous: previousInstanceID });

		if (teardownError) throw teardownError;
		return this.boundApi;
	}

	/**
	 * Run framework-internal work as the host: with no module caller, even when a module's call is what
	 * triggered it (e.g. a module allowed to call `restart()`). Host-initiated work runs as is.
	 *
	 * @param {Function} fn - The work.
	 * @returns {Promise<unknown>} Whatever `fn` resolves to.
	 * @private
	 *
	 * @example
	 * await this._runAsHost(() => this.shutdown());
	 */
	async _runAsHost(fn) {
		const identity = this.contextManager?.getCallerIdentity?.(this.instanceID);
		if (!identity?.currentWrapper && !identity?.unresolved) return fn();
		return this.contextManager.runInContext(this.instanceID, fn, null, [], null, true, true);
	}

	/**
	 * Clear Node.js module caches for reloading
	 * @private
	 */
	async _clearModuleCaches() {
		if (!isNode) return;
		// Clear CommonJS require cache
		// Only clear modules from the configured dir to avoid breaking dependencies
		const targetDir = this.config.base;
		// No base directory (#471): nothing was loaded from one, so there is nothing to clear here.
		if (targetDir === null) return;
		const require = createRequire(import.meta.url);
		const absoluteTargetDir = path.resolve(targetDir);

		// Clear require.cache for CJS modules
		for (let ofIndex = 0, ofList = Objects.keys(require.cache); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (StringMethods.startsWith(key, absoluteTargetDir)) {
				delete require.cache[key];
			}
		}

		// ESM modules are cached by URL and can't be cleared directly
		// The loadModule will handle cache-busting via query params for ESM
	}

	/**
	 * Inject runtime-aware metadata functions into api.slothlet.metadata
	 * These functions use the context manager to access current execution context
	 * @param {Object} api - API object with slothlet namespace
	 * @private
	 */
	injectRuntimeMetadataFunctions(api) {
		if (!api.slothlet?.metadata) {
			return;
		}

		const metadataHandler = this.handlers.metadata;

		// Delegate to Metadata class methods — all logic lives in metadata.mjs
		api.slothlet.metadata.self = function slothlet_metadata_self_runtime() {
			return metadataHandler.self();
		};

		api.slothlet.metadata.caller = function slothlet_metadata_caller_runtime() {
			return metadataHandler.caller();
		};
	}

	/**
	 * Drain any in-flight lazy-mode materializations before shutdown.
	 *
	 * Walks the internal API tree and collects every `materializationPromise` that
	 * is still pending (i.e. `state.inFlight === true`), then awaits them all via
	 * `Promise.allSettled` so that background `import()` calls can complete before
	 * the Vitest worker (or process) tears down the module registry.
	 *
	 * @returns {Promise<void>}
	 * @private
	 *
	 * @example
	 * await this._drainInFlightLoads();
	 */
	async _drainInFlightLoads() {
		// Only caller shutdown() returns unless isLoaded; load() sets this.api (truthy) before isLoaded, so api-null-while-loaded is unreachable.
		/* v8 ignore next */
		if (!this.api) return;

		const pending = [];
		const seen = new Set();

		/**
		 * Recursively walk the API tree and collect in-flight materialization promises.
		 * @param {object} obj - Node to inspect.
		 * @param {number} depth - Current recursion depth (capped at 15 to avoid cycles).
		 * @returns {void}
		 */
		const collect = (obj, depth = 0) => {
			// Allow function-type values through: in lazy mode every UnifiedWrapper proxy has
			// typeof === "function" (because callability is unknown until materialization), so
			// excluding functions would silently skip ALL lazy wrappers and their pending
			// materializationPromises, making this drain a no-op in exactly the mode it exists for.
			const objType = typeof obj;
			if (!obj || (objType !== "object" && objType !== "function") || depth > 15 || SetMethods.has(seen, obj)) return;
			SetMethods.add(seen, obj);

			try {
				// Skip version dispatcher proxies — they have no materialization promises. Detect by the
				// module-private brand, never by reading `.____isVersionDispatcher`: that `__`-private read
				// is denied by the permission gate on any gated data node under `private.host: deny` (#287).
				if (isFrameworkInternal(obj)) return;

				// ____slothletInternal is a prototype getter, not an own property, so
				// Object.hasOwn() always returns false for both raw wrappers and their
				// proxies. Use resolveWrapper() instead: checks the proxy registry first,
				// then falls back to instanceof for raw instances.
				const wrapper = resolveWrapper(obj);
				if (wrapper) {
					const mat = wrapper.____slothletInternal.materializationPromise;
					if (mat) listPush(pending, mat);

					// Walk child keys on the raw wrapper (not the proxy) to avoid triggering
					// ownKeysTrap, which calls ___materialize() on lazy+unmaterialized wrappers
					// during shutdown. Children are stored as own enumerable properties on the
					// raw wrapper; accessing wrapper[key] returns the child proxy, which collect
					// then resolves via resolveWrapper() on the next recursion.
					// A getter holds no load in flight: it is read by descriptor, so draining never runs a module's
					// getter (#597).
					for (let ofIndex = 0, ofList = Objects.keys(wrapper); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (!isFrameworkReservedKey(key)) collect(dataMemberOf(wrapper, key), depth + 1);
					}
					return;
				}

				for (let ofIndex = 0, ofList = Objects.keys(obj); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					collect(dataMemberOf(obj, key), depth + 1);
				}
			} catch {
				// Drain is best-effort; ignore errors from partially-constructed or
				// attack-state wrappers so shutdown always completes cleanly.
			}
		};

		for (let ofIndex = 0, ofList = Objects.keys(this.api); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			collect(dataMemberOf(this.api, key));
		}

		if (pending.length > 0) {
			await promiseAllSettled(pending);
		}
	}

	/**
	 * Shutdown instance and cleanup resources
	 * @public
	 */
	async shutdown() {
		// A full reload under way finishes first: its new copy is swapped in, or it fails and the instance keeps its copy,
		// and then what the instance has is shut down.
		if (this.#reloadWindow !== null) await this.#reloadSettled();
		if (!this.isLoaded) {
			return;
		}

		// `shutdown` (#504): teardown is starting — emitted on the instance's own emitter while every
		// system is still up, so its subscribers (config-declared and runtime alike) can still reach the
		// api. `restart` is true when the teardown is the first half of a restart().
		await this.handlers.lifecycle.emit("shutdown", { instance: this.instanceID, restart: this._restarting });

		// Drain any in-flight lazy-mode module loads before tearing down, so that
		// background import() calls can complete and won't cause "Closing rpc while
		// fetch was pending" errors in Vitest workers.
		await this._drainInFlightLoads();

		// The stop gap: what runs still hold (work that never finishes, such as a listener left on an emitter) is torn
		// down now, and the scopes of IDs kept copies loaded from are retired. A restart keeps open runs' copies.
		if (!this._restarting) await this.#teardownAllRuns();

		// Release this instance's share of the global boundary patches, and unpatch only once nothing holds
		// them. Unpatching while another instance is live would leave its deferred work unattributed —
		// which fails closed rather than leaking, but still refuses reads that should have succeeded.
		SetMethods.delete(boundaryPatchHolders, this.instanceID);
		if (this.#capabilityHolder !== null) {
			releaseCapabilityCheck(this.#capabilityHolder);
			this.#capabilityHolder = null;
		}
		if (SetMethods.delete(promisePatchHolders, this.instanceID) && SetMethods.size(promisePatchHolders) === 0) {
			disablePromisePatching();
			disableAsyncResourcePatching();
			disableNodeCallbackPatching();
		}
		if (SetMethods.delete(asyncCallbackHolders, this.instanceID) && SetMethods.size(asyncCallbackHolders) === 0) {
			disableAsyncCallbackServing();
		}
		if (SetMethods.size(boundaryPatchHolders) === 0) {
			disableEventEmitterPatching();
			disableSchedulerPatching();
			disableEventTargetPatching();
			disableEventTargetPropertyPatching();
			disableObserverPatching();
			disableClonePatching();
			disableFunctionSourcePatching();

			// Emitter cleanup is held to the same refcount: the tracking structures span every instance in
			// the process, so running this on each shutdown would rip a still-live sibling's listeners off
			// its emitters and clear the original→wrapped mapping its patched removeListener resolves
			// through. Deferral costs only that an earlier instance's listeners stay attached until the
			// last instance shuts down — at which point everything tracked is released together.
			cleanupEventEmitterResources();
		}

		// Cleanup context
		if (this.instanceID && this.contextManager) {
			// A restart keeps the run() / scope() stores open across it: they keep their copies, and move to the new ID once
			// the rebuild has one (see Slothlet#restartOnto).
			if (MapMethods.has(this.contextManager.instances, this.instanceID))
				this.contextManager.cleanup(this.instanceID, this._restarting ? { keepFlows: true } : undefined);
			if (!this._restarting) forgetFlowStores(this);
		}

		// Clear ownership
		// ownership is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.ownership) {
			this.handlers.ownership.clear();
		}

		// The instance's own handlers, also when the shutdown was asked for from a run(): a run's forks are the run's.
		const ownHandlers = (this.#fields ?? this).handlers;

		// Shutdown versioning manager — clears all dispatcher/registry/metadata state.
		ownHandlers.versionManager?.shutdown();

		// Shutdown permission manager — clears rules, cache, and resets enabled state.
		await ownHandlers.permissionManager?.shutdown();

		// Shutdown event manager (#407) — clears all subscriptions.
		ownHandlers.eventManager?.shutdown();

		// Drop this instance's private CommonJS helper copies (#518, #534), the scripts recorded and learned for its
		// files, and the records of what its modules made (#597).
		forgetInstanceScripts(this.instanceID);
		this.#releaseImportScope();
		releaseModuleMakers(this);

		// Remove on-disk TS transform cache (<projectRoot>/.slothlet-cache/<pid>-<hash of instanceID>/).
		// Hash-keyed filenames make repeat loads cheap; this keeps the directory bounded
		// across process runs. Node-only: `fsp` is null in a browser (helpers/platform), so guard
		// the same way as the reload-time cleanup (a browser never writes a TS cache anyway).
		if (isNode && this._typescriptCacheDirs?.size) {
			await promiseAllSettled(mapList(setToArray(this._typescriptCacheDirs), (dir) => fsp.rm(dir, { recursive: true, force: true })));
			SetMethods.clear(this._typescriptCacheDirs);
			// With its own cache gone, release the process's secure temp-dir fallback root if no other
			// instance still uses it (#465); the TypeScript processor is already loaded at this point.
			typescriptInternals ??= PromiseMethods.then(import("#processors/typescript"), (typescript) => typescript.internals("slothlet"));
			await (await typescriptInternals).releaseSecureFallbackRoot();
		}

		// Mark as not loaded. Keep this.api intact so the boundApi proxy remains
		// usable after shutdown (e.g. double-shutdown no-ops, reload-after-shutdown works).
		this.isLoaded = false;
	}

	/**
	 * Log debug message if debug flag is enabled
	 * @param {string} code - Debug code/category
	 * @param {Object} context - Debug context
	 * @public
	 *
	 * @example
	 * this.slothlet.debug("wrapper", { apiPath: "math", action: "materialized" });
	 */
	debug(code, context = {}) {
		if (this.debugLogger) {
			this.debugLogger.log(code, context);
		}
	}

	/**
	 * Get current API
	 * @returns {Object} Bound API object
	 * @public
	 */
	getAPI() {
		if (!this.isLoaded) {
			throw new SlothletError("INSTANCE_NOT_LOADED", {
				operation: ["slothlet", "diag", "api"]
			});
		}
		return this.boundApi;
	}

	/**
	 * A diagnostic snapshot of this instance (`api.slothlet.diag.inspect()`): this instance only, never the others the
	 * process-wide context manager also serves (#837).
	 * @returns {{ instance: string, loaded: boolean, at: number|null, config: object, runtime: { type: string, running: boolean }, context: object|null, self: string[], ownership: object|null }}
	 *   Its id, whether it is loaded, when its context record was made, its resolved config, the runtime it runs on
	 *   and whether a call of it is running now, its context data, the top-level names its `self` shows, and its
	 *   ownership summary (the `diag.owner` list shape).
	 * @public
	 */
	getDiagnostics() {
		const runtime = this.contextManager?.getInstanceDiagnostics?.(this.instanceID) ?? null;
		return {
			instance: this.instanceID,
			loaded: this.isLoaded,
			at: runtime?.at ?? null,
			config: this.#publicConfig(),
			runtime: { type: runtime?.type ?? this.config?.runtime ?? null, running: runtime?.running ?? false },
			context: runtime?.context ?? null,
			self: runtime?.self ?? [],
			ownership: this.handlers.ownership?.getDiagnostics() || null
		};
	}

	/**
	 * The resolved config as `diag.inspect()` reports it (D-7): the options as written in `slothlet({...})`, with
	 * their defaults filled in and the fields slothlet derives for itself left out. A copy: changing it never changes
	 * the instance.
	 * @returns {object} The config.
	 * @private
	 */
	#publicConfig() {
		const out = {};
		for (let ofIndex = 0, ofList = Objects.keys(this.config ?? {}); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (SetMethods.has(INTERNAL_CONFIG_KEYS, key)) continue;
			const value = this.config[key];
			// The values handed in by identity (reference, context) are reported as passed, as diag.reference and diag.context are.
			out[key] =
				value !== null && typeof value === "object" && !SetMethods.has(CONFIG_IDENTITY_KEYS, key)
					? this.helpers.utilities.deepClone(value)
					: value;
		}
		return out;
	}

	/**
	 * Get ownership information
	 * @returns {Object} Ownership data
	 * @public
	 */
	getOwnership() {
		if (!this.handlers.ownership) {
			return null;
		}
		return this.handlers.ownership.getDiagnostics();
	}

	/**
	 * Build final API with built-in methods attached
	 * @param {Object} userApi - Raw user API from load()
	 * @returns {Object} Final API with built-ins
	 * @private
	 */
	buildFinalAPI(userApi) {
		return this.builders.apiBuilder.buildFinalAPI(userApi);
	}
}

/**
 * Create a new Slothlet instance and load an API from a directory.
 * This is the sole public entry point for slothlet. Each call produces an independent
 * API instance with its own component graph, context store, and lifecycle.
 * @alias module:@cldmv/slothlet
 * @async
 * @template {object} [T=import("./lib/runtime/runtime.mjs").SlothletSelf] - The loaded api's own shape.
 *   Defaults to `SlothletSelf`, which a `slothlet typegen` declaration extends with the project's api;
 *   pass another interface (`slothlet<OtherApi>(...)`) when a program loads more than one api.
 * @param {SlothletOptions} config - Configuration options
 * @returns {Promise<SlothletAPI & T>} Fully loaded, proxy-based API object
 * @public
 * @example
 * // Minimal usage
 * const api = await slothlet({ base: "./api" });
 * const result = await api.math.add(2, 3);
 * await api.slothlet.shutdown();
 *
 * @example
 * // Lazy mode with background materialization
 * const api = await slothlet({
 *   base: "./api",
 *   mode: "lazy",
 *   loader.materialize: true
 * });
 *
 * @example
 * // With hooks
 * const api = await slothlet({ base: "./api", hook: true });
 * api.slothlet.hook.on("before", "**", (endpoint, args) => { /* ... *\/ });
 *
 * @example
 * // Hot-reload a module at runtime
 * await api.slothlet.api.reload("./api/math.mjs");
 *
 * @example
 * // Strict collision control
 * const api = await slothlet({
 *   base: "./api",
 *   api: { collision: { initial: "merge", api: "error" } }
 * });
 */
export async function slothlet(config) {
	const instance = new Slothlet();
	// The package whose code is creating the instance is the host's own (#714).
	recordInstanceOwner(instance);
	// Retain the config as passed, before anything reads it, so restart() can rebuild from it (#504).
	instance._retainOriginalConfig(config);
	const api = await instance.load(config);

	// API already has builtins attached from load()
	return api;
}

/**
 * Single source of truth for slothlet's own built-in default values that a consumer might
 * reference or spread — never a value hand-copied next to the real one, always the exact
 * constant/Set the runtime itself reads (see `src/lib/helpers/defaults.mjs`). Frozen at every
 * level: a consumer spreading `slothlet.defaults.routines` gets an independent array, but the
 * exported originals can never be mutated out from under other consumers or slothlet itself.
 *
 * @type {Readonly<{routines: ReadonlyArray<{name: string, mode: string}>, reserved: ReadonlySet<string>}>}
 * @public
 *
 * @example
 * // Extend the built-in routines instead of replacing them
 * const api = await slothlet({ base: "./api", routines: [...slothlet.defaults.routines, "launch"] });
 *
 * @example
 * // Drop just the shutdown default, keep initialize
 * const api = await slothlet({
 *   base: "./api",
 *   routines: slothlet.defaults.routines.filter((r) => r.name !== "shutdown")
 * });
 */
slothlet.defaults = Objects.freeze({
	routines: DEFAULT_ROUTINES,
	reserved: RESERVED_EXPORTS
});

export default slothlet;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Configuration options passed to `slothlet()`.
 * @typedef {object} SlothletOptions
 * @property {string} [base] - Directory (node mode) or file:// URL / base URL (browser mode) to load API modules from.
 *   Required in both modes. Plain filesystem paths are automatically converted to `file://` URLs by the default browser-mode resolver.
 * @property {"eager"|"lazy"} [mode="eager"] - Loading strategy.
 *   - `"eager"` — all modules are loaded immediately at startup (default).
 *   - `"lazy"` — modules are loaded on first access via a Proxy.
 *   Also accepted: `"immediate"` / `"preload"` (eager aliases); `"deferred"` / `"proxy"` (lazy aliases).
 * @property {"async"|"live"} [runtime="async"] - Context propagation runtime.
 *   - `"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).
 *   - `"live"` — Experimental live bindings.
 *   Also accepted (case-insensitive): `"asynclocal"` / `"asynclocalstorage"` as aliases for `"async"`; `"livebindings"` / `"experimental"` as aliases for `"live"`.
 *   Any other value silently falls back to `"async"`.
 * @property {"instance"|"module"} [helpers="instance"] - How often a helper file (a file an api file imports that is no api file itself) is loaded.
 *   - `"instance"` — once per instance: every api file importing the helper shares one copy, and so its module state.
 *   - `"module"` — once per importing api file: each api file gets its own copy of every helper it imports, so helper state is not shared between api files, and the permission system can tell which api file a helper's code runs for. Node and the vite plugin only; a browser build keeps one copy.
 * @property {number} [depth=Infinity] - Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root.
 * @property {string|string[]} [hidden] - Glob or array of globs hiding files and folders from the API, matched against each entry's
 *   path relative to `base` (folder-style `a/b` or dotted `a.b`; `*` one segment, `**` any depth, `?` one char, `{a,b}` alternation,
 *   `!` re-includes, a trailing `/` names folders only, a name's leading `.` is part of the name). Files match on their
 *   extension-stripped path. The globs sit over the built-in rule that hides `.`/`__`-prefixed names: they apply in order, the
 *   last one that matches an entry decides, and an entry no glob matches falls to the built-in rule, so `"!**\/__*"` brings back
 *   `__`-prefixed files and folders and `["!**\/.*\/", "!**\/__*\/"]` the folders only. Framework-reserved names are still refused.
 *   Also accepted per-call by `api.slothlet.api.add(path, dir, { hidden })`, where globs are relative to the added folder.
 * @property {object|null} [context=null] - Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`.
 * @property {object|null} [reference=null] - Object whose properties are merged directly onto the root API and, with `diagnostics: true`, readable as `api.slothlet.diag.reference`.
 * @property {{merge?: "shallow"|"deep", isolation?: "partial"|"full"}} [scope] - Defaults for `api.slothlet.context.scope()` runs.
 *   `merge`: `"shallow"` merges top-level keys; `"deep"` recurses into nested objects (any other value throws `INVALID_CONFIG`).
 *   `isolation`: `"partial"` (default) lets a scope's `self` writes reach the shared api; `"full"` gives the scope a copy-on-write `self`. A per-call `isolation` option overrides it; any other value throws `SCOPE_ISOLATION_MODE_INVALID`.
 * @property {object|null} [metadata] - Init metadata. Each key is set as global metadata (inherited by every later `api.slothlet.api.add()`) and registered as user metadata for the base module. See [METADATA.md](docs/METADATA.md#init-metadata).
 * @property {object} [sanitize] - Options for turning file and folder names into api property names, the same options `sanitizePropertyName()` takes:
 *   `first` (default `true`), `preserve` (`{ upper?, lower? }`, each default `false`) and `rules` (`{ leave?, nocase?, upper?, lower? }`, each a `string[]` of exact names, globs or `**boundary**` patterns).
 *   Applies to every file and folder name the loader derives and to `api.slothlet.sanitize()`. See [SANITIZATION.md](docs/SANITIZATION.md).
 * @property {object} [api] - API build and mutation settings.
 * @property {string|{mode?: (string|{initial: string, api: string}), override?: boolean}} [api.collision] - Collision handling. A bare
 *   string is the shorthand for `{ mode }`.
 * @property {string|{initial: string, api: string}} [api.collision.mode="merge"] - Collision strategy when two modules export the same path.
 *   Modes: `"merge"` (default), `"merge-replace"`, `"replace"`, `"skip"`, `"warn"`, `"error"`.
 *   Pass an object to use different strategies for the initial build vs. runtime `api.slothlet.api.add()` calls.
 * @property {boolean} [api.collision.override=false] - Must be `true` before `api.slothlet.api.add()` honors a per-call `collisionMode` / `mutateExisting` / `recordHistory`.
 * @property {object} [api.mutations={add:true,remove:true,reload:true,permissions:true,events:true}] - Enable or disable runtime mutation surfaces.
 *   Object with boolean keys: `add`, `remove`, `reload` (`api.slothlet.api.*`), `permissions` (`api.slothlet.permissions.*` rule changes) and `events` (`api.slothlet.event.rules.*`), all default `true`.
 * @property {boolean|string|object} [hook=false] - Hook system configuration.
 *   - `false` — disabled (default).
 *   - `true` — enabled, all endpoints.
 *   - `string` — enabled with a default glob pattern.
 *   - `object` — full control: `{ enabled: boolean, pattern?: string, errors?: "suppress"|false, pin?: boolean }` (`pin` defaults to `true`; `errors: true` means `"suppress"`).
 * @property {object|"on"|"off"|"disabled"|boolean} [permissions] - Permission system configuration. Omit it and the system is off entirely. A bare `"on"`, `"off"` or `"disabled"` means `{ mode }`, `true` and `false` mean `"on"` and `"off"`; any other string or non-object value throws `INVALID_CONFIG`. See [PERMISSIONS.md](docs/PERMISSIONS.md#configuration).
 * @property {"allow"|"deny"} [permissions.policy="allow"] - Fallback when no rule matches.
 * @property {"on"|"strict"|"off"|"disabled"|boolean} [permissions.mode="on"] - Whether the rules apply; `true`/`false` mean `"on"`/`"off"`.
 * @property {"default"|"verbose"|boolean} [permissions.audit="default"] - Audit level; `true`/`false` normalize to `"default"`.
 * @property {boolean} [permissions.owner=false] - Owner grant (#509): a caller leaf may access any target leaf currently owned
 *   by the same module (the initial load's base module, or an `api.add()`'s `moduleID`) — across that module's own directories —
 *   wherever `policy` would otherwise deny. Matched by owner, not path, so another module mounted into the same namespace
 *   gets nothing; an explicit deny rule still wins. See [PERMISSIONS.md](docs/PERMISSIONS.md#owner-grant).
 * @property {object} [permissions.caller] - How the caller of a call or read is identified.
 * @property {boolean} [permissions.caller.anonymous=false] - Let a call or read with no resolvable caller through instead of denying it.
 * @property {"precise"|"fast"} [permissions.caller.attribution="precise"] - How the definer of code a module hands out is known
 *   (#726): `"precise"` wraps a returned value that is itself code to record its definer, where the stack cannot tell it;
 *   `"fast"` wraps nothing, keeping `===` for returned functions, and tells every definer from the stack, refusing where
 *   it cannot. See [PERMISSIONS.md](docs/PERMISSIONS.md#code-a-module-hands-out-runs-as-its-definer).
 * @property {boolean} [permissions.caller.capture=true] - A function read out of the api keeps its reader's identity.
 * @property {"leaf"|"chain"} [permissions.caller.ceiling="leaf"] - Code a caller hands to a leaf runs as that caller, under the
 *   leaf it is running inside as its ceiling (#597); `"chain"` keeps every leaf the code was handed through as its ceiling
 *   instead. See [PERMISSIONS.md](docs/PERMISSIONS.md#code-a-caller-hands-to-a-leaf-runs-as-the-caller).
 * @property {boolean} [permissions.caller.provenance=true] - A module's function reached by a route slothlet does not see — a
 *   callback, a shared object, a global, a replaced built-in — runs as that module inside another module's call, with
 *   the call as its ceiling (#597). `false` turns this off: such a function then runs with the permissions of whichever
 *   call runs it, and what a module returns is searched for code when it is handed out instead, so code nested in
 *   returned data keeps its definer.
 * @property {object} [permissions.gating] - What is gated besides calls.
 * @property {boolean|number} [permissions.gating.buffers=false] - Whether a typed array or `Buffer` one module hands
 *   another is checked for members of its own under string keys (`bytes.item = …`), which means listing its keys:
 *   `false` never lists, `true` always does, a whole number lists arrays of up to that many kilobytes. One found holding
 *   a member is handed over as a view.
 * @property {boolean} [permissions.gating.read=true] - Gate terminal data-value reads the same way calls are gated.
 * @property {object} [permissions.private] - Module privacy (`{ host?: "deny"|"allow", scope?: "module"|"folder" }`): whether the host reads `_`/`__` members, and whether a member is private to its owning module ID (default) or to the folder that exports it.
 * @property {Array<object>} [permissions.rules] - Initial `{ caller, target, effect, condition?, requires? }` rules.
 * @property {object} [permissions.events] - Event-rule section (`{ policy?: "deny"|"notify"|"allow", rules?: Array<object> }`).
 * @property {boolean|object} [debug=false] - Enable verbose internal logging. `true` enables all categories.
 *   Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context`, `initialization`, `materialize`, `versioning`, `permissions` to target specific subsystems.
 * @property {boolean} [silent=false] - Suppress all console output from slothlet (warnings, deprecations). Does not affect `debug`.
 * @property {boolean} [diagnostics=false] - Enable the `api.slothlet.diag.*` introspection namespace. Intended for testing; do not enable in production.
 * @property {Object.<string, (Function|Function[])>} [lifecycle] - Construction-time lifecycle subscribers, registered on the lifecycle emitter BEFORE the api builds so events emitted during cold-start `buildAPI` (init-time `impl:warning` / `impl:created` / …) are observable. Maps an event name to a handler `function(data, token)` or an array of them; any event name is accepted. Because they are ordinary subscribers, they also receive runtime events afterward — equivalent to calling `api.slothlet.lifecycle.on(event, fn)` for each, but early enough to catch initialization diagnostics. Because they come from the config, `api.slothlet.restart()` subscribes them again on the new instance, so they also receive the new instance's `init` and `restarted` events (runtime `lifecycle.on` subscribers are dropped with the old instance). Example: `{ "impl:warning": (d) => log(d), "impl:error": [onError, audit] }`.
 * @property {object} [routines] - Stackable lifecycle routines (#341).
 * @property {Array<string|{name: string, mode?: ("manual"|"startup"|"shutdown"|"destroy"), recursive?: boolean, order?: ("mount"|"depth"), cascade?: boolean}>} [routines.entries] - Stackable lifecycle routines (#341). Every mounted module exporting a function matching a configured routine name is composed into one callable at its exact composed api path, plus a root cascade (`self.<name>()`, i.e. `api.<name>()`) that runs every matching contribution anywhere. Entries: `"name"` (mode `"manual"`), `"name:mode"`, or `{ name, mode?, recursive?, order?, cascade? }` (`recursive`/`order`/`cascade` only settable via the object form). `name` is mount-relative by default (a bare name matches only a mount's own top level; a dotted name matches a fixed relative sub-path, or with `recursive: true` any depth within the mount); a `^`-prefixed name is root-anchored, matched via glob (`*`, `**`, `{}`, `!`) against the full api path, crossing mount boundaries. `order` (`"mount"` | `"depth"`, mode-defaulted) controls the root cascade's grouping order. `cascade` (default `true`) controls whether the root `api.<name>()` run-all cascade is created at all — set `cascade: false` (#400) for a per-entity lifecycle routine, where the host must invoke exactly one co-owner by key via `api.<path>.<name>.for(moduleID)(...)` rather than a run-all; every stacked path also exposes `api.<path>.<name>.contributors` (the moduleIDs present there). `.for(key)` runs that one contributor in its own extent/identity with the args passed straight through, and bypasses the `routines.stack` owner-filter so a specific co-owner runs even if it lost the shared-path collision. Providing `routines.entries` REPLACES the built-in defaults (`slothlet.defaults.routines`: `initialize` → `startup`, `shutdown` → `shutdown`) — spread `slothlet.defaults.routines` to extend them instead, or pass `[]` to disable every routine. Every configured routine is always wrapped and directly callable regardless of `routines.auto`. Whether two or more contributors colliding at the identical api path all run is governed by `routines.stack` (#365), independent of the collision mode — by default every contributor at that path runs, in mount order; `routines.stack: false` runs only the single contribution that actually owns that path, matching ordinary collision behavior. A throwing contributor doesn't stop the chain — every contributor runs (best-effort), and one aggregate `ROUTINE_FAILED` error is thrown afterward if any failed. See [LIFECYCLE.md](docs/LIFECYCLE.md#routines).
 * @property {boolean} [routines.auto=true] - When `true` (the default), every `mode: "startup"` routine's cascade runs at the end of compose, and every `mode: "shutdown"`/`"destroy"` routine's cascade runs on the corresponding dispose call. `false` leaves every routine to explicit calls. See [LIFECYCLE.md](docs/LIFECYCLE.md#routines).
 * @property {boolean} [routines.stack=true] - Whether two or more modules' contributions colliding at the exact same composed api path all run (the default), or only the single contribution that actually owns that path (per the collision mode) runs (#365). Deliberately independent of the collision mode — with `false`, a module that loses a collision, under any mode, does not run via the routine system. The root cascade runs every matching contribution across distinct api paths regardless of this flag; where two or more contributions land on the identical api path, the cascade applies the same filtering a direct call at that path would. See [LIFECYCLE.md](docs/LIFECYCLE.md#routines).
 * @property {boolean|object} [tracking=false] - Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress.
 * @property {object} [clock] - Host only: the functions the instance reads the time and starts its deferred work with, instead of the ones slothlet loaded with. Read once when the instance is created and never part of the config the instance reports. See [CONFIGURATION.md](docs/CONFIGURATION.md#clock).
 * @property {function(): number} [clock.now] - The time in milliseconds: `ttl` of principals, reload and run IDs, and every recorded timestamp.
 * @property {Function} [clock.set] - Schedules the instance's deferred work as `setTimeout` does (called with a delay of `0`); a host that fakes timers moves it with its own clock.
 * @property {Function} [clock.clear] - Cancels a timer `clock.set` made, as `clearTimeout` does.
 * @property {object} [i18n] - Internationalization settings (dev-facing, process-global).
 *   `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`).
 * @property {object|null} [env] - `process.env` snapshot configuration (Node mode). Independent of `platform`.
 *   - `{ include: ["KEY"] }` — allowlist; only the listed keys are captured in `api.slothlet.env`. Non-string entries are silently ignored; an all-non-string array falls back to the full snapshot.
 *   - Omitted / `null` — the full `process.env` snapshot is captured.
 * @property {string[]} [env.include] - Allowlist of environment variable names to capture. Only string entries are used.
 * @property {object} [loader] - How leaf files are found and loaded.
 * @property {Function} [loader.import] - Injectable leaf importer: `(specifier: string) => Promise<object>`.
 *   Every leaf module load is routed through it instead of slothlet's own dynamic `import()`, so the
 *   modules land in the caller's module graph rather than slothlet's. Pass `(s) => import(s)` written
 *   inside the consumer's own (transformed) code to make a coverage run attribute leaf execution
 *   correctly; unset, slothlet imports natively. See [`docs/TESTING.md`](../docs/TESTING.md).
 * @property {{files: Array<{path:string,name:string,full:string}>, directories: Array}} [loader.files] - Pre-generated directory structure for browser mode.
 *   Produced at build time by `files.generate()` from `@cldmv/slothlet/files`. Required when `loader.platform` is `"browser"`.
 *   Giving it selects browser mode without an explicit `loader.platform`.
 * @property {boolean|Function} [loader.materialize=false] - When `mode: "lazy"`, immediately begins materializing all paths in the background after init. A function turns it on and is called once with `{ total, timestamp }` when everything has materialized — at once when that is already so when the instance finishes loading (always in eager mode). What it throws or rejects with is reported as a `WARNING_LIFECYCLE_HANDLER_ERROR` warning.
 * @property {"browser"|"node"} [loader.platform] - Execution-environment target. Controls whether filesystem-dependent code paths run. Independent of `env` (the `process.env` snapshot).
 *   - `"browser"` — browser/worker/Electron-renderer mode. Skips filesystem operations and the `process.env` snapshot. Requires `loader.files`.
 *   - `"node"` — explicit Node.js mode.
 *   - Omitted — auto-detected: `"browser"` when `loader.files` is given (or no Node `process` is present), `"node"` otherwise.
 * @property {Function} [loader.resolve] - Browser-mode module resolver: `(fileEntry: {path, name, full}) => string | URL`.
 *   Maps a file list entry to an importable URL or bare specifier. Defaults to resolving against `base` as a `file://` URL.
 *   Override to point at a CDN, bundler virtual module, or other browser-friendly source.
 * @property {boolean|"fast"|"strict"|object} [typescript=false] - TypeScript support.
 *   - `false` — disabled (default).
 *   - `true` or `"fast"` — esbuild transpilation, no type checking.
 *   - `"strict"` — tsc compilation with type checking and `.d.ts` generation.
 *   See [TYPESCRIPT.md](docs/TYPESCRIPT.md) for the full configuration reference.
 * @property {object} [versioning] - Versioned api paths.
 * @property {string|Function|null} [versioning.dispatcher] - Version routing discriminator for versioned API paths.
 *   - **string** (e.g. `"version"`) — at dispatch time, reads that key from the calling module's version metadata to select a version tag.
 *   - **function** — called as `(allVersions, caller) => versionTag | null`; return a registered version tag to force routing, or `null`/`undefined` to fall through to the automatic default.
 *   - **omitted / `undefined`** — behaves identically to `"version"`.
 *   Only relevant when modules are registered via `api.slothlet.api.add()` with a `version` option.
 */

/**
 * Bound API object returned by `slothlet()`.
 * The root contains all loaded module exports plus the reserved `slothlet` namespace.
 * @typedef {object} SlothletAPI
 * @property {function(): void} destroy - Like `shutdown()` but additionally invokes registered destroy hooks before teardown. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.destroy();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.destroy();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.destroy();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.destroy();%%
 * @property {function(): void} shutdown - Convenience alias for `slothlet.shutdown()`. Shuts down the instance and invokes any user-provided shutdown hook first. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.shutdown();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.shutdown();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.shutdown();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.shutdown();%%
 * @property {object} slothlet - Built-in control namespace. All framework internals live here to avoid collisions with loaded modules.
 * @property {Readonly<Record<string, string|undefined>>} slothlet.env - Frozen snapshot of `process.env` captured once at instance creation (before any module lifecycle runs). Immutable for the lifetime of the instance — reloads do NOT refresh it. When `env.include` is configured, only the listed keys are captured; otherwise, the full environment is snapshotted.
 * @property {object} slothlet.api - Runtime API mutation methods — availability controlled by `api.mutations` config option.
 * @property {Function} slothlet.api.add - Mount a new API module at runtime. %%sig: (apiPath: string, folderPath: string, [options]: Object): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.api.add('utils.math', './api/utils/math');%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.slothlet.api.add('utils.math', './api/utils/math');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.slothlet.api.add('utils.math', './api/utils/math');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.slothlet.api.add('utils.math', './api/utils/math');%%
 * @property {Function} slothlet.api.reload - Hot-reload a specific module or directory path. %%sig: ([pathOrModuleId]: string|null, [options]: Object): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|// Reload a specific module|await api.slothlet.api.reload('utils.math');|// Reload everything|await api.slothlet.api.reload();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  // Reload a specific module|  await api.slothlet.api.reload('utils.math');|  // Reload everything|  await api.slothlet.api.reload();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  // Reload a specific module|  await api.slothlet.api.reload('utils.math');|  // Reload everything|  await api.slothlet.api.reload();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|// Reload a specific module|await api.slothlet.api.reload('utils.math');|// Reload everything|await api.slothlet.api.reload();%%
 * @property {Function} slothlet.api.remove - Unmount an API module at runtime. `remove(id)` removes every path the module owns; `remove(apiPath)` removes that path's whole subtree; the two-argument `remove(apiPath, id)` removes only module `id`'s single node at the path, leaving sibling modules sharing the mount and the module's other mounts intact. Resolves to whether anything was removed. %%sig: (target: string, id?: string): Promise.<boolean>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.api.remove('utils.math');%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.slothlet.api.remove('utils.math');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.slothlet.api.remove('utils.math');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.slothlet.api.remove('utils.math');%%
 * @property {Function} slothlet.api.leaves - Enumerate the api paths a module owns, read from the loader's ownership records. Pass a moduleID, a mount endpoint, any owned path, or `"."` for the base load; `{ details: true }` returns every owned path tagged with its kind instead of the callable paths alone. The answer is scoped to the caller — module-private members the caller could not read are omitted; `{ private: true }` (host-only) returns the unredacted list, and a module caller passing it is refused with PERMISSION_DENIED. %%sig: (key: string, [options]: Object): Promise.&lt;string[]|Array.&lt;{path: string, kind: &quot;function&quot;|&quot;namespace&quot;|&quot;data&quot;}&gt;&gt;%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const moduleID = await api.slothlet.api.add('shop', './ext/shop/api');|await api.slothlet.api.leaves(moduleID);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.slothlet.api.leaves('shop', { details: true });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.slothlet.api.leaves('shop');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.slothlet.api.leaves('shop');%%
 * @property {object} slothlet.api.modules - Module discovery + mount sub-namespace. Composes subsystems shipped as separate npm packages (each with a `slothlet.module.json` manifest) into this api tree at runtime. Each method is typed as `Function` here; the detailed parameter / return shapes (`DiscoverOptions`, `DiscoverResult`, `AddModuleOptions`, `AddModulesOptions`, `MountResult`, `FailureEntry`) live in [`docs/MODULE-DISCOVERY.md`](../docs/MODULE-DISCOVERY.md), which also covers multi-version routing, error codes, and the `modules:*` lifecycle events.
 * @property {Function} slothlet.api.modules.discover - Walk the filesystem for slothlet modules; replace the per-instance discovery cache and return the fresh results. %%sig: ([options]: Object): Promise.<DiscoverResult[]>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const found = await api.slothlet.api.modules.discover({ scanRoot: process.cwd(), prefix: "@cldmv/packrat-driver-" });%%
 * @property {Function} slothlet.api.modules.sort - Pure sort; default comparator is `priority` desc with `package` asc tiebreak. Pass a custom comparator to override. %%sig: (results: DiscoverResult[], [comparator]: function): DiscoverResult[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const ordered = api.slothlet.api.modules.sort(await api.slothlet.api.modules.discover());%%
 * @property {Function} slothlet.api.modules.add - Mount modules. `add(name | result)` mounts one module (a package name looked up in the discovery cache, which is filled by `discover()` when empty, or a result `discover()` returned); `add([...])` mounts a batch (`onFailure: "throw" | "rollback" | "best-effort"`, `concurrency`); `add()` or `add(options)` runs `discover()` (with `options.discover`), `sort()` (with `options.sort`) and mounts every result. Only results slothlet returned count as a result: any other object is the options. %%sig: ([target]: string|DiscoverResult|Array.<(string|DiscoverResult)>|Object, [options]: Object): Promise.<*>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.api.modules.add("@org/driver");|await api.slothlet.api.modules.add(["@org/a", "@org/b"], { concurrency: 2 });|await api.slothlet.api.modules.add({ discover: { prefix: "@org/" } });%%
 * @property {Function} slothlet.api.modules.remove - Unmount a previously-mounted module. %%sig: (name: string, [options]: Object): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.api.modules.remove("@cldmv/packrat-driver-opensearch");%%
 * @property {object} slothlet.api.modules.cache - The discovery cache: what the last `discover()` found.
 * @property {Function} slothlet.api.modules.cache.get - Snapshot of the current discovery cache. Returns the same `DiscoverResult[]` shape `discover()` produces. %%sig: (): DiscoverResult[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const cached = api.slothlet.api.modules.cache.get();%%
 * @property {Function} slothlet.api.modules.cache.clear - Empty the discovery cache (does NOT unmount anything already mounted). %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.api.modules.cache.clear();%%
 * @property {Function} slothlet.api.modules.stale - Reconciliation aid: returns mounts whose `${package}@${version}` no longer appears in the discovery cache. Useful for hot-reload prune logic. %%sig: (): MountResult[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const stale = api.slothlet.api.modules.stale();%%
 * @property {object} slothlet.context - Per-request context helpers.
 * @property {Function} slothlet.context.get - Get a value from the current per-request context store. %%sig: ([key]: string): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.context.run({ userId: 42 }, async () => {|  const userId = api.slothlet.context.get('userId'); // 42|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.slothlet.context.run({ userId: 42 }, async () => {|    const userId = api.slothlet.context.get('userId'); // 42|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.slothlet.context.run({ userId: 42 }, async () => {|    const userId = api.slothlet.context.get('userId'); // 42|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.slothlet.context.run({ userId: 42 }, async () => {|  const userId = api.slothlet.context.get('userId'); // 42|});%%
 * @property {Function} slothlet.context.run - Execute a callback with isolated context data merged in. %%sig: (contextData: Object, callback: function, args: *): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const result = await api.slothlet.context.run({ userId: 42 }, async () => {|  return api.myModule.getUser(); // sees context.userId = 42|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  const result = await api.slothlet.context.run({ userId: 42 }, async () => {|    return api.myModule.getUser(); // sees context.userId = 42|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  const result = await api.slothlet.context.run({ userId: 42 }, async () => {|    return api.myModule.getUser(); // sees context.userId = 42|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|const result = await api.slothlet.context.run({ userId: 42 }, async () => {|  return api.myModule.getUser(); // sees context.userId = 42|});%%
 * @property {Function} slothlet.context.scope - Execute a function with structured context options (`context`, `fn`, `args`, `merge`, `isolation`). %%sig: (options: Object): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const result = await api.slothlet.context.scope({|  context: { userId: 42 },|  fn: async () => api.myModule.getUser()|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  const result = await api.slothlet.context.scope({|    context: { userId: 42 },|    fn: async () => api.myModule.getUser()|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  const result = await api.slothlet.context.scope({|    context: { userId: 42 },|    fn: async () => api.myModule.getUser()|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|const result = await api.slothlet.context.scope({|  context: { userId: 42 },|  fn: async () => api.myModule.getUser()|});%%
 * @property {Function} slothlet.context.set - Change the instance-level context every leaf reads, one key or several; a `run()` / `scope()`'s own keys still win inside it. Host only unless a rule allows `slothlet.context.set`. %%sig: (keyOrValues: string|Object, value: *): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', context: { tenant: 'acme' } });|api.slothlet.context.set('region', 'eu');|api.slothlet.context.set({ tenant: 'globex', region: 'us' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  api.slothlet.context.set('region', 'eu');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  api.slothlet.context.set('region', 'eu');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|api.slothlet.context.set('region', 'eu');%%
 * @property {object} [slothlet.diag] - Diagnostics namespace — only present when `diagnostics: true`. Do not enable in production.
 * @property {object} [slothlet.diag.caches] - Cache diagnostics sub-namespace.
 * @property {function(): Object} [slothlet.diag.caches.get] - Get full cache diagnostic data (`{ caches[] }`). Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { caches: [...] }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { caches: [...] }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { caches: [...] }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { caches: [...] }%%
 * @property {function(): string[]} [slothlet.diag.caches.ids] - Return all moduleIDs currently in cache. Only available when `diagnostics: true`. %%sig: (): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.ids();|// ['utils/math.mjs', 'utils/strings.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.ids();|  // ['utils/math.mjs', 'utils/strings.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.ids();|  // ['utils/math.mjs', 'utils/strings.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.ids();|// ['utils/math.mjs', 'utils/strings.mjs']%%
 * @property {Function} [slothlet.diag.caches.has] - Check whether a cache entry exists for a given moduleID. Only available when `diagnostics: true`. %%sig: (moduleID: string): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%%
 * @property {object} [slothlet.diag.context] - The `context` config value as passed to `slothlet()`.
 * @property {Function} [slothlet.diag.describe] - Describe API structure. Pass `true` to return the full API object; omit for top-level keys only. Only available when `diagnostics: true`. %%sig: ([showAll]: boolean): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%%
 * @property {function(): Object} [slothlet.diag.api] - Return the live bound API proxy object. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const proxy = api.slothlet.diag.api(); // the live bound API proxy%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const proxy = api.slothlet.diag.api(); // the live bound API proxy|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const proxy = api.slothlet.diag.api(); // the live bound API proxy|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const proxy = api.slothlet.diag.api(); // the live bound API proxy%%
 * @property {object} [slothlet.diag.hook] - Hook system diagnostics sub-namespace (present only when hooks are enabled).
 * @property {function(): Object} [slothlet.diag.inspect] - Return a full diagnostic snapshot of current instance state. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.instance, snapshot.ownership);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.instance, snapshot.ownership);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.instance, snapshot.ownership);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.instance, snapshot.ownership);%%
 * @property {object} [slothlet.diag.owner] - Ownership sub-namespace for diagnostics.
 * @property {Function} [slothlet.diag.owner.get] - Get the owning moduleIDs for a specific API path. Only available when `diagnostics: true`. %%sig: (apiPath: string): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%%
 * @property {function(): Object} [slothlet.diag.owner.list] - Return ownership diagnostics for all registered API paths. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const ownership = api.slothlet.diag.owner.list();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const ownership = api.slothlet.diag.owner.list();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const ownership = api.slothlet.diag.owner.list();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const ownership = api.slothlet.diag.owner.list();%%
 * @property {object} [slothlet.diag.reference] - The `reference` config value as passed to `slothlet()`.
 * @property {object} slothlet.hook - Hook registration surface — only present when the `hook` option is enabled.
 * @property {Function} slothlet.hook.clear - Alias for `remove()`. %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.clear({ type: 'before' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.clear({ type: 'before' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.clear({ type: 'before' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.clear({ type: 'before' });%%
 * @property {Function} slothlet.hook.disable - Disable hooks matching a filter (empty = disable all). %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.disable(); // disable all|api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.disable(); // disable all|  api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.disable(); // disable all|  api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.disable(); // disable all|api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks%%
 * @property {Function} slothlet.hook.enable - Enable hooks matching a filter (empty = enable all). %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.disable();|// later...|api.slothlet.hook.enable(); // re-enable all%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.disable();|  // later...|  api.slothlet.hook.enable(); // re-enable all|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.disable();|  // later...|  api.slothlet.hook.enable(); // re-enable all|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.disable();|// later...|api.slothlet.hook.enable(); // re-enable all%%
 * @property {Function} slothlet.hook.list - List registered hooks matching a filter. %%sig: ([filter]: Object): Object[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|const allHooks = api.slothlet.hook.list();|const beforeHooks = api.slothlet.hook.list({ type: 'before' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  const allHooks = api.slothlet.hook.list();|  const beforeHooks = api.slothlet.hook.list({ type: 'before' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  const allHooks = api.slothlet.hook.list();|  const beforeHooks = api.slothlet.hook.list({ type: 'before' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|const allHooks = api.slothlet.hook.list();|const beforeHooks = api.slothlet.hook.list({ type: 'before' });%%
 * @property {Function} slothlet.hook.off - Remove hooks by ID or filter object (v2 alias for `remove()`). %%sig: (idOrFilter: string|Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|const hookId = api.slothlet.hook.on('math.*:before', handler);|api.slothlet.hook.off(hookId); // remove by ID|api.slothlet.hook.off({ type: 'after' }); // remove by filter%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  const hookId = api.slothlet.hook.on('math.*:before', handler);|  api.slothlet.hook.off(hookId); // remove by ID|  api.slothlet.hook.off({ type: 'after' }); // remove by filter|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  const hookId = api.slothlet.hook.on('math.*:before', handler);|  api.slothlet.hook.off(hookId); // remove by ID|  api.slothlet.hook.off({ type: 'after' }); // remove by filter|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|const hookId = api.slothlet.hook.on('math.*:before', handler);|api.slothlet.hook.off(hookId); // remove by ID|api.slothlet.hook.off({ type: 'after' }); // remove by filter%%
 * @property {Function} slothlet.hook.on - Register a hook handler for a path-then-type pattern (e.g. `"math.*:before"`; the legacy `"before:math.*"` form is deprecated). Types: `before`, `after`, `always`, `error`, and `around` (wraps the rest of the pipeline through `next(args?)`). %%sig: (typePattern: string, handler: function, [options]: Object): string%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|const hookId = api.slothlet.hook.on('math.*:before', ({ args }) => {|  console.log('math called with', args);|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  const hookId = api.slothlet.hook.on('math.*:before', ({ args }) => {|    console.log('math called with', args);|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  const hookId = api.slothlet.hook.on('math.*:before', ({ args }) => {|    console.log('math called with', args);|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|const hookId = api.slothlet.hook.on('math.*:before', ({ args }) => {|  console.log('math called with', args);|});%%
 * @property {object} slothlet.hook.pattern - The runtime global path filter: which api paths hooks apply to (`enable`, `disable`, `reset`).
 * @property {Function} slothlet.hook.pattern.enable - Restrict hook execution to an API path pattern at runtime (global path filter; the runtime form of `hook.pattern`). Distinct from enable/disable, which toggle individual registered hooks. %%sig: (pattern: string): number%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.pattern.enable('database.*'); // only intercept database.* paths%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.pattern.enable('database.*');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.pattern.enable('database.*');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.pattern.enable('database.*');%%
 * @property {Function} slothlet.hook.pattern.disable - Remove a path pattern from the runtime global path filter; when the last pattern is removed the filter deactivates and hooks apply to every path again. %%sig: (pattern: string): number%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.pattern.enable('database.*');|api.slothlet.hook.pattern.disable('database.*'); // stop restricting%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.pattern.disable('database.*');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.pattern.disable('database.*');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.pattern.disable('database.*');%%
 * @property {Function} slothlet.hook.pattern.reset - Reset the runtime global path filter back to the configured `hook.pattern` default (fully unrestricted if that default was `"**"`). %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: 'database.*' });|api.slothlet.hook.pattern.enable('cache.*');|api.slothlet.hook.pattern.reset(); // back to database.* only%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: 'database.*' });|  api.slothlet.hook.pattern.reset();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: 'database.*' });|  api.slothlet.hook.pattern.reset();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: 'database.*' });|api.slothlet.hook.pattern.reset();%%
 * @property {object} slothlet.hook.pin - Host-only runtime control over hook-pinning enforcement (mirrors `permissions.control`). "Host-only" is enforced by the built-in `slothlet.hook.**` permission deny baseline, so it only holds when the permission system is enabled — without permissions a module reaching the hook surface can toggle it. Force-pinning makes a module hook always run under its registering module's identity; an unpinned module hook is a permission-bypass vector. Enabled by default (config `hook.pin`).
 * @property {boolean} slothlet.hook.pin.enabled - Whether hook pinning is currently enforced (true = module hooks are force-pinned, the default). %%sig: boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|const enforced = api.slothlet.hook.pin.enabled;%%
 * @property {Function} slothlet.hook.pin.enable - Enforce hook pinning: a module hook's `pin: false` is ignored (force-pinned). Host-only. %%sig: (): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.pin.enable(); // force-pin module hooks (host only)%%
 * @property {Function} slothlet.hook.pin.disable - Stop enforcing hook pinning: permit a per-registration `pin: false` on module hooks. Host-only. %%sig: (): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.pin.disable(); // permit unpinned module hooks (host only)%%
 * @property {Function} slothlet.hook.remove - Remove hooks matching a filter (`id`, `type`, `pattern`). %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', hook: true });|  api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', hook: true });|api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });%%
 * @property {object} slothlet.event - Instance-wide, permission-gated event system — named pub/sub scoped to this instance. Each subscriber's delivery level (`deny`/`notify`/`allow`) is resolved from the event-rule pool. `on`/`once`/`off`/`emit` are open to modules; `resolveLevel`, `rules.*`, `strategy` and `deliver` are host-only (built-in `slothlet.event.**` deny).
 * @property {Function} slothlet.event.on - Subscribe a listener, called `(payload, meta)`. Returns the granted level, an unsubscribe, and the listener id `<owner moduleID>:<event>:<n>` (`options.key` replaces `n`; the host's owner is empty). %%sig: (event: string, listener: function, options?: { once?: boolean, key?: string|number }): { level: string, off: function, id: string }%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const { level, off, id } = api.slothlet.event.on('orders.created', (payload, meta) => {});%%
 * @property {Function} slothlet.event.once - Subscribe for a single delivery, then auto-unsubscribe. %%sig: (event: string, listener: function, options?: { key?: string|number }): { level: string, off: function, id: string }%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.event.once('orders.created', (payload) => console.log(payload));%%
 * @property {Function} slothlet.event.off - Remove a listener by reference. %%sig: (event: string, listener: function): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const onCreated = () => {};|api.slothlet.event.on('orders.created', onCreated);|api.slothlet.event.off('orders.created', onCreated);%%
 * @property {Function} slothlet.event.emit - Publish an event. Ungated. Resolves once every listener has settled — or, under a strategy that defers, once the strategy has accepted it. %%sig: (event: string, payload?: any): Promise<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.event.emit('orders.created', { id: 42 });%%
 * @property {Function} slothlet.event.level - Resolve the delivery level a supplied subscriber identity would be granted, without subscribing. Host-only. %%sig: (subscriberPath: string|null, event: string): string%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.event.level('reporting.dashboard', 'orders.created'); // "deny" | "notify" | "allow"%%
 * @property {object} slothlet.event.rules - Runtime event-rule mutation. Host-only; gated by `api.mutations.events`.
 * @property {Function} slothlet.event.rules.add - Add an event rule in the runtime layer; returns its id. %%sig: (rule: { caller: string, event: string, effect: string, condition?: any }): string%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const ruleId = api.slothlet.event.rules.add({ caller: 'reporting.**', event: 'orders.*', effect: 'allow' });%%
 * @property {Function} slothlet.event.rules.remove - Remove a runtime event rule by id. %%sig: (ruleId: string): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.event.rules.remove(ruleId);%%
 * @property {Function} slothlet.event.strategy - Hand every emit to a host delivery strategy, called `(envelope, listeners, defaultDeliver)`; `null` restores immediate delivery. A strategy that returns without calling `defaultDeliver` defers the event (emit resolves on acceptance); one that calls it delivers now (emit resolves on settle). Host-only; survives reload. %%sig: (fn: function|null): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const pending = [];|api.slothlet.event.strategy((envelope, listeners, defaultDeliver) => {|  if (!inTransaction()) return defaultDeliver();|  pending.push({ envelope, listeners });|});%%
 * @property {Function} slothlet.event.deliver - Deliver a strategy-held envelope to one listener, inside the context captured at emit, enforcing the rules as they stand now. Resolves `{ delivered: true, level }`, or `{ delivered: false, reason: "listener-gone" | "denied" }`; rejects with the listener's error when it throws. Host-only. %%sig: (envelope: object, listenerId: string): Promise<{ delivered: boolean, level?: string, reason?: string }>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|for (const { envelope, listeners } of pending.splice(0)) {|  for (const id of listeners) await api.slothlet.event.deliver(envelope, id);|}%%
 * @property {object} slothlet.lifecycle - Lifecycle event emitter.
 * @property {Function} slothlet.lifecycle.off - Unsubscribe a handler from a lifecycle event. %%sig: (event: string, handler: function): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const handler = () => console.log('shutdown');|api.slothlet.lifecycle.on('shutdown', handler);|api.slothlet.lifecycle.off('shutdown', handler);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  const handler = () => console.log('shutdown');|  api.slothlet.lifecycle.on('shutdown', handler);|  api.slothlet.lifecycle.off('shutdown', handler);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  const handler = () => console.log('shutdown');|  api.slothlet.lifecycle.on('shutdown', handler);|  api.slothlet.lifecycle.off('shutdown', handler);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|const handler = () => console.log('shutdown');|api.slothlet.lifecycle.on('shutdown', handler);|api.slothlet.lifecycle.off('shutdown', handler);%%
 * @property {Function} slothlet.lifecycle.on - Subscribe to a lifecycle event (e.g. `"materialized:complete"`). %%sig: (event: string, handler: function): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.lifecycle.on('shutdown', () => {|  console.log('Slothlet is shutting down');|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  api.slothlet.lifecycle.on('shutdown', () => {|    console.log('Slothlet is shutting down');|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  api.slothlet.lifecycle.on('shutdown', () => {|    console.log('Slothlet is shutting down');|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|api.slothlet.lifecycle.on('shutdown', () => {|  console.log('Slothlet is shutting down');|});%%
 * @property {object} slothlet.materialize - Lazy materialization tracking (meaningful only when `mode: "lazy"`).
 * @property {function(): Object} slothlet.materialize.get - Get current materialization statistics (`{ total, materialized, remaining, percentage }`). %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', mode: 'lazy' });|const stats = api.slothlet.materialize.get();|// { total: 5, materialized: 3, remaining: 2, percentage: 60 }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', mode: 'lazy' });|  const stats = api.slothlet.materialize.get();|  // { total: 5, materialized: 3, remaining: 2, percentage: 60 }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', mode: 'lazy' });|  const stats = api.slothlet.materialize.get();|  // { total: 5, materialized: 3, remaining: 2, percentage: 60 }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', mode: 'lazy' });|const stats = api.slothlet.materialize.get();|// { total: 5, materialized: 3, remaining: 2, percentage: 60 }%%
 * @property {boolean} slothlet.materialize.complete - `true` once all lazy folders have been fully loaded.
 * @property {function(): Promise.<void>} slothlet.materialize.wait - Returns a Promise that resolves when all lazy folders are fully materialized. %%sig: (): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', mode: 'lazy' });|await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', mode: 'lazy' });|  await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', mode: 'lazy' });|  await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', mode: 'lazy' });|await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded%%
 * @property {object} slothlet.metadata - Module metadata accessor.
 * @property {function(): Object|null} slothlet.metadata.caller - Get the function that invoked the current one, as a caller object ({ path, module, metadata, version }) (runtime-injected). %%sig: (): Object|null%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|// Inside an API module, get metadata of the calling function:|const callerMeta = api.slothlet.metadata.caller(); // null if no caller%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  // Inside an API module, get metadata of the calling function:|  const callerMeta = api.slothlet.metadata.caller(); // null if no caller|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  // Inside an API module, get metadata of the calling function:|  const callerMeta = api.slothlet.metadata.caller(); // null if no caller|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|// Inside an API module, get metadata of the calling function:|const callerMeta = api.slothlet.metadata.caller(); // null if no caller%%
 * @property {Function} slothlet.metadata.get - Get user metadata, synchronously: global < api path chain < the function's own. `target` is a function or node, an api path (dotted or a segment array, a versioned path such as `'v1.auth'` included) or a module id; `options.version` reads that version of a logical path. Never includes the facts slothlet records about a node (file, folder, path, module): `slothlet.node(target)` reports those. %%sig: (target: function|Object|string|Array.<string>, [options]: Object): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|const meta = api.slothlet.metadata.get(api.math.add);|// { label: 'Addition' }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  const meta = api.slothlet.metadata.get(api.math.add);|  // { label: 'Addition' }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  const meta = api.slothlet.metadata.get(api.math.add);|  // { label: 'Addition' }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|const meta = api.slothlet.metadata.get(api.math.add);|// { label: 'Addition' }%%
 * @property {Function} slothlet.metadata.remove - Remove user metadata set on a target (a function or node, an api path, or a module id): the named key(s), or all of it. %%sig: (target: function|Object|string|Array.<string>, [key]: string|Array.<string>): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set('math', 'label', 'Math');|api.slothlet.metadata.remove('math', 'label');%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set('math', 'label', 'Math');|  api.slothlet.metadata.remove('math', 'label');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set('math', 'label', 'Math');|  api.slothlet.metadata.remove('math', 'label');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set('math', 'label', 'Math');|api.slothlet.metadata.remove('math', 'label');%%
 * @property {function(): Object|null} slothlet.metadata.self - Get the currently-executing API function, as a caller object ({ path, module, metadata, version }) (runtime-injected). %%sig: (): Object|null%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|// Inside api.math.add, get its own metadata:|const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  // Inside api.math.add, get its own metadata:|  const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  // Inside api.math.add, get its own metadata:|  const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|// Inside api.math.add, get its own metadata:|const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }%%
 * @property {Function} slothlet.metadata.set - Set user metadata on a function or node, or for every function at or under an api path or module id. %%sig: (target: function|Object|string|Array.<string>, keyOrObj: string|Object, [value]: *): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|api.slothlet.metadata.set('math', { category: 'utilities' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  api.slothlet.metadata.set('math', { category: 'utilities' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  api.slothlet.metadata.set('math', { category: 'utilities' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|api.slothlet.metadata.set('math', { category: 'utilities' });%%
 * @property {Function} slothlet.metadata.global - Set global metadata applied to every function in the instance. %%sig: (key: string, value: *): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.metadata.global('version', '2.0');|// Every function now has metadata: { version: '2.0' }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.global('version', '2.0');|  // Every function now has metadata: { version: '2.0' }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  api.slothlet.metadata.global('version', '2.0');|  // Every function now has metadata: { version: '2.0' }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|api.slothlet.metadata.global('version', '2.0');|// Every function now has metadata: { version: '2.0' }%%
 * @property {Function} slothlet.node - Report what slothlet knows about an api node: one frozen `{ callable, file, folder, loading, logical?, manifest?, materialized, mode, module, path, type }`. `target` is a node or its api path (dotted or a segment array); `path` and `logical` are segment arrays; `type` is `slothlet.types.UNMATERIALIZED` / `IN_FLIGHT` until a lazy node loads, then `'function'`, `'data'` or `'namespace'`. The caller must be allowed to reach the target. %%sig: (target: function|Object|string|Array.<string>): Object|undefined%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const report = api.slothlet.node(api.math.add);|// { callable: true, mode: 'eager', module: 'base_slothlet', path: ['math', 'add'], type: 'function', … }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  const report = api.slothlet.node(api.math.add);|  // { callable: true, mode: 'eager', module: 'base_slothlet', path: ['math', 'add'], type: 'function', … }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  const report = api.slothlet.node(api.math.add);|  // { callable: true, mode: 'eager', module: 'base_slothlet', path: ['math', 'add'], type: 'function', … }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|const report = api.slothlet.node(api.math.add);|// { callable: true, mode: 'eager', module: 'base_slothlet', path: ['math', 'add'], type: 'function', … }%%
 * @property {object} slothlet.owner - Path ownership accessor.
 * @property {Function} slothlet.owner.get - Get ownership info for a specific API path. %%sig: (apiPath: string): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const info = api.slothlet.owner.get('math.add');|// { path: 'math.add', owners: Set { 'utils/math.mjs' } }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  const info = api.slothlet.owner.get('math.add');|  // { path: 'math.add', owners: Set { 'utils/math.mjs' } }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  const info = api.slothlet.owner.get('math.add');|  // { path: 'math.add', owners: Set { 'utils/math.mjs' } }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|const info = api.slothlet.owner.get('math.add');|// { path: 'math.add', owners: Set { 'utils/math.mjs' } }%%
 * @property {object} slothlet.warnings - The warnings this instance raised, printed or not. Host only by default (built-in deny on `slothlet.warnings.**`).
 * @property {Function} slothlet.warnings.get - This instance's warnings, oldest first (a copy). %%sig: (): SlothletWarning[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|const codes = api.slothlet.warnings.get().map((w) => w.code);%%
 * @property {Function} slothlet.warnings.clear - Empty this instance's warning list. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.slothlet.warnings.clear();%%
 * @property {object} slothlet.permissions - Permission system surface — present whenever a `permissions` block is configured. Rule registration (`rules.add`/`rules.remove`), principal resolvers (`principal.*`), self/global introspection (`self.*`, `global.*`), and runtime control (`control.*`) live here. Only the `control` sub-namespace is typed in this typedef; the rule-management methods are documented in [`docs/PERMISSIONS.md`](../docs/PERMISSIONS.md).
 * @property {object} slothlet.permissions.rules - Runtime permission rules. Gated by `api.mutations.permissions`.
 * @property {Function} slothlet.permissions.rules.add - Add a permission rule; returns its id. A target under `slothlet.` or `capability:` must name a real member or capability (`PERMISSION_RULE_UNKNOWN_TARGET` otherwise). %%sig: (rule: { caller: string, target: string, effect: string, condition?: any, requires?: string[] }): string%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { mode: "on" } });|const id = api.slothlet.permissions.rules.add({ caller: "untrusted.**", target: "db.**", effect: "deny" });%%
 * @property {Function} slothlet.permissions.rules.remove - Remove a permission rule by id. %%sig: (ruleId: string): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { mode: "on" } });|api.slothlet.permissions.rules.remove(id);%%
 * @property {object} slothlet.permissions.global - Permission queries and rule listings for any caller or target.
 * @property {object} slothlet.permissions.global.check - Would a caller be allowed? `access` is the silent query; `call` is the audited call-gate query (host only by default).
 * @property {Function} slothlet.permissions.global.check.access - Whether `caller` may reach `target`. No audit. %%sig: (caller: string, target: string): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { mode: "on" } });|api.slothlet.permissions.global.check.access("payments.charge", "db.write");%%
 * @property {Function} slothlet.permissions.global.check.call - Whether `caller` may call `target` with `args`, evaluated as the real call gate does (audited). A promise only when a principal had to be resolved. %%sig: (caller: string, target: string, [args]: Array): boolean|Promise.<boolean>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { mode: "on" } });|await api.slothlet.permissions.global.check.call("client.app", "files.list", ["p1"]);%%
 * @property {object} slothlet.permissions.global.rules - The rules that apply: `path(target)` by target path, `module(id)` by owning module.
 * @property {Function} slothlet.permissions.global.rules.path - Rules that match a target path. %%sig: (path: string): Object[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { mode: "on" } });|api.slothlet.permissions.global.rules.path("db.write");%%
 * @property {Function} slothlet.permissions.global.rules.module - Rules a module owns. %%sig: (moduleID: string): Object[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { mode: "on" } });|api.slothlet.permissions.global.rules.module("mod_abc123");%%
 * @property {object} slothlet.permissions.control - Runtime control over permission enforcement.
 * @property {function(("on"|"off"|boolean)=): ("on"|"strict"|"off"|"disabled")} slothlet.permissions.control.mode() - The permission system's mode, or switch it: no argument returns it; `"on"`/`true` or `"off"`/`false` switches and returns the new mode. `"strict"` is config-only; `"disabled"` can be left but not entered; locked by `seal()`. %%sig: (value?: "on"|"off"|boolean): string%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { defaultPolicy: 'allow' } });|api.slothlet.permissions.control.mode(); // "on"|api.slothlet.permissions.control.mode("off");%%
 * @property {object} slothlet.permissions.control.gating - Runtime gating switches; matches the config's `permissions.gating` group.
 * @property {function(boolean=): boolean} slothlet.permissions.control.gating.read - Read-level gating state, or switch it: no argument returns whether terminal data-value reads are gated; a boolean switches it and returns the new state. Throws `INVALID_ARGUMENT` for a non-boolean. %%sig: (value?: boolean): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { defaultPolicy: 'allow' } });|api.slothlet.permissions.control.gating.read(false); // stop gating reads|api.slothlet.permissions.control.gating.read(); // false%%
 * @property {function(): void} slothlet.permissions.control.seal - Seal the permission control surface (one-way, no unseal). After sealing, switching `mode(value)` / `gating.read(value)`, `rules.add`/`rules.remove`, and `principal.register`/`principal.unregister` throw `PERMISSION_SEALED`. Enforcement continues to evaluate, `principal.invalidate` and `shutdown()` still work. Idempotent. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { defaultPolicy: 'allow' } });|api.slothlet.permissions.control.seal();%%
 * @property {boolean} slothlet.permissions.control.sealed - Whether the permission control surface has been sealed. Exposed as a getter so descriptor-based reads remain permission-gated. %%sig: boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { defaultPolicy: 'allow' } });|const sealed = api.slothlet.permissions.control.sealed;%%
 * @property {function(): {mode: string, baseline: {met: (boolean|null), checks: Array<{id: string, met: boolean, reason: (string|null)}>}, capabilities: Array<{name: string, allowed: Array<string>}>}} slothlet.permissions.control.report - The mode, what the permission baseline found when the instance started (`met: null` when no check ran), and the capabilities rules open. A met baseline means only that the checks slothlet can make passed; code that ran before slothlet can have changed what they read. %%sig: (): { mode, baseline, capabilities }%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', permissions: { mode: 'on' } });|const { baseline } = api.slothlet.permissions.control.report();%%
 * @property {object} slothlet.versioning - Runtime version management API. This namespace is always present on `api.slothlet`; before any module has been registered via `api.slothlet.api.add()` with a `version` option, its methods return `undefined` where documented or otherwise have no effect until versioning data exists.
 * @property {Function} slothlet.versioning.list - List all registered versions for a logical API path. Returns `undefined` if the path has no registered versions or if versioning has not yet been used. %%sig: (logicalPath: string): {versions: Object<string, {at: number, default: boolean, metadata: object, module: string, path: string[], tag: string}>, default: string|null}|undefined%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', versioning: { dispatcher: "version" } });|await api.slothlet.api.add('auth', './api/v1', { version: { tag: 'v1', default: true } });|const info = api.slothlet.versioning.list('auth');|if (info) console.log(info.default); // "v1"%%
 * @property {Function} slothlet.versioning.default - Override the default version for a logical API path at runtime. If no versions are registered for the path, this call has no effect until versioning data exists. %%sig: (logicalPath: string, versionTag: string): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', versioning: { dispatcher: "version" } });|await api.slothlet.api.add('auth', './api/v1', { version: { tag: 'v1' } });|await api.slothlet.api.add('auth', './api/v2', { version: { tag: 'v2' } });|api.slothlet.versioning.default('auth', 'v1');%%
 * @property {Function} slothlet.versioning.remove - Unregister a specific version from a logical API path. Removes the versioned namespace (`vX.path`) and updates or tears down the dispatcher. If the logical path/version is not registered, this resolves without removing anything. %%sig: (logicalPath: string, versionTag: string): Promise.<boolean>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', versioning: { dispatcher: "version" } });|await api.slothlet.api.add('auth', './api/v1', { version: { tag: 'v1' } });|await api.slothlet.api.add('auth', './api/v2', { version: { tag: 'v2' } });|const removed = await api.slothlet.versioning.remove('auth', 'v2'); // true%%
 * @property {object} slothlet.versioning.metadata - Version-manager-only metadata (not the store `metadata.set` writes).
 * @property {Function} slothlet.versioning.metadata.get - Retrieve the VersionManager-only metadata stored at registration time via `options.version.metadata`. Returns `undefined` if the path or version is not registered, or if versioning has not yet been used. %%sig: (logicalPath: string, versionTag: string): object|undefined%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', versioning: { dispatcher: "version" } });|await api.slothlet.api.add('auth', './api/v1', { version: { tag: 'v1', metadata: { stable: true } } });|const meta = api.slothlet.versioning.metadata.get('auth', 'v1'); // { stable: true, version: 'v1', path: ['auth'] }%%
 * @property {Function} slothlet.versioning.metadata.set - Patch (merge) the VersionManager-only metadata for a registered version at runtime. The injected `version` and `path` keys always win over supplied patch fields. Throws `VERSION_NOT_FOUND` if the path or version is not registered. %%sig: (logicalPath: string, versionTag: string, patch: object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', versioning: { dispatcher: "version" } });|await api.slothlet.api.add('auth', './api/v1', { version: { tag: 'v1' } });|api.slothlet.versioning.metadata.set('auth', 'v1', { stable: true });%%
 * @property {Function} slothlet.pin - Freeze the registering module's caller identity onto a callback. The returned wrapper overrides only the caller identity when invoked; request-scoped context stays live. In **async** runtime mode the pinned identity propagates through `AsyncLocalStorage` for the callback's full async lifetime. In **live** runtime mode identity is pinned only for the synchronous portion — once `fn` returns its promise the live context is restored, so an async callback that `await`s before calling `self.*` resumes with no slothlet caller at all (an identity check sees `unknown`); use async runtime mode for async hooks (e.g. Fastify `addHook`) that must keep identity past the first `await`. **`slothlet.pin.caller(fn)`** (a property of this function, same signature) pins the current leaf's **caller** instead — the identity `slothlet.metadata.caller()` reports — so a service that runs callbacks on behalf of whoever called it (a scheduler, a registry) runs each one as that caller rather than as itself. It is denied to modules by a built-in rule on `slothlet.pin.caller`; the host grants it (e.g. `{ caller: "scheduler.**", target: "slothlet.pin.caller", effect: "allow" }`). When the leaf was called from outside any module the callback is pinned to no module caller and runs as the host (`metadata.caller()` returns null inside it). Otherwise it behaves like `lockCaller`, including the runtime-mode caveat. %%sig: (fn: function): function%% %%example: // Inside a module's init()|server.addHook("onRequest", self.slothlet.pin(handler));%% %%example: // Inside a scheduler leaf (host-granted `slothlet.pin.caller`)|export function every(ms, job) {|  setInterval(self.slothlet.pin.caller(job), ms);|}%%
 * @property {Function} slothlet.bind - Freeze the entire async context onto a callback at registration time (convenience re-export of `AsyncResource.bind`). Unlike `pin`, which overrides only caller identity and leaves request-scoped context live, `bind` freezes every `AsyncLocalStorage`, including slothlet's caller and context. Meaningful in async runtime mode; degrades to non-slothlet ALS context in live mode. %%sig: (fn: function): function%% %%example: // Inside a module's init()|server.addHook("onRequest", self.slothlet.bind(handler));%%
 * @property {Function} slothlet.reload - Reload the entire instance (re-scans the directory and recreates all module references). Accepts `{ instance: "keep" | "new" }` (default `"new"`: the reloaded instance gets a new instance id). %%sig: ([options]: Object): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.reload(); // full reload%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.slothlet.reload(); // full reload|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.slothlet.reload(); // full reload|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.slothlet.reload(); // full reload%%
 * @property {Function} slothlet.restart - Clean-slate restart: shut this instance down through the normal teardown path and build a new one from the ORIGINAL `slothlet({...})` config behind the same `api` reference. Unlike `reload()`, nothing runtime is carried over — no replayed `add()`/`remove()` history, runtime hooks, permission rules, event or lifecycle subscriptions, metadata, runtime assignments or module-scope state (modules are re-imported under a new instance ID). Held child references are re-pointed to the node at the same path in the new instance; one whose path no longer exists throws `RESTART_REFERENCE_UNRESOLVED` on use. Emits `restart` → `shutdown` → `init` → `restarted`. Refused with `API_MUTATION_DISABLED` when `api.mutations.reload` is `false`, and, when a `permissions` config is present, host-only (a built-in rule denies `slothlet.restart` to modules; an explicit host rule can allow a trusted module — with no `permissions` config the permission system is off and modules can call it). The new instance comes up with only the original config's permission rules and unsealed, even if the old one was sealed. See [RELOAD.md](docs/RELOAD.md#apislothletrestart). %%sig: (): Promise.<Object>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|api.conn.handlers = { onSend };|await api.slothlet.restart(); // clean slate from the original config|api.conn.handlers; // undefined%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.slothlet.restart();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.slothlet.restart();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.slothlet.restart();%%
 * @property {function(): Promise.<void>} slothlet.shutdown - Shut down the instance and release all resources. Framework-only teardown: runs the `mode: "shutdown"` routines (with `routines.auto: true` a root `shutdown` export runs once, as a contribution) but never calls the root `shutdown`/`destroy` hooks itself, so with `routines.auto: false` no module code runs — use `api.shutdown()` to also call the root `shutdown` hook. %%sig: (): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.slothlet.shutdown();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.slothlet.shutdown();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.slothlet.shutdown();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.slothlet.shutdown();%%
 */
