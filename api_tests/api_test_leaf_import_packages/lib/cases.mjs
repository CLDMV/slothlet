/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_import_packages/lib/cases.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T00:00:00-08:00 (1795507200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The cases of the package leaf-import tests, shared by the vitest suite and the probe that runs them
 * under Node's own loader: which package folder is mounted, what it reaches, and the files a refusal names.
 *
 * @module api_tests/api_test_leaf_import_packages/lib/cases
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/** The fixture's root. */
export const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The fixture's `node_modules`. */
export const MODULES = path.join(FIXTURE, "node_modules");

/** The code a refusal has. */
export const REFUSED = "MODULE_LEAF_IMPORT_REFUSED";

/**
 * The cases: the package folder mounted at `billing` (or `ledger`), whether the users package is mounted at `users`
 * first, the importer and leaf file a refusal names, and the value when the case loads.
 * @type {Array<{name: string, pkg: string, folder: string, users: boolean, importer?: string, leaf?: string, value?: string}>}
 */
export const CASES = [
	{
		name: "a leaf importing its own package's leaf by a relative path",
		pkg: "billing",
		folder: "relative",
		users: false,
		importer: "relative/run.mjs",
		leaf: "relative/target.mjs"
	},
	{
		name: "a leaf importing its own package's leaf by the package's name",
		pkg: "billing",
		folder: "selfref",
		users: false,
		importer: "selfref/run.mjs",
		leaf: "selfref/target.mjs"
	},
	{
		name: "a leaf importing its own package's leaf through #imports",
		pkg: "billing",
		folder: "hashimports",
		users: false,
		importer: "hashimports/run.mjs",
		leaf: "hashimports/target.mjs"
	},
	{
		name: "a leaf importing another package's leaf by a bare specifier",
		pkg: "billing",
		folder: "cross",
		users: true,
		importer: "cross/run.mjs",
		leaf: "users/api/x.mjs"
	},
	{
		name: "a lib file a leaf loaded importing its package's leaf",
		pkg: "billing",
		folder: "liblaunder",
		users: false,
		importer: "lib/reach-own.mjs",
		leaf: "liblaunder/target.mjs"
	},
	{
		name: "a lib file a leaf loaded importing another package's leaf by a bare specifier",
		pkg: "billing",
		folder: "libcross",
		users: true,
		importer: "lib/reach-users.mjs",
		leaf: "users/api/x.mjs"
	},
	{
		name: "a CommonJS leaf requiring its own package's leaf",
		pkg: "ledger",
		folder: "relative",
		users: false,
		importer: "relative/run.cjs",
		leaf: "relative/target.cjs"
	},
	{
		name: "a CommonJS leaf requiring another package's leaf by a bare specifier",
		pkg: "ledger",
		folder: "cross",
		users: true,
		importer: "cross/run.cjs",
		leaf: "users/api/y.cjs"
	},
	{
		name: "a CommonJS lib file a leaf loaded requiring its package's leaf",
		pkg: "ledger",
		folder: "liblaunder",
		users: false,
		importer: "lib/reach-own.cjs",
		leaf: "liblaunder/target.cjs"
	},
	{ name: "a leaf importing its package's lib file", pkg: "billing", folder: "libok", users: false, value: "money" }
];

/**
 * The api folder of a package's case.
 * @param {string} pkg - The package under `@acme/`.
 * @param {string} [folder] - The case's folder, or none for the package's whole api folder.
 * @returns {string} The folder.
 * @example
 * apiFolder("billing", "relative"); // ".../node_modules/@acme/billing/api/relative"
 */
export function apiFolder(pkg, folder) {
	return folder ? path.join(MODULES, "@acme", pkg, "api", folder) : path.join(MODULES, "@acme", pkg, "api");
}

/**
 * Mount a case's folders on an api and call its leaf.
 * @param {object} api - The api.
 * @param {object} entry - The case (see {@link CASES}).
 * @returns {Promise<string>} What the leaf returned.
 * @example
 * await runCase(api, CASES[0]); // throws MODULE_IMPORT_FAILED, MODULE_LEAF_IMPORT_REFUSED as its cause
 */
export async function runCase(api, entry) {
	if (entry.users) await api.slothlet.api.add("users", apiFolder("users"));
	await api.slothlet.api.add(entry.pkg, apiFolder(entry.pkg, entry.folder));
	return api[entry.pkg].run.go();
}

/**
 * The refusal in a chain of causes, or null.
 * @param {*} error - What was thrown.
 * @returns {*} The refusal.
 * @example
 * refusalOf(error)?.code; // "MODULE_LEAF_IMPORT_REFUSED"
 */
export function refusalOf(error) {
	for (let at = error, depth = 0; at && depth < 10; at = at.cause, depth++) if (at?.code === REFUSED) return at;
	return null;
}
