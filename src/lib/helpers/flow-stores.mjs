/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/flow-stores.mjs
 *	@Date: 2026-11-17T16:18:23-08:00 (1794961103)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T19:49:40-08:00 (1794973780)
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
	Reflect,
	Set,
	SetMethods,
	setValues,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakRef,
	WeakRefMethods
} from "#helpers/intrinsics";

/**
 * The key a `run()` / `scope()` store records its copy of the instance under. Every run gets a record of its own (see
 * {@link copyForRun}): `from` is the token of the copy that was current when the run started, shared with every run
 * that started on that copy, `parent` is the record of the run it was opened in (null for a run opened outside any),
 * and `ns` is the run's own handlers namespace once it holds a fork (null until then). The stores of the run's calls
 * and of work it left behind carry the run's record with the rest of the store.
 *
 * While the instance has not changed since the token was handed out, the token's `values` is null and the instance's
 * own fields answer. The first change after that, a reload's swap or a write to one of the forkable handlers (see
 * {@link FORK}) from outside any run, makes the token keep what the instance had: `values` then holds that copy. A
 * write from code in a run forks the written handler into the run's `ns` (see `Slothlet#writeTarget`), which the run
 * then reads first. A nested run starts with its own copy of its parent's `ns`.
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
 * The copy record for a new `run()` / `scope()` store: an object of its own, never shared with another run. It reads
 * through to the copy its parent run reads (a nested run), else to the copy the instance has now. A nested run whose
 * parent holds a fork starts with a copy of the parent's handlers namespace, so the parent's later writes and its own
 * stay apart.
 * @param {object|null|undefined} slothlet - The instance object.
 * @param {object|null|undefined} parentStore - The store the run is opened in.
 * @returns {{from: {values: object|null}, parent: object|null, ns: object|null}|null} The record, or null when the
 *   instance hands out no copy token.
 * @internal
 */
export function copyForRun(slothlet, parentStore) {
	const parent = parentStore?.[RUN_COPY] ?? null;
	if (parent !== null) {
		if (parent.ns === null || typeof slothlet?.[INHERIT_COPY] !== "function")
			return { __proto__: null, from: parent.from, parent, ns: null };
		return slothlet[INHERIT_COPY](parent);
	}
	if (typeof slothlet?.[CURRENT_COPY] !== "function") return null;
	return { __proto__: null, from: slothlet[CURRENT_COPY](), parent: null, ns: null };
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
 * Each instance object's recorded stores.
 * @type {WeakMap<object, Set<WeakRef<object>>>}
 * @private
 */
const STORES = new WeakMap();

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
 * instance's new ID (see {@link reparentFlowStores}).
 * @param {object|null|undefined} slothlet - The instance object (the store's `slothlet`).
 * @param {object} store - The store.
 * @returns {void}
 * @internal
 */
export function trackFlowStore(slothlet, store) {
	if (COLLECTED === null || slothlet === null || typeof slothlet !== "object") return;
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
	const stores = slothlet === null || typeof slothlet !== "object" ? undefined : WeakMapMethods.get(STORES, slothlet);
	if (stores === undefined) return;
	for (const ref of setValues(stores)) {
		const store = WeakRefMethods.deref(ref);
		if (store === undefined) {
			SetMethods.delete(stores, ref);
			continue;
		}
		const parent = store.parentInstanceID;
		if (parent === toID) continue;
		for (let index = 0; index < fromIDs.length; index++) {
			if (fromIDs[index] !== null && fromIDs[index] !== undefined && parent === fromIDs[index]) {
				store.parentInstanceID = toID;
				break;
			}
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
	if (slothlet !== null && typeof slothlet === "object") WeakMapMethods.delete(STORES, slothlet);
}
