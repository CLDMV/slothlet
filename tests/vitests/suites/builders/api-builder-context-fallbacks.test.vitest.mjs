/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/builders/api-builder-context-fallbacks.test.vitest.mjs
 *	@Date: 2026-11-28T12:00:00-08:00 (1795896000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T12:00:00-08:00 (1795896000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `slothlet.context.get()` / `context.set()` of api_builder.mjs on their fallback paths.
 *
 * @description
 * Covers:
 *   - live runtime, after shutdown (the instance's context record is gone): get(key) and get() answer from the
 *     instance's own context
 *   - async runtime, read from inside another instance's run(): get(key) answers the instance's base context; once
 *     the instance has shut down it has no context record, and get() answers {} and get(key) undefined
 *   - a context manager of a kind slothlet doesn't know: get(key) answers from the instance's own context
 *   - set() after shutdown (no context record left) writes to the instance's own context object
 *
 * @module tests/vitests/suites/builders/api-builder-context-fallbacks
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create an eager API on the standard fixture with a context.
 * @param {object} [extra={}] - Additional config.
 * @returns {Promise<object>} The api.
 */
function makeApi(extra = {}) {
	return slothlet({ mode: "eager", runtime: "async", base: TEST_DIRS.API_TEST, context: { user: "alice" }, ...extra });
}

describe("api_builder – context.get on the live runtime after shutdown", () => {
	it("answers from the instance's own context", async () => {
		const api = await makeApi({ runtime: "live" });
		await api.shutdown();
		expect(api.slothlet.context.get("user")).toBe("alice");
		expect(api.slothlet.context.get()).toEqual({ user: "alice" });
	});
});

describe("api_builder – context.get from inside another instance's run (async runtime)", () => {
	it("answers the instance's base context, and nothing once it has shut down", async () => {
		const a = await makeApi({ context: { user: "a" } });
		const b = await makeApi({ context: { user: "b" } });
		try {
			const live = await a.slothlet.context.run({ user: "a-run" }, () => b.slothlet.context.get("user"));
			expect(live).toBe("b");
			await b.shutdown();
			const after = await a.slothlet.context.run({ user: "a-run" }, () => [b.slothlet.context.get(), b.slothlet.context.get("user")]);
			expect(after).toEqual([{}, undefined]);
		} finally {
			await a.shutdown();
			await b.shutdown().catch(() => {});
		}
	});
});

describe("api_builder – context.get with a context manager of an unknown kind", () => {
	it("answers a key from the instance's own context", async () => {
		const api = await makeApi();
		const sl = resolveWrapper(api.math).____slothlet;
		const original = sl.contextManager;
		sl.contextManager = { constructor: { name: "UnknownContextManager" } };
		try {
			expect(api.slothlet.context.get("user")).toBe("alice");
		} finally {
			sl.contextManager = original;
			await api.shutdown();
		}
	});
});

describe("api_builder – context.set after shutdown", () => {
	it("writes to the instance's own context", async () => {
		const api = await makeApi();
		const sl = resolveWrapper(api.math).____slothlet;
		await api.shutdown();
		api.slothlet.context.set("user", "bob");
		expect(sl.context).toEqual({ user: "bob" });
	});
});
