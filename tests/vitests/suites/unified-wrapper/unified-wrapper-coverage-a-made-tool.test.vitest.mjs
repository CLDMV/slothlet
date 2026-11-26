/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-made-tool.test.vitest.mjs
 *	@Date: 2026-11-25T01:52:41-08:00 (1795600361)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:01-08:00 (1795601581)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An object holding code that a module makes and hands out reaches the caller as the same object reads in
 * plain JS: its methods, getters, setters, a getter-less accessor, a fixed getter and its data, described and written
 * as on the object, open or closed to extension, and a member the module deletes later is gone.
 *
 * A promise of the module's, read from such an object and handed by the host to a second module, settles there as it
 * settles, and rejects there with what it rejects with.
 *
 * Fixtures: `api_tests/api_test_uwa_made` — `factory`; `api_tests/api_test_uwa_made_other` — `other`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_uwa_made/api");
const OTHER = resolve("api_tests/api_test_uwa_made_other/api");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * The same object `factory.makeTool` makes, built here.
 * @param {"open"|"closed"} how - Whether it is closed to extension.
 * @returns {object} The tool.
 */
function plainTool(how) {
	const tool = {
		n: 1,
		run() {
			return "ran";
		},
		get doubled() {
			return this.n * 2;
		},
		set amount(value) {
			this.n = value;
		}
	};
	Object.defineProperty(tool, "setOnly", {
		set(value) {
			this.n = value;
		},
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(tool, "fixedGet", {
		get() {
			return 5;
		},
		enumerable: true
	});
	if (how === "closed") Object.preventExtensions(tool);
	return tool;
}

/**
 * Read and write a tool the way the test compares.
 * @param {object} tool - The tool.
 * @returns {object} What was seen.
 */
function use(tool) {
	const seen = {
		keys: Object.keys(tool),
		run: tool.run(),
		doubled: tool.doubled,
		setOnly: tool.setOnly,
		fixedGet: tool.fixedGet,
		describedGet: typeof Object.getOwnPropertyDescriptor(tool, "doubled").get,
		describedSet: typeof Object.getOwnPropertyDescriptor(tool, "amount").set,
		fixedDescribed: Object.getOwnPropertyDescriptor(tool, "fixedGet").configurable,
		writeGetterOnly: Reflect.set(tool, "doubled", 3),
		extensible: Object.isExtensible(tool)
	};
	tool.amount = 4;
	seen.afterSet = tool.n;
	return seen;
}

describe.each(CONFIGS)("an object holding code a module hands out — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(["open", "closed"])("reads, describes and writes a %s tool as plain JS does", async (how) => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: {} });
		const tool = await api.factory.makeTool(how);
		expect(use(tool)).toEqual(use(plainTool(how)));
		expect(await api.factory.dropFromTool("n")).toBe(true);
		expect(["n" in tool, Object.keys(tool)]).toEqual([false, ["run", "doubled", "amount", "setOnly", "fixedGet"]]);
	});

	it("hands a promise of the module's on to a second module, settling and rejecting as it does", async () => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: {} });
		await api.slothlet.api.add("other", OTHER, { id: "other" });
		const bundle = await api.factory.makeBundle();
		expect(await api.other.awaitIt(bundle.pending)).toBe(7);
		// The same promise handed on again settles the same way.
		expect(await api.other.awaitIt(bundle.pending)).toBe(7);
		expect(await api.other.reasonOf(bundle.failing)).toBe("refused by the module");
	});
});
