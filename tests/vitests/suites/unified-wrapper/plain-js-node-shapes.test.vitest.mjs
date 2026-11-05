/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/plain-js-node-shapes.test.vitest.mjs
 *	@Date: 2026-11-05T06:17:14-08:00 (1793888234)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T08:18:31-08:00 (1793895511)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Frozen and class members read through `self` answer as the plain values do (#667).
 *
 * @description
 * One module exports frozen objects, a frozen array of frozen objects, a derived class, a class instance and classes
 * with a static `Symbol.hasInstance`, and another reads them through `self`. Each read is the one plain JS makes on
 * the values themselves: `Object.isFrozen`, `Object.getPrototypeOf`, a member's descriptor against a read of it,
 * re-freezing a frozen object, the owner writing to its own frozen member, `instanceof`. Checked in eager and lazy
 * mode, async and live runtime, with permissions off, on, and on with reference capture off. The write rules still
 * hold: a module may not freeze or redefine another module's member, and a deny rule still refuses a call reached
 * through a reported prototype.
 * @module tests/vitests/suites/unified-wrapper/plain-js-node-shapes
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import util from "node:util";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_plain_js_nodes");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on", permissions: {} },
	{ name: "permissions on, capture off", permissions: { references: { capture: false } } }
];

const DENY_READER = { defaultPolicy: "allow", rules: [{ caller: "reader.**", target: "owner.**", effect: "deny" }] };

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
	"frozen and class nodes through self > $mode / $runtime / $name",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const load = () => mount({ mode, runtime, ...(permissions ? { permissions } : {}) });

		// Blocked: an object export frozen by its module gives its node an open shell. Giving the node the object's integrity
		// makes both of these hold, but lazy-unloaded-writes.test.vitest.mjs (#653) asserts the host's write to a frozen export
		// lands (`frozenA: 2`) and that `Object.seal` leaves it reading "sealed", so that test has to change first.
		it.todo("refuses the owner's write to its own frozen members, as strict mode does (blocked on lazy-unloaded-writes)");
		it.todo("reports an object export its module froze as frozen (blocked on lazy-unloaded-writes)");

		it("reports a frozen array export frozen", async () => {
			api = await load();
			expect((await api.reader.read()).isFrozenList).toBe(true);
		});

		it("reports an export its module froze through self as frozen", async () => {
			api = await load();
			await api.owner.freezeOwn();
			expect(Object.isFrozen(api.owner.later)).toBe(true);
		});

		it("inspects a frozen export as the object it fronts", async () => {
			api = await load();
			await api.owner.freezeOwn();
			expect(util.inspect(api.owner.frozenBox)).toBe(util.inspect({ a: 1, inner: { b: 2 } }));
			expect(util.inspect(api.owner.frozenList)).toBe(util.inspect([{ deep: 1 }]));
			expect(util.inspect(api.owner.later)).toBe(util.inspect({ q: 1 }));
		});

		it("reports a derived class's base class as its prototype", async () => {
			api = await load();
			expect((await api.reader.read()).subPrototype).toBe(true);
			expect((await api.owner.readOwn()).subPrototype).toBe(true);
			expect(Object.getPrototypeOf(api.owner.Sub) === api.owner.Base).toBe(true);
			expect((await api.reader.read()).inheritedStatic).toBe("base");
		});

		// V8's structured serializer refuses every Proxy (`#<Object> could not be cloned`), and a node is one by design: it
		// cannot hand out the module's object itself, which would skip the read and write rules for everything it holds.
		it.todo("clones a frozen export with structuredClone (blocked: V8 refuses to serialize any Proxy)");

		it("describes a member holding what reading it gives", async () => {
			api = await load();
			const read = await api.reader.read();
			expect(read.descriptorValue).toBe(true);
			expect(read.openDescriptorValue).toBe(true);
		});

		it("re-freezes another module's frozen export as a no-op", async () => {
			api = await load();
			await api.owner.freezeOwn();
			const [, list, later] = await api.reader.refreeze();
			expect([list, later]).toEqual(["ok", "ok"]);
		});

		it("asks a class's inherited static Symbol.hasInstance, as instanceof does", async () => {
			api = await load();
			const read = await api.reader.read();
			expect(read.ownCheck).toEqual([true, false]);
			expect(read.inheritedCheck).toEqual([true, false]);
		});

		// Blocked: a class instance's node answers `constructor` as `Object` and no prototype, and
		// inherited-proto-member.test.vitest.mjs (#630) asserts `inst.constructor.prototype.secret` reads `undefined`.
		// Answering `Foo` as plain JS does makes it read the method, so that test has to change first.
		it.todo("answers a class instance's constructor as its class (blocked on inherited-proto-member's constructor assertion)");

		if (permissions) {
			it("still refuses another module's changes to members it does not own", async () => {
				api = await load();
				const outcome = await api.reader.change();
				expect(outcome.freezeOpen).toBe("threw LOOSE_SET_NOT_OWNED");
				expect(outcome.redefineFrozen).toMatch(/^threw (LOOSE_SET_NOT_OWNED|TypeError)$/);
				expect(outcome.writeFrozen).toMatch(/^threw (LOOSE_SET_NOT_OWNED|TypeError)$/);
				expect(outcome.frozenValue).toBe(1);
				expect(outcome.openFrozen).toBe(false);
			});
		}
	}
);

describe.each(MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime }))))(
	"frozen and class nodes through self, deny rule > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("refuses a denied module a call through the reported prototype and the inherited Symbol.hasInstance", async () => {
			api = await mount({ mode, runtime, permissions: DENY_READER });
			expect(await api.reader.callThrough()).toEqual({ baseKind: "threw PERMISSION_DENIED", inheritedCheck: "threw PERMISSION_DENIED" });
		});
	}
);
