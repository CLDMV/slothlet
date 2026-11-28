/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/function-member-ancestor-object.test.vitest.mjs
 *	@Date: 2026-11-22T23:21:02-08:00 (1795418462)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:10-08:00 (1795869190)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node's function reached back through an object member is that node, as in plain JS.
 *
 * @description
 * `fnmod.tools = { parent: fnmod }` makes a cycle through an object: in plain JS `fnmod.tools.parent === fnmod`. The
 * api closes it the same way, so `api.cyc.fnmod.tools.parent` is `api.cyc.fnmod`, never a new node below `tools`. A
 * description of a member that is the node's own function (`fnmod.me = fnmod`) holds the node a read of it gives. Since
 * `tools.parent` is the node, a rule on `cyc.fnmod` decides a call through it as it decides `cyc.fnmod()`.
 *
 * Fixtures (written to tmp/): `cyc/fnmod.mjs` (the function with `me` and `tools.parent`), `cyc/dn.mjs` (a sibling, so
 * the folder is a namespace) and `reader/reader.mjs` (reads and calls through `self`).
 * @module tests/vitests/suites/unified-wrapper/function-member-ancestor-object
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(process.cwd(), "tmp", "function-member-ancestor-object");

/**
 * Write a fixture file under ROOT.
 * @param {string} file - Path relative to ROOT.
 * @param {string[]} lines - The file's lines.
 * @returns {void}
 */
function write(file, lines) {
	mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
	writeFileSync(path.join(ROOT, file), lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("base/root.mjs", ["export function ping() {", '\treturn "pong";', "}"]);
	write("cyc/fnmod.mjs", [
		"function fnmod(x) {",
		'\treturn "fn:" + x;',
		"}",
		"fnmod.me = fnmod;",
		"fnmod.tools = { parent: fnmod, val: 1 };",
		"export default fnmod;"
	]);
	write("cyc/dn.mjs", ["export default function dn(x) {", '\treturn "dn:" + x;', "}", "export const other = 3;"]);
	write("reader/reader.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"const at = (step) => {",
		"\ttry {",
		"\t\treturn step();",
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"};",
		"export function calls() {",
		"\tconst node = self.cyc.fnmod;",
		'\treturn { direct: at(() => node("x")), viaMe: at(() => node.me("x")), viaParent: at(() => node.tools.parent("x")) };',
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Build an instance with `cyc` and `reader` mounted.
 * @param {object} config - The matrix config.
 * @param {object} [permissions] - The permissions config.
 * @returns {Promise<object>} The api.
 */
async function build(config, permissions) {
	const api = await slothlet({ ...config, base: path.join(ROOT, "base"), silent: true, ...(permissions ? { permissions } : {}) });
	for (const name of ["cyc", "reader"]) await api.slothlet.api.add(name, path.join(ROOT, name), { id: name });
	await api.cyc.fnmod;
	return api;
}

describe.each(getMatrixConfigs())("a node's function reached through an object member > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("`tools.parent` is the node, at every level", async () => {
		api = await build(config);
		const node = api.cyc.fnmod;
		expect(node.tools.parent).toBe(node);
		expect(node.tools.parent.tools).toBe(node.tools);
		expect(node.tools.parent.tools.parent).toBe(node);
		expect(node.tools.parent("x")).toBe("fn:x");
		expect(node.tools.val).toBe(1);
	});

	it("a member that is the node's own function is described holding the node", async () => {
		api = await build(config);
		const node = api.cyc.fnmod;
		expect(node.me).toBe(node);
		expect(Object.getOwnPropertyDescriptor(node, "me").value).toBe(node);
		expect(Object.getOwnPropertyDescriptor(node.tools, "parent").value).toBe(node);
	});

	it("a deny on the node refuses a call through `tools.parent` as it refuses the node", async () => {
		api = await build(config, { policy: "allow", rules: [{ caller: "reader.**", target: "cyc.fnmod", effect: "deny" }] });
		expect(await api.reader.calls()).toEqual({
			direct: "!PERMISSION_DENIED",
			viaMe: "!PERMISSION_DENIED",
			viaParent: "!PERMISSION_DENIED"
		});
	});

	it("with no rule on the node every route calls it", async () => {
		api = await build(config, { policy: "allow" });
		expect(await api.reader.calls()).toEqual({ direct: "fn:x", viaMe: "fn:x", viaParent: "fn:x" });
	});
});
