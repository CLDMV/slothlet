/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/self-outside-call-no-active-instance.test.vitest.mjs
 *	@Date: 2026-11-17T21:05:03-08:00 (1794978303)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:35-08:00 (1795869095)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Host code using `self` or `context` outside any call, while instances exist but none of them is the
 * active one, is refused as code outside any call is: both runtimes give the same answer. On the live runtime this
 * happens once the instance that was active shuts down while another one keeps running.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self, context } from "@cldmv/slothlet/runtime";
import { self as asyncSelf, context as asyncContext } from "@cldmv/slothlet/runtime/async";
import { self as liveSelf, context as liveContext } from "@cldmv/slothlet/runtime/live";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const RUNTIMES = [
	{ runtime: "async", ownSelf: asyncSelf, ownContext: asyncContext },
	{ runtime: "live", ownSelf: liveSelf, ownContext: liveContext }
];

/**
 * Run a use and report what it gave, or the code of what it threw.
 * @param {function(): *} use - The use.
 * @returns {*} Its result, or the error code.
 */
const outcome = (use) => {
	try {
		return use();
	} catch (error) {
		return error?.code ?? error?.name;
	}
};

describe.each(RUNTIMES)("self and context outside any call with no active instance — $runtime", ({ runtime, ownSelf, ownContext }) => {
	const instances = [];

	afterEach(async () => {
		for (const api of instances.splice(0)) await api.slothlet.shutdown();
	});

	/**
	 * Start two instances and shut the first one down, leaving one running and, on the live runtime, none active.
	 * @returns {Promise<object>} The running instance.
	 */
	async function oneLeftRunning() {
		const first = await slothlet({ base: TEST_DIRS.API_TEST, runtime, silent: true });
		const second = await slothlet({ base: TEST_DIRS.API_TEST, runtime, silent: true });
		instances.push(second);
		await first.slothlet.shutdown();
		return second;
	}

	it.each([
		["the runtime's self", () => self],
		["the runtime's own self", () => ownSelf]
	])("refuses %s as outside any call", async (_label, selfOf) => {
		const api = await oneLeftRunning();
		const target = selfOf();
		expect({
			read: outcome(() => target.math),
			keys: outcome(() => Object.keys(target)),
			has: outcome(() => "math" in target),
			write: outcome(() => {
				target.planted = 1;
			}),
			remove: outcome(() => delete target.planted)
		}).toEqual({
			read: "CONTEXT_NOT_ACTIVE_SELF",
			keys: [],
			has: false,
			write: "CONTEXT_NOT_ACTIVE_SELF",
			remove: "CONTEXT_NOT_ACTIVE_SELF"
		});
		expect(api.planted).toBeUndefined();
	});

	it.each([
		["the runtime's context", () => context],
		["the runtime's own context", () => ownContext]
	])("refuses changing %s and reads nothing from it", async (_label, contextOf) => {
		await oneLeftRunning();
		const target = contextOf();
		expect({
			read: outcome(() => target.anything),
			keys: outcome(() => Object.keys(target)),
			has: outcome(() => "anything" in target),
			write: outcome(() => {
				target.anything = 1;
			})
		}).toEqual({
			read: undefined,
			keys: [],
			has: false,
			write: "CONTEXT_NOT_ACTIVE_WRITE"
		});
	});

	it("still answers self inside a call of the running instance", async () => {
		const api = await oneLeftRunning();
		expect(await api.slothlet.context.run({}, () => typeof self.math)).toBe("object");
	});
});
