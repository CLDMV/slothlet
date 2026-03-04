/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:56 -08:00 (1772425316)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for formatDiagnostics — no-file diagnostic message path (line 230).
 *
 * @description
 * `formatDiagnostics(diagnostics, ts)` formats TypeScript compiler diagnostics into
 * human-readable strings.  When a diagnostic has no `.file` property (e.g. project-level
 * or configuration errors), the function falls through to the `return message` path at line 230
 * instead of the rich `filename:line:col - message` format at lines 226-228.
 *
 * All existing TypeScript tests drive the "with file" path because they run actual compilation.
 * This test directly calls the exported `formatDiagnostics` function with a mock TypeScript
 * module and a diagnostic that intentionally lacks a `.file` property.
 *
 * @module tests/vitests/suites/typescript/typescript-branches.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import { formatDiagnostics } from "@cldmv/slothlet/processors/typescript";
import slothlet from "@cldmv/slothlet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Minimal TypeScript module mock — only flattenDiagnosticMessageText is needed.
 * @param {string|object} messageText - The raw messageText from the diagnostic.
 * @returns {object} Mock ts module.
 *
 * @example
 * const ts = makeTsMock();
 * ts.flattenDiagnosticMessageText("Cannot find module", "\n"); // "Cannot find module"
 */
function makeTsMock() {
	return {
		/**
		 * Stub for ts.flattenDiagnosticMessageText — returns the string directly.
		 * @param {string} msg - Message text.
		 * @returns {string} The message unchanged.
		 */
		flattenDiagnosticMessageText(msg) {
			return String(msg);
		}
	};
}

// ─── formatDiagnostics — no-file path (line 230) ─────────────────────────────

describe("formatDiagnostics — diagnostic without .file falls through to plain message (line 230)", () => {
	it("returns the plain message when diagnostic.file is absent (line 230)", () => {
		const ts = makeTsMock();
		// Diagnostic with no .file (project-level error)
		const diagnostics = [{ messageText: "Cannot find tsconfig.json" }];

		const result = formatDiagnostics(diagnostics, ts);

		// Should be an array of one string — the plain message text only
		expect(result).toEqual(["Cannot find tsconfig.json"]);
	});

	it("returns plain messages for multiple no-file diagnostics (line 230)", () => {
		const ts = makeTsMock();
		const diagnostics = [
			{ messageText: "Option 'target' must be provided" },
			{ messageText: "Compiler option 'module' must be specified" }
		];

		const result = formatDiagnostics(diagnostics, ts);

		expect(result).toEqual(["Option 'target' must be provided", "Compiler option 'module' must be specified"]);
	});

	it("returns rich file:line:col message when diagnostic.file is present", () => {
		const ts = makeTsMock();
		// This verifies the OTHER branch (already covered) still works
		const diagnostics = [
			{
				messageText: "Type error",
				start: 0,
				file: {
					fileName: "src/app.ts",
					getLineAndCharacterOfPosition: () => ({ line: 4, character: 9 })
				}
			}
		];

		const result = formatDiagnostics(diagnostics, ts);

		expect(result[0]).toBe("src/app.ts:5:10 - Type error");
	});
});
// ─── loader.mjs L114: fork message handler else-if (msg.type === "error") ────

describe("loader.mjs L114 — fork message handler: else-if (msg.type === 'error') branch", () => {
        /** @type {import("@cldmv/slothlet").SlothletInstance|null} */
        let api = null;

        afterEach(async () => {
                if (api) {
                        await api.slothlet.shutdown();
                        api = null;
                }
        });

        it("fork sends error message when output path is a file (not a dir), triggering else-if at L114", async () => {
                // Create a regular file at the path that will be used as the output DIRECTORY.
                // When the fork's generateTypes calls:
                //   outputDir = path.dirname("/path/to/blockfile/types.d.ts") → "/path/to/blockfile"
                //   fs.existsSync(outputDir) → true (it's a file)
                //   fs.writeFileSync("/path/to/blockfile/types.d.ts", ...) → throws ENOTDIR
                // The fork's inner catch fires → process.send({ type: 'error', error: msg })
                // Back in the parent: message handler else-if (msg.type === 'error') at L114 fires.
                const blockFile = path.resolve("tmp", `slothlet-fork-block-${Date.now()}`);

                if (!fs.existsSync("tmp")) {
                        fs.mkdirSync("tmp", { recursive: true });
                }
                fs.writeFileSync(blockFile, "block");

                try {
                        await withSuppressedSlothletErrorOutput(async () => {
                                await expect(async () => {
                                        api = await slothlet({
                                                dir: path.resolve(__dirname, "../../../../api_tests/api_test_typescript"),
                                                typescript: {
                                                        mode: "strict",
                                                        types: {
                                                                // blockFile is a regular FILE → outputDir exists but is not a dir
                                                                // → fork's writeFileSync throws ENOTDIR
                                                                output: path.join(blockFile, "types.d.ts"),
                                                                interfaceName: "TestAPI"
                                                        }
                                                }
                                        });
                                }).rejects.toThrow();
                        });
                } finally {
                        if (fs.existsSync(blockFile)) {
                                fs.unlinkSync(blockFile);
                        }
                }
        });
});