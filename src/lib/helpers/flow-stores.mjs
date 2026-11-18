/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/flow-stores.mjs
 *	@Date: 2026-11-17T16:18:23-08:00 (1794961103)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T16:28:04-08:00 (1794961684)
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
 * @module @cldmv/slothlet/helpers/flow-stores
 * @internal
 */
import {
	FinalizationRegistry,
	FinalizationRegistryMethods,
	Set,
	SetMethods,
	setValues,
	WeakMap,
	WeakMapMethods,
	WeakRef,
	WeakRefMethods
} from "#helpers/intrinsics";

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
