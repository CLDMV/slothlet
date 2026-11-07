/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-iterators.test.vitest.mjs
 *	@Date: 2026-11-06T18:32:39-08:00 (1794018759)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T18:38:20-08:00 (1794019100)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The language's own iterators a module hands out behave as in plain JavaScript: an array's iterator
 * (directly, from `entries()`, and returned by a list class's own `Symbol.iterator`, the way a DOM `NodeList` is
 * spread), the iterator `matchAll` returns and an iterator helper all step through their values from the host.
 * @description
 * Each answer is compared with the same file imported directly, its plain-JavaScript twin. Every mode and runtime,
 * with permissions off and on.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_iterator_handout");

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of [false, true]) CONFIGS.push({ mode, runtime, permissions });

/**
 * What the host sees stepping through each of the file's iterators.
 * @param {object} lists - The file's exports, from the api or imported directly.
 * @returns {Promise<object>} What it saw.
 */
async function seen(lists) {
	const spread = [...(await lists.nodeList())].map((item) => item.name);
	const called = [...(await lists.arrayIterator())].map((fn) => fn());
	const stepped = [];
	const iterator = await lists.arrayIterator();
	for (let step = iterator.next(); !step.done; step = iterator.next()) stepped.push(step.value());
	const pairs = [];
	for (const [index, value] of await lists.entries()) pairs.push(`${index}:${value}`);
	const digits = Array.from(await lists.matches(), (match) => match[0]);
	const helper = await lists.mapped();
	return { spread, called, stepped, pairs, digits, mapped: helper === null ? null : [...helper] };
}

describe("iterators of the language's own a module hands out", () => {
	it.each(CONFIGS)("step as in plain JavaScript ($mode, $runtime, permissions $permissions)", async ({ mode, runtime, permissions }) => {
		const plain = await seen(await import(pathToFileURL(path.join(BASE, "lists.mjs")).href));
		const api = await slothlet({ dir: BASE, mode, runtime, ...(permissions ? { permissions: { defaultPolicy: "allow" } } : {}) });
		try {
			expect(await seen(api.lists)).toEqual(plain);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
