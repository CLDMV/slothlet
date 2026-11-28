/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/flow-stores.mjs
 *	@Date: 2026-11-17T16:18:23-08:00 (1794961103)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:42-08:00 (1795869042)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `run()` / `scope()` stores of an instance, followed across its reloads.
 *
 * @description
 * A `run()` / `scope()` store names the instance it was opened on in `parentInstanceID`. Work the run left behind (a
 * timer, a listener, a promise chain) keeps the store after the run has returned, and a `reload()` gives the instance a
 * new ID. The stores still open are found among the context manager's instances and moved to the new ID; the stores of
 * runs that have returned are no longer there, so each store is also recorded here, weakly, against the instance object
 * that opened it. A reload moves every recorded store to the new ID, so the work they carry keeps running in its run's
 * context, as it would without the reload. A store is recorded only while something holds it: once its work is gone it
 * is collected and drops out.
 *
 * A store also records which copy of the instance its run started with (see {@link RUN_COPY}): the components, config
 * and api tree the run's calls are answered from, which a reload does not change for it.
 *
 * @module @cldmv/slothlet/helpers/flow-stores
 * @internal
 */
import {
	FinalizationRegistry,
	FinalizationRegistryMethods,
	listPush,
	queueMicrotask,
	Reflect,
	setImmediate,
	setTimeout,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakRef,
	WeakRefMethods
} from "#helpers/intrinsics";
import { openRunSnapshot } from "#helpers/run-snapshot";

/**
 * The key a `run()` / `scope()` store records its copy of the instance under. Every run gets a record of its own (see
 * {@link copyForRun}): `from` is the token of the copy that was current when the run started, shared with every run
 * that started on that copy, `parent` is the record of the run it was opened in (null for a run opened outside any),
 * and `ns` is the run's own handlers namespace once it holds a fork (null until then). `stores` lists the run's stores
 * a reload moves to the instance's new ID until the copy is torn down (see {@link trackFlowStore}). The stores of the run's calls
 * and of work it left behind carry the run's record with the rest of the store.
 *
 * A record lives while its run's work does (see {@link holdRunWork}): `work` counts the run's callback until it has
 * settled and every piece of work begun in the run that has not finished yet (a timer, an interval, a microtask, a
 * promise that has not settled, a listener still on its emitter, a Node callback still to come). When it reaches zero
 * the record is `done`, and the instance tears its copy down once it is idle. What code keeps through the runtime
 * `context` export does not count.
 *
 * While the instance has not changed since the token was handed out, the token's `values` is null and the instance's
 * own fields answer. The first change after that, a reload's swap or a write to one of the forkable handlers (see
 * {@link FORK}) from outside any run, makes the token keep what the instance had: `values` then holds that copy. A
 * write from code in a run forks the written handler into the run's `ns` (see `Slothlet#writeTarget`), which the run
 * then reads first. A nested run starts with its own copy of its parent's `ns`. A run that changes its api tree holds a
 * whole set of its own in `values` (its tree and the handlers that go with it, see `Slothlet#ownTree`), which it reads
 * before anything else; a nested run opened in it reads that tree until either one changes it. `restart` tells of the
 * run's last `restart()` (null when it made none): `epoch` is the epoch of the tree it built, which the nodes of every
 * tree the run read before it are above (see `ApiManager#isRestartReplaced`), and `stamps` the reload stamps the files
 * of the trees built for the run since were imported under, which code of those earlier trees does not carry. A nested
 * run starts with a copy of its parent's.
 * @type {symbol}
 * @internal
 */
export const RUN_COPY = Symbol("slothlet.runCopy");

/**
 * The key of the instance's method that hands out the token of the copy it has now (see {@link RUN_COPY}).
 * @type {symbol}
 * @internal
 */
export const CURRENT_COPY = Symbol("slothlet.currentCopy");

/**
 * The key of the instance's method that makes the record of a run opened in a run that holds a fork: the new run
 * starts with a copy of its parent's handlers namespace (see {@link copyForRun}).
 * @type {symbol}
 * @internal
 */
