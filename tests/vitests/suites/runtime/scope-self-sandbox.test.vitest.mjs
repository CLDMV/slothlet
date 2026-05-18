/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/scope-self-sandbox.test.vitest.mjs
 *	@Date: 2026-05-16T00:00:00-07:00 (1779001200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-16 00:00:00 -07:00 (1779001200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `full`-isolation `.run()`/`.scope()` sandboxes `self` via a
 * copy-on-write view.
 *
 * Under `scope: { isolation: "full" }`, `self` inside a `.run()`/`.scope()`
 * callback is a recursive copy-on-write proxy: reads pass through to the live
 * instance, writes (top-level and deep-path) land on a per-scope overlay and
 * are discarded on exit. `partial` mode shares `self` (writes persist).
 *
 * Writes are driven through the `owner` API-module fixture
 * (`api_tests/api_test_self_assign/owner.mjs`) — `@cldmv/slothlet/runtime` is
 * for API-module files, not test files.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";

const DIR = "./api_tests/api_test_self_assign";

describe(".run()/.scope() self sandbox (full isolation)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("discards a self.X write made inside a full-isolation .run()", async () => {
		api = await slothlet({ dir: DIR, mode: "eager", scope: { isolation: "full" } });

		await api.slothlet.run({}, async () => {
			// owner.writeOutside() does `self.intruder = value` — visible within
			// the scope through the copy-on-write view.
			const inside = await api.owner.writeOutside("scoped");
			expect(inside).toBe("scoped");
		});

		// Discarded on exit — the live instance never saw the write.
		expect(api.intruder).toBeUndefined();
	});

	it("exercises the copy-on-write self view's has / ownKeys / descriptor traps", async () => {
		api = await slothlet({ dir: DIR, mode: "eager", scope: { isolation: "full" } });

		let result;
		await api.slothlet.run({}, async () => {
			// owner.introspectSelf() writes self.probeKey then introspects `self`:
			// `in`, Object.keys, getOwnPropertyDescriptor — all routed through the
			// copy-on-write view.
			result = await api.owner.introspectSelf();
		});

		expect(result.hasProbe).toBe(true); // overlay-backed key visible via `in`
		expect(result.hasOwner).toBe(true); // read-through to the live tree
		expect(result.hasMissing).toBe(false); // absent in both overlay and parent
		expect(result.descValue).toBe("probe-value"); // descriptor from the overlay
		expect(result.descMissing).toBeUndefined(); // no descriptor for an absent key
		expect(result.readBack).toBe("probe-value");
		expect(result.keyCount).toBeGreaterThan(0);

		// The probe write did not leak to the live instance.
		expect(api.probeKey).toBeUndefined();
	});

	it("partial isolation (default) does NOT sandbox — self writes persist", async () => {
		// Counterpart: confirms the COW view is full-isolation-only.
		api = await slothlet({ dir: DIR, mode: "eager" });

		await api.slothlet.run({}, async () => {
			await api.owner.writeOutside("persisted");
		});

		expect(api.intruder).toBe("persisted");
	});
});
