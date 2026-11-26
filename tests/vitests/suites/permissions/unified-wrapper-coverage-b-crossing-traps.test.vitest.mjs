/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/unified-wrapper-coverage-b-crossing-traps.test.vitest.mjs
 *	@Date: 2026-11-25T01:26:37-08:00 (1795598797)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:49:01-08:00 (1795600141)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Another module's values used through `self` answer as plain JavaScript answers, with the permission
 * system on as with it off; only a change to the owner's code is refused while it is on.
 *
 * @description
 * Fixture `api_test_uwb_crossing` (owner and reader mounted as modules of their own):
 * ```
 * owner/owner.mjs    strict() -> a class whose constructor throws, failing() -> an async generator that rejects,
 *                    withAccessor() -> { get computed, plain, slot }, closed() -> a non-extensible object,
 *                    frozen() -> a frozen object, fn() -> a function
 * reader/reader.mjs  constructBad, stepFailing, changeObject, useClosed, closeFunction
 * ```
 * With the system on, the reader gets the owner's values through crossing views; each use goes through one of the
 * view's traps (construct, an async step, delete, define, set, prototype reads and writes, ownKeys of a closed value).
 *
 * @module tests/vitests/suites/permissions/unified-wrapper-coverage-b-crossing-traps
 */

import { describe, it, expect, afterEach } from "vitest";
import { join, resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_uwb_crossing");

/**
 * Build an instance with the owner and the reader mounted as modules of their own.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { id: "owner" });
	await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { id: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

const MATRIX = ["eager", "lazy"].flatMap((mode) => [
	{ mode, name: "permissions on", permissions: { policy: "allow" }, on: true },
	{ mode, name: "permissions off", permissions: null, on: false }
]);

describe.each(MATRIX)("crossing view traps > $mode / $name", ({ mode, permissions, on }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("a constructor's throw and an async step's rejection reach the reader as thrown", async () => {
		api = await mount({ mode, ...(permissions ? { permissions } : {}) });
		expect(await api.reader.constructBad()).toBe("TypeError");
		expect(await api.reader.stepFailing()).toBe("RangeError: step failed");
	});

	it("changes to the owner's object land as in plain JS, except replacing its getter while the system is on", async () => {
		api = await mount({ mode, ...(permissions ? { permissions } : {}) });
		expect(await api.reader.changeObject()).toEqual({
			deleteAccessor: on ? "SlothletError: LOOSE_SET_NOT_OWNED" : true,
			storeOwn: "again",
			defineAccessor: 7,
			sameProto: true
		});
	});

	it("closed and frozen values read as plain JS reads them", async () => {
		api = await mount({ mode, ...(permissions ? { permissions } : {}) });
		expect(await api.reader.useClosed()).toEqual({
			keysBefore: ["a", "b"],
			deleted: true,
			keysAfter: ["a"],
			a: 1,
			frozenProto: true,
			frozenIsFrozen: true,
			frozenProtoAgain: true,
			setOther: "TypeError",
			inspectOther: "no hook"
		});
	});

	it("closing the owner's function is refused while the system is on", async () => {
		api = await mount({ mode, ...(permissions ? { permissions } : {}) });
		expect(await api.reader.closeFunction()).toBe(on ? "SlothletError: LOOSE_SET_NOT_OWNED" : "false");
	});
});
