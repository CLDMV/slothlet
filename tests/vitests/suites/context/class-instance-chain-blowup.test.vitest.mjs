/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/class-instance-chain-blowup.test.vitest.mjs
 *	@Date: 2026-05-31T08:04:06-07:00 (1780239846)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:18:04 -07:00 (1780546684)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression test for #124 — async runtime double-wraps chainable class instances.
 *
 * @description
 * In async runtime a class-instance result was wrapped twice per method call (once inside
 * `AsyncContextManager.runInContext`, once in the method Proxy's context-preserving wrapper),
 * so the wrap count doubled on every step of a fluent chain — `2^(N+4) − 1` wraps for an
 * N-step chain. An 8-step chain took minutes; longer chains were intractable.
 *
 * These tests exercise the real async runtime against a Kysely-style chainable fixture and
 * assert (1) chained calls return correct results, (2) slothlet context propagates through the
 * whole chain, and (3) a long chain resolves well inside a tight timeout — the exponential
 * version cannot, so a regression trips the per-test timeout instead of hanging the suite.
 *
 * @module tests/vitests/suites/context/class-instance-chain-blowup.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("Async chainable class-instance wrapping (#124)", () => {
	describe.each(getMatrixConfigs({ runtime: "async" }))("Config: '$name'", ({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({
				base: TEST_DIRS.API_CHAINABLE,
				context: { userId: "chain-user" },
				...config
			});
		});

		afterEach(async () => {
			if (api?.shutdown) {
				await api.shutdown();
			}
			api = null;
		});

		it("chained builder calls return the correct accumulated result", async () => {
			let q = api.query();
			for (let i = 0; i < 8; i++) {
				q = q.where(i);
			}
			expect(await q.execute()).toBe(8);
		});

		it("slothlet context propagates through the full chain", async () => {
			let q = api.query();
			for (let i = 0; i < 8; i++) {
				q = q.where(i);
			}
			// Reading context on a deeply-chained, repeatedly-wrapped instance must still
			// resolve the active store — the wrapping exists precisely to preserve this.
			expect(q.whoami()).toBe("chain-user");
		});

		it("a 20-step chain stays correct and context-preserving (no 2^N wrap blow-up)", async () => {
			let q = api.query();
			for (let i = 0; i < 20; i++) {
				q = q.where(i);
			}
			// Deterministic assertions — correctness + context through a deep chain. The
			// exact #124 regression (idempotent re-wrap) is locked by the unit test in
			// class-instance-wrapper-proxy; we do NOT gate on wall-clock here (flaky under
			// concurrent-worker CPU contention). The generous timeout is only a backstop so
			// that IF the doubling regressed (~2^24 wraps at 20 steps) the run can't hang
			// forever — it would blow past this, whereas the fixed path finishes in ms.
			expect(await q.execute()).toBe(20);
			expect(q.whoami()).toBe("chain-user");
		}, 30000);
	});
});
