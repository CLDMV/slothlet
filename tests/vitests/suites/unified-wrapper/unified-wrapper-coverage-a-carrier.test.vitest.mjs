/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-carrier.test.vitest.mjs
 *	@Date: 2026-11-25T01:40:07-08:00 (1795599607)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:11-08:00 (1795869191)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An array a module hands another module as an argument, holding a prototype of the first module's class
 * (#667), reaches the second module as plain JS has it: the prototype in it is the one the second module reads at the
 * class's path, a member described is the same, a write lands in the array the first module holds, a write through an
 * object inheriting from it stays on that object, and a member held fixed reads as it is.
 *
 * The `owner` (base) and `reader` modules are written to `tmp/uwa-carrier` when the file runs.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "uwa-carrier");
const BASE = path.join(ROOT, "base");
const READER = path.join(ROOT, "reader");

const OWNER_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
export class Thing {
	label() {
		return "thing";
	}
}
export const frozenThing = Object.freeze(new Thing());
export const openThing = new Thing();
export async function give() {
	const list = [Thing.prototype, { n: 1 }];
	Object.defineProperty(list, "fixed", { value: 7, enumerable: false });
	const seen = await self.reader.take(list);
	return { seen, after: [list.length, list[2], Object.hasOwn(list, "inherited")] };
}
`;

const READER_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
export function take(list) {
	const prototype = self.owner.Thing.prototype;
	const seen = {
		first: list[0] === prototype,
		described: Object.getOwnPropertyDescriptor(list, "0").value === prototype,
		label: list[0].label.call(Object.create(list[0])),
		second: list[1].n,
		fixed: [list.fixed, Object.getOwnPropertyDescriptor(list, "fixed").value],
		missing: Object.getOwnPropertyDescriptor(list, "nothing")
	};
	list.push("pushed");
	const child = Object.create(list);
	child.inherited = 1;
	seen.childOwn = Object.hasOwn(child, "inherited");
	return seen;
}
export function protoOf(name) {
	const thing = self.owner[name];
	return [thing.__proto__ === Object.getPrototypeOf(thing), thing.__proto__ === self.owner.Thing.prototype, thing.label()];
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "owner"), { recursive: true });
	mkdirSync(READER, { recursive: true });
	writeFileSync(path.join(BASE, "owner", "owner.mjs"), OWNER_SOURCE);
	writeFileSync(path.join(READER, "reader.mjs"), READER_SOURCE);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("an array carrying a module's prototype to another module — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet?.shutdown();
		api = null;
	});

	it("reaches the other module as plain JS has it, and takes its writes", async () => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { rules: [] } });
		await api.slothlet.api.add("reader", READER, { id: "reader" });
		expect(await api.owner.give()).toEqual({
			seen: {
				first: true,
				described: true,
				label: "thing",
				second: 1,
				fixed: [7, 7],
				missing: undefined,
				childOwn: true
			},
			after: [3, "pushed", false]
		});
	});

	it.each(["frozenThing", "openThing"])("reads %s's __proto__ as its prototype, the class's at its path", async (name) => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { rules: [] } });
		await api.slothlet.api.add("reader", READER, { id: "reader" });
		await api.owner[name];
		await api.owner.Thing;
		expect(await api.reader.protoOf(name)).toEqual([true, true, "thing"]);
	});
});
