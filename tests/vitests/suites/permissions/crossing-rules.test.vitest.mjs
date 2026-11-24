/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-rules.test.vitest.mjs
 *	@Date: 2026-11-11T10:00:39-08:00 (1794420039)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:36-08:00 (1795536516)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The rules deciding what one module's value reaches another module as, checked one rule at a time.
 *
 * @description
 * A module that may make every write at the path a value comes from gets the value itself; any other gets a view
 * through which the owner's code cannot be changed. Each function of a module is decided by the rules naming it, so a
 * function a write rule names gets the value itself whichever of its module's functions read the value first. Checked in
 * eager and lazy mode, the async and live runtime, and both `permissions.attribution` values.
 * @module tests/vitests/suites/permissions/crossing-rules
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { apiPart } from "../../setup/vitest-helper.mjs";

const FIXTURE = resolve("api_tests/api_test_crossing_rules");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

/** Grants one function of the reader every write in the owner's subtree. */
const ALLOW_WRITER_LEAF = [
	{ caller: "reader.writer", target: "owner.**:write", effect: "allow" },
	{ caller: "reader.writer", target: "owner:write", effect: "allow" }
];

/**
 * Build an instance with the owner and the reader mounted as modules of their own.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: apiPart(FIXTURE), silent: true, ...options });
	await api.slothlet.api.add("owner", apiPart(FIXTURE, "owner"), { id: "owner" });
	await api.slothlet.api.add("reader", apiPart(FIXTURE, "reader"), { id: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

/** Refuses one of two files loaded from one folder every write to the other. */
const DENY_GUEST_WRITES = [
	{ caller: "guest.**", target: "keeper.**:write", effect: "deny" },
	{ caller: "guest.**", target: "keeper:write", effect: "deny" }
];

/**
 * Refuses one of three files loaded from one folder every write to another of them, the owner's.
 * @param {string} file - The file refused.
 * @returns {object[]} The rules.
 */
const denyKinWrites = (file) => [
	{ caller: `${file}.**`, target: "owner.**:write", effect: "deny" },
	{ caller: `${file}.**`, target: "owner:write", effect: "deny" }
];

/**
 * Lets the narrow reader write the owner's subtree except one member, and refuses the wide reader the whole subtree.
 */
const SPLIT_RULES = [
	{ caller: "readers.narrow.**", target: "owner.**:write", effect: "allow" },
	{ caller: "readers.narrow.**", target: "owner.hiddenCls.secret:write", effect: "deny" },
	{ caller: "readers.wide.**", target: "owner.**:write", effect: "deny" },
	{ caller: "readers.wide.**", target: "owner:write", effect: "deny" }
];

/**
 * Hand both readers the owner's class in `order`, then have each write a static onto it itself and through a built-in
 * the owner runs.
 * @param {object} api - The api.
 * @param {string[]} order - Which reader takes the class first.
 * @returns {Promise<object>} How each write ended and whether it landed.
 */
async function splitWrites(api, order) {
	for (const file of order) await api.readers[file].take();
	const outcome = {};
	for (const file of ["wide", "narrow"])
		for (const route of ["deputy", "direct"]) {
			outcome[`${file}.${route}`] = await api.readers[file][route]();
			outcome[`${file}.${route}.landed`] = await api.owner.landed();
		}
	return outcome;
}

/** What the split rules give, read leaf by leaf. */
const SPLIT_EXPECTED = {
	"wide.deputy": "PERMISSION_DENIED",
	"wide.deputy.landed": false,
	"wide.direct": "PERMISSION_DENIED",
	"wide.direct.landed": false,
	"narrow.deputy": "written",
	"narrow.deputy.landed": true,
	"narrow.direct": "written",
	"narrow.direct.landed": true
};

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

