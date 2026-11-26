/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/flow-stores-records.test.vitest.mjs
 *	@Date: 2026-11-25T01:36:48-08:00 (1795599408)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:31-08:00 (1795600291)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The run-record bookkeeping of `helpers/flow-stores`, called directly.
 *
 * @description
 * A `run()` / `scope()` keeps a record of its copy of the instance and of the work still pending in it. The runtimes
 * open, hold, release and end those records; the instance answers through symbol-keyed methods (`CURRENT_COPY`,
 * `TREE_WRITE`, `RECORD_OPERATION`, `RUN_DONE`). These cases drive the edges those callers rarely reach: a watcher
 * added while a run is open, a record ended twice, an owner with no `RUN_DONE`, a parent store whose copy is torn down,
 * an instance that keeps no copies, a store moved between ids, and a platform without `setImmediate` or
 * `FinalizationRegistry`.
 * @module tests/vitests/suites/context/flow-stores-records
 */

import { pathToFileURL } from "node:url";
import { describe, it, expect, vi } from "vitest";
import {
	RUN_COPY,
	RUN_DONE,
	RECORD_OPERATION,
	TREE_WRITE,
	watchRuns,
	holdRunWork,
	endRun,
	copyForRun,
	newRecord,
	treeWrite,
	recordOperation,
	trackFlowStore,
	reparentFlowStores,
	forgetFlowStores
} from "#helpers/flow-stores";
import { internalLibPath } from "../../setup/internal-resolve.mjs";

/**
 * A record of a run that has ended, ready to be opened again by {@link holdRunWork}.
 * @param {object|null} [owner] - The instance it belongs to.
 * @returns {object} The record.
 */
const endedRecord = (owner = null) => ({ done: true, work: 0, torn: false, owner });

describe("Context > flow stores > run records", () => {
	it("tells a watcher added while a run is open at once, and again once the process is idle after the run ends", async () => {
		const record = endedRecord();
		expect(holdRunWork(record)).toBe(true);
		const told = [];
		watchRuns((live) => told.push(live));
		expect(told).toEqual([true]);
		endRun(record);
		await new Promise((resolve) => setImmediate(resolve));
		await new Promise((resolve) => setImmediate(resolve));
		expect(told).toEqual([true, false]);
	});

	it("ends a record once, and tells an owner only when it has a RUN_DONE", () => {
		const ended = [];
		const owner = { [RUN_DONE]: (record) => ended.push(record) };
		const told = endedRecord(owner);
		holdRunWork(told);
		endRun(told);
		endRun(told);
		expect(ended).toEqual([told]);

		const silent = endedRecord({});
		holdRunWork(silent);
		endRun(silent);
		expect(silent.done).toBe(true);
	});

	it("opens a run as the instance would when the parent store's copy is torn down", () => {
		expect(copyForRun({}, { [RUN_COPY]: { torn: true } })).toBe(null);
		expect(copyForRun(null, undefined)).toBe(null);
	});

	it("makes a record with no owner, and carries a parent's restart with no seals", () => {
		const parent = { restart: { epoch: 3, stamps: new Set(["a"]) } };
		const record = newRecord({ values: null }, parent, null, undefined);
		expect(record.owner).toBe(null);
		expect(record.restart.epoch).toBe(3);
		expect(record.restart.seal).toBe(null);
		expect(record.restart.seals).toEqual([]);
		expect([...record.restart.stamps]).toEqual(["a"]);
	});
});

describe("Context > flow stores > instance hooks", () => {
	it("readies a tree write through the instance, or not at all for one that keeps no copies", async () => {
		expect(treeWrite({})).toBe(undefined);
		expect(treeWrite(null)).toBe(undefined);
		let readied = 0;
		await treeWrite({
			[TREE_WRITE]() {
				readied++;
				return Promise.resolve();
			}
		});
		expect(readied).toBe(1);
	});

	it("records an operation through the instance, in its history, or nowhere", () => {
		const recorded = [];
		recordOperation({ [RECORD_OPERATION]: (operation) => recorded.push(operation) }, "a");
		expect(recorded).toEqual(["a"]);
		const operationHistory = [];
		recordOperation({ handlers: { apiManager: { state: { operationHistory } } } }, "b");
		expect(operationHistory).toEqual(["b"]);
		expect(() => recordOperation({}, "c")).not.toThrow();
		expect(() => recordOperation(null, "d")).not.toThrow();
	});
});

