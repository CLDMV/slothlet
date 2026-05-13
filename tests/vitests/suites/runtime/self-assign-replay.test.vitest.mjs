/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-replay.test.vitest.mjs
 *	@Date: 2026-05-12T22:29:05-07:00 (1778650145)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 22:32:56 -07:00 (1778650376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Stage 4 tests for reload survival of `self.X = …` writes.
 *
 * Each `setOwnedProperty` call is recorded in
 * `apiManager.state.ownedSets`. After `_restoreApiTree()` rebuilds the in-memory
 * tree, the api-manager replays every entry against the fresh tree so values
 * persist through both targeted reloads (api.slothlet.api.reload) and full
 * instance reloads (api.slothlet.reload).
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";

describe("self.X = ... (Stage 4: reload survival)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("survives api.slothlet.api.reload(apiPath) on the affected subtree", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.runtimeKey = "from-original-set";
		});
		expect(api.runtimeKey).toBe("from-original-set");

		await api.slothlet.api.reload(".");

		expect(api.runtimeKey).toBe("from-original-set");
	});

	it("survives api.slothlet.reload() (full instance reload)", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.surviveFullReload = "kept";
			self.surviveObj = { count: 42 };
		});
		expect(api.surviveFullReload).toBe("kept");
		expect(api.surviveObj.count).toBe(42);

		await api.slothlet.reload();

		expect(api.surviveFullReload).toBe("kept");
		expect(api.surviveObj.count).toBe(42);
	});

	it("preserves multiple sets and their ordering across full reload", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.first = 1;
			self.second = 2;
			self.third = 3;
		});

		await api.slothlet.reload();

		expect(api.first).toBe(1);
		expect(api.second).toBe(2);
		expect(api.third).toBe(3);
	});
});
