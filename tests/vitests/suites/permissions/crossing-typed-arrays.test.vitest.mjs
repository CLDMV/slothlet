/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-typed-arrays.test.vitest.mjs
 *	@Date: 2026-11-11T10:52:29-08:00 (1794423149)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T07:00:09-08:00 (1794495609)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.typedArrayMembers`: whether a typed array or `Buffer` one module hands another is checked
 * for members of its own under string keys.
 *
 * @description
 * A typed array holds bytes, and native code needs the object itself, so one module's reaches another as itself. A
 * member a module stored on it under a string key (`bytes.item = …`) rides along unless the array's own keys are
 * listed, which lists every index. The option turns that listing on: `false` (the default) never lists, `true` always
 * does, and a whole number lists arrays up to that many kilobytes. An array found holding a member reaches the other
 * module as a view, through which the owner's code cannot be changed.
 * @module tests/vitests/suites/permissions/crossing-typed-arrays
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_crossing_rules");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Build an instance with the owner and the reader mounted as modules of their own.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { moduleID: "owner" });
	await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

describe.each(matrix)("typed array members > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const open = async (typedArrayMembers) => {
		const permissions = { defaultPolicy: "allow", attribution };
		if (typedArrayMembers !== undefined) permissions.typedArrayMembers = typedArrayMembers;
		api = await mount({ mode, runtime, permissions });
	};

	it.each([
		{ name: "left out", value: undefined },
		{ name: "false", value: false }
	])("does not list a typed array's keys with the option $name: a member under a string key rides along", async ({ value }) => {
		await open(value);
		expect(await api.reader.typed("__off_", "bytesWithMember", 64)).toEqual({
			wrapped: false,
			write: "written",
			first: 0,
			length: 64,
			copied: 64
		});
		expect(await api.owner.landed("__off_")).toEqual(["bytesWithMember"]);
	});

	it.each(["bytesWithMember", "bufferWithMember"])("views a %s result with the option true, at any size", async (kind) => {
		await open(true);
		for (const size of [64, 256 * 1024]) {
			expect(await api.reader.typed("__on_", kind, size)).toEqual({
				wrapped: true,
				write: "LOOSE_SET_NOT_OWNED",
				first: 0,
				length: size,
				copied: size
			});
		}
		expect(await api.owner.landed("__on_")).toEqual([]);
	});

	it("hands each step of the language's own iterators over as the plain result it is, the value in it as the reader gets it", async () => {
		await open(true);
		// Plain JavaScript: a step's result is a fresh object of the engine's, `{ value, done }`. What it holds is the
		// owner's and reaches the reader as any other value of the owner's does.
		expect(await api.reader.steps("__step_", 64)).toEqual({
			bytesViewed: true,
			byte: { proxy: false, keys: ["value", "done"], value: 0, done: false },
			entry: { proxy: false, done: false, instanceViewed: true, write: "LOOSE_SET_NOT_OWNED" }
		});
		expect(await api.owner.landed("__step_")).toEqual([]);
	});

	it("hands over a typed array holding only its bytes as itself with the option true", async () => {
		await open(true);
		expect(await api.reader.typed("__plain_", "bytes", 64)).toEqual({ wrapped: false, write: "none", first: 7, length: 64, copied: 64 });
	});

	it("lists arrays up to the given number of kilobytes and no larger", async () => {
		await open(1);
		expect(await api.reader.typed("__cap_", "bytesWithMember", 1024)).toEqual({
			wrapped: true,
			write: "LOOSE_SET_NOT_OWNED",
			first: 0,
			length: 1024,
			copied: 1024
		});
		expect(await api.owner.landed("__cap_")).toEqual([]);
		// Past the cap the array is not listed, as with the option off.
		expect(await api.reader.typed("__cap_", "bytesWithMember", 1025)).toEqual({
			wrapped: false,
			write: "written",
			first: 0,
			length: 1025,
			copied: 1025
		});
		expect(await api.owner.landed("__cap_")).toEqual(["bytesWithMember"]);
	});
});

describe("typed array members > configuration", () => {
	it.each([["yes"], [-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [null], [{}]])("refuses %j", async (value) => {
		await expect(
			slothlet({ base: join(FIXTURE, "host"), silent: true, permissions: { defaultPolicy: "allow", typedArrayMembers: value } })
		).rejects.toMatchObject({ code: "INVALID_CONFIG" });
	});

	it.each([[true], [false], [0], [64]])("accepts %j", async (value) => {
		const api = await slothlet({
			base: join(FIXTURE, "host"),
			silent: true,
			permissions: { defaultPolicy: "allow", typedArrayMembers: value }
		});
		expect(await api.host.ping()).toBe("pong");
		await api.shutdown();
	});
});
