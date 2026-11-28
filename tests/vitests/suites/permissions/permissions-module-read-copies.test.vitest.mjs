/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-module-read-copies.test.vitest.mjs
 *	@Date: 2026-10-23T22:20:55-07:00 (1792819255)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:35-08:00 (1795869155)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What the framework's metadata and versioning getters hand module code is a copy (#625).
 *
 * `metadata.get`, `metadata.getForVersion`, `versioning.metadata.get`, and `versioning.list` answer with
 * what the framework stores for a path. Module code changing an object it got back changes its own copy, never the
 * store: another module's metadata, its version metadata, and the version registry a dispatcher routes by stay as
 * they were — the setters, which hold module code to its own paths, are the only way to change them.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/` (also mounted as the versioned `svc`), `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, apiPart } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const VICTIM = apiPart(FIXTURE, "victim");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("copies the metadata getters hand module code (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("leaves the store as it was when module code changes what it read (permissions %s)", async (_label, options) => {
		api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", VICTIM, { id: "victim", metadata: { tier: { level: 1 } } });
		await api.slothlet.api.add("svc", VICTIM, { id: "svc1", version: { tag: "v1", default: true, metadata: { nested: { flag: "ok" } } } });
		await api.slothlet.api.add("guest", apiPart(FIXTURE, "guest"), { id: "guest" });

		await api.guest.x.changeReadMetadata("victim", "svc", "v1");

		const meta = api.slothlet.metadata.get("victim");
		expect(meta.tier.level).toBe(1);
		expect(meta.planted).toBeUndefined();
		const versionMeta = api.slothlet.versioning.metadata.get("svc", "v1");
		expect(versionMeta.version).toBe("v1");
		expect(versionMeta.nested.flag).toBe("ok");
		const listed = api.slothlet.versioning.list("svc").versions.v1;
		expect(listed.path).toEqual(["v1", "svc"]);
		expect(listed.metadata.nested.flag).toBe("ok");
		expect(await api.svc.v.secret()).toBe("SECRET");
	});
});
