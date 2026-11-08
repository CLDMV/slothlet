/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/plain-js-node-shapes.test.vitest.mjs
 *	@Date: 2026-11-05T08:19:57-08:00 (1793895597)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T01:03:27-08:00 (1794128607)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Frozen and class members read through an api node answer as the plain values do (#667).
 *
 * @description
 * One module exports frozen objects, a frozen array of frozen objects, a derived class, a class with an exported
 * instance, an instance of a class it keeps to itself, and classes with a static `Symbol.hasInstance`; another module reads them through `self`, and the host
 * reads them through `api`. Every case runs the same code on the node and on a plain import of the same module
 * (see `api_test_plain_js_nodes_lib/cases.mjs`), and the node must answer what the plain value answers, including
 * the same error. Each mode is checked against plain JS, so lazy mode answers as eager mode does. Checked in eager
 * and lazy mode, async and live runtime, with permissions off, on, and on with reference capture off. The write
 * rules still hold where plain JS has none: a module may not freeze or write another module's member, and a deny
 * rule still refuses a call reached through a reported prototype or an instance's class. An instance whose class cannot
 * be told from descriptors answers its prototype alike on every path, behind its own node's check; a subclass
 * instance's chain is checked at each level against the class owning it; and an emitter's prototype answers alike on
 * every path: a module that may call it but does not own it reads and calls through a view that refuses its writes, and
 * one denied it is answered a stand-in, so no write lands on a prototype the module does not own.
 * @module tests/vitests/suites/unified-wrapper/plain-js-node-shapes
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import util from "node:util";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import {
	reads,
	heldReads,
	refreeze,
	freezeLater,
	frozenAtLoad,
	ownerWrites,
	refreezeAtLoad,
	ODD_SHAPES,
	oddShapeReads,
	oddShapeWrites,
	chainReads,
	emitterPrototypes,
	prototypeWrites,
	relayInstanceOf,
	prototypeAnswers,
	IDENTITY_CASES
} from "../../../../api_tests/api_test_plain_js_nodes_lib/cases.mjs";
import { Relay } from "../../../../api_tests/api_test_plain_js_nodes_lib/relay-class.mjs";

const FIXTURE = resolve("api_tests/api_test_plain_js_nodes");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on", permissions: {} },
	{ name: "permissions on, capture off", permissions: { references: { capture: false } } }
];

const DENY_READER = { defaultPolicy: "allow", rules: [{ caller: "reader.**", target: "owner.**", effect: "deny" }] };

/** Grants the reader writes into the owner's subtree, and refuses it nothing. */
const ALLOW_READER_WRITES = { rules: [{ caller: "reader.**", target: "owner.**:write", effect: "allow" }] };

/**
 * The same answer for every instance {@link prototypeAnswers} asks, on every path.
 * @param {string} answer - The answer.
 * @param {object} [overrides] - Answers that differ, by instance name.
 * @returns {object} The answers.
 */
const answering = (answer, overrides = {}) =>
	Object.fromEntries(
		[...IDENTITY_CASES, "subInstBase"].map((name) => {
			const each = overrides[name] ?? answer;
			return [name, { prototypeOf: each, reflect: each, protoAccessor: each }];
		})
	);

/**
 * The owner's instance nodes, by name, for handing to a module as an argument.
 * @param {object} api - The api.
 * @returns {object} The nodes.
 */
const heldInstances = (api) => Object.fromEntries(IDENTITY_CASES.map((name) => [name, api.owner[name]]));

/** Refuses the reader the owner's classes, exported (`Foo`) and kept to itself (reached as `hiddenInst.constructor`), and nothing else. */
const DENY_CLASSES = {
	defaultPolicy: "allow",
	rules: ["owner.Foo", "owner.Foo.**", "owner.hiddenInst.constructor", "owner.hiddenInst.constructor.**"].map((target) => ({
		caller: "reader.**",
		target,
		effect: "deny"
	}))
};

/**
 * The owner's odd-shaped instance nodes, by export name, for handing to the reader as an argument.
 * @param {object} api - The api.
 * @returns {object} The nodes.
 */
const heldOddShapes = (api) => Object.fromEntries(ODD_SHAPES.map((name) => [name, api.owner[name]]));

/** The members the emitter cases write, cleared from the prototypes other cases share. */
const WRITE_KEYS = ["hostWrite", "selfEmitter", "heldEmitter", "selfRelay", "heldRelay", "keptEmitter", "plainEmitter"];

/** A member no other code uses, written onto prototypes to see where the write lands. */
const PROBE_KEY = "__slothlet667PrototypeProbe";

let twinCount = 0;
/**
 * The owner module imported as plain JS: a new module instance each time, untouched by any slothlet instance.
 * @returns {Promise<object>} Its namespace.
 */
