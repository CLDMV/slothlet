/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/fixture-packages-resolve.test.vitest.mjs
 *	@Date: 2026-11-28T00:00:00-08:00 (1795852800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:37-08:00 (1795869097)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every fixture package that imports slothlet resolves it, as an installed module package does.
 *
 * @description
 * A fixture module with its own `package.json` resolves `@cldmv/slothlet` from its own `node_modules`, which the test
 * setup links to this checkout (tests/vitests/setup/fixture-packages.mjs). A package that imports slothlet without
 * declaring it gets no link, and is named here instead of failing as `MODULE_IMPORT_FAILED` inside the tests that
 * mount it.
 *
 * @module tests/vitests/suites/core/fixture-packages-resolve.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fixturePackageProblems, fixturePackages, linkFixturePackages, FIXTURES_ROOT, REPO_ROOT } from "../../setup/fixture-packages.mjs";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

describe("fixture packages resolve slothlet", () => {
	it("leaves no fixture package under api_tests/ unable to resolve it", () => {
		expect(fixturePackageProblems()).toEqual([]);
	});

	it("resolves the runtime from a fixture module's own lib/ helper to this checkout's file", async () => {
		const dir = fixturePackages().find((entry) => entry.endsWith(path.join("vault-manager", "vault-manager")));
		expect(dir).toBeDefined();
		const resolved = fs.realpathSync(path.join(dir, "node_modules", "@cldmv", "slothlet"));
		expect(resolved).toBe(fs.realpathSync(REPO_ROOT));
		expect(FIXTURES_ROOT.startsWith(REPO_ROOT)).toBe(true);
	});

	describe("a package that imports slothlet", () => {
		let root;

		beforeAll(() => {
			root = makeTestTmpDirSync("fixture-packages");
			const write = (file, text) => {
				fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
				fs.writeFileSync(path.join(root, file), text);
			};
			write("undeclared/package.json", JSON.stringify({ name: "@local/undeclared" }));
			write("undeclared/lib/helper.mjs", 'import { self } from "@cldmv/slothlet/runtime";\nexport const x = self;\n');
			write("declared/package.json", JSON.stringify({ name: "@local/declared", peerDependencies: { "@cldmv/slothlet": "*" } }));
			write("declared/lib/helper.mjs", 'import { self } from "@cldmv/slothlet/runtime";\nexport const x = self;\n');
			write("unrelated/package.json", JSON.stringify({ name: "@local/unrelated" }));
			write("unrelated/api/leaf.mjs", "export const y = 1;\n");
		});

		afterAll(() => {
			if (root) fs.rmSync(root, { recursive: true, force: true });
		});

		it("is named when it does not declare slothlet, and resolves once it does", () => {
			const before = fixturePackageProblems(root);
			expect(before.map((entry) => [path.basename(entry.package), entry.files])).toEqual([
				["declared", [path.join("lib", "helper.mjs")]],
				["undeclared", [path.join("lib", "helper.mjs")]]
			]);
			expect(before.find((entry) => entry.package.endsWith("undeclared")).problem).toMatch(/peerDependencies/);
			expect(before.find((entry) => entry.package.endsWith("declared") && !entry.package.endsWith("undeclared")).problem).toMatch(
				/does not resolve/
			);

			expect(linkFixturePackages(root).map((dir) => path.basename(dir))).toEqual(["declared"]);
			expect(fixturePackageProblems(root).map((entry) => path.basename(entry.package))).toEqual(["undeclared"]);
		});
	});
});
