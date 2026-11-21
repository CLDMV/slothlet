/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-require-record-package.test.vitest.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:06-08:00 (1794882606)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every CommonJS api file that requires a package is recorded as loading it, whichever required it first.
 *
 * @description
 * Fixture `api_test_package_require`. The CommonJS api files `first.cjs` and `second.cjs`, of one folder, each require
 * the packages `count-main` (reached through its `main`) and `count-exports` (reached through its `exports`) while they
 * load, and `count-later` inside a function, after they loaded. The ES module api file `third.mjs` imports the first
 * two. Each package's `read(api)` reads the vault through the api it is given: the access is the package's own code,
 * running inside the call of the file that called it.
 *
 * Node keeps a package's file once for the process and answers the second file's `require` of it from its own caches.
 * The rule the expected values come from (docs/PERMISSIONS.md, "Code of a file no module's folder holds"): a package
 * a module loads is that module's code, and every module's that loads it the same way, whichever loaded it first; a
 * module calling code it shares with another is still itself. So only the file whose module is denied is refused. The
 * expected values are what the same files give when Node's caches cannot answer for the second file (each CommonJS file
 * in a folder of its own), where every require reaches the resolve hook.
 *
 * The CommonJS files are checked in this worker, where Node's own loader requires them. The whole table, the ES module
 * file's rows with it, is checked under Node's own loader in a child process (`__probe-records.mjs`): vite's runner
 * loads an ES module api file here and imports a package from `node_modules` itself, so no import of it by the file is
 * recorded in this worker.
 *
 * @module tests/vitests/suites/permissions/permissions-require-record-package
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_package_require/api");
const PACKAGES = path.resolve(DIR, "../node_modules");
const PROBE = path.resolve(DIR, "../__probe-records.mjs");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/** The api files, and the packages each one reaches. */
const FILES = [
	{ file: "first", packages: ["main", "exports", "later"] },
	{ file: "second", packages: ["main", "exports", "later"] },
	{ file: "third", packages: ["main", "exports"] }
];

/** The rule sets: nothing denied, then each api file's module denied the vault in turn. */
const RULE_SETS = [
	{ rules: "nothing denied", list: [], denied: null },
	...FILES.map(({ file }) => ({
		rules: `the module path ${file} denied`,
		list: [{ caller: `${file}.**`, target: "vault.**", effect: "deny" }],
		denied: file
	}))
];

/** Each api file's reads, as rows. */
const READS = FILES.flatMap(({ file, packages }) => packages.map((name) => ({ file, name })));

/** The CommonJS api files' reads. */
const COMMONJS_READS = READS.filter(({ file }) => file !== "third");

/**
 * Run a function, giving back what it returns or the code of the error it threw.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} The outcome.
 */
async function settle(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

describe.each(MATRIX)("Permissions > every CommonJS api file requiring a package > $name", ({ attribution, mode, runtime }) => {
	describe.each(RULE_SETS)("$rules", ({ list, denied }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({
				base: DIR,
				mode,
				runtime,
				silent: true,
				permissions: { policy: "allow", caller: { attribution }, rules: list }
			});
			// Every file loads and requires its packages, `count-later` included, in this order.
			for (const { file, packages } of FILES) for (const name of packages) await api[file].bump(name);
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(COMMONJS_READS)("the package $name's own code read inside the call of $file", async ({ file, name }) => {
			expect(await settle(() => api[file].read(name))).toBe(file === denied ? DENIED : SECRET);
		});
	});

	describe("the second file requires the packages first", () => {
		let api;

		beforeAll(async () => {
			api = await slothlet({
				base: DIR,
				mode,
				runtime,
				silent: true,
				permissions: { policy: "allow", caller: { attribution }, rules: [{ caller: "second.**", target: "vault.**", effect: "deny" }] }
			});
			for (const file of ["second", "first"]) await api[file].bump("later");
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(["first", "second"])("count-later's own code read inside the call of %s", async (file) => {
			expect(await settle(() => api[file].read("later"))).toBe(file === "second" ? DENIED : SECRET);
		});
	});
});

describe.each(MATRIX.filter((config) => config.attribution === "precise"))(
	"Permissions > a package CommonJS api files require stays one module of the process > $mode/$runtime",
	({ mode, runtime }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: DIR, mode, runtime, silent: true });
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(["count-main/index.js", "count-exports/lib/entry.cjs", "count-later/index.js"])(
			"every require of %s, the host's included, gets the one module",
			async (file) => {
				const name = file.startsWith("count-main") ? "main" : file.startsWith("count-exports") ? "exports" : "later";
				const require = createRequire(import.meta.url);
				const helper = require(path.join(PACKAGES, file));
				const start = helper.bump();
				expect(await api.first.bump(name)).toBe(start + 1);
				expect(await api.second.bump(name)).toBe(start + 2);
				if (name !== "later") expect(await api.third.bump(name)).toBe(start + 3);
				expect(helper.bump()).toBe(name === "later" ? start + 3 : start + 4);
				expect(require.cache[path.join(PACKAGES, file)]?.exports).toBe(helper);
			}
		);
	}
);

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

describe("Permissions > every api file requiring or importing a package, under Node's own loader", () => {
	const result = spawnSync(process.execPath, [...probeConditions(), PROBE], { encoding: "utf8", timeout: 300000 });
	const out = result.status === 0 ? JSON.parse(result.stdout) : {};

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});

	describe.each(MATRIX)("$name", ({ attribution, mode, runtime }) => {
		describe.each(RULE_SETS)("$rules", ({ denied }) => {
			it.each(READS)("the package $name's own code read inside the call of $file", ({ file, name }) => {
				expect(out[`${attribution} ${mode}/${runtime}/${denied}/${file}/${name}`]).toBe(file === denied ? DENIED : SECRET);
			});
		});
	});
});