describe.each(matrix)("crossing rules > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each([
		{ order: "the function with no rule reads it first", first: "plain", second: "writer" },
		{ order: "the function the rule names reads it first", first: "writer", second: "plain" }
	])("hands a function a write rule names the value itself when $order", async ({ first, second }) => {
		api = await mount({ mode, runtime, permissions: { policy: "allow", caller: { attribution }, rules: ALLOW_WRITER_LEAF } });
		const outcome = { [first]: await api.reader[first](`__${first}_`), [second]: await api.reader[second](`__${second}_`) };
		// Plain JavaScript hands every reader the object itself; the function with no write rule is the deviation the
		// guard needs, and its write onto the owner's class is refused.
		expect(outcome).toEqual({
			writer: { wrapped: false, isHeld: true, write: "written" },
			plain: { wrapped: true, isHeld: true, write: "LOOSE_SET_NOT_OWNED" }
		});
		expect(await api.owner.landed("__writer_")).toEqual([""]);
		expect(await api.owner.landed("__plain_")).toEqual([]);
	});

	it("keeps a file's class from a file of the same folder a rule refuses the write, by every route", async () => {
		api = await slothlet({
			base: apiPart(FIXTURE, "pair"),
			silent: true,
			mode,
			runtime,
			permissions: { policy: "allow", caller: { attribution }, rules: DENY_GUEST_WRITES }
		});
		// The rule names the write, so each is refused as a write the rule denies.
		expect(await api.guest.reach("__denied_")).toEqual({
			returned: "PERMISSION_DENIED",
			callback: "PERMISSION_DENIED",
			stored: "PERMISSION_DENIED"
		});
		expect(await api.keeper.landed("__denied_")).toEqual([]);
	});

	it("leaves two files of one folder each other's values where no rule stands between them", async () => {
		api = await slothlet({
			base: apiPart(FIXTURE, "pair"),
			silent: true,
			mode,
			runtime,
			permissions: { policy: "allow", caller: { attribution } }
		});
		// Plain JavaScript: both files hold the instance itself, and the write lands.
		expect(await api.guest.reach("__open_")).toEqual({ returned: "written", callback: "written", stored: "written" });
		expect(await api.keeper.landed("__open_")).toEqual(["returned", "callback", "stored"]);
	});

	it.each(["aside", "reader"])(
		"keeps a class a node exports from a file of the same folder a rule refuses the write, by every route (%s)",
		async (file) => {
			api = await slothlet({
				base: apiPart(FIXTURE, "kin"),
				silent: true,
				mode,
				runtime,
				permissions: { policy: "allow", caller: { attribution }, rules: denyKinWrites(file) }
			});
			// The rule names the write, so each is refused as a write the rule denies, whether the file loaded before the owner's
			// or after it, and whatever the other files of the folder may write.
			expect(await api[file].reach()).toEqual({
				node: "PERMISSION_DENIED",
				constructed: "PERMISSION_DENIED",
				returned: "PERMISSION_DENIED",
				nested: "PERMISSION_DENIED",
				method: "PERMISSION_DENIED"
			});
			expect(await api.owner.landed("__kin_")).toEqual([]);
		}
	);

	it.each(["aside", "reader"])(
		"refuses a write a bound built-in makes through the owner for a file of the same folder a rule refuses the write (%s)",
		async (file) => {
			api = await slothlet({
				base: apiPart(FIXTURE, "kin"),
				silent: true,
				mode,
				runtime,
				permissions: { policy: "allow", caller: { attribution }, rules: denyKinWrites(file) }
			});
			// The owner runs it, but the view it writes through is the file's: the write has to be the file's to make too.
			expect(await api[file].deputy()).toEqual({
				node: "PERMISSION_DENIED",
				constructed: "PERMISSION_DENIED",
				returned: "PERMISSION_DENIED",
				nested: "PERMISSION_DENIED"
			});
			expect(await api.owner.landed("__kin_bound_")).toEqual([]);
		}
	);

	it("lands a write a bound built-in makes through the owner for a file of the same folder no rule refuses", async () => {
		api = await slothlet({
			base: apiPart(FIXTURE, "kin"),
			silent: true,
			mode,
			runtime,
			permissions: { policy: "allow", caller: { attribution } }
		});
		// Plain JavaScript: every write lands.
		expect(await api.reader.deputy()).toEqual({ node: "written", constructed: "written", returned: "written", nested: "written" });
		expect(await api.owner.landed("__kin_bound_")).toEqual(["node", "constructed", "returned", "nested"]);
	});

	it("leaves a class a node exports to a file of the same folder where no rule stands between them", async () => {
		api = await slothlet({
			base: apiPart(FIXTURE, "kin"),
			silent: true,
			mode,
			runtime,
			permissions: { policy: "allow", caller: { attribution } }
		});
		// Plain JavaScript: every write lands.
		expect(await api.reader.reach()).toEqual({
			node: "written",
			constructed: "written",
			returned: "written",
			nested: "written",
			method: "written"
		});
		expect(await api.owner.landed("__kin_")).toEqual(["constructed", "returned", "nested", "hello", "inst"]);
	});

	it.each([
		["narrow", "wide"],
		["wide", "narrow"]
	])(
		"holds each file of one folder to its own write rules through a view of another file's class, %s taking it first",
		async (...order) => {
			api = await slothlet({
				base: apiPart(FIXTURE, "split"),
				silent: true,
				mode,
				runtime,
				permissions: { policy: "allow", caller: { attribution }, rules: SPLIT_RULES }
			});
			// Each write is the writing file's, and one a built-in the owner runs makes is the file's that handed it over.
			expect(await splitWrites(api, order)).toEqual(SPLIT_EXPECTED);
		}
	);

	it.each([
		["narrow", "wide"],
		["wide", "narrow"]
	])(
		"holds each function of a module to its own write rules through a view of another module's class, %s taking it first",
		async (...order) => {
			api = await slothlet({
				base: apiPart(FIXTURE),
				silent: true,
				mode,
				runtime,
				permissions: { policy: "allow", caller: { attribution }, rules: SPLIT_RULES }
			});
			await api.slothlet.api.add("owner", join(apiPart(FIXTURE, "split"), "owner"), { id: "owner" });
			await api.slothlet.api.add("readers", join(apiPart(FIXTURE, "split"), "readers"), { id: "readers" });
			expect(await splitWrites(api, order)).toEqual(SPLIT_EXPECTED);
		}
	);

	it("lands every write of two files of one folder onto another file's class where no rule stands between them", async () => {
		api = await slothlet({
			base: apiPart(FIXTURE, "split"),
			silent: true,
			mode,
			runtime,
			permissions: { policy: "allow", caller: { attribution } }
		});
		// Plain JavaScript: every write lands.
		expect(await splitWrites(api, ["narrow", "wide"])).toEqual({
			"wide.deputy": "written",
			"wide.deputy.landed": true,
			"wide.direct": "written",
			"wide.direct.landed": true,
			"narrow.deputy": "written",
			"narrow.deputy.landed": true,
			"narrow.direct": "written",
			"narrow.direct.landed": true
		});
	});

	it("keeps the owner's code from a view a module holds past the instance's shutdown", async () => {
		api = await mount({ mode, runtime, permissions: { policy: "allow", caller: { attribution } } });
		expect(await api.reader.keep()).toBe(true);
		await api.shutdown();
		api = null;
		// The module was handed a view because it may not write the owner's code; the instance ending grants it nothing.
		// A write onto the class is refused as one made in no call of the instance, a method shadowed on the instance as
		// one the module does not own. Data it was handed stays its to change.
		expect(globalThis.__crossingRulesReader.writeThroughKept("__after_")).toEqual({
			getPrototypeOf: "CONTEXT_NOT_ACTIVE_SELF",
			proto: "CONTEXT_NOT_ACTIVE_SELF",
			constructor: "CONTEXT_NOT_ACTIVE_SELF",
			method: "CONTEXT_NOT_ACTIVE_SELF",
			keptPrototype: "CONTEXT_NOT_ACTIVE_SELF",
			shadowed: "LOOSE_SET_NOT_OWNED",
			data: "written"
		});
		expect(globalThis.__crossingRulesOwner.landed("__after_")).toEqual([]);
	});

	it("leaves a module the value itself past shutdown where it held the value itself", async () => {
		api = await mount({ mode, runtime });
		expect(await api.reader.keep()).toBe(false);
		await api.shutdown();
		api = null;
		// Plain JavaScript: with the permission system off the module holds the owner's object, before and after.
		expect(globalThis.__crossingRulesReader.writeThroughKept("__off_")).toEqual({
			getPrototypeOf: "written",
			proto: "written",
			constructor: "written",
			method: "written",
			keptPrototype: "written",
			shadowed: "written",
			data: "written"
		});
		expect(globalThis.__crossingRulesOwner.landed("__off_")).toEqual(["getPrototypeOf", "proto", "constructor", "keptPrototype", "hi"]);
	});

	it.each(["instanceFirst", "dataFirst"])(
		"holds an object a module uses as a prototype to that module's write rules when it is handed on as data (%s)",
		async (order) => {
			api = await mount({ mode, runtime, permissions: { policy: "allow", caller: { attribution } } });
			const refused = "LOOSE_SET_NOT_OWNED";
			expect(await api.reader.prototypeAsData("__data_", order)).toEqual({
				replaced: refused,
				addedFunction: refused,
				addedData: refused,
				changedData: refused,
				defined: refused,
				deleted: refused,
				// Plain JavaScript: the prototype of what the owner makes is the object it handed on.
				same: true,
				inherited: "hi"
			});
			expect(await api.owner.landed("__data_")).toEqual([]);
		}
	);

	it("leaves such an object the reader's to change with the permission system off", async () => {
		api = await mount({ mode, runtime });
		expect(await api.reader.prototypeAsData("__off_", "instanceFirst")).toEqual({
			replaced: "written",
			addedFunction: "written",
			addedData: "written",
			changedData: "written",
			defined: "written",
			deleted: "written",
			same: true,
			inherited: "planted"
		});
		expect(await api.owner.landed("__off_")).toEqual(["shared:fn", "shared:data", "shared:defined", "shared.hi", "shared.n"]);
	});

	/**
	 * Have the owner and the reader listen and hook, then relay a value through the host: emitted as an event, and
	 * passed to a call both modules hook.
	 * @param {object} options - Instance options.
	 * @param {(data: object) => object} pick - What the host relays of the data the owner returned.
	 * @returns {Promise<void>}
	 */
	const relay = async (options, pick, make = "makeData") => {
		api = await mount({ mode, runtime, hook: { enabled: true }, ...options });
		await api.owner.listen();
		await api.reader.listen();
		const relayed = pick(await api.owner[make]());
		await api.slothlet.event.emit("crossing-rules:relay", relayed);
		expect(await api.host.take(relayed)).toBe("object");
	};

	it("hands another module's listener and hook a view of what a module returned and the host relays as it is", async () => {
		await relay({ permissions: { policy: "allow", caller: { attribution }, events: { policy: "allow" } } }, (data) => data);
		expect(await api.reader.received("__relay_")).toEqual({
			heardWrapped: true,
			heardWrite: "LOOSE_SET_NOT_OWNED",
			hookedWrapped: true,
			hookedWrite: "LOOSE_SET_NOT_OWNED"
		});
		expect(await api.owner.landed("__relay_")).toEqual([]);
		// Plain JavaScript: the module that made the value gets its own object back.
		expect(await api.owner.received()).toEqual({ heardItself: true, heardInstance: true, hookedItself: true, hookedInstance: true });
	});

	it("hands another module's listener and hook a view of an instance a module returned and the host relays", async () => {
		await relay(
			{ permissions: { policy: "allow", caller: { attribution }, events: { policy: "allow" } } },
			(instance) => instance,
			"makeInstance"
		);
		expect(await api.reader.received("__instance_")).toEqual({
			heardWrapped: true,
			heardWrite: "LOOSE_SET_NOT_OWNED",
			hookedWrapped: true,
			hookedWrite: "LOOSE_SET_NOT_OWNED"
		});
		expect(await api.owner.landed("__instance_")).toEqual([]);
		expect(await api.owner.received()).toEqual({ heardItself: true, heardInstance: true, hookedItself: true, hookedInstance: true });
	});

	it("hands another module's hook a view of what a module passes its own function", async () => {
		api = await mount({ mode, runtime, hook: { enabled: true }, permissions: { policy: "allow", caller: { attribution } } });
		await api.reader.listen();
		expect(await api.owner.useOwn()).toBe("object");
		const { hookedWrapped, hookedWrite } = await api.reader.received("__own_");
		expect({ hookedWrapped, hookedWrite }).toEqual({ hookedWrapped: true, hookedWrite: "LOOSE_SET_NOT_OWNED" });
		expect(await api.owner.landed("__own_")).toEqual([]);
	});

	it("hands a listener and a hook what the host built itself as it is", async () => {
		await relay({ permissions: { policy: "allow", caller: { attribution }, events: { policy: "allow" } } }, (data) => ({
			inst: data.inst
		}));
		// The host holds the owner's real objects, and what it builds from them is its own to hand on.
		expect(await api.reader.received("__built_")).toEqual({
			heardWrapped: false,
			heardWrite: "written",
			hookedWrapped: false,
			hookedWrite: "written"
		});
		expect(await api.owner.landed("__built_")).toEqual(["heard", "hooked"]);
	});

	it("decides the same with the language's own functions replaced after slothlet loaded", async () => {
		api = await mount({ mode, runtime, permissions: { policy: "allow", caller: { attribution } } });
		// A module can replace a built-in for everyone, as in plain JavaScript; what slothlet decides does not follow it.
		expect(await api.reader.steered("__steered_")).toEqual({
			reached: "both",
			data: "LOOSE_SET_NOT_OWNED",
			made: "LOOSE_SET_NOT_OWNED"
		});
		expect(await api.owner.landed("__steered_")).toEqual([]);
	});

	describe.each(["Map", "Set", "WeakMap", "WeakSet", "WeakRef", "Promise", "Symbol"])(
		"with the global %s replaced after slothlet loaded",
		(name) => {
			it("still hands a view of another module's instance and refuses the write through it", async () => {
				api = await mount({ mode, runtime, permissions: { policy: "allow", caller: { attribution } } });
				// The same outcome as with nothing replaced: the views slothlet makes rest on the constructors it loaded with.
				expect(await api.reader.steeredConstructor(`__ctor_${name}_`, name)).toEqual({
					reached: "both",
					data: "LOOSE_SET_NOT_OWNED",
					made: "LOOSE_SET_NOT_OWNED"
				});
				expect(await api.owner.landed(`__ctor_${name}_`)).toEqual([]);
			});

			it("still refuses a call a rule denies", async () => {
				const rules = [{ caller: "reader.**", target: "owner.fresh", effect: "deny" }];
				api = await mount({ mode, runtime, permissions: { policy: "allow", caller: { attribution }, rules } });
				expect(await api.reader.steeredConstructor(`__ctor_denied_${name}_`, name)).toEqual({ reached: "PERMISSION_DENIED" });
			});
		}
	);
});