export const INHERIT_COPY = Symbol("slothlet.inheritCopy");

/**
 * The key of the instance's method that says which object a forkable handler's write goes to (see {@link writeTarget}).
 * @type {symbol}
 * @internal
 */
export const WRITE_TARGET = Symbol("slothlet.writeTarget");

/**
 * The key of the instance's method that reads one of its own copy fields (`api`, `config`, a component namespace), as
 * the instance has it, whichever copy the calling code answers from.
 * @type {symbol}
 * @internal
 */
export const INSTANCE_FIELD = Symbol("slothlet.instanceField");

/**
 * The key of a forkable handler's method that makes a copy of it: a new handler of the same class holding a copy of
 * its state (rules, hooks, metadata, principals, subscriptions, mode and seal, as the class keeps them), which later
 * changes to either leave the other as it is. Caches start empty in the copy.
 * @type {symbol}
 * @internal
 */
export const FORK = Symbol("slothlet.fork");

/**
 * The key of the instance's method that is told when a run's record is `done` (see {@link releaseRunWork}): the
 * instance tears the run's copy down once it is idle.
 * @type {symbol}
 * @internal
 */
export const RUN_DONE = Symbol("slothlet.runDone");

/**
 * The key of the instance's method that is told of each new run record, so `shutdown()` can tear down the copies of
 * runs still holding work.
 * @type {symbol}
 * @internal
 */
export const RUN_OPENED = Symbol("slothlet.runOpened");

/**
 * The key of the instance's method that readies the api tree for a change the calling code is about to make (see
 * {@link treeWrite}): a run that changes its tree first gets a tree of its own, and every other copy that still reads
 * the tree being changed gets one before it changes.
 * @type {symbol}
 * @internal
 */
export const TREE_WRITE = Symbol("slothlet.treeWrite");

/**
 * The key a run record holds its full-isolation `self` under (see `makeRunSelf` in `handlers/unified-wrapper/run`): what that
 * `self` wrote before the run had a tree of its own is written into the tree the run is given, once it has one.
 * @type {symbol}
 * @internal
 */
export const RUN_SELF = Symbol("slothlet.runSelf");

/**
 * The key of the instance's method that records an operation in the history the calling code's copy replays (see
 * {@link recordOperation}).
 * @type {symbol}
 * @internal
 */
export const RECORD_OPERATION = Symbol("slothlet.recordOperation");

/**
 * The key of the instance's method that says whether the calling code is building a copy of an api tree for a run
 * (see `Slothlet#buildCopy`): such a build announces nothing to lifecycle subscribers, as nothing new is loaded.
 * @type {symbol}
 * @internal
 */
export const SILENT_BUILD = Symbol("slothlet.silentBuild");

/**
 * The key of the instance's method that hands a copy build the URL the copied tree imported a file from, so the copy
 * uses the very module the tree it copies uses.
 * @type {symbol}
 * @internal
 */
export const COPY_SOURCE_URL = Symbol("slothlet.copySourceURL");

/**
 * The key of the instance's method that hands a run's own build the seal its CommonJS leaves' scripts are sealed for:
 * one per `restart()` of the run, shared by the reloads in the run after it (see `SEALED_BUILDS` in
 * helpers/instance-imports).
 * @type {symbol}
 * @internal
 */
export const RUN_BUILD_SEAL = Symbol("slothlet.runBuildSeal");

/**
 * How many run records are not yet `done`, across every instance.
 * @type {number}
 * @private
 */
let liveRuns = 0;

/**
 * How many copies instances hold apart from what they have now (kept tokens and runs' forks), across every instance.
 * @type {number}
 * @private
 */
let heldCopies = 0;

/**
 * How many records of runs whose work is done are waiting for their instance to tear their copies down, across every
 * instance.
 * @type {number}
 * @private
 */
let retiringRuns = 0;

/**
 * How many instances have their copy fields as accessors (read through the run's copy) rather than plain fields.
 * @type {number}
 * @private
 */
let readThrough = 0;

/**
 * Called with true when the first run record opens and with false when the last one is done: the runtimes count
 * the work of runs only while there is a run to count it for.
 * @type {Array<function(boolean): void>}
 * @private
 */