const plainOwner = () => import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain=${++twinCount}`);

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

describe.each(MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry })))))(
	"frozen and class nodes > $mode / $runtime / $name",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const load = () => mount({ mode, runtime, ...(permissions ? { permissions } : {}) });

		it("answers each read through self as the plain module does", async () => {
			api = await load();
			const plain = reads(await plainOwner());
			expect(await api.reader.read()).toEqual(plain);
			expect(await api.owner.readOwn()).toEqual(plain);
		});

		it("answers each read through the host's api as the plain module does", async () => {
			api = await load();
			expect(reads(api.owner)).toEqual(reads(await plainOwner()));
		});

		it("re-freezes another module's frozen member as plain JS does", async () => {
			api = await load();
			const plain = await plainOwner();
			freezeLater(plain);
			expect(await api.owner.freezeOwn()).toBe(true);
			expect(await api.reader.refreezeOwner()).toEqual(refreeze(plain));
		});

		it("inspects a frozen member as the plain value", async () => {
			api = await load();
			const plain = await plainOwner();
			freezeLater(plain);
			await api.owner.freezeOwn();
			expect(util.inspect(api.owner.later)).toBe(util.inspect(plain.later));
			expect(util.inspect(api.owner.frozenBox)).toBe(util.inspect(plain.frozenBox));
			expect(util.inspect(api.owner.frozenList)).toBe(util.inspect(plain.frozenList));
		});

		it("answers an object export frozen when it loaded as frozen, as the plain module does", async () => {
			api = await load();
			const plain = frozenAtLoad(await plainOwner());
			expect(await api.reader.readFrozenAtLoad()).toEqual(plain);
			expect(frozenAtLoad(api.owner)).toEqual(plain);
		});

		it("refuses the owner's own write to a member frozen when it loaded, as strict mode does", async () => {
			api = await load();
			const plain = ownerWrites(await plainOwner());
			expect(await api.owner.writeOwnFrozen()).toEqual(plain);
			// The host's write, from this strict-mode file, is refused the same way.
			expect(ownerWrites(api.owner)).toEqual(plain);
		});

		it("re-freezes an object export frozen when it loaded as a no-op", async () => {
			api = await load();
			const plain = await plainOwner();
			expect(await api.reader.refreezeOwnerAtLoad()).toBe(refreezeAtLoad(plain));
			expect(refreezeAtLoad(api.owner)).toBe(refreezeAtLoad(plain));
			expect(frozenAtLoad(api.owner)).toEqual(frozenAtLoad(plain));
		});

		it("reads an instance's prototype through self without running a constructor accessor of the module's", async () => {
			api = await load();
			const plain = await plainOwner();
			const before = await api.owner.constructorReadCount();
			const outcome = await api.reader.readAccessedPrototype();
			const after = await api.owner.constructorReadCount();
			const plainBefore = plain.constructorReadCount();
			const plainProtoAccessorMethod = plain.accessedInst.__proto__.hi.call(plain.accessedInst);
			void Object.getPrototypeOf(plain.accessedInst);
			expect(after - before).toBe(plain.constructorReadCount() - plainBefore);
			expect(outcome.protoAccessorMethod).toBe(plainProtoAccessorMethod);
		});

		it("answers every way of asking an instance whose class cannot be told from descriptors for its prototype as plain JS does", async () => {
			api = await load();
			const plain = oddShapeReads(await plainOwner());
			expect(await api.reader.readOddShapes()).toEqual(plain);
			expect(await api.reader.readHeldOddShapes(heldOddShapes(api))).toEqual(plain);
			expect(oddShapeReads(api.owner)).toEqual(plain);
		});

		// V8's structured serializer refuses every Proxy (`#<Object> could not be cloned`), and a node is one by design: it
		// cannot hand out the module's object itself, which would skip the read and write rules for everything it holds.
		it.todo("clones a frozen export with structuredClone (blocked: V8 refuses to serialize any Proxy)");

		if (permissions) {
			it("refuses another module's changes to members it does not own", async () => {
				api = await load();
				const outcome = await api.reader.change();
				expect(outcome).toEqual({
					freezeOpen: "threw LOOSE_SET_NOT_OWNED",
					writeOpen: "threw LOOSE_SET_NOT_OWNED",
					openValue: 1,
					openFrozen: false
				});
			});
		}
	}
);

