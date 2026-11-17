/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-write-not-easier.test.vitest.mjs
 *	@Date: 2026-11-17T07:50:26-08:00 (1794930626)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:57:38-08:00 (1794931058)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Writing is never easier than accessing: a module may replace, redefine, or delete a member only where
 * it would be allowed to call or read that member.
 *
 * Two modules are mounted at one point, `p`: `A` (`a/shared.mjs` → `p.shared.*`) and `B` (`b/intruder.mjs` →
 * `p.intruder.*`). Modules mounted at one point share its subtree, so the ownership rule lets `B` write under
 * `p.shared`; the permission rules decide whether `B` may call or read `A`'s members there, and a write that replaces
 * one is held to the same answer. A member that does not exist yet takes over nothing: the default policy alone does
 * not refuse creating it, a rule that refuses the writer that path does.
 *
 * Fixture: `api_tests/api_test_write_not_easier` — `a/`, `b/`; the base module is `api_test_self_write_reach/base`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_WRITE_NOT_EASIER;
const BASE = path.join(TEST_DIRS.API_TEST_SELF_WRITE_REACH, "base");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

/** Every write `B` makes to a member of `A`'s, by name (see `b/intruder.mjs`). */
const WRITES = ["assign", "define", "remove", "held", "data", "prototype", "reflect"];

/** The writes that change `p.shared.who`. */
const WHO_WRITES = ["assign", "define", "remove", "held", "reflect"];

const DENY_OWNER = { policy: "deny", owner: true };

