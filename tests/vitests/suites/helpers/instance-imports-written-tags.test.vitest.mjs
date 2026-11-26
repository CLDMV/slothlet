/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/instance-imports-written-tags.test.vitest.mjs
 *	@Date: 2026-11-25T01:49:14-08:00 (1795600154)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:14:51-08:00 (1795601691)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Which tags a resolved import keeps (see `propagateInstanceQuery` in `src/lib/helpers/instance-imports.mjs`):
 * a URL any code wrote out keeps the instance it names, but never the tags only slothlet gives (the helper-copy tags and
 * the mount a leaf is loaded under); a helper loaded once per api file names the api file and mount it is loaded for.
 */

import { describe, expect, it } from "vitest";
import { propagateInstanceQuery } from "#helpers/instance-imports";

const LEAF = "file:///app/api/tally/tally.mjs?slothlet_instance=abc";
const OWN_FILE = import.meta.resolve("#helpers/instance-imports");

describe("instance-imports > the tags a resolved import keeps", () => {
	it("keeps a URL an instance file wrote out naming its instance, with no tag only slothlet gives, as it is", () => {
		const child = "file:///app/lib/s.mjs?slothlet_instance=other&v=1";
		expect(propagateInstanceQuery("../lib/s.mjs?slothlet_instance=other&v=1", LEAF, child)).toBe(child);
	});

	it("drops the tags only slothlet gives from a URL an instance file wrote out", () => {
		const child =
			"file:///app/lib/s.mjs?slothlet_instance=abc&module=m1&slothlet_helpers=module&slothlet_for=%2Fapp%2Fx.mjs&slothlet_mount=m2";
		expect(propagateInstanceQuery("../lib/s.mjs", LEAF, child)).toBe("file:///app/lib/s.mjs?slothlet_instance=abc");
	});

	it("keeps the URL slothlet built for its own module-system bridges", () => {
		const child = "file:///app/lib/s.mjs?slothlet_instance=abc&module=m1";
		expect(propagateInstanceQuery("file:///app/lib/s.mjs", `slothlet-esm:${LEAF}`, child)).toBe(child);
		expect(propagateInstanceQuery("file:///app/lib/s.mjs", `slothlet-esm-facade:${LEAF}`, child)).toBe(child);
	});

	it("drops the tags only slothlet gives from what a file of no instance imports, keeping the hash", () => {
		const child = "/app/lib/s.mjs?slothlet_instance=abc&module=m1&v=2#part";
		expect(propagateInstanceQuery("./lib/s.mjs", "/app/host.mjs", child)).toBe("/app/lib/s.mjs?slothlet_instance=abc&v=2#part");
		// No tag to drop: left as it is.
		const plain = "/app/lib/s.mjs?slothlet_instance=abc";
		expect(propagateInstanceQuery("./lib/s.mjs", "/app/host.mjs", plain)).toBe(plain);
	});

	it("keeps every tag on what slothlet's own files, or the host's entry, import", () => {
		const child = "/app/lib/s.mjs?slothlet_instance=abc&module=m1";
		expect(propagateInstanceQuery("/app/lib/s.mjs", OWN_FILE, child)).toBe(child);
		expect(propagateInstanceQuery("/app/lib/s.mjs", undefined, child)).toBe(child);
	});

	it("gives a helper loaded once per api file the api file and the mount it is loaded for", () => {
		// The importer is the api file itself: the copy names it, and the api file's mount.
		const leaf = "file:///app/api/tally/tally.mjs?slothlet_instance=abc&module=m1&slothlet_helpers=module";
		expect(new URL(propagateInstanceQuery("../lib/s.mjs", leaf, "file:///app/api/lib/s.mjs")).searchParams.get("slothlet_for")).toBe(
			"/app/api/tally/tally.mjs"
		);
		expect(new URL(propagateInstanceQuery("../lib/s.mjs", leaf, "file:///app/api/lib/s.mjs")).searchParams.get("slothlet_mount")).toBe(
			"m1"
		);
		// The importer is a helper copy loaded for an api file: the copy names that api file and its mount.
		const helper =
			"file:///app/api/lib/a.mjs?slothlet_instance=abc&slothlet_helpers=module&slothlet_for=%2Fapp%2Fapi%2Fx.mjs&slothlet_mount=m2";
		const out = new URL(propagateInstanceQuery("./b.mjs", helper, "file:///app/api/lib/b.mjs")).searchParams;
		expect(out.get("slothlet_helpers")).toBe("module");
		expect(out.get("slothlet_for")).toBe("/app/api/x.mjs");
		expect(out.get("slothlet_mount")).toBe("m2");
		// A helper copy whose api file has no mount names none.
		const unmounted = "file:///app/api/lib/a.mjs?slothlet_instance=abc&slothlet_helpers=module&slothlet_for=%2Fapp%2Fapi%2Fx.mjs";
		expect(new URL(propagateInstanceQuery("./b.mjs", unmounted, "file:///app/api/lib/b.mjs")).searchParams.has("slothlet_mount")).toBe(
			false
		);
	});
});
