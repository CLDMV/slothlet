/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/callable-node-member-delete.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:54-08:00 (1795869174)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Deleting a member of a function node removes it, as deleting a member of a function does.
 *
 * @description
 * A folder whose root file's default export is a function is mounted at `zz`, so `zz` is a function node holding the
 * folder's other files as members. Deleting one, by the host and by a module allowed to, leaves it gone from the node:
 * `in`, the listing and a read all answer as they do for a plain function the member was deleted from. Eager and lazy
 * mode, the async and live runtime.
 * @module tests/vitests/suites/proxies/callable-node-member-delete
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_root_integrity");

const configs = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime })));

/**
 * What deleting a member of a function leaves, for a plain function holding the same member.
 * @returns {{deleted: boolean, has: boolean, listed: boolean, read: string}} The answers.
 */
function plainTwin() {
	const fn = function root() {};
	fn.data = { a: 1 };
	const deleted = delete fn.data;
	return { deleted, has: "data" in fn, listed: Object.keys(fn).includes("data"), read: typeof fn.data };
}

describe.each(configs)("deleting a member of a function node > $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(["fnroot", "asyncroot"])("removes it, as from a function: %s", async (root) => {
		api = await slothlet({ base: join(FIXTURE, "objroot"), silent: true, mode, runtime });
		await api.slothlet.api.add("zz", join(FIXTURE, root), { id: "zz" });
		await api.zz.data;
		expect(typeof api.zz).toBe("function");
		const deleted = delete api.zz.data;
		expect({ deleted, has: "data" in api.zz, listed: Object.keys(api.zz).includes("data"), read: typeof api.zz.data }).toEqual(plainTwin());
		// The node's other members stay.
		expect(api.zz.tool.run()).toBe("run");
		expect(api.zz.pnum).toBe(7);
	});

	it("removes it when a module allowed to change the node deletes it", async () => {
		api = await slothlet({ base: join(FIXTURE, "objroot"), silent: true, mode, runtime });
		await api.slothlet.api.add("zz", join(FIXTURE, "fnroot"), { id: "zz" });
		await api.slothlet.api.add("w", join(FIXTURE, "writer"), { id: "w" });
		await api.zz.data;
		expect(api.w.ops.change("delete", "given", "zz", api)).toEqual({ deleted: true, has: false });
		expect(Object.keys(api.zz)).not.toContain("data");
	});
});
