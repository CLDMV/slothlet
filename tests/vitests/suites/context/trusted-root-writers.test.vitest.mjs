/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/trusted-root-writers.test.vitest.mjs
 *	@Date: 2026-11-25T01:31:41-08:00 (1795599101)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:36-08:00 (1795869096)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Context-key write enforcement for a store with no instance to ask (a view used after its scope ended):
 * the writer comes from the store's own fields, a writer with no api path owns nothing, and a writer the context
 * manager cannot tell apart is refused.
 *
 * @module tests/vitests/suites/context/trusted-root-writers.test.vitest
 */

import { describe, it, expect } from "vitest";
import { enforceContextKeyWrite, writersOf } from "#handlers/trusted-root";

describe("writersOf — a store with no instance", () => {
	it("answers no writers for a store with no wrapper", () => {
		expect(writersOf({})).toEqual([]);
	});

	it("answers the store's own wrapper followed by its ceiling", () => {
		const own = { ____slothletInternal: { apiPath: "a.b" } };
		const ceiling = { ____slothletInternal: { apiPath: "c.d" } };
		expect(writersOf({ currentWrapper: own, currentCeiling: ceiling })).toEqual([own, ceiling]);
	});

	it("refuses a writer the context manager cannot tell apart", () => {
		const store = { slothlet: { instanceID: "tr", contextManager: { getCallerIdentity: () => ({ unresolved: true }) } } };
		expect(() => writersOf(store)).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
	});
});

describe("enforceContextKeyWrite — a writer with no api path", () => {
	it("is refused a key a module owns, and reported as the host", () => {
		const owners = Object.create(null);
		owners.k = "mod.a";
		const ctx = { __contextOwners: owners, currentWrapper: { ____slothletInternal: {} } };
		expect(() => enforceContextKeyWrite(ctx, "k")).toThrow(expect.objectContaining({ code: "CONTEXT_KEY_PROTECTED" }));
	});

	it("lets the owning module write its key", () => {
		const owners = Object.create(null);
		owners.k = "mod.a";
		const ctx = { __contextOwners: owners, currentWrapper: { ____slothletInternal: { apiPath: "mod.a.write" } } };
		expect(() => enforceContextKeyWrite(ctx, "k")).not.toThrow();
	});
});