const runWatchers = [];

/**
 * Be told when runs start and stop needing their work counted (see {@link runWatchers}).
 * @param {function(boolean): void} watcher - Called with true and false in turn.
 * @returns {void}
 * @internal
 */
export function watchRuns(watcher) {
	listPush(runWatchers, watcher);
	if (watchersLive) watcher(true);
}

/**
 * Tell the watchers that runs started or stopped needing their work counted.
 * @param {boolean} live - True when the first run opened, false when the last one is done.
 * @returns {void}
 * @private
 */
function tellRunWatchers(live) {
	for (let index = 0; index < runWatchers.length; index++) runWatchers[index](live);
}

/**
 * Whether the watchers were last told that runs are live.
 * @type {boolean}
 * @private
 */
let watchersLive = false;

/**
 * Whether a check that tells the watchers runs stopped is scheduled.
 * @type {boolean}
 * @private
 */
let watchersCheck = false;

/**
 * The last run is done: tell the watchers so once the process is idle and still no run is live, so a burst of runs one
 * after another does not switch the counting on and off for each.
 * @returns {void}
 * @private
 */
function runsStopped() {
	if (watchersCheck) return;
	watchersCheck = true;
	whenIdle(() => {
		watchersCheck = false;
		if (liveRuns !== 0 || !watchersLive) return;
		watchersLive = false;
		tellRunWatchers(false);
	});
}

/**
 * Count a new run record as live.
 * @param {object} record - The record.
 * @returns {object} The record.
 * @private
 */
function openRun(record) {
	if (liveRuns++ === 0 && !watchersLive) {
		watchersLive = true;
		tellRunWatchers(true);
	}
	const owner = record.owner;
	if (owner !== null && typeof owner[RUN_OPENED] === "function") owner[RUN_OPENED](record);
	return record;
}

/**
 * The type of an `AsyncResource` slothlet makes only to carry the store active where it is made into a callback that
 * runs later (an observer's), which is no run's work by itself: the async runtime does not count it (see `#countWork` in
 * `handlers/context-async`). The work it stands for is counted some other way (an observer from its first `observe()`).
 * @type {string}
 * @internal
 */
export const UNCOUNTED_RESOURCE = "slothlet-observer";

/**
 * How many instances on the async runtime are up (see {@link countAsyncInstance}).
 * @type {number}
 * @private
 */
let asyncInstances = 0;

/**
 * Count an instance on the async runtime in or out, so a boundary that carries the AsyncLocalStorage store with an
 * `AsyncResource` of its own (an observer's callback) makes one only while there is a store to carry: a process whose
 * instances all use the live runtime makes none.
 * @param {number} delta - +1 or -1.
 * @returns {void}
 * @internal
 */
export function countAsyncInstance(delta) {
	asyncInstances += delta;
}

/**
 * Whether any instance on the async runtime is up (see {@link countAsyncInstance}).
 * @returns {boolean} True while one is.
 * @internal
 */
export function anyAsyncInstance() {
	return asyncInstances > 0;
}

/**
 * Set while slothlet makes something that is no run's work (see {@link asNoRunWork}).
 * @type {boolean}
 * @private
 */
let noRunWork = false;

/**
 * Run `fn`, slothlet's own code, with nothing it makes counted as a run's work: a resource it makes and is done with
 * within the call (a synchronous job the platform only reports destroyed once its object is collected) would otherwise
 * keep the run's copy until then.
 * @template T
 * @param {function(): T} fn - What to run.
 * @returns {T} What it returned.
 * @internal
 */
export function asNoRunWork(fn) {
	const previous = noRunWork;
	noRunWork = true;
	try {
		return fn();
	} finally {
		noRunWork = previous;
	}
}

/**
 * Count one more piece of work tied to a run: begun in the run, not finished yet. Work begun by the run's last piece of
 * work while it still runs (an interval's callback that clears the interval and sets a timer) counts too, until the
 * copy is torn down. A record whose copy is torn down takes no more: what still runs in its store then (code reached
 * through the runtime `context` export) does not keep it.
 * @param {object|null|undefined} record - The run's record.
 * @returns {boolean} True when it was counted, and must be released once with {@link releaseRunWork}.
 * @internal
 */
