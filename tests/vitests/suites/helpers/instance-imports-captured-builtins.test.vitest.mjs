/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/instance-imports-captured-builtins.test.vitest.mjs
 *	@Date: 2026-11-08T16:45:45-08:00 (1794185145)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:58:40-08:00 (1794185920)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Which package a file belongs to is read with what the instance-import helpers captured when they loaded
 * (#715), not with globals as they are when an import resolves.
 * @description
 * The resolve hook runs in the importing thread, so code that replaced `JSON.parse`, `fs.readFileSync` or
 * `process.getBuiltinModule` would otherwise change which files a module's instance shares. Each case uses a package
 * tree of its own, as each directory's answer is kept for the life of the process: `pkg/` is a package (a named
 * `package.json`), `pkg/marker/` holds a `package.json` with no name, which leaves it in `pkg`.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isInstanceScopedFile, isCommonJSFile } from "@cldmv/slothlet/helpers/instance-imports";

/**
 * Make a package tree: `pkg/package.json` named, `pkg/marker/package.json` without a name, `pkg/lib/h.js` CommonJS
 * by its `type`.
 * @returns {{pkg: string, cleanup: () => void}} The package's forward-slash path and its removal.
 */
const makeTree = () => {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-715-builtins-"));
	const pkg = path.join(base, "pkg");
	fs.mkdirSync(path.join(pkg, "marker"), { recursive: true });
	fs.mkdirSync(path.join(pkg, "lib"), { recursive: true });
	fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "captured-pkg", type: "commonjs" }));
	fs.writeFileSync(path.join(pkg, "marker", "package.json"), JSON.stringify({ type: "module" }));
	fs.writeFileSync(path.join(pkg, "lib", "h.js"), "module.exports = 1;\n");
	return { pkg: pkg.replaceAll("\\", "/"), cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
};

/**
 * Run `fn` with `owner[key]` replaced by `value`, then put the original back.
 * @param {object} owner - The object.
 * @param {string} key - The property.
 * @param {*} value - The stand-in.
 * @param {() => *} fn - What to run.
 * @returns {*} What `fn` returned.
 */
const replaced = (owner, key, value, fn) => {
	const original = owner[key];
	owner[key] = value;
	try {
		return fn();
	} finally {
		owner[key] = original;
	}
};

describe("instance imports > package detection uses what was captured at load (#715)", () => {
	it("is not changed by a replaced JSON.parse", () => {
		const { pkg, cleanup } = makeTree();
		try {
			const answer = replaced(
				JSON,
				"parse",
				() => ({ name: "forged" }),
				() => isInstanceScopedFile(`${pkg}/marker/m.mjs`, `${pkg}/api/leaf.mjs`)
			);
			expect(answer).toBe(true);
		} finally {
			cleanup();
		}
	});

	it("is not changed by a replaced fs.readFileSync", () => {
		const { pkg, cleanup } = makeTree();
		try {
			const forged = () => JSON.stringify({ name: "forged" });
			const answer = replaced(fs, "readFileSync", forged, () => isInstanceScopedFile(`${pkg}/lib/h.mjs`, `${pkg}/api/leaf.mjs`));
			expect(answer).toBe(true);
		} finally {
			cleanup();
		}
	});

	it("is not changed by a replaced process.getBuiltinModule", () => {
		const { pkg, cleanup } = makeTree();
		try {
			const fake = { readFileSync: () => JSON.stringify({ name: "forged" }), existsSync: () => true };
			const answer = replaced(
				process,
				"getBuiltinModule",
				() => fake,
				() => isInstanceScopedFile(`${pkg}/lib/h.mjs`, `${pkg}/api/leaf.mjs`)
			);
			expect(answer).toBe(true);
		} finally {
			cleanup();
		}
	});

	it("reads a file's module system with what was captured too", () => {
		const { pkg, cleanup } = makeTree();
		try {
			const answer = replaced(
				JSON,
				"parse",
				() => ({ type: "module" }),
				() => isCommonJSFile(`${pkg}/lib/h.js`)
			);
			expect(answer).toBe(true);
		} finally {
			cleanup();
		}
	});
});
