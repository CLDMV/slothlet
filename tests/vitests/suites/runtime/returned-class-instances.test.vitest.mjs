/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-class-instances.test.vitest.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:30:03-08:00 (1794375003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a module returns to the host works as the plain value does, and its code keeps the instance's
 * context.
 *
 * @description
 * A leaf returns an instance of a class of the language's or Node's own (`URL`, `Response`, `AbortController`,
 * `Intl.NumberFormat`, `TextEncoder`) or of a class of its own with a private field. The host reads its getters, calls
 * its methods, compares it with itself, and hands it back to the module, and gets what the same calls give on the module
 * imported as a plain module. Code the module hands out (a closure, a function in data, a thenable, a generator, a class
 * instance, alone and nested in data) reads the `context` the instance was created with when the host runs it. Checked
 * in eager and lazy mode, the async and live runtime, with the permission system off and on under both
 * `permissions.attribution` values.
 * @module tests/vitests/suites/runtime/returned-class-instances
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_returned_instances");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		[
			{ name: "permissions off", permissions: null },
			{ name: "precise", permissions: { defaultPolicy: "allow", attribution: "precise" } },
			{ name: "fast", permissions: { defaultPolicy: "allow", attribution: "fast" } }
		].map((entry) => ({ mode, runtime, ...entry }))
	)
);

/**
 * What the host reads from the instances `things` returns.
 * @param {object} things - The module's functions, called directly or through the api.
 * @returns {Promise<object>} Each answer, by name.
 */
async function readInstances(things) {
	const account = await things.account();
	const held = await things.same();
	return {
		url: (await things.url()).href,
		urlSearch: (await things.url()).searchParams.get("a"),
		response: (await things.response()).status,
		abort: (await things.abort()).signal instanceof AbortSignal,
		format: (await things.format()).format(1),
		encoder: (await things.encoder()).encoding,
		balance: account.balance,
		deposit: account.deposit(1).balance,
		depositReturnsItself: account.deposit(1) === account,
		sameTwice: held === (await things.same()),
		handedBack: await things.isHeld(held),
		privateInOwner: await things.isAccount(held),
		// Returning a value reads none of its accessors: only the caller's own reads run them.
		dataTag: (await things.accessorOnData()).tag,
		instanceTag: (await things.accessorOnClass()).tag,
		constructorReads: await things.reads()
	};
}

/** {@link readInstances} on the module imported as a plain module. */
let plain;

beforeAll(async () => {
	plain = await readInstances(await import(`${pathToFileURL(join(FIXTURE, "things.mjs")).href}?plain-twin`));
});

describe.each(matrix)("returned instances and handed-out code > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Build the instance.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({ base: FIXTURE, silent: true, mode, runtime, context: { user: "U" }, ...(permissions ? { permissions } : {}) });
		return api;
	};

	it("hands the host instances that answer as the plain values do", async () => {
		await build();
		expect(await readInstances(api.things)).toEqual(plain);
	});

	it("runs code a module handed out in the context the instance was created with", async () => {
		await build();
		const service = await api.maker.service();
		expect({
			closure: (await api.maker.closure())(),
			functionInData: (await api.maker.box()).user(),
			thenable: await api.maker.thenable(),
			generator: [...(await api.maker.generator())],
			instance: service.user(),
			instanceSelf: service.ping(),
			instanceInData: (await api.maker.boxedService()).service.user()
		}).toEqual({
			closure: "U",
			functionInData: "U",
			thenable: "U",
			generator: ["U"],
			instance: "U",
			instanceSelf: "pong",
			instanceInData: "U"
		});
	});
});
