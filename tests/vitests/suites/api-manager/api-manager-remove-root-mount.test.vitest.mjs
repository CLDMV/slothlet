/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-remove-root-mount.test.vitest.mjs
 *	@Date: 2026-06-21 21:49:06 -07:00 (1782103746)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-21 21:49:47 -07:00 (1782103787)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression: removing a module mounted at the root ("") via api.add("", ...) must delete
 * only that module's own paths, not the shared container holding a sibling that a DIFFERENT module added
 * beneath it. The children-check (hasChildrenWithOtherOwners) scanned only the removed module's own paths
 * and missed the foreign sibling, so the container — and the sibling — were wrongly deleted. Verified in
 * both eager and lazy modes; assertions are mode-agnostic (a removed lazy leaf reads back as a leftover
 * proxy, not undefined, so the test checks the surviving sibling + the diagnostics registry instead).
 *
 * @module tests/vitests/suites/api-manager/api-manager-remove-root-mount
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";

/**
 * Write a fixture module, creating parent dirs.
 * @param {string} filePath - Absolute file path.
 * @param {string} code - Module source.
 * @returns {Promise<void>}
 */
async function writeModule(filePath, code) {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, code);
}

/**
 * Unique fixture dir under the project tmp folder.
 * @param {string} tag - Disambiguating tag.
 * @returns {string} Absolute path.
 */
function makeDir(tag) {
	return resolve("tmp", `slothlet-rootmount-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe.each([{ mode: "eager" }, { mode: "lazy" }])('api-manager — remove a "" root mount keeps a foreign sibling ($mode)', ({ mode }) => {
	let api;
	const dirs = [];

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown().catch(() => {});
		api = null;
		for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
	});

	it("deletes only the root mount's own paths, not the container holding another module's sibling", async () => {
		const base = makeDir(`base-${mode}`);
		const rootMod = makeDir(`mod-${mode}`);
		const sibMod = makeDir(`sib-${mode}`);
		dirs.push(base, rootMod, sibMod);

		await writeModule(join(base, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		// A module mounted at "" whose paths live under the `shared` container (shared.a, shared.x).
		await writeModule(join(rootMod, "shared", "a.mjs"), "export function a() { return 'a'; }");
		await writeModule(join(rootMod, "shared", "x.mjs"), "export function x() { return 'x'; }");
		// A sibling added under that SAME container by a different module.
		await writeModule(join(sibMod, "keepme.mjs"), "export function keepme() { return 'kept'; }");

		api = await slothlet({ base, mode, silent: true, diagnostics: true });
		await api.slothlet.api.add("", rootMod, { moduleID: "rootmod" });
		await api.slothlet.api.add("shared.b", sibMod, { moduleID: "sibmod" });

		// Sanity: the foreign sibling resolves and the root mount is registered. (Deliberately do NOT touch
		// shared.a first — that trips a *separate* lazy-materialization bug that drops the sibling; this
		// test targets removal ownership, not materialization order.)
		expect(await api.shared.b.keepme()).toBe("kept");
		expect(api.slothlet.diag.caches.getAllModuleIDs().some((id) => id.startsWith("rootmod"))).toBe(true);

		await api.slothlet.api.remove("rootmod");

		// The root mount is actually gone…
		expect(api.slothlet.diag.caches.getAllModuleIDs().some((id) => id.startsWith("rootmod"))).toBe(false);
		// …but the sibling another module added under the shared container survives, and the base is intact.
		expect(await api.shared.b.keepme()).toBe("kept");
		expect(await api.math.add(1, 2)).toBe(3);
	});
});
