/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-cache-reload-cleanup.test.vitest.mjs
 *	@Date: 2026-05-14T00:00:00-07:00 (1778803200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-14 00:00:00 -07:00 (1778803200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Verifies that TS transform cache directories from the previous
 * `instanceID` are removed when `api.slothlet.reload()` rotates the ID.
 *
 * Without the rotation cleanup, dev processes that reload frequently would
 * accumulate one `<projectRoot>/.slothlet-cache/<pid>-<instanceID>/` dir per
 * reload (the same-PID sweep only removes dirs whose owning PID is dead).
 */
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import slothlet from "../../../../index.mjs";

/**
 * List dirs under `.slothlet-cache/` whose name matches `<pid>-*` for the
 * current process. Each one corresponds to a still-tracked instanceID for
 * this process.
 *
 * @param {string} projectRoot - Repo root that owns `.slothlet-cache/`.
 * @returns {string[]} Absolute paths to matching dirs, possibly empty.
 */
function listOwnCacheDirs(projectRoot) {
	const cacheRoot = path.join(projectRoot, ".slothlet-cache");
	if (!fs.existsSync(cacheRoot)) return [];
	const prefix = `${process.pid}-`;
	return fs
		.readdirSync(cacheRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
		.map((entry) => path.join(cacheRoot, entry.name));
}

describe("TS transform cache cleanup on reload", () => {
	let api;
	// findPackageRoot in the loader walks up from the original .ts source path;
	// for api_test_typescript_runtime that resolves to the slothlet repo root.
	const projectRoot = path.resolve(import.meta.dirname, "../../../..");

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("removes the previous instance's TS cache dir when reload rotates instanceID", async () => {
		api = await slothlet({
			base: "./api_tests/api_test_typescript_runtime",
			mode: "eager",
			typescript: "fast"
		});

		// After initial TS load, at least one PID-prefixed dir should exist.
		const dirsBeforeReload = listOwnCacheDirs(projectRoot);
		expect(dirsBeforeReload.length).toBeGreaterThan(0);

		await api.slothlet.reload();

		// After reload (instanceID rotates), none of the previously-existing dirs
		// should remain — the rotation cleanup removed them. A fresh dir under
		// the new instanceID will exist instead.
		const dirsAfterReload = listOwnCacheDirs(projectRoot);
		for (const dir of dirsBeforeReload) {
			expect(dirsAfterReload).not.toContain(dir);
		}
		expect(dirsAfterReload.length).toBeGreaterThan(0);
	});
});
