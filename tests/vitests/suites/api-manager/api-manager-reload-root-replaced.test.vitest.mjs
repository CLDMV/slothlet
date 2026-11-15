/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-reload-root-replaced.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A scoped reload of the base, or of an add at the api root, keeps what a later add replaced in one of
 * its namespaces replaced, as a scoped reload of an add one level down does, and the members that add hid come back
 * with the reloaded code when it is removed.
 *
 * @description
 * A module contributes the namespace `grp` with `x` and `y`. A second module (`R`) is added at `grp` with
 * `forceOverwrite`, holding only `x`: `grp.x` is R's and `grp.y` is hidden. Both files of the first module are then
 * rewritten and the first module is reloaded by its moduleID; then R is removed. The first module is the base (`.`),
 * an add at the api root (`""`), or, as the reference, an add at `pp`. In each case, after the reload `grp.x` is
 * still R's and `grp.y` still hidden, and after R's removal both are the first module's rewritten code.
 *
 * Each test writes its own copy of the files under `tmp/test-fixtures/` and rewrites them between the add and the
 * reload.
 * @module tests/vitests/suites/api-manager/api-manager-reload-root-replaced
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_MATRIX } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

// A cold build on a loaded runner can be slow; each test builds one instance and reloads it.
const TIMEOUT = 60_000;

/**
 * Write a file under the scratch directory.
 * @param {string} root - Scratch directory.
 * @param {string} rel - The file, relative to it.
 * @param {string} text - Its content.
 * @returns {void}
 */
function put(root, rel, text) {
	fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
	fs.writeFileSync(path.join(root, rel), text);
}

/**
 * Write the first module's namespace at version `n`.
 * @param {string} dir - The module's folder.
 * @param {number} n - Version written into each file.
 * @returns {void}
 */
function writeGroup(dir, n) {
	put(dir, "grp/x.mjs", `export function x() { return "x${n}"; }\n`);
	put(dir, "grp/y.mjs", `export function y() { return "y${n}"; }\n`);
}

/**
 * Where the first module lives in each case: the base, an add at the root, and the reference add at `pp`.
 * @type {Array<{name: string, at: string|null, prefix: string}>}
 */
const CASES = [
	{ name: "the base", at: null, prefix: "" },
	{ name: "an add at the api root", at: "", prefix: "" },
	{ name: "an add one level down (reference)", at: "pp", prefix: "pp." }
];

/**
 * What the namespace answers: `x`, and `y` or that it is hidden.
 * @param {object} grp - The namespace.
 * @returns {Promise<{x: string, y: string}>} The answers.
 */
async function read(grp) {
	await grp;
	return { x: await grp.x(), y: typeof grp.y === "function" ? await grp.y() : "hidden" };
}

describe.each(TEST_MATRIX)("a scoped reload of the module a later add replaced part of > $name", ({ config }) => {
	let api;
	let root;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		if (root) fs.rmSync(root, { recursive: true, force: true });
		root = null;
	});

	it.each(CASES)(
		"$name: the replacement stands across the reload, and the hidden member comes back reloaded",
		async ({ at, prefix }) => {
			root = makeTestTmpDirSync("reload-root-replaced");
			const first = path.join(root, at === null ? "base" : "first");
			writeGroup(first, 1);
			put(root, "base-other/keep.mjs", `export const k = 1;\n`);
			put(root, "R/x.mjs", `export function x() { return "R"; }\n`);
			api = await slothlet({ ...config, base: at === null ? first : path.join(root, "base-other"), silent: true });
			if (at !== null) await api.slothlet.api.add(at, first, { moduleID: "first" });
			const grp = () => (prefix ? api.pp.grp : api.grp);
			await read(grp());
			await api.slothlet.api.add(`${prefix}grp`, path.join(root, "R"), { moduleID: "R", forceOverwrite: true });
			expect(await read(grp())).toEqual({ x: "R", y: "hidden" });

			writeGroup(first, 2);
			await api.slothlet.api.reload(at === null ? "." : "first");
			expect(await read(grp())).toEqual({ x: "R", y: "hidden" });

			await api.slothlet.api.remove("R");
			expect(await read(grp())).toEqual({ x: "x2", y: "y2" });
		},
		TIMEOUT
	);
});
