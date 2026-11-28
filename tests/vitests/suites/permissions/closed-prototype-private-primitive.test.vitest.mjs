/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/closed-prototype-private-primitive.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:12-08:00 (1795869132)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A closed class prototype holding a private data member whose value is a primitive: a module privacy
 * keeps the member from never gets the value by any route, and gets every answer about the prototype that needs no
 * description of that member as plain JS gives it.
 * @description
 * A prototype a module reaches through another module's api is a handle whose target must describe a fixed member
 * with its exact value (proxy invariant), and the code allowed to read the member through the handle must get that
 * value. A method or getter is held as a stand-in whose every use is refused, so its description can be handed to
 * anyone; a primitive has no stand-in. Every listing that reads the member's description (`Object.keys`, `for…in`,
 * `Object.isFrozen`, `Object.getOwnPropertyDescriptor(s)`, `Object.entries`) is therefore refused to such a module
 * (docs/PERMISSIONS.md), while `Reflect.ownKeys`, `Object.getOwnPropertyNames` and `Object.isExtensible`, which read
 * no description, answer as plain JS does. The owner, the host, and every module while the permission system is off
 * get plain JS's answers, the value included.
 *
 * Fixture (written at run time): `owner/owner.mjs` exports `FrozenBox` (frozen prototype, `_token = "s3cret"` fixed,
 * `_count = 42`) and `SealedBox` (sealed prototype, `_token` fixed); `reader/reader.mjs` and the owner list them.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "closed-prototype-private-primitive");
const BASE = path.join(ROOT, "api");
const D = "ERR:PERMISSION_DENIED";

/**
 * Run an access, reporting its value or the code of the error it threw.
 * @param {Function} fn - The access.
 * @returns {*} The value, or `"ERR:<code>"`.
 */
function tryIt(fn) {
	try {
		return fn();
	} catch (e) {
		return "ERR:" + (e.code ?? e.name);
	}
}

/**
 * How a prototype lists, and what is read of its private members.
 * @param {object} proto - The prototype.
 * @returns {object} The answers.
 */
function probe(proto) {
	return {
		ownKeys: tryIt(() => Reflect.ownKeys(proto).map(String).sort()),
		names: tryIt(() => Object.getOwnPropertyNames(proto).sort()),
		isExtensible: tryIt(() => Object.isExtensible(proto)),
		keys: tryIt(() => Object.keys(proto).sort()),
		forIn: tryIt(() => {
			const found = [];
			for (const key in proto) found.push(key);
			return found.sort();
		}),
		isFrozen: tryIt(() => Object.isFrozen(proto)),
		isSealed: tryIt(() => Object.isSealed(proto)),
		descriptor: tryIt(() => Object.getOwnPropertyDescriptor(proto, "_token")?.value),
		descriptors: tryIt(() => Object.getOwnPropertyDescriptors(proto)._token?.value),
		entries: tryIt(() => JSON.stringify(Object.entries(proto))),
		read: tryIt(() => proto._token),
		inherited: tryIt(() => Object.create(proto)._count)
	};
}

/** The probe as module source, so the owner and the reader run the same code. */
const PROBE = [String(tryIt), String(probe)];

/** The answers that need no description of the private member. */
const DESCRIPTION_FREE = ["ownKeys", "names", "isExtensible"];

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["api", "owner", "reader"]) mkdirSync(path.join(ROOT, dir), { recursive: true });
	writeFileSync(path.join(BASE, "x.mjs"), "export const x = 1;\n");
	writeFileSync(
		path.join(ROOT, "owner", "owner.mjs"),
		[
			...PROBE,
			"class FrozenBox { hi() { return 'hi'; } }",
			"Object.defineProperty(FrozenBox.prototype, '_token', { value: 's3cret', writable: false, enumerable: true, configurable: false });",
			"Object.defineProperty(FrozenBox.prototype, '_count', { value: 42, writable: true, enumerable: true, configurable: true });",
			"Object.freeze(FrozenBox.prototype);",
			"class SealedBox { hi() { return 'hi'; } }",
			"Object.defineProperty(SealedBox.prototype, '_token', { value: 's3cret', writable: false, enumerable: true, configurable: false });",
			"Object.defineProperty(SealedBox.prototype, '_count', { value: 42, writable: true, enumerable: true, configurable: true });",
			"Object.seal(SealedBox.prototype);",
			"export { FrozenBox, SealedBox };",
			"export function own(which) {",
			"\treturn probe(which === 'FrozenBox' ? FrozenBox.prototype : SealedBox.prototype);",
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(ROOT, "reader", "reader.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			...PROBE,
			"export function list(which) {",
			"\treturn probe(Object.getPrototypeOf(new self.owner[which]()));",
			"}",
			"export function viaSelfOwner(which) {",
			"\treturn probe(self.owner[which].prototype);",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

let twinCount = 0;

/**
 * The plain-JS answers, from a module instance of the owner's own.
 * @param {string} which - The class.
 * @returns {Promise<object>} The answers.
 */
async function plain(which) {
	const twin = await import(`${pathToFileURL(path.join(ROOT, "owner", "owner.mjs")).href}?twin=${++twinCount}`);
	return twin.own(which);
}

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("closed prototype with a private primitive — %s runtime, %s mode", (runtime, mode) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Make an instance with the owner and the reader added.
	 * @param {object|undefined} permissions - The permissions config.
	 * @returns {Promise<object>} The api.
	 */
	async function make(permissions) {
		api = await slothlet({ base: BASE, runtime, mode, silent: true, ...(permissions ? { permissions } : {}) });
		await api.slothlet.api.add("owner", path.join(ROOT, "owner"));
		await api.slothlet.api.add("reader", path.join(ROOT, "reader"));
		return api;
	}

	describe.each(["FrozenBox", "SealedBox"])("%s", (which) => {
		it("another module never gets the value, and lists the names as plain JS does", async () => {
			await make({ mode: "on" });
			const expected = await plain(which);
			for (const seen of [await api.reader.list(which), await api.reader.viaSelfOwner(which)]) {
				expect(JSON.stringify(seen)).not.toContain("s3cret");
				expect(JSON.stringify(seen)).not.toContain("42");
				for (const key of DESCRIPTION_FREE) expect(seen[key]).toEqual(expected[key]);
				for (const key of Object.keys(expected)) if (!DESCRIPTION_FREE.includes(key)) expect([expected[key], D]).toContainEqual(seen[key]);
				expect(seen.read).toBe(D);
				expect(seen.descriptor).toBe(D);
				expect(seen.inherited).toBe(D);
			}
		});

		it("the owner gets plain JS's answers", async () => {
			await make({ mode: "on" });
			expect(await api.owner.own(which)).toEqual(await plain(which));
		});

		it("the host gets plain JS's answers", async () => {
			await make({ mode: "on" });
			await api.owner.own(which);
			expect(probe(api.owner[which].prototype)).toEqual(await plain(which));
		});

		it.each([
			["permissions off", undefined],
			["permissions disabled", { mode: "disabled" }]
		])("with %s, another module gets plain JS's answers", async (_label, permissions) => {
			await make(permissions);
			expect(await api.reader.list(which)).toEqual(await plain(which));
		});
	});
});
