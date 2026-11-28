/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lifecycle/impl-removed-subscribers.test.vitest.mjs
 *	@Date: 2026-11-17T00:00:00-08:00 (1794902400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:02-08:00 (1795869122)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The instance's own `impl:removed` subscribers read the v4 payload (`{ path, module, file, folder }`):
 * the routine manager prunes the removed member's raw routine contribution, and the user metadata registered under the
 * removed path's root segment is cleaned up.
 *
 * @description
 * Every public removal path also prunes and cleans directly, so the subscribers are driven here by emitting the event
 * itself, with the payload the api manager emits on a removal.
 */

import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(["eager", "lazy"])("impl:removed subscribers read the v4 payload > %s", (mode) => {
	beforeEach(() => {
		globalThis.__slothletRoutineLog = [];
	});

	it("prunes the removed member's raw routine contribution", async () => {
		const api = await slothlet({
			base: TEST_DIRS.API_TEST_ROUTINES,
			mode,
			routines: { entries: [{ name: "^ext.*.initialize", mode: "manual" }] },
			silent: true
		});
		try {
			await api.slothlet.api.add(["ext", "auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
			await api["^ext.*.initialize"]();
			expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);

			const sl = resolveWrapper(api.ext).____slothlet;
			const entry = sl.handlers.routineManager.raw.find((e) => e.apiPath === "ext.auth.initialize");
			expect(entry?.moduleID).toBeTruthy();
			await sl.handlers.lifecycle.emit("impl:removed", {
				path: ["ext", "auth", "initialize"],
				impl: entry.fn,
				source: "removal",
				module: entry.moduleID,
				file: null,
				folder: null
			});
			expect(sl.handlers.routineManager.raw.some((e) => e.apiPath === "ext.auth.initialize")).toBe(false);

			globalThis.__slothletRoutineLog = [];
			await api["^ext.*.initialize"]();
			expect(globalThis.__slothletRoutineLog).toEqual([]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("cleans up the user metadata registered under the removed path's root segment", async () => {
		const api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, mode, silent: true });
		try {
			await api.slothlet.api.add(["ext", "auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1, { metadata: { tag: "auth" } });
			const sl = resolveWrapper(api.ext).____slothlet;
			expect(sl.handlers.metadata.exportUserState().userMetadataStore.has("ext")).toBe(true);

			await sl.handlers.lifecycle.emit("impl:removed", {
				path: ["ext", "auth"],
				impl: api.ext.auth,
				source: "removal",
				module: null,
				file: null,
				folder: null
			});
			expect(sl.handlers.metadata.exportUserState().userMetadataStore.has("ext")).toBe(false);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
