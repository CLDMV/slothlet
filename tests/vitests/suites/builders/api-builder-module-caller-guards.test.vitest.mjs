/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/builders/api-builder-module-caller-guards.test.vitest.mjs
 *	@Date: 2026-11-28T10:44:16-08:00 (1795891456)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T12:15:25-08:00 (1795896925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `slothlet.*` route checks of api_builder.mjs for module code when the PermissionManager lacks a
 * method they use.
 *
 * @description
 * A module's read of `self.slothlet.<member>` goes through `enforceInternalPermission`, and a refused read through
 * `canTraverseInternalNamespace`. Each checks that the PermissionManager has the methods it calls:
 *   - without `enforceAccess`, a module's read of an allowed member throws PERMISSION_MANAGER_NOT_AVAILABLE
 *   - without `getRulesForCaller`, a refused read can't be opened by a deeper allow rule and stays refused
 *
 * Fixture (written at run time): `api/probe.mjs` reads `self.slothlet.version` and `self.slothlet.permissions`. A rule
 * denies module code `slothlet.permissions`.
 *
 * @module tests/vitests/suites/builders/api-builder-module-caller-guards
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";

const ROOT = path.join(process.cwd(), "tmp", "api-builder-module-caller-guards");
const BASE = path.join(ROOT, "api");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(BASE, { recursive: true });
	writeFileSync(
		path.join(BASE, "probe.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function version() {",
			"\treturn self.slothlet.version;",
			"}",
			"export function permissions() {",
			"\treturn self.slothlet.permissions;",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * A stand-in for a handler that behaves like it except that one method is missing.
 * @param {object} handler - The real handler.
 * @param {string} missing - The method the stand-in lacks.
 * @returns {object} The stand-in.
 */
function withoutMethod(handler, missing) {
	return new Proxy(handler, {
		get(target, key) {
			if (key === missing) return undefined;
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		}
	});
}

/** Module code may not read `slothlet.permissions`. */
const DENY_PERMISSIONS = { policy: "allow", rules: [{ caller: "**", target: "slothlet.permissions", effect: "deny" }] };

let api;
afterEach(async () => {
	if (api) await api.shutdown().catch(() => {});
	api = null;
});

describe("api_builder – module reads of slothlet.* with a PermissionManager missing a method", () => {
	it("a read of an allowed member throws PERMISSION_MANAGER_NOT_AVAILABLE without enforceAccess", async () => {
		api = await slothlet({ mode: "eager", runtime: "async", base: BASE });
		expect(typeof api.probe.version()).toBe("string");
		const sl = resolveWrapper(api.probe).____slothlet;
		const original = sl.handlers.permissionManager;
		sl.handlers.permissionManager = withoutMethod(original, "enforceAccess");
		try {
			expect(() => api.probe.version()).toThrow(expect.objectContaining({ code: "PERMISSION_MANAGER_NOT_AVAILABLE" }));
		} finally {
			sl.handlers.permissionManager = original;
		}
	});

	it("a refused read stays refused without getRulesForCaller", async () => {
		api = await slothlet({ mode: "eager", runtime: "async", base: BASE, permissions: DENY_PERMISSIONS });
		expect(() => api.probe.permissions()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
		const sl = resolveWrapper(api.probe).____slothlet;
		const original = sl.handlers.permissionManager;
		sl.handlers.permissionManager = withoutMethod(original, "getRulesForCaller");
		try {
			expect(() => api.probe.permissions()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
		} finally {
			sl.handlers.permissionManager = original;
		}
	});
});
