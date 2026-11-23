/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/entry-uncaught-error-printer.test.vitest.mjs
 *	@Date: 2026-11-16T16:18:22-08:00 (1794874702)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-19T16:10:35-08:00 (1795133435)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**

/**
 * @fileoverview The package entry's uncaught SlothletError printer reads v4's `cause` and `details`.
 * @module tests/vitests/suites/core/entry-uncaught-error-printer.test.vitest
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { translate } from "@cldmv/slothlet/i18n";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../../../..");
const ENTRY = pathToFileURL(resolve(ROOT, "index.mjs")).href;
const ERRORS = pathToFileURL(resolve(ROOT, "src/lib/errors.mjs")).href;

/**
 * Throw an uncaught SlothletError in a child process that loaded the package entry.
 * @param {string} body - Code that builds `err` (SlothletError is in scope).
 * @returns {{ status: number|null, stderr: string }} Exit status and stderr.
 */
function uncaught(body) {
	const script = `import ${JSON.stringify(ENTRY)};\nimport { SlothletError } from ${JSON.stringify(ERRORS)};\n${body}\nsetTimeout(() => { throw err; }, 1);`;
	const res = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: ROOT,
		encoding: "utf8"
	});
	return { status: res.status, stderr: res.stderr };
}

describe("package entry: uncaught SlothletError printer", () => {
	it("prints the error details", () => {
		const r = uncaught(`const err = new SlothletError("FOLDER_INVALID", { folder: "/nope/missing" });`);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("Details:");
		expect(r.stderr).toContain("folder: /nope/missing");
	});

	it("prefers the cause's stack and names the file of an import failure", () => {
		const r = uncaught(
			`const cause = new Error("Cannot find module './gone.mjs'"); cause.stack = "Error: x\\n    at gone (/cause/only/file.mjs:3:4)";\n` +
				`const err = new SlothletError("MODULE_IMPORT_FAILED", { file: "/api/broken.mjs" }, { cause });`
		);
		expect(r.stderr).toContain("📍 Location: /api/broken.mjs (import statement)");
		expect(r.stderr).toContain("/cause/only/file.mjs:3:4");
	});

	it("FOLDER_INVALID names neither 'dir' nor a string-only requirement", () => {
		const msg = translate("FOLDER_INVALID", { folder: "./x" });
		expect(msg).not.toContain("'dir'");
		expect(msg).toContain("./x");
	});
});
