/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-hook-receiver.test.vitest.mjs
 *	@Date: 2026-10-26T11:04:09-07:00 (1793037849)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T20:52:50-07:00 (1793505170)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A hook handler is called with no receiver (#625).
 *
 * A handler a module registers is the module's code: called as a method of the hook's own record, it would get
 * that record as `this`, and could change its own registration (its handler, its owner) and so be called later
 * unviewed, with the host's `api`. It is called as a plain function instead, as a lifecycle subscriber is.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothletInstance from "@cldmv/slothlet";

/**
 * Create an instance with `permissions.provenance` pinned off (#597, #682). These cases run this file's own code
 * inside module calls; under vitest vite transforms it, so it cannot be verified as the host's own source and
 * provenance would refuse it. Host code inside module calls with provenance on is covered under Node's own loader by
 * provenance-host-code.
 * @param {object} config - The instance's configuration.
 * @returns {Promise<object>} The api.
 */
const slothlet = (config) =>
	slothletInstance(config?.permissions ? { ...config, permissions: { provenance: false, ...config.permissions } } : config);
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const PROBE = "slothlet.test.i625.hookReceiver";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("hook handler receiver (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		delete globalThis[Symbol.for(PROBE)];
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	it.each([
		["permissions on", { permissions: { defaultPolicy: "allow" } }],
		["permissions off", {}]
	])("calls a module's handler with no receiver, so it cannot change its own registration (%s)", async (_label, options) => {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, hook: { enabled: true }, ...options });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		const seen = [];
		let handedApi = null;
		globalThis[Symbol.for(PROBE)] = (self) => {
			self.slothlet.hook.on("before:victim.v.echo", function handler({ api: given }) {
				seen.push(this === undefined ? "none" : typeof this);
				if (this && typeof this === "object") {
					this.handler = function swapped({ api: raw }) {
						handedApi = raw;
					};
				}
				handedApi ??= given;
			});
		};
		await api.guest.x.runWithSelf(PROBE);
		await api.victim.v.echo(1);
		await api.victim.v.echo(2);
		expect(seen).toEqual(["none", "none"]);
		expect(handedApi).not.toBe(api);
	});
});
