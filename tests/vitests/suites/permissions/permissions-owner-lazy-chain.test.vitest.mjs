/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-owner-lazy-chain.test.vitest.mjs
 *	@Date: 2026-11-25T21:00:00-08:00 (1795669200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:36-08:00 (1795869156)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A call through `self` down a chain of lazy nodes that have not loaded yet is checked against the member
 * the chain reaches, once it has loaded.
 *
 * @description
 * `launcher.main.activate()` calls `self.launcher.session.store.create()` before `launcher.session` has loaded. The
 * call's check needs the owner of `launcher.session.store.create`, which the ownership registry only records once that
 * leaf composes: checked before the load, `permissions.owner` refused the module its own leaf. The check runs after the
 * load, against the reached leaf, so the owner grant applies as it does in eager mode, and a rule or another owner still
 * refuses the call.
 *
 * Fixture: `api_tests/api_test_permissions_owner` (see permissions-owner.test.vitest.mjs).
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const FIXTURE = path.resolve("api_tests/api_test_permissions_owner");

/**
 * Run `fn` and report its settled outcome: the resolved value, or the error code it rejected with.
 * @param {function(): *} fn - Call to make.
 * @returns {Promise<{ ok: boolean, value?: *, code?: string }>} Outcome.
 */
async function outcome(fn) {
	try {
		return { ok: true, value: await fn() };
	} catch (err) {
		return { ok: false, code: err?.code };
	}
}

describe.each(["async", "live"])("Permissions > owner grant through an unloaded lazy chain > lazy / %s", (runtime) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const build = async (permissions, { other = false } = {}) => {
		api = await slothlet({ mode: "lazy", runtime, base: `${FIXTURE}/base`, permissions });
		await api.slothlet.api.add("launcher", `${FIXTURE}/ext`, { id: "ext" });
		if (other) await api.slothlet.api.add("launcher", `${FIXTURE}/other`, { id: "other" });
		return api;
	};

	it("grants a module its own leaf on the first call down the chain", async () => {
		await build({ policy: "deny", owner: true });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		expect(await outcome(() => api.launcher.main.teardown())).toEqual({ ok: true, value: "destroyed" });
	});

	it("still refuses the call without the owner grant", async () => {
		await build({ policy: "deny" });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("still refuses the call where a rule denies the reached leaf", async () => {
		await build({
			policy: "deny",
			owner: true,
			rules: [{ caller: "launcher.main.**", target: "launcher.session.store.create", effect: "deny" }]
		});
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		expect(await outcome(() => api.launcher.main.teardown())).toEqual({ ok: true, value: "destroyed" });
	});

	it("still refuses a module of another owner mounted at the same path", async () => {
		await build({ policy: "deny", owner: true }, { other: true });
		expect(await outcome(() => api.launcher.intruder.poke())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
	});
});
