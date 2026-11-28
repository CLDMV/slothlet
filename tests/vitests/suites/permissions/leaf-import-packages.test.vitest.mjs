/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/leaf-import-packages.test.vitest.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:16-08:00 (1795869136)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api that is a package of its own imports lib files, never a leaf file: its own package's, by any
 * specifier, or another api package's.
 *
 * @description
 * Fixture `api_test_leaf_import_packages`: `node_modules/@acme/billing` (ES modules) and `@acme/ledger` (CommonJS) are
 * slothlet apis with `api/` and `lib/`, mounted with `api.slothlet.api.add()` one case folder at a time; `@acme/users`
 * is another api package, mounted at `users` where a case reaches it. A billing or ledger leaf, or a lib file one of
 * them loaded, that imports or requires a leaf file is refused with MODULE_LEAF_IMPORT_REFUSED: a sibling by a relative
 * path, its own package's leaf by the package's name or `#imports`, and a users leaf by a bare specifier. A billing
 * leaf importing its own lib file loads. The host stays exempt: it imports a leaf file itself, and through a plain
 * package (`plain-pkg`, no api) that imports one.
 *
 * @module tests/vitests/suites/permissions/leaf-import-packages
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";
import {
	CASES,
	FIXTURE,
	MODULES,
	REFUSED,
	apiFolder,
	refusalOf,
	runCase
} from "../../../../api_tests/api_test_leaf_import_packages/lib/cases.mjs";

/** One configuration per mode and runtime of the shared matrix. */
const CONFIGS = [];
for (const entry of getMatrixConfigs()) {
	const { mode, runtime } = entry.config;
	if (!CONFIGS.some((c) => c.mode === mode && c.runtime === runtime)) CONFIGS.push({ mode, runtime });
}

/** The permission system's modes: no `permissions` config, on, and disabled. */
const PERMISSIONS = [
	{ name: "permissions off", value: undefined },
	{ name: "permissions on", value: { policy: "allow" } },
	{ name: "permissions disabled", value: { mode: "disabled" } }
];

const MATRIX = [];
for (const config of CONFIGS)
	for (const permissions of PERMISSIONS)
		MATRIX.push({ name: `${config.mode}/${config.runtime} ${permissions.name}`, ...config, permissions: permissions.value });

/**
 * The slothlet options for a configuration.
 * @param {object} config - The configuration.
 * @returns {object} The options.
 */
const options = (config) => ({
	base: path.join(FIXTURE, "api"),
	mode: config.mode,
	runtime: config.runtime,
	silent: true,
	...(config.permissions === undefined ? {} : { permissions: config.permissions })
});

/**
 * The outcome of a step: its value, or the refusal in what it threw, or the code of what else it threw.
 * @param {function(): *} fn - The step.
 * @returns {Promise<{value?: *, refused?: *, code?: string}>} The outcome.
 */
async function outcome(fn) {
	try {
		return { value: await fn() };
	} catch (error) {
		const refused = refusalOf(error);
		return refused ? { refused } : { code: error?.code ?? String(error?.message ?? error) };
	}
}

describe.each(MATRIX)("Permissions > an api package cannot import a leaf file > $name", (config) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	for (const entry of CASES) {
		it(entry.value === undefined ? `refuses ${entry.name}` : `loads ${entry.name}`, async () => {
			api = await slothlet(options(config));
			const result = await outcome(() => runCase(api, entry));
			if (entry.value !== undefined) {
				expect(result).toEqual({ value: entry.value });
				return;
			}
			expect(result.refused, JSON.stringify(result)).toBeTruthy();
			const message = String(result.refused.message).replace(/\\/g, "/");
			expect(message).toContain(entry.importer);
			expect(message).toContain(entry.leaf);
		});
	}

	it("lets the host import an api package's leaf file", async () => {
		api = await slothlet(options(config));
		await api.slothlet.api.add("billing", apiFolder("billing", "libok"));
		const hostCopy = await import(pathToFileURL(path.join(apiFolder("billing", "libok"), "run.mjs")).href);
		expect(hostCopy.go()).toBe("money");
		expect(await api.billing.run.go()).toBe("money");
	});

	it("lets the host load a plain package that imports an api package's leaf file", async () => {
		api = await slothlet(options(config));
		await api.slothlet.api.add("users", apiFolder("users"));
		const plain = await import(pathToFileURL(path.join(MODULES, "plain-pkg", "index.mjs")).href);
		expect(plain.viaPlain()).toBe("users-x");
		expect(await api.users.x()).toBe("users-x");
	});
});

describe("Permissions > an api package cannot import a leaf file > under Node's own loader", () => {
	it("refuses every case in every mode and runtime, as under vitest's runner", () => {
		const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions="));
		const result = spawnSync(process.execPath, [...conditions, path.join(FIXTURE, "lib", "probe.mjs")], {
			encoding: "utf8",
			timeout: 240000
		});
		expect(result.stderr).toBe("");
		const expected = {};
		for (const mode of ["eager", "lazy"])
			for (const runtime of ["async", "live"])
				for (const entry of CASES)
					expected[`${mode}/${runtime}/${entry.pkg}/${entry.folder}`] =
						entry.value === undefined ? { code: REFUSED } : { value: entry.value };
		expect(JSON.parse(result.stdout)).toEqual(expected);
	}, 300000);
});