describe.each(MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime }))))(
	"frozen and class nodes, deny rule > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("refuses a denied module every call to the module's code, however it reached the class", async () => {
			api = await mount({ mode, runtime, permissions: DENY_READER });
			const outcome = await api.reader.callThrough();
			// Reached through an instance, the class and its prototype are refused exactly as the class read directly is.
			expect(outcome.instanceClassMethod).toBe(outcome.classMethod);
			expect(outcome).toMatchObject({
				baseKind: "threw PERMISSION_DENIED",
				classMethod: "threw PERMISSION_DENIED",
				writeInstanceClassPrototype: "threw PERMISSION_DENIED",
				inheritedCheck: "threw PERMISSION_DENIED"
			});
			// Reaching the prototype of the module's class is a call of the class's node, so it is refused, and the module
			// reaches none of the class's methods that way.
			expect(outcome.instancePrototypeMethod).toBe("threw PERMISSION_DENIED");
			// The same holds for an instance whose class the module keeps to itself, however its prototype is reached.
			expect(outcome.hiddenPrototypeMethod).toBe("threw PERMISSION_DENIED");
			expect(outcome.hiddenProtoAccessorMethod).toBe("threw PERMISSION_DENIED");
			// The owner's class is unchanged.
			const plain = await plainOwner();
			expect(api.owner.inst.hi()).toBe(plain.inst.hi());
			expect(Object.getOwnPropertyNames(api.owner.Foo.prototype).sort()).toEqual(Object.getOwnPropertyNames(plain.Foo.prototype).sort());
		});

		it("still answers instanceof against the class for a denied module, as plain JS does", async () => {
			api = await mount({ mode, runtime, permissions: DENY_READER });
			const plain = await plainOwner();
			expect((await api.reader.callThrough()).instIsFoo).toBe(plain.inst instanceof plain.Foo);
		});
	}
);

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null },
				{ name: "permissions on, no rules", permissions: {} },
				{ name: "classes denied", permissions: DENY_CLASSES }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("a class instance's prototype on a node handed to a module > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("answers it behind its class's checks, as plain JS does where the rules allow", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const outcome = await api.reader.readHeld(api.owner.inst, api.owner.Foo, api.owner.hiddenInst);
		const plain = await plainOwner();
		const plainOutcome = heldReads({ inst: plain.inst, Foo: plain.Foo, hiddenInst: plain.hiddenInst });
		if (permissions !== DENY_CLASSES) {
			expect(outcome).toEqual(plainOutcome);
			return;
		}
		// The class's prototype and its methods are the class's code: reaching them is a call of the class's node,
		// however the instance is asked for its prototype.
		expect(outcome).toEqual({
			...plainOutcome,
			instPrototype: "threw PERMISSION_DENIED",
			instPrototypeMethod: "threw PERMISSION_DENIED",
			instProtoAccessorMethod: "threw PERMISSION_DENIED",
			hiddenPrototype: "threw PERMISSION_DENIED",
			hiddenPrototypeMethod: "threw PERMISSION_DENIED",
			hiddenProtoAccessorMethod: "threw PERMISSION_DENIED"
		});
	});
});

describe.each(MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime }))))(
	"a write onto a withheld class prototype > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
			// A write that reached the realm's own prototype is undone, so it cannot leak into later tests.
			delete Object.prototype[PROBE_KEY];
		});

		const refused = {
			instPrototype: "threw PERMISSION_DENIED",
			instProtoAccessor: "threw PERMISSION_DENIED",
			hiddenPrototype: "threw PERMISSION_DENIED",
			hiddenProtoAccessor: "threw PERMISSION_DENIED",
			reachedObjectPrototype: false
		};

		it("is refused through self, and never lands on Object.prototype", async () => {
			api = await mount({ mode, runtime, permissions: DENY_READER });
			const outcome = await api.reader.writePrototypes(PROBE_KEY);
			expect(Object.hasOwn(Object.prototype, PROBE_KEY)).toBe(false);
			expect(outcome).toEqual(refused);
		});

		it("is refused on nodes handed to the module, and never lands on Object.prototype", async () => {
			api = await mount({ mode, runtime, permissions: DENY_CLASSES });
			const outcome = await api.reader.writeHeldPrototypes(api.owner.inst, api.owner.hiddenInst, PROBE_KEY);
			expect(Object.hasOwn(Object.prototype, PROBE_KEY)).toBe(false);
			expect(outcome).toEqual(refused);
		});
	}
);

