/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/host/records.mjs
 *	@Date: 2026-11-08T12:12:14-08:00 (1794168734)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:30:00-08:00 (1794169800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host's record leaves of the #717 tests, the shape of rummage's `host.records.*`: an object a factory
 * returns, added with `api.slothlet.api.add(["host", "records"], makeRecords(() => api))`. Each leaf opens a store
 * partition its own way: directly, through a helper of this file, through a helper of another of the host's files,
 * through a package only the host imports, through a package the calling module imports too, or by running what its
 * caller handed it. `invoke` is a function of the host's
 * it hands modules.
 * @module api_tests/api_test_host_record_leaf/host/records
 */

import { callThrough } from "host-pkg";
import { relay } from "c-pkg";
import { invoke as sharedInvoke } from "ext-pkg";
import { openPartition } from "./partition-helper.mjs";

/**
 * Open a partition, reporting the code and caller it was refused with instead of throwing.
 * @param {() => object} getApi - The host's api.
 * @returns {string} The partition, or `"<code>:<caller>"`.
 */
function tryPartition(getApi) {
	try {
		return getApi().store.partition();
	} catch (error) {
		return `${error?.code}:${error?.context?.caller ?? null}`;
	}
}

/**
 * A helper of this file that opens a partition.
 * @param {() => object} getApi - The host's api.
 * @returns {string} The partition.
 */
function partitionHere(getApi) {
	return getApi().store.partition();
}

/**
 * A generic function of the host's, which the host hands modules: it calls a method of an object.
 * @param {object} obj - The object.
 * @param {string} name - The method's name.
 * @returns {unknown} What it returned.
 * @example
 * invoke(api.store, "partition"); // "p:…"
 */
export function invoke(obj, name) {
	return obj[name]();
}

/**
 * Build the host's record leaves.
 * @param {() => object} getApi - The host's api, once it exists.
 * @returns {Record<string, Function>} The leaves.
 * @example
 * await api.slothlet.api.add(["host", "records"], makeRecords(() => api));
 */
export function makeRecords(getApi) {
	return {
		apply(options) {
			const via = options?.via;
			if (via === "file") return openPartition(getApi);
			if (via === "package") return callThrough(() => getApi().store.partition());
			if (via === "packageCalls") return callThrough(getApi().store.partition);
			if (via === "otherPackage") return relay(() => getApi().store.partition());
			if (via === "otherPackageCalls") return relay(getApi().store.partition);
			if (via === "callerPackage") return sharedInvoke({ open: () => getApi().store.partition() }, "open");
			if (via === "callerPackageCalls") return sharedInvoke(getApi().store, "partition");
			return getApi().store.partition();
		},
		query(_) {
			return partitionHere(getApi);
		},
		run(fn, _) {
			return fn();
		},
		use(value) {
			return String(value.id);
		},
		convert(value) {
			return String(value);
		},
		async settle(value) {
			return await value;
		},
		async later(_) {
			// Registered in the leaf's synchronous part, then run after it returned its promise.
			const inTimer = new Promise((resolve) => setTimeout(() => resolve(tryPartition(getApi)), 1));
			const inReaction = Promise.resolve().then(() => tryPartition(getApi));
			await null;
			const afterAwait = tryPartition(getApi);
			const timerAfterAwait = await new Promise((resolve) => setTimeout(() => resolve(tryPartition(getApi)), 1));
			return { inTimer: await inTimer, inReaction: await inReaction, afterAwait, timerAfterAwait };
		}
	};
}