export function holdRunWork(record) {
	if (record === null || record === undefined || record.torn || noRunWork) return false;
	if (record.done) {
		record.done = false;
		openRun(record);
	}
	record.work++;
	return true;
}

/**
 * Run `fn` on a later macrotask, once the work running now and every microtask it queued have run: with the host's
 * own `setImmediate` (or `setTimeout` where it has none) as they were when slothlet loaded, so a host faking timers
 * does not hold it back, and unref'd, so it never keeps a process alive. The macrotask is no run's work.
 * @param {Function} fn - What to run.
 * @returns {void}
 * @internal
 */
export function whenIdle(fn) {
	const handle = asNoRunWork(() => (typeof setImmediate === "function" ? setImmediate(fn) : setTimeout(fn, 0)));
	if (typeof handle?.unref === "function") handle.unref();
}

/**
 * Run `fn` on a microtask, once the code running now has returned: with the host's own `queueMicrotask` as it was when
 * slothlet loaded. The microtask is no run's work.
 * @param {Function} fn - What to run.
 * @returns {void}
 * @internal
 */
export function afterCurrentWork(fn) {
	asNoRunWork(() => queueMicrotask(fn));
}

/**
 * Uncount one piece of a run's work (see {@link holdRunWork}), or the run's callback once it has settled. The last
 * one makes the record `done` and tells the instance, which tears the copy down once it is idle.
 * @param {object} record - The run's record.
 * @returns {void}
 * @internal
 */
export function releaseRunWork(record) {
	if (record.done || --record.work !== 0) return;
	endRun(record);
}

/**
 * Mark a run record `done` and tell its instance (see {@link releaseRunWork}); `shutdown()` ends every record still
 * live this way.
 * @param {object} record - The record.
 * @returns {void}
 * @internal
 */
export function endRun(record) {
	if (record.done) return;
	record.done = true;
	record.work = 0;
	if (--liveRuns === 0) runsStopped();
	const owner = record.owner;
	if (owner !== null && typeof owner[RUN_DONE] === "function") owner[RUN_DONE](record);
}

/**
 * A releaser for one piece of a run's work that ends once, whichever way it ends first (a timer that fires or is
 * cleared, a listener removed): the first call releases it, later calls do nothing.
 * @param {object|null|undefined} record - The run's record.
 * @returns {Function|null} The releaser, or null when nothing was counted.
 * @internal
 */
export function holdRunWorkOnce(record) {
	if (!holdRunWork(record)) return null;
	let held = record;
	return () => {
		if (held === null) return;
		const released = held;
		held = null;
		releaseRunWork(released);
	};
}

/**
 * Calls each release it holds once the object it was registered for is collected (see {@link releaseWhenCollected}).
 * Null where the platform has no `FinalizationRegistry`.
 * @type {FinalizationRegistry<Function>|null}
 * @private
 */
const COLLECTED_WORK = typeof FinalizationRegistry === "function" ? new FinalizationRegistry((release) => release()) : null;

/**
 * Release a piece of a run's work once `target`, the object the work lives on, has been collected: a promise nobody
 * can settle any more, a listener whose emitter is garbage, an observer nobody holds. Nothing can run that work's code
 * then, so it no longer keeps the run's record. `release` must release at most once (as a {@link holdRunWorkOnce}
 * releaser does), so the work ending the usual way first makes the later call a no-op, and must not reach `target`.
 * @param {object} target - The object the work lives on.
 * @param {Function|null} release - What releases the work; null when nothing was counted.
 * @param {object} [token] - For work that ends while `target` lives on (a handler replaced on its target, an observer
 *   disconnected): {@link stopReleaseWhenCollected} with it then, so a long-lived target does not gather entries.
 * @returns {void}
 * @internal
 */
