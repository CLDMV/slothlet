/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/processors/flatten-default-conflict-modes.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:49-08:00 (1795869169)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `Flatten.processModuleForAPI` — the collision mode a named export meets a default export's own member
 * under, and the named exports a callable default never attaches.
 *
 * @description
 * Expected values are what plain JavaScript gives for merging the named exports onto the default: a name the default
 * already holds keeps the default's value under `skip`/`merge`, takes the named export's under `replace`, and an
 * export that IS the default (a re-export) is never attached as a member of itself.
 */
import { describe, it, expect, vi } from "vitest";
import { Flatten } from "#processors/flatten";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * A minimal slothlet whose collision config differs between the build contexts.
 * @param {string} initial - Mode for the initial build.
 * @param {string} api - Mode for api.add builds.
 * @returns {object} Mock slothlet.
 */
function makeSlothlet(initial, api) {
	return {
		config: { api: { collision: { mode: { initial, api } } } },
		debug: vi.fn(),
		SlothletError,
		SlothletWarning,
		helpers: { modesUtils: { ensureNamedExportFunction: (fn) => fn } }
	};
}

/**
 * A default function that owns `version`.
 * @returns {Function} The function.
 */
function makeDefault() {
	function logger() {}
	logger.version = "own";
	return logger;
}

/**
 * Run `processModuleForAPI` for a default function plus a conflicting named export.
 * @param {object} slothlet - The mock.
 * @param {object} extra - Extra options.
 * @param {object} decision - The flattening decision.
 * @returns {object} The result.
 */
function run(slothlet, extra = {}, decision = {}) {
	return new Flatten(slothlet).processModuleForAPI({
		mod: { default: makeDefault(), version: "named" },
		decision,
		moduleName: "logger",
		propertyName: "logger",
		moduleKeys: ["version"],
		analysis: { hasDefault: true },
		apiPathPrefix: "tools",
		...extra
	});
}

describe("Flatten.processModuleForAPI > default/named conflict resolution by context", () => {
	for (const [label, decision] of [
		["hybrid", {}],
		["flatten to root", { flattenToRoot: true }],
		["flatten to category", { flattenToCategory: true }]
	]) {
		describe(label, () => {
			it("uses the initial-context mode when no override is given and the context is initial", () => {
				const result = run(makeSlothlet("replace", "skip"), { collisionContext: "initial" }, decision);
				expect(result.moduleContent.version).toBe("named");
			});

			it("uses the api-context mode when the context is api", () => {
				const result = run(makeSlothlet("replace", "skip"), { collisionContext: "api" }, decision);
				expect(result.moduleContent.version).toBe("own");
			});

			it("prefers a per-call override over the configured modes", () => {
				const result = run(makeSlothlet("skip", "skip"), { collisionContext: "api", collisionModeOverride: "replace" }, decision);
				expect(result.moduleContent.version).toBe("named");
			});
		});
	}
});

describe("Flatten.processModuleForAPI > a named export that is the default itself", () => {
	it("is not attached as a member of the default (hybrid, function default)", () => {
		const logger = makeDefault();
		const result = new Flatten(makeSlothlet("replace", "replace")).processModuleForAPI({
			mod: { default: logger, alias: logger, other: 5 },
			decision: {},
			moduleName: "logger",
			propertyName: "logger",
			moduleKeys: ["alias", "other"],
			analysis: { hasDefault: true }
		});
		expect(Object.hasOwn(result.moduleContent, "alias")).toBe(false);
		expect(result.moduleContent.other).toBe(5);
		expect(result.origins.members).toEqual({ other: ["other"] });
	});

	it("keeps the default's own member under skip when an object default meets a conflicting named export (hybrid, object default)", () => {
		const result = new Flatten(makeSlothlet("skip", "skip")).processModuleForAPI({
			mod: { default: { version: "own" }, version: "named" },
			decision: {},
			moduleName: "tool",
			propertyName: "tool",
			moduleKeys: ["version"],
			analysis: { hasDefault: true }
		});
		expect(result.moduleContent.version).toBe("own");
	});
});
