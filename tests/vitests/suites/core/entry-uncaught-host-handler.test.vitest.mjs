/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/entry-uncaught-host-handler.test.vitest.mjs
 *	@Date: 2026-11-22T18:00:00-08:00 (1795399200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T18:00:00-08:00 (1795399200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Loading the package entry leaves an uncaught exception to the host's own handler, and to Node's
 * default handling when the host has none, as without slothlet.
 *
 * @description
 * The entry prints an uncaught SlothletError in a readable form. Any other error, and a SlothletError the host handles
 * itself, must reach the host's `uncaughtException` handler, or end the process as Node does (exit code 1, the stack
 * on stderr), never with the exit code 7 of a handler that throws.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../../../..");
const ENTRY = pathToFileURL(resolve(ROOT, "index.mjs")).href;
const ERRORS = pathToFileURL(resolve(ROOT, "src/lib/errors.mjs")).href;

/**
 * Run a script in a child process, with or without the package entry loaded first.
 * @param {string} body - The script.
 * @param {boolean} withEntry - Whether the package entry is imported first.
 * @returns {{ status: number|null, stdout: string, stderr: string }} The outcome.
 */
function run(body, withEntry) {
	const head = `import { SlothletError } from ${JSON.stringify(ERRORS)};\n${withEntry ? `await import(${JSON.stringify(ENTRY)});\n` : ""}`;
	const res = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", head + body], {
		cwd: ROOT,
		encoding: "utf8"
	});
	return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

const HOST_HANDLER = `process.on("uncaughtException", (err) => process.stdout.write("HOST " + (err.code ?? err.message) + "\\n"));\n`;

describe("package entry: uncaught exceptions the host handles", () => {
	it("hands a plain error to the host's own handler", () => {
		const body = `${HOST_HANDLER}setTimeout(() => { throw new Error("plain boom"); }, 1);\nsetTimeout(() => process.stdout.write("STILL UP\\n"), 20);`;
		const plain = run(body, false);
		const loaded = run(body, true);
		expect(plain.status).toBe(0);
		expect(loaded.status).toBe(plain.status);
		expect(loaded.stdout).toBe(plain.stdout);
		expect(loaded.stdout).toContain("HOST plain boom");
		expect(loaded.stdout).toContain("STILL UP");
	});

	it("hands a SlothletError to the host's own handler", () => {
		const body = `${HOST_HANDLER}setTimeout(() => { throw new SlothletError("FOLDER_INVALID", { folder: "/nope" }); }, 1);`;
		const loaded = run(body, true);
		expect(loaded.status).toBe(0);
		expect(loaded.stdout).toContain("HOST FOLDER_INVALID");
	});

	it("ends the process as Node does for a plain error when the host has no handler", () => {
		const body = `setTimeout(() => { throw new Error("plain boom"); }, 1);`;
		const plain = run(body, false);
		const loaded = run(body, true);
		expect(plain.status).toBe(1);
		expect(loaded.status).toBe(1);
		expect(loaded.stderr).toContain("Error: plain boom");
	});

	it("still prints an unhandled SlothletError and exits 1 when the host has no handler", () => {
		const loaded = run(`setTimeout(() => { throw new SlothletError("FOLDER_INVALID", { folder: "/nope" }); }, 1);`, true);
		expect(loaded.status).toBe(1);
		expect(loaded.stderr).toContain("ERROR [FOLDER_INVALID]");
		expect(loaded.stderr).toContain("folder: /nope");
	});
});
