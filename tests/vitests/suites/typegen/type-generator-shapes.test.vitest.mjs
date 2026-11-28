/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/typegen/type-generator-shapes.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:06-08:00 (1795869186)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `generateTypes` on api shapes the mixed fixture does not hold: a function api root, a plain object
 * that slothlet never composed, and callable and object exports whose members are the export's own properties.
 *
 * @description
 * The declaration names each member by the export slothlet placed there (`typeof import("<leaf>")["k"]`); a value
 * with no record is `unknown` with the reason, a key that is no identifier is quoted, and a function root makes the
 * interface callable with the root function's own parameters and result.
 */
import { describe, it, expect, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { generateTypes } from "#processors/type-generator";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const ROOT_FUNCTION = path.resolve("api_tests/api_test_root_function_members");
const roots = [];

afterAll(async () => {
	await Promise.allSettled(roots.map((root) => rm(root, { recursive: true, force: true })));
});

/**
 * A scratch directory.
 * @returns {Promise<string>} Its path.
 */
async function scratch() {
	const root = await makeTestTmpDir("type-generator-shapes");
	roots.push(root);
	return root;
}

describe("generateTypes > shapes", () => {
	it("makes the interface callable with the root function's parameters when the api root is a function", async () => {
		const tmp = await scratch();
		const api = await slothlet({ base: ROOT_FUNCTION, mode: "eager", silent: true });
		try {
			const { output } = await generateTypes(api, { output: path.join(tmp, "root.d.mts"), interfaceName: "RootApi" });
			expect(output).toContain("(...args: Parameters<Extract<typeof import(");
			expect(output).toContain('["default"], (...args: any[]) => any>>): ReturnType<Extract<typeof import(');
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("types a plain object api member by member, quoting a key that is no identifier, with no module origin", async () => {
		const tmp = await scratch();
		const { output } = await generateTypes(
			{ plain: 1, "not-an-identifier": { inner: true } },
			{ output: path.join(tmp, "plain.d.mts"), interfaceName: "PlainObjectApi" }
		);
		expect(output).toContain("No module origin: slothlet holds no ownership record for this member.");
		expect(output).toContain("plain: unknown;");
		expect(output).toContain('"not-an-identifier"');
		expect(output).not.toContain("Parameters<");
	});

	it("gives a plain function api no call signature, since it has no root file", async () => {
		const tmp = await scratch();
		const fn = Object.assign(() => 1, { member: 2 });
		const { output } = await generateTypes(fn, { output: path.join(tmp, "fn.d.mts"), interfaceName: "FnApi" });
		expect(output).toContain("member: unknown;");
		expect(output).not.toContain("Parameters<");
	});

	it("describes members merged onto an export from elsewhere beside the export's own type", async () => {
		const tmp = await scratch();
		const base = path.join(tmp, "api");
		await mkdir(path.join(base, "lib"), { recursive: true });
		await writeFile(path.join(base, "lib", "tool.mjs"), "export default { run() { return 1; }, label: 'x' };\nexport const extra = 2;\n");
		await writeFile(
			path.join(base, "lib", "calc.mjs"),
			"export default function calc() { return 1; }\ncalc.helper = () => 2;\nexport const more = 3;\n"
		);
		const api = await slothlet({ base, mode: "eager", silent: true });
		try {
			const { output } = await generateTypes(api, { output: path.join(tmp, "own.d.mts"), interfaceName: "OwnApi" });
			expect(output).toMatch(/Omit<typeof import\([^)]*tool\.mjs"\)\["default"\], "extra"> & /);
			expect(output).toMatch(/typeof import\([^)]*calc\.mjs"\)\["default"\] & /);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
