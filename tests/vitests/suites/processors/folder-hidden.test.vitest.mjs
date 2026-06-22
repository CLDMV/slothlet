/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/processors/folder-hidden.test.vitest.mjs
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
 * @fileoverview Hidden entries in the api scan: built-in `.`/`__` prefixes (files AND folders), the
 * consumer `hidden` glob option (string or array, relative to the API base), the deprecated
 * `scanHiddenFolders` escape hatch (+ its warning), and empty-folder pruning (#156). All verified on
 * initial load and via api.add, in both eager and lazy modes.
 * @module tests/vitests/suites/processors/folder-hidden
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Unique fixture root under the project tmp folder.
 * @param {string} tag - Disambiguating tag.
 * @returns {string} Absolute path.
 */
function makeRoot(tag) {
	return resolve("tmp", `slothlet-hidden-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe.each([{ mode: "eager" }, { mode: "lazy" }])("Hidden entries + empty-folder prune ($mode)", ({ mode }) => {
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
	 * @param {object} [opts] - Extra slothlet options (e.g. hidden).
	 * @returns {Promise<object>} The api.
	 */
	async function boot(opts = {}) {
		const api = await slothlet({ base: root, mode, ...opts });
		apis.push(api);
		return api;
	}

	/**
	 * Run a callback with SlothletWarning console output suppressed and capture enabled.
	 * @param {Function} fn - Async callback.
	 * @returns {Promise<Array>} Warnings captured while the callback ran.
	 */
	async function captureWarnings(fn) {
		SlothletWarning.suppressConsole = true;
		SlothletWarning.clearCaptured();
		try {
			await fn();
			return [...SlothletWarning.captured];
		} finally {
			SlothletWarning.clearCaptured();
			SlothletWarning.suppressConsole = false;
		}
	}

	it("does not create a leaf for an empty folder (#156)", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await mkdir(join(root, "emptydir"), { recursive: true });
		const api = await boot();
		expect(api.math).toBeDefined();
		expect(api.emptydir).toBeUndefined();
	});

	it("skips `.`/`__`-prefixed folders by default, even when they contain modules", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, ".stash", "x.mjs"), "export function x() { return 1; }");
		await writeModule(join(root, "__internal", "y.mjs"), "export function y() { return 1; }");
		const api = await boot();
		expect(api.math).toBeDefined();
		// A dot-prefixed folder previously surfaced under its sanitized name (dot stripped).
		expect(api.stash).toBeUndefined();
		expect(api.__internal).toBeUndefined();
	});

	it("skips `.`/`__`-prefixed files by default", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, ".secretrc.mjs"), "export function secretrc() { return 1; }");
		await writeModule(join(root, "__helper.mjs"), "export function helper() { return 1; }");
		const api = await boot();
		expect(api.math).toBeDefined();
		expect(api.secretrc).toBeUndefined();
		// `__`-prefixed files (JSDoc-only modules, test helpers) are skipped just like dotfiles.
		expect(api.__helper).toBeUndefined();
		expect(api.helper).toBeUndefined();
	});

	it("scanHiddenFolders: true restores hidden-folder scanning and emits the deprecation warning", async () => {
		await writeModule(join(root, ".stash", "x.mjs"), "export function x() { return 1; }");
		await writeModule(join(root, "__internal", "y.mjs"), "export function y() { return 1; }");
		// Prefixed FILES at the root must stay hidden — the opt-out restores folders only.
		await writeModule(join(root, "__skip.mjs"), "export function skip() { return 1; }");
		await writeModule(join(root, ".dotfile.mjs"), "export function dotfile() { return 1; }");
		let api;
		const warnings = await captureWarnings(async () => {
			api = await boot({ scanHiddenFolders: true });
		});
		// Old behavior restored: the dot folder surfaces under its sanitized name; __ stays as-is.
		expect(api.stash).toBeDefined();
		expect(api.__internal).toBeDefined();
		// ...but prefixed files are still skipped (the dot/__ file rule is not shimmed by the opt-out).
		expect(api.__skip).toBeUndefined();
		expect(api.skip).toBeUndefined();
		expect(api.dotfile).toBeUndefined();
		expect(warnings.some((w) => w.code === "CONFIG_SCAN_HIDDEN_FOLDERS_DEPRECATED")).toBe(true);
	});

	it("prunes a folder that becomes empty after hiding its only child (#156 + hidden)", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "internal", "secret", "x.mjs"), "export function x() { return 1; }");
		const api = await boot({ hidden: "internal/**" });
		expect(api.math).toBeDefined();
		expect(api.internal).toBeUndefined();
	});

	it("hides folders matched by a single glob on initial load", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "drafts", "wip.mjs"), "export function wip() { return 1; }");
		const api = await boot({ hidden: "drafts" });
		expect(api.math).toBeDefined();
		expect(api.drafts).toBeUndefined();
	});

	it("hides folders matched by an array of globs on initial load", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "drafts", "wip.mjs"), "export function wip() { return 1; }");
		await writeModule(join(root, "notes", "todo.mjs"), "export function todo() { return 1; }");
		const api = await boot({ hidden: ["drafts", "notes"] });
		expect(api.math).toBeDefined();
		expect(api.drafts).toBeUndefined();
		expect(api.notes).toBeUndefined();
	});

	it("supports `!` negation gitignore-style: a later `!`glob un-hides an earlier hide", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "secret", "hush.mjs"), "export function hush() { return 1; }");
		await writeModule(join(root, "secret", "keep.mjs"), "export function keep() { return 2; }");
		// Hide everything under secret EXCEPT secret.keep. The broken OR-of-negation hid almost the whole
		// api instead — the `!secret.keep` arm matched every non-keep path (including math).
		const api = await boot({ hidden: ["secret/**", "!secret/keep"] });
		expect(api.math).toBeDefined();
		expect(await api.math.add(1, 2)).toBe(3);
		// secret.keep is un-hidden; calling it also materializes `secret` in lazy mode.
		expect(await api.secret.keep()).toBe(2);
		// secret.hush stays hidden by `secret/**`.
		expect(api.secret.hush).toBeUndefined();
	});

	it("hides files matched by globs (extension-stripped, root and nested)", async () => {
		await writeModule(join(root, "topsecret.mjs"), "export function topsecret() { return 1; }");
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "math", "scratch.mjs"), "export function scratch() { return 1; }");
		const api = await boot({ hidden: ["topsecret", "math.scratch"] });
		expect(api.topsecret).toBeUndefined();
		// Call through the leaf first: in lazy mode this materializes `math`, so absent keys
		// read back as undefined instead of a waiting proxy.
		expect(await api.math.add(1, 2)).toBe(3);
		expect(api.math.scratch).toBeUndefined();
	});

	it("treats empty/invalid hidden entries as a no-op", async () => {
		await writeModule(join(root, "math", "add.mjs"), "export function add(a, b) { return a + b; }");
		await writeModule(join(root, "drafts", "wip.mjs"), "export function wip() { return 1; }");
		const api = await boot({ hidden: ["", null, 123] });
		expect(api.math).toBeDefined();
		expect(api.drafts).toBeDefined();
	});

	it("hides folders and files via api.add options (relative to the added folder)", async () => {
		await writeModule(join(root, "base.mjs"), "export function base() { return 'b'; }");
		const addRoot = makeRoot(`${mode}-add`);
		extraDirs.push(addRoot);
		await writeModule(join(addRoot, "keep", "k.mjs"), "export function k() { return 1; }");
		await writeModule(join(addRoot, "skipme", "s.mjs"), "export function s() { return 1; }");
		await writeModule(join(addRoot, "skipfile.mjs"), "export function skipfile() { return 1; }");
		const api = await boot();
		await api.slothlet.api.add("plugins", addRoot, { hidden: ["skipme", "skipfile"] });
		expect(api.plugins.keep).toBeDefined();
		expect(api.plugins.skipme).toBeUndefined();
		expect(api.plugins.skipfile).toBeUndefined();
	});

	it("api.add skips hidden-prefixed folders by default and honors scanHiddenFolders per call (+ warning)", async () => {
		await writeModule(join(root, "base.mjs"), "export function base() { return 'b'; }");
		const addRoot = makeRoot(`${mode}-addhidden`);
		extraDirs.push(addRoot);
		await writeModule(join(addRoot, "keep", "k.mjs"), "export function k() { return 1; }");
		await writeModule(join(addRoot, ".stash", "s.mjs"), "export function s() { return 1; }");
		const api = await boot();

		await api.slothlet.api.add("plugins", addRoot);
		expect(api.plugins.keep).toBeDefined();
		expect(api.plugins.stash).toBeUndefined();

		const warnings = await captureWarnings(async () => {
			await api.slothlet.api.add("plugins2", addRoot, { scanHiddenFolders: true });
		});
		expect(api.plugins2.stash).toBeDefined();
		expect(warnings.some((w) => w.code === "CONFIG_SCAN_HIDDEN_FOLDERS_DEPRECATED")).toBe(true);
	});
});
