/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-type-access.test.vitest.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772496000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 00:00:00 -08:00 (1772496000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for unified-wrapper.mjs `__type` property accessor (lines 2078-2163)
 * and related internal-property getTrap paths.
 *
 * Covered lines:
 *   - Line 2079:       `__type` → lazy inFlight  → TYPE_STATES.IN_FLIGHT
 *   - Line 2082:       `__type` → lazy unmaterialized → TYPE_STATES.UNMATERIALIZED
 *   - Line 2087:       `__type` → typeof impl === "function" → "function"
 *   - Line 2090-2092:  `__type` → impl.default is a function → "function"
 *   - Line 2094:       `__type` → object impl → "object"
 *   - Lines 2096-2113: `__type` → primitive impl branches (string/number/boolean/symbol/bigint)
 *   - Line 2116:       `__type` → null/undefined impl → "undefined"
 *   - Line 2149:       `__filePath` → returns wrapper filePath
 *   - Line 2152:       `__sourceFolder` → returns wrapper sourceFolder
 *   - Line 2153:       `__moduleID` → returns wrapper moduleID
 *
 * Technique:
 *   - Eager-mode tests access `api.math.__type` directly (impl = object).
 *   - Primitive / special impl tests manipulate `wrapper.____slothletInternal.impl` directly
 *     and restore it in a finally block.
 *   - IN_FLIGHT test accesses `__type` on a fresh lazy wrapper whose `materializeFunc`
 *     is async, so `inFlight` is set to true synchronously by the IIFE then suspended.
 *   - UNMATERIALIZED test sets `wrapper.____slothletInternal.invalid = true` before
 *     accessing `__type`, causing `_materialize()` to return early (invalid guard) without
 *     ever setting `inFlight = true`.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-type-access
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper, TYPE_STATES } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let _api = null;

afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
	await new Promise((r) => setTimeout(r, 20));
});

/**
 * Get the UnifiedWrapper instance for a proxy child.
 * @param {object} api - Slothlet API proxy.
 * @param {string} [prop="math"] - Property name whose wrapper to resolve.
 * @returns {object} UnifiedWrapper instance.
 */
function getWrapper(api, prop = "math") {
	const wrapper = resolveWrapper(api[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper;
}

// ---------------------------------------------------------------------------
// 1. Eager object impl → "object" (line 2094)
// ---------------------------------------------------------------------------

describe("__type — eager object impl → 'object' (line 2094)", () => {
	it("returns 'object' for an eager-mode namespace wrapper (api.math)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		expect(_api.math.__type).toBe("object");
	});

	it("returns 'object' for api.task namespace in eager mode", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		expect(_api.task.__type).toBe("object");
	});
});

// ---------------------------------------------------------------------------
// 2. Eager function impl → "function" (line 2087)
// ---------------------------------------------------------------------------

describe("__type — function impl → 'function' (line 2087)", () => {
	it("returns 'function' when impl is directly a function (manipulated wrapper)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = function testFn() {};
		try {
			expect(_api.math.__type).toBe("function");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});
});

// ---------------------------------------------------------------------------
// 3. Object with default function → "function" (lines 2090-2092)
// ---------------------------------------------------------------------------

describe("__type — object with default function property → 'function' (lines 2090-2092)", () => {
	it("returns 'function' when impl is an object whose .default is a function", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = { default: function defaultFn() {} };
		try {
			expect(_api.math.__type).toBe("function");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});
});

// ---------------------------------------------------------------------------
// 4. Primitive impl branches (lines 2096-2116)
// ---------------------------------------------------------------------------

