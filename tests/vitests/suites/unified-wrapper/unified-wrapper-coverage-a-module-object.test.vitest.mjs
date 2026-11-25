/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-module-object.test.vitest.mjs
 *	@Date: 2026-11-25T01:51:47-08:00 (1795600307)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:02-08:00 (1795601582)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that changes its own exported object after it loaded (#757) is read through the api as the
 * object reads: an accessor it adds or puts in place of a data member answers through the node, a nested object it
 * replaces is the new one, and members it deletes are gone — with the permission system off and on.
 *
 * Fixture: `api_tests/api_test_uwa_made` — `settings`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_uwa_made/api");

const CONFIGS = [];
for (const permissions of ["off", "on"])
	for (const [mode, runtime] of [
		["eager", "async"],
		["lazy", "live"]
	])
		CONFIGS.push({ mode, runtime, permissions });

describe.each(CONFIGS)(
	"a module changing its own object — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("reads the object as the object reads after each change", async () => {
			api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, ...(permissions === "on" ? { permissions: {} } : {}) });
			await api.settings.config;
			const plain = { port: 80, host: "local", nested: { n: 1 } };
			const config = api.settings.config;
			expect([config.port, config.nested.n, Object.keys(config)]).toEqual([plain.port, plain.nested.n, Object.keys(plain)]);
			await api.settings.addAccessor();
			expect([config.live, Object.keys(config)]).toEqual(["live", ["port", "host", "nested", "live"]]);
			await api.settings.portToAccessor();
			expect(config.port).toBe(91);
			await api.settings.replaceNested();
			expect(config.nested.n).toBe(2);
			await api.settings.drop();
			expect(["host" in config, "nested" in config, Object.keys(config)]).toEqual([false, false, ["port", "live"]]);
		});
	}
);
