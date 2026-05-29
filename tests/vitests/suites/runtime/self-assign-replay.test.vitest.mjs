/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-replay.test.vitest.mjs
 *	@Date: 2026-05-12T22:29:05-07:00 (1778650145)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-16 00:00:00 -07:00 (1779001200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `self.X = …` runtime writes do NOT survive a reload.
 *
 * A reload rebuilds the instance from disk and replays its add/remove
 * operation history — "as if built again up to this point". A runtime
 * `self.X = …` write performed by a function call (or external `.run()` code)
 * is not part of that history, so it must not reappear after a reload. Only
 * writes a module performs in its module-init body survive — because the
 * module body re-executes during the rebuild, not because of any replay.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";

describe("self.X = ... does not survive a reload", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("a runtime self.X = … primitive write is gone after api.slothlet.reload()", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.runtimeKey = "written-at-runtime";
		});
		// Visible immediately (partial-isolation `.run()` shares `self`).
		expect(api.runtimeKey).toBe("written-at-runtime");

		await api.slothlet.reload();

		// The rebuild does not replay the write — it is gone.
		expect(api.runtimeKey).toBeUndefined();
	});

	it("a runtime self.X = … object write is gone after api.slothlet.reload()", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.runtimeObj = { count: 42 };
		});
		expect(api.runtimeObj?.count).toBe(42);

		await api.slothlet.reload();

		expect(api.runtimeObj).toBeUndefined();
	});

	it("multiple runtime self.X = … writes are all gone after a full reload", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.first = 1;
			self.second = 2;
			self.third = 3;
		});
		expect([api.first, api.second, api.third]).toEqual([1, 2, 3]);

		await api.slothlet.reload();

		expect(api.first).toBeUndefined();
		expect(api.second).toBeUndefined();
		expect(api.third).toBeUndefined();
	});
});
