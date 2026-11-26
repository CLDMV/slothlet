/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/vitest-worker-setup-records.test.vitest.mjs
 *	@Date: 2026-11-25T01:22:25-08:00 (1795598545)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:41:41-08:00 (1795599701)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The record the vitest worker setup keeps of the code vitest's server sends (see
 * `src/lib/helpers/vitest-worker-setup.mjs`): which replies it records, and which compiles `verify` then answers true
 * for. The setup runs first in this worker (the `@cldmv/slothlet/vite` plugin puts it first in `setupFiles`), so the
 * verifier is already published here.
 *
 * A reply counts only when it reaches `process.emit` from Node's IPC channel, `node:internal/child_process`. These
 * tests deliver their replies from a function compiled under that file name, which is what the setup reads from the
 * frame below its `process.emit`.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { afterAll, describe, expect, it } from "vitest";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

const SLOT = Symbol.for("@cldmv/slothlet.vitestFetched");
const SOURCE_MAP_SEPARATOR = "\n//# vitestSourceMap=";
const INLINE_SOURCE_MAP = "\n//# sourceMappingURL=data:application/json;base64,";

/** An RPC id no call of vitest's own is waiting on, so vitest's own listener passes the reply over. */
const UNUSED_CALL = "slothlet-test-unused-call";

/**
 * Hands `process.emit` a message from a function whose frame names Node's IPC channel, as a reply the server sent does.
 * @type {function(object): boolean}
 */
const deliver = vm.runInThisContext('(function deliver(message) { return process.emit("message", message); })', {
	filename: "node:internal/child_process"
});

/**
 * vitest's wrapper around a module's code, as its module evaluator compiles it.
 * @param {string} body - The code inside.
 * @returns {string} The wrapped code.
 */
const wrapped = (body) => `'use strict';async (__vite_ssr_import__,__vite_ssr_exports__)=>{{${body}\n}}`;

/** A module id no real module of this run carries. */
let counter = 0;
const nextId = () => `/virtual/slothlet-worker-setup-${process.pid}-${++counter}.mjs`;

const dir = makeTestTmpDirSync("worker-setup");
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const verifier = globalThis[SLOT];

