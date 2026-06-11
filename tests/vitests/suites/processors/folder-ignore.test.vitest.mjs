/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/processors/folder-ignore.test.vitest.mjs
 *	@Date: 2026-06-10 21:38:33 -07:00 (1781152713)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-10 21:52:07 -07:00 (1781153527)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Folder ignore globs + empty-folder pruning (#156). Verifies that the `ignore` option
 * (a glob or array of globs, relative to the API base) skips matching folders on initial load and via
 * api.add, and that a folder yielding no leaves never creates a phantom API entry.
 * @module tests/vitests/suites/processors/folder-ignore
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";

/**
 * Unique fixture root under the project tmp folder.
 * @param {string} tag - Disambiguating tag.
 * @returns {string} Absolute path.
 */
function makeRoot(tag) {
	return resolve("tmp", `slothlet-ignore-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe.each([{ mode: "eager" }, { mode: "lazy" }])("Folder ignore + empty-folder prune ($mode)", ({ mode }) => {
	let root;
	const apis = [];
	const extraDirs = [];

	beforeEach(async () => {
		root = makeRoot(mode);
		await mkdir(root, { recursive: true });
	});

	afterEach(async () => {
		for (const api of apis.splice(0)) await api?.shutdown?.();
		await rm(root, { recursive: true, force: true });
		for (const d of extraDirs.splice(0)) await rm(d, { recursive: true, force: true });
	});

	/**
	 * Boot a slothlet instance against the fixture root.
	 * @param {object} [opts] - Extra slothlet options (e.g. ignore).
	 * @returns {Promise<object>} The api.
	 */
	async function boot(opts = {}) {
		const api = await slothlet({ base: root, mode, ...opts });
		apis.push(api);
		return api;
	}

	it("does not create a leaf for an empty folder (#156)", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await mkdir(join(root, "emptydir"), { recursive: true });
		const api = await boot();
		expect(api.math).toBeDefined();
		expect(api.emptydir).toBeUndefined();
	});

	it("prunes a folder that becomes empty after ignoring its only child (#156 + ignore)", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "internal", "secret", "x.mjs"), "export function x() { return 1; }");
		const api = await boot({ ignore: "internal/**" });
		expect(api.math).toBeDefined();
		expect(api.internal).toBeUndefined();
	});

	it("ignores folders matched by a single glob on initial load", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "drafts", "wip.mjs"), "export function wip() { return 1; }");
		const api = await boot({ ignore: "drafts" });
		expect(api.math).toBeDefined();
		expect(api.drafts).toBeUndefined();
	});

	it("ignores folders matched by an array of globs on initial load", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "drafts", "wip.mjs"), "export function wip() { return 1; }");
		await writeModule(join(root, "notes", "todo.mjs"), "export function todo() { return 1; }");
		const api = await boot({ ignore: ["drafts", "notes"] });
		expect(api.math).toBeDefined();
		expect(api.drafts).toBeUndefined();
		expect(api.notes).toBeUndefined();
	});

	it("treats empty/invalid ignore entries as a no-op", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "drafts", "wip.mjs"), "export function wip() { return 1; }");
		const api = await boot({ ignore: ["", null, 123] });
		expect(api.math).toBeDefined();
		expect(api.drafts).toBeDefined();
	});

	it("ignores folders via api.add options (relative to the added folder)", async () => {
		await writeModule(join(root, "base.mjs"), "export function base() { return 'b'; }");
		const addRoot = makeRoot(`${mode}-add`);
		extraDirs.push(addRoot);
		await writeModule(join(addRoot, "keep", "k.mjs"), "export function k() { return 1; }");
		await writeModule(join(addRoot, "skipme", "s.mjs"), "export function s() { return 1; }");
		const api = await boot();
		await api.slothlet.api.add("plugins", addRoot, { ignore: "skipme" });
		expect(api.plugins.keep).toBeDefined();
		expect(api.plugins.skipme).toBeUndefined();
	});
});
