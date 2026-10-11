/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/instanceof-api-node.test.vitest.mjs
 *	@Date: 2026-10-11T13:20:00-07:00 (1791750000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T13:20:00-07:00 (1791750000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `instanceof` against an api node answers as against the function it fronts (#580 review).
 *
 * @description
 * A class default answers its own `prototype`, so its instances test true. A lazy node not loaded yet
 * has made no instances, so `instanceof` is false rather than a TypeError. An arrow function has no
 * `prototype`, and `instanceof` against one throws, as it does against the arrow function itself.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({}))("instanceof against an api node > $name", ({ config }) => {
	let root;
	let api;

	beforeEach(async () => {
		root = resolve("tmp", `slothlet-instanceof-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(join(root, "cls"), { recursive: true });
		await mkdir(join(root, "arrow"), { recursive: true });
		await writeFile(join(root, "cls", "cls.mjs"), "export default class Widget {}\n");
		await writeFile(join(root, "arrow", "arrow.mjs"), "export default () => 1;\n");
	});

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		await rm(root, { recursive: true, force: true });
	});

	it("is false before a lazy class node loads, true for its instances after", async () => {
		api = await slothlet({ ...config, base: root });
		expect(() => ({}) instanceof api.cls).not.toThrow();
		expect({} instanceof api.cls).toBe(false);
		// A lazy node is constructed once loaded, as a lazy class is.
		if (config.mode === "lazy") await api.cls;
		const widget = new api.cls();
		expect(widget instanceof api.cls).toBe(true);
		expect({} instanceof api.cls).toBe(false);
	});

	it("throws against an arrow function default, as against the arrow function", async () => {
		api = await slothlet({ ...config, base: root });
		expect(await api.arrow()).toBe(1);
		const arrow = () => 1;
		expect(() => ({}) instanceof arrow).toThrow(TypeError);
		expect(() => ({}) instanceof api.arrow).toThrow(TypeError);
	});
});