describe("vitest worker setup > the record of the code vitest's server sends", () => {
	it("is published once, frozen, on a fixed global slot", () => {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, SLOT);
		expect(descriptor.writable).toBe(false);
		expect(descriptor.configurable).toBe(false);
		expect(Object.isFrozen(verifier)).toBe(true);
		expect(typeof verifier.verify).toBe("function");
	});

	it("records a reply's code and lets exactly one compile of it through", () => {
		const id = nextId();
		deliver({ t: "s", i: UNUSED_CALL, r: { id, code: "const a = 1;" } });
		expect(verifier.verify(id, wrapped("const b = 2;"))).toBe(false);
		expect(verifier.verify(id, wrapped("const a = 1;"))).toBe(true);
		// Each reply permits one compile.
		expect(verifier.verify(id, wrapped("const a = 1;"))).toBe(false);
	});

	it("records nothing for a reply module code emits itself", () => {
		const id = nextId();
		process.emit("message", { t: "s", i: UNUSED_CALL, r: { id, code: "const a = 1;" } });
		expect(verifier.verify(id, wrapped("const a = 1;"))).toBe(false);
	});

	it("records nothing for a message that is not a reply, or a reply with no module id", () => {
		const id = nextId();
		deliver({ t: "x", i: UNUSED_CALL, r: { id, code: "const a = 1;" } });
		deliver({ t: "s", i: UNUSED_CALL, r: { id: 42, code: "const a = 1;" } });
		deliver({ t: "s", i: UNUSED_CALL, r: { id } });
		expect(verifier.verify(id, wrapped("const a = 1;"))).toBe(false);
	});

	it("answers false for anything but vitest's wrapper around a recorded module's code", () => {
		const id = nextId();
		deliver({ t: "s", i: UNUSED_CALL, r: { id, code: "x();" } });
		expect(verifier.verify(42, wrapped("x();"))).toBe(false);
		expect(verifier.verify(id, null)).toBe(false);
		expect(verifier.verify(id, "x();")).toBe(false);
		expect(verifier.verify(id, `${wrapped("x();")}\n`)).toBe(false);
		expect(verifier.verify(nextId(), wrapped("x();"))).toBe(false);
		// The record is still there for vitest's own compile.
		expect(verifier.verify(id, wrapped("x();"))).toBe(true);
	});

	it("lets the code through followed by exactly its recorded source map, inlined", () => {
		const id = nextId();
		const map = JSON.stringify({ version: 3, sources: ["a.mjs"], mappings: "AAAA" });
		deliver({ t: "s", i: UNUSED_CALL, r: { id, code: "const a = 1;", sourceMap: map } });
		const inline = `${INLINE_SOURCE_MAP}${Buffer.from(map, "utf8").toString("base64")}\n`;
		const other = `${INLINE_SOURCE_MAP}${Buffer.from("{}", "utf8").toString("base64")}\n`;
		expect(verifier.verify(id, wrapped(`const a = 1;${other}`))).toBe(false);
		expect(verifier.verify(id, wrapped(`const b = 2;${inline}`))).toBe(false);
		expect(verifier.verify(id, wrapped(`const a = 1;${inline}`))).toBe(true);
	});

	it("lets no inlined source map through for a reply that carried none", () => {
		const id = nextId();
		deliver({ t: "s", i: UNUSED_CALL, r: { id, code: "const a = 1;", sourceMap: "" } });
		const inline = `${INLINE_SOURCE_MAP}${Buffer.from("", "utf8").toString("base64")}\n`;
		expect(verifier.verify(id, wrapped(`const a = 1;${inline}`))).toBe(false);
		expect(verifier.verify(id, wrapped("const a = 1;"))).toBe(true);
	});

	it("reads the code from the file a reply names, with or without a source map after it", () => {
		const plain = path.join(dir, "plain.js");
		fs.writeFileSync(plain, "const p = 1;");
		const mapped = path.join(dir, "mapped.js");
		const map = JSON.stringify({ version: 3, mappings: "" });
		fs.writeFileSync(mapped, `const m = 1;${SOURCE_MAP_SEPARATOR}{"x":1}${SOURCE_MAP_SEPARATOR}${map}`);
		const plainId = nextId();
		const mappedId = nextId();
		deliver({ t: "s", i: UNUSED_CALL, r: { id: plainId, tmp: plain } });
		deliver({ t: "s", i: UNUSED_CALL, r: { id: mappedId, tmp: mapped } });
		expect(verifier.verify(plainId, wrapped("const p = 1;"))).toBe(true);
		// The last marker is the separator: what comes before it is the code.
		expect(verifier.verify(mappedId, wrapped(`const m = 1;${SOURCE_MAP_SEPARATOR}{"x":1}`))).toBe(true);
	});

	it("drops the record when the file a reply names cannot be read", () => {
		const id = nextId();
		deliver({ t: "s", i: UNUSED_CALL, r: { id, code: "const a = 1;" } });
		deliver({ t: "s", i: UNUSED_CALL, r: { id, tmp: path.join(dir, "missing.js") } });
		expect(verifier.verify(id, wrapped("const a = 1;"))).toBe(false);
	});

	it("records the cached entries of a warm snapshot, and nothing from an error reply", () => {
		const cached = nextId();
		const fresh = nextId();
		const failed = nextId();
		deliver({
			t: "s",
			i: UNUSED_CALL,
			r: {
				"/a": { id: cached, code: "const c = 1;", cached: true },
				"/b": { id: fresh, code: "const f = 1;", cached: false },
				"/c": { code: "const n = 1;", cached: true },
				"/d": null
			}
		});
		deliver({ t: "s", i: UNUSED_CALL, e: { message: "failed" }, r: { "/a": { id: failed, code: "const e = 1;", cached: true } } });
		expect(verifier.verify(fresh, wrapped("const f = 1;"))).toBe(false);
		expect(verifier.verify(failed, wrapped("const e = 1;"))).toBe(false);
		expect(verifier.verify(cached, wrapped("const c = 1;"))).toBe(true);
	});

	it("reads only own data properties of a reply", () => {
		const id = nextId();
		const inherited = Object.create({ id, code: "const a = 1;" });
		deliver({ t: "s", i: UNUSED_CALL, r: inherited });
		const getter = {
			get id() {
				return id;
			},
			code: "const a = 1;"
		};
		deliver({ t: "s", i: UNUSED_CALL, r: getter });
		expect(verifier.verify(id, wrapped("const a = 1;"))).toBe(false);
	});
});
