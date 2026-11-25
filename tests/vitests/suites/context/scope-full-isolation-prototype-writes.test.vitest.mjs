/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/scope-full-isolation-prototype-writes.test.vitest.mjs
 *	@Date: 2026-11-18T00:00:00-08:00 (1794988800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:04-08:00 (1795536484)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A full-isolation run's changes to a class prototype a node holds, and to a node's prototype and
 * extensibility, stay in the run, and are checked as the same writes are outside it.
 *
 * @description
 * Module code (`prober`) writes the victim's class prototype (`self.victim.v.Account.prototype`), makes an instance and
 * reads the write back through it, then sets the prototype of the victim's `conf` node and closes it
 * (`preventExtensions`, `seal`, `freeze`). Inside `run()`:
 *
 * - with permissions off, and on with a host write grant, each step answers as the same steps on a plain-JS copy of the
 *   class and object do (the reference), and the instance is unchanged afterwards;
 * - on with no grant, each write is refused with the code it gets outside any run, and the instance is unchanged.
 *
 * `isolation: "partial"` shares the instance's `self`: the same writes reach the instance, as they do outside a run.
 *
 * Fixture: `api_tests/api_test_self_write_reach/api` and `api_test_self_write_reach_victim/api` and `api_tests/api_test_run_prototype_writes/prober`.
 */
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync, apiPart } from "../../setup/vitest-helper.mjs";
import { classWritesOn, shapeChangesOn } from "../../../../api_tests/api_test_run_prototype_writes/prober/p.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const PROBER = path.resolve(FIXTURE, "..", "api_test_run_prototype_writes", "prober");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const GRANT = [
	{ caller: "prober.**", target: "victim.**:write", effect: "allow" },
	{ caller: "prober.**", target: "victim:write", effect: "allow" }
];

/**
 * A plain-JS copy of the victim's class: what each step on the class answers in plain JS.
 * @returns {Function} The class.
 */
function plainAccount() {
	return class Account {
		balance() {
			return 100;
		}
		get label() {
			return "account";
		}
	};
}

/**
 * A plain-JS copy of the victim's `conf`.
 * @returns {object} The object.
 */
function plainConf() {
	return {
		get level() {
			return 1;
		}
	};
}

const CLASS_TWIN = classWritesOn(plainAccount());
const SHAPE_TWIN = shapeChangesOn(plainConf());

/**
 * Expect the instance's class and `conf` to be as the victim made them.
 * @param {object} api - The api.
 * @returns {void}
 */
function expectHostUnchanged(api) {
	const prototype = api.victim.v.Account.prototype;
	expect(Object.hasOwn(prototype, "granted")).toBe(false);
	expect(Object.hasOwn(prototype, "added")).toBe(false);
	expect(Object.getPrototypeOf(api.victim.v.conf)).toBe(Object.prototype);
	expect(Object.isExtensible(api.victim.v.conf)).toBe(true);
	expect(Object.isFrozen(api.victim.v.conf)).toBe(false);
	expect(api.victim.v.conf.level).toBe(1);
}

describe.each(CONFIGS)("full-isolation run: prototype and shape writes — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim` and `prober`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = {}) {
		api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", apiPart(FIXTURE, "victim"), { id: "victim" });
		await api.slothlet.api.add("prober", PROBER, { id: "prober" });
		return api;
	}

	describe.each([
		["permissions off", {}],
		["permissions on, a host write grant", { permissions: { rules: GRANT } }]
	])("%s", (_label, options) => {
		it("writes a class prototype in the run as on a plain-JS copy, and leaves the instance's class unchanged", async () => {
			await load(options);
			const seen = await api.slothlet.context.run({}, () => api.prober.p.classWrites());
			expect(seen).toEqual(CLASS_TWIN);
			expectHostUnchanged(api);
			// The instance's class answers the same steps as a fresh copy does: nothing the run wrote is there.
			expect(api.prober.p.classWrites()).toEqual(CLASS_TWIN);
		});

		it("sets a node's prototype and closes it in the run as on a plain-JS copy, and leaves the instance's node open", async () => {
			await load(options);
			const seen = await api.slothlet.context.run({}, () => api.prober.p.shapeChanges());
			expect(seen).toEqual(SHAPE_TWIN);
			expectHostUnchanged(api);
		});

		it("keeps an instance the victim makes an instance of the class the run reads", async () => {
			await load(options);
			expect(
				await api.slothlet.context.run({}, () => {
					api.prober.p.classWrites();
					return api.prober.p.madeIsInstance();
				})
			).toBe(true);
		});

		it('isolation: "partial" shares the instance: the writes reach it, as outside a run', async () => {
			await load(options);
			const partial = (fn) => api.slothlet.context.scope({ context: {}, isolation: "partial", fn });
			const seen = await partial(() => api.prober.p.classWrites());
			expect(seen.write).toBe("done");
			expect(seen.readBack).toBe(1);
			expect(typeof api.victim.v.Account.prototype.added).toBe("function");
			const shape = await partial(() => api.prober.p.shapeChanges());
			expect(shape.freeze).toBe("done");
			expect(Object.isFrozen(api.victim.v.conf)).toBe(true);
		});
	});

	describe("permissions on, no grant", () => {
		it("refuses the class prototype writes in the run as outside it", async () => {
			await load({ permissions: {} });
			const outside = withSuppressedSlothletErrorOutputSync(() => api.prober.p.classWrites());
			expect(outside.write).toBe("LOOSE_SET_NOT_OWNED");
			const seen = await api.slothlet.context.run({}, () => withSuppressedSlothletErrorOutputSync(() => api.prober.p.classWrites()));
			expect(outside.prototypeOfInstance).toBe(true);
			expect(seen).toEqual(outside);
			expectHostUnchanged(api);
		});

		it("refuses the prototype and extensibility changes in the run as outside it", async () => {
			await load({ permissions: {} });
			const outside = withSuppressedSlothletErrorOutputSync(() => api.prober.p.shapeChanges());
			for (const step of ["otherProto", "preventExtensions", "seal", "freeze"]) expect(outside[step]).toBe("LOOSE_SET_NOT_OWNED");
			const seen = await api.slothlet.context.run({}, () => withSuppressedSlothletErrorOutputSync(() => api.prober.p.shapeChanges()));
			expect(seen).toEqual(outside);
			expectHostUnchanged(api);
		});
	});
});
