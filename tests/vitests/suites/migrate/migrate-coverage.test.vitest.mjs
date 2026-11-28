/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/migrate/migrate-coverage.test.vitest.mjs
 *	@Date: 2026-11-16T16:17:18-08:00 (1794874638)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:07-08:00 (1795869127)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every row of the v3 → v4 tables that names a v3 surface (config and option keys,
 * manifest fields, CLI flags, exports, methods, node fields, internals, error fields and codes) is
 * either rewritten or reported by @cldmv/slothlet-migrate. Each row gets a probe written in v3
 * style; the probe must produce a finding for that row.
 * @module tests/vitests/suites/migrate/migrate-coverage.test.vitest
 */

import { describe, it, expect } from "vitest";
import { ENTRIES, migrateJson, migrateSource } from "../../../../packaging/slothlet-migrate/src/index.mjs";

const IMPORT = 'import slothlet from "@cldmv/slothlet";\n';

/**
 * Nested object literal text for a dotted key path.
 * @param {string[]} path - Keys.
 * @param {string} value - Leaf value text.
 * @returns {string} Literal.
 */
function nest(path, value) {
	return path.reduceRight((inner, key) => `{ ${key}: ${inner} }`, value);
}

/** Leaf values that make a config probe meaningful. */
const CONFIG_VALUES = {
	routines: '["init"]',
	allowMutation: "false",
	scanHiddenFolders: "true",
	"api.collision": '{ initial: "merge" }',
	"permissions.references": "{ capture: true }",
	hidden: '["x"]',
	context: "{ a: 1 }"
};

/** Accessors (read, not called) in v3. */
const ACCESSORS = new Set([
	"instanceID",
	"materialize.materialized",
	"permissions.control.enabled",
	"permissions.control.readGatingEnabled",
	"permissions.control.mode"
]);

/**
 * Build a v3-style probe for one row.
 * @param {object} e - Mapping entry.
 * @returns {{ json?: string, filename?: string, code?: string }} Probe.
 */
