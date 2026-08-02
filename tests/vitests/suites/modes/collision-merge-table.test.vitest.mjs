/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modes/collision-merge-table.test.vitest.mjs
 *	@Date: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The documented collision table, pinned against real file+directory collisions.
 *
 * @description
 * MIGRATION.md's collision-mode table is the specification: under the default `merge`, on a
 * conflict the FIRST loaded wins and non-conflicting keys from both sources are added; files load
 * before directories at every level. Pinned against both composition branches of the fixture base:
 *
 *   api_test_collisions/
 *   ├── tool.mjs        level="file", origin="file"            ← loads first
 *   ├── tool/tool.mjs   default fn tool(x), level="dir"        ← SINGLE-file directory (C10 route)
 *   ├── clog.mjs        level="file", origin="file"            ← loads first
 *   └── clog/
 *       ├── clog.mjs    default fn clog(x), level="dir"        ← MULTI-file directory (Case-2 route)
 *       └── extra.mjs   ping="extra"                            ← sibling → child namespace
 *
 * Documented outcome, identical in both modes:
 *   api.tool("x")  → "tool:x"    api.tool.level → "file"    api.tool.origin → "file"
 *   api.clog("x")  → "clog:x"    api.clog.level → "file"    api.clog.origin → "file"
 *   api.clog.extra.ping → "extra"
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_collisions", import.meta.url).pathname;

/**
 * Assert one composed collision slot against the documented merge outcome.
 * @param {Function} slot - The composed api value (callable with members).
 * @param {string} tag - The callable's expected tag ("tool" or "clog").
 * @param {Function} read - Mode-appropriate member reader: (value) => resolved member.
 * @returns {Promise<void>} Resolves when every member has been asserted.
 */
const expectMergedSlot = async (slot, tag, read) => {
	expect(typeof slot).toBe("function");
	// Conflict: `level` exists in both sources — the FIRST loaded (the root file) wins.
	expect(await read(slot.level)).toBe("file");
	// Non-conflicting members from both sources are added.
	expect(await read(slot.origin)).toBe("file");
};

describe("Modes > documented collision table (merge: first loaded wins, both sources added)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("eager composes the single-file collision per the table", async () => {
		api = await slothlet({ mode: "eager", base: BASE });

		expect(api.tool("x")).toBe("tool:x");
		await expectMergedSlot(api.tool, "tool", (v) => v);
	});

	it("lazy composes the single-file collision per the table", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });

		expect(await api.tool("x")).toBe("tool:x");
		await expectMergedSlot(await api.tool, "tool", (v) => v);
	});

	it("eager composes the multi-file collision per the table", async () => {
		api = await slothlet({ mode: "eager", base: BASE });

		expect(api.clog("x")).toBe("clog:x");
		await expectMergedSlot(api.clog, "clog", (v) => v);
		expect(api.clog.extra.ping).toBe("extra");
	});

	it("lazy composes the multi-file collision per the table", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });

		expect(await api.clog("x")).toBe("clog:x");
		await expectMergedSlot(await api.clog, "clog", (v) => v);
		expect(await api.clog.extra.ping).toBe("extra");
	});

	it("merge-replace: the second loaded wins conflicts, both sources still added", async () => {
		api = await slothlet({ mode: "eager", base: BASE, collision: "merge-replace" });

		// Same shape, inverted conflict outcome per the table row: the directory (second) wins
		// `level`; the file's non-conflicting `origin` still carries across.
		expect(api.clog("x")).toBe("clog:x");
		expect(api.clog.level).toBe("dir");
		expect(api.clog.origin).toBe("file");
	});

	it("merge keeps the first-loaded callable when both sources are callable", async () => {
		api = await slothlet({ mode: "eager", base: BASE });

		// Two competing functions are a conflict like any other: the file loaded first, so its
		// callable keeps the slot; the directory still contributes everything non-conflicting.
		expect(api.pair.crog()).toBe("file-crog");
		expect(api.pair.crog.origin).toBe("file");
		expect(api.pair.crog.mode).toBe("dir");
		expect(api.pair.crog.extra.ping).toBe("extra");
	});

	it("merge keeps the first-loaded callable in lazy mode too", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });

		expect(await api.pair.crog()).toBe("file-crog");
		const crog = await api.pair.crog;
		expect(await crog.origin).toBe("file");
		expect(await crog.mode).toBe("dir");
		expect(await api.pair.crog.extra.ping).toBe("extra");
	});

	it("merge keeps a callable colliding with a plain (non-self-named) folder", async () => {
		api = await slothlet({ mode: "eager", base: BASE });

		// The folder composes a plain namespace (no self-named module to hoist), so the merge lands
		// an object product on the surviving callable: the file's callable keeps the slot, the
		// folder's namespace members ride along as children.
		expect(api.pair.dlog()).toBe("file-dlog");
		expect(api.pair.dlog.only.ping).toBe("only");
	});

	it("merge keeps a callable colliding with a plain folder in lazy mode too", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });

		expect(await api.pair.dlog()).toBe("file-dlog");
		expect(await api.pair.dlog.only.ping).toBe("only");
	});

	it("merge-replace hands the slot to the second-loaded callable", async () => {
		api = await slothlet({ mode: "eager", base: BASE, collision: "merge-replace" });

		expect(api.pair.crog("x")).toBe("crog:x");
		expect(api.pair.crog.origin).toBe("dir");
		expect(api.pair.crog.mode).toBe("dir");
		expect(api.pair.crog.extra.ping).toBe("extra");
	});

	it("enumerates identical member sets in both modes, with no framework metadata", async () => {
		const eager = await slothlet({ mode: "eager", base: BASE });
		api = await slothlet({ mode: "lazy", base: BASE });

		try {
			// Surface parity is enumeration parity too: the same slot lists the same members in both
			// modes, and framework metadata (`__childFilePaths` and friends, carried on lazy impls)
			// never leaks into the public key set.
			for (const slot of ["tool", "clog", "math"]) {
				const eagerKeys = Object.keys(eager[slot]).sort();
				const lazyKeys = Object.keys(await api[slot]).sort();
				expect(lazyKeys).toEqual(eagerKeys);
				expect(lazyKeys.some((k) => k.startsWith("__"))).toBe(false);
			}
		} finally {
			await eager.shutdown();
		}
	});

	it("skip: the first loaded is kept and the second discarded silently", async () => {
		api = await slothlet({ mode: "eager", base: BASE, collision: "skip" });

		// The root file (first) holds the slot as-is; the directory's callable and members are
		// discarded — the exact behaviour merge was wrongly exhibiting before this fix.
		expect(typeof api.tool).toBe("object");
		expect(api.tool.level).toBe("file");
		expect(api.tool.origin).toBe("file");
	});
});
