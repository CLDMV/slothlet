/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-member-cycle.test.vitest.mjs
 *	@Date: 2026-11-01T17:14:13-08:00 (1793582053)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T18:28:04-08:00 (1793586484)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A cyclic member read through `self` closes its cycle (#688).
 *
 * A module reads a value another module mounted, through `self`, and gets a view of it held to the reader (#625). A
 * plain member of that value is a view too, held to the api path it was reached at. A member read that walks back
 * into a value already on the walk (`conn.self = conn`, `conn.loop.back = conn`) hands back the view of that value
 * the walk already went through, so `c.self.self === c.self` holds as it does on the value, and deep equality finds
 * the cycle instead of recursing until the stack or the heap runs out. Such a lap is held to the earlier, shorter
 * path. Reads by the host are not views and are not affected.
 *
 * A value at two paths that are no cycle keeps a view per path, each held to its own path.
 *
 * Fixture: `api_tests/api_test_self_member_cycle` — `maker/` (mounts `things.x`, `conn.self = conn`,
 * `conn.loop.back = conn`, and one object at both `conn.open` and `conn.shut`) and `reader/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import slothlet from "@cldmv/slothlet";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_self_member_cycle");

const STASH = "__slothletSelfMemberCycleLap";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("a cyclic member read through self (#688) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		delete globalThis[STASH];
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Write `later` on the view the reader left on `globalThis`, from host code with no module behind the write.
	 * @returns {string} `"done"`, or the error code the write was refused with.
	 */
	function writeStashed() {
		try {
			globalThis[STASH].later = 1;
			return "done";
		} catch (error) {
			return error?.code ?? error?.name ?? String(error);
		}
	}

	/**
	 * Load the maker as the base, mount the reader, and have the maker mount `things.x`.
	 * @param {object} options - Extra slothlet options.
	 * @returns {Promise<object>} What the maker read back through `self`.
	 */
	async function load(options) {
		api = await slothlet({ base: path.join(FIXTURE, "maker"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("reader", path.join(FIXTURE, "reader"), { moduleID: "reader" });
		return api.m.make();
	}

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("hands back the same view on every lap, so deep equality terminates (permissions %s)", async (_label, options) => {
		await load(options);
		expect(api.reader.r.cycle()).toEqual({ lap: true, laps: true, twoStep: true, reread: true, deepEqual: true });
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("compares what two modules read of the same node deeply, cycle included (permissions %s)", async (_label, options) => {
		const made = await load(options);
		const read = api.reader.r.read();
		expect(isDeepStrictEqual(made, read)).toBe(true);
		expect(read).toEqual(made);
	});

	it("leaves the host's reads as they are", async () => {
		await load({ permissions: {} });
		const conn = api.things.x.conn;
		expect(conn.self.self).toBe(conn.self);
	});

	it("refuses a write round the cycle to a module that does not own it", async () => {
		await load({ permissions: {} });
		expect(api.reader.r.writeLap()).toBe("LOOSE_SET_NOT_OWNED");
	});

	it("refuses a write round the cycle made later with no module behind it, held to the reader", async () => {
		await load({ permissions: {} });
		api.reader.r.stashLap(STASH);
		expect(writeStashed()).toBe("RUNTIME_NO_ACTIVE_CONTEXT_SELF");
		expect(api.things.x.conn.later).toBeUndefined();
	});

	it("lets a write round the cycle through where a host rule grants it, now and later with no module behind it", async () => {
		await load({ permissions: { rules: [{ caller: "reader.**", target: "things.x.conn.**:write", effect: "allow" }] } });
		expect(api.reader.r.writeLap()).toBe("done");
		api.reader.r.stashLap(STASH);
		expect(writeStashed()).toBe("done");
	});

	it("keeps a view per path for one object at two paths that are no cycle, each held to its own path", async () => {
		await load({ permissions: { rules: [{ caller: "reader.**", target: "things.x.conn.self.open.**:write", effect: "allow" }] } });
		expect(api.reader.r.writeShared()).toEqual({
			same: false,
			viaOpen: "done",
			viaShut: "LOOSE_SET_NOT_OWNED",
			viaOpenAfterShut: "done"
		});
	});
});