/** What a module the rules refuse an instance's prototype gets for each way of asking for it. */
const REFUSED_PROTOTYPE = {
	prototypeMethod: "threw PERMISSION_DENIED",
	reflectPrototypeMethod: "threw PERMISSION_DENIED",
	protoAccessorMethod: "threw PERMISSION_DENIED",
	pathsAgree: "threw PERMISSION_DENIED"
};

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null },
				{ name: "permissions on, no rules", permissions: {} },
				{ name: "classes denied", permissions: DENY_CLASSES },
				{ name: "owner denied", permissions: DENY_READER }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("an instance whose class cannot be told from descriptors > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const load = () => mount({ mode, runtime, ...(permissions ? { permissions } : {}) });

	it("answers its prototype alike by Object.getPrototypeOf, Reflect.getPrototypeOf and __proto__, behind the instance's check", async () => {
		api = await load();
		const plain = oddShapeReads(await plainOwner());
		// The host is refused nothing.
		expect(oddShapeReads(api.owner)).toEqual(plain);
		const throughSelf = await api.reader.readOddShapes();
		const held = await api.reader.readHeldOddShapes(heldOddShapes(api));
		if (permissions !== DENY_READER) {
			// No rule refuses the instance, so every path answers as plain JS does; a rule on the owner's classes does not
			// reach an instance whose class no node stands for.
			expect(throughSelf).toEqual(plain);
			expect(held).toEqual(plain);
			return;
		}
		// The prototype holds the module's code and no class node stands for it: reaching it is a call of the instance's
		// own node, refused however the instance is asked for it, and `__proto__` never becomes a member of its own.
		for (const name of ODD_SHAPES) {
			for (const outcome of [throughSelf[name], held[name]]) {
				expect(outcome).toMatchObject(REFUSED_PROTOTYPE);
				expect(outcome.ownProtoKey).not.toBe(true);
				expect(outcome.inspectShowsProto).toBe(false);
			}
		}
	});

	it("lands a write through its prototype where plain JS does, or refuses it on every path alike", async () => {
		api = await load();
		const plainModule = await plainOwner();
		const plainWrites = oddShapeWrites(plainModule, "plain");
		const runs = [
			["self", () => api.reader.writeOddShapes("self")],
			["held", () => api.reader.writeHeldOddShapes(heldOddShapes(api), "held")]
		];
		for (const [key, run] of runs) {
			const outcome = await run();
			const landed = { get: await api.owner.prototypesHolding(`${key}Get`), proto: await api.owner.prototypesHolding(`${key}Proto`) };
			const plainLanded = { get: plainModule.prototypesHolding("plainGet"), proto: plainModule.prototypesHolding("plainProto") };
			if (permissions === null) {
				// With permissions off no rule stands between modules: both writes reach the instance's real prototype.
				expect(outcome).toEqual(plainWrites);
				expect(landed).toEqual(plainLanded);
				continue;
			}
			for (const name of ODD_SHAPES) {
				expect(outcome[name].protoAccessor).toBe(outcome[name].prototype);
				if (permissions === DENY_READER) expect(outcome[name].prototype).toBe("threw PERMISSION_DENIED");
			}
			// Both paths reach the same prototype, so they land alike, and never on a prototype every object shares.
			expect(landed.get).toEqual(landed.proto);
			expect(landed.get.object).toBe(false);
		}
	});
});

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null },
				{ name: "permissions on, no rules", permissions: {} },
				{ name: "classes denied", permissions: DENY_CLASSES }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("a subclass instance's prototype chain > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("checks each prototype on the chain against the class that owns it", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const plain = chainReads(await plainOwner());
		const throughSelf = await api.reader.readChain();
		const held = await api.reader.readHeldChain(api.owner.subInst, api.owner.FooSub);
		expect(chainReads(api.owner)).toEqual(plain);
		if (permissions !== DENY_CLASSES) {
			expect(throughSelf).toEqual(plain);
			expect(held).toEqual(plain);
			return;
		}
		// The subclass is allowed, its base class is not: the base's prototype is the base's code, refused one level up the
		// chain as it is through the base class's own node.
		const refusedBase = {
			...plain,
			baseByPrototypeOf: "threw PERMISSION_DENIED",
			baseByReflect: "threw PERMISSION_DENIED",
			baseByProtoAccessor: "threw PERMISSION_DENIED",
			baseByMixed: "threw PERMISSION_DENIED",
			baseOfClassPrototype: "threw PERMISSION_DENIED",
			baseOfClassPrototypeAccessor: "threw PERMISSION_DENIED",
			baseClassPrototype: "threw PERMISSION_DENIED"
		};
		expect(throughSelf).toEqual(refusedBase);
		expect(held).toEqual(refusedBase);
	});
});

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null },
				{ name: "permissions on, no rules", permissions: {} },
				{ name: "owner denied", permissions: DENY_READER }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("an emitter's prototype > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		// A write that reached a shared prototype is undone, so it cannot leak into later tests.
		for (const key of WRITE_KEYS) {
			delete EventEmitter.prototype[key];
			delete Object.prototype[key];
			delete Relay.prototype[key];
		}
	});

	/** What a module reading each emitter, on each path, is run as, with the member it writes. */
	const probes = () => [
		["selfEmitter", "bus", () => api.reader.readEmitter("selfEmitter")],
		["heldEmitter", "bus", () => api.reader.readHeldEmitter(api.owner.bus, "heldEmitter")],
		["selfRelay", "relay", () => api.reader.readRelay("selfRelay")],
		["heldRelay", "relay", () => api.reader.readHeldEmitter(api.owner.relay, "heldRelay")]
	];

	it("answers each path as this case requires, and lands a write only as plain JS would for the case that allows it", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const plainModule = await plainOwner();
		const plain = { bus: emitterPrototypes(plainModule.bus, "plainEmitter"), relay: emitterPrototypes(plainModule.relay, "plainEmitter") };
		for (const [key, emitter, run] of probes()) {
			const outcome = await run();
			const landed = await api.owner.prototypesHolding(key);
			expect(landed.emitter, key).toBe(false);
			expect(landed.object, key).toBe(false);
			if (permissions === null) {
				// With permissions off nothing here is refused, so the answers are plain JS's.
				expect(outcome, key).toEqual(plain[emitter]);
				expect(landed[emitter], key).toBe(true);
				continue;
			}
			expect(landed[emitter], key).toBe(false);
			if (permissions === DENY_READER) {
				// A module denied the emitter is reported the nearest prototype holding none of the module's code, on every
				// path, and a write meant for the emitter's class is refused rather than landing on that shared prototype.
				expect(outcome, key).toEqual({
					pathsAgree: true,
					prototypeName: "EventEmitter",
					reflectName: "EventEmitter",
					protoAccessorName: "EventEmitter",
					pingByPrototype: "threw TypeError",
					pingByReflect: "threw TypeError",
					pingByProtoAccessor: "threw TypeError",
					instanceOfEmitter: true,
					prototypeInstanceOfEmitter: true,
					parentIsEmitterPrototype: true,
					writePrototype: "threw PERMISSION_DENIED",
					writeReflect: "threw PERMISSION_DENIED",
					writeProtoAccessor: "threw PERMISSION_DENIED"
				});
				continue;
			}
			// A module that may call the emitter but does not own it reads and calls as plain JS does, and is refused the write.
			expect(outcome, key).toEqual({
				...plain[emitter],
				writePrototype: "threw LOOSE_SET_NOT_OWNED",
				writeReflect: "threw LOOSE_SET_NOT_OWNED",
				writeProtoAccessor: "threw LOOSE_SET_NOT_OWNED"
			});
		}
	});

	it("holds a node a module kept to the same answers, used from outside any call", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const kept = await api.reader.keepEmitter();
		const outcome = await kept("keptEmitter");
		const landed = await api.owner.prototypesHolding("keptEmitter");
		expect(landed.emitter).toBe(false);
		expect(landed.bus).toBe(permissions === null);
		if (permissions !== null) expect(outcome.pathsAgree).toBe(true);
	});

	it("tests instanceof through the node, and against the class itself only as the module may hold its prototype", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const plainModule = await plainOwner();
		const plain = relayInstanceOf(plainModule.relay, plainModule.Relay, Relay);
		expect(plain).toEqual({ byNode: true, byOwnConstructor: true, byImport: true, identityByImport: true });
		const throughSelf = await api.reader.relayClassTests();
		const held = await api.reader.heldRelayClassTests(api.owner.relay, api.owner.Relay);
		if (permissions === null) {
			expect(throughSelf).toEqual(plain);
			expect(held).toEqual(plain);
		} else {
			// Identity against the raw class would need a path back to its raw prototype, which a module not owning it never gets.
			const expected = {
				byNode: true,
				byOwnConstructor: true,
				byImport: false,
				identityByImport: false
			};
			expect(throughSelf).toEqual(expected);
			expect(held).toEqual(expected);
		}
	});

	it("keeps its own answers for the owner and for the host", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		expect(await api.owner.ownEmitterIdentity()).toEqual({
			busPrototype: true,
			busReflect: true,
			busAccessor: true,
			relayPrototype: true,
			relayReflect: true,
			relayAccessor: true
		});
		await api.owner.relay;
		// This file's own `Relay` is a copy of the class the modules hold, so the host compares with the class's node.
		expect(Object.getPrototypeOf(api.owner.relay)).toBe(api.owner.Relay.prototype);
		expect(Reflect.getPrototypeOf(api.owner.relay)).toBe(api.owner.Relay.prototype);
		expect(Object.getPrototypeOf(api.owner.bus).constructor.name).toBe("Bus");
	});
});

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			["freeze", "seal", "preventExtensions"].flatMap((closing) =>
				[
					{ name: "permissions off", permissions: null },
					{ name: "permissions on, no rules", permissions: {} },
					{ name: "owner denied", permissions: DENY_READER }
				].map((entry) => ({ mode, runtime, closing, ...entry }))
			)
		)
	)
)("a closed emitter's prototype > $mode / $runtime / $closing / $name", ({ mode, runtime, closing, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		for (const key of WRITE_KEYS) delete Relay.prototype[key];
	});

	/** Build the instance and close both of the owner's emitters, as the host. */
	const load = async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		await api.owner.bus;
		await api.owner.relay;
		Object[closing](api.owner.bus);
		Object[closing](api.owner.relay);
	};

	it("holds a write through its prototype to the rule an open emitter's is held to, on every path", async () => {
		await load();
		const plainModule = await plainOwner();
		const plain = { bus: emitterPrototypes(plainModule.bus, "plainEmitter"), relay: emitterPrototypes(plainModule.relay, "plainEmitter") };
		for (const [key, emitter, run] of [
			["selfEmitter", "bus", () => api.reader.readEmitter("selfEmitter")],
			["heldEmitter", "bus", () => api.reader.readHeldEmitter(api.owner.bus, "heldEmitter")],
			["selfRelay", "relay", () => api.reader.readRelay("selfRelay")],
			["heldRelay", "relay", () => api.reader.readHeldEmitter(api.owner.relay, "heldRelay")]
		]) {
			const outcome = await run();
			const landed = await api.owner.prototypesHolding(key);
			if (permissions === null) {
				expect(outcome, key).toEqual(plain[emitter]);
				expect(landed[emitter], key).toBe(true);
				continue;
			}
			expect(landed[emitter], key).toBe(false);
			if (permissions === DENY_READER) {
				// A closed node reports one prototype to every reader: reaching it is refused to a module denied the node.
				for (const step of ["prototypeName", "reflectName", "protoAccessorName", "writePrototype", "writeReflect", "writeProtoAccessor"]) {
					expect(outcome[step], `${key} ${step}`).toBe("threw PERMISSION_DENIED");
				}
				continue;
			}
			expect(outcome, key).toEqual({
				...plain[emitter],
				writePrototype: "threw LOOSE_SET_NOT_OWNED",
				writeReflect: "threw LOOSE_SET_NOT_OWNED",
				writeProtoAccessor: "threw LOOSE_SET_NOT_OWNED"
			});
		}
	});

	it("keeps the owner's own answers through self, and the host may still read and write through what it reports", async () => {
		await load();
		expect(await api.owner.ownEmitterIdentity()).toEqual({
			busPrototype: true,
			busReflect: true,
			busAccessor: true,
			relayPrototype: true,
			relayReflect: true,
			relayAccessor: true
		});
		const prototype = Object.getPrototypeOf(api.owner.relay);
		expect(prototype.constructor.name).toBe("Relay");
		expect(prototype.ping()).toBe("relay");
		prototype.hostWrite = 1;
		expect((await api.owner.prototypesHolding("hostWrite")).relay).toBe(true);
		delete prototype.hostWrite;
		expect((await api.owner.prototypesHolding("hostWrite")).relay).toBe(false);
	});
});

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null, off: true },
				{ name: "permissions on, no rules", permissions: {}, off: false },
				{ name: "permissions on, capture off", permissions: { references: { capture: false } }, off: false },
				{ name: "reader's writes allowed", permissions: ALLOW_READER_WRITES, off: false }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("an instance's prototype on a node a module holds > $mode / $runtime / $name", ({ mode, runtime, permissions, off }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("is the object itself to the owner and to the host", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		for (const name of IDENTITY_CASES) await api.owner[name];
		expect(await api.owner.heldPrototypeAnswers(heldInstances(api))).toEqual(answering("object"));
		expect(prototypeAnswers(heldInstances(api))).toEqual(answering("object"));
	});

	it("is the object itself to another module whose writes are allowed, and a checked view to one only allowed the read", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		for (const name of IDENTITY_CASES) await api.owner[name];
		const writes = off || permissions === ALLOW_READER_WRITES;
		expect(await api.reader.heldPrototypeAnswers(heldInstances(api))).toEqual(answering(writes ? "object" : "view"));
	});

	it("refuses another module's write through it while the permission system is on, unless a rule grants the write", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const outcome = await api.reader.writeHeldPrototypes(api.owner.inst, api.owner.hiddenInst, PROBE_KEY);
		const landed = await api.owner.prototypesHolding(PROBE_KEY);
		expect(landed.object).toBe(false);
		if (off || permissions === ALLOW_READER_WRITES) {
			expect(outcome).toEqual(prototypeWrites(await plainOwner(), PROBE_KEY));
			expect(landed.foo).toBe(true);
			return;
		}
		expect(outcome).toEqual({
			instPrototype: "threw LOOSE_SET_NOT_OWNED",
			instProtoAccessor: "threw LOOSE_SET_NOT_OWNED",
			hiddenPrototype: "threw LOOSE_SET_NOT_OWNED",
			hiddenProtoAccessor: "threw LOOSE_SET_NOT_OWNED",
			reachedObjectPrototype: false
		});
		expect(landed.foo).toBe(false);
	});
});

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			["freeze", "seal", "preventExtensions"].flatMap((closing) =>
				[
					{ name: "permissions off", permissions: null, readerGets: "object", writesLand: true },
					{ name: "permissions on, no rules", permissions: {}, readerGets: "view", writesLand: false },
					{ name: "reader's writes allowed", permissions: ALLOW_READER_WRITES, readerGets: "object", writesLand: true }
				].map((entry) => ({ mode, runtime, closing, ...entry }))
			)
		)
	)
)(
	"a closed emitter's prototype for each reader > $mode / $runtime / $closing / $name",
	({ mode, runtime, closing, permissions, readerGets, writesLand }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
			for (const key of WRITE_KEYS) delete Relay.prototype[key];
		});

		const load = async () => {
			api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
			for (const name of IDENTITY_CASES) await api.owner[name];
			Object[closing](api.owner.bus);
			Object[closing](api.owner.relay);
		};

		it("is the object itself through self to the owner and to a module whose writes are allowed, and a view to one only allowed the read", async () => {
			await load();
			expect(await api.owner.ownPrototypeAnswers()).toEqual(answering("object"));
			expect(await api.reader.readPrototypeAnswers()).toEqual(answering(readerGets));
		});

		it("is one view to every holder of the node, the host and the owner among them, since a closed node reports one prototype", async () => {
			await load();
			const emitters = { bus: "view", relay: "view" };
			expect(prototypeAnswers(heldInstances(api))).toEqual(answering("object", emitters));
			expect(await api.owner.heldPrototypeAnswers(heldInstances(api))).toEqual(answering("object", emitters));
			expect(await api.reader.heldPrototypeAnswers(heldInstances(api))).toEqual(answering(readerGets, emitters));
		});

		it("lands a write as plain JS does where the module's writes are allowed, and refuses it otherwise", async () => {
			await load();
			const plainModule = await plainOwner();
			const plain = {
				bus: emitterPrototypes(plainModule.bus, "plainEmitter"),
				relay: emitterPrototypes(plainModule.relay, "plainEmitter")
			};
			for (const [key, emitter, run] of [
				["selfEmitter", "bus", () => api.reader.readEmitter("selfEmitter")],
				["heldEmitter", "bus", () => api.reader.readHeldEmitter(api.owner.bus, "heldEmitter")],
				["selfRelay", "relay", () => api.reader.readRelay("selfRelay")],
				["heldRelay", "relay", () => api.reader.readHeldEmitter(api.owner.relay, "heldRelay")]
			]) {
				const outcome = await run();
				const landed = await api.owner.prototypesHolding(key);
				expect(landed.emitter, key).toBe(false);
				if (writesLand) {
					expect(outcome, key).toEqual(plain[emitter]);
					expect(landed[emitter], key).toBe(true);
					continue;
				}
				expect(outcome, key).toEqual({
					...plain[emitter],
					writePrototype: "threw LOOSE_SET_NOT_OWNED",
					writeReflect: "threw LOOSE_SET_NOT_OWNED",
					writeProtoAccessor: "threw LOOSE_SET_NOT_OWNED"
				});
				expect(landed[emitter], key).toBe(false);
			}
		});
	}
);

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) => ["freeze", "seal", "preventExtensions"].map((closing) => ({ mode, runtime, closing })))
	)
)(
	"an emitter closed while permissions are off, with permissions turned on after > $mode / $runtime / $closing",
	({ mode, runtime, closing }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
			for (const key of [...WRITE_KEYS, "beforeSelf", "beforeHeld"]) delete Relay.prototype[key];
		});

		it("refuses a module not owning it the write it allowed before, through self and on the node handed to it", async () => {
			api = await mount({ mode, runtime });
			await api.owner.bus;
			await api.owner.relay;
			Object[closing](api.owner.bus);
			Object[closing](api.owner.relay);
			const plainModule = await plainOwner();
			const plain = {
				bus: emitterPrototypes(plainModule.bus, "plainEmitter"),
				relay: emitterPrototypes(plainModule.relay, "plainEmitter")
			};
			// While the system is off, nothing is refused.
			expect(await api.reader.readEmitter("beforeSelf")).toEqual(plain.bus);
			expect(await api.reader.readHeldEmitter(api.owner.relay, "beforeHeld")).toEqual(plain.relay);
			expect((await api.owner.prototypesHolding("beforeSelf")).bus).toBe(true);
			expect((await api.owner.prototypesHolding("beforeHeld")).relay).toBe(true);
			api.slothlet.permissions.control.enable();
			for (const [key, emitter, run] of [
				["selfEmitter", "bus", () => api.reader.readEmitter("selfEmitter")],
				["heldEmitter", "bus", () => api.reader.readHeldEmitter(api.owner.bus, "heldEmitter")],
				["selfRelay", "relay", () => api.reader.readRelay("selfRelay")],
				["heldRelay", "relay", () => api.reader.readHeldEmitter(api.owner.relay, "heldRelay")]
			]) {
				expect(await run(), key).toEqual({
					...plain[emitter],
					writePrototype: "threw LOOSE_SET_NOT_OWNED",
					writeReflect: "threw LOOSE_SET_NOT_OWNED",
					writeProtoAccessor: "threw LOOSE_SET_NOT_OWNED"
				});
				const landed = await api.owner.prototypesHolding(key);
				expect(landed[emitter], key).toBe(false);
				expect(landed.emitter, key).toBe(false);
			}
			expect(await api.owner.ownPrototypeAnswers()).toEqual(answering("object"));
		});
	}
);

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null, readerGets: "object" },
				{ name: "permissions on, no rules", permissions: {}, readerGets: "view" },
				{ name: "permissions on, capture off", permissions: { references: { capture: false } }, readerGets: "view" },
				{ name: "reader's writes allowed", permissions: ALLOW_READER_WRITES, readerGets: "object" }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("an open node's prototype read through self > $mode / $runtime / $name", ({ mode, runtime, permissions, readerGets }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("is the object itself to the owner and to a module whose writes are allowed, and a checked view to one only allowed the read", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		for (const name of IDENTITY_CASES) await api.owner[name];
		expect(await api.owner.ownPrototypeAnswers()).toEqual(answering("object"));
		expect(await api.reader.readPrototypeAnswers()).toEqual(answering(readerGets));
	});
});