export function releaseWhenCollected(target, release, token) {
	if (release === null || COLLECTED_WORK === null) return;
	if (token === undefined) FinalizationRegistryMethods.register(COLLECTED_WORK, target, release);
	else FinalizationRegistryMethods.register(COLLECTED_WORK, target, release, token);
}

/**
 * Drop what {@link releaseWhenCollected} registered under `token`: the work ended the usual way.
 * @param {object} token - The token.
 * @returns {void}
 * @internal
 */
export function stopReleaseWhenCollected(token) {
	if (COLLECTED_WORK !== null) FinalizationRegistryMethods.unregister(COLLECTED_WORK, token);
}

/**
 * Count a copy an instance holds apart from what it has now, or uncount one.
 * @param {number} delta - +1 or -1.
 * @returns {void}
 * @internal
 */
export function countHeldCopy(delta) {
	heldCopies += delta;
}

/**
 * Count records waiting for their instance to tear their copies down, or uncount them.
 * @param {number} delta - How many more (or, negative, fewer).
 * @returns {void}
 * @internal
 */
export function countRetiring(delta) {
	retiringRuns += delta;
}

/**
 * How many records of runs whose work is done are waiting for their instance to tear their copies down, across every
 * instance: for the suite.
 * @returns {number} The count.
 * @internal
 */
export function retiringRunCount() {
	return retiringRuns;
}

/**
 * Count an instance whose copy fields became accessors, or plain fields again.
 * @param {number} delta - +1 or -1.
 * @returns {void}
 * @internal
 */
export function countReadThrough(delta) {
	readThrough += delta;
}

/**
 * How many run records are live, how many copies are held, and how many instances read their fields through a copy,
 * across every instance: for the suite.
 * @returns {{runs: number, held: number, readThrough: number}} The counts.
 * @internal
 */
export function runCopyCounts() {
	return { runs: liveRuns, held: heldCopies, readThrough };
}

/**
 * The copy record for a new `run()` / `scope()` store: an object of its own, never shared with another run. It reads
 * through to the copy its parent run reads (a nested run), else to the copy the instance has now. A nested run whose
 * parent holds a fork starts with a copy of the parent's handlers namespace, so the parent's later writes and its own
 * stay apart.
 * @param {object|null|undefined} slothlet - The instance object.
 * @param {object|null|undefined} parentStore - The store the run is opened in.
 * @returns {{from: {values: object|null}, parent: object|null, ns: object|null, values: object|null, work: number, done: boolean}|null} The
 *   record, or null when the instance hands out no copy token.
 * @internal
 */
export function copyForRun(slothlet, parentStore) {
	let parent = parentStore?.[RUN_COPY] ?? null;
	// A store whose run's copy is torn down (code reached through the runtime `context` export) opens a run as the
	// instance would.
	if (parent !== null && parent.torn) parent = null;
	if (parent !== null) {
		if (parent.ns === null || typeof slothlet?.[INHERIT_COPY] !== "function")
			return withSnapshot(openRun(newRecord(parent.from, parent, null, slothlet)), slothlet, parent);
		return withSnapshot(openRun(slothlet[INHERIT_COPY](parent)), slothlet, parent);
	}
	if (typeof slothlet?.[CURRENT_COPY] !== "function") return null;
	return withSnapshot(openRun(newRecord(slothlet[CURRENT_COPY](), null, null, slothlet)), slothlet, null);
}

/**
 * Give a new run record its snapshot (see `helpers/run-snapshot`): the tick of the instance's clock it reads the
 * instance at, taken now, and, for a nested run, its start on the run it was opened in. It is closed when the run's
 * copy is torn down.
 * @param {object} record - The record.
 * @param {object} slothlet - The instance object.
 * @param {object|null} parent - The record of the run it was opened in.
 * @returns {object} The record.
 * @private
 */
function withSnapshot(record, slothlet, parent) {
	record.snap = openRunSnapshot(slothlet, parent?.snap ?? null);
	// The tree an outermost run starts on: the one the calling code answers from now.
	if (parent === null) record.snap.root = slothlet.api ?? null;
	return record;
}

