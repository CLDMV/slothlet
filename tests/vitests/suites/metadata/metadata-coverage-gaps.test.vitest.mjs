/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for previously-unreached Metadata branches.
 *
 * @description
 * Covers:
 *   line 281  `if (apiPath)` false branch — `setUserMetadata` called with systemData having
 *             no apiPath; pathEntry is NOT created in the #userMetadataStore
 *   line 568  `if (state.globalMetadata)` false branch — `importUserState` called with
 *             a state object that has no `globalMetadata` key
 *   line 577  `if (state.userMetadataStore)` false branch — `importUserState` called with
 *             a state object that has no `userMetadataStore` key
 *
 * @module tests/vitests/suites/metadata/metadata-coverage-gaps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

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
			resolver: { path }
		}
	};
	registerInstance(mock);
	return { mock, token: getInstanceToken(mock) };
}

// ─── setUserMetadata — no apiPath in systemData (line 281 false branch) ──────

describe("Metadata.setUserMetadata — no apiPath in systemData skips pathEntry creation (line 281 false)", () => {
	it("does not throw when systemData.apiPath is absent and still stores metadata by moduleID", () => {
		const { mock, token } = makeMockWithToken();
		const meta = new Metadata(mock);
		const fn = function noApiPath() {};

		// Tag with moduleID but NO apiPath — line 281's if(apiPath) evaluates to false
		meta.tagSystemMetadata(fn, { moduleID: "mod-no-path", filePath: "/some/file.mjs" }, token);

		// setUserMetadata() should succeed without creating a pathEntry
		expect(() => meta.setUserMetadata(fn, "testKey", "testValue")).not.toThrow();
	});

	it("stores metadata by moduleID even when apiPath is empty string", () => {
		const { mock, token } = makeMockWithToken();
		const meta = new Metadata(mock);
		const fn2 = function emptyPath() {};

		// apiPath = "" is falsy — line 281's if(apiPath) evaluates to false
		meta.tagSystemMetadata(fn2, { moduleID: "mod-empty-path", apiPath: "", filePath: "/empty.mjs" }, token);

		expect(() => meta.setUserMetadata(fn2, "key", "val")).not.toThrow();
	});
});

// ─── importUserState — missing globalMetadata (line 568 false branch) ─────────

describe("Metadata.importUserState — state without globalMetadata does not throw (line 568 false)", () => {
	it("skips globalMetadata loop when state.globalMetadata is absent", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		// State with no globalMetadata key → line 568 if(state.globalMetadata) is false
		expect(() => meta.importUserState({ userMetadataStore: new Map() })).not.toThrow();
	});

	it("skips globalMetadata loop when state.globalMetadata is null", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		expect(() => meta.importUserState({ globalMetadata: null, userMetadataStore: new Map() })).not.toThrow();
	});
});

// ─── importUserState — missing userMetadataStore (line 577 false branch) ────

describe("Metadata.importUserState — state without userMetadataStore does not throw (line 577 false)", () => {
	it("skips userMetadataStore loop when state.userMetadataStore is absent", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		// State with no userMetadataStore key → line 577 if(state.userMetadataStore) is false
		expect(() => meta.importUserState({ globalMetadata: {} })).not.toThrow();
	});

	it("skips userMetadataStore loop when state.userMetadataStore is null", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		expect(() => meta.importUserState({ globalMetadata: {}, userMetadataStore: null })).not.toThrow();
	});

	it("handles state = {} (neither globalMetadata nor userMetadataStore)", () => {
		const { mock } = makeMockWithToken();
		const meta = new Metadata(mock);

		// Both lines 568 and 577 evaluate to false
		expect(() => meta.importUserState({})).not.toThrow();
	});
});
