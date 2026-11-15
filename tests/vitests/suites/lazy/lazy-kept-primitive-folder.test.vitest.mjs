/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-kept-primitive-folder.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:00:00-08:00 (1794772800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lazy folder's node kept before the folder loads, where the folder turns out to be a primitive (its
 * only file, named like it, exports one by default), answers as that value once loaded: `await` gives the value, and
 * `valueOf()`, `String()`, a template, `JSON.stringify` and `==` give what they give for the value. Its `__type` is the
 * value's kind, and a fresh read is the plain value.
 *
 * @description
 * A kept reference is an object and cannot become the primitive, so `typeof` and `===` still see the node. The
 * expected answers are the same questions asked of the file's default export imported plainly. A module keeping the
 * node through `self` is answered the same way, and refused every answer under a deny on the node's path, while the
 * host keeps reading the value.
 * @module tests/vitests/suites/lazy/lazy-kept-primitive-folder
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_kept_primitive_folder");

const KEYS = ["num", "str", "bool", "big", "sym"];

const configs = [
	...["eager", "lazy"].flatMap((mode) =>
		["async", "live"].flatMap((runtime) =>
			["precise", "fast"].map((attribution) => ({ mode, runtime, permissions: { attribution }, name: attribution }))
		)
	),
	...["async", "live"].flatMap((runtime) =>
		["off", "disabled"].map((mode) => ({ mode: "lazy", runtime, permissions: { mode }, name: `permissions ${mode}` }))
	)
];

/** Each file's default export, imported plainly, and the reader's questions asked of a value. */
const plain = {};
let answersOf;

beforeAll(async () => {
	for (const key of KEYS) plain[key] = (await import(`${pathToFileURL(join(FIXTURE, "zz", key, `${key}.mjs`)).href}?plain-twin`)).default;
	({ answersOf } = await import(`${pathToFileURL(join(FIXTURE, "reader.mjs")).href}?plain-twin`));
});

/**
 * The answers a value gives, less `__type`, which a plain value does not have.
 * @param {object} answers - The reader's answers.
 * @returns {object} The answers without `type`.
 */
const withoutType = ({ type: ___type, ...rest }) => rest;

/**
 * A value as the reader reports it.
 * @param {*} value - The value.
 * @returns {*} The report.
 */
const report = (value) =>
	typeof value === "symbol" ? { symbol: value.description } : typeof value === "bigint" ? { bigint: String(value) } : value;

describe.each(configs)("a kept lazy folder node that loads as a primitive > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Load the fixture with `zz` loaded and its subfolders not.
	 * @param {Array<object>} [rules=[]] - Permission rules.
	 * @returns {Promise<object>} The api.
	 */
	const load = async (rules = []) => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", rules, ...permissions } });
		await api.zz;
		return api;
	};

	it.each(KEYS)("the host's kept node answers as the value once loaded: %s", async (key) => {
		await load();
		const kept = api.zz[key];
		expect(report(await kept)).toEqual(report(plain[key]));
		expect(withoutType(answersOf(kept))).toEqual(withoutType(answersOf(plain[key])));
		// In eager mode the folder is loaded from the start, so what is kept is the value itself.
		expect(kept.__type).toBe(mode === "lazy" ? typeof plain[key] : undefined);
		expect(api.zz[key]).toBe(plain[key]);
	});

	it.each(KEYS)("a module's kept node answers as the value once loaded: %s", async (key) => {
		await load();
		expect(api.reader.take(key)).toBe(true);
		expect(await api.reader.settle(key)).toEqual(report(plain[key]));
		const answers = api.reader.answers(key);
		expect(withoutType(answers)).toEqual(withoutType(answersOf(plain[key])));
		expect(answers.type).toBe(mode === "lazy" ? typeof plain[key] : undefined);
		// A fresh read is the plain value, which has no `__type`.
		expect(api.reader.answers(key, true)).toEqual({ ...withoutType(answers), type: undefined });
	});

	it.each(KEYS)("a module the rules deny the node is refused every answer, before and after the load: %s", async (key) => {
		await load([{ caller: "reader.**", target: `zz.${key}`, effect: "deny" }]);
		const hostKept = api.zz[key];
		const refused = { threw: "PERMISSION_DENIED" };
		const enforced = !["off", "disabled"].includes(permissions.mode);
		// In eager mode the read of the member is the read of the value, refused at once.
		const taken = api.reader.take(key);
		if (mode === "eager") {
			expect(taken).toEqual(refused);
			expect(hostKept).toBe(plain[key]);
			return;
		}
		expect(taken).toBe(true);
		const settled = await api.reader.settle(key);
		if (enforced) expect(settled).toEqual(refused);
		else expect(settled).toEqual(report(plain[key]));
		await api.zz[key];
		const answers = api.reader.answers(key);
		if (enforced) for (const value of Object.values(answers)) expect(value).toEqual(refused);
		else expect(withoutType(answers)).toEqual(withoutType(answersOf(plain[key])));
		expect(withoutType(answersOf(hostKept))).toEqual(withoutType(answersOf(plain[key])));
	});
});