/**
 * A new run record (see {@link RUN_COPY}): its callback counted as its first piece of work, and the copy token it
 * reads through to counting it among its users.
 * @param {{values: object|null, users?: number}} from - The copy token.
 * @param {object|null} parent - The record of the run it was opened in.
 * @param {object|null} ns - Its own handlers namespace, or null.
 * @param {object|null} owner - The instance object.
 * @returns {object} The record.
 * @internal
 */
export function newRecord(from, parent, ns, owner) {
	from.users = (from.users ?? 0) + 1;
	return {
		__proto__: null,
		from,
		parent,
		ns,
		values: null,
		work: 1,
		done: false,
		torn: false,
		retired: 0,
		stores: null,
		tracked: null,
		owner: owner ?? null,
		snap: null,
		restart: parent?.restart
			? {
					epoch: parent.restart.epoch,
					stamps: setFrom(setToArray(parent.restart.stamps)),
					seal: parent.restart.seal ?? null,
					seals: parent.restart.seals ?? []
				}
			: null
	};
}

/**
 * The object a forkable handler's write goes to: the handler itself, or, for a write made by code in a `run()` /
 * `scope()`, the run's own fork of it (made on the run's first write). A write from outside any run goes to the
 * instance's handler, after every copy that still shares it got a fork of its own.
 * @template T
 * @param {T} component - The handler being written.
 * @param {boolean} [instanceOnly=false] - True for teardown the instance does to its own handler (`shutdown()`): it
 *   never forks for a run, it only keeps the copies that share the handler as they are.
 * @returns {T} The handler to write.
 * @internal
 */
export function writeTarget(component, instanceOnly = false) {
	const slothlet = component.slothlet;
	const choose = slothlet?.[WRITE_TARGET];
	return typeof choose === "function" ? Reflect.apply(choose, slothlet, [component, instanceOnly]) : component;
}

/**
 * Ready the api tree for a change the calling code is about to make (`api.slothlet.api.add()` / `remove()` /
 * `reload()`, a module mount): code in a `run()` / `scope()` changes a tree of its own, which the run gets on its first
 * change, and a copy that still reads the tree being changed (a run that started on it) gets one of its own first.
 * Resolves at once for an instance that keeps no copies.
 * @param {object|null|undefined} slothlet - The instance.
 * @returns {Promise<void>|undefined} Settles once the tree may be changed.
 * @internal
 */
export function treeWrite(slothlet) {
	const ready = slothlet?.[TREE_WRITE];
	return typeof ready === "function" ? Reflect.apply(ready, slothlet, []) : undefined;
}

/**
 * Record an operation (an add, a removal, a rule change) in the history the calling code's copy of the api tree
 * replays on a reload: the instance's, or the run's own.
 * @param {object} slothlet - The instance.
 * @param {object} operation - The operation.
 * @returns {void}
 * @internal
 */
export function recordOperation(slothlet, operation) {
	const record = slothlet?.[RECORD_OPERATION];
	if (typeof record === "function") {
		Reflect.apply(record, slothlet, [operation]);
		return;
	}
	const history = slothlet?.handlers?.apiManager?.state?.operationHistory;
	if (history) listPush(history, operation);
}

/**
 * Each instance object's recorded stores.
 * @type {WeakMap<object, Set<WeakRef<object>>>}
 * @private
 */
const STORES = new WeakMap();

/**
 * Each instance object's records of runs whose copies are not torn down yet and that hold stores of theirs (see
 * {@link trackFlowStore}).
 * @type {WeakMap<object, Set<object>>}
 * @private
 */
const RUN_STORES = new WeakMap();

/**
 * Let go of the stores a run's record holds for a reload to move (see {@link trackFlowStore}): its copy is torn down.
 * @param {object} record - The record.
 * @returns {void}
 * @internal
 */
export function untrackRunStores(record) {
	if ((record.stores ?? null) === null) return;
	SetMethods.delete(record.tracked, record);
	record.stores = null;
	record.tracked = null;
}

/**
 * Drops a collected store's reference from its instance's set.
 * @type {FinalizationRegistry<{stores: Set<WeakRef<object>>, ref: WeakRef<object>}>|null}
 * @private
 */
