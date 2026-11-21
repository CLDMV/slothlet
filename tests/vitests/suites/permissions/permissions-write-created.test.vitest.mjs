/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-write-created.test.vitest.mjs
 *	@Date: 2026-11-17T12:03:43-08:00 (1794945823)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T12:10:38-08:00 (1794946238)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Writing beneath a denied data object, and the owner of a member a module creates at runtime (#888).
 *
 * Two modules are mounted at one point, `p`: `A` (`a/store.mjs` → `p.store.*`, `a/peer.mjs` → `p.peer.*`) and `B`
 * (`b/maker.mjs` → `p.maker.*`).
 *
 * - A deny naming an object member of a module's data exactly covers reads of what it holds; a write beneath it is
 *   refused the same way, so writing is never easier than reading.
 * - A member a module creates is its own, as a member it loads is: it reads, replaces and deletes it under
 *   `policy: "deny"` with the owner grant, another module may not, removing the module removes it, and a full reload
 *   does not keep it.
 *
 * Fixture: `api_tests/api_test_write_created` — `a/`, `b/`; the base module is `api_test_self_write_reach/base`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_WRITE_CREATED;
const BASE = path.join(TEST_DIRS.API_TEST_SELF_WRITE_REACH, "base");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

/** Every write `B` makes beneath `A`'s `data` (see `b/maker.mjs`). */
const DATA_WRITES = ["assign", "define", "remove", "reflect", "held", "nested", "heldNested", "create"];

/** The writes that change `p.store.data.x`. */
const X_WRITES = ["assign", "define", "reflect", "held"];

const DENY_DATA = { caller: "p.maker.**", target: "p.store.data", effect: "deny" };

const DENY_OWNER = { policy: "deny", owner: true };

/** What `readMade` gives for each kind of created member, before and after `replaceMade`. */
const READ_BACK = { value: "1", fn: "made", obj: "1" };

const every = (names, outcome) => Object.fromEntries(names.map((name) => [name, outcome]));

describe.each(CONFIGS)("writes beneath data, and members a module creates — $mode / $runtime", ({ mode, runtime }) => {
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
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(permissions === undefined ? {} : { permissions }) });
		await api.slothlet.api.add("p", path.join(FIXTURE, "a"), { id: "A" });
		await api.slothlet.api.add("p", path.join(FIXTURE, "b"), { id: "B" });
		return api;
	}

	/**
	 * Make each write beneath `A`'s `data` on a fresh instance and report it with what `data` holds after it.
	 * @param {object|undefined} permissions - The permissions config.
	 * @param {string[]} [names=DATA_WRITES] - The writes.
	 * @returns {Promise<Record<string, {outcome: string, data: object}>>} Outcome and state by write.
	 */
	async function dataWrites(permissions, names = DATA_WRITES) {
		const report = {};
		for (const name of names) {
			await load(permissions);
			const outcome = withSuppressedSlothletErrorOutputSync(() => api.p.maker.dataWrite(name));
			const data = api.p.store.data;
			report[name] = { outcome, data: { x: data.x, y: data.nested.y, fresh: data.fresh } };
		}
		return report;
	}

	const outcomesOf = (report) => Object.fromEntries(Object.entries(report).map(([name, { outcome }]) => [name, outcome]));

	describe("a deny naming a data object covers writes beneath it", () => {
		it("refuses reading beneath the denied object, and leaves an object no rule names readable", async () => {
			await load({ rules: [DENY_DATA] });
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.maker.dataRead())).toEqual({
				data: "PERMISSION_DENIED",
				nested: "PERMISSION_DENIED",
				plain: "1"
			});
		});

		it("refuses every write beneath it and leaves the object as it was", async () => {
			const report = await dataWrites({ rules: [DENY_DATA] });
			expect(outcomesOf(report)).toEqual(every(DATA_WRITES, "PERMISSION_DENIED"));
			for (const { data } of Object.values(report)) expect(data).toEqual({ x: 1, y: 2, fresh: undefined });
		});

		it("lets writes beneath an object no rule names through", async () => {
			await load({ rules: [DENY_DATA] });
			expect(api.p.maker.plainWrite()).toBe("done");
			expect(api.p.store.plain.z).toBe(2);
		});

		it("holds under policy deny with the owner grant and an allow on the module's members", async () => {
			const permissions = { ...DENY_OWNER, rules: [{ caller: "p.maker.**", target: "p.store.**", effect: "allow" }, DENY_DATA] };
			expect(outcomesOf(await dataWrites(permissions))).toEqual(every(DATA_WRITES, "PERMISSION_DENIED"));
			await load(permissions);
			expect(api.p.maker.plainWrite()).toBe("done");
		});

		it("lets a more specific allow beneath the denied object decide its own path, for writes as for reads", async () => {
			const permissions = { rules: [DENY_DATA, { caller: "p.maker.**", target: "p.store.data.x", effect: "allow" }] };
			await load(permissions);
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.maker.dataRead())).toEqual({
				data: "1",
				nested: "PERMISSION_DENIED",
				plain: "1"
			});
			expect(outcomesOf(await dataWrites(permissions, [...X_WRITES, "nested"]))).toEqual({
				...every(X_WRITES, "done"),
				nested: "PERMISSION_DENIED"
			});
		});

		it("leaves the host's writes alone", async () => {
			await load({ rules: [DENY_DATA] });
			api.p.store.data.x = 5;
			expect(api.p.store.data.x).toBe(5);
		});

		it("checks nothing with permissions off", async () => {
			expect(outcomesOf(await dataWrites({ mode: "off", rules: [DENY_DATA] }))).toEqual(every(DATA_WRITES, "done"));
		});
	});

	describe("a member a module creates is its own (#888)", () => {
		it.each(["mount", "node", "own"])("the creator reads, replaces and deletes it, and another module may not: %s", async (where) => {
			for (const kind of ["value", "fn", "obj"]) {
				await load(DENY_OWNER);
				const outcomes = withSuppressedSlothletErrorOutputSync(() => ({
					create: api.p.maker.create(where, kind),
					read: api.p.maker.readMade(where),
					peerRead: api.p.peer.readMade(where),
					peerReplace: api.p.peer.replaceMade(where),
					replace: api.p.maker.replaceMade(where),
					readAgain: api.p.maker.readMade(where),
					remove: api.p.maker.deleteMade(where)
				}));
				expect({ kind, ...outcomes }).toEqual({
					kind,
					create: "done",
					read: READ_BACK[kind],
					peerRead: "PERMISSION_DENIED",
					peerReplace: "PERMISSION_DENIED",
					replace: "done",
					readAgain: "2",
					remove: "done"
				});
				const holder = where === "mount" ? api.p : where === "node" ? api.p.store : api.p.maker;
				expect(holder.made).toBeUndefined();
			}
		});

		it.each(["define", "reflect"])("records the creator for a member created by %s", async (route) => {
			for (const kind of ["value", "obj"]) {
				await load(DENY_OWNER);
				expect(api.p.maker.create("mount", kind, route)).toBe("done");
				expect(api.p.maker.readMade("mount")).toBe("1");
				expect(withSuppressedSlothletErrorOutputSync(() => api.p.peer.readMade("mount"))).toBe("PERMISSION_DENIED");
			}
		});

		it("leaves a deleted member no one's: another module creates it anew as its own", async () => {
			await load(DENY_OWNER);
			expect(api.p.maker.create("mount", "value")).toBe("done");
			expect(api.p.maker.deleteMade("mount")).toBe("done");
			expect(api.p.peer.replaceMade("mount")).toBe("done");
			expect(api.p.peer.readMade("mount")).toBe("peer");
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.maker.readMade("mount"))).toBe("PERMISSION_DENIED");
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.maker.replaceMade("mount"))).toBe("PERMISSION_DENIED");
		});

		it.each(["mount", "node"])("removing the creator removes what it created, and keeps the other module's members: %s", async (where) => {
			for (const kind of ["value", "fn", "obj"]) {
				await load(DENY_OWNER);
				expect(api.p.maker.create(where, kind)).toBe("done");
				await api.slothlet.api.remove("B");
				const holder = where === "mount" ? api.p : api.p.store;
				expect(holder.made).toBeUndefined();
				expect(api.p.store.data.x).toBe(1);
				expect(api.p.maker).toBeUndefined();
				expect(typeof api.p.peer.readMade).toBe("function");
			}
		});

		it("removes only the member a scoped removal names", async () => {
			await load(DENY_OWNER);
			api.p.maker.create("node", "value");
			api.p.maker.create("mount", "value");
			expect(await api.slothlet.api.remove("p.store.made", "B")).toBe(true);
			expect(api.p.store.made).toBeUndefined();
			expect(api.p.made).toBe(1);
			expect(api.p.maker.readMade("mount")).toBe("1");
		});

		it("keeps no member and no owner across a full reload", async () => {
			await load(DENY_OWNER);
			expect(api.p.maker.create("mount", "value")).toBe("done");
			await api.slothlet.reload();
			expect(api.p.made).toBeUndefined();
			expect(api.p.peer.replaceMade("mount")).toBe("done");
			expect(withSuppressedSlothletErrorOutputSync(() => api.p.maker.readMade("mount"))).toBe("PERMISSION_DENIED");
		});
	});
});
