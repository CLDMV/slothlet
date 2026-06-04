/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-context.test.vitest.mjs
 *	@Date: 2026-05-30 00:06:52 -07:00 (1780124812)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:18:03 -07:00 (1780546683)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration tests for the per-request context system in browser mode.
 *
 * @description
 * Browser mode runs the LIVE context manager (the AsyncLocalStorage manager is gated out with
 * `node:async_hooks` — see #123). The existing parity tests prove return values match Node, but say
 * nothing about whether ambient context, `context.run()` / `context.scope()` overrides, isolation,
 * and the live `context` runtime binding actually work without ALS. A regression here would silently
 * break per-request isolation of the live `self`/`context` bindings.
 *
 * Live-mode concurrency boundary: the live manager tracks the active instance in a single global
 * field, so it isolates *sequential* `run()`/`scope()` calls (each restores the prior context on
 * exit) but NOT *interleaved* concurrent calls on the same instance — across an `await` a sibling
 * `run()` overwrites that global and the resumed callback reads the wrong context. True per-async-flow
 * isolation requires AsyncLocalStorage, which a browser doesn't have; the Node async runtime covers
 * the interleaved-concurrency case (see context/per-request-context). See docs/CONTEXT-PROPAGATION.md.
 *
 * Covers (all under `platform:"browser"`, which forces the live runtime):
 * - requesting `runtime:"async"` in a browser is coerced to the live manager (no ALS)
 * - ambient context seeded by `config.context` is readable via `context.get()` AND the live
 *   `context` binding inside a leaf (`api.probe.readUser()`)
 * - `context.run()` overrides for the callback only; base is restored after
 * - `context.scope({ context, fn })` overrides the same way
 * - sequential `context.run()` calls each stay isolated; base is restored between them
 * - nested `context.run()` inherits parent values
 * - the live `context` binding tracks `run()` overrides (not just `context.get()`)
 *
 * @module tests/vitests/suites/browser/browser-context
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getBrowserMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

/**
 * Build a browser-mode config, optionally extending it (e.g. with a base `context`).
 * @param {object} matrixConfig
 * @param {object} [extra]
 * @returns {object}
 */
function browserCfg(matrixConfig, extra = {}) {
	return { ...makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST), ...extra };
}

describe.each(getBrowserMatrixConfigs())("Browser Mode > context > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("ambient context (config.context) is readable via context.get() and the live binding", async () => {
		api = await slothlet(browserCfg(config, { context: { user: "alice", region: "us" } }));

		// Via the context API
		expect(await api.slothlet.context.get("user")).toBe("alice");
		const all = await api.slothlet.context.get();
		expect(all.region).toBe("us");

		// Via the live `context` binding inside a leaf — proves the binding is wired in browser mode
		expect(await api.probe.readUser()).toBe("alice");
		expect(await api.probe.readContext("region")).toBe("us");
	});

	it("context.run() overrides context for the callback only", async () => {
		api = await slothlet(browserCfg(config, { context: { user: "alice" } }));

		const inside = await api.slothlet.context.run({ user: "bob", requestId: "r1" }, async () => {
			return {
				viaGet: await api.slothlet.context.get("user"),
				viaBinding: await api.probe.readUser(),
				requestId: await api.slothlet.context.get("requestId")
			};
		});

		expect(inside.viaGet).toBe("bob");
		expect(inside.viaBinding).toBe("bob"); // live binding tracks the run override
		expect(inside.requestId).toBe("r1");

		// Base context restored after run
		expect(await api.slothlet.context.get("user")).toBe("alice");
		expect(await api.slothlet.context.get("requestId")).toBeUndefined();
		expect(await api.probe.readUser()).toBe("alice");
	});

	it("context.scope({ context, fn }) overrides context for the callback only", async () => {
		api = await slothlet(browserCfg(config, { context: { user: "alice" } }));

		let insideUser;
		await api.slothlet.context.scope({
			context: { user: "carol" },
			fn: async () => {
				insideUser = await api.probe.readUser();
			}
		});

		expect(insideUser).toBe("carol");
		expect(await api.probe.readUser()).toBe("alice");
	});

	it("sequential context.run() calls each stay isolated; base restored between them", async () => {
		// Live mode (forced in browser — no AsyncLocalStorage) isolates context per *sequential* run:
		// each run() makes its context active, the callback reads it, and the prior context is restored
		// on exit. Interleaved concurrent run()s on the SAME instance are deliberately NOT asserted here
		// — the live manager's single global "active instance" is overwritten by a sibling run() across
		// an await, so a resumed callback would read the wrong context. That isolation needs ALS (the
		// Node async runtime); context/per-request-context covers it, and docs/CONTEXT-PROPAGATION.md
		// documents the boundary.
		api = await slothlet(browserCfg(config, { context: { user: "base" } }));

		const a = await api.slothlet.context.run({ user: "u1" }, async () => {
			await new Promise((r) => setTimeout(r, 5));
			return api.probe.readUser();
		});
		expect(a).toBe("u1");
		expect(await api.probe.readUser()).toBe("base"); // base restored after the first run

		const b = await api.slothlet.context.run({ user: "u2" }, async () => {
			await new Promise((r) => setTimeout(r, 5));
			return api.probe.readUser();
		});
		expect(b).toBe("u2");
		expect(await api.probe.readUser()).toBe("base"); // base restored after the second run
	});

	it("nested context.run() inherits parent values", async () => {
		api = await slothlet(browserCfg(config, { context: { tenant: "acme" } }));

		const result = await api.slothlet.context.run({ user: "outer" }, async () => {
			const innerUser = await api.slothlet.context.run({ requestId: "inner" }, async () => {
				return {
					user: await api.probe.readUser(), // inherited from outer
					tenant: await api.probe.readContext("tenant"), // inherited from base
					requestId: await api.slothlet.context.get("requestId")
				};
			});
			return innerUser;
		});

		expect(result.user).toBe("outer");
		expect(result.tenant).toBe("acme");
		expect(result.requestId).toBe("inner");
	});
});

describe("Browser Mode > context > runtime coercion", () => {
	it("requesting runtime:'async' in a browser is coerced to the live manager (no AsyncLocalStorage)", async () => {
		// Browser has no AsyncLocalStorage, so slothlet forces the live context manager regardless of the
		// requested runtime (slothlet.mjs: `envTarget === "browser" ? "live" : config.runtime`). This is
		// why the browser matrix (getBrowserMatrixConfigs) collapses the async/live axis — `async` is
		// silently coerced. Asserted once here rather than re-running the whole matrix under a fictional
		// "async" browser runtime.
		const api = await slothlet(browserCfg({ mode: "eager", runtime: "async", hook: { enabled: false }, diagnostics: true }));
		try {
			expect(api.slothlet.context.diagnostics().managerType).toBe("LiveContextManager");
		} finally {
			await api.shutdown();
		}
	});
});
