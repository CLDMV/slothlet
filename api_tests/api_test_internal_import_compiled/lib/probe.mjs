/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_internal_import_compiled/lib/probe.mjs
 *	@Date: 2026-11-27T14:44:59-08:00 (1795819499)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:52:36-08:00 (1795870356)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Runs every route of `importer/routes.mjs` for every target in every mode, runtime and permission setting under Node's
// own loader, and prints one JSON object: `<mode>/<runtime>/<permissions>/<run|give>/<route>/<target>` -> `{ value }`
// or `{ code }`. A `run` key is the module calling the code it compiled; a `give` key is the host calling it.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api");
const LEAF = pathToFileURL(path.join(BASE, "target", "t.mjs")).href;
const INTERNAL = new URL("../../../src/lib/helpers/flow-stores.mjs", import.meta.url).href;
const KNOWN = ["MODULE_LEAF_IMPORT_REFUSED", "MODULE_INTERNAL_NOT_IMPORTABLE", "PERMISSION_CAPABILITY_REFUSED"];
export const ROUTES = [
	"fn",
	"asyncFn",
	"generatorFn",
	"asyncGeneratorFn",
	"indirectEval",
	"runInThisContext",
	"compileFunction",
	"namedScript",
	"nestedEval",
	"namedSource",
	"compiledRequire"
];
export const TARGETS = ["internal", "internalSpecifier", "leaf"];
const PERMISSIONS = {
	off: undefined,
	disabled: "disabled",
	open: { policy: "allow", rules: [{ caller: "importer.**", target: "capability:code", effect: "allow" }] },
	closed: { policy: "allow" }
};

/** How the host calls compiled code of each kind (see `importer/routes.mjs`). */
const INVOKE = {
	call: (fn) => fn(),
	generator: (fn) => fn().next().value,
	asyncGenerator: async (fn) => (await fn().next()).value
};
const read = (target, namespace) =>
	target === "leaf" ? (namespace?.value ?? namespace?.default?.value) : namespace ? "loaded" : namespace;

const codeOf = (error) => {
	const codes = [];
	for (let at = error; at && codes.length < 10; at = at.cause) codes.push(at?.code ?? String(at?.message ?? at));
	return codes.find((code) => KNOWN.includes(code)) ?? codes.join(" > ");
};
const outcome = async (fn) => {
	try {
		return { value: await fn() };
	} catch (error) {
		return { code: codeOf(error) };
	}
};

const only = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const out = {};
const require = createRequire(import.meta.url);
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const [name, permissions] of Object.entries(PERMISSIONS)) {
			const key = `${mode}/${runtime}/${name}`;
			if (only && !only.has(key)) continue;
			const api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(permissions ? { permissions } : {}) });
			for (const route of ROUTES)
				for (const target of TARGETS) {
					const tag = `${key}/${route}/${target}`;
					out[`${key}/run/${route}/${target}`] = await outcome(() => api.importer.routes.run(route, target, tag));
					out[`${key}/give/${route}/${target}`] = await outcome(async () => {
						const { kind, fn } = await api.importer.routes.give(route, target, tag);
						return read(target, await INVOKE[kind](fn));
					});
				}
			// The host imports slothlet's file and the leaf file, directly, by require and from code it compiles.
			out[`${key}/host/internal`] = await outcome(async () => read("internal", await import(`${INTERNAL}?host=${key}`)));
			out[`${key}/host/leaf`] = await outcome(async () => read("leaf", await import(`${LEAF}?host=${key}`)));
			out[`${key}/host/require`] = await outcome(async () => read("leaf", require(fileURLToPath(LEAF))));
			out[`${key}/hostCompiled/internal`] = await outcome(async () =>
				read("internal", await new Function("u", `return import(u)\n// host ${key}`)(`${INTERNAL}?compiled=${key}`))
			);
			out[`${key}/hostCompiled/leaf`] = await outcome(async () =>
				read("leaf", await new Function("u", `return import(u)\n// host ${key}`)(`${LEAF}?compiled=${key}`))
			);
			if (mode === "lazy") out[`${key}/unrelatedBuilt`] = api.slothlet.node(api.unrelated).materialized;
			await api.shutdown();
		}
process.stdout.write(JSON.stringify(out));
