/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/private-folder-mount-call.test.vitest.mjs
 *	@Date: 2026-11-25T13:12:19-08:00 (1795641139)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:24:08-08:00 (1795641848)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Calling through an underscore-named folder from another module.
 *
 * @description
 * A folder whose name starts with `_` and that holds no function of its own is a public mount: privacy attaches to a
 * member that holds a value or function, not to a folder namespace (docs/PERMISSIONS.md, "Module-Private Exports").
 * Another module calling `self.ext._box.item.open()` (`ext` added as a module of its own) is allowed in every mode, a real private member under that folder
 * stays refused, and the host calls the public function as well.
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_private_folder_call/api");
const EXT = resolve("api_tests/api_test_private_folder_call/ext");

// "strict" refuses to start without AsyncContextFrame on the async runtime: run it only where Node has it on by default.
const framesOnByDefault = process.allowedNodeEnvironmentFlags.has("--no-async-context-frame");

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["on", "strict"]
			.filter((permissions) => permissions !== "strict" || runtime === "live" || framesOnByDefault)
			.map((permissions) => ({ mode, runtime, permissions }))
	)
);

describe.each(configs)("Permissions > a call through an underscore-named folder > $mode / $runtime / $permissions", (config) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	// `ext` is added as a module of its own, so the base's `caller` module is another module to it.
	const load = async () => {
		const instance = await slothlet({ ...config, base: BASE, permissions: { mode: config.permissions, policy: "allow", rules: [] } });
		await instance.slothlet.api.add("ext", EXT, { id: "ext-mod" });
		return instance;
	};

	it("lets another module call a public function under the folder", async () => {
		api = await load();
		const denials = [];
		api.slothlet.lifecycle.on("permission:denied", (payload) => denials.push(payload.target));

		expect(await api.caller.use.open()).toEqual({ value: "opened", error: null });
		expect(denials).toEqual([]);
	});

	it("lets another module call through the folder it read first", async () => {
		api = await load();

		expect(await api.caller.use.openHeld()).toEqual({ value: "opened", error: null });
	});

	it("keeps a private member under the folder refused to another module", async () => {
		api = await load();

		expect(await api.caller.use.seal()).toEqual({ value: undefined, error: "PERMISSION_DENIED" });
	});

	it("lets the host call the public function under the folder", async () => {
		api = await load();

		expect(await api.ext._box.item.open()).toBe("opened");
	});

	it("keeps the private member refused to the host", async () => {
		api = await load();

		let out;
		try {
			out = await api.ext._box.item._seal();
		} catch (e) {
			out = `THREW:${e.code}`;
		}
		expect(out).toBe("THREW:PERMISSION_DENIED");
	});
});
