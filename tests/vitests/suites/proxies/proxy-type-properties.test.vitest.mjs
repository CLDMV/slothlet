/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/proxy-type-properties.test.vitest.mjs
 *	@Date: 2026-07-14T00:00:00-07:00 (1752566400)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-14 00:00:00 -07:00 (1752566400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for proxy meta-property access in unified-wrapper.
 *
 * @description
 * Tests the uncovered branches in unified-wrapper.mjs including:
 * - `__type` returning "number", "string", "boolean" for primitive default exports
 * - `Symbol.toStringTag` returning "Function" or "Object" based on impl type
 * - `.name` property derived from the API path
 * - `.length` property reflecting actual function arity
 * - Set trap silently absorbing writes to blocked keys
 * - Delete trap silently absorbing deletes of blocked keys
 *
 * @module tests/vitests/suites/proxies/proxy-type-properties.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

// ─── Primitive __type tests ────────────────────────────────────────────────

describe.each(getMatrixConfigs())("Proxy __type Primitives > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_PRIMITIVES
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should return __type 'number' for a numeric default export", async () => {
		// In lazy mode, materialize first
		if (config.mode === "lazy") {
			await api.numval._materialize();
		}
		expect(api.numval.__type).toBe("number");
	});

	it("should return __type 'string' for a string default export", async () => {
		if (config.mode === "lazy") {
			await api.strval._materialize();
		}
		expect(api.strval.__type).toBe("string");
	});

	it("should return __type 'boolean' for a boolean default export", async () => {
		if (config.mode === "lazy") {
			await api.boolval._materialize();
		}
		expect(api.boolval.__type).toBe("boolean");
	});
});

// ─── Symbol.toStringTag tests ──────────────────────────────────────────────

describe.each(getMatrixConfigs())("Proxy Symbol.toStringTag > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should return 'Function' for a function default export", async () => {
		// logger exports `export default function log(message)` → function impl
		await materialize(api, "logger");
		expect(api.logger[Symbol.toStringTag]).toBe("Function");
	});

	it("should return 'Object' for an object export", async () => {
		// math exports an object with methods → object impl
		await materialize(api, "math");
		expect(api.math[Symbol.toStringTag]).toBe("Object");
	});
});

// ─── .name property tests ─────────────────────────────────────────────────

describe.each(getMatrixConfigs())("Proxy .name property > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should return the API path segment as .name for a function wrapper", async () => {
		// logger module auto-flattens to api.logger; .name should reflect the path
		await materialize(api, "logger");
		expect(api.logger.name).toBe("logger");
	});

	it("should return the API path segment as .name for an object wrapper", async () => {
		await materialize(api, "math");
		expect(api.math.name).toBe("math");
	});
});

// ─── .length property tests ──────────────────────────────────────────────

describe.each(getMatrixConfigs())("Proxy .length property > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should return actual function arity for a function default export", async () => {
		// logger exports `function log(message)` which has length=1
		await materialize(api, "logger");
		expect(api.logger.length).toBe(1);
	});

	it("should return 0 for an object export", async () => {
		// An object has no arity, so .length should return 0
		await materialize(api, "math");
		expect(api.math.length).toBe(0);
	});
});

// ─── Set trap (blocked keys) tests ────────────────────────────────────────

describe.each(getMatrixConfigs())("Proxy set trap blocked keys > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should silently absorb writes to __mode", async () => {
		await materialize(api, "math");
		const modeBefore = api.math.__mode;
		api.math.__mode = "totally-fake-mode";
		const modeAfter = api.math.__mode;
		expect(modeAfter).toBe(modeBefore);
	});

	it("should silently absorb writes to __type", async () => {
		await materialize(api, "math");
		const typeBefore = api.math.__type;
		api.math.__type = "totally-fake-type";
		expect(api.math.__type).toBe(typeBefore);
	});

	it("should silently absorb writes to __apiPath", async () => {
		await materialize(api, "math");
		const pathBefore = api.math.__apiPath;
		api.math.__apiPath = "fake.path";
		expect(api.math.__apiPath).toBe(pathBefore);
	});

	it("should silently absorb writes to __isCallable", async () => {
		await materialize(api, "math");
		const callableBefore = api.math.__isCallable;
		api.math.__isCallable = !callableBefore;
		expect(api.math.__isCallable).toBe(callableBefore);
	});

	it("should NOT absorb writes to regular user properties", async () => {
		await materialize(api, "math");
		api.math.customUserProp = "hello";
		expect(api.math.customUserProp).toBe("hello");
	});
});

// ─── Delete trap (blocked keys) tests ─────────────────────────────────────

describe.each(getMatrixConfigs())("Proxy delete trap blocked keys > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should silently absorb deletes of __type and preserve the value", async () => {
		await materialize(api, "math");
		const typeBefore = api.math.__type;
		delete api.math.__type;
		expect(api.math.__type).toBe(typeBefore);
	});

	it("should silently absorb deletes of __mode and preserve the value", async () => {
		await materialize(api, "math");
		const modeBefore = api.math.__mode;
		delete api.math.__mode;
		expect(api.math.__mode).toBe(modeBefore);
	});

	it("should silently absorb deletes of __apiPath and preserve the value", async () => {
		await materialize(api, "math");
		const pathBefore = api.math.__apiPath;
		delete api.math.__apiPath;
		expect(api.math.__apiPath).toBe(pathBefore);
	});

	it("should silently absorb deletes of ____slothletInternal (critical internal)", async () => {
		await materialize(api, "math");
		// Deleting the core internals key must not throw and must be silently absorbed
		expect(() => {
			delete api.math.____slothletInternal;
		}).not.toThrow();
		// The wrapper is still functional after the no-op delete
		expect(api.math.__type).toBeDefined();
	});
});
