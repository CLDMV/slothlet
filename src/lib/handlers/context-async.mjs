/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-async.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:37-08:00 (1795651537)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview AsyncLocalStorage-based context manager
 * @module @cldmv/slothlet/handlers/context-async
 * @internal
 */
// Node-only ALS resolved in the platform module so node:async_hooks stays out of the browser
// static graph (#123). Browser uses the live context manager, so this manager never runs there.
import { AsyncLocalStorage, AsyncResource, createHook, executionAsyncId, executionAsyncResource, inheritsFrom } from "#helpers/platform";
import { nativeThen } from "#helpers/promise-context";
import { resourceStoreHolder, resourceStoreKnown } from "#helpers/async-store-slot";
import { SlothletError } from "#errors";
import { DEFAULT_CLOCK } from "#helpers/clock";
import { runtime_isClassInstance, internals as classInstanceWrapperInternals } from "#helpers/class-instance-wrapper";
import { internals as eventemitterContextInternals } from "#helpers/eventemitter-context";
import { internals as trustedRootInternals } from "#handlers/trusted-root";
import {
	countAsyncInstance,
	holdRunWork,
	releaseRunWork,
	RUN_COPY,
	runCopyCounts,
	UNCOUNTED_RESOURCE,
	watchRuns,
	whenIdle
} from "#helpers/flow-stores";
import {
	carriesCallerCode,
	handsOutAsModule,
	attributesResults,
	isHandedOut,
	isHostPrototype,
	resolvesSupplier,
	internals as framePlacementInternals
} from "#handlers/frame-placement";
import {
	ArrayMethods,
	concatLists,
	FinalizationRegistry,
	FinalizationRegistryMethods,
	FunctionMethods,
	Map,
	mapEntriesToArray,
	mapKeysToArray,
	MapMethods,
	Objects,
	Promise,
	Promises,
	PrototypeFunctions,
	queueMicrotask,
	Reflect,
	StringMethods,
	Symbol,
	WeakMap,
	WeakMapMethods,
	listPush
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";
const { runtime_wrapClassInstance } = classInstanceWrapperInternals("lib/handlers/context-async");
const { setApiContextChecker, setListenerFlow } = eventemitterContextInternals("lib/handlers/context-async");
const trustedRootOwn = trustedRootInternals("lib/handlers/context-async");

/**
 * The modules a job runs for (see `ACTING_FOR` in `handlers/trusted-root`): what a function another module handed over
 * made while it ran for that module (a promise's reaction it registered, a timer), by the job's resource, put back while
 * the job's callback runs.
 * @type {WeakMap<object, ReadonlyArray<object>>}
 * @private
 */
const JOB_ACTING_FOR = new WeakMap();
/**
 * Whether {@link JOB_ACTING_FOR} has ever been given an entry: until then no job runs for a module, and a callback's
 * start skips the lookup.
 * @type {boolean}
 * @private
 */
let jobActingForFilled = false;
/**
 * What {@link currentJobResource} answers when the async resource running now cannot be read.
 * @type {object}
 * @private
 */
const NO_JOB_RESOURCE = Objects.freeze({ __proto__: null });

/**
 * The async resource whose callback is running now, read once per `before` / `after` of the job hook and handed to each
 * step there.
 * @returns {object} The resource, or {@link NO_JOB_RESOURCE} when the platform has no way to read it or reading it threw.
 * @private
 */
function currentJobResource() {
	try {
		return executionAsyncResource === null ? NO_JOB_RESOURCE : executionAsyncResource();
	} catch {
		return NO_JOB_RESOURCE;
	}
}
const { buildCapturedFlowStore } = trustedRootOwn;
const { attributeResult, enterCall, ownReceiver, resolveSupplier, runningOutsideFlow, sampleStoreScripts, scopeEnteredByCode } =
	framePlacementInternals("lib/handlers/context-async");

/**
 * Marks the stand-in store {@link AsyncContextManager} hands code that entered a flow by itself when no single leaf
 * stands for that code: its code is no one's, and its accesses are refused.
 * @type {symbol}
 * @private
 */
const OUTSIDE_FLOW = Symbol("slothlet.outsideFlow");

/**
 * The flow a stand-in store {@link AsyncContextManager#outsideView} made stands outside of: code that entered that flow
 * by itself runs in the stand-in from then on, and so does every job it hands Node (see
 * {@link AsyncContextManager#activeStore}).
 * @type {symbol}
 * @private
 */
const FLOW_OF = Symbol("slothlet.flowOf");

/**
 * The async resources code that entered a flow by itself made there (a promise, a timer, an immediate, a microtask, an
 * `AsyncResource`), each with the stand-in store that code acted in (see {@link AsyncContextManager#activeStore}). Node
 * runs such a resource's callback later with nothing of the code on the stack, so what it runs is told by this mark.
 * @type {WeakMap<object, object>}
 * @private
 */
const OUTSIDE_JOBS = new WeakMap();

/**
 * The store each async resource made while a flow ran was made in: Node runs the resource's callback in that store,
 * unless something put another in place (code entering a resource, a snapshot or a timer of another flow). An
 * `AsyncResource` anyone can enter is held under a {@link SCOPE} record instead, so its scope never counts as made in its
 * store. A microtask's resource is Node's own, entered only by Node. A promise is marked by {@link PromiseFlow} instead.
 * @type {WeakMap<object, object>}
 * @private
 */
const MADE_IN = new WeakMap();

/**
 * An empty list for {@link AsyncContextManager#jobStack}: an array with no prototype, so the hook writes its elements
 * directly, without a setter module code put on `Array.prototype` or `Object.prototype` ever running.
 * @returns {Array<object>} The list.
 * @private
 */
function jobStackList() {
	return Objects.setPrototypeOf([], null);
}

/**
 * Hands the object it is constructed with back as the instance, so a subclass's private field is put on that object.
 * @private
 */
class Stamped {
	/**
	 * @param {object} target - The object to stamp.
	 */
	constructor(target) {
		return target;
	}
}

/**
 * The store each promise made while a flow ran was made in (as {@link MADE_IN} for every other resource), held in a
 * private field put on the promise: only this class reads it, nothing can forge it, and putting it costs a fraction of
 * a `WeakMap` entry (the async hook runs for every promise a flow makes). The job Node begins for a promise runs only
 * what was fixed when it was made (an `await`'s continuation, the reaction `then()` registered, the thenable it resolves
 * to); one the flow's own code made, unmarked in {@link OUTSIDE_JOBS}, runs that code's continuation in the flow. A
 * promise carries the async id `AsyncResource.prototype.runInAsyncScope()` reads, though, so code holding one can put
 * its scope in place around code of its own: only a job Node began counts (see
 * {@link AsyncContextManager#begunByNode}).
 * @private
 */
class PromiseFlow extends Stamped {
	#store;

	/**
	 * @param {object} promise - The promise.
	 * @param {object} store - The store it is made in.
	 */
	constructor(promise, store) {
		super(promise);
		this.#store = store;
	}

	/**
	 * The store a promise was made in.
	 * @param {*} value - An async resource.
	 * @returns {object|undefined} The store, or undefined when it is no promise marked here.
	 */
	static of(value) {
		return value !== null && typeof value === "object" && #store in value ? value.#store : undefined;
	}
}
Objects.freeze(Stamped.prototype);
Objects.freeze(PromiseFlow.prototype);

/**
 * The callback slot of a timer, an immediate or a `process.nextTick()` job made while a flow ran, with the function in
 * it when it was made: code holding the timer can put another function there later, which is then not what the flow
 * handed Node. A microtask's resource is an `AsyncResource` Node enters once, with the callback it was queued with, and
 * Node begins a tick's job once; `entries` counts how often the scope of either has been entered, so code that got hold
 * of it and enters it again is not taken for that job.
 * @type {WeakMap<object, {slot: string|null, fn: *, entries: number}>}
 * @private
 */
const JOB_CALLBACK = new WeakMap();

/**
 * The callback slot each kind of job Node runs a function it was handed from: a job of any other kind (a socket, a
 * stream) runs whatever its holder adds to it.
 * @type {Map<string, string|null>}
 * @private
 */
const JOB_SLOTS = new Map([
	["Timeout", "_onTimeout"],
	["Immediate", "_onImmediate"],
	["TickObject", "callback"],
	["Microtask", null]
]);

/**
 * Whether a job recorded in {@link JOB_CALLBACK} runs the function it was made with: a timer's, an immediate's or a
 * tick's slot still holds it, read as a data property (an accessor put there could answer Node and this check
 * differently); a microtask's scope is entered for the first time, as Node does once to run it.
 * @param {object} job - The job's async resource.
 * @returns {boolean} Whether it does.
 * @private
 */
function runsMadeCallback(job) {
	const made = WeakMapMethods.get(JOB_CALLBACK, job);
	if (made === undefined) return false;
	if (made.slot === null) return made.entries === 1;
	const slot = Objects.getOwnPropertyDescriptor(job, made.slot);
	return slot !== undefined && "value" in slot && slot.value === made.fn;
}

/**
 * Marks a {@link MADE_IN} entry of an `AsyncResource` code can enter itself.
 * @type {symbol}
 * @private
 */
const SCOPE = Symbol("slothlet.scope");

/**
 * The `enable()` and `disable()` of Node's async hooks, taken from the first hook slothlet makes (see
 * {@link AsyncContextManager#holdJobHook}), as the first instance on the async runtime starts, before any of its
 * modules' code runs: code can replace them on the hook's prototype later. Not taken as slothlet loads, since making a
 * hook there would call `createHook()` in a process whose instances all use the live runtime, which uses no async
 * hooks. Undefined until then; null where the platform has no `node:async_hooks` or the hook has no such methods.
 * @type {{enable: Function, disable: Function}|null|undefined}
 * @private
 */
let hookMethods = typeof createHook === "function" ? undefined : null;

/**
 * Read the `enable()` and `disable()` of a hook just made into {@link hookMethods}, once.
 * @param {object} hook - The hook `createHook()` made.
 * @returns {{enable: Function, disable: Function}|null} The methods, or null where the hook has none.
 * @private
 */
function takeHookMethods(hook) {
	if (hookMethods !== undefined) return hookMethods;
	const proto = Objects.getPrototypeOf(hook);
	// Node's hooks always carry both methods; the null arm is for a runtime whose async hooks are a partial stand-in.
	hookMethods =
		/* v8 ignore next */
		typeof proto?.enable === "function" && typeof proto.disable === "function" ? { enable: proto.enable, disable: proto.disable } : null;
	return hookMethods;
}

/**
 * How many async hooks telling jobs apart are installed (0 or 1): one while any instance on the async runtime exists,
 * whatever its permission mode (see {@link AsyncContextManager#initialize}).
 * @type {number}
 * @private
 */
let jobHooks = 0;

/**
 * How many async hooks telling jobs apart slothlet has installed and not yet removed.
 * @returns {number} The count.
 * @internal
 */
export function jobHookCount() {
	return jobHooks;
}

/**
 * What the suite puts in place of the install-time probe's answer (see {@link AsyncContextManager#holdScopeHook}):
 * `false` as on a Node that runs every async hook for a promise's job, or null for the probe's own answer.
 * @type {false|null}
 * @private
 */
let promiseProbeAnswer = null;

/**
 * Answer the install-time probe as a Node that runs every async hook for a promise's job does (`false`), so a promise's
 * job of a flow is told by walking the stack, or go back to the probe's own answer (`null`). For the suite, which runs
 * on a Node that leaves promises out. Only the slower of the two checks can be put in place: anything but `false`
 * restores the probe's answer.
 * @param {false|null} answer - The answer.
 * @returns {void}
 * @internal
 */
export function answerPromiseProbe(answer) {
	promiseProbeAnswer = answer === false ? false : null;
}

/**
 * What the install-time probe last found (see {@link AsyncContextManager#holdScopeHook}): whether Node leaves the
 * second async hook out of a promise's job, or null before any probe's job has run.
 * @type {boolean|null}
 * @private
 */
let promiseProbeFound = null;

/**
 * What the install-time probe last found: whether the Node running leaves the second async hook out of a promise's job
 * (`true`), runs it there (`false`), or null before any probe's job has run. For the suite, which checks the probe's own
 * answer against the Node it runs on.
 * @returns {boolean|null} The answer.
 * @internal
 */
export function promiseProbeResult() {
	return promiseProbeFound;
}

/**
 * What {@link SealedStorage} records for a callback run outside every store (`exit()`).
 * @type {object}
 * @private
 */
const NO_STORE = Objects.freeze(Objects.create(null));

/**
 * `AsyncLocalStorage` and the methods its instances inherit, taken as slothlet loads, before any module's code runs:
 * a module may replace them on the prototype later, and slothlet's storage never calls what it put there. Null where
 * the platform has no `node:async_hooks`.
 * @type {{Storage: Function, methods: Array<[string, Function]>}|null}
 * @private
 */
const STORAGE_METHODS = AsyncLocalStorage ? storageMethodsOf(AsyncLocalStorage) : null;

/**
 * Every method an instance of `Storage` inherits, nearest prototype first, by name.
 * @param {Function} Storage - The `AsyncLocalStorage` class.
 * @returns {{Storage: Function, methods: Array<[string, Function]>}} The class and its methods.
 * @private
 */
function storageMethodsOf(Storage) {
	const methods = new Map();
	for (let proto = Storage.prototype; proto && proto !== Objects.prototype; proto = Objects.getPrototypeOf(proto)) {
		for (let ofIndex = 0, ofList = Objects.getOwnPropertyNames(proto); ofIndex < ofList.length; ofIndex++) {
			const name = ofList[ofIndex];
			const descriptor = Objects.getOwnPropertyDescriptor(proto, name);
			if (name === "constructor" || typeof descriptor.value !== "function" || MapMethods.has(methods, name)) continue;
			MapMethods.set(methods, name, descriptor.value);
		}
	}
	return { Storage, methods: mapEntriesToArray(methods) };
}

/**
 * The token slothlet's storage holds for a store. Node keeps what a storage holds where module code can read it: on
 * async resources while `AsyncContextFrame` is off (Node 22, or a later Node run with `--no-async-context-frame`), under
 * a symbol `async_hooks.executionAsyncResource()`, a promise, or an `AsyncResource` lists; and, with frames on, in the
 * frame a new `AsyncResource` carries, which `Map.prototype.forEach` walks. A store carries the instance, its handlers
 * and the running node's wrapper, so the storage holds a token instead, with the store in a private field only this
 * class reads. One allocation per store run, and nothing for the collector to trace beyond the token itself.
 *
 * The prototype tokens inherit has no prototype and no `constructor`, and is frozen: code holding a token reaches
 * neither this class nor a way to make a token for a store of its own.
 * @private
 */
class StoreToken {
	#store;

	/**
	 * @param {object} store - The store the token stands for.
	 */
	constructor(store) {
		this.#store = store;
	}

	/**
	 * The store a token stands for. Anything else found in Node's storage (code that wrote the resource's slot itself)
	 * stands for no store.
	 * @param {*} token - What the storage holds.
	 * @returns {object|undefined} The store, or undefined.
	 */
	static storeOf(token) {
		return token !== null && typeof token === "object" && #store in token ? token.#store : undefined;
	}
}
Objects.setPrototypeOf(StoreToken.prototype, null);
Reflect.deleteProperty(StoreToken.prototype, "constructor");
Objects.freeze(StoreToken.prototype);

/**
 * The token that stands for `store` in Node's storage.
 * @param {*} store - The store.
 * @returns {*} Its token; `store` itself when it is not an object (no store).
 * @private
 */
function sealStore(store) {
	return store === null || typeof store !== "object" ? store : new StoreToken(store);
}

/**
 * The store a token Node's storage holds stands for (see {@link StoreToken.storeOf}).
 * @private
 */
const unsealStore = StoreToken.storeOf;

/**
 * Slothlet's `AsyncLocalStorage`, as {@link AsyncContextManager#als} hands it out: it takes and gives the stores
 * themselves, and holds a token for each in Node's storage (see {@link sealStore}). The Node storage carries the methods
 * taken as slothlet loaded as its own, so Node's code calling `this.getStore()` or `this.enterWith()` inside them runs
 * those, never what a module put on the prototype since.
 * @private
 */
class SealedStorage {
	#storage;
	// The stores this storage's `run()` entered whose callbacks are running now, innermost last: the code running inside
	// one synchronously was called by the code slothlet ran there.
	#entered = [];

	constructor() {
		const { Storage, methods } = STORAGE_METHODS;
		const storage = new Storage();
		for (let ofIndex = 0, ofList = methods; ofIndex < ofList.length; ofIndex++) {
			const entry = ofList[ofIndex];
			Objects.defineProperty(storage, entry[0], { __proto__: null, value: entry[1], writable: true, configurable: true });
		}
		this.#storage = storage;
	}

	/**
	 * @returns {object|undefined} The active store.
	 */
	getStore() {
		return unsealStore(this.#storage.getStore());
	}

	/**
	 * @param {*} store - The store.
	 * @param {Function} fn - The callback.
	 * @param {...*} args - Its arguments.
	 * @returns {*} What it returned.
	 */
	run(store, fn, ...args) {
		listPush(this.#entered, store);
		try {
			if (args.length === 0) return this.#storage.run(sealStore(store), fn);
			return Reflect.apply(this.#storage.run, this.#storage, concatLists([sealStore(store), fn], args));
		} finally {
			ArrayMethods.pop(this.#entered);
		}
	}

	/**
	 * The store the innermost `run()` running now entered, {@link NO_STORE} inside `exit()`, or undefined outside both.
	 * @returns {object|undefined} The store.
	 */
	entered() {
		const entered = this.#entered;
		return entered.length ? entered[entered.length - 1] : undefined;
	}

	/**
	 * @param {*} store - The store.
	 * @returns {void}
	 */
	enterWith(store) {
		return this.#storage.enterWith(sealStore(store));
	}

	/**
	 * Enter a store for the rest of the code running now, as `enterWith()` does, and say how to take it back off the async
	 * resource it was put on. While `AsyncContextFrame` is off Node keeps the store on the resource running now, which can
	 * be one its owner runs again later (an `AsyncResource`, an interval's timer); with frames on, the scope Node opened
	 * for the code ends where the code does, and nothing is left to take back.
	 * @param {object} store - The store.
	 * @returns {?function(): void} Puts back what the resource held, unless something has entered another store on
	 *   it since; null when nothing has to.
	 */
	enterAdopted(store) {
		const storage = this.#storage;
		const token = sealStore(store);
		const key = storage.kResourceStore;
		const resource = typeof key === "symbol" && executionAsyncResource !== null && resourceStoreKnown() ? executionAsyncResource() : null;
		if (resource === null || (typeof resource !== "object" && typeof resource !== "function")) {
			storage.enterWith(token);
			return null;
		}
		// Where Node keeps the storage's value for this resource depends on the Node (see `helpers/async-store-slot`):
		// on the resource itself, or in an object Node puts on it the first time a storage writes there.
		const before = resourceStoreHolder(resource);
		const had = before !== null && Objects.hasOwn(before, key);
		const previous = had ? before[key] : undefined;
		storage.enterWith(token);
		return () => {
			const holder = resourceStoreHolder(resource);
			if (holder === null || holder[key] !== token) return;
			if (had) holder[key] = previous;
			else delete holder[key];
		};
	}

	/**
	 * @param {Function} fn - The callback.
	 * @param {...*} args - Its arguments.
	 * @returns {*} What it returned.
	 */
	exit(fn, ...args) {
		listPush(this.#entered, NO_STORE);
		try {
			return Reflect.apply(this.#storage.exit, this.#storage, concatLists([fn], args));
		} finally {
			ArrayMethods.pop(this.#entered);
		}
	}

	/**
	 * @returns {void}
	 */
	disable() {
		return this.#storage.disable();
	}
}

/**
 * What {@link AsyncContextManager#als} answers before the manager has made its store: no store is active, a callback
 * run outside every store runs as it is, and running a store (`run`, `enterWith`) makes the real one first. Reading the
 * manager on the live runtime (the runtime dispatcher asks it whether a store is active) therefore makes no store: on
 * Node 22 one that has run switches async hooks on for the whole process.
 * @private
 */
class DormantStore {
	/**
	 * @param {AsyncContextManager} manager - The manager it stands in for.
	 */
	constructor(manager) {
		this.manager = manager;
	}

	/**
	 * @returns {undefined} No store is active before one has been made.
	 */
	getStore() {
		return undefined;
	}

	/**
	 * @param {*} store - The store.
	 * @param {Function} fn - The callback.
	 * @param {...*} args - Its arguments.
	 * @returns {*} What it returned.
	 */
	run(store, fn, ...args) {
		const storage = this.manager.openStore();
		return Reflect.apply(storage.run, storage, concatLists([store, fn], args));
	}

	/**
	 * @param {*} store - The store.
	 * @returns {void}
	 */
	enterWith(store) {
		return this.manager.openStore().enterWith(store);
	}

	/**
	 * @param {Function} fn - The callback.
	 * @param {...*} args - Its arguments.
	 * @returns {*} What it returned: no store is active, so it runs as it is.
	 */
	exit(fn, ...args) {
		return Reflect.apply(fn, null, args);
	}

	/**
	 * Nothing to switch off before a store has been made.
	 * @returns {void}
	 */
	disable() {}
}

/**
 * Whether a store is one code can enter by itself and act in as someone else: a call's flow, a `run()` / `scope()`
 * flow, or the store of a file's load once the file's module is known (a resource, a snapshot or a timer the file made
 * while it loaded carries it). The instance's own store, and a load whose module is not known yet (whose code is no
 * one's), are not.
 * @param {object} store - The store.
 * @returns {boolean} True for such a store.
 * @private
 */
function isFlow(store) {
	if (store.moduleLoad) return !!store.currentWrapper;
	return !!(store.currentWrapper || store.record || store.parentInstanceID);
}

/**
 * The ID of the instance a store belongs to, as the instance is now. A store names its instance by ID
 * (`parentInstanceID` for a `run()` / `scope()` store, `instanceID` for the instance's own), and a call's store is a copy
 * of the store it was made in. A full reload gives the instance a new ID, so a store made before it (a call in flight, a
 * finished run's late work, a copy of either) still names the old one: it belongs to the instance it was made for, which
 * it holds as `slothlet`, under the ID that instance has now.
 * @param {object} store - The store.
 * @returns {string|null|undefined} The instance's ID.
 * @private
 */
function storeInstanceID(store) {
	const owner = store.slothlet;
	if (owner !== null && typeof owner === "object" && typeof owner.instanceID === "string") return owner.instanceID;
	return store.parentInstanceID ?? store.instanceID;
}

/**
 * AsyncLocalStorage-based context manager for async runtime
 * Uses ALS for full context isolation across async operations
 * @public
 */
export class AsyncContextManager {
	constructor() {
		// The store is made when an instance on the async runtime is created ({@link AsyncContextManager#openStore}), not
		// here: a module-level singleton makes this manager in every host, also where only the live runtime is used.
		this.store = null;
		// Null in a browser (AsyncLocalStorage gated out), where `als` is null too.
		this.dormant = AsyncLocalStorage ? new DormantStore(this) : null;
		this.instances = new Map(); // instanceID → context data
	}

	/**
	 * Whether the flow's code is being told apart now (see {@link AsyncContextManager#activeStore}): the frame placement
	 * that does it reads the manager too, and gets the store as it is.
	 * @type {boolean}
	 */
	#telling = false;

	/**
	 * A storage of slothlet's own that marks the stretch of synchronous code the flow's code was last told in (see
	 * {@link AsyncContextManager#activeStore}): a value entered there is seen until the stretch ends, by nothing that ran
	 * before it, and by nothing a resource made earlier puts in place.
	 * @type {SealedStorage|null}
	 */
	#witness = null;

	/**
	 * The store the flow's code was last told in, and the mark entered then; cleared once the stretch ends.
	 * @type {{store: object, mark: object}|null}
	 */
	#told = null;

	/**
	 * The stand-in stores handed to code that entered a flow by itself, by the flow's store and the leaf the code is.
	 * @type {WeakMap<object, Map<object|null, object>>}
	 */
	#outsideViews = new WeakMap();

	/**
	 * How many instances live on this runtime: the async hook that tells jobs apart (see
	 * {@link AsyncContextManager#holdJobHook}) is installed while any does, in every permission mode.
	 * @type {number}
	 */
	#jobHookInstances = 0;

	/**
	 * The installed async hook, or null.
	 * @type {object|null}
	 */
	#jobHook = null;

	/**
	 * The async hook that tells when any other resource a run made is destroyed (a timer fired or cleared, an immediate,
	 * a `nextTick`, a microtask or a Node callback run, a listener's resource taken off its emitter). Enabled only while
	 * such a resource is counted: while any destroy hook exists, Node also tracks every promise for collection, which
	 * would cost every promise in the process. Null until first needed.
	 * @type {object|null}
	 */
	#destroyHook = null;

	/**
	 * How many counted resources that are not promises are pending: {@link AsyncContextManager#destroyHook} is enabled
	 * while any is.
	 * @type {number}
	 */
	#pendingResources = 0;

	/**
	 * Whether {@link AsyncContextManager#destroyHook} is enabled.
	 * @type {boolean}
	 */
	#watchingDestroy = false;

	/**
	 * Whether a run's work is counted (see `watchRuns` in `helpers/flow-stores`): the job hook then counts each resource
	 * a run makes, and tells when a promise it made is resolved.
	 * @type {boolean}
	 */
	#countingWork = false;

	/**
	 * Each counted resource's async id, with the record of the run it was made in (see
	 * {@link AsyncContextManager#countWork}).
	 * @type {Map<number, object>}
	 */
	#work = new Map();

	/**
	 * Tells {@link AsyncContextManager#workDone} when a counted promise is collected before it was resolved: nothing can
	 * resolve it then, so nothing it would run can run. Holds the promise's async id; one resolved first has already
	 * left {@link AsyncContextManager#work}, so its collection does nothing.
	 * @type {FinalizationRegistry<number>}
	 */
	#collectedPromises = new FinalizationRegistry((asyncId) => this.#workDone(asyncId));

	/**
	 * Whether the manager watches runs (see `watchRuns` in `helpers/flow-stores`).
	 * @type {boolean}
	 */
	#watchingRuns = false;

	/**
	 * Whether any resource has been marked in {@link OUTSIDE_JOBS} since the hook was installed: until one is, a callback
	 * Node runs looks nothing up.
	 * @type {boolean}
	 */
	#jobsMarked = false;

	/**
	 * The resources whose callbacks are running now, innermost last (see {@link AsyncContextManager#flowJobBelow}).
	 * @type {Array<object>}
	 */
	#jobStack = jobStackList();

	/**
	 * The marked resources whose callbacks are running now, innermost last, each with its stand-in store.
	 * @type {Array<{resource: object, view: object}>}
	 */
	#runningJobs = [];

	/**
	 * Whether the code running is being told as it makes an async resource (see {@link AsyncContextManager#jobMade}).
	 * @type {boolean}
	 */
	#making = false;

	/**
	 * Counts the callbacks Node starts and ends: the stretch of synchronous code running now is the one the last
	 * {@link AsyncContextManager#lastTold} was read in while the count is unchanged.
	 * @type {number}
	 */
	#stretch = 0;

	/**
	 * What the last stretch told at a resource's making was told: its count, the store running, and the stand-in store
	 * (or the store itself, for the flow's code).
	 * @type {{stretch: number, store: object, active: object|undefined}|null}
	 */
	#lastTold = null;

	/**
	 * The instances that have shut down (see {@link AsyncContextManager#cleanup}).
	 * @type {WeakMap<object, true>}
	 * @private
	 */
	#ended = new WeakMap();

	/**
	 * Whether a store belongs to an instance that has shut down and has no context under its ID now (an instance
	 * reloaded after a shutdown has one again).
	 * @param {object} store - A context store.
	 * @returns {boolean} True when it does.
	 * @private
	 */
	#ofEndedInstance(store) {
		const owner = store.slothlet;
		if (owner === null || typeof owner !== "object" || !WeakMapMethods.has(this.#ended, owner)) return false;
		return !MapMethods.has(this.instances, storeInstanceID(store));
	}

	/**
	 * The store the code running now acts in. Node's async context gives a flow's store to any code holding an async
	 * resource of that flow (an `AsyncResource`, a function `AsyncLocalStorage.snapshot()` or `bind()` made there, the
	 * context a timer keeps, copied onto a timer of its own), so a module could run its own code in another call's flow,
	 * or in a `run()` / `scope()` the host opened, and act there with that flow's context and identity. Code slothlet runs
	 * inside the store it entered, and anything that code calls, is the flow's. Elsewhere (code that picked up after an
	 * `await`, a timer, a resource's scope) the frames tell whose code it is (see `runningOutsideFlow` in
	 * `handlers/frame-placement`): a module's code that is not the flow's acts outside the flow, as the leaf it is,
	 * with the instance's own context (see {@link AsyncContextManager#outsideView}). The host's code is the flow's
	 * wherever it runs.
	 * @returns {object|undefined} The store.
	 * @internal
	 */
	activeStore() {
		const store = this.als.getStore();
		// Code still running in a flow of an instance that has shut down (a timer, a listener, a promise chain its code
		// left behind) runs in no store, as it does on the live runtime, whose stores go with the instance.
		if (store !== undefined && store !== null && this.#ofEndedInstance(store)) return undefined;
		if (store === undefined || this.#telling || this.store === null) return store;
		if (this.store.entered() === store) return store;
		// Code that entered a flow by itself put the rest of its run outside the flow: told again against that flow.
		const outsideOf = store[FLOW_OF];
		if (outsideOf !== undefined) return this.#stillOutside(store, outsideOf);
		// Only a call's flow, a `run()` / `scope()` flow, or the store of a file's load once its module is known carries
		// anything of another's (a resource, a snapshot or a timer someone else can enter).
		if (!isFlow(store)) return store;
		// A callback of a job code that entered a flow by itself handed Node: it is that code's, wherever Node runs it.
		const jobs = this.#runningJobs;
		if (jobs.length !== 0) return this.#inOutsideJob(jobs[jobs.length - 1].view, store);
		// Inside an async resource's scope the flow was put in place by whoever called it: told every time.
		const resource = executionAsyncResource?.();
		const scoped = AsyncResource !== null && inheritsFrom(resource, AsyncResource);
		// The job of a promise, a timer, an immediate, a tick or a microtask the flow's own code made (code it called that
		// awaits, a reaction it registered, a function it handed `setTimeout()`) carries on that code: the flow's, with
		// nothing of the flow's on the stack. Known while the async hook runs. The scope of any other `AsyncResource` is
		// never one (see MADE_IN).
		if (this.#jobHook !== null && this.#ownContinuation(resource, store) && this.#begunByNode(resource)) return store;
		const told = this.#told;
		if (!scoped && told !== null && told.store === store && this.#witness.getStore() === told.mark) return store;
		const instanceID = storeInstanceID(store);
		this.#telling = true;
		let answer;
		try {
			answer = runningOutsideFlow(instanceID, this.#ownersOf(store), this.#making);
		} finally {
			this.#telling = false;
		}
		if (answer === null) return store;
		// A function bound to a resource of the flow, which the flow's own code handed Node: the flow, as the bind meant.
		if (answer.outside && answer.begun && scoped && this.#jobHook !== null && this.#flowJobBelow(resource, store)) return store;
		if (answer.outside) {
			const view = this.outsideView(store, instanceID, answer.reader);
			if (view !== undefined) this.#adopt(view);
			return view;
		}
		// Every frame of this stretch is the flow's: the rest of the stretch is told by the mark, until it ends. Code queued
		// before now never sees the mark, and the clearing runs before anything queued after it.
		if (answer.clean && !scoped) {
			const mark = Objects.freeze(Objects.create(null));
			this.#witness.enterWith(mark);
			this.#told = { store, mark };
			queueMicrotask(() => {
				if (this.#told?.mark === mark) this.#told = null;
			});
		}
		return store;
	}

	/**
	 * Whether the job running now is one the flow's own code made in `store` and handed Node: a promise's (see
	 * {@link PromiseFlow}), or a timer, an immediate, a `process.nextTick()` job or a microtask that still runs the
	 * function it was made with (see {@link JOB_CALLBACK}). Such a job runs what the flow chose to have Node run then,
	 * as it would call it itself; one made by code that entered the flow by itself is marked in {@link OUTSIDE_JOBS}.
	 * @param {object|undefined} resource - The async resource running now.
	 * @param {object} store - The flow running now.
	 * @returns {boolean} Whether it is.
	 * @private
	 */
	#ownContinuation(resource, store) {
		if (resource === null || typeof resource !== "object") return false;
		// Its callback is the one running: a resource whose scope was put in place without an async hook's `before` (a
		// promise put on Node's async id stack by hand) runs nothing Node began.
		const stack = this.#jobStack;
		if (stack.length === 0 || stack[stack.length - 1] !== resource) return false;
		const flow = PromiseFlow.of(resource);
		if (flow !== undefined) return flow === store && !WeakMapMethods.has(OUTSIDE_JOBS, resource);
		if (WeakMapMethods.get(MADE_IN, resource) !== store || WeakMapMethods.has(OUTSIDE_JOBS, resource)) return false;
		return runsMadeCallback(resource);
	}

	/**
	 * The stretch {@link AsyncContextManager#begunByNode} last read the stack in, the resource it read it for, and what
	 * it found.
	 * @type {{stretch: number, resource: object|null, byNode: boolean}}
	 */
	#entry = { stretch: -1, resource: null, byNode: false };

	/**
	 * The second async hook (see {@link AsyncContextManager#holdScopeHook}), or null.
	 * @type {object|null}
	 */
	#scopeHook = null;

	/**
	 * Whether Node leaves the second hook out of a promise's job: unknown (null) until the probe promise's job has run.
	 * @type {boolean|null}
	 */
	#promiseJobsLeftOut = null;

	/**
	 * The async id of the callback the second hook last saw begin (see {@link AsyncContextManager#holdScopeHook}): the
	 * probe promise's job compares it with its own.
	 * @type {number}
	 */
	#scopeHookSaw = -1;

	/**
	 * The promise of the flow's whose scope code put in place through `runInAsyncScope()` while no other callback ran
	 * below it, until that scope ends.
	 * @type {object|null}
	 */
	#scriptBegun = null;

	/**
	 * Whether Node itself began the job of `resource` (see {@link AsyncContextManager#ownContinuation}) that is running
	 * now. A promise's or a `process.nextTick()` job's scope can also be put in place by code holding the object, through
	 * `AsyncResource.prototype.runInAsyncScope.call(job, fn)`: its own `fn` would then run as the flow's continuation.
	 * Node begins either job with no other callback running below it (a promise's from the microtask queue, a tick's from
	 * the tick queue). It begins a tick's job once, before anyone can get hold of the tick object inside it. It begins a
	 * promise's job without running async hooks that leave promises out, which `runInAsyncScope()` runs (see
	 * {@link AsyncContextManager#holdScopeHook}); where Node does not leave them out, the stack is walked instead, once
	 * per stretch of synchronous code (see `scopeEnteredByCode` in `handlers/frame-placement`). A timer's, an immediate's
	 * and a microtask's job need none of this: code cannot enter a timer's or an immediate's scope, and only the first
	 * entry of a microtask's counts (see {@link runsMadeCallback}).
	 * @param {object} resource - The job's async resource.
	 * @returns {boolean} Whether Node began it.
	 * @private
	 */
	#begunByNode(resource) {
		const made = WeakMapMethods.get(JOB_CALLBACK, resource);
		if (made !== undefined && made.slot !== "callback") return true;
		if (this.#jobStack.length !== 1) return false;
		if (made !== undefined) return made.entries === 1;
		// The suite's stand-in answer (`false`, see answerPromiseProbe) turns this check off; otherwise the probe's own.
		if (promiseProbeAnswer !== false && this.#promiseJobsLeftOut === true) return this.#scriptBegun !== resource;
		// Node runs every hook for a promise's job (Node 22.15, Node 24.0, or any Node before the probe's job has run):
		// what put the scope in place is on the stack.
		const entry = this.#entry;
		if (entry.stretch === this.#stretch && entry.resource === resource) return entry.byNode;
		let byNode;
		this.#telling = true;
		try {
			byNode = !scopeEnteredByCode();
		} finally {
			this.#telling = false;
		}
		entry.stretch = this.#stretch;
		entry.resource = resource;
		entry.byNode = byNode;
		return byNode;
	}

	/**
	 * Install the second async hook, which Node is asked to leave out of promise jobs (`trackPromises: false`, or the
	 * hook's own marker for that on a Node whose `createHook()` takes no such option): it then runs only where a promise's
	 * scope is put in place by code, through `runInAsyncScope()` (see {@link AsyncContextManager#scriptBegins}). Whether
	 * Node does leave it out is told by the job of a promise made here, before which every promise's job is told by its
	 * stack (see {@link AsyncContextManager#begunByNode}).
	 * @returns {void}
	 * @private
	 */
	#holdScopeHook() {
		const manager = this;
		const hook = createHook({
			before(asyncId) {
				manager.#scopeHookSaw = asyncId;
				manager.#scriptBegins();
			},
			trackPromises: false
		});
		// Node 22 releases whose `createHook()` takes no `trackPromises` still honour the marker it sets.
		const marker = ArrayMethods.find(Objects.getOwnPropertySymbols(hook), (symbol) => symbol.description === "kNoPromiseHook");
		// A Node without the marker: the probe below finds promise jobs not left out, and they are told by their stack.
		/* v8 ignore next */
		if (marker !== undefined) hook[marker] = true;
		Reflect.apply(hookMethods.enable, hook, []);
		this.#scopeHook = hook;
		this.#promiseJobsLeftOut = null;
		this.#scopeHookSaw = -1;
		// The reaction runs as the job of the promise the engine's `then` makes (not the one `nativeThen()` hands back):
		// the second hook saw that job begin exactly when its async id is the one running the reaction.
		nativeThen(Promises.resolve(), () => {
			promiseProbeFound = this.#promiseJobsLeftOut = this.#scopeHookSaw !== executionAsyncId();
		});
	}

	/**
	 * The store code acts in inside a callback of a job that code which entered a flow by itself handed Node (see
	 * {@link OUTSIDE_JOBS}): outside the flow running there, as the leaf that code was, unless the frames tell the flow's
	 * own code (see {@link AsyncContextManager#stillOutside}).
	 * @param {object} view - The stand-in store the job was made in.
	 * @param {object} store - The flow running now.
	 * @returns {object|undefined} The store.
	 * @private
	 */
	#inOutsideJob(view, store) {
		if (view[FLOW_OF] === store) return this.#stillOutside(view, store);
		const instanceID = storeInstanceID(store);
		const sameInstance = storeInstanceID(view) === instanceID;
		const other = this.outsideView(store, instanceID, sameInstance ? view.currentWrapper : null);
		return other === undefined ? store : this.#stillOutside(other, store);
	}

	/**
	 * Count an instance, installing the async hook that tells jobs apart for the first: a job (a promise's reaction, a
	 * timer, an immediate, a microtask, an `AsyncResource`'s scope) made by code that entered a flow by itself runs
	 * outside that flow, even when that code never touched slothlet there, and one the flow's own code made keeps the
	 * flow. A `run()` / `scope()` is isolated in every permission mode, so every instance counts. Outside every flow `init`
	 * returns at once, and `before` / `after` only keep the stack of running callbacks.
	 * @returns {void}
	 * @internal
	 */
	holdJobHook() {
		this.#jobHookInstances++;
		countAsyncInstance(1);
		if (this.#jobHook !== null || hookMethods === null) return;
		const manager = this;
		let hook;
		try {
			hook = createHook({
				init(asyncId, type, triggerAsyncId, resource) {
					if (manager.#countingWork) manager.#countWork(asyncId, type, resource);
					if (trustedRootOwn.ACTING_FOR.length !== 0) {
						WeakMapMethods.set(JOB_ACTING_FOR, resource, trustedRootOwn.actingForNow());
						jobActingForFilled = true;
					}
					manager.#jobMade(resource, type);
				},
				before() {
					manager.#stretch++;
					const resource = currentJobResource();
					manager.#jobBegins(resource);
					if (manager.#jobsMarked) manager.#jobStarts(resource);
					manager.#actingJobBegins(resource);
				},
				after() {
					manager.#stretch++;
					const resource =
						manager.#actingJobs.length !== 0 || manager.#runningJobs.length !== 0 || manager.#jobStack.length !== 0
							? currentJobResource()
							: NO_JOB_RESOURCE;
					manager.#actingJobEnds(resource);
					if (manager.#runningJobs.length !== 0) manager.#jobEnds(resource);
					manager.#jobFinishes(resource);
				},
				// Part of this hook rather than one enabled while a run is live: Node's `enable()` and `disable()` add the hook
				// to an array of its own, through any index setter module code has put on `Array.prototype` by then.
				promiseResolve(asyncId) {
					if (manager.#countingWork) manager.#workDone(asyncId);
				}
			});
			/* v8 ignore start */
		} catch {
			// A platform whose async hooks cannot be made (a runtime that ships `createHook` as a stub that throws) tells no
			// jobs apart: code that never touches slothlet there is not told. Node always makes one, so the suite cannot
			// reach this.
			hookMethods = null;
			return;
		}
		/* v8 ignore stop */
		const methods = takeHookMethods(hook);
		// A hook with no `enable` / `disable` (a runtime whose async hooks are a partial stand-in) tells no jobs apart. It
		// can happen outside Node; Node's hooks always have both, so the suite cannot reach this.
		/* v8 ignore next */
		if (methods === null) return;
		Reflect.apply(methods.enable, hook, []);
		this.#jobHook = hook;
		jobHooks++;
		this.#holdScopeHook();
		if (!this.#watchingRuns) {
			this.#watchingRuns = true;
			watchRuns((live) => this.#countRunWork(live));
		} else if (runCopyCounts().runs !== 0) this.#countRunWork(true);
	}

	/**
	 * Start counting the work runs begin, while any run is live, and stop once none is (see `watchRuns` in
	 * `helpers/flow-stores`): every resource made in a run's store is counted until it is destroyed, and every promise
	 * until it is resolved.
	 * @param {boolean} live - Whether a run is live.
	 * @returns {void}
	 * @private
	 */
	#countRunWork(live) {
		if (!live) {
			this.#stopCounting();
			return;
		}
		if (this.#countingWork || this.#jobHook === null) return;
		this.#countingWork = true;
	}

	/**
	 * Stop counting runs' work: no run is live, or the async hooks go.
	 * @returns {void}
	 * @private
	 */
	#stopCounting() {
		if (!this.#countingWork) return;
		this.#countingWork = false;
		MapMethods.clear(this.#work);
		this.#pendingResources = 0;
		if (this.#watchingDestroy) {
			this.#watchingDestroy = false;
			Reflect.apply(hookMethods.disable, this.#destroyHook, []);
		}
	}

	/**
	 * Count a resource made in a `run()` / `scope()` store as work of that run (see `holdRunWork` in
	 * `helpers/flow-stores`).
	 * @param {number} asyncId - The resource's async id.
	 * @param {string} type - The resource's type.
	 * @param {object} resource - The resource.
	 * @returns {void}
	 * @private
	 */
	#countWork(asyncId, type, resource) {
		// A resource that only carries a store into a callback is no one's work (an observer counts from its observe()).
		if (type === UNCOUNTED_RESOURCE) return;
		// An `AsyncResource` someone made (the host, a module, a library, or `AsyncLocalStorage.snapshot()` / `bind()` for
		// them) only carries the run's flow into code run with it later, and is no work of the run, as on the live runtime:
		// the run's copy does not wait for it to be collected. Code run through it later keeps the run's context. The
		// resources slothlet makes for a listener or an observer of the run are its work until they are destroyed.
		if (
			AsyncResource !== null &&
			FunctionMethods.call(PrototypeFunctions.Function.hasInstance, AsyncResource, resource) &&
			!StringMethods.startsWith(type, "slothlet-")
		)
			return;
		const record = this.store?.getStore()?.[RUN_COPY];
		if (record === undefined || !holdRunWork(record)) return;
		const promise = type === "PROMISE";
		MapMethods.set(this.#work, asyncId, promise ? record : { record });
		// A promise is done once it is resolved, or once it is collected unresolved. The destroy hook would tell the
		// latter too, but only at the cost of tracking every promise in the process.
		if (promise) FinalizationRegistryMethods.register(this.#collectedPromises, resource, asyncId);
		if (promise || this.#pendingResources++ !== 0 || this.#watchingDestroy) return;
		const manager = this;
		this.#destroyHook ??= createHook({
			destroy(id) {
				manager.#workDone(id);
			}
		});
		Reflect.apply(hookMethods.enable, this.#destroyHook, []);
		this.#watchingDestroy = true;
	}

	/**
	 * A counted resource is done: destroyed, or a promise resolved or collected.
	 * @param {number} asyncId - Its async id.
	 * @returns {void}
	 * @private
	 */
	#workDone(asyncId) {
		const entry = MapMethods.get(this.#work, asyncId);
		if (entry === undefined) return;
		MapMethods.delete(this.#work, asyncId);
		if (entry.record === undefined) {
			releaseRunWork(entry);
			return;
		}
		// The last pending resource that is no promise: the destroy hook goes once nothing more is made meanwhile.
		if (--this.#pendingResources === 0) {
			whenIdle(() => {
				if (this.#pendingResources !== 0 || !this.#watchingDestroy) return;
				this.#watchingDestroy = false;
				Reflect.apply(hookMethods.disable, this.#destroyHook, []);
			});
		}
		releaseRunWork(entry.record);
	}

	/**
	 * Uncount an instance, removing the async hook after the last.
	 * @returns {void}
	 * @internal
	 */
	releaseJobHook() {
		countAsyncInstance(-1);
		if (--this.#jobHookInstances > 0 || this.#jobHook === null) return;
		const hook = this.#jobHook;
		this.#jobHook = null;
		this.#jobsMarked = false;
		this.#runningJobs = [];
		this.#jobStack = jobStackList();
		this.#lastTold = null;
		this.#entry = { stretch: -1, resource: null, byNode: false };
		this.#scriptBegun = null;
		this.#promiseJobsLeftOut = null;
		const scopeHook = this.#scopeHook;
		this.#scopeHook = null;
		this.#stopCounting();
		jobHooks--;
		Reflect.apply(hookMethods.disable, hook, []);
		if (scopeHook !== null) Reflect.apply(hookMethods.disable, scopeHook, []);
	}

	/**
	 * A resource is made: marked when the code making it entered a flow by itself (see {@link OUTSIDE_JOBS}), or runs in
	 * a callback of a job such code made. Anything else (no flow running, slothlet's own code, the flow's code) is left
	 * alone. A hook that throws ends the process, so nothing escapes it.
	 * @param {object} resource - The resource.
	 * @param {string} type - Its type, as Node names it.
	 * @returns {void}
	 * @private
	 */
	#jobMade(resource, type) {
		try {
			if (this.store === null) return;
			const store = this.store.getStore();
			// Inside a job such code made, what it makes in the flow it stood outside of (or in its stand-in) is its too;
			// a call slothlet enters there is that call's.
			const jobs = this.#runningJobs;
			if (jobs.length !== 0) {
				const view = jobs[jobs.length - 1].view;
				if (store === view || store === view[FLOW_OF]) WeakMapMethods.set(OUTSIDE_JOBS, resource, view);
				return;
			}
			if (this.#telling) return;
			if (store === undefined || store[FLOW_OF] !== undefined) return;
			// A file's load whose module is not known yet is no flow to tell code in, but what its code makes there is the
			// load's own: recorded, so its callback is the load's continuation once the module is known (a lazy node's file
			// loads before its node takes it).
			const flow = isFlow(store);
			if (!flow && !store.moduleLoad) return;
			if (!MapMethods.has(this.instances, storeInstanceID(store))) return;
			// Recorded for the resource's own callback: the store it is made in, or a scope anyone can enter.
			if (type === "PROMISE") new PromiseFlow(resource, store);
			else {
				const scope = type !== "Microtask" && AsyncResource !== null && inheritsFrom(resource, AsyncResource);
				WeakMapMethods.set(MADE_IN, resource, scope ? { __proto__: null, [SCOPE]: store } : store);
				if (MapMethods.has(JOB_SLOTS, type)) {
					const slot = MapMethods.get(JOB_SLOTS, type);
					WeakMapMethods.set(JOB_CALLBACK, resource, { slot, fn: slot === null ? null : resource[slot], entries: 0 });
				}
			}
			if (!flow || this.store.entered() === store) return;
			// The code running now runs in the store its callback was made in: the flow's own continuation (an await, a
			// timer, a reaction). Anything else (a scope entered, a snapshot, a timer given another's context) is told.
			const current = executionAsyncResource();
			if (PromiseFlow.of(current) === store || WeakMapMethods.get(MADE_IN, current) === store) return;
			const last = this.#lastTold;
			let active;
			if (last !== null && last.stretch === this.#stretch && last.store === store) active = last.active;
			else {
				this.#making = true;
				try {
					active = this.activeStore();
				} finally {
					this.#making = false;
				}
				this.#lastTold = { stretch: this.#stretch, store, active };
			}
			if (active !== undefined && active !== store && active[FLOW_OF] !== undefined) {
				WeakMapMethods.set(OUTSIDE_JOBS, resource, active);
				this.#jobsMarked = true;
			}
		} catch {
			// The resource is left unmarked: its callback is told as before, by its frames when it touches slothlet.
		}
	}

	/**
	 * The jobs running now that run for modules ({@link JOB_ACTING_FOR}), innermost last, with how long `ACTING_FOR` was
	 * before each began.
	 * @type {Array<{resource: object, base: number}>}
	 */
	#actingJobs = [];

	/**
	 * A resource's callback starts: one made while a function another module handed over ran for that module runs for
	 * it too, until it ends.
	 * @param {object} resource - The resource whose callback starts (see {@link currentJobResource}).
	 * @returns {void}
	 * @private
	 */
	#actingJobBegins(resource) {
		if (!jobActingForFilled || resource === NO_JOB_RESOURCE || resource === undefined || resource === null) return;
		try {
			const acting = WeakMapMethods.get(JOB_ACTING_FOR, resource);
			if (acting === undefined) return;
			const stack = trustedRootOwn.ACTING_FOR;
			listPush(this.#actingJobs, { resource, base: stack.length });
			for (let i = 0; i < acting.length; i++) listPush(stack, acting[i]);
		} catch {
			// Not pushed: what the callback writes is decided for the module executing alone.
		}
	}

	/**
	 * A resource's callback ends: what {@link AsyncContextManager#actingJobBegins} pushed for it is taken off again.
	 * @param {object} resource - The resource whose callback ends (see {@link currentJobResource}).
	 * @returns {void}
	 * @private
	 */
	#actingJobEnds(resource) {
		const jobs = this.#actingJobs;
		if (jobs.length === 0 || jobs[jobs.length - 1].resource !== resource) return;
		const { base } = ArrayMethods.pop(jobs);
		const stack = trustedRootOwn.ACTING_FOR;
		while (stack.length > base) ArrayMethods.pop(stack);
	}

	/**
	 * A resource's callback starts: kept on {@link AsyncContextManager#jobStack} until it ends.
	 * @param {object} resource - The resource whose callback starts (see {@link currentJobResource}).
	 * @returns {void}
	 * @private
	 */
	#jobBegins(resource) {
		if (resource === NO_JOB_RESOURCE) return;
		try {
			const stack = this.#jobStack;
			stack[stack.length] = resource;
			const made = WeakMapMethods.get(JOB_CALLBACK, resource);
			if (made !== undefined && (made.slot === null || made.slot === "callback")) made.entries++;
		} catch {
			// Not kept: a scope it begins is told by its frames alone.
		}
	}

	/**
	 * A resource's callback ends. Node calls `after` for every `before`, so the innermost entry is its own.
	 * @param {object} resource - The resource whose callback ends (see {@link currentJobResource}).
	 * @returns {void}
	 * @private
	 */
	#jobFinishes(resource) {
		const stack = this.#jobStack;
		if (stack.length !== 0 && stack[stack.length - 1] === resource) {
			if (stack[stack.length - 1] === this.#scriptBegun) this.#scriptBegun = null;
			stack.length--;
		}
	}

	/**
	 * A callback that is no promise's job begins (the hook of {@link AsyncContextManager#holdScopeHook}, which Node does
	 * not run for a promise's job): when the resource put in place is a promise the flow's code made, code put it there
	 * through `runInAsyncScope()`.
	 * @returns {void}
	 * @private
	 */
	#scriptBegins() {
		const resource = executionAsyncResource();
		// Kept only for the outermost callback (the async hook that keeps the stack runs first): a scope entered inside it
		// is not taken for a job Node began anyway.
		if (this.#jobStack.length === 1 && this.#jobStack[0] === resource && PromiseFlow.of(resource) !== undefined)
			this.#scriptBegun = resource;
	}

	/**
	 * Whether the async resource scope running now (`resource`, put in place by Node as it began a job: a function bound
	 * to the resource that Node was handed) was handed to Node by the flow's own code in `store`: the job Node began it
	 * from is a promise, a timer, an immediate or a microtask made in that store by the flow's code (unmarked in
	 * {@link OUTSIDE_JOBS}), and still runs the function it was made with. The flow chose to have Node run the bound
	 * function then, as it would call it itself. A module that binds a resource of the flow and hands that to Node from
	 * its own flow, or from inside the flow it entered by itself, makes the job elsewhere or marked.
	 * @param {object} resource - The async resource whose scope is running.
	 * @param {object} store - The flow running now.
	 * @returns {boolean} Whether the flow handed the job to Node.
	 * @private
	 */
	#flowJobBelow(resource, store) {
		const stack = this.#jobStack;
		let index = stack.length - 1;
		if (index >= 0 && stack[index] === resource) index--;
		const job = index >= 0 ? stack[index] : undefined;
		if (job === null || typeof job !== "object" || WeakMapMethods.has(OUTSIDE_JOBS, job)) return false;
		if (PromiseFlow.of(job) === store) return true;
		if (WeakMapMethods.get(MADE_IN, job) !== store) return false;
		return runsMadeCallback(job);
	}

	/**
	 * A resource's callback starts: a marked one runs as the code that made it (see {@link AsyncContextManager#activeStore}).
	 * @param {object} resource - The resource whose callback starts (see {@link currentJobResource}).
	 * @returns {void}
	 * @private
	 */
	#jobStarts(resource) {
		if (resource === NO_JOB_RESOURCE) return;
		try {
			const view = WeakMapMethods.get(OUTSIDE_JOBS, resource);
			if (view !== undefined) listPush(this.#runningJobs, { resource, view });
		} catch {
			// Nothing to track: the callback is told by its frames.
		}
	}

	/**
	 * A resource's callback ends. Node calls `after` for every `before`, also when the callback threw and the error was
	 * handled, so the innermost marked job ends with its own `after`.
	 * @param {object} resource - The resource whose callback ends (see {@link currentJobResource}).
	 * @returns {void}
	 * @private
	 */
	#jobEnds(resource) {
		try {
			const jobs = this.#runningJobs;
			if (jobs[jobs.length - 1].resource === resource) ArrayMethods.pop(jobs);
		} catch {
			// Left as it is: the next `after` of that job takes it off.
		}
	}

	/**
	 * Put the rest of the code running now, and everything it hands Node to run later (a promise's `then()`, a timer, an
	 * `await`), outside the flow it entered by itself: a job it schedules runs with nothing of its own on the stack, the
	 * shape of a job the flow's own code handed Node, so it has to carry the stand-in store from where it was made. While
	 * `AsyncContextFrame` is off the store is put on the async resource running now, and taken back off it once this
	 * stretch of synchronous code ends, so the resource's owner running it again later runs in its own flow.
	 * @param {object} view - The stand-in store (see {@link AsyncContextManager#outsideView}).
	 * @returns {void}
	 * @private
	 */
	#adopt(view) {
		const restore = this.store.enterAdopted(view);
		if (restore !== null) queueMicrotask(restore);
	}

	/**
	 * The store code acts in where code that entered a flow by itself put a stand-in store (see
	 * {@link AsyncContextManager#activeStore}): told by the frames against the flow it stands outside of. Code of anyone else's
	 * stays outside, as the leaf it is; the flow's own code (the host's code the module's code calls, a resource of the
	 * flow's its owner runs again in the same stretch) acts in the flow; and code with nothing of anyone's on the stack (a
	 * job the module's code handed Node, an api node called by Node) stays in the stand-in.
	 * @param {object} view - The stand-in store.
	 * @param {object} flow - The flow it stands outside of.
	 * @returns {object|undefined} The store.
	 * @private
	 */
	#stillOutside(view, flow) {
		const instanceID = storeInstanceID(flow);
		this.#telling = true;
		let answer;
		try {
			answer = runningOutsideFlow(instanceID, this.#ownersOf(flow));
		} finally {
			this.#telling = false;
		}
		if (answer === null) return view;
		if (answer.outside) return answer.reader === view.currentWrapper ? view : this.outsideView(flow, instanceID, answer.reader);
		return answer.found ? flow : view;
	}

	/**
	 * The calls a flow belongs to: the call its store names, the calls above it, and the call that made it.
	 * @param {object} store - The flow's store.
	 * @returns {Array<object>} Their wrappers.
	 * @private
	 */
	#ownersOf(store) {
		const owners = [];
		const add = (wrapper) => {
			if (wrapper && !ArrayMethods.includes(owners, wrapper)) listPush(owners, wrapper);
		};
		add(store.currentWrapper);
		add(store.callerWrapper);
		for (let record = store.record, depth = 0; record && depth < 64; record = record.parent, depth++) add(record.wrapper);
		return owners;
	}

	/**
	 * The store code that entered a flow by itself acts in: the instance's own, as the leaf the code is, with no call
	 * above it. Where no single leaf stands for the code, no one's: its accesses are refused.
	 * @param {object} store - The flow's store.
	 * @param {string} instanceID - The instance.
	 * @param {object|null} reader - The leaf.
	 * @returns {object|undefined} The stand-in; undefined when the instance has no store.
	 * @internal
	 */
	outsideView(store, instanceID, reader) {
		const base = MapMethods.get(this.instances, instanceID);
		if (!base) return undefined;
		let views = WeakMapMethods.get(this.#outsideViews, store);
		if (!views) {
			views = new Map();
			WeakMapMethods.set(this.#outsideViews, store, views);
		}
		let view = MapMethods.get(views, reader);
		if (view === undefined || view.instanceID !== base.instanceID || view.context !== base.context) {
			view = {
				...base,
				currentWrapper: reader,
				callerWrapper: null,
				currentCeiling: null,
				callerCeiling: null,
				record: reader ? { wrapper: reader, parent: null, flagged: false, ceiling: null } : null
			};
			if (!reader) Objects.defineProperty(view, OUTSIDE_FLOW, { __proto__: null, value: true });
			Objects.defineProperty(view, FLOW_OF, { __proto__: null, value: store });
			MapMethods.set(views, reader, view);
		}
		return view;
	}

	/**
	 * The manager's `AsyncLocalStorage` (sealed, see {@link SealedStorage}): the store once it has been made, a stand-in before that which answers that no
	 * store is active and makes the store when one is run (see {@link AsyncContextManager#openStore}). Null in a browser.
	 * @type {SealedStorage|DormantStore|null}
	 * @public
	 */
	get als() {
		return this.store ?? this.dormant;
	}

	/**
	 * Make the manager's `AsyncLocalStorage`, once: called when an instance selects the async runtime, before any of its
	 * files load. The scripts of Node's own that run a store's callback are sampled first (see `sampleStoreScripts` in
	 * `handlers/frame-placement`), so they are known before slothlet's store runs anything.
	 * @returns {SealedStorage|null} The store; null in a browser.
	 * @internal
	 */
	openStore() {
		if (this.store === null && AsyncLocalStorage) {
			sampleStoreScripts();
			this.store = new SealedStorage();
			this.#witness = new SealedStorage();
		}
		return this.store;
	}

	/**
	 * Whether a flow a call starts carries that call however long it runs: an async function a module started and let
	 * go of runs in the store of the call that started it.
	 * @type {boolean}
	 * @internal
	 */
	get carriesFlowCaller() {
		return true;
	}

	/**
	 * Register the EventEmitter context checker
	 * Must be called AFTER EventEmitter patching is enabled
	 * @public
	 */
	registerEventEmitterContextChecker() {
		setApiContextChecker(() => {
			const store = this.als.getStore();
			return store && store.instanceID ? true : false;
		});
		const manager = this;
		setListenerFlow({
			__proto__: null,
			// The store the registering code acts in, told as any access there is: the flow for the flow's own code, and
			// for a module's code that entered the flow by itself the stand-in it acts in outside the flow, which its
			// listener then runs in too, whoever emits.
			capture() {
				if (manager.store === null) return undefined;
				const store = manager.store.getStore();
				if (store === undefined || (store[FLOW_OF] === undefined && !isFlow(store))) return undefined;
				return manager.activeStore();
			},
			// Entered by slothlet, the listener and what it calls are the flow's code (see activeStore).
			run(store, fn, thisArg, args) {
				return manager.store.run(store, Reflect.apply, fn, thisArg, args);
			}
		});
	}

	/**
	 * Initialize context for a new instance
	 * @param {string} instanceID - Unique instance identifier
	 * @param {Object} config - Instance configuration
	 * @param {import("#helpers/clock").Clock} [clock] - The instance's clock, which stamps the store.
	 * @returns {Object} Created context store
	 * @public
	 */
	initialize(instanceID, config = {}, clock = DEFAULT_CLOCK) {
		if (MapMethods.has(this.instances, instanceID)) {
			throw new SlothletError("CONTEXT_ALREADY_EXISTS", { instance: instanceID });
		}

		const store = {
			instanceID,
			self: {},
			context: {},
			config: { ...config },
			createdAt: clock.now()
		};

		MapMethods.set(this.instances, instanceID, store);
		// In every permission mode the jobs code that entered a flow by itself makes there are told apart for as long as
		// the instance lives (see holdJobHook): a `run()` / `scope()` is isolated whether permissions are on or not.
		this.holdJobHook();
		return store;
	}

	/**
	 * Run function with instance context active
	 * @param {string} instanceID - Instance to run in context of
	 * @param {Function} fn - Function to execute
	 * @param {*} thisArg - this binding for function
	 * @param {Array} args - Arguments to pass to function
	 * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
	 * @param {boolean} [rawErrors=false] - When `true`, let a non-SlothletError thrown by
	 *   `fn` propagate unchanged instead of wrapping it as `CONTEXT_EXECUTION_FAILED`. Used
	 *   for framework callbacks (`pin`, pinned hooks) where the caller expects the
	 *   original error type/code/status.
	 * @param {boolean} [asHost=false] - When `true`, run `fn` with **no module caller**: both
	 *   `currentWrapper` and `callerWrapper` are cleared for the execution, so `fn` runs as the host
	 *   (`metadata.caller()` returns null inside it). `currentWrapper` is ignored. Used by
	 *   `pin.caller()` when the pinned caller is the host.
	 * @param {object|null} [ceiling=null] - For an identity pinned from a caller-supplied-code read (#597): the
	 *   call that code ran inside, which has to allow everything `currentWrapper` does here as well.
	 * @param {{store: object|null, identity: object}|null} [resolved=null] - The caller identity already resolved
	 *   on the store the call enters (by the permission gate), taken as the call's caller instead of reading it
	 *   again. Ignored for another store.
	 * @param {boolean} [attribute=false] - When `true`, a function or iterator `fn` returns (or resolves to) is handed back
	 *   set up to run as `currentWrapper`'s module, whoever runs it (#597). Set for a leaf's own call.
	 * @param {boolean} [madeCode=false] - When `true`, `fn` is code a module made and handed out, run as that module
	 *   (#597): the call is always checked for code another module made running inside it.
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(
		instanceID,
		fn,
		thisArg,
		args,
		currentWrapper,
		rawErrors = false,
		asHost = false,
		ceiling = null,
		resolved = null,
		attribute = false,
		madeCode = false
	) {
		// Check if we're already in an active ALS context
		const activeStore = this.activeStore();
		let baseStore;

		// CHILD INSTANCE APPROACH: Check if active store is this instance OR a child of this instance
		const isActiveOurInstance = activeStore && storeInstanceID(activeStore) === instanceID;

		if (isActiveOurInstance) {
			// Already in context for this instance (base or child) - use active store to preserve modifications
			baseStore = activeStore;
		} else {
			// Not in context or different instance - get base store
			baseStore = MapMethods.get(this.instances, instanceID);
			if (!baseStore) {
				throw new SlothletError("CONTEXT_NOT_FOUND", {
					instance: instanceID,
					instances: mapKeysToArray(this.instances)
				});
			}
		}

		// Create a new store with currentWrapper for this execution. The call record (#597) is set explicitly
		// on every path: spreading the base store must never leave a nested call holding its parent's.
		const executionStore = { ...baseStore };
		executionStore.record = this.#recordOf(baseStore);
		// The call whose own code receives what this call returns, when that call was handed code (ID-D6).
		let receiver = null;
		if (asHost) {
			// Pinned to "no module caller": the flow runs as the host, not as whichever module is ambient.
			executionStore.callerWrapper = null;
			executionStore.currentWrapper = null;
			executionStore.callerCeiling = null;
			executionStore.currentCeiling = null;
			executionStore.record = null;
			// Running as the host means enforcement must see a host-initiated flow. The marker is
			// non-enumerable (never spread onto a module's execution store), so apply it explicitly — the
			// same marker the instance's base store carries for a genuinely host-initiated call.
			Objects.defineProperty(executionStore, trustedRootOwn.TRUSTED_ROOT, { __proto__: null, value: true, configurable: true });
		} else if (currentWrapper) {
			const parent = executionStore.record;
			// The caller is the call executing in this flow — or, when that call was handed code and the code is
			// what is calling, the call that supplied it, with the executing call as its ceiling (#597). An
			// unflagged call never reads the stack.
			if (parent && resolvesSupplier(parent)) {
				const identity = resolved?.identity && resolved.store === baseStore ? resolved.identity : this.#identityOf(baseStore);
				executionStore.callerWrapper = identity.currentWrapper;
				executionStore.callerCeiling = identity.ceiling ?? null;
				receiver = ownReceiver(parent, identity);
			} else {
				executionStore.callerWrapper = baseStore.currentWrapper;
				executionStore.callerCeiling = parent ? (parent.ceiling ?? null) : (baseStore.currentCeiling ?? null);
			}
			executionStore.currentWrapper = currentWrapper;
			executionStore.currentCeiling = null;
			executionStore.record = {
				wrapper: currentWrapper,
				parent:
					parent ??
					(baseStore.currentWrapper
						? { wrapper: baseStore.currentWrapper, parent: null, flagged: false, ceiling: baseStore.currentCeiling ?? null }
						: null),
				flagged: madeCode || carriesCallerCode(thisArg, args, currentWrapper.____slothlet),
				ceiling,
				made: madeCode
			};
		}

		// A leaf's own call hands back what its module made as that module's (#597), to a caller known to be the host
		// or a module (#667).
		const callerIsHost = !executionStore.callerWrapper;
		const attributed =
			attribute && currentWrapper && !asHost && attributesResults(currentWrapper)
				? (value) => attributeResult(currentWrapper, value, callerIsHost, executionStore.callerWrapper ?? null, receiver)
				: (value) => value;

		// Only wrap in als.run() if we're not already in the right context
		if (isActiveOurInstance) {
			// Already in correct context - use a child ALS context so currentWrapper/callerWrapper propagate correctly
			return this.als.run(executionStore, () => {
				try {
					const result =
						currentWrapper && !asHost ? enterCall(currentWrapper, fn, thisArg, args) : FunctionMethods.apply(fn, thisArg, args);
					// Wrap class instances to preserve context. For an async leaf the synchronous
					// return is a pending Promise (Promise is excluded from class-instance detection),
					// so wrap the RESOLVED value instead — otherwise an async leaf that returns a class
					// instance never gets context-preserving method wrapping (#328). No rejection
					// handler: async rejections already propagate untouched here, matching the leaf
					// error contract pinned by sync-leaf-error-propagation (#252).
					if (inheritsFrom(result, Promise)) {
						return nativeThen(result, (value) =>
							this.#wrapClassInstanceResult(attributed(value), instanceID, executionStore.currentWrapper, callerIsHost)
						);
					}
					return this.#wrapClassInstanceResult(attributed(result), instanceID, executionStore.currentWrapper, callerIsHost);
				} catch (error) {
					// Rethrow framework errors directly so they propagate with their original code.
					// rawErrors also opts out non-SlothletError throws so framework callbacks keep
					// their original error type/code/status.
					if (rawErrors || inheritsFrom(error, SlothletError)) throw error;
					throw new SlothletError(
						"CONTEXT_EXECUTION_FAILED",
						{
							instance: instanceID
						},
						{ cause: error }
					);
				}
			});
		}

		// Not in context or switching instance - create new ALS context
		return this.als.run(executionStore, () => {
			try {
				const result = currentWrapper && !asHost ? enterCall(currentWrapper, fn, thisArg, args) : FunctionMethods.apply(fn, thisArg, args);
				// Wrap class instances to preserve context. For an async leaf the synchronous
				// return is a pending Promise (Promise is excluded from class-instance detection),
				// so wrap the RESOLVED value instead — otherwise an async leaf that returns a class
				// instance never gets context-preserving method wrapping (#328). No rejection
				// handler: async rejections already propagate untouched here, matching the leaf
				// error contract pinned by sync-leaf-error-propagation (#252).
				if (inheritsFrom(result, Promise)) {
					return nativeThen(result, (value) =>
						this.#wrapClassInstanceResult(attributed(value), instanceID, executionStore.currentWrapper, callerIsHost)
					);
				}
				return this.#wrapClassInstanceResult(attributed(result), instanceID, executionStore.currentWrapper, callerIsHost);
			} catch (error) {
				// Rethrow framework errors directly so they propagate with their original code.
				// rawErrors also opts out non-SlothletError throws so framework callbacks keep
				// their original error type/code/status.
				if (rawErrors || inheritsFrom(error, SlothletError)) throw error;
				throw new SlothletError(
					"CONTEXT_EXECUTION_FAILED",
					{
						instance: instanceID
					},
					{ cause: error }
				);
			}
		});
	}

	/**
	 * Wrap a value in a context-preserving proxy when it is a class instance, else return it as-is.
	 * Shared by the synchronous and async (resolved-Promise) return paths of {@link runInContext}.
	 * A fresh per-call cache is correct here — cross-call idempotency is handled by the wrapper's own
	 * `SLOTHLET_CLASS_WRAPPED` sentinel, not this cache.
	 * @private
	 * @param {*} value - Resolved return value of the leaf.
	 * @param {string} instanceID - Instance whose context the value belongs to.
	 * @param {Object} [currentWrapper] - Wrapper of the creating module (caller identity for later self.* calls).
	 * @param {boolean} [callerIsHost=false] - Whether the host made the call (see {@link attributeResult}).
	 * @returns {*} A context-preserving proxy for a class instance, otherwise `value` unchanged.
	 */
	#wrapClassInstanceResult(value, instanceID, currentWrapper, callerIsHost = false) {
		// A prototype of a module's class is no instance (#667): the host is handed the object itself, as the live runtime
		// hands it, its handle included; a module gets it as it was handed on, the object itself or its handle.
		if (currentWrapper && value !== null && typeof value === "object" && isHostPrototype(currentWrapper, value))
			return callerIsHost ? attributeResult(currentWrapper, value, callerIsHost) : value;
		if (isHandedOut(value)) return value;
		if (runtime_isClassInstance(value)) {
			// A class instance a module made runs as that module, as everything else it hands out does; one handed to
			// the module comes back as itself (#597).
			if (currentWrapper && handsOutAsModule(currentWrapper)) return attributeResult(currentWrapper, value, callerIsHost);
			// Otherwise 3.23.0's context wrapper (#328): each method runs as its creator, under the caller running it as its
			// ceiling, so it grants nothing (#726).
			const instanceCache = new WeakMap();
			return runtime_wrapClassInstance(value, this, instanceID, instanceCache, currentWrapper);
		}
		return value;
	}

	/**
	 * Capture the executing async flow's slothlet store so it can be re-entered later.
	 *
	 * Used by around hooks: a pinned around handler runs as the module that registered it, but the
	 * rest of the pipeline its `next()` runs belongs to the intercepted call, whose target must see
	 * that call's own caller.
	 *
	 * @returns {{store: object|undefined}} Snapshot for {@link AsyncContextManager#runInFlow}.
	 * @public
	 */
	captureFlow() {
		const store = this.activeStore();
		const record = store ? this.#recordOf(store) : null;
		if (!record?.flagged) return { store };
		// Resolved now, while the code that is running is on the stack: re-entered later from another stack,
		// the supplier of the code (#597) could no longer be told apart, so the flow keeps the answer.
		const identity = this.#identityOf(store);
		const ceiling = identity.ceiling ?? null;
		return {
			store: {
				...store,
				currentWrapper: identity.currentWrapper,
				currentCeiling: ceiling,
				record: { wrapper: identity.currentWrapper, parent: record.parent, flagged: false, ceiling }
			}
		};
	}

	/**
	 * Run a callback with a flow captured by {@link AsyncContextManager#captureFlow} active. Only
	 * slothlet's own AsyncLocalStorage is switched — any other async context (an application's own
	 * `AsyncLocalStorage.run()` scope around `next()`) stays exactly as it is.
	 *
	 * @param {{store: object|undefined}} flow - Captured flow.
	 * @param {function(): *} fn - Callback to run.
	 * @returns {*} The callback's return value.
	 * @public
	 */
	runInFlow(flow, fn) {
		return this.als.run(flow.store, fn);
	}

	/**
	 * Run `fn` as a given module identity, unmarked (#597): the identity a slothlet function was read under, which it
	 * keeps whoever ends up calling it. Built on the store executing now (or the instance's base store), so the call
	 * keeps that flow's context; the identity is the one given, with the call it is made from as its parent.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {{currentWrapper: object, ceiling?: object|ReadonlyArray<object>|null, callerWrapper?: object|null, callerCeiling?: object|ReadonlyArray<object>|null}} identity - Who runs.
	 * @param {function(): *} fn - What to run.
	 * @returns {*} What `fn` returned.
	 * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no store.
	 * @internal
	 */
	runAsIdentity(instanceID, identity, fn) {
		const active = this.activeStore();
		const base = active && storeInstanceID(active) === instanceID ? active : MapMethods.get(this.instances, instanceID);
		if (!base) {
			throw new SlothletError("CONTEXT_NOT_FOUND", { instance: instanceID, instances: mapKeysToArray(this.instances) });
		}
		const ceiling = identity.ceiling ?? null;
		const parent =
			this.#recordOf(base) ??
			(base.currentWrapper ? { wrapper: base.currentWrapper, parent: null, flagged: false, ceiling: base.currentCeiling ?? null } : null);
		const store = {
			...base,
			currentWrapper: identity.currentWrapper,
			callerWrapper: identity.callerWrapper ?? null,
			currentCeiling: ceiling,
			callerCeiling: identity.callerCeiling ?? null,
			record: { wrapper: identity.currentWrapper, parent, flagged: false, ceiling }
		};
		return this.als.run(store, fn);
	}

	/**
	 * Run `fn` attributed to no module (#597): inside a module's call, the flow keeps its context but no module is
	 * executing and it is not the host's, so a permission check made from it fails closed. Outside any module's call
	 * `fn` runs as it is. Used where slothlet runs code that is no caller's — a module being built at a module's
	 * request.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {function(): *} fn - What to run.
	 * @returns {*} What `fn` returned.
	 * @internal
	 */
	runUnattributed(instanceID, fn) {
		const active = this.activeStore();
		if (!active || storeInstanceID(active) !== instanceID) return fn();
		if (!active.currentWrapper && !active.record) return fn();
		const store = {
			...active,
			currentWrapper: null,
			callerWrapper: null,
			currentCeiling: null,
			callerCeiling: null,
			record: null
		};
		return this.als.run(store, fn);
	}

	/**
	 * Run the load of a module file inside a store that names the file's module (#726), so what the file starts while
	 * it loads (a timer, a listener, an async resource, an `AsyncLocalStorage.snapshot()`) carries the module as its
	 * caller when it runs later, instead of running in no store, where it would count as the host's. The module's node
	 * does not exist while the file loads and can change with a reload, so the store's identity is read from the load
	 * whenever it is asked for. While there is none the store has no `self`, and its code is refused as code no one
	 * accounts for.
	 *
	 * @param {{instanceID: function(): (string|null), wrapper: function(): (object|null), record: function(): (object|null)}} loading - The load (see createModuleLoad).
	 * @param {function(): *} fn - What loads the file.
	 * @returns {*} What `fn` returned.
	 * @internal
	 */
	runModuleLoad(loading, fn) {
		const base = MapMethods.get(this.instances, loading.instanceID());
		if (!base || !this.als) return fn();
		const current = () => MapMethods.get(this.instances, loading.instanceID()) ?? null;
		const store = { ...base, callerWrapper: null, callerCeiling: null, currentCeiling: null };
		const live = (name, read) => Objects.defineProperty(store, name, { __proto__: null, get: read, enumerable: true, configurable: true });
		live("instanceID", () => current()?.instanceID ?? base.instanceID);
		live("currentWrapper", () => loading.wrapper());
		live("record", () => loading.record());
		// The instance's api and context as they are when read: neither is built yet while the first files load.
		live("self", () => (loading.wrapper() ? current()?.self : undefined));
		live("context", () => current()?.context ?? base.context);
		// Not spread onto the stores of the calls made from it: only this store is the load's.
		Objects.defineProperty(store, "moduleLoad", { __proto__: null, value: loading, enumerable: false });
		const outside = this.als.getStore();
		const result = this.als.run(store, fn);
		// A lazy load runs detached, with no store ({@link runDetached}). Where `AsyncLocalStorage` rests on async hooks
		// (Node 22), `exit()` switches the storage off and a `run()` inside it switches it back on, so what follows
		// the load would see the store of the call that triggered it. The flow is left as it was found: detached.
		if (outside === undefined && this.als.getStore() !== undefined) this.als.disable();
		return result;
	}

	/**
	 * Whether no flow of an instance is active: no store at all, or another instance's. Code running then was started
	 * by nothing slothlet entered, so only its frames can say whose it is.
	 * @param {string} instanceID - The instance.
	 * @returns {boolean} True when no store of the instance is active.
	 * @internal
	 */
	isAmbient(instanceID) {
		const store = this.als?.getStore();
		return !store || storeInstanceID(store) !== instanceID;
	}

	/**
	 * The instance whose flow is running: the one the active store belongs to (a call, a hook, a `run()` or `scope()`
	 * callback, a file's load), or null when no store is active. Code of a file that carries no instance tag (a
	 * CommonJS file two instances load) is that instance's while its flow runs.
	 * @returns {string|null} The instance's id.
	 * @internal
	 * @example
	 * contextManager.runningInstanceID(); // "slothlet_abc" inside one of its calls, null in the host's own flow
	 */
	runningInstanceID() {
		const store = this.als?.getStore();
		return store ? (storeInstanceID(store) ?? null) : null;
	}

	/**
	 * Run `fn` outside every instance (#597): no store is active while it runs, nor in what it schedules, so code an
	 * instance that has shut down made reaches no instance's api and no module's identity.
	 * @param {Function} fn - What to run.
	 * @param {*} thisArg - `this` for it.
	 * @param {Array} args - Its arguments.
	 * @returns {*} What `fn` returned.
	 * @internal
	 */
	runDetached(fn, thisArg, args) {
		return this.als.exit(() => Reflect.apply(fn, thisArg, args));
	}

	/**
	 * Get current active context
	 * @returns {Object} Current context store
	 * @throws {SlothletError} If no active context
	 * @public
	 */
	getContext() {
		const store = this.activeStore();
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_ACTIVE_ASYNC", {});
		}
		return store;
	}

	/**
	 * Try to get context (returns undefined instead of throwing)
	 *
	 * @param {string} [instanceID] - When provided, resolve the store scoped to this instance rather
	 *   than to the active async flow. The active ALS store is used only when it belongs to this
	 *   instance (its own store or a child scope of it); otherwise this instance has no active flow
	 *   and its own base store is returned, so host-level checks (e.g. the `TRUSTED_ROOT` read-gate
	 *   exemption) evaluate against the right instance. AsyncLocalStorage propagates across `await`,
	 *   so a leaf that boots a second `slothlet()` would otherwise carry its own store into the
	 *   nested instance's construction (#290). Omit for the legacy "active flow store" behavior.
	 * @returns {Object|undefined} Current context store or undefined
	 * @public
	 */
	tryGetContext(instanceID) {
		// `als` is null in a browser (AsyncLocalStorage gated out, #123). The runtime dispatcher
		// (getCurrentRuntime) probes this even in live mode, so honour the documented
		// "returns undefined instead of throwing" contract instead of dereferencing a null ALS.
		// The browser run reaches this `!als` arm through that live-mode self-dispatch path.
		if (!this.als) return undefined;
		const store = this.activeStore();
		if (instanceID === undefined) return store;
		if (store && storeInstanceID(store) === instanceID) {
			return store;
		}
		return MapMethods.get(this.instances, instanceID);
	}

	/**
	 * Resolve the caller identity for the executing async flow.
	 *
	 * Counterpart to the live manager's accessor of the same name, so enforcement can ask for
	 * identity without knowing which runtime it is on. No disambiguation is needed here:
	 * `runInContext` publishes a fresh execution store into AsyncLocalStorage, so the store this
	 * returns already belongs to the calling flow and cannot be another call's.
	 *
	 * @param {string} [instanceID] - When provided, resolve identity from THIS instance's own store
	 *   rather than from the active async flow. AsyncLocalStorage propagates across `await`, so an
	 *   outer leaf booting this nested instance would otherwise be seen as its caller; scoping to the
	 *   instance's own store reports no caller for that nested boot (base store has none) while still
	 *   returning the real caller when this instance's own flow is active (#290). Omit for the legacy
	 *   "active flow caller" behavior.
	 * @returns {{currentWrapper: object, callerWrapper: object, made: boolean}|undefined} Identity (`made` when the call
	 *   runs code a module made and handed out), or undefined
	 *   when there is no active context.
	 * @public
	 */
	getCallerIdentity(instanceID) {
		const store = this.tryGetContext(instanceID);
		if (!store) return undefined;
		const identity = this.#identityOf(store);
		// Code no call accounts for (#597): no caller, unresolved, as the live manager answers it.
		if (identity.unaccounted) return { currentWrapper: null, callerWrapper: store.callerWrapper, unresolved: true, unaccounted: true };
		// Code a file started while it loaded whose module cannot be found: no caller, and not the host.
		if (identity.unresolved) return { currentWrapper: null, callerWrapper: null, unresolved: true };
		const record = this.#recordOf(store);
		return {
			currentWrapper: identity.currentWrapper,
			callerWrapper: store.callerWrapper,
			ceiling: identity.ceiling,
			callerCeiling: store.callerCeiling ?? undefined,
			made: record?.made === true,
			record: record ?? undefined
		};
	}

	/**
	 * The call record a store's flow is executing, when it is the call the store names.
	 * @param {object} store - A context store.
	 * @returns {object|null} The record, or null.
	 * @private
	 */
	#recordOf(store) {
		const record = store.record;
		return record && record.wrapper === store.currentWrapper ? record : null;
	}

	/**
	 * Who is executing in a store's flow: the call it names, or — when that call was handed code by a call
	 * above it and that code is what is running — the supplier, with the call as its ceiling (#597).
	 *
	 * @param {object} store - A context store.
	 * @returns {{currentWrapper: object|undefined, ceiling: object|undefined}} The identity.
	 * @private
	 */
	#identityOf(store) {
		const record = this.#recordOf(store);
		if (!record) {
			// The store of a file's load (#726) while the file's module cannot be found: its code is no one's.
			if (store.moduleLoad && !store.currentWrapper) return { currentWrapper: null, unresolved: true };
			// Code that entered a flow by itself, which no single leaf stands for: no one's either.
			if (store[OUTSIDE_FLOW] === true) return { currentWrapper: null, unresolved: true, unaccounted: true };
			return { currentWrapper: store.currentWrapper, ceiling: store.currentCeiling ?? undefined };
		}
		const supplier = resolveSupplier(record);
		// Code no call accounts for: no caller, and unresolved, so only a node a module kept can settle it, as that
		// module (#597, #661), as the live manager answers it.
		// Code that is accounted for and refused (a leaf's own function entered by a caller that may not call it).
		if (supplier?.refused) return { currentWrapper: null, unresolved: true };
		if (supplier?.unaccounted) return { currentWrapper: null, unresolved: true, unaccounted: true };
		if (supplier) return { currentWrapper: supplier.wrapper, ceiling: supplier.ceiling };
		return { currentWrapper: record.wrapper, ceiling: record.ceiling ?? undefined };
	}

	/**
	 * Capture the parts of this instance's executing flow that a later, out-of-band run must
	 * reproduce: the user context (`context.run()`'s), the caller identity, the owner-locked context
	 * keys and whether the flow is host-trusted. Used by the event system (#497) so a deferred
	 * delivery runs exactly as an immediate one would have. Holds references only — nothing is cloned
	 * or serialized.
	 *
	 * @param {string} instanceID - Instance whose flow to capture.
	 * @returns {object|null} An opaque flow snapshot for {@link runInSnapshotFlow}, or null when the
	 *   instance has no context store.
	 * @public
	 */
	snapshotFlow(instanceID) {
		const store = this.tryGetContext(instanceID);
		if (!store) return null;
		const identity = this.getCallerIdentity(instanceID);
		return {
			context: store.context,
			currentWrapper: identity.currentWrapper ?? null,
			callerWrapper: identity.callerWrapper ?? null,
			ceiling: identity.ceiling ?? null,
			callerCeiling: identity.callerCeiling ?? null,
			contextOwners: store.__contextOwners ?? null,
			copy: store[RUN_COPY] ?? null,
			trusted: store[trustedRootOwn.TRUSTED_ROOT] === true
		};
	}

	/**
	 * Run `fn` inside a flow rebuilt from a {@link snapshotFlow} snapshot, on top of the instance's
	 * CURRENT base store (so a snapshot taken before a reload runs against the reloaded instance).
	 * The deliverer's own ambient context is not merged in: the snapshot's context replaces it.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {object} captured - Snapshot from {@link snapshotFlow}.
	 * @param {Function} fn - Function to run (may be async).
	 * @returns {Promise<*>} Resolves/rejects with `fn`'s outcome.
	 * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no base store.
	 * @public
	 */
	async runInSnapshotFlow(instanceID, captured, fn) {
		const childStore = buildCapturedFlowStore(this.instances, instanceID, captured);
		MapMethods.set(this.instances, childStore.instanceID, childStore);
		try {
			return await this.als.run(childStore, fn);
		} finally {
			MapMethods.delete(this.instances, childStore.instanceID);
		}
	}

	/**
	 * Run `fn` synchronously inside a flow rebuilt from a {@link snapshotFlow} snapshot (#653), as
	 * {@link runInSnapshotFlow} does for a delivery that may be async: a change made through a lazy stand-in and
	 * replayed when its node loads runs in the context it was made in, and only for as long as `fn` runs.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {object} captured - Snapshot from {@link snapshotFlow}.
	 * @param {function(): *} fn - Synchronous function to run.
	 * @returns {*} What `fn` returned.
	 * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no base store.
	 * @internal
	 */
	runInSnapshotFlowSync(instanceID, captured, fn) {
		const childStore = buildCapturedFlowStore(this.instances, instanceID, captured);
		MapMethods.set(this.instances, childStore.instanceID, childStore);
		try {
			return this.als.run(childStore, fn);
		} finally {
			MapMethods.delete(this.instances, childStore.instanceID);
		}
	}

	/**
	 * Cleanup instance context
	 * @param {string} instanceID - Instance to cleanup
	 * @param {{keepFlows?: boolean}} [options] - `keepFlows`: the instance comes back on the flows it has (a restart),
	 *   so they stay its.
	 * @public
	 */
	cleanup(instanceID, { keepFlows = false } = {}) {
		const store = MapMethods.get(this.instances, instanceID);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instance: instanceID,
				instances: ArrayMethods.join(mapKeysToArray(this.instances), ", ") || "none"
			});
		}
		// The instance shuts down on the ID it holds (a reload leaves an old ID, a restart keeps the flows open across it):
		// the flows its code left behind are no longer its (see activeStore).
		const owner = store.slothlet;
		if (!keepFlows && owner !== null && typeof owner === "object" && owner.instanceID === instanceID)
			WeakMapMethods.set(this.#ended, owner, true);

		// Clear the store data
		store.self = {};
		store.context = {};

		// Remove from instances map
		MapMethods.delete(this.instances, instanceID);
		this.releaseJobHook();
	}

	/**
	 * Diagnostics for one instance (#837): what this manager holds for that instance only, never the other instances
	 * the process-wide manager also serves.
	 * @param {string} instanceID - The instance.
	 * @returns {{ type: "async", running: boolean, at: number|null, context: object|null, self: string[], current: { context: object, nested: boolean }|null }}
	 *   The runtime word, whether code of the instance (a call, a `run()` / `scope()` callback, a load) is running now,
	 *   when its record was made, its context data, the top-level names its `self` shows, and the running flow's context
	 *   (and whether it is a nested run/scope).
	 * @public
	 */
	getInstanceDiagnostics(instanceID) {
		const store = MapMethods.get(this.instances, instanceID) ?? null;
		const active = this.als.getStore();
		// A `run()` / `scope()` store is a child of the instance's: its code, and a call made inside it, is the instance's.
		const running = active !== undefined && storeInstanceID(active) === instanceID;
		return {
			type: "async",
			running,
			at: store?.createdAt ?? null,
			context: store?.context ?? null,
			self: store ? Objects.keys(store.self) : [],
			current: running ? { context: active.context, nested: !!active.parentContext } : null
		};
	}
}

/**
 * Singleton async context manager
 * @public
 */
const asyncContextManager = new AsyncContextManager();

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["lib/factories/context"])) throw ownBindingsRefusal("lib/handlers/context-async", import.meta.url);
	return {
		get asyncContextManager() {
			return asyncContextManager;
		}
	};
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
/** @type {typeof asyncContextManager} */
const guarded_asyncContextManager = guardInternal(asyncContextManager, "asyncContextManager", import.meta.url);
export { guarded_asyncContextManager as asyncContextManager };