describe("Context > flow stores > stores moved to a new id", () => {
	it("moves a store whose parent is one of the old ids, skipping null and undefined ids", () => {
		const slothlet = {};
		const store = { parentInstanceID: "old" };
		const other = { parentInstanceID: "unrelated" };
		const current = { parentInstanceID: "new" };
		trackFlowStore(slothlet, store);
		trackFlowStore(slothlet, other);
		trackFlowStore(slothlet, current);
		reparentFlowStores(slothlet, [null, undefined, "old"], "new");
		expect(store.parentInstanceID).toBe("new");
		expect(other.parentInstanceID).toBe("unrelated");
		expect(current.parentInstanceID).toBe("new");
		forgetFlowStores(slothlet);
		store.parentInstanceID = "old";
		reparentFlowStores(slothlet, ["old"], "newer");
		expect(store.parentInstanceID).toBe("old");
	});

	it("does nothing for something that is no instance object", () => {
		expect(() => trackFlowStore(null, {})).not.toThrow();
		expect(() => reparentFlowStores(null, ["a"], "b")).not.toThrow();
		expect(() => reparentFlowStores(5, ["a"], "b")).not.toThrow();
		expect(() => forgetFlowStores(null)).not.toThrow();
		expect(() => forgetFlowStores("x")).not.toThrow();
	});
});

describe("Context > flow stores > platforms without some globals", () => {
	let copies = 0;

	/**
	 * A copy of the module that takes `overrides` in place of what it imports from `#helpers/intrinsics`.
	 * @param {object} overrides - The members replaced.
	 * @returns {Promise<object>} The copy.
	 */
	async function copyWith(overrides) {
		vi.doMock("#helpers/intrinsics", async (importOriginal) => ({ ...(await importOriginal()), ...overrides }));
		try {
			return await import(`${pathToFileURL(internalLibPath("helpers/flow-stores.mjs")).href}?platform=${++copies}`);
		} finally {
			vi.doUnmock("#helpers/intrinsics");
		}
	}

	it("runs idle work on setTimeout where there is no setImmediate, also with a handle that has no unref", async () => {
		const queued = [];
		const copy = await copyWith({
			setImmediate: undefined,
			setTimeout: (fn) => {
				queued.push(fn);
				return queued.length;
			}
		});
		let ran = 0;
		copy.whenIdle(() => ran++);
		expect(queued.length).toBe(1);
		queued[0]();
		expect(ran).toBe(1);
	});

	it("keeps no weak records where there is no FinalizationRegistry", async () => {
		const copy = await copyWith({ FinalizationRegistry: undefined });
		const token = {};
		let released = 0;
		copy.releaseWhenCollected({}, () => released++, token);
		copy.stopReleaseWhenCollected(token);
		const slothlet = {};
		const store = { parentInstanceID: "old" };
		copy.trackFlowStore(slothlet, store);
		copy.reparentFlowStores(slothlet, ["old"], "new");
		// Not recorded, so not moved.
		expect(store.parentInstanceID).toBe("old");
		expect(released).toBe(0);
	});

	it("records no stores weakly where there is a FinalizationRegistry but no WeakRef", async () => {
		const copy = await copyWith({ WeakRef: undefined });
		const slothlet = {};
		const store = { parentInstanceID: "old" };
		copy.trackFlowStore(slothlet, store);
		copy.reparentFlowStores(slothlet, ["old"], "new");
		expect(store.parentInstanceID).toBe("old");
	});
});
