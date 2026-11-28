/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-handed-node-function.test.vitest.mjs
 *	@Date: 2026-11-24T15:21:53-08:00 (1795562513)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:28-08:00 (1795869148)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node's own function a module hands to another module's call is a call of the node however it is
 * passed: as the argument itself or nested in plain data.
 *
 * @description
 * `owner/box.mjs` exports `secret` (a node, `owner.box.secret`) and `give`, which hands its own `secret` to
 * `friend.run`: as the argument (`top`), or nested `levels` objects deep (`{ v: { v: secret } }`). `friend` reads the
 * function out and calls it. A rule denies `friend` the node `owner.box.secret`, so calling it is refused however
 * `friend` came by the function (docs/PERMISSIONS.md, "A node's own function is a call of that node however it is
 * reached"), past `permissions.search` too: only the hander's check is bounded by it. A rule naming `owner.box.*` instead does not refuse `friend`, and `give` handing its own file's function
 * is a call within one file.
 *
 * Fixtures (written to tmp/): `base/root.mjs`, `owner/box.mjs` + `owner/other.mjs`, `friend/friend.mjs`.
 * @module tests/vitests/suites/permissions/permissions-handed-node-function
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(process.cwd(), "tmp", "permissions-handed-node-function");

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
	write("owner/box.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function secret(x) {",
		'\treturn "secret:" + x;',
		"}",
		"export async function give(levels) {",
		"\tlet value = secret;",
		"\tfor (let i = 0; i < levels; i++) value = { v: value };",
		"\ttry {",
		"\t\treturn await self.friend.run(value, levels);",
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"}"
	]);
	// A second file keeps `owner.box` a folder's file of nodes, so `owner.box.secret` is a node of its own.
	write("owner/other.mjs", ["export function other() {", '\treturn "other";', "}"]);
	write("friend/friend.mjs", [
		"export async function run(value, levels) {",
		"\tfor (let i = 0; i < levels; i++) value = value.v;",
		"\ttry {",
		'\t\treturn await value("x");',
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Build an instance with every fixture module mounted.
 * @param {object} config - The matrix config.
 * @param {object} permissions - The permissions config.
 * @returns {Promise<object>} The api.
 */
async function build(config, permissions) {
	const api = await slothlet({ ...config, base: path.join(ROOT, "base"), silent: true, permissions });
	for (const name of ["owner", "friend"]) await api.slothlet.api.add(name, path.join(ROOT, name), { id: name });
	await api.owner.box.secret;
	return api;
}

describe.each(getMatrixConfigs())("Permissions > handed node function > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("refuses friend the node's function it is handed as the argument and nested in data, at any depth", async () => {
		api = await build(config, { policy: "allow", rules: [{ caller: "friend.**", target: "owner.box.secret", effect: "deny" }] });
		expect(await api.owner.box.give(0)).toBe("!PERMISSION_DENIED");
		expect(await api.owner.box.give(1)).toBe("!PERMISSION_DENIED");
		expect(await api.owner.box.give(3)).toBe("!PERMISSION_DENIED");
		// Past `permissions.search` (4 levels): read level by level, each member still reaches friend as the module's.
		expect(await api.owner.box.give(7)).toBe("!PERMISSION_DENIED");
	});

	it("a rule naming owner.box.* refuses neither the hand-over nor friend", async () => {
		api = await build(config, { policy: "allow", rules: [{ caller: "owner.box.*", target: "owner.box.secret", effect: "deny" }] });
		expect(await api.owner.box.give(0)).toBe("secret:x");
		expect(await api.owner.box.give(1)).toBe("secret:x");
	});
});
