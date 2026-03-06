/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/processors/loader-fork-message-error.test.vitest.mjs
 *	@Date: 2026-03-05 00:00:00 -08:00 (1741158000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-05 00:00:00 -08:00 (1741158000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Covers loader.mjs L109 — the child.on("message") error branch inside
 * the strict-mode TypeScript fork.
 *
 * When the forked generate-types-worker sends `{ type: "error", error: "..." }` via
 * `process.send()`, the parent's `child.on("message")` handler rejects with
 * `TS_TYPE_GENERATION_FAILED` (L109).
 *
 * This is separate from loader-fork-error.test.vitest.mjs (which covers the process
 * "error" event at L115) because vi.mock() is file-scoped — a single fork mock
 * cannot emit both an error event and a message event selectively per test.
 *
 * @module tests/vitests/suites/processors/loader-fork-message-error.test.vitest
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

// ─── Mock child_process so fork() returns a fake child that sends a message
// with { type: "error" } to trigger the TS_TYPE_GENERATION_FAILED rejection. ──

vi.mock("child_process", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		/**
		 * Stub fork that returns a fake ChildProcess EventEmitter which sends a
		 * worker-error message to simulate a type-generation failure inside the worker.
		 * @returns {EventEmitter} Fake child process
		 */
		fork: vi.fn().mockImplementation(() => {
			const child = new EventEmitter();
			child.stderr = new EventEmitter();
			child.stdin = null;
			child.stdout = null;
			// Emit message on next tick so the caller can attach listeners first
			setImmediate(() => {
				child.emit("message", { type: "error", error: "type generation failed — mocked for coverage" });
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
	return resolve("tmp", `slothlet-fork-msg-error-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("loader.mjs L109 — child.on(message) type=error path", () => {
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

	it("rejects with TS_TYPE_GENERATION_FAILED when fork sends message type=error (L109)", async () => {
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
							interfaceName: "ForkMessageErrorAPI"
						}
					}
				})
			).rejects.toThrow("TS_TYPE_GENERATION_FAILED");
		});
	});
});
