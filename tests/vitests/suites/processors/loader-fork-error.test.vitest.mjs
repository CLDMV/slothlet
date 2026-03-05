/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/processors/loader-fork-error.test.vitest.mjs
 *	@Date: 2026-03-04 23:00:00 -08:00 (1772802000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 23:00:00 -08:00 (1772802000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Covers loader.mjs L115 — the child.on("error") handler inside the
 * strict-mode TypeScript fork.
 *
 * `child.on("error")` fires when the OS cannot spawn the child process (ENOENT,
 * EACCES, etc.).  The scriptPath is hardcoded relative to loader.mjs itself so a
 * real spawn failure requires a corrupt install.  Instead we mock child_process.fork
 * to return a fake EventEmitter that immediately emits "error", which is exactly the
 * same signal the parent's child.on("error") handler would receive for a real spawn
 * failure.  This causes loader to reject with TS_TYPE_GENERATION_FORK_FAILED (L115).
 *
 * This file intentionally lives alone because vi.mock() is file-scoped — sharing it
 * with loader.test.vitest.mjs would break tests there that need a real fork.
 *
 * @module tests/vitests/suites/processors/loader-fork-error.test.vitest
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

// ─── Mock child_process so fork() returns a fake child that immediately errors ──
// vi.mock is hoisted above all imports by vitest; it intercepts both static and
// dynamic `import("child_process")` calls — including the lazy one inside loader.mjs.

vi.mock("child_process", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		/**
		 * Stub fork that returns a fake ChildProcess EventEmitter which immediately
		 * emits "error" to simulate a spawn failure (ENOENT / EACCES).
		 * @returns {EventEmitter} Fake child process
		 */
		fork: vi.fn().mockImplementation(() => {
			const child = new EventEmitter();
			child.stderr = new EventEmitter();
			child.stdin = null;
			child.stdout = null;
			// Emit error on next tick so the caller can attach listeners first
			setImmediate(() => {
				child.emit("error", new Error("spawn ENOENT — mocked for coverage"));
			});
			return child;
		})
	};
});

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Creates a unique temporary fixture directory.
 * @returns {string} Absolute path
 */
function createFixtureRoot() {
	return resolve("tmp", `slothlet-fork-error-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("loader.mjs L115 — child.on(error) fork-spawn failure path", () => {
	let fixtureRoot;

	beforeEach(async () => {
		fixtureRoot = createFixtureRoot();
		await mkdir(fixtureRoot, { recursive: true });
		// Create a minimal TypeScript file so the loader actually enters the fork path
		await writeFile(join(fixtureRoot, "widget.ts"), "export const widget = 1;");
	});

	afterEach(async () => {
		if (fixtureRoot) {
			await rm(fixtureRoot, { recursive: true, force: true });
		}
	});

	it("rejects with TS_TYPE_GENERATION_FORK_FAILED when fork emits error (L115)", async () => {
		// Dynamic import slothlet inside the test so it uses the mocked child_process
		const { default: slothlet } = await import("@cldmv/slothlet");

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({
					dir: fixtureRoot,
					mode: "eager",
					typescript: {
						mode: "strict",
						types: {
							output: join(fixtureRoot, "generated", "api.d.ts"),
							interfaceName: "ForkErrorAPI"
						}
					}
				})
			).rejects.toThrow("TS_TYPE_GENERATION_FORK_FAILED");
		});
	});
});
