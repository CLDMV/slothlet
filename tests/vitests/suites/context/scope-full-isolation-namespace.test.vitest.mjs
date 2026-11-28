/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/scope-full-isolation-namespace.test.vitest.mjs
 *	@Date: 2026-11-18T00:00:00-08:00 (1794988800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:34-08:00 (1795869094)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A full-isolation run's (`run()`, `scope({ isolation: "full" })`) changes to the framework's namespace
 * through `self` stay in the run, as every other change it makes does.
 *
 * @description
 * The host's own code and module code write `self.slothlet.<new key>`, overwrite an existing member of
 * `self.slothlet`, write below an existing member, and replace `self.slothlet` as a whole, inside a full scope and inside
 * `run()`. Each write gets the answer the same write gets where it reaches the instance (the host's code in a partial
 * scope, module code called outside any flow): refused there means refused here with the same code. A write that goes
 * through is read back by the run, and the instance's `api.slothlet` is unchanged afterwards, as a plain-JS copy of an
 * object is unchanged by writes to the copy.
 *
 * Fixture (written at run time): `writer.mjs` makes each write through `self` and reads it back.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";

const ROOT = path.join(process.cwd(), "tmp", "scope-full-isolation-namespace");
const BASE = path.join(ROOT, "api");

/**
 * The writes, each as a statement on `self` and the read that shows it.
 * @type {Record<string, {write: function(object, string): void, read: function(object): *}>}
 */
const WRITES = {
	newKey: { write: (s, v) => (s.slothlet.nsMark = v), read: (s) => s.slothlet.nsMark },
	existing: { write: (s, v) => (s.slothlet.version = v), read: (s) => s.slothlet.version },
	deep: { write: (s, v) => (s.slothlet.metadata.nsDeep = v), read: (s) => s.slothlet.metadata.nsDeep },
	replace: { write: (s, v) => (s.slothlet = { nsMark: v }), read: (s) => s.slothlet.nsMark }
};

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(BASE, { recursive: true });
	const lines = ['import { self } from "@cldmv/slothlet/runtime";', "const writes = {"];
	for (const [name, { write, read }] of Object.entries(WRITES)) {
		lines.push(`\t${name}: { write: ${write.toString()}, read: ${read.toString()} },`);
	}
	lines.push(
		"};",
		"export function attempt(name, value) {",
		"\ttry {",
		"\t\twrites[name].write(self, value);",
		'\t\treturn { outcome: "ok", seen: writes[name].read(self) };',
		"\t} catch (error) {",
		"\t\treturn { outcome: error?.code ?? String(error) };",
		"\t}",
		"}"
	);
	writeFileSync(path.join(BASE, "writer.mjs"), lines.join("\n") + "\n");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * The host's own code making a write through `self`.
 * @param {string} name - The write.
 * @param {string} value - The value written.
 * @returns {{outcome: string, seen?: *}} `"ok"` and what the code reads back, or the error code.
 */
function hostAttempt(name, value) {
	try {
		WRITES[name].write(self, value);
		return { outcome: "ok", seen: WRITES[name].read(self) };
	} catch (error) {
		return { outcome: error?.code ?? String(error) };
	}
}

const CONFIGS = [];
for (const runtime of ["async", "live"]) {
	for (const mode of ["eager", "lazy"]) {
		for (const permissions of ["on", "off", "disabled", "omitted"]) CONFIGS.push({ runtime, mode, permissions });
	}
}

/**
 * Build an instance for a configuration.
 * @param {{runtime: string, mode: string, permissions: string}} config - The configuration.
 * @returns {Promise<object>} The api.
 */
function make({ runtime, mode, permissions }) {
	const perms =
		permissions === "omitted"
			? {}
			: permissions === "disabled"
				? { permissions: { mode: "disabled" } }
				: { permissions: { mode: permissions, policy: "allow", rules: [] } };
	return slothlet({ base: BASE, runtime, mode, silent: true, ...perms });
}

/**
 * The full-isolation flows.
 * @type {Record<string, function(object, Function): Promise<*>>}
 */
const FLOWS = {
	fullScope: (api, fn) => api.slothlet.context.scope({ context: { user: "root" }, isolation: "full", fn }),
	run: (api, fn) => api.slothlet.context.run({ user: "root" }, fn)
};

/**
 * What the instance's namespace shows for the members the writes touch.
 * @param {object} api - The api.
 * @returns {object} The snapshot.
 */
const snapshot = (api) => ({
	namespace: api.slothlet,
	nsMark: api.slothlet.nsMark,
	version: api.slothlet.version,
	nsDeep: api.slothlet.metadata.nsDeep
});

describe.each(CONFIGS)(
	"Context > full isolation keeps writes to self.slothlet in the run ($runtime, $mode, permissions $permissions)",
	(config) => {
		let api;
		let reference;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			await reference?.slothlet.shutdown();
			api = null;
			reference = null;
		});

		describe.each(Object.keys(WRITES))("%s", (name) => {
			it.each(Object.keys(FLOWS))(
				"the host's own code inside %s: same answer as where it reaches the instance, kept in the run",
				async (flowName) => {
					reference = await make(config);
					const expected = await reference.slothlet.context.scope({
						context: { user: "root" },
						isolation: "partial",
						fn: () => hostAttempt(name, "ref")
					});

					api = await make(config);
					const before = snapshot(api);
					const inside = await FLOWS[flowName](api, () => hostAttempt(name, `host:${flowName}`));
					expect(inside.outcome).toBe(expected.outcome);
					if (inside.outcome === "ok") expect(inside.seen).toBe(`host:${flowName}`);
					expect(snapshot(api)).toEqual(before);
					expect(api.slothlet).toBe(before.namespace);
				}
			);

			it.each(Object.keys(FLOWS))("module code inside %s: same answer as outside any flow, kept in the run", async (flowName) => {
				reference = await make(config);
				const expected = await reference.writer.attempt(name, "ref");

				api = await make(config);
				const before = snapshot(api);
				const inside = await FLOWS[flowName](api, () => api.writer.attempt(name, `module:${flowName}`));
				expect(inside.outcome).toBe(expected.outcome);
				if (inside.outcome === "ok") expect(inside.seen).toBe(`module:${flowName}`);
				expect(snapshot(api)).toEqual(before);
				expect(api.slothlet).toBe(before.namespace);
			});
		});
	}
);
