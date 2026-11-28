/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/handlers/unified-wrapper-function-own-keys.test.vitest.mjs
 *	@Date: 2026-09-28T10:39:19-07:00 (1790617159)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:46-08:00 (1795869106)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression: eager adoption turned a function leaf's NON-enumerable own properties into
 * enumerable api children. Adoption iterated `Reflect.ownKeys(impl)` and skipped only `length`, `name`
 * and `prototype`, so any other non-enumerable own property became a child endpoint that
 * `Object.keys()` reports. A sloppy-mode function (all CommonJS) can carry own, non-enumerable
 * `arguments` and `caller` properties, so a `module.exports = function` leaf could surface
 * `Object.keys(api.tools.count)` → `["arguments", "caller"]` in eager mode (typegen then emitted them as `unknown`
 * members).
 *
 * The rule matches the get trap's (#304): only a function's own ENUMERABLE properties are children.
 *
 * @module tests/vitests/suites/handlers/unified-wrapper-function-own-keys
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

/**
 * Write the fixture tree: a function leaf with a non-enumerable and an enumerable own property, and a
 * sloppy-mode CommonJS function leaf.
 * @returns {Promise<string>} The api base directory.
 */
async function writeFixture() {
	const root = await makeTestTmpDir("fn-own-keys");
	const tools = join(root, "api", "tools");
	await mkdir(tools, { recursive: true });
	await writeFile(
		join(tools, "tag.mjs"),
		[
			"export function tag(value) { return `#${value}`; }",
			'Object.defineProperty(tag, "hidden", { value: "internal", enumerable: false, writable: false, configurable: true });',
			'tag.visible = "public";',
			""
		].join("\n"),
		"utf8"
	);
	await writeFile(join(tools, "count.cjs"), "module.exports = function count(s) { return s.length; };\n", "utf8");
	return join(root, "api");
}

describe.each([{ mode: "eager" }, { mode: "lazy" }])("function leaf own keys ($mode)", ({ mode }) => {
	let api;
	let base;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown().catch(() => {});
		api = null;
		if (base) await rm(join(base, ".."), { recursive: true, force: true });
		base = null;
	});

	it("does not adopt a function's non-enumerable own property as an api child", async () => {
		base = await writeFixture();
		api = await slothlet({ base, mode, silent: true });
		expect(await api.tools.tag("x")).toBe("#x");
		expect(Object.keys(api.tools.tag)).not.toContain("hidden");
		// Still readable, exactly as on the function itself.
		expect(api.tools.tag.hidden).toBe("internal");
	});

	it("still adopts a function's enumerable own property", async () => {
		base = await writeFixture();
		api = await slothlet({ base, mode, silent: true });
		expect(await api.tools.tag("x")).toBe("#x");
		expect(Object.keys(api.tools.tag)).toContain("visible");
		expect(api.tools.tag.visible).toBe("public");
	});

	it("gives a sloppy-mode CommonJS function leaf no extra keys", async () => {
		base = await writeFixture();
		api = await slothlet({ base, mode, silent: true });
		expect(await api.tools.count("abc")).toBe(3);
		expect(Object.keys(api.tools.count)).toEqual([]);
	});
});
