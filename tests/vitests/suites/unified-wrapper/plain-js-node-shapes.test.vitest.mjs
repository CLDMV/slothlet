/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/plain-js-node-shapes.test.vitest.mjs
 *	@Date: 2026-11-05T08:19:57-08:00 (1793895597)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T10:28:22-08:00 (1793903302)
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
 * rule still refuses a call reached through a reported prototype or an instance's class.
 * @module tests/vitests/suites/unified-wrapper/plain-js-node-shapes
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import util from "node:util";
import slothlet from "@cldmv/slothlet";
import {
	reads,
	refreeze,
	freezeLater,
	frozenAtLoad,
	ownerWrites,
	refreezeAtLoad
} from "../../../../api_tests/api_test_plain_js_nodes_lib/cases.mjs";

const FIXTURE = resolve("api_tests/api_test_plain_js_nodes");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on", permissions: {} },
	{ name: "permissions on, capture off", permissions: { references: { capture: false } } }
];

const DENY_READER = { defaultPolicy: "allow", rules: [{ caller: "reader.**", target: "owner.**", effect: "deny" }] };

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
			// The prototype of the module's class is withheld from it, so it reaches none of the class's methods that way.
			expect(outcome.instancePrototypeMethod).toMatch(/^threw (TypeError|PERMISSION_DENIED)$/);
			// The same holds for an instance whose class the module keeps to itself, however its prototype is reached.
			expect(outcome.hiddenPrototypeMethod).toMatch(/^threw (TypeError|PERMISSION_DENIED)$/);
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
