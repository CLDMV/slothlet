/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-guard-routes.test.vitest.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:29:39-08:00 (1794374979)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's own code stays its own by every route its values cross to another module.
 *
 * @description
 * The owner hands the reader instances of classes no node exports, the classes, their prototypes, and data holding them:
 * returned, awaited, yielded, thrown, emitted, stored into what the reader passed in, handed to the reader's callback,
 * read from the runtime `context`. For each route the reader tries every write that would change the owner's code: onto
 * the prototype however it is reached, onto the class's statics, over a method on the instance, and by replacing the
 * instance's prototype. With the permission system on and no rule letting the reader write the owner's paths, none of
 * them lands and each is refused as a write the reader may not make; with a rule granting the reader the owner's subtree,
 * or with the system off, the value is the owner's own and the writes land, as in plain JavaScript. Checked in eager and
 * lazy mode, the async and live runtime, and both `permissions.attribution` values, which must refuse the same things.
 * @module tests/vitests/suites/permissions/crossing-guard-routes
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_crossing_guard");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

/** Grants the reader every write in the owner's subtree. */
const ALLOW_READER_WRITES = [
	{ caller: "reader.**", target: "owner.**:write", effect: "allow" },
	{ caller: "reader.**", target: "owner:write", effect: "allow" }
];

/** The outcomes a write the reader may not make ends in. */
const REFUSALS = new Set(["LOOSE_SET_NOT_OWNED", "PERMISSION_DENIED", "refused"]);

/**
 * Build an instance with the owner and the reader mounted as modules of their own.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { moduleID: "owner" });
	await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

/**
 * Make the reader's writes by every route.
 * @param {object} api - The api.
 * @returns {Promise<Object<string, {reached: string, writes: object, landed: string[], changed: string[]}>>} Each
 *   route's outcome, with what the owner then found on its code.
 */
async function plantByEveryRoute(api) {
	const outcome = {};
	let index = 0;
	for (const route of await api.reader.routes()) {
		const prefix = `__crossing${index++}_`;
		const { reached, writes } = await api.reader.plant(route, prefix);
		outcome[route] = { reached, writes, landed: await api.owner.landed(prefix), changed: await api.owner.changed() };
	}
	return outcome;
}

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

describe.each(matrix)("crossing guard routes > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("refuses a reader with no write rule every change to the owner's code, by every route", async () => {
		api = await mount({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, events: { default: "allow" } } });
		const outcome = await plantByEveryRoute(api);
		// Every route hands the reader something of the owner's, except the one the owner's own write is refused on: a
		// function is its module's code, so the owner storing a member on the reader's function is a write to the reader.
		const reached = Object.fromEntries(Object.entries(outcome).map(([route, entry]) => [route, entry.reached]));
		const expected = Object.fromEntries(
			Object.keys(outcome).map((route) => [
				route,
				route === "storedOnFunction"
					? "threw LOOSE_SET_NOT_OWNED"
					: ["classReturned"].includes(route)
						? "class"
						: route === "prototypeReturned"
							? "prototype"
							: "instance"
			])
		);
		expect(reached).toEqual(expected);
		const landed = Object.fromEntries(
			Object.entries(outcome)
				.filter(([, entry]) => entry.landed.length > 0 || entry.changed.length > 0)
				.map(([route, entry]) => [route, [...entry.landed, ...entry.changed]])
		);
		expect(landed).toEqual({});
		const notRefused = Object.fromEntries(
			Object.entries(outcome)
				.map(([route, { writes }]) => [route, Object.entries(writes).filter(([, result]) => !REFUSALS.has(result))])
				.filter(([, open]) => open.length > 0)
				.map(([route, open]) => [route, Object.fromEntries(open)])
		);
		expect(notRefused).toEqual({});
	});

	it("refuses the same reader by every detour: out of stack, through a function the owner runs, and round the owner", async () => {
		api = await mount({ mode, runtime, hook: { enabled: true }, permissions: { defaultPolicy: "allow", attribution } });
		const outcome = {};
		let index = 0;
		for (const name of await api.reader.detours()) {
			const prefix = `__detour${index++}_`;
			outcome[name] = [
				await api.reader.detour(name, prefix),
				...(await api.owner.landed(prefix)),
				...(await api.owner.changed()),
				...(await api.owner.legacyChanged())
			];
		}
		const refused = (code = "LOOSE_SET_NOT_OWNED") => [code];
		expect(outcome).toEqual({
			stackExhausted: ["refused"],
			boundBuiltIn: refused(),
			closureRunByOwner: refused(),
			echoedData: refused(),
			echoedInstance: refused(),
			passedThroughOwner: refused(),
			afterClassReturned: refused(),
			hasInstanceDefined: refused(),
			functionPrototypeMember: refused(),
			functionPrototypeReplaced: refused(),
			instancePrototypeAssigned: refused(),
			// A data member of an instance the reader was handed is the reader's to write.
			instanceDataWritten: ["written"]
		});
	});

	it("hands a module's own hook on its own function the module's own values", async () => {
		api = await mount({ mode, runtime, hook: { enabled: true }, permissions: { defaultPolicy: "allow", attribution } });
		expect(await api.owner.ownHook()).toBe("true,true");
	});

	it("keeps a function of an object the owner hands over as data, and leaves its data the reader's to change, where nothing showed the object to be a prototype", async () => {
		// Only the data crosses here: the owner hands on nothing made from the object, so it is data like any other. Once
		// something inheriting from it crosses, it is the owner's code whole (see crossing-rules).
		api = await mount({ mode, runtime, permissions: { defaultPolicy: "allow", attribution } });
		expect(await api.reader.prototypeAsData("__data_")).toEqual({ replaced: "LOOSE_SET_NOT_OWNED", added: "written" });
		expect(await api.owner.changed()).toEqual([]);
		expect(await api.owner.landed("__data_")).toEqual(["objProto:added"]);
	});

	it("hands a reader granted the owner's subtree the owner's own values, so its writes land", async () => {
		api = await mount({
			mode,
			runtime,
			permissions: { defaultPolicy: "allow", attribution, events: { default: "allow" }, rules: ALLOW_READER_WRITES }
		});
		for (const route of ["returned", "inData", "callbackArgument", "asyncReturned", "storedInObject", "runtimeContext"]) {
			const prefix = `__granted_${route}_`;
			const { writes } = await api.reader.plant(route, prefix);
			expect({ route, write: writes.getPrototypeOf }).toEqual({ route, write: "written" });
			expect(await api.owner.landed(prefix)).toContain("Foo:getPrototypeOf");
			await api.owner.changed();
		}
		const { writes } = await api.reader.plant("classReturned", "__granted_class_");
		expect(writes).toEqual({ classPrototype: "written", staticAdded: "written", staticReplaced: "written", staticDeleted: "written" });
		expect(await api.owner.landed("__granted_class_")).toEqual(["Foo:classPrototype", "FooStatic:staticAdded"]);
		expect(await api.owner.changed()).toEqual(["Foo.create"]);
	});

	it.runIf(attribution === "precise")("hands every reader the owner's own values while the permission system is off", async () => {
		api = await mount({ mode, runtime });
		for (const route of ["returned", "inData", "callbackArgument", "asyncReturned", "storedInObject", "runtimeContext"]) {
			const prefix = `__off_${route}_`;
			const { writes } = await api.reader.plant(route, prefix);
			expect({ route, write: writes.getPrototypeOf }).toEqual({ route, write: "written" });
			expect(await api.owner.landed(prefix)).toContain("Foo:getPrototypeOf");
			await api.owner.changed();
		}
	});
});
