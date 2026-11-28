/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lazy/lazy-file-folder-collision-node-form.test.vitest.mjs
 *	@Date: 2026-11-22T12:00:00-08:00 (1795377600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:59-08:00 (1795869119)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lazy node where a file and a folder of the same name meet (`math.mjs` beside `math/`), once loaded,
 * has the form eager gives the same node: a namespace reads `typeof "object"`, as eager's does (#811 for a plain folder).
 *
 * @description
 * Fixture (written at run time): `base/math.mjs` exports `add()` and `version`; `base/math/math.mjs` exports a `math`
 * object with `add()` and `mul()`; `base/other.mjs` exports `x()`. The same folder is also mounted with `api.add()` at
 * `mounted`. The comparison is the same node of an eager instance, read again from the api after the lazy node has
 * loaded (on access, and after `materialize.wait()` with `loader.materialize` on), and the repo's `api_test` fixture,
 * whose `math` is the same shape.
 * @module tests/vitests/suites/lazy/lazy-file-folder-collision-node-form
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "lazy-file-folder-collision-node-form");
const BASE = path.join(ROOT, "base");
const API_TEST = path.resolve("api_tests/api_test");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "math"), { recursive: true });
	writeFileSync(path.join(BASE, "math.mjs"), 'export function add(a, b) {\n\treturn a + b + 1000;\n}\nexport const version = "file";\n');
	writeFileSync(
		path.join(BASE, "math", "math.mjs"),
		"export const math = {\n\tadd(a, b) {\n\t\treturn a + b;\n\t},\n\tmul(a, b) {\n\t\treturn a * b;\n\t}\n};\n"
	);
	writeFileSync(path.join(BASE, "other.mjs"), "export function x() {\n\treturn 1;\n}\n");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * The member of the api at a dotted path.
 * @param {object} api - The api.
 * @param {string} where - The path.
 * @returns {*} The member.
 */
const at = (api, where) => where.split(".").reduce((node, key) => node[key], api);

/**
 * What the language tells of a node's form, without calling into the module's code.
 * @param {*} node - The node.
 * @returns {Record<string, *>} Its form.
 */
const formOf = (node) => ({
	typeof: typeof node,
	tag: Object.prototype.toString.call(node),
	isFunction: node instanceof Function,
	keys: Object.keys(node).sort()
});

const configs = ["async", "live"].map((runtime) => ({ runtime }));

describe.each(configs)("a loaded file+folder collision node's form > lazy / $runtime", ({ runtime }) => {
	const open = [];

	afterEach(async () => {
		for (const api of open.splice(0)) await api.slothlet.shutdown();
	});

	/**
	 * An instance of the fixture, with the same folder mounted at `mounted`.
	 * @param {"eager"|"lazy"} mode - The mode.
	 * @param {object} [extra] - More config.
	 * @returns {Promise<object>} The api.
	 */
	const make = async (mode, extra = {}) => {
		const api = await slothlet({ base: BASE, runtime, mode, silent: true, ...extra });
		open.push(api);
		await api.slothlet.api.add("mounted", BASE, { id: "mounted" });
		return api;
	};

	for (const where of ["math", "mounted.math"]) {
		it(`${where}: loaded on access, reads as eager's`, async () => {
			const eager = await make("eager");
			const lazy = await make("lazy");
			await at(lazy, where);
			expect(formOf(at(lazy, where))).toEqual(formOf(at(eager, where)));
			expect(formOf(at(eager, where)).typeof).toBe("object");
			expect(at(lazy, where).add(1, 2)).toBe(at(eager, where).add(1, 2));
		});

		it(`${where}: after materialize.wait(), reads as eager's`, async () => {
			const eager = await make("eager");
			const lazy = await make("lazy", { loader: { materialize: true } });
			await lazy.slothlet.materialize.wait();
			expect(formOf(at(lazy, where))).toEqual(formOf(at(eager, where)));
		});
	}

	it("api_test's math reads as eager's after materialize.wait()", async () => {
		const eager = await slothlet({ base: API_TEST, runtime, mode: "eager", silent: true });
		open.push(eager);
		const lazy = await slothlet({ base: API_TEST, runtime, mode: "lazy", silent: true, loader: { materialize: true } });
		open.push(lazy);
		await lazy.slothlet.materialize.wait();
		expect(formOf(lazy.math)).toEqual(formOf(eager.math));
		expect(typeof lazy.math).toBe("object");
	});
});