function probe(e) {
	switch (e.kind) {
		case "config": {
			if (e.old === "manifest.files[].fullName") return { code: `${IMPORT}await slothlet({ manifest: { files: [{ fullName: "a" }] } });` };
			// scope.isolation is reported for a config that does not set it (the v4 default applies only then)
			if (e.old === "scope.isolation") return { code: `${IMPORT}await slothlet({ scope: { merge: "shallow" } });` };
			const value = CONFIG_VALUES[e.old] ?? "1";
			return { code: `${IMPORT}await slothlet(${nest(e.old.split("."), value)});` };
		}
		case "option": {
			const m =
				/^api\.slothlet\.(.+?)\((.+?)\)(?:\.(.+))?$/.exec(e.old) ??
				/^(@cldmv\/slothlet\/typegen#generateTypes)\((\w+)\)\.(.+)$/.exec(e.old);
			const [, method, arg, key] = m;
			if (method.startsWith("@cldmv/"))
				return { code: `import { generateTypes } from "@cldmv/slothlet/typegen";\nawait generateTypes(${nest([key], "1")});` };
			if (method === "api.remove")
				return { code: `api.slothlet.api.add("math", "./m", { moduleID: "m1" });\napi.slothlet.api.remove("m1", "math");` };
			if (method === "hook.on" && arg === "pattern") return { code: `api.slothlet.hook.on("before:math.*", () => {});` };
			if (method === "permissions.addRule")
				return { code: `api.slothlet.permissions.addRule({ caller: "**", target: "x", effect: "deny" });` };
			if (arg === "versionConfig") return { code: `api.slothlet.api.add("p", "./d", {}, { version: "v1", default: true, metadata: {} });` };
			const positions = {
				"api.add": 2,
				"api.leaves": 1,
				"api.modules.addDiscovered": 0,
				"api.modules.addModule": 1,
				"api.modules.addModules": 1,
				"api.modules.discover": 0,
				"hook.on": 2,
				"permissions.principal.register": 1,
				reload: 0
			};
			const index = positions[method];
			const args = Array.from({ length: index + 1 }, (_, i) =>
				i === index
					? nest(
							key.split("."),
							key === "keepInstanceID" ? "true" : key === "hidden" ? '["x"]' : key === "scanHiddenFolders" ? "true" : "1"
						)
					: '"x"'
			);
			return { code: `api.slothlet.${method}(${args.join(", ")});` };
		}
		case "manifest":
			return { json: '{ "schemaVersion": 1, "mountPath": "a", "apiDir": "b" }', filename: "slothlet.module.json" };
		case "cli":
			return {
				json: '{ "scripts": { "t": "slothlet typegen --dir a -d b --interface-name C --no-augment-runtime" }, "slothlet": { "typegen": { "dir": "a", "interfaceName": "B" } } }',
				filename: "package.json"
			};
		case "export": {
			if (e.old.includes("(")) {
				const [spec, rest] = e.old.split("#");
				const fn = rest.split("(")[0];
				const key = rest.split(").")[1];
				return { code: `import { ${fn} } from "${spec}";\n${fn}("./d", ${nest([key], "1")});` };
			}
			if (e.old.includes("#")) {
				const [spec, name] = e.old.split("#");
				return { code: `import { ${name} } from "${spec}";\nuse(${name});` };
			}
			return { code: `import * as mod from "${e.old}";\nuse(mod);` };
		}
		case "method": {
			if (e.old.startsWith("@cldmv/"))
				return { code: `import { SlothletWarning } from "@cldmv/slothlet/errors";\nSlothletWarning.${e.old.split(".").pop()}();` };
			const path = e.old.slice("api.slothlet.".length);
			if (path === "api.remove") return { code: 'api.slothlet.api.remove("m1", "math");' }; // only the two-argument form changed
			return { code: ACCESSORS.has(path) ? `const v = api.slothlet.${path};` : `api.slothlet.${path}("a");` };
		}
		case "node-field": {
			const name = e.old.replace(/^<[^>]+>\./, "");
			return { code: e.old.startsWith("metadata.") ? `const metadata = {};\nuse(${e.old});` : `use(node.${name});` };
		}
		case "internal": {
			const name = e.old.split(" ")[0];
			return { code: name === "_module" ? "const metadata = {};\nuse(metadata._module);" : `use(node.${name});` };
		}
		case "data": {
			if (e.old === "error.context") return { code: "try {} catch (err) { use(err.context); }" };
			if (e.old === "error.originalError") return { code: "try {} catch (err) { use(err.originalError); }" };
			if (e.old.endsWith("suppressConsole"))
				return { code: 'import { SlothletWarning } from "@cldmv/slothlet/errors";\nSlothletWarning.suppressConsole = true;' };
			return {
				code: 'import { SlothletError } from "@cldmv/slothlet/errors";\nthrow new SlothletError("X", {}, new Error("x"), { validationError: true });'
			};
		}
		case "code":
			return { code: `try {} catch (err) { if (err.code === "${e.old}") throw err; }` };
		default:
			throw new Error(`no probe for kind ${e.kind}`);
	}
}

const rows = ENTRIES.filter((e) => e.old !== null);

describe("slothlet-migrate covers every v3 name in its tables", () => {
	it("has rows of every kind", () => {
		const kinds = new Set(rows.map((e) => e.kind));
		expect([...kinds].sort()).toEqual([
			"cli",
			"code",
			"config",
			"data",
			"export",
			"internal",
			"manifest",
			"method",
			"node-field",
			"option"
		]);
	});

	it.each(rows.map((e) => [e.id, e]))("%s is rewritten or reported", (_id, e) => {
		const p = probe(e);
		const res = p.json ? migrateJson(p.json, { filename: p.filename }) : migrateSource(p.code, { filename: "probe.mjs" });
		expect(res.error).toBeNull();
		const hit = res.findings.filter((f) => f.entry === e.id || f.also?.includes(e.id));
		expect(hit.length, `no finding for ${e.id}; got ${JSON.stringify(res.findings.map((f) => f.entry))}`).toBeGreaterThan(0);
	});
});
