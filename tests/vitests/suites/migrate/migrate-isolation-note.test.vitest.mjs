/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/migrate/migrate-isolation-note.test.vitest.mjs
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
 * @fileoverview slothlet-migrate: the scope.isolation default note is reported only where the default applies.
 * @module tests/vitests/suites/migrate/migrate-isolation-note.test.vitest
 */

import { describe, it, expect } from "vitest";
import { migrateSource } from "../../../../packaging/slothlet-migrate/src/index.mjs";

const IMPORT = 'import slothlet from "@cldmv/slothlet";\n';

/**
 * Entries of the info findings for a snippet.
 * @param {string} body - Code after the import line.
 * @returns {string[]} Info entries.
 */
function info(body) {
	const res = migrateSource(IMPORT + body, { filename: "config.mjs" });
	expect(res.error).toBeNull();
	return res.findings.filter((f) => f.level === "info").map((f) => f.entry);
}

describe("slothlet-migrate: scope.isolation default note", () => {
	it("is reported when scope is absent", () => {
		expect(info(`await slothlet({ base: "a" });`)).toContain("config|scope.isolation");
	});

	it("is reported when scope has no isolation", () => {
		expect(info(`await slothlet({ base: "a", scope: { merge: "shallow" } });`)).toContain("config|scope.isolation");
	});

	it("is not reported when the config sets isolation", () => {
		expect(info(`await slothlet({ base: "a", scope: { isolation: "partial" } });`)).not.toContain("config|scope.isolation");
	});
});