/** The owner's class instances the closed-instance cases close, as the host. */
const CLOSED_INSTANCES = ["inst", "hiddenInst", "subInst"];

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			["freeze", "seal", "preventExtensions"].flatMap((closing) =>
				[
					{ name: "permissions off", permissions: null, readerGets: "object", writesLand: true },
					{ name: "permissions on, no rules", permissions: {}, readerGets: "view", writesLand: false },
					{ name: "reader's writes allowed", permissions: ALLOW_READER_WRITES, readerGets: "object", writesLand: true },
					{ name: "classes denied", permissions: DENY_CLASSES, readerGets: null, writesLand: false }
				].map((entry) => ({ mode, runtime, closing, ...entry }))
			)
		)
	)
)(
	"a closed node holding a class instance (#725) > $mode / $runtime / $closing / $name",
	({ mode, runtime, closing, permissions, readerGets, writesLand }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
			delete Object.prototype[PROBE_KEY];
		});

		/** Build the instance, and close the owner's class instances as the host. */
		const load = async () => {
			api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
			for (const name of IDENTITY_CASES) await api.owner[name];
			for (const name of CLOSED_INSTANCES) Object[closing](api.owner[name]);
		};

		/** The owner module imported as plain JS, its class instances closed as the host closed the nodes. */
		const plainClosed = async () => {
			const plain = await plainOwner();
			for (const name of CLOSED_INSTANCES) Object[closing](plain[name]);
			return plain;
		};

		it("reports the instance's prototype to the host, with its methods and instanceof as plain JS has them", async () => {
			await load();
			const plain = heldReads(await plainClosed());
			const held = heldReads({ inst: api.owner.inst, Foo: api.owner.Foo, hiddenInst: api.owner.hiddenInst });
			// A closed node reports one prototype to everyone holding it, a view standing as the node does, so the host
			// compares it with the class's own prototype by what it reads rather than by identity.
			expect({ ...held, instPrototype: true, hiddenPrototype: true }).toEqual(plain);
			for (const name of CLOSED_INSTANCES) {
				for (const prototype of [
					Object.getPrototypeOf(api.owner[name]),
					Reflect.getPrototypeOf(api.owner[name]),
					api.owner[name].__proto__
				]) {
					expect(prototype, name).not.toBeNull();
					expect(prototype.constructor.name, name).toBe(Object.getPrototypeOf((await plainOwner())[name]).constructor.name);
				}
			}
		});

		it("is the object itself to the owner through self, and to another module through self as its standing gives it", async () => {
			await load();
			expect(await api.owner.ownPrototypeAnswers()).toEqual(answering("object"));
			const throughSelf = await api.reader.readPrototypeAnswers();
			if (readerGets !== null) {
				expect(throughSelf).toEqual(answering(readerGets));
				return;
			}
			const refused = "threw PERMISSION_DENIED";
			for (const name of ["inst", "hiddenInst"]) {
				expect(throughSelf[name], name).toEqual({ prototypeOf: refused, reflect: refused, protoAccessor: refused });
			}
		});

		it("answers a module the instance's prototype through self and on the node handed to it as plain JS does, behind its class's checks", async () => {
			await load();
			const plain = heldReads(await plainClosed());
			const throughSelf = await api.reader.read();
			const plainReads = reads(await plainClosed());
			const held = await api.reader.readHeld(api.owner.inst, api.owner.Foo, api.owner.hiddenInst);
			if (permissions !== DENY_CLASSES) {
				expect(throughSelf).toEqual(plainReads);
				// A closed node reports its shell's prototype to every holder: compared by what it reads.
				expect({ ...held, instPrototype: true, hiddenPrototype: true }).toEqual(plain);
				return;
			}
			expect(held).toEqual({
				...plain,
				instPrototype: "threw PERMISSION_DENIED",
				instPrototypeMethod: "threw PERMISSION_DENIED",
				instProtoAccessorMethod: "threw PERMISSION_DENIED",
				hiddenPrototype: "threw PERMISSION_DENIED",
				hiddenPrototypeMethod: "threw PERMISSION_DENIED",
				hiddenProtoAccessorMethod: "threw PERMISSION_DENIED"
			});
		});

		it("lands a write through the prototype as plain JS does where the module's writes are allowed, and refuses it otherwise", async () => {
			await load();
			const outcome = await api.reader.writeHeldPrototypes(api.owner.inst, api.owner.hiddenInst, PROBE_KEY);
			const landed = await api.owner.prototypesHolding(PROBE_KEY);
			expect(landed.object).toBe(false);
			if (writesLand) {
				expect(outcome).toEqual(prototypeWrites(await plainOwner(), PROBE_KEY));
				expect(landed.foo).toBe(true);
				return;
			}
			const refusal = permissions === DENY_CLASSES ? "threw PERMISSION_DENIED" : "threw LOOSE_SET_NOT_OWNED";
			expect(outcome).toEqual({
				instPrototype: refusal,
				instProtoAccessor: refusal,
				hiddenPrototype: refusal,
				hiddenProtoAccessor: refusal,
				reachedObjectPrototype: false
			});
			expect(landed.foo).toBe(false);
		});
	}
);

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null, writesLand: true },
				{ name: "permissions on, no rules", permissions: {}, writesLand: false },
				{ name: "permissions on, capture off", permissions: { references: { capture: false } }, writesLand: false },
				{ name: "reader's writes allowed", permissions: ALLOW_READER_WRITES, writesLand: true }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("a prototype the owner holds as itself, handed on > $mode / $runtime / $name", ({ mode, runtime, permissions, writesLand }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("reaches another module as reading it would, so a write the module may not make there is refused", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const outcome = await api.reader.writeHandedPrototypes(PROBE_KEY);
		const landed = {
			returned: await api.owner.takeFromPrototype(`${PROBE_KEY}Returned`),
			boxed: await api.owner.takeFromPrototype(`${PROBE_KEY}Boxed`),
			argument: await api.owner.takeFromPrototype(`${PROBE_KEY}Argument`)
		};
		if (writesLand) {
			expect(outcome).toEqual({ returned: "written", boxed: "written", argument: "written" });
			expect(landed).toEqual({ returned: true, boxed: true, argument: true });
			return;
		}
		const refused = "threw LOOSE_SET_NOT_OWNED";
		expect(outcome).toEqual({ returned: refused, boxed: refused, argument: refused });
		expect(landed).toEqual({ returned: false, boxed: false, argument: false });
	});
});