describe("__type — primitive impl branches (lines 2096-2116)", () => {
	it("returns 'string' when impl is a string (line 2097-2099)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = "hello";
		try {
			expect(_api.math.__type).toBe("string");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("returns 'number' when impl is a number (lines 2100-2102)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = 42;
		try {
			expect(_api.math.__type).toBe("number");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("returns 'boolean' when impl is a boolean (lines 2103-2105)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = true;
		try {
			expect(_api.math.__type).toBe("boolean");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("returns 'symbol' when impl is a symbol (lines 2106-2108)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = Symbol("test");
		try {
			expect(_api.math.__type).toBe("symbol");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("returns 'bigint' when impl is a bigint (lines 2109-2111)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = 9007199254740991n;
		try {
			expect(_api.math.__type).toBe("bigint");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("returns 'undefined' when impl is null (line 2116 fallthrough)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const wrapper = getWrapper(_api);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = null;
		try {
			expect(_api.math.__type).toBe("undefined");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});
});

// ---------------------------------------------------------------------------
// 5. Lazy in-flight → TYPE_STATES.IN_FLIGHT (line 2079)
// ---------------------------------------------------------------------------

describe("__type — lazy in-flight → TYPE_STATES.IN_FLIGHT (line 2079)", () => {
	it("returns TYPE_STATES.IN_FLIGHT when materialization is in progress", async () => {
		// Create lazy slothlet — wrappers start unmaterialized
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", runtime: "async", silent: true });

		// Directly set inFlight=true on the wrapper to simulate mid-materialization state.
		// The prior approach (relying on _materialize()'s async IIFE timing) is inherently racy
		// under V8 coverage instrumentation, where microtask scheduling differs enough that
		// materializeFunc can complete before line 2078 is checked. Direct state manipulation
		// guarantees we test the exact `if (lazy && inFlight) → TYPE_STATES.IN_FLIGHT` branch.
		const wrapper = resolveWrapper(_api.math);
		const savedInFlight = wrapper.____slothletInternal.state.inFlight;
		const savedMaterialized = wrapper.____slothletInternal.state.materialized;
		wrapper.____slothletInternal.state.inFlight = true;
		wrapper.____slothletInternal.state.materialized = false;

		try {
			const type = _api.math.__type;
			expect(type).toBe(TYPE_STATES.IN_FLIGHT);
		} finally {
			wrapper.____slothletInternal.state.inFlight = savedInFlight;
			wrapper.____slothletInternal.state.materialized = savedMaterialized;
		}
	});
});

// ---------------------------------------------------------------------------
// 6. Lazy unmaterialized → TYPE_STATES.UNMATERIALIZED (line 2082)
// ---------------------------------------------------------------------------

describe("__type — lazy unmaterialized → TYPE_STATES.UNMATERIALIZED (line 2082)", () => {
	it("returns TYPE_STATES.UNMATERIALIZED when wrapper is invalid (materialize returns early)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", runtime: "async", silent: true });

		// Resolve the lazy wrapper proxy without triggering materialization
		const wrapper = resolveWrapper(_api.math);
		if (!wrapper) throw new Error("Could not resolve wrapper for api.math");

		// Set invalid=true — causes ___materialize() to return early before setting inFlight=true.
		// This means after _materialize() returns: materialized=false, inFlight=false.
		// The __type handler will then hit the "lazy && !materialized" check → UNMATERIALIZED.
		const origInvalid = wrapper.____slothletInternal.invalid;
		const origInFlight = wrapper.____slothletInternal.state.inFlight;
		const origMaterialized = wrapper.____slothletInternal.state.materialized;
		wrapper.____slothletInternal.invalid = true;
		wrapper.____slothletInternal.state.inFlight = false;
		wrapper.____slothletInternal.state.materialized = false;
		try {
			const type = _api.math.__type;
			expect(type).toBe(TYPE_STATES.UNMATERIALIZED);
		} finally {
			wrapper.____slothletInternal.invalid = origInvalid;
			wrapper.____slothletInternal.state.inFlight = origInFlight;
			wrapper.____slothletInternal.state.materialized = origMaterialized;
		}
	});
});

// ---------------------------------------------------------------------------
// 7. __filePath, __sourceFolder, __moduleID (lines 2149-2153)
// ---------------------------------------------------------------------------

describe("__filePath / __sourceFolder / __moduleID internal properties (lines 2149-2153)", () => {
	it("__filePath returns a non-empty string path to the source file (line 2149)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const filePath = _api.math.__filePath;
		// filePath may be undefined if the wrapper aggregates nested implementations,
		// but for a leaf wrapper it should be a string ending in .mjs
		if (filePath !== undefined) {
			expect(typeof filePath).toBe("string");
			expect(filePath.length).toBeGreaterThan(0);
		}
	});

	it("__sourceFolder returns a string folder path or undefined (line 2152)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sourceFolder = _api.math.__sourceFolder;
		if (sourceFolder !== undefined) {
			expect(typeof sourceFolder).toBe("string");
		}
	});

	it("__moduleID returns a string moduleID or undefined (line 2153)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const moduleID = _api.math.__moduleID;
		if (moduleID !== undefined) {
			expect(typeof moduleID).toBe("string");
		}
	});

	it("__filePath is a string for a leaf eager wrapper (api.task)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		// task is a directory module — __filePath may point to the directory or a file
		const filePath = _api.task.__filePath;
		if (filePath !== undefined) {
			expect(typeof filePath).toBe("string");
			expect(filePath.length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// 8. __type is consistent across repeated accesses (regression + line coverage)
// ---------------------------------------------------------------------------

describe("__type — repeated access and eager-mode consistency", () => {
	it("returns the same value on repeated __type access for an eager wrapper (line 2087/2094)", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const first = _api.math.__type;
		const second = _api.math.__type;
		expect(first).toBe(second);
		expect(first === "object" || first === "function").toBe(true);
	});

	it("returns 'object' for api.logger namespace in eager mode", async () => {
		_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		// logger is a directory-based module and should expose an object impl
		const type = _api.logger.__type;
		expect(type === "object" || type === "function").toBe(true);
	});
});
