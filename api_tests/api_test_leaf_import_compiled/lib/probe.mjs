/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_import_compiled/lib/probe.mjs
 *	@Date: 2026-11-27T14:13:55-08:00 (1795817635)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T14:29:13-08:00 (1795818553)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Runs every route of `importer/routes.mjs` in every mode, runtime and permission setting under Node's own loader, and
// prints one JSON object: `<mode>/<runtime>/<permissions>/<route>` -> `{ value }` or `{ code }`.
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api");
const TARGET = pathToFileURL(path.join(BASE, "target", "t.mjs")).href;
const KNOWN = ["MODULE_LEAF_IMPORT_REFUSED", "PERMISSION_CAPABILITY_REFUSED", "ERR_INVALID_ARG_TYPE"];
const ROUTES = [
	"fn",
	"asyncFn",
	"generatorFn",
	"asyncGeneratorFn",
	"indirectEval",
	"runInThisContext",
	"compileFunction",
	"timerString",
	"compiledRequire"
];
if (typeof vm.SourceTextModule === "function") ROUTES.push("sourceTextModule");
const PERMISSIONS = {
	off: undefined,
	open: { policy: "allow", rules: [{ caller: "importer.**", target: "capability:code", effect: "allow" }] },
	closed: { policy: "allow" }
};

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

const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const [name, permissions] of Object.entries(PERMISSIONS)) {
			const api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(permissions ? { permissions } : {}) });
			for (const route of ROUTES)
				out[`${mode}/${runtime}/${name}/${route}`] = await outcome(() => api.importer.routes[route](`${mode}/${runtime}/${name}`));
			// The host imports the leaf file, directly and from code it compiles.
			const tag = `${mode}-${runtime}-${name}`;
			out[`${mode}/${runtime}/${name}/host`] = await outcome(async () => (await import(`${TARGET}?host=${tag}`)).value);
			out[`${mode}/${runtime}/${name}/hostCompiled`] = await outcome(
				async () => (await new Function("u", `return import(u)\n// host ${tag}`)(`${TARGET}?compiled=${tag}`)).value
			);
			if (mode === "lazy") out[`${mode}/${runtime}/${name}/unrelatedBuilt`] = api.slothlet.node(api.unrelated).materialized;
			await api.shutdown();
			delete globalThis.__slothletCompiledLeafImport;
		}
process.stdout.write(JSON.stringify(out));
