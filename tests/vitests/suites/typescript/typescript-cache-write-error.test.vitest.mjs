/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-cache-write-error.test.vitest.mjs
 *	@Date: 2026-05-30 00:06:52 -07:00 (1780124812)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fault-injection test for writeTransformedToCache's non-EEXIST rethrow.
 *
 * @description
 * `writeTransformedToCache` writes each cache file with the `wx` (O_CREAT|O_EXCL) flag, which
 * throws `EEXIST` when a byte-identical cache file already exists — a benign no-op that the
 * cache-key-collision suite already covers. A NON-`EEXIST` write failure (e.g. `EACCES`, `ENOSPC`)
 * must instead propagate, not be silently swallowed (typescript.mjs:680). That error path can only
 * be reached by injecting an I/O fault, so this suite mocks `node:fs/promises` `writeFile` to throw
 * `EACCES` and asserts the rejection surfaces. `vi.mock` is file-global, so this lives in its own
 * file (the other cache tests need the real `writeFile`).
 *
 * @module tests/vitests/suites/typescript/typescript-cache-write-error
 */

import { vi, describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Override ONLY writeFile (keep mkdir/readdir/rm real so the cache dir still gets created and the
// stale-cache sweep still works) — the override throws a non-EEXIST error on every cache write.
vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		writeFile: async () => {
			const err = new Error("EACCES: permission denied, open cache file");
			err.code = "EACCES";
			throw err;
		}
	};
});

const { writeTransformedToCache } = await import("@cldmv/slothlet/processors/typescript");

describe("writeTransformedToCache — non-EEXIST cache-write error", () => {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-cachewrite-"));
	// Anchor findPackageRoot inside the temp dir so the cache root stays local.
	fs.writeFileSync(path.join(tempRoot, "package.json"), '{"name":"slothlet-cachewrite-test"}');

	afterAll(() => {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	});

	it("rethrows a non-EEXIST writeFile failure instead of swallowing it", async () => {
		const code = "export const x = 1;\n";
		const src = path.join(tempRoot, "a.ts");
		fs.writeFileSync(src, code, "utf8");

		// The wx write throws EACCES (mocked); EACCES !== EEXIST, so the catch must rethrow it.
		await expect(writeTransformedToCache(src, code, "iid-cachewrite-eacces")).rejects.toThrow(/EACCES/);
	});
});
