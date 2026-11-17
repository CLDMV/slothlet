/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/migrate/migrate-errors.test.vitest.mjs
 *	@Date: 2026-11-16T16:20:02-08:00 (1794874802)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:29:19-08:00 (1794875359)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet-migrate: error / warning codes, `.context` → `.details`, and the removed
 * error fields.
 * @module tests/vitests/suites/migrate/migrate-errors.test.vitest
 */

import { describe, it, expect } from "vitest";
import { migrateSource } from "../../../../packaging/slothlet-migrate/src/index.mjs";

/**
 * Migrate a snippet.
 * @param {string} code - Source.
 * @returns {{ code: string, findings: object[], ids: (level?: string) => string[] }} Result.
 */
function run(code) {
	const res = migrateSource(code, { filename: "errors.mjs" });
	expect(res.error).toBeNull();
	return { ...res, ids: (level) => res.findings.filter((f) => !level || f.level === level).map((f) => f.entry) };
}

describe("slothlet-migrate: error codes", () => {
	it("rewrites codes compared with .code", () => {
		const r = run(
			[
				`if (err.code === "INVALID_CONFIG_DIR_MISSING") a();`,
				`if ('WARN_DIRECTORY_EMPTY' !== w?.code) b();`,
				`switch (e.code) { case "INVALID_CONFIG_NOT_LOADED": break; }`,
				`expect(e.code).toBe("MODULE_RESERVED_DIRNAME");`,
				`expect(e.code).not.toEqual("MODULE_RESERVED_FILENAME");`,
				`await expect(p).rejects.toMatchObject({ code: "INVALID_CONFIG_IMPORT" });`,
				`expect(e).toHaveProperty("code", "INVALID_DIRECTORY");`
			].join("\n")
		);
		expect(r.code).toBe(
			[
				`if (err.code === "INVALID_CONFIG_BASE_MISSING") a();`,
				`if ('WARNING_FOLDER_EMPTY' !== w?.code) b();`,
				`switch (e.code) { case "INSTANCE_NOT_LOADED": break; }`,
				`expect(e.code).toBe("MODULE_RESERVED_FOLDER");`,
				`expect(e.code).not.toEqual("MODULE_RESERVED_FILE");`,
				`await expect(p).rejects.toMatchObject({ code: "INVALID_CONFIG_IMPORTER_INVALID" });`,
				`expect(e).toHaveProperty("code", "FOLDER_UNREADABLE");`
			].join("\n")
		);
		expect(r.ids("manual")).toEqual([]);
	});

	it("reports codes it cannot prove, and removed codes", () => {
		const r = run(`const CODES = ["INVALID_CONFIG_DIR_MISSING"];\nif (e.code === "V3_CONFIG_DEPRECATED") x();`);
		expect(r.code).toBe(`const CODES = ["INVALID_CONFIG_DIR_MISSING"];\nif (e.code === "V3_CONFIG_DEPRECATED") x();`);
		expect(r.ids("manual")).toEqual(["code|INVALID_CONFIG_DIR_MISSING", "code|V3_CONFIG_DEPRECATED"]);
	});

	it("leaves codes that kept their name alone", () => {
		expect(run(`if (e.code === "MODULE_LOAD_FAILED") x();`).findings).toEqual([]);
	});
});

describe("slothlet-migrate: error fields", () => {
	it("rewrites .context where the value is provably a slothlet error", () => {
		const r = run(
			[
				`import { SlothletError } from "@cldmv/slothlet/errors";`,
				`try { a(); } catch (err) {`,
				`\tif (err instanceof SlothletError) log(err.context);`,
				`\tif (err.code === "MODULE_LOAD_FAILED" && err.context.file) log(err.context);`,
				`\tconst x = err instanceof SlothletError ? err.context : null;`,
				`\tlog(err.context);`,
				`}`,
				`expect(e).toMatchObject({ code: "MODULE_LOAD_FAILED", context: { file: "x" } });`
			].join("\n")
		);
		expect(r.code).toBe(
			[
				`import { SlothletError } from "@cldmv/slothlet/errors";`,
				`try { a(); } catch (err) {`,
				`\tif (err instanceof SlothletError) log(err.details);`,
				`\tif (err.code === "MODULE_LOAD_FAILED" && err.details.file) log(err.details);`,
				`\tconst x = err instanceof SlothletError ? err.details : null;`,
				`\tlog(err.context);`,
				`}`,
				`expect(e).toMatchObject({ code: "MODULE_LOAD_FAILED", details: { file: "x" } });`
			].join("\n")
		);
		expect(r.ids("manual")).toEqual(["data|error.context"]);
	});

	it("does not touch .context on other objects", () => {
		expect(run(`const c = api.slothlet.context.get();\nconst d = request.context;`).findings).toEqual([]);
	});

	it("reports originalError, suppressConsole and the old constructor", () => {
		const r = run(
			[
				`import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";`,
				`SlothletWarning.suppressConsole = true;`,
				`try {} catch (e) { log(e.originalError); }`,
				`throw new SlothletError("X", { a: 1 }, cause, { validationError: true });`,
				`throw new SlothletError("X", { a: 1 }, { cause });`
			].join("\n")
		);
		expect(r.ids("manual")).toEqual([
			"data|@cldmv/slothlet/errors#SlothletWarning.suppressConsole",
			"data|error.originalError",
			"data|new SlothletError(code, context, originalError, flags)"
		]);
		expect(r.findings[0].message).toContain("silent");
	});

	it("reports the removed SlothletWarning statics", () => {
		const r = run(
			`import { SlothletWarning } from "@cldmv/slothlet/errors";\nconst w = SlothletWarning.captured;\nSlothletWarning.clearCaptured();`
		);
		expect(r.ids("manual")).toEqual([
			"method|@cldmv/slothlet/errors#SlothletWarning.captured",
			"method|@cldmv/slothlet/errors#SlothletWarning.clearCaptured"
		]);
	});
});