describe.each(CONFIGS)("writing is never easier than accessing — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `A` then `B` at `p`.
	 * @param {object|undefined} permissions - The permissions config; undefined for none.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(permissions) {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(permissions === undefined ? {} : { permissions }) });
		await api.slothlet.api.add("p", path.join(FIXTURE, "a"), { id: "A" });
		await api.slothlet.api.add("p", path.join(FIXTURE, "b"), { id: "B" });
		return api;
	}

	/**
	 * Make one write from `B` on a fresh instance and report it with what `A`'s members answer after it.
	 * @param {object|undefined} permissions - The permissions config.
	 * @param {string} name - The write.
	 * @returns {Promise<{outcome: string, who: string, count: *, label: string}>} The write's outcome and `A`'s state.
	 */
	async function writeOnce(permissions, name) {
		await load(permissions);
		const outcome = await withSuppressedSlothletErrorOutput(() => api.p.intruder.write(name));
		const who = typeof api.p.shared.who === "function" ? api.p.shared.who() : String(api.p.shared.who);
		const state = { outcome, who, count: api.p.shared.count, label: new api.p.shared.Box().label() };
		await api.slothlet.shutdown();
		api = null;
		return state;
	}

	/**
	 * Run every write in `names` on a fresh instance each and collect the outcomes.
	 * @param {object|undefined} permissions - The permissions config.
	 * @param {string[]} [names=WRITES] - The writes.
	 * @returns {Promise<Record<string, string>>} Outcome by write.
	 */
	async function outcomes(permissions, names = WRITES) {
		const report = {};
		for (const name of names) report[name] = (await writeOnce(permissions, name)).outcome;
		return report;
	}

	const every = (names, outcome) => Object.fromEntries(names.map((name) => [name, outcome]));

	describe("policy deny with the owner grant, a second module at the same mount point", () => {
		it("refuses the second module a call or read of the first module's members", async () => {
			await load(DENY_OWNER);
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.intruder.access())).toEqual({
				call: "PERMISSION_DENIED",
				read: "PERMISSION_DENIED",
				construct: "PERMISSION_DENIED"
			});
		});

		it("refuses every write that replaces, redefines, or deletes one of them, and leaves them as they were", async () => {
			expect(await outcomes(DENY_OWNER)).toEqual(every(WRITES, "PERMISSION_DENIED"));
			const after = await writeOnce(DENY_OWNER, "assign");
			expect(after).toEqual({ outcome: "PERMISSION_DENIED", who: "a", count: 1, label: "a-box" });
		});

		it("refuses mounting over or removing the first module's members through api.add and api.remove", async () => {
			await load({ ...DENY_OWNER, rules: [{ caller: "p.intruder.**", target: "slothlet.api.**", effect: "allow" }] });
			expect(await withSuppressedSlothletErrorOutput(() => api.p.intruder.addAt("p.shared", path.join(FIXTURE, "b")))).toBe(
				"PERMISSION_DENIED"
			);
			expect(await withSuppressedSlothletErrorOutput(() => api.p.intruder.removeAt("p.shared.who"))).toBe("PERMISSION_DENIED");
			expect(await withSuppressedSlothletErrorOutput(() => api.p.intruder.removeAt("p.shared"))).toBe("PERMISSION_DENIED");
			expect(api.p.shared.who()).toBe("a");
		});

		it("lets the second module create members that do not exist yet, and replace its own", async () => {
			for (const where of ["node", "mount", "own"]) {
				await load(DENY_OWNER);
				expect(await api.p.intruder.add(where)).toBe("done");
				await api.slothlet.shutdown();
				api = null;
			}
			await load(DENY_OWNER);
			expect(await api.p.intruder.writeOwn()).toBe("done");
			expect(api.p.intruder.mine()).toBe("b2");
		});

		it("refuses creating a member where a rule refuses the second module that path", async () => {
			await load({ ...DENY_OWNER, rules: [{ caller: "p.intruder.**", target: "p.shared.**", effect: "deny" }] });
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.intruder.add("node"))).toBe("PERMISSION_DENIED");
			expect(api.p.shared.extra).toBeUndefined();
		});

		it("lets the writes through once a rule lets the second module access the first module's members", async () => {
			const permissions = { ...DENY_OWNER, rules: [{ caller: "p.intruder.**", target: "p.shared.**", effect: "allow" }] };
			expect(await outcomes(permissions)).toEqual(every(WRITES, "done"));
			expect((await writeOnce(permissions, "assign")).who).toBe("b");
		});

		it("holds an explicit write grant to the access the second module would need", async () => {
			const writeOnly = { ...DENY_OWNER, rules: [{ caller: "p.intruder.**", target: "p.shared.**:write", effect: "allow" }] };
			expect(await outcomes(writeOnly, WHO_WRITES)).toEqual(every(WHO_WRITES, "PERMISSION_DENIED"));
			const both = { ...DENY_OWNER, rules: [...writeOnly.rules, { caller: "p.intruder.**", target: "p.shared.who", effect: "allow" }] };
			expect(await outcomes(both, WHO_WRITES)).toEqual(every(WHO_WRITES, "done"));
		});
	});

	describe("policy deny without the owner grant", () => {
		it("refuses the writes as it refuses the access, and lets the second module write its own file's members", async () => {
			expect(await outcomes({ policy: "deny" })).toEqual(every(WRITES, "PERMISSION_DENIED"));
			await load({ policy: "deny" });
			expect(await api.p.intruder.writeOwn()).toBe("done");
			expect(await api.p.intruder.add("mount")).toBe("done");
		});
	});

	describe("policy allow", () => {
		it("lets every write through when no rule refuses the second module", async () => {
			expect(await outcomes({})).toEqual(every(WRITES, "done"));
		});

		it("refuses only the writes to a member a rule refuses the second module", async () => {
			const permissions = { rules: [{ caller: "p.intruder.**", target: "p.shared.who", effect: "deny" }] };
			expect(await outcomes(permissions)).toEqual({ ...every(WHO_WRITES, "PERMISSION_DENIED"), data: "done", prototype: "done" });
		});
	});

	/**
	 * Make one write from `B` on a fresh instance through `intruder[fn]` and report it with what the host reads after.
	 * @param {object|undefined} permissions - The permissions config.
	 * @param {string} fn - `containerWrite` or `shadowWrite`.
	 * @param {string} name - The write.
	 * @returns {Promise<{outcome: string, who: string, call: *, json: string, text: string}>} Its outcome and `A`'s state.
	 */
	async function reachOnce(permissions, fn, name) {
		await load(permissions);
		const outcome = await withSuppressedSlothletErrorOutput(() => api.p.intruder[fn](name));
		const shared = api.p.shared;
		const state = {
			outcome,
			who: typeof shared?.who === "function" ? shared.who() : String(shared?.who),
			call: typeof shared?.who === "function" ? shared.who.call(null) : undefined,
			json: shared?.data === undefined ? "" : JSON.stringify(shared.data),
			text: shared?.Box === undefined ? "" : String(new shared.Box())
		};
		await api.slothlet.shutdown();
		api = null;
		return state;
	}

	/** Every write `B` makes to a node holding `A`'s members (see `b/intruder.mjs`). */
	const CONTAINER_WRITES = ["assign", "define", "remove", "mount"];

	/** Every write `B` makes that shadows a member `A`'s values inherit. */
	const SHADOW_WRITES = ["call", "push", "toJSON", "toString"];

	/** What the host reads of `A`'s members when nothing replaced them. */
	const UNTOUCHED = { who: "a", call: "a", json: '{"list":[1],"v":1}', text: "[object Object]" };

	describe("a write over a node holding members is held to the access of every member beneath it", () => {
		it("refuses replacing, redefining or deleting a node of the first module's under policy deny with the owner grant", async () => {
			for (const name of CONTAINER_WRITES) {
				expect({ name, ...(await reachOnce(DENY_OWNER, "containerWrite", name)) }).toEqual({
					name,
					outcome: "PERMISSION_DENIED",
					...UNTOUCHED
				});
			}
		});

		it("refuses it under policy allow when a rule refuses the second module one member beneath", async () => {
			const permissions = { rules: [{ caller: "p.intruder.**", target: "p.shared.who", effect: "deny" }] };
			for (const name of CONTAINER_WRITES) {
				expect({ name, ...(await reachOnce(permissions, "containerWrite", name)) }).toEqual({
					name,
					outcome: "PERMISSION_DENIED",
					...UNTOUCHED
				});
			}
		});

		it("lets it through when the second module may access every member beneath", async () => {
			const permissions = { ...DENY_OWNER, rules: [{ caller: "p.intruder.**", target: "p.shared.**", effect: "allow" }] };
			const state = await reachOnce(permissions, "containerWrite", "assign");
			expect([state.outcome, state.who]).toEqual(["done", "b"]);
			expect((await reachOnce({}, "containerWrite", "remove")).outcome).toBe("done");
		});

		it("lets the second module replace its own node", async () => {
			await load(DENY_OWNER);
			expect(await api.p.intruder.containerWriteOwn()).toBe("done");
			expect(api.p.intruder.mine()).toBe("b2");
		});
	});

	/** Every write `B` makes to a node holding `A`'s data values (see `b/intruder.mjs`). */
	const HOLDER_WRITES = ["assign", "define", "remove", "data", "freeze", "mount"];

	/**
	 * Make one write from `B` on a fresh instance through `intruder.holderWrite` and report it with `A`'s values after it.
	 * @param {object|undefined} permissions - The permissions config.
	 * @param {string} name - The write.
	 * @returns {Promise<{outcome: string, count: *, v: *, when: *, table: *}>} Its outcome and `A`'s data values.
	 */
	async function holderOnce(permissions, name) {
		await load(permissions);
		const outcome = await withSuppressedSlothletErrorOutput(() => api.p.intruder.holderWrite(name));
		const shared = api.p?.shared;
		const state = {
			outcome,
			count: shared?.count,
			v: shared?.data?.v,
			when: shared?.when?.getTime?.(),
			table: shared?.table?.get?.("k")
		};
		await api.slothlet.shutdown();
		api = null;
		return state;
	}

	/** `A`'s data values when nothing replaced them. */
	const VALUES = { count: 1, v: 1, when: 0, table: 1 };

	describe("a write over a node is held to the read of every data value beneath it", () => {
		it.each([
			["a primitive member", "p.shared.count", "count", HOLDER_WRITES.filter((name) => name !== "data")],
			["a primitive inside a data object", "p.shared.data.v", "v", HOLDER_WRITES],
			["a Date member", "p.shared.when", "when", HOLDER_WRITES.filter((name) => name !== "data")],
			["a Map member", "p.shared.table", "table", HOLDER_WRITES.filter((name) => name !== "data")]
		])("refuses every write that takes over %s a rule refuses the second module", async (_label, target, member, refused) => {
			const permissions = { rules: [{ caller: "p.intruder.**", target, effect: "deny" }] };
			await load(permissions);
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.intruder.read(member))).toBe("PERMISSION_DENIED");
			await api.slothlet.shutdown();
			api = null;
			for (const name of refused) {
				expect({ name, ...(await holderOnce(permissions, name)) }).toEqual({ name, outcome: "PERMISSION_DENIED", ...VALUES });
			}
		});

		it("lets a write over a node through when it takes over no value a rule refuses", async () => {
			const permissions = { rules: [{ caller: "p.intruder.**", target: "p.shared.count", effect: "deny" }] };
			expect((await holderOnce(permissions, "data")).outcome).toBe("done");
			for (const name of HOLDER_WRITES) expect([name, (await holderOnce({}, name)).outcome]).toEqual([name, "done"]);
		});
	});

	describe("shadowing a member the first module's values inherit is a write to an existing member", () => {
		it("refuses every shadowing write under policy deny with the owner grant, and the host reads the first module's values", async () => {
			for (const name of SHADOW_WRITES) {
				expect({ name, ...(await reachOnce(DENY_OWNER, "shadowWrite", name)) }).toEqual({
					name,
					outcome: "PERMISSION_DENIED",
					...UNTOUCHED
				});
			}
		});

		it("refuses shadowing beneath a path a rule refuses the second module under policy allow", async () => {
			const permissions = { rules: [{ caller: "p.intruder.**", target: "p.shared.Box.**", effect: "deny" }] };
			expect(await reachOnce(permissions, "shadowWrite", "toString")).toEqual({ outcome: "PERMISSION_DENIED", ...UNTOUCHED });
		});

		it("lets the shadowing writes through once a rule lets the second module access the first module's members", async () => {
			const permissions = { ...DENY_OWNER, rules: [{ caller: "p.intruder.**", target: "p.shared.**", effect: "allow" }] };
			for (const name of SHADOW_WRITES) expect([name, (await reachOnce(permissions, "shadowWrite", name)).outcome]).toEqual([name, "done"]);
		});
	});

	describe("permissions off or disabled", () => {
		it.each([
			["no permissions config", undefined],
			["mode off", { mode: "off", policy: "deny" }],
			["mode disabled", { mode: "disabled", policy: "deny" }]
		])("leaves every write as it was: %s", async (_label, permissions) => {
			expect(await outcomes(permissions)).toEqual(every(WRITES, "done"));
		});
	});
});
