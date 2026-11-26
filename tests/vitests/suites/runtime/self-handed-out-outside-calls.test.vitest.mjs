/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-handed-out-outside-calls.test.vitest.mjs
 *	@Date: 2026-11-25T01:46:58-08:00 (1795600018)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:19:03-08:00 (1795601943)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function-root `self` used by code a module handed out, run by the host after the call returned.
 *
 * @description
 * Code a module hands out reads `self` as its definer when the host runs it while no call of the instance runs, and in
 * a flow the host opened (`scope()`), told by its frames (#726). For a function root (#803) that covers calling and
 * constructing `self` too: the call is one of the api root, as the module would make it inside a call. With no call
 * running, `self` reports the prototype of the api root's own kind (a function's for a function root, an object's for
 * an object root), and the host itself, which defined none of this code, gets `CONTEXT_NOT_ACTIVE_SELF` for a call of
 * `self` it holds. Checked on both runtimes.
 * @module tests/vitests/suites/runtime/self-handed-out-outside-calls
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests");
const FN_ROOT = path.join(FIXTURES, "api_test_self_handed_out", "api");
const OBJ_ROOT = path.join(FIXTURES, "api_test_self_handed_out_objroot", "api");

describe.each(["async", "live"])("self handed out, function root > %s", (runtime) => {
	let api;
	let handed;

	beforeAll(async () => {
		api = await slothlet({ base: FN_ROOT, runtime, silent: true });
		handed = await api.probe.handOut();
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it("calls the api root as the module that defined the code", async () => {
		expect(await handed.call(2)).toBe(4);
	});

	it("constructs the api root as the module that defined the code", async () => {
		expect(await handed.construct(3)).toBe("object");
	});

	it("reports a function's prototype with no call running", () => {
		expect(handed.proto()).toBe(Function.prototype);
	});

	it.each(["partial", "full"])("calls the api root in a scope the host opened, with %s isolation", async (isolation) => {
		expect(await api.slothlet.context.scope({ context: {}, isolation, fn: () => handed.call(5) })).toBe(10);
	});

	it("refuses the host's own call of self, with no definer to run as", async () => {
		const { self } = await api.probe.expose();
		expect(Object.getPrototypeOf(self)).toBe(Function.prototype);
		let code = null;
		try {
			self(1);
		} catch (error) {
			code = error.code;
		}
		expect(code).toBe("CONTEXT_NOT_ACTIVE_SELF");
	});

	it("describes a context member the flow does not have as absent", async () => {
		expect(await api.slothlet.context.scope({ context: { present: 1 }, fn: () => api.probe.describeContext("absent") })).toBe("none");
	});
});

describe.each(["async", "live"])("self handed out, object root > %s", (runtime) => {
	it("reports an object's prototype with no call running", async () => {
		const api = await slothlet({ base: OBJ_ROOT, runtime, silent: true });
		try {
			const handed = await api.probe.handOut();
			expect(handed.proto()).toBe(Object.prototype);
			const { self } = await api.probe.expose();
			expect(Object.getPrototypeOf(self)).toBe(Object.prototype);
		} finally {
			await api.shutdown();
		}
	});
});
