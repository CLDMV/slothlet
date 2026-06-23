/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-add-lazy-root-mount-sibling.test.vitest.mjs
 *	@Date: 2026-06-23 05:47:00 -07:00 (1782218820)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-23 05:48:18 -07:00 (1782218898)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Adding a nested sibling under a lazy sub-container that was created as a side effect
 * of a root ("") mount must preserve the intermediate namespace level — it must NOT flatten the new
 * module's leaves onto the sub-container. Regression for the lazy root-mount sibling-drop: mounting
 * `rootMod` (with a `shared/` folder) at "" creates a lazy `api.shared`; a later `api.add("shared.b", …)`
 * probed `shared.b` while `shared` was still unmaterialized, fabricating a waiting proxy that the
 * collision logic mistook for a real child, so `b`'s `keepme` leaf was hoisted onto `shared` and the
 * `b` namespace was lost. A named mount (`ns`) materializes at mount time, so it was never affected;
 * both shapes are asserted here in eager and lazy modes.
 * @module tests/vitests/suites/api-manager/api-manager-add-lazy-root-mount-sibling
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";

/**
 * Unique fixture root under the project tmp folder.
 * @param {string} tag - Disambiguating tag.
 * @returns {string} Absolute path.
 */
function makeRoot(tag) {
	return resolve("tmp", `slothlet-rootmount-sib-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

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

describe.each([{ mode: "eager" }, { mode: "lazy" }])("api.add nested sibling under a mounted sub-container ($mode)", ({ mode }) => {
	const apis = [];
	const dirs = [];

	afterEach(async () => {
		for (const api of apis.splice(0)) await api?.shutdown?.();
		for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
	});

	/**
	 * Build the three fixture folders (base, the mounted module, the sibling module) and boot.
	 * @param {string} mountPath - "" for a root mount (lazy sub-container) or "ns" for a named mount.
	 * @returns {Promise<{api: object, container: () => object}>}
	 */
	async function setup(mountPath) {
		const base = makeRoot(`${mode}-base`);
		const mounted = makeRoot(`${mode}-mounted`);
		const sibling = makeRoot(`${mode}-sibling`);
		dirs.push(base, mounted, sibling);

		await writeModule(join(base, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		// A root ("") mount surfaces the module's own `shared/` folder as a lazy `api.shared`;
		// a named ("ns") mount surfaces the module's root files directly under `api.ns`.
		if (mountPath === "") await writeModule(join(mounted, "shared", "a.mjs"), "export function a() { return 'a'; }");
		else await writeModule(join(mounted, "a.mjs"), "export function a() { return 'a'; }");
		await writeModule(join(sibling, "keepme.mjs"), "export function keepme() { return 'kept'; }");

		const containerKey = mountPath === "" ? "shared" : "ns";
		const api = await slothlet({ base, mode });
		apis.push(api);
		await api.slothlet.api.add(mountPath, mounted, { moduleID: "mounted" });
		await api.slothlet.api.add(`${containerKey}.b`, sibling, { moduleID: "sibling" });
		return { api, container: () => api[containerKey] };
	}

	it('preserves the "b" namespace under a lazy root-mount sub-container (a-first access)', async () => {
		const { container } = await setup("");
		// Access the original leaf first — in lazy mode this materializes the sub-container, which is
		// exactly when the drop used to happen.
		expect(await container().a()).toBe("a");
		// The added sibling must remain a nested namespace, not be hoisted onto the container.
		expect(container().b).toBeDefined();
		expect(typeof container().b.keepme).toBe("function");
		expect(await container().b.keepme()).toBe("kept");
		// And the leaf must NOT have leaked onto the container itself.
		expect(container().keepme).toBeUndefined();
	});

	it('preserves the "b" namespace under a named mount (control)', async () => {
		const { container } = await setup("ns");
		expect(await container().a()).toBe("a");
		expect(container().b).toBeDefined();
		expect(await container().b.keepme()).toBe("kept");
		expect(container().keepme).toBeUndefined();
	});
});
