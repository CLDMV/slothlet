/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-given-prototype.test.vitest.mjs
 *	@Date: 2026-11-25T01:23:01-08:00 (1795598581)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:00-08:00 (1795601580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A prototype the host gives an api node, as another module reads it through `self`: a view that
 * describes the prototype's members as the prototype does (accessors included), lets an object inheriting from it keep
 * its own writes, and holds every change made through it to the write rules of the node's path.
 *
 * The `owner` (base) and `reader` modules are written to `tmp/uwa-given-prototype` when the file runs.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "uwa-given-prototype");
const BASE = path.join(ROOT, "base");
const READER = path.join(ROOT, "reader");

const READER_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";

function attempt(change) {
	try {
		return change();
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

const viewOf = () => Object.getPrototypeOf(self.owner);

const PROBES = {
	describe() {
		const view = viewOf();
		const both = Object.getOwnPropertyDescriptor(view, "both");
		const readOnly = Object.getOwnPropertyDescriptor(view, "readOnly");
		const data = Object.getOwnPropertyDescriptor(view, "inherited");
		return {
			bothKinds: [typeof both.get, typeof both.set, both.enumerable],
			bothRead: both.get.call(view),
			bothWrite: attempt(() => both.set.call(view, 1)),
			readOnly: [readOnly.get.call(view), readOnly.set],
			data: [data.value, data.writable],
			nested: view.nested.deep,
			has: ["inherited" in view, "absent" in view],
			keys: Object.keys(view)
		};
	},
	inherit() {
		const child = Object.create(viewOf());
		child.mine = 1;
		return { own: Object.hasOwn(child, "mine"), inherited: child.inherited };
	},
	refused() {
		const view = viewOf();
		return {
			define: attempt(() => Reflect.defineProperty(view, "added", { value: 1, configurable: true })),
			remove: attempt(() => Reflect.deleteProperty(view, "inherited")),
			relink: attempt(() => Reflect.setPrototypeOf(view, null)),
			close: attempt(() => Reflect.preventExtensions(view))
		};
	},
	granted() {
		const view = viewOf();
		return {
			define: Reflect.defineProperty(view, "added", { value: 1, configurable: true, enumerable: true }),
			fixDefine: Reflect.defineProperty(view, "pinned", { value: 1 }),
			redefineFixed: Reflect.defineProperty(view, "fixed", { value: 2 }),
			remove: Reflect.deleteProperty(view, "inherited"),
			close: Reflect.preventExtensions(view),
			relink: Reflect.setPrototypeOf(view, { linked: true }),
			write: attempt(() => {
				view.both = 9;
				return "done";
			})
		};
	}
};

export function probe(name) {
	return PROBES[name]();
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "owner"), { recursive: true });
	mkdirSync(READER, { recursive: true });
	writeFileSync(path.join(BASE, "owner", "owner.mjs"), "export const obj = { own: 1 };\nexport function ping() {\n\treturn 1;\n}\n");
	writeFileSync(path.join(READER, "reader.mjs"), READER_SOURCE);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * A prototype with a data member, an accessor pair, a getter, and an object member.
 * @returns {object} The prototype.
 */
function makePrototype() {
	return {
		inherited: 5,
		get both() {
			return this.inherited;
		},
		set both(value) {
			this.inherited = value;
		},
		get readOnly() {
			return "r";
		},
		nested: { deep: 1 }
	};
}

describe.each(CONFIGS)("a given prototype read through self — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet?.shutdown();
		api = null;
	});

	/**
	 * Load the owner as the base and the reader as a module of its own, with the permission system on, and give the
	 * `owner` node `prototype`.
	 * @param {object} prototype - The prototype.
	 * @param {object[]} [rules] - Permission rules.
	 * @returns {Promise<object>} The api.
	 */
	async function load(prototype, rules = []) {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { rules } });
		await api.slothlet.api.add("reader", READER, { id: "reader" });
		await api.owner;
		expect(Reflect.setPrototypeOf(api.owner, prototype)).toBe(true);
		return api;
	}

	it("describes the prototype's members as the prototype does, and refuses a change through them", async () => {
		const prototype = makePrototype();
		await load(prototype);
		expect(await api.reader.probe("describe")).toEqual({
			bothKinds: ["function", "function", true],
			bothRead: 5,
			bothWrite: "LOOSE_SET_NOT_OWNED",
			readOnly: ["r", undefined],
			data: [5, true],
			nested: 1,
			has: [true, false],
			keys: ["inherited", "both", "readOnly", "nested"]
		});
		expect(prototype.inherited).toBe(5);
	});

	it("lands a write through an object inheriting from the view on that object", async () => {
		const prototype = makePrototype();
		await load(prototype);
		expect(await api.reader.probe("inherit")).toEqual({ own: true, inherited: 5 });
		expect(Object.hasOwn(prototype, "mine")).toBe(false);
	});

	it("refuses another module defining, deleting, re-linking or closing through the view", async () => {
		const prototype = makePrototype();
		await load(prototype);
		expect(await api.reader.probe("refused")).toEqual({
			define: "LOOSE_SET_NOT_OWNED",
			remove: "LOOSE_SET_NOT_OWNED",
			relink: "LOOSE_SET_NOT_OWNED",
			close: "LOOSE_SET_NOT_OWNED"
		});
		expect(Object.keys(prototype)).toEqual(["inherited", "both", "readOnly", "nested"]);
		expect(Object.isExtensible(prototype)).toBe(true);
	});

	it("makes a granted module's changes through the view on the prototype, and keeps the view itself open", async () => {
		const prototype = makePrototype();
		Object.defineProperty(prototype, "fixed", { value: 1, enumerable: true });
		await load(prototype, [
			{ caller: "reader.**", target: "owner:write", effect: "allow" },
			{ caller: "reader.**", target: "owner.**:write", effect: "allow" }
		]);
		expect(await api.reader.probe("granted")).toEqual({
			define: true,
			fixDefine: false,
			redefineFixed: false,
			remove: true,
			close: false,
			relink: true,
			write: "done"
		});
		expect(prototype.added).toBe(1);
		expect(Object.hasOwn(prototype, "pinned")).toBe(false);
		expect(prototype.inherited).toBe(9);
		expect(Object.getPrototypeOf(prototype)).toEqual({ linked: true });
		expect(Object.isExtensible(prototype)).toBe(true);
	});
});
