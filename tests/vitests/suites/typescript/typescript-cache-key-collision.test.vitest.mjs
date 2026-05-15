/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-cache-key-collision.test.vitest.mjs
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
 * @fileoverview Regression test for `writeTransformedToCache` cache-key collision.
 *
 * Two source files whose transformed output is byte-identical (empty modules,
 * side-effect-only re-exports, etc.) must NOT share a cache file. If they did,
 * Node's ESM cache would return one module instance for both source paths,
 * silently aliasing them and leaking exports across API mounts.
 *
 * The hash now incorporates `originalPath` (with a NUL separator), so distinct
 * source paths get distinct cache files even when the transformed bytes match.
 */
import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { writeTransformedToCache } from "@cldmv/slothlet/processors/typescript";

describe("writeTransformedToCache cache-key collision regression", () => {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-cachekey-"));
	// Place a package.json so `findPackageRoot` anchors the cache root inside
	// the temp dir (otherwise it walks up to a real package elsewhere).
	fs.writeFileSync(path.join(tempRoot, "package.json"), '{"name":"slothlet-cachekey-test"}');

	afterAll(() => {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	});

	it("produces distinct cache files for two source paths even when code is identical", async () => {
		const code = "export const x = 1;\n";
		const pathA = path.join(tempRoot, "a.ts");
		const pathB = path.join(tempRoot, "b.ts");
		fs.writeFileSync(pathA, code, "utf8");
		fs.writeFileSync(pathB, code, "utf8");

		const a = await writeTransformedToCache(pathA, code, "iid-collision-test");
		const b = await writeTransformedToCache(pathB, code, "iid-collision-test");

		// Distinct cache file paths (URLs).
		expect(a.url).not.toBe(b.url);

		// Same cache directory (same instanceID + PID).
		expect(a.cacheDir).toBe(b.cacheDir);

		// Both files exist on disk. Use fileURLToPath for portable URL→path
		// conversion (new URL().pathname mangles Windows drive paths).
		const aPath = fileURLToPath(a.url);
		const bPath = fileURLToPath(b.url);
		expect(fs.existsSync(aPath)).toBe(true);
		expect(fs.existsSync(bPath)).toBe(true);

		// Calling the same source path twice with the same content reuses the same
		// cache file (the dedup is now per-source-path, not just per-content-hash).
		const a2 = await writeTransformedToCache(pathA, code, "iid-collision-test");
		expect(a2.url).toBe(a.url);
	});

	it("yields absolute cache paths even when originalPath is relative", async () => {
		// `findPackageRoot` resolves startPath to absolute, so a relative
		// originalPath must still produce an absolute cacheDir and a valid
		// file:// URL — downstream code must not depend on process cwd.
		const code = "export const rel = 1;\n";
		const relPath = path.relative(process.cwd(), path.join("api_tests", "api_test_typescript_runtime", "foo.ts"));
		expect(path.isAbsolute(relPath)).toBe(false);

		const result = await writeTransformedToCache(relPath, code, "iid-relpath-test");

		expect(path.isAbsolute(result.cacheDir)).toBe(true);
		expect(result.url.startsWith("file://")).toBe(true);
		const resolvedFile = fileURLToPath(result.url);
		expect(path.isAbsolute(resolvedFile)).toBe(true);
		expect(fs.existsSync(resolvedFile)).toBe(true);

		// Clean up the cache dir created under the repo root.
		fs.rmSync(result.cacheDir, { recursive: true, force: true });
	});
});
