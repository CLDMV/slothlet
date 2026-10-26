/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-versioned-add.test.vitest.mjs
 *	@Date: 2026-10-19T08:59:35-07:00 (1792425575)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T02:52:54-07:00 (1793008374)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A versioned `api.add` from module code writes at every path it mounts, and an array path is a
 * path (#625).
 *
 * A versioned add mounts the module at `<versionTag>.<apiPath>` and places a version dispatcher at `apiPath`, so
 * module code needs to be allowed to write at both — owned, granted, or neither — with the framework's write rules
 * applied, all checked before anything changes. The host's versioned adds are unchanged. An array `apiPath` from
 * module code is checked as the path it names.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/` (also mounted as `mgr`).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = path.join(FIXTURE, "guest");
const VICTIM = path.join(FIXTURE, "victim");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("versioned and array-path api.add from module code (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim`, and the guest code at `guest` and `mgr`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", VICTIM, { moduleID: "victim" });
		await api.slothlet.api.add("guest", GUEST, { moduleID: "guest" });
		await api.slothlet.api.add("mgr", GUEST, { moduleID: "mgr" });
		return api;
	}

	it.each([
		["inside another module", "victim", "LOOSE_SET_NOT_OWNED"],
		["at a new top-level name", "zz", "LOOSE_SET_NOT_OWNED"],
		["under a framework root function", "shutdown", "PERMISSION_DENIED"],
		["inside a rule manager", "mgr", "LOOSE_SET_NOT_OWNED"]
	])("refuses a version tag that mounts %s, and changes nothing", async (_label, version, code) => {
		await load({ permissions: { rules: [{ caller: "mgr.**", target: "slothlet.permissions.addRule", effect: "allow" }] } });
		expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAtVersion("guest", GUEST, { moduleID: "g2" }, version))).toBe(code);
		expect(api[version]?.guest).toBeUndefined();
		expect(await api.victim.v.secret()).toBe("SECRET");
		expect(typeof api.guest.x.listSelf).toBe("function");
	});

	it("lets module code add a version whose mount and dispatcher paths are its own", async () => {
		await load();
		expect(await api.guest.x.addAtVersion("guest.lib", GUEST, { moduleID: "gv" }, "guest")).toBe("done");
		expect(typeof api.guest.guest.lib.x.listSelf).toBe("function");
	});

	it("lets module code add a version where a host rule grants both paths", async () => {
		await load({
			permissions: {
				rules: [
					{ caller: "guest.**", target: "v1:write", effect: "allow" },
					{ caller: "guest.**", target: "v1.**:write", effect: "allow" }
				]
			}
		});
		expect(await api.guest.x.addAtVersion("guest.lib", GUEST, { moduleID: "gv" }, "v1")).toBe("done");
		expect(typeof api.v1.guest.lib.x.listSelf).toBe("function");
	});

	it("leaves the host's versioned adds as they were", async () => {
		await load();
		await api.slothlet.api.add("lib", GUEST, { moduleID: "hv" }, { version: "v1" });
		expect(typeof api.v1.lib.x.listSelf).toBe("function");
	});

	it("checks an array path from module code as the path it names", async () => {
		await load({ permissions: { defaultPolicy: "allow" } });
		expect(await api.guest.x.addAt(["guest", "s2"], GUEST, { moduleID: "s2" })).toBe("done");
		expect(typeof api.guest.s2.x.listSelf).toBe("function");
		expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt(["victim", "x"], GUEST, { moduleID: "vx" }))).toBe(
			"LOOSE_SET_NOT_OWNED"
		);
		expect(api.victim.x).toBeUndefined();
	});
});
