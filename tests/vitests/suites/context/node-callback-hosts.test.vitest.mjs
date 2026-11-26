/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/node-callback-hosts.test.vitest.mjs
 *	@Date: 2026-11-25T01:26:14-08:00 (1795598774)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:32-08:00 (1795600292)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The Node callback patch on a platform whose builtins differ from Node's own.
 *
 * @description
 * `helpers/node-callback-context` takes `node:fs`, `node:dns`, `node:crypto` and `node:module` as it loads and
 * patches the callback-style functions on them. A platform may lack any of them (a browser lacks all), lack
 * `fs.Dir` or `dns.Resolver`, or carry a function the patch cannot replace: a read-only one, or one behind an accessor
 * that ignores the write. Each case loads a fresh copy of the module over stand-in builtins and checks that what can be
 * patched is, what cannot keeps its own function, and a disable puts back only what is still the patch's.
 * @module tests/vitests/suites/context/node-callback-hosts
 */

import { pathToFileURL } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { internalLibPath } from "../../setup/internal-resolve.mjs";
// Loaded first, so the files it imports are loaded once, unmocked: only the copies below are evaluated over stand-ins.
import "#helpers/node-callback-context";

let copies = 0;

/**
 * Load a fresh copy of `helpers/node-callback-context` whose `process.getBuiltinModule` answers from `builtins`.
 * @param {Record<string, *>} builtins - Builtin id → exports (absent ids answer undefined).
 * @returns {Promise<object>} The module.
 */
async function loadWith(builtins) {
	vi.doMock("#helpers/intrinsics", async (importOriginal) => {
		const original = await importOriginal();
		return {
			...original,
			Processes: {
				...original.Processes,
				getBuiltinModule: (id) => (id in builtins ? builtins[id] : original.Processes.getBuiltinModule(id))
			}
		};
	});
	try {
		// A copy of its own, so only this file is evaluated over the stand-ins; the files it imports are the ones loaded.
		return await import(`${pathToFileURL(internalLibPath("helpers/node-callback-context.mjs")).href}?copy=hosts-${++copies}`);
	} finally {
		vi.doUnmock("#helpers/intrinsics");
	}
}

describe("Context > node callbacks > stand-in builtins", () => {
	it("patches what it can and leaves a read-only function and an accessor that ignores writes as they are", async () => {
		const readFile = function readFile(path, callback) {
			if (typeof callback !== "function") return "no-callback";
			callback(null, `read:${path}`);
		};
		const realpath = function realpath(path, callback) {
			callback(null, `real:${path}`);
		};
		realpath.native = function native(path, callback) {
			callback(null, `native:${path}`);
		};
		const chmod = function chmod() {};
		const access = function access() {};
		const fs = { readFile, realpath };
		Object.defineProperty(fs, "chmod", { value: chmod, writable: false, enumerable: true, configurable: true });
		Object.defineProperty(fs, "access", { get: () => access, set: () => {}, enumerable: true, configurable: true });

		const node = await loadWith({ "node:fs": fs, "node:dns": undefined, "node:crypto": undefined });
		node.enableNodeCallbackPatching();
		try {
			expect(fs.readFile).not.toBe(readFile);
			expect(fs.realpath).not.toBe(realpath);
			expect(fs.realpath.native).not.toBe(realpath.native);
			expect(fs.chmod).toBe(chmod);
			expect(fs.access).toBe(access);

			// Outside every flow the callback is called as Node would call it.
			const seen = [];
			fs.readFile("a", (error, value) => seen.push([error, value]));
			fs.realpath.native("b", (error, value) => seen.push([error, value]));
			expect(seen).toEqual([
				[null, "read:a"],
				[null, "native:b"]
			]);
			// A call with no callback goes straight to the function.
			expect(fs.readFile("c")).toBe("no-callback");
		} finally {
			node.disableNodeCallbackPatching();
		}
		expect(fs.readFile).toBe(readFile);
		expect(fs.realpath).toBe(realpath);
	});

	it("leaves a wrapper something else has since replaced where it is on disable", async () => {
		const readFile = function readFile() {};
		const fs = { readFile };
		const node = await loadWith({ "node:fs": fs, "node:dns": undefined, "node:crypto": undefined });
		node.enableNodeCallbackPatching();
		const replacement = function replacement() {};
		fs.readFile = replacement;
		node.disableNodeCallbackPatching();
		expect(fs.readFile).toBe(replacement);
	});

	it("does nothing on a platform with none of the builtins, and a disable of what was never enabled is inert", async () => {
		const node = await loadWith({ "node:fs": undefined, "node:dns": undefined, "node:crypto": undefined, "node:module": undefined });
		node.disableAsyncCallbackServing();
		node.disableNodeCallbackPatching();
		node.enableNodeCallbackPatching();
		node.enableAsyncCallbackServing();
		node.disableAsyncCallbackServing();
		node.disableNodeCallbackPatching();
	});

	it("skips fs.Dir and dns.Resolver where the builtins have neither", async () => {
		const lookup = function lookup() {};
		const dns = { lookup };
		const fs = {};
		const node = await loadWith({ "node:fs": fs, "node:dns": dns, "node:crypto": undefined });
		node.enableNodeCallbackPatching();
		try {
			expect(dns.lookup).not.toBe(lookup);
		} finally {
			node.disableNodeCallbackPatching();
		}
		expect(dns.lookup).toBe(lookup);
	});
});