const COLLECTED =
	typeof FinalizationRegistry === "function" && typeof WeakRef === "function"
		? new FinalizationRegistry(({ stores, ref }) => SetMethods.delete(stores, ref))
		: null;

/**
 * Record a `run()` / `scope()` store against the instance object that opened it, so a reload can move it to the
 * instance's new ID (see {@link reparentFlowStores}): on its run's record while the run's copy is not torn down (the
 * work the run left behind keeps it so), else weakly.
 * @param {object|null|undefined} slothlet - The instance object (the store's `slothlet`).
 * @param {object} store - The store.
 * @returns {void}
 * @internal
 */
export function trackFlowStore(slothlet, store) {
	if (slothlet === null || typeof slothlet !== "object") return;
	const record = store[RUN_COPY];
	// A store of a run whose copy is not torn down yet is held by its record, which the instance holds until then: a
	// reference of its own would be a WeakRef, whose target the engine keeps until the microtask queue is empty, which
	// code awaiting runs back to back never lets it be.
	if (record !== null && record !== undefined && !record.torn) {
		if ((record.stores ?? null) === null) {
			let records = WeakMapMethods.get(RUN_STORES, slothlet);
			if (records === undefined) {
				records = new Set();
				WeakMapMethods.set(RUN_STORES, slothlet, records);
			}
			SetMethods.add(records, record);
			record.stores = [store];
			record.tracked = records;
		} else listPush(record.stores, store);
		return;
	}
	if (COLLECTED === null) return;
	let stores = WeakMapMethods.get(STORES, slothlet);
	if (stores === undefined) {
		stores = new Set();
		WeakMapMethods.set(STORES, slothlet, stores);
	}
	const ref = new WeakRef(store);
	SetMethods.add(stores, ref);
	FinalizationRegistryMethods.register(COLLECTED, store, { stores, ref });
}

/**
 * Move every recorded store of an instance whose `parentInstanceID` is one of `fromIDs` to `toID`.
 * @param {object} slothlet - The instance object.
 * @param {ReadonlyArray<string|null|undefined>} fromIDs - The IDs the instance had before.
 * @param {string} toID - Its ID now.
 * @returns {void}
 * @internal
 */
export function reparentFlowStores(slothlet, fromIDs, toID) {
	if (slothlet === null || typeof slothlet !== "object") return;
	const records = WeakMapMethods.get(RUN_STORES, slothlet);
	if (records !== undefined) {
		for (const record of setValues(records)) {
			for (let index = 0; index < record.stores.length; index++) reparentStore(record.stores[index], fromIDs, toID);
		}
	}
	const stores = WeakMapMethods.get(STORES, slothlet);
	if (stores === undefined) return;
	for (const ref of setValues(stores)) {
		const store = WeakRefMethods.deref(ref);
		if (store === undefined) {
			SetMethods.delete(stores, ref);
			continue;
		}
		reparentStore(store, fromIDs, toID);
	}
}

/**
 * Move one store whose `parentInstanceID` is one of `fromIDs` to `toID` (see {@link reparentFlowStores}).
 * @param {object} store - The store.
 * @param {ReadonlyArray<string|null|undefined>} fromIDs - The IDs the instance had before.
 * @param {string} toID - Its ID now.
 * @returns {void}
 * @private
 */
function reparentStore(store, fromIDs, toID) {
	const parent = store.parentInstanceID;
	if (parent === toID) return;
	for (let index = 0; index < fromIDs.length; index++) {
		if (fromIDs[index] !== null && fromIDs[index] !== undefined && parent === fromIDs[index]) {
			store.parentInstanceID = toID;
			return;
		}
	}
}

/**
 * Forget every recorded store of an instance object that has shut down.
 * @param {object} slothlet - The instance object.
 * @returns {void}
 * @internal
 */
export function forgetFlowStores(slothlet) {
	if (slothlet === null || typeof slothlet !== "object") return;
	WeakMapMethods.delete(STORES, slothlet);
	WeakMapMethods.delete(RUN_STORES, slothlet);
}
