/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:23:05 -08:00 (1772313785)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Metadata handler uncovered branches (lines 121-122, 144).
 *
 * @description
 * Directly instantiates Metadata to cover two code paths never reached in integration tests:
 *
 * - Lines 121-122: `tagSystemMetadata()` — when `systemData.sourceFolder` is absent but
 *   `systemData.filePath` is provided, the sourceFolder is derived by calling
 *   `path.dirname(systemData.filePath)` through `this.slothlet.helpers.resolver.path`.
 *
 * - Line 144: `getSystemMetadata()` — early-return `null` when `target` is falsy (null,
 *   undefined, 0, empty string, etc.).
 *
 * Both require a lifecycle token. The token is obtained via the package-internal
 * `@cldmv/slothlet/handlers/lifecycle-token` helpers which are exported by the
 * `./handlers/*` export pattern and resolve to `src/` when `--conditions=slothlet-dev`
 * is active.
 *
 * @module tests/vitests/suites/metadata/metadata-branches.test.vitest
 */

import path from "path";
import { describe, it, expect } from "vitest";
import { Metadata } from "@cldmv/slothlet/handlers/metadata";
import { registerInstance, getInstanceToken } from "@cldmv/slothlet/handlers/lifecycle-token";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Build a minimal mock slothlet and register it so a lifecycle token is available.
 *
 * @returns {{ mock: object, token: symbol }} Mock slothlet and its capability token.
 *
 * @example
 * const { mock, token } = makeMockWithToken();
 * const meta = new Metadata(mock);
 */
function makeMockWithToken() {
	const mock = {
		config: {},
		debug: () => {},
		SlothletError,
		SlothletWarning,
		helpers: {
			resolver: {
				path // Node.js built-in path module — provides dirname()
			}
		}
	};

	registerInstance(mock);

	return { mock, token: getInstanceToken(mock) };
}

// ─── getSystemMetadata — falsy target (line 144) ─────────────────────────────

describe("Metadata.getSystemMetadata — returns null for falsy target (line 144)", () => {
	it("returns null for null", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		expect(meta.getSystemMetadata(null)).toBeNull();
	});

	it("returns null for undefined", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		expect(meta.getSystemMetadata(undefined)).toBeNull();
	});

	it("returns null for 0 (falsy number)", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		expect(meta.getSystemMetadata(0)).toBeNull();
	});

	it("returns null for empty string", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		expect(meta.getSystemMetadata("")).toBeNull();
	});

	it("returns null for false", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		expect(meta.getSystemMetadata(false)).toBeNull();
	});
});

// ─── tagSystemMetadata — derive sourceFolder from filePath (lines 121-122) ───

describe("Metadata.tagSystemMetadata — derives sourceFolder from filePath when absent (lines 121-122)", () => {
	it("sets sourceFolder to path.dirname(filePath) when sourceFolder is not provided", () => {
		const { mock, token } = makeMockWithToken();
		const meta = new Metadata(mock);
		const fn = function computeTotal() {};

		// Provide filePath but NO sourceFolder → lines 121-122 fire
		meta.tagSystemMetadata(fn, { filePath: "/project/src/math/add.mjs", moduleID: "math", apiPath: "math.add" }, token);

		const result = meta.getSystemMetadata(fn);

		expect(result).not.toBeNull();
		expect(result.sourceFolder).toBe("/project/src/math");
	});

	it("uses exact dirname of the filePath", () => {
		const { mock, token } = makeMockWithToken();
		const meta = new Metadata(mock);
		const fn2 = function fetchUsers() {};

		meta.tagSystemMetadata(fn2, { filePath: "/api/users/index.mjs", moduleID: "users", apiPath: "users.fetch" }, token);

		const result = meta.getSystemMetadata(fn2);

		expect(result.sourceFolder).toBe("/api/users");
	});

	it("does NOT derive sourceFolder when one is already provided", () => {
		const { mock, token } = makeMockWithToken();
		const meta = new Metadata(mock);
		const fn3 = function processData() {};

		// When sourceFolder IS provided, lines 121-122 are skipped
		meta.tagSystemMetadata(
			fn3,
			{
				filePath: "/app/services/data.mjs",
				sourceFolder: "/app/services/custom",
				moduleID: "data",
				apiPath: "data.process"
			},
			token
		);

		const result = meta.getSystemMetadata(fn3);

		// Custom sourceFolder should be preserved exactly
		expect(result.sourceFolder).toBe("/app/services/custom");
	});

	it("sourceFolder is null when neither filePath nor sourceFolder is provided", () => {
		const { mock, token } = makeMockWithToken();
		const meta = new Metadata(mock);
		const fn4 = function noPath() {};

		meta.tagSystemMetadata(fn4, { moduleID: "standalone", apiPath: "standalone.noPath" }, token);

		const result = meta.getSystemMetadata(fn4);

		// Both sourceFolder inputs were absent → stored as undefined/null
		expect(result.sourceFolder).toBeFalsy();
	});
});
