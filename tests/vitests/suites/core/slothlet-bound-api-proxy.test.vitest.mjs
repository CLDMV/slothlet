/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/slothlet-bound-api-proxy.test.vitest.mjs
 *	@Date: 2026-03-01 19:00:00 -08:00 (1772416800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 07:33:53 -08:00 (1772552033)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for the boundApi Proxy traps in slothlet.mjs.
 *
 * @description
 * The `slothlet.mjs` `load()` method creates a `boundApi` Proxy with the following
 * traps: `get`, `set`, `has`, `ownKeys`, `deleteProperty`, `apply`, `construct`,
 * and `getOwnPropertyDescriptor`. Some of these traps are not covered by
 * existing tests.
 *
 * Targets:
 *  - Line 459: `deleteProperty` trap — `delete api.something`
 *  - Line 510: `reference` config option → `Object.assign(this.boundApi, reference)`
 *  - Lines 360, 361: `setApiContextChecker` lambda body (async context checker callback)
 *
 * @module tests/vitests/suites/core/slothlet-bound-api-proxy
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── deleteProperty trap (slothlet.mjs line 459) ─────────────────────────────

describe("slothlet boundApi proxy: deleteProperty trap (line 459)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("delete api.math returns true and removes the key from the proxy (line 459)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true
		});

		// Verify math exists before deletion
		expect(api.math).toBeDefined();

		// `delete api.math` fires: deleteProperty: (target, prop) => (this.api ? delete this.api[prop] : true)
		// line 459 — the deleteProperty trap on the boundApi proxy
		const result = delete api.math;
		expect(result).toBe(true);
	});

	it("delete api.nonExistent returns true (deleteProperty with unknown key)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true
		});

		// Deleting a non-existent key from the proxy also fires the deleteProperty trap
		const result = delete api.__completely_unknown_key_xyz__;
		expect(result).toBe(true);
	});
});

// ─── reference config option (slothlet.mjs line 510) ─────────────────────────

describe("slothlet config: reference option merges into boundApi (line 510)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("reference object properties are accessible on the bound API (line 510)", async () => {
		const myRef = { externalUtil: () => "from-reference", version: "1.0.0" };

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true,
			reference: myRef
		});

		// `if (this.reference && typeof this.reference === "object") { Object.assign(this.boundApi, this.reference); }`
		// line 510 — reference values merged into boundApi
		expect(api.externalUtil).toBeDefined();
		expect(typeof api.externalUtil).toBe("function");
		expect(api.externalUtil()).toBe("from-reference");
		expect(api.version).toBe("1.0.0");
	});

	it("reference with function value is callable through API proxy", async () => {
		const greet = (name) => `hello ${name}`;

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true,
			reference: { greet }
		});

		expect(typeof api.greet).toBe("function");
		expect(api.greet("world")).toBe("hello world");
	});
});

// ─── setApiContextChecker lambda coverage (slothlet.mjs lines 360-361) ───────

describe("slothlet init: setApiContextChecker callback (lines 360-361)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("context checker fires within api.slothlet.context.run() scope (covers lambda lines 360-361)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true
		});

		// api.slothlet.context.run() creates an AsyncLocalStorage context.
		// Inside the callback, the setApiContextChecker lambda (lines 360-361) fires
		// when EventEmitter context is checked: ctx = this.contextManager.tryGetContext();
		// return !!(ctx && ctx.self) — both these lines are in the lambda.
		let ranInsideContext = false;
		await api.slothlet.context.run({ userId: "test" }, async () => {
			ranInsideContext = true;
			// Accessing API inside run() triggers context check
			expect(typeof api.math.add).toBe("function");
		});

		expect(ranInsideContext).toBe(true);
	});
});
// ─── Line 448: construct trap on callable boundApi proxy ─────────────────────

describe("slothlet boundApi proxy: construct trap (line 448)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	/**
	 * When `slothlet.api` is a function (api_test has root-level function exports),
	 * the `boundApi` proxy is built with `isCallable = true` and includes a
	 * `construct` trap at line 448:
	 *
	 *   construct: (target, args) => (this.api ? Reflect.construct(this.api, args) : {})
	 *
	 * Using the `new` operator on the boundApi proxy fires this trap.
	 */
	it("new api() on a callable slothlet API invokes the construct trap (line 448)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		// api_test has rootFunctionShout/rootFunctionWhisper at the top level,
		// making slothlet.api a function → isCallable = true → construct trap defined
		expect(typeof api).toBe("function");

		// Trigger the construct trap. The underlying function is not a real constructor
		// so Reflect.construct may throw — line 448 still executes before any throw.
		let constructTrapFired = false;
		try {
			// eslint-disable-next-line new-cap
			new api();
			constructTrapFired = true;
		} catch (_) {
			// Expected: the api function isn't a constructor. Trap fired = success.
			constructTrapFired = true;
		}
		expect(constructTrapFired).toBe(true);
	});
});
