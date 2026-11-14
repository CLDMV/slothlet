/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-mode-shorthand.test.vitest.mjs
 *	@Date: 2026-11-13T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T23:20:58-08:00 (1794640858)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions` as a bare mode string (#765).
 *
 * `permissions: "on" | "off" | "disabled"` means `{ mode }`, and `true` / `false` mean `"on"` / `"off"`. Any other
 * string, or any other value that is not an object, is an `INVALID_CONFIG`. The shorthand never reads as a
 * different mode than the one it names.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const SHORTHANDS = [
	["disabled", "disabled"],
	["off", "off"],
	["on", "on"],
	[true, "on"],
	[false, "off"]
];

describe.each(CONFIGS)("permissions as a bare mode string (#765) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `guest`.
	 * @param {*} permissions - The `permissions` option.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(permissions) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		return api;
	}

	/**
	 * What a module that owns none of the framework's namespace gets writing to it.
	 * @returns {string} `"done"` or the refusal code.
	 */
	const writeNamespace = () => withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeNamespaceMember("shorthand", 1));

	it.each(SHORTHANDS)("%j behaves as { mode: %j }", async (shorthand, modeName) => {
		await load(shorthand);
		const shorthandMode = api.slothlet.permissions.control.mode;
		const shorthandWrite = writeNamespace();
		await api.shutdown();

		await load({ mode: modeName });
		expect(shorthandMode).toBe(modeName);
		expect(api.slothlet.permissions.control.mode).toBe(modeName);
		expect(shorthandWrite).toBe(writeNamespace());
		expect(shorthandWrite).toBe(modeName === "disabled" ? "done" : "PERMISSION_DENIED");
	});

	it.each(["unknown", "ON", 1])("%j is not a mode and is rejected", async (bad) => {
		await expect(load(bad)).rejects.toMatchObject({ code: "INVALID_CONFIG" });
	});
});
