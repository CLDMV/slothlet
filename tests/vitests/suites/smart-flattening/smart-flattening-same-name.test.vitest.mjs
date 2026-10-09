/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-same-name.test.vitest.mjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T21:28:45-07:00 (1791520125)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Same-named files and folders compose the same api in eager and lazy mode (#583).
 *
 * @description
 * The rules (docs/API-RULES.md):
 * - A file named after its folder flattens into it: a default export becomes the folder itself,
 *   with the other files as properties (Rule 8); named exports become the folder's members (Rule 1).
 * - A FOLDER named after its parent is never hoisted on a normal load; it stays a nested namespace.
 *   (Only an `api.add` mount hoists a same-named direct child, Rule 13.)
 * - A sibling file is never dropped.
 *
 * Each fixture is `api_tests/smart_flatten/api_smart_flatten_same_name_<case>`; every leaf returns its
 * own api path, so a call proves the leaf sits where the shape says.
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-same-name
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** Root-level keys the framework adds itself. */
const FRAMEWORK_ROOT_KEYS = new Set(["slothlet", "shutdown", "destroy", "initialize"]);

/**
 * Load every node, then list each api path with its kind: `fn` (callable), `ns` (namespace) or the
 * JSON of a primitive.
 * @param {object} api - Composed api.
 * @returns {Promise<string[]>} `"<path> : <kind>"` entries, sorted.
 */
async function shapeOf(api) {
	const out = [];
	const walk = async (node, at, depth) => {
		await node;
		if (at) {
			const callable = typeof node === "function" && (node.__isCallable === undefined ? true : node.__isCallable === true);
			const kind =
				typeof node === "function" ? (callable ? "fn" : "ns") : node !== null && typeof node === "object" ? "ns" : JSON.stringify(node);
			out.push(`${at} : ${kind}`);
		}
		if (node === null || (typeof node !== "object" && typeof node !== "function")) return;
		for (const key of Object.keys(node)) {
			if (key.startsWith("_") || (depth === 0 && FRAMEWORK_ROOT_KEYS.has(key))) continue;
			await walk(node[key], at ? `${at}.${key}` : key, depth + 1);
		}
	};
	await walk(api, "", 0);
	return out.sort();
}

/**
 * Fixture → expected shape, and the calls (api path → return value) that prove placement.
 * @type {Record<string, {shape: string[], calls: Record<string, string>}>}
 */
const CASES = {
	// s/s.mjs (named getService) + s/s/worker.mjs
	a: {
		shape: ["s : ns", "s.getService : fn", "s.s : ns", "s.s.worker : ns", "s.s.worker.doWork : fn"],
		calls: { "s.getService": "s.getService", "s.s.worker.doWork": "s.s.worker.doWork" }
	},
	// s/s.mjs (default s + named extra) + s/s/worker.mjs
	b: {
		shape: ["s : fn", "s.extra : fn", "s.s : ns", "s.s.worker : ns", "s.s.worker.doWork : fn"],
		calls: { s: "s", "s.extra": "s.extra", "s.s.worker.doWork": "s.s.worker.doWork" }
	},
	// s/other.mjs + s/s/worker.mjs
	c: {
		shape: ["s : ns", "s.other : fn", "s.s : ns", "s.s.worker : ns", "s.s.worker.doWork : fn"],
		calls: { "s.other": "s.other", "s.s.worker.doWork": "s.s.worker.doWork" }
	},
	// s/s.mjs (named s + version) + s/helper.mjs
	d: {
		shape: ["s : ns", "s.helper : ns", "s.helper.fmt : fn", "s.s : fn", 's.version : "1"'],
		calls: { "s.s": "s.s", "s.helper.fmt": "s.helper.fmt" }
	},
	// s/s.mjs (default s) + s/helper.mjs
	e: {
		shape: ["s : fn", "s.helper : ns", "s.helper.fmt : fn"],
		calls: { s: "s", "s.helper.fmt": "s.helper.fmt" }
	},
	// s/s/worker.mjs
	f: {
		shape: ["s : ns", "s.s : ns", "s.s.worker : ns", "s.s.worker.doWork : fn"],
		calls: { "s.s.worker.doWork": "s.s.worker.doWork" }
	},
	// s/s.mjs (only named s) + s/helper.mjs
	g: {
		shape: ["s : ns", "s.helper : ns", "s.helper.fmt : fn", "s.s : fn"],
		calls: { "s.s": "s.s", "s.helper.fmt": "s.helper.fmt" }
	},
	// s/s.mjs (named object s = { a }) + s/helper.mjs
	h: {
		shape: ["s : ns", "s.a : fn", "s.helper : ns", "s.helper.fmt : fn"],
		calls: { "s.a": "s.a", "s.helper.fmt": "s.helper.fmt" }
	},
	// s/s.mjs (only named s), alone in its folder
	i: {
		shape: ["s : fn"],
		calls: { s: "s" }
	}
};

describe.each(getMatrixConfigs())("same-named files and folders (#583) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(Object.entries(CASES))("case %s", (name, { shape, calls }) => {
		it("composes the documented shape", async () => {
			api = await slothlet({ ...config, base: path.join(TEST_DIRS.SMART_FLATTEN, `api_smart_flatten_same_name_${name}`) });
			for (const [apiPath, expected] of Object.entries(calls)) {
				const fn = apiPath.split(".").reduce((node, key) => node[key], api);
				expect(await fn(), apiPath).toBe(expected);
			}
			expect(await shapeOf(api)).toEqual([...shape].sort());
		});
	});
});

/**
 * A sibling file and a self-named file's single named object both supply `s.a` (#583 review). The
 * sibling is composed first, so it is the existing side: it wins the conflict under every mode but
 * `merge-replace` (the incoming object wins) and `replace` (the object replaces the folder's members).
 * @type {Record<string, {a: string, keys: string[]}>}
 */
const SIBLING_CONFLICT = {
	merge: { a: "sibling-a", keys: ["a", "b"] },
	"merge-replace": { a: "object-a", keys: ["a", "b"] },
	replace: { a: "object-a", keys: ["a", "b"] },
	skip: { a: "sibling-a", keys: ["a", "b"] }
};

describe.each(getMatrixConfigs())("self-named object vs sibling conflict (#583 review) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(Object.entries(SIBLING_CONFLICT))("collision.initial %s", async (initial, { a, keys }) => {
		api = await slothlet({ ...config, base: path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_same_name_j"), collision: { initial } });
		expect(await api.s.a()).toBe(a);
		expect(await api.s.b()).toBe("object-b");
		await api.s;
		expect(Object.keys(api.s).sort()).toEqual(keys);
	});
});

describe.each(getMatrixConfigs())("addapi object default vs a same-named named export (#583 review) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * An object default keeps its own keys; a conflicting named export is dropped (#421).
	 * @param {object} node - The addapi namespace.
	 * @returns {Promise<void>}
	 */
	const expectDefaultKeepsItsKeys = async (node) => {
		await node;
		expect(node.init).toBe("default-init");
		expect(node.label).toBe("plugin-label");
		expect(await node.run()).toBe("named-run");
	};

	it("in a folder named addapi", async () => {
		api = await slothlet({ ...config, base: path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_addapi_conflict") });
		await expectDefaultKeepsItsKeys(api.addapi);
	});

	it("mounted with api.add", async () => {
		api = await slothlet({ ...config, base: path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_same_name_i") });
		await api.slothlet.api.add("plugin", path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_addapi_conflict_mount"));
		await expectDefaultKeepsItsKeys(api.plugin);
	});
});
