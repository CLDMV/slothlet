/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typegen/typegen-programmatic.test.vitest.mjs
 *	@Date: 2026-05-12 19:51:36 -07:00 (1778640696)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 19:58:07 -07:00 (1778641087)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the programmatic `generateTypes()` API.
 *
 * Loads the existing TS regression fixture (`api_test_typescript_runtime`)
 * and asserts the generated `.d.ts` file:
 *   - exists at the requested path
 *   - declares an interface with the requested name
 *   - declares `self` typed as that interface
 *   - includes entries for the loaded modules (foo / bar / baz)
 */
import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { generateTypes } from "@cldmv/slothlet/typegen";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const tempRoots = [];

afterAll(async () => {
	await Promise.allSettled(tempRoots.map((r) => rm(r, { recursive: true, force: true })));
});

async function freshTempDir() {
	const root = await mkdtemp(path.join(tmpdir(), "slothlet-typegen-"));
	tempRoots.push(root);
	return root;
}

describe("typegen programmatic API", () => {
	it("writes a .d.ts file describing the loaded API surface", async () => {
		const tmp = await freshTempDir();
		const output = path.join(tmp, "api.d.ts");

		const result = await generateTypes({
			dir: "./api_tests/api_test_typescript_runtime",
			output,
			interfaceName: "RuntimeApi"
		});

		expect(result.filePath).toBe(path.resolve(output));
		expect(existsSync(output)).toBe(true);

		const content = await readFile(output, "utf8");
		expect(content).toContain("interface RuntimeApi");
		expect(content).toContain("declare const self");
		expect(content).toContain("RuntimeApi");
		// All three fixture modules should appear somewhere in the declaration.
		expect(content).toMatch(/\bfoo\b/);
		expect(content).toMatch(/\bbar\b/);
		expect(content).toMatch(/\bbaz\b/);
	});

	it("rejects when dir is missing", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes({ output: "/tmp/x.d.ts", interfaceName: "X" })).rejects.toThrow(/INVALID_CONFIG/);
		});
	});

	it("rejects when output is missing", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes({ dir: "./api_tests/api_test_typescript_runtime", interfaceName: "X" })).rejects.toThrow(
				/INVALID_CONFIG/
			);
		});
	});

	it("rejects when interfaceName is missing", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes({ dir: "./api_tests/api_test_typescript_runtime", output: "/tmp/x.d.ts" })).rejects.toThrow(
				/INVALID_CONFIG/
			);
		});
	});

	it("rejects when interfaceName is an empty string", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				generateTypes({ dir: "./api_tests/api_test_typescript_runtime", output: "/tmp/x.d.ts", interfaceName: "" })
			).rejects.toThrow(/INVALID_CONFIG/);
		});
	});
});
