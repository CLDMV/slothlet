/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-leaves-module-caller.test.vitest.mjs
 *	@Date: 2026-11-15T20:41:31-08:00 (1794804091)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T21:10:11-08:00 (1794805811)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.api.leaves()` called by a module answers the same in eager and lazy mode (#816).
 *
 * @description
 * A module asking for a module's leaves is shown the paths of that module it may read: its own module's privates
 * included, another module's left out. In lazy mode the call settles the module's subtree first, and that settling is
 * slothlet's own bookkeeping, not a read of the caller's, so it is never refused to the caller. The expected listings
 * are the eager instance's with no permission config, with the privates another module may not read left out.
 * @module tests/vitests/suites/api-manager/api-leaves-module-caller
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_private_scope");
const EXT = resolve("api_tests/api_test_private_scope_ext");

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** Whether a path's last segment is a private member's name (leaves() reports a path as its segments). */
const isPrivate = (path) => path[path.length - 1].startsWith("_");

/** The listings with no permission config, eager: everything is public there. */
const all = {};

beforeAll(async () => {
	const api = await slothlet({ base: BASE, mode: "eager", silent: true });
	await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
	all.base = await api.slothlet.api.leaves(".");
	all.ext = await api.slothlet.api.leaves("ext-mod");
	await api.shutdown();
});

describe.each(configs)("api.leaves from a module > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("shows a module its own module's leaves, privates included, and another module's without them", async () => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules: [] } });
		await api.slothlet.api.add("ext", EXT, { moduleID: "ext-mod" });
		expect(all.ext.some(isPrivate)).toBe(true);
		expect(all.base.some(isPrivate)).toBe(true);
		expect(await api.ext.list.paths("ext")).toEqual({ paths: all.ext, error: null });
		expect(await api.ext.list.paths("ext-mod")).toEqual({ paths: all.ext, error: null });
		expect(await api.ext.list.paths(".")).toEqual({ paths: all.base.filter((path) => !isPrivate(path)), error: null });
	});
});
