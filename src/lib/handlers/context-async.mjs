/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-async.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T09:14:20-08:00 (1794935660)
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
import { AsyncLocalStorage, AsyncResource, executionAsyncResource, inheritsFrom } from "#helpers/platform";
import { nativeThen } from "#helpers/promise-context";
import { SlothletError } from "#errors";
import { DEFAULT_CLOCK } from "#helpers/clock";
import { runtime_isClassInstance, internals as classInstanceWrapperInternals } from "#helpers/class-instance-wrapper";
import { internals as eventemitterContextInternals } from "#helpers/eventemitter-context";
import { internals as trustedRootInternals } from "#handlers/trusted-root";
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
	FunctionMethods,
	Map,
	mapEntriesToArray,
	mapKeysToArray,
	MapMethods,
	NativeProxy,
	Objects,
	Promise,
	queueMicrotask,
	Reflect,
	Symbol,
	WeakMap,
	WeakMapMethods,
	listPush
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";
const { runtime_wrapClassInstance } = classInstanceWrapperInternals("lib/handlers/context-async");
const { setApiContextChecker } = eventemitterContextInternals("lib/handlers/context-async");
const trustedRootOwn = trustedRootInternals("lib/handlers/context-async");
const { buildCapturedFlowStore } = trustedRootOwn;
const {
	attributeResult,
	enterCall,
	isRunBindable,
	outerCallerCeiling,
	ownReceiver,
	resolveSupplier,
	runningOutsideFlow,
	sampleStoreScripts
} = framePlacementInternals("lib/handlers/context-async");

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
 * The run-bound stand-ins {@link AsyncContextManager} hands out (see {@link AsyncContextManager#bindToRun}), each with
 * the function it stands for and the leaf whose call handed it out.
 * @type {WeakMap<Function, {original: Function, hander: object}>}
 * @private
 */
const RUN_BOUND = new WeakMap();

/**
 * How many run-bound stand-ins were made: until one is, no call's arguments are looked through for one.
 * @type {number}
 * @private
 */
let runBoundMade = 0;

/**
 * The function a run-bound stand-in stands for, when it is handed to a call of a leaf of the file whose call handed it
 * out: that file gets its own function back, as in plain JavaScript. Anything else is handed on as it is.
 * @param {*} value - A value handed to the call.
 * @param {object} wrapper - The wrapper of the leaf called.
 * @returns {*} What the leaf gets.
 * @private
 */
function unbindForLeaf(value, wrapper) {
	if (typeof value !== "function") return value;
	const record = WeakMapMethods.get(RUN_BOUND, value);
	if (record === undefined) return value;
	const file = wrapper?.____slothletInternal?.filePath;
	return file !== undefined && file === record.hander?.____slothletInternal?.filePath ? record.original : value;
}

/**
 * The arguments of a call of a leaf, with each run-bound stand-in of the leaf's own file's function replaced by the
 * function itself (see {@link unbindForLeaf}).
 * @param {Array<*>} args - The arguments.
 * @param {object} wrapper - The wrapper of the leaf called.
 * @returns {Array<*>} The arguments, the same list when none is replaced.
 * @private
 */
function unbindArgsForLeaf(args, wrapper) {
	let out = args;
	for (let i = 0; i < args.length; i++) {
		const value = unbindForLeaf(args[i], wrapper);
		if (value === args[i]) continue;
		if (out === args) out = concatLists([], args);
		out[i] = value;
	}
	return out;
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
	 * @returns {(function(): void)|null} Puts back what the resource held, unless something has entered another store on
	 *   it since; null when nothing has to.
	 */
	enterAdopted(store) {
		const storage = this.#storage;
		const token = sealStore(store);
		const key = storage.kResourceStore;
		const resource = typeof key === "symbol" && executionAsyncResource !== null ? executionAsyncResource() : null;
		if (resource === null || (typeof resource !== "object" && typeof resource !== "function")) {
			storage.enterWith(token);
			return null;
		}
		const previous = resource[key];
		storage.enterWith(token);
		return () => {
			if (resource[key] === token) resource[key] = previous;
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
	 * The run-bound stand-ins handed out in each run, by the run's store and the function each stands for (see
	 * {@link AsyncContextManager#bindToRun}).
	 * @type {WeakMap<object, WeakMap<Function, Function>>}
	 */
	#runBound = new WeakMap();

	/**
	 * What a call made inside a `run()` / `scope()` by the run's own code hands back, as that code gets it: a module's
	 * function comes back as a stand-in that keeps the run when Node calls it later. Code the flow hands Node to call
	 * later (passed straight to `promise.then()`, `setTimeout()`, an event) runs with nothing of the flow's on the stack,
	 * the shape of code that entered the flow by itself (see {@link AsyncContextManager#activeStore}); the stand-in is
	 * slothlet's code, so the code it runs is told as code the flow called. Run by a module's own code that entered
	 * another flow by itself, it runs outside that flow as any of the module's code there does. The same function read
	 * in the same run is the same stand-in; outside every run nothing is bound.
	 * @param {*} value - What the call returned.
	 * @param {object} store - The store of the code that made the call.
	 * @param {object} hander - The wrapper of the leaf whose call returned it.
	 * @returns {*} What the code gets.
	 * @internal
	 */
	bindToRun(value, store, hander) {
		if (typeof value !== "function" || WeakMapMethods.has(RUN_BOUND, value)) return value;
		const run = MapMethods.get(this.instances, store.instanceID) ?? store.context;
		if (run === null || typeof run !== "object") return value;
		let bound = WeakMapMethods.get(this.#runBound, run);
		if (bound === undefined) {
			bound = new WeakMap();
			WeakMapMethods.set(this.#runBound, run, bound);
		}
		let standIn = WeakMapMethods.get(bound, value);
		if (standIn !== undefined) return standIn;
		standIn = isRunBindable(value) ? this.#runBoundStandIn(value, hander) : value;
		WeakMapMethods.set(bound, value, standIn);
		return standIn;
	}

	/**
	 * A stand-in of a module's function that runs it in the flow it is called in as a call of the leaf whose call handed
	 * it out, entered by slothlet (see {@link AsyncContextManager#bindToRun}), as `"precise"` runs a module's code it
	 * hands out: what the function runs after an `await` is then the call's code, and stays in the flow. Everything else
	 * (its name, length, properties, prototype, `this`, `new`, what it returns and throws) is the function's own.
	 * @param {Function} fn - The function.
	 * @param {object} hander - The wrapper of the leaf whose call handed it out.
	 * @returns {Function} The stand-in.
	 * @private
	 */
	#runBoundStandIn(fn, hander) {
		const manager = this;
		const standIn = new NativeProxy(fn, {
			__proto__: null,
			apply(target, thisArg, args) {
				const store = manager.activeStore();
				if (store === undefined) return Reflect.apply(target, thisArg, args);
				return manager.#runAsCallOf(hander, store, target, thisArg, args);
			},
			construct(target, args, newTarget) {
				const store = manager.activeStore();
				if (store === undefined) return Reflect.construct(target, args, newTarget);
				return manager.#runAsCallOf(hander, store, Reflect.construct, undefined, [target, unbindArgsForLeaf(args, hander), newTarget]);
			}
		});
		WeakMapMethods.set(RUN_BOUND, standIn, { original: fn, hander });
		runBoundMade++;
		return standIn;
	}

	/**
	 * Run a module's function as a call of the leaf whose call handed it out, in the flow running now (see
	 * {@link AsyncContextManager#bindToRun}). What it returns and throws comes back as it is: nothing is handed back
	 * through slothlet. With the permission system on, whoever runs it is its ceiling, as for any code a module hands out.
	 * A flow of another instance (the function handed on to code that runs it there) is entered as it is.
	 * @param {object} hander - The wrapper of the leaf.
	 * @param {object} store - The store of the flow running now.
	 * @param {Function} fn - The function.
	 * @param {*} thisArg - Its receiver.
	 * @param {Array<*>} args - Its arguments.
	 * @returns {*} What it returned.
	 */
	#runAsCallOf(hander, store, fn, thisArg, args) {
		const instanceID = hander.slothlet?.instanceID;
		if (instanceID === undefined || (store.instanceID !== instanceID && store.parentInstanceID !== instanceID))
			return this.store.run(store, Reflect.apply, fn, thisArg, args);
		const checks = attributesResults(hander);
		const ceiling = checks ? outerCallerCeiling(this, instanceID, hander.slothlet, null) : null;
		return this.runInContext(instanceID, fn, thisArg, args, hander, true, false, ceiling, null, false, checks, store);
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
		if (store === undefined || this.#telling || this.store === null) return store;
		if (this.store.entered() === store) return store;
		// Code that entered a flow by itself put the rest of its run outside the flow: told again against that flow.
		const outsideOf = store[FLOW_OF];
		if (outsideOf !== undefined) return this.#stillOutside(store, outsideOf);
		// Only a call's flow or a `run()` / `scope()` flow carries anything of another's; a file's load is told by its own.
		if (store.moduleLoad || (!store.currentWrapper && !store.record && !store.parentInstanceID)) return store;
		// Inside an async resource's scope the flow was put in place by whoever called it: told every time.
		const resource = executionAsyncResource?.();
		const scoped = AsyncResource !== null && inheritsFrom(resource, AsyncResource);
		const told = this.#told;
		if (!scoped && told !== null && told.store === store && this.#witness.getStore() === told.mark) return store;
		const instanceID = store.parentInstanceID ?? store.instanceID;
		this.#telling = true;
		let answer;
		try {
			answer = runningOutsideFlow(instanceID, this.#ownersOf(store));
		} finally {
			this.#telling = false;
		}
		if (answer === null) return store;
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
	 * Put the rest of the code running now, and everything it hands Node to run later (a promise's `then()`, a timer, an
	 * `await`), outside the flow it entered by itself: a job it schedules runs with nothing of its own on the stack, the
	 * shape of a job the flow's own code handed Node, so it has to carry the stand-in store from where it was made. While
	 * `AsyncContextFrame` is off the store is put on the async resource running now, and taken back off it once this
	 * stretch of synchronous code ends, so the resource's owner running it again later runs in its own flow.
	 * @param {object} view - The stand-in store (see {@link AsyncContextManager#outsideView}).
	 * @returns {void}
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
	 */
	#stillOutside(view, flow) {
		const instanceID = flow.parentInstanceID ?? flow.instanceID;
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
	 * @param {object} [told] - The store of the flow running now, already told (see {@link AsyncContextManager#activeStore}),
	 *   for a run-bound stand-in's call (see {@link AsyncContextManager#bindToRun}): what `fn` returns or throws is handed
	 *   back as it is.
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
		madeCode = false,
		told = undefined
	) {
		// Check if we're already in an active ALS context
		const asIs = told !== undefined;
		const activeStore = asIs ? told : this.activeStore();
		let baseStore;

		// CHILD INSTANCE APPROACH: Check if active store is this instance OR a child of this instance
		const isActiveOurInstance = activeStore && (activeStore.instanceID === instanceID || activeStore.parentInstanceID === instanceID);

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
				flagged: madeCode || carriesCallerCode(thisArg, args),
				ceiling,
				made: madeCode
			};
		}

		// A leaf's own call hands back what its module made as that module's (#597), to a caller known to be the host
		// or a module (#667).
		const callerIsHost = !executionStore.callerWrapper;
		const attributes = attribute && currentWrapper && !asHost && attributesResults(currentWrapper);
		// Inside a run, a function handed back to the run's own code is bound to the run, unless it already comes as a
		// stand-in of its module (`"precise"` with the permission system on). Code that entered the flow by itself acts
		// in the instance's own store, which belongs to no run.
		const bindsToRun =
			!asIs &&
			currentWrapper &&
			!asHost &&
			isActiveOurInstance &&
			activeStore.parentInstanceID !== undefined &&
			!handsOutAsModule(currentWrapper);
		const attributed = attributes
			? bindsToRun
				? (value) =>
						this.bindToRun(
							attributeResult(currentWrapper, value, callerIsHost, executionStore.callerWrapper ?? null, receiver),
							activeStore,
							currentWrapper
						)
				: (value) => attributeResult(currentWrapper, value, callerIsHost, executionStore.callerWrapper ?? null, receiver)
			: bindsToRun
				? (value) => this.bindToRun(value, activeStore, currentWrapper)
				: (value) => value;
		// A run-bound stand-in handed back to the file that handed it out is its own function again.
		if (runBoundMade > 0 && currentWrapper && !asHost) {
			args = unbindArgsForLeaf(args, currentWrapper);
			thisArg = unbindForLeaf(thisArg, currentWrapper);
		}

		// A run-bound stand-in's call: the function's own result and errors, as plain JavaScript gives them.
		if (asIs) return this.als.run(executionStore, enterCall, currentWrapper, fn, thisArg, args);

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
		if (isHandedOut(value)) return value;
		if (runtime_isClassInstance(value)) {
			// A class instance a module made runs as that module, as everything else it hands out does; one handed to
			// the module comes back as itself (#597).
			if (currentWrapper && handsOutAsModule(currentWrapper)) return attributeResult(currentWrapper, value, callerIsHost);
			// A prototype of a module's class the host is handed is the object itself (#667), as the live runtime hands it.
			if (currentWrapper && callerIsHost && isHostPrototype(currentWrapper, value))
				return attributeResult(currentWrapper, value, callerIsHost);
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
		const base =
			active && (active.instanceID === instanceID || active.parentInstanceID === instanceID)
				? active
				: MapMethods.get(this.instances, instanceID);
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
		if (!active || (active.instanceID !== instanceID && active.parentInstanceID !== instanceID)) return fn();
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
		return !store || (store.instanceID !== instanceID && store.parentInstanceID !== instanceID);
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
		return store ? (store.parentInstanceID ?? store.instanceID ?? null) : null;
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
		if (store && (store.instanceID === instanceID || store.parentInstanceID === instanceID)) {
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
	 * @public
	 */
	cleanup(instanceID) {
		const store = MapMethods.get(this.instances, instanceID);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instance: instanceID,
				instances: ArrayMethods.join(mapKeysToArray(this.instances), ", ") || "none"
			});
		}

		// Clear the store data
		store.self = {};
		store.context = {};

		// Remove from instances map
		MapMethods.delete(this.instances, instanceID);
	}

	/**
	 * Diagnostics for one instance (#837): what this manager holds for that instance only, never the other instances
	 * the process-wide manager also serves.
	 * @param {string} instanceID - The instance.
	 * @returns {{ type: "async", running: boolean, at: number|null, context: object|null, self: string[], current: { context: object, nested: boolean }|null }}
	 *   The runtime word, whether a call of the instance is running now, when its record was made, its context data,
	 *   the top-level names its `self` shows, and the running call's context (and whether it is a nested run/scope).
	 * @public
	 */
	getInstanceDiagnostics(instanceID) {
		const store = MapMethods.get(this.instances, instanceID) ?? null;
		const active = this.als.getStore();
		const running = active?.instanceID === instanceID;
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
