/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/fixture-packages.mjs
 *	@Date: 2026-11-28T00:00:00-08:00 (1795852800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T00:00:00-08:00 (1795852800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Give every fixture package under `api_tests/` the `@cldmv/slothlet` an installed package has.
 *
 * @description
 * A fixture module with its own `package.json` (`@local/vault-manager`, say) is its own package, as a module a
 * consumer installs is. Its files resolve `@cldmv/slothlet/runtime` the way an installed package's do: from a
 * `node_modules` above them. In the wild that is the app's install; here nothing installs the fixture, so a file
 * that imports slothlet from inside a fixture package found nothing (the package scope ends at its `package.json`, so
 * the checkout's own self-reference does not reach it).
 *
 * The test setup links `<package>/node_modules/@cldmv/slothlet` to this checkout for each fixture package that
 * declares slothlet (in `peerDependencies` or `dependencies`, as a real module does), as npm or a pnpm workspace links
 * an installed package: Node and vite resolve the name to the checkout's real path, so the files load under the same
 * URLs the tests' own imports of slothlet use. The links are made at run time and ignored by git.
 *
 * {@link fixturePackageProblems} lists every fixture package whose files import slothlet but that cannot resolve it
 * (it does not declare slothlet, or its link is missing or points elsewhere), so a fixture that would fail with
 * `MODULE_IMPORT_FAILED` deep inside a test is named before any test runs.
 *
 * @module tests/vitests/setup/fixture-packages
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** The checkout's root: the package the fixtures' links point at. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** The fixture tree. */
export const FIXTURES_ROOT = path.join(REPO_ROOT, "api_tests");

const PACKAGE_NAME = "@cldmv/slothlet";
const SOURCE_FILE = /\.(?:[mc]?[jt]s)$/;
const IMPORTS_SLOTHLET = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']@cldmv\/slothlet(?:\/[^"']*)?["']/;

/**
 * Every fixture package: each directory under `api_tests/` that holds a `package.json`, outside any `node_modules`.
 * @param {string} [root=FIXTURES_ROOT] - The fixture tree to search.
 * @returns {string[]} Their absolute paths, sorted.
 * @example
 * fixturePackages(); // [".../api_tests/api_test_self_write_reach/modules/vault-manager/vault-manager", …]
 */
export function fixturePackages(root = FIXTURES_ROOT) {
	const found = [];
	const walk = (dir) => {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		if (dir !== root && entries.some((entry) => entry.isFile() && entry.name === "package.json")) found.push(dir);
		for (const entry of entries) if (entry.isDirectory() && entry.name !== "node_modules") walk(path.join(dir, entry.name));
	};
	walk(root);
	return found.sort();
}

/**
 * The files of one fixture package that import slothlet: its own files, not those of a package nested inside it.
 * @param {string} dir - The package's directory.
 * @param {string[]} packages - Every fixture package (see {@link fixturePackages}), to stop at nested ones.
 * @returns {string[]} The files, relative to the package.
 */
function filesImportingSlothlet(dir, packages) {
	const nested = new Set(packages.filter((other) => other !== dir && other.startsWith(dir + path.sep)));
	const hits = [];
	const walk = (current) => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && !nested.has(full)) walk(full);
			} else if (entry.isFile() && SOURCE_FILE.test(entry.name) && IMPORTS_SLOTHLET.test(fs.readFileSync(full, "utf8"))) {
				hits.push(path.relative(dir, full));
			}
		}
	};
	walk(dir);
	return hits;
}

/**
 * Whether a fixture package declares slothlet, as a real module package does.
 * @param {string} dir - The package's directory.
 * @returns {boolean} Whether `peerDependencies` or `dependencies` names it.
 */
function declaresSlothlet(dir) {
	try {
		const manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
		return Boolean(manifest?.peerDependencies?.[PACKAGE_NAME] ?? manifest?.dependencies?.[PACKAGE_NAME]);
	} catch {
		return false;
	}
}

/**
 * Link `<package>/node_modules/@cldmv/slothlet` to the checkout for every fixture package that declares slothlet.
 * Safe to run from several processes at once: a link another process made first is kept.
 * @param {string} [root=FIXTURES_ROOT] - The fixture tree.
 * @returns {string[]} The packages linked (or already linked).
 * @example
 * linkFixturePackages(); // [".../vault-manager/vault-manager"]
 */
export function linkFixturePackages(root = FIXTURES_ROOT) {
	const linked = [];
	for (const dir of fixturePackages(root)) {
		if (!declaresSlothlet(dir)) continue;
		const link = path.join(dir, "node_modules", ...PACKAGE_NAME.split("/"));
		let present = false;
		try {
			fs.lstatSync(link);
			present = true;
		} catch {
			// Not linked yet.
		}
		if (!present) {
			fs.mkdirSync(path.dirname(link), { recursive: true });
			try {
				fs.symlinkSync(REPO_ROOT, link, "junction");
			} catch (error) {
				// Another process linked it first.
				if (error?.code !== "EEXIST") throw error;
			}
		}
		linked.push(dir);
	}
	return linked;
}

/**
 * The fixture packages whose files import slothlet but that cannot resolve it to this checkout.
 * @param {string} [root=FIXTURES_ROOT] - The fixture tree.
 * @returns {{package: string, files: string[], problem: string}[]} One entry per package, with its directory relative
 *   to the checkout and the files that import slothlet; empty when every one resolves.
 * @example
 * fixturePackageProblems(); // [] when every fixture package resolves slothlet
 */
export function fixturePackageProblems(root = FIXTURES_ROOT) {
	const packages = fixturePackages(root);
	const checkout = fs.realpathSync(REPO_ROOT);
	const problems = [];
	for (const dir of packages) {
		const files = filesImportingSlothlet(dir, packages);
		if (files.length === 0) continue;
		const where = path.relative(REPO_ROOT, dir);
		if (!declaresSlothlet(dir)) {
			problems.push({
				package: where,
				files,
				problem: `declare "${PACKAGE_NAME}" in its package.json peerDependencies, as a module package does`
			});
			continue;
		}
		let resolved;
		try {
			resolved = fs.realpathSync(createRequire(path.join(dir, "package.json")).resolve(PACKAGE_NAME));
		} catch (error) {
			problems.push({ package: where, files, problem: `"${PACKAGE_NAME}" does not resolve from it (${error?.code ?? error})` });
			continue;
		}
		if (!resolved.startsWith(checkout + path.sep)) {
			problems.push({ package: where, files, problem: `"${PACKAGE_NAME}" resolves to ${resolved}, not this checkout` });
		}
	}
	return problems;
}

/**
 * Link the fixture packages and refuse to run when one still cannot resolve slothlet (vitest `globalSetup`).
 * @returns {void}
 * @throws {Error} Naming each fixture package that cannot resolve slothlet and why.
 */
export default function setup() {
	linkFixturePackages();
	const problems = fixturePackageProblems();
	if (problems.length === 0) return;
	const lines = problems.map((entry) => `  - ${entry.package} (${entry.files.join(", ")}): ${entry.problem}`);
	throw new Error(`Fixture packages that import ${PACKAGE_NAME} cannot resolve it:\n${lines.join("\n")}`);
}
