/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_imports/table.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The loads the fixture's api files make of slothlet's files, and the same loads made by the host, for
 * the tests that compare the two (tests/vitests/suites/isolation/internal-imports.test.vitest.mjs and its child
 * process, `probe.mjs`).
 * @module api_test_internal_imports.table
 */
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { attempt as hostAttempt } from "./host/host.mjs";

const hostCjs = createRequire(import.meta.url)("./host/host.cjs");

/** The fixture's api folder. */
export const API_DIR = fileURLToPath(new URL("./api", import.meta.url));

/** The api folder whose one file imports one of slothlet's own files at its top. */
export const REFUSED_DIR = fileURLToPath(new URL("./refused", import.meta.url));

const DIRS = {
	api: API_DIR,
	helpers: fileURLToPath(new URL("./helpers", import.meta.url)),
	host: fileURLToPath(new URL("./host", import.meta.url))
};

/**
 * The path of one of slothlet's files: its source under the `slothlet-dev` condition, its build otherwise.
 * @param {string} inside - The file's path inside `lib/`.
 * @returns {string} The absolute path.
 */
export function slothletFile(inside) {
	const root = path.dirname(createRequire(import.meta.url).resolve("@cldmv/slothlet/package.json"));
	const dev = [...process.execArgv, ...(process.env.NODE_OPTIONS ?? "").split(/\s+/)].some((arg) => arg.includes("slothlet-dev"));
	const tree = dev && fs.existsSync(path.join(root, "src", "lib")) ? "src" : "dist";
	return path.join(root, tree, "lib", inside);
}

/**
 * A relative specifier from a folder to a file.
 * @param {string} dir - The folder.
 * @param {string} file - The file.
 * @returns {string} The specifier.
 */
function relativeTo(dir, file) {
	const rel = path.relative(dir, file).replace(/\\/g, "/");
	return rel.startsWith(".") ? rel : `./${rel}`;
}

const HELPER = slothletFile("helpers/instance-imports.mjs");
const HANDLER = slothletFile("handlers/context-async.mjs");
const RUNTIME = slothletFile("runtime/runtime.mjs");

/**
 * The files of slothlet the loads aim at, each with how a file in a given folder names it. `internal` marks slothlet's
 * own files; the rest are what a module's files may import.
 * @type {Array<{name: string, internal: boolean, spell: function(string): string}>}
 */
export const TARGETS = [
	{ name: "helpers subpath", internal: true, spell: () => "@cldmv/slothlet/helpers/instance-imports" },
	{ name: "another helpers subpath", internal: true, spell: () => "@cldmv/slothlet/helpers/sanitize" },
	{ name: "processors subpath", internal: true, spell: () => "@cldmv/slothlet/processors/loader" },
	{ name: "builders subpath", internal: true, spell: () => "@cldmv/slothlet/builders/builder" },
	{ name: "modes subpath", internal: true, spell: () => "@cldmv/slothlet/modes/eager" },
	{ name: "errors subpath", internal: true, spell: () => "@cldmv/slothlet/errors" },
	{ name: "i18n subpath", internal: true, spell: () => "@cldmv/slothlet/i18n" },
	{ name: "slothlet subpath", internal: true, spell: () => "@cldmv/slothlet/slothlet" },
	{ name: "package import", internal: true, spell: () => "#handlers/context-async" },
	{ name: "file URL", internal: true, spell: () => pathToFileURL(HELPER).href },
	{ name: "absolute path", internal: true, spell: () => HANDLER },
	{ name: "relative path", internal: true, spell: (dir) => relativeTo(dir, HELPER) },
	{ name: "main entry", internal: false, spell: () => "@cldmv/slothlet" },
	{ name: "runtime", internal: false, spell: () => "@cldmv/slothlet/runtime" },
	{ name: "async runtime", internal: false, spell: () => "@cldmv/slothlet/runtime/async" },
	{ name: "live runtime", internal: false, spell: () => "@cldmv/slothlet/runtime/live" },
	{ name: "runtime by path", internal: false, spell: () => RUNTIME }
];

/**
 * The ways a module's files load a file, each run by an api file and by its host-side twin.
 * @type {Array<{name: string, module: function(object, function(string): string): Promise<string>, host: function(function(string): string): Promise<string>}>}
 */
export const ROUTES = [
	...["import", "importData", "importMetaResolve", "require", "requirePlain", "requireResolve"].map((route) => ({
		name: `ES module ${route}`,
		module: (api, spell) => api.esm.attempt(route, spell(DIRS.api)),
		host: (spell) => hostAttempt(route, spell(DIRS.host))
	})),
	{
		name: "ES module require made from one of slothlet's own paths",
		module: (api, spell) => api.esm.attempt("requireFrom", spell(DIRS.api), HELPER),
		host: (spell) => hostAttempt("requireFrom", spell(DIRS.host), HELPER)
	},
	...["require", "requireResolve", "import"].map((route) => ({
		name: `CommonJS ${route}`,
		module: (api, spell) => api.cjs.attempt(route, spell(DIRS.api)),
		host: (spell) => hostCjs.attempt(route, spell(DIRS.host))
	})),
	{
		name: "import by a helper the api file imports",
		module: (api, spell) => api.esm.through("tagged", spell(DIRS.helpers)),
		host: (spell) => hostAttempt("import", spell(DIRS.host))
	},
	{
		name: "require by a helper the api file requires from its plain path",
		module: (api, spell) => api.esm.through("plain", spell(DIRS.helpers)),
		host: (spell) => hostCjs.attempt("require", spell(DIRS.host))
	}
];

/**
 * Every load, by the api files and by the host.
 * @param {object} api - An instance over {@link API_DIR}.
 * @returns {Promise<Array<{target: string, internal: boolean, route: string, module: string, host: string}>>} The outcomes.
 */
export async function collect(api) {
	const rows = [];
	for (const target of TARGETS)
		for (const route of ROUTES)
			rows.push({
				target: target.name,
				internal: target.internal,
				route: route.name,
				module: await route.module(api, target.spell),
				host: await route.host(target.spell)
			});
	return rows;
}
