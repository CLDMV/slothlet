/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/scope-isolation-default.test.vitest.mjs
 *	@Date: 2026-11-18T05:27:41-08:00 (1795008461)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T05:36:07-08:00 (1795008967)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `run()` / `scope()` isolate `self` fully unless told otherwise: with no `isolation` given (per call or in
 * the config), a `self` write made in a run stays in that run, never reaching the instance or another run. That holds
 * for writes made synchronously at the run's start, before the run has an api tree of its own, as for those made after
 * a tree change gave it one. `isolation: "partial"` still opts back into a shared `self`.
 *
 * Fixture (written at run time): `writer/writer.mjs` writes and reads members of `self`, `store/store.mjs` is a node a
 * deep write lands under, and `more/more.mjs` is a folder a run adds.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "scope-isolation-default");
const BASE = path.join(ROOT, "api");
const MORE = path.join(ROOT, "more");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "writer"), { recursive: true });
	mkdirSync(path.join(BASE, "store"), { recursive: true });
	mkdirSync(MORE, { recursive: true });
	writeFileSync(
		path.join(BASE, "writer", "writer.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function put(key, value) {",
			"\tself[key] = value;",
			"\treturn self[key];",
			"}",
			"export function get(key) {",
			"\treturn self[key];",
			"}",
			"export function putDeep(value) {",
			"\tself.store.extra = value;",
			"\treturn self.store.extra;",
			"}",
			"export function getDeep() {",
			"\treturn self.store.extra;",
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(BASE, "store", "store.mjs"), 'export function name() {\n\treturn "store";\n}\n');
	writeFileSync(path.join(MORE, "more.mjs"), 'export function ping() {\n\treturn "more";\n}\n');
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("default scope isolation — %s runtime, %s mode", (runtime, mode) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Make an instance on the fixture.
	 * @param {object} [extra] - More config.
	 * @returns {Promise<object>} The api.
	 */
	async function make(extra = {}) {
		api = await slothlet({ base: BASE, runtime, mode, silent: true, ...extra });
		return api;
	}

	it("run() keeps a self write in the run", async () => {
		await make();
		const seen = await api.slothlet.context.run({}, async () => {
			const written = await api.writer.put("fromRun", "run");
			return { written, read: await api.writer.get("fromRun") };
		});
		expect(seen).toEqual({ written: "run", read: "run" });
		expect(await api.writer.get("fromRun")).toBeUndefined();
		expect("fromRun" in api).toBe(false);
	});

	it("scope() with no isolation option keeps a self write in the scope", async () => {
		await make();
		const seen = await api.slothlet.context.scope({
			context: {},
			fn: async () => {
				await api.writer.put("fromScope", "scope");
				return api.writer.get("fromScope");
			}
		});
		expect(seen).toBe("scope");
		expect(await api.writer.get("fromScope")).toBeUndefined();
	});

	it("a scope config with no isolation key still isolates fully", async () => {
		await make({ scope: { merge: "deep" } });
		await api.slothlet.context.run({}, async () => {
			await api.writer.put("fromDeepMerge", 1);
		});
		expect(await api.writer.get("fromDeepMerge")).toBeUndefined();
	});

	it("a deep self write stays in the run", async () => {
		await make();
		const seen = await api.slothlet.context.run({}, async () => {
			await api.writer.putDeep("deep");
			return api.writer.getDeep();
		});
		expect(seen).toBe("deep");
		expect(await api.writer.getDeep()).toBeUndefined();
		expect(await api.store.name()).toBe("store");
	});

	it("a synchronous self write made before the run's tree is copied stays in the run", async () => {
		await make();
		const seen = await api.slothlet.context.run({}, () => {
			// Synchronous, at the run's start: the run has no tree of its own yet.
			const early = api.writer.put("early", "run");
			// The run's first tree change gives it a tree of its own.
			return Promise.resolve(early).then(async (written) => {
				await api.slothlet.api.add("more", MORE);
				await api.writer.put("late", "run");
				return {
					written,
					early: await api.writer.get("early"),
					late: await api.writer.get("late"),
					more: await api.more.ping()
				};
			});
		});
		expect(seen).toEqual({ written: "run", early: "run", late: "run", more: "more" });
		expect(await api.writer.get("early")).toBeUndefined();
		expect(await api.writer.get("late")).toBeUndefined();
		expect("early" in api).toBe(false);
		expect("more" in api).toBe(false);
	});

	it("a synchronous self write at the run's start is not seen by the instance while the run is still open", async () => {
		await make();
		let release;
		const hold = new Promise((resolve) => {
			release = resolve;
		});
		const running = api.slothlet.context.run({}, async () => {
			api.writer.put("open", "run");
			await hold;
			return api.writer.get("open");
		});
		expect(await api.writer.get("open")).toBeUndefined();
		release();
		expect(await running).toBe("run");
		expect(await api.writer.get("open")).toBeUndefined();
	});

	it("sibling runs each keep their own self write", async () => {
		await make();
		let release;
		const hold = new Promise((resolve) => {
			release = resolve;
		});
		const one = api.slothlet.context.run({}, async () => {
			await api.writer.put("shared", "one");
			await hold;
			return api.writer.get("shared");
		});
		const two = api.slothlet.context.run({}, async () => {
			await api.writer.put("shared", "two");
			await hold;
			return api.writer.get("shared");
		});
		release();
		expect(await Promise.all([one, two])).toEqual(["one", "two"]);
		expect(await api.writer.get("shared")).toBeUndefined();
	});

	it('isolation: "partial" still lets a run\'s self write reach the instance', async () => {
		await make();
		await api.slothlet.context.scope({
			context: {},
			isolation: "partial",
			fn: async () => {
				await api.writer.put("partialWrite", "kept");
			}
		});
		expect(await api.writer.get("partialWrite")).toBe("kept");
	});

	it('scope: { isolation: "partial" } in the config makes partial the instance default again', async () => {
		await make({ scope: { isolation: "partial" } });
		await api.slothlet.context.run({}, async () => {
			await api.writer.put("configPartial", "kept");
		});
		expect(await api.writer.get("configPartial")).toBe("kept");
	});
});
