/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vite-package-record.test.vitest.mjs
 *	@Date: 2026-11-15T15:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T15:00:00-08:00 (1794787200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A package an ES module api file imports is that module's code inside a vitest worker, as under Node's
 * own loader.
 *
 * @description
 * Fixture `api_test_vite_package_record`: the module `shipper` imports the packages `shipped-cjs` and `shipped-esm`;
 * each package's `read(api)` reads the vault through the api it is given. `shipper.own(kind)` runs it inside the
 * shipper's own call, and the runner runs the reader the shipper hands it inside the runner's call.
 *
 * vitest externalizes `node_modules`, so its module runner imports such a package itself: under Node's resolve hook the
 * import names the runner, not the api file. The `slothletInstanceImports()` vite plugin records the api file as the
 * package's loader, as it does for any other file a module loads.
 *
 * The rule the expected values come from (docs/PERMISSIONS.md, "Code of a file no module's folder holds"): a package a
 * module loads is that module's code, so it is refused when that module is, and a package another module ships, run
 * inside the caller's call, runs as that module under the caller. The same table is checked under Node's own loader in
 * a child process (`__probe.mjs`).
 *
 * @module tests/vitests/suites/permissions/permissions-vite-package-record
 */
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";
import { packageTable, CONFIGS, DENIED, READS, KINDS } from "../../../../api_tests/api_test_vite_package_record/table.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_vite_package_record");

/**
 * What a read is expected to give: refused when the shipper is denied (its package's code), and when the runner is
 * denied inside the runner's call (the call the code runs under).
 * @param {string|null} denied - The module denied the vault.
 * @param {string} read - `"own"` or `"handed"`.
 * @returns {string} The expected outcome.
 */
const expected = (denied, read) => (denied === "shipper" || (denied === "runner" && read === "handed") ? "PERMISSION_DENIED" : "SECRET");

/**
 * The export conditions this worker runs under, so the probe loads the same build of slothlet.
 * @returns {string[]} The conditions, as `--conditions=x` arguments.
 */
function probeConditions() {
	const conditions = [];
	process.execArgv.forEach((arg, index, all) => {
		if (arg.startsWith("--conditions=")) conditions.push(arg);
		else if ((arg === "--conditions" || arg === "-C") && all[index + 1]) conditions.push(`--conditions=${all[index + 1]}`);
	});
	return conditions;
}

const ROWS = CONFIGS.flatMap(({ attribution, mode, runtime }) =>
	DENIED.flatMap((denied) =>
		READS.flatMap((read) =>
			KINDS.map((kind) => ({
				name: `${attribution} ${mode}/${runtime}`,
				key: `${attribution} ${mode}/${runtime}/${denied}/${read}/${kind}`,
				denied,
				read,
				kind
			}))
		)
	)
);

describe("Permissions > a package an ES module api file imports, inside a vitest worker", () => {
	let table;

	beforeAll(async () => {
		table = await packageTable(slothlet);
	}, 120000);

	it.each(ROWS)("$name, $denied denied: the $kind package's code read $read", ({ key, denied, read }) => {
		expect(table[key]).toBe(expected(denied, read));
	});
});

describe("Permissions > a package an ES module api file imports, under Node's own loader", () => {
	const result = spawnSync(process.execPath, [...probeConditions(), path.join(FIXTURE, "__probe.mjs")], {
		encoding: "utf8",
		timeout: 300000
	});
	const out = result.status === 0 ? JSON.parse(result.stdout) : {};

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});

	it.each(ROWS)("$name, $denied denied: the $kind package's code read $read", ({ key, denied, read }) => {
		expect(out[key]).toBe(expected(denied, read));
	});
});
