/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-construct-before-load.test.vitest.mjs
 *	@Date: 2026-11-01T09:38:12-08:00 (1793554692)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T10:21:37-08:00 (1793557297)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `new` on a class reached through a lazy folder that has not loaded yet (#685).
 *
 * @description
 * A property read on a lazy node that has not loaded hands out a stand-in for the chain. Calling it loads the chain
 * and calls its end, returning a promise; `new` on it does the same and resolves to the instance. Before the fix the
 * engine's default construction ran on the stand-in, handing back an object whose every member was another stand-in.
 *
 * @module tests/vitests/suites/lazy/lazy-construct-before-load
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_lazy_construct");

describe.each([{ runtime: "async" }, { runtime: "live" }])("new before a lazy folder loads (#685) — lazy / $runtime", ({ runtime }) => {
	let api = null;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it("resolves to an instance the constructor built", async () => {
		api = await slothlet({ base: BASE, mode: "lazy", runtime, silent: true });
		const pending = new api.lz.deep.Maker(1);
		expect(pending).toBeInstanceOf(Promise);
		const made = await pending;
		expect(made.v).toBe("made");
		expect(made.x).toBe(1);
		expect(made.say()).toBe("made:1");
	});

	it("builds a new instance on every construction", async () => {
		api = await slothlet({ base: BASE, mode: "lazy", runtime, silent: true });
		const [a, b] = await Promise.all([new api.lz.deep.Maker(1), new api.lz.deep.Maker(2)]);
		expect(a).not.toBe(b);
		expect([a.x, b.x]).toEqual([1, 2]);
	});

	it("constructs for a module through self", async () => {
		api = await slothlet({ base: BASE, mode: "lazy", runtime, silent: true });
		expect(await api.user.make(3)).toBe("made:3");
	});

	it("rejects with a TypeError when what the chain ends at cannot be constructed", async () => {
		api = await slothlet({ base: BASE, mode: "lazy", runtime, silent: true });
		await expect(new api.lz.other.arrow()).rejects.toBeInstanceOf(TypeError);
	});
});

describe("new on the same class in eager mode (#685)", () => {
	it("returns the instance itself", async () => {
		const api = await slothlet({ base: BASE, mode: "eager", silent: true });
		try {
			const made = new api.lz.deep.Maker(4);
			expect(made).not.toBeInstanceOf(Promise);
			expect(made.say()).toBe("made:4");
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
