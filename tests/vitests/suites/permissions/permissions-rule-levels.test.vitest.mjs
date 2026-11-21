/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-rule-levels.test.vitest.mjs
 *	@Date: 2026-11-18T09:00:00-08:00 (1795021200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T09:00:00-08:00 (1795021200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rule access levels on a live instance: a module calls, reads and writes another module's members
 * under rules whose target names a level (`:call`, `:read`, `:access`, `:write`, `:full`, or none, which is `:access`).
 *
 * An allow grants its level's row, a `:write` allow the read with the write. A deny takes its row away, and a write
 * needs the read, so a deny that takes the read away refuses the write too, while a `:write` deny refuses the write
 * alone and a `:call` deny the call alone. `:full` is a write rule wherever a `:write` rule is one: it grants `api.add`
 * writes, and module code registers it for its own subtree only. A getter runs the module's code, so it is listed and
 * read only by a caller whose level has the call as well as the read.
 *
 * Fixture: `api_tests/api_test_permission_levels` — `base/cache.mjs` (`key`, `other`, `fn`), `base/box.mjs` (an
 * object holding `plain` and a getter `computed`), `guest/probe.mjs`
 * (mounted at `guest`, reads, calls and writes by path), `peer/probe.mjs` (the same, from a file of its own),
 * `extra/` (a module the guest mounts).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_permission_levels");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const DENIED = "PERMISSION_DENIED";
const NOT_OWNED = "LOOSE_SET_NOT_OWNED";

/** The write grant on the base module's cache for the guest. */
const GRANT = [
	{ caller: "guest.**", target: "cache.**:write", effect: "allow" },
	{ caller: "guest.**", target: "cache:write", effect: "allow" }
];

describe.each(CONFIGS)("Permissions > rule access levels — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount the guest.
	 * @param {object} permissions - The `permissions` config.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(permissions) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { id: "guest" });
		return api;
	}

	/**
	 * What the guest gets reading `cache.key`, calling `cache.fn`, and writing `cache.key` and `cache.fn`.
	 * @returns {Promise<Record<string, *>>} The outcomes.
	 */
	async function probe() {
		return withSuppressedSlothletErrorOutput(async () => ({
			read: await api.guest.probe.read("cache.key"),
			call: await api.guest.probe.call("cache.fn"),
			write: await api.guest.probe.write("cache.key", 5),
			writeFn: await api.guest.probe.write("cache.fn", () => "replaced")
		}));
	}

	describe("an allow under policy deny grants its row", () => {
		it.each([
			["call", { read: DENIED, call: "fn", write: NOT_OWNED, writeFn: NOT_OWNED }],
			["read", { read: 1, call: DENIED, write: NOT_OWNED, writeFn: NOT_OWNED }],
			["access", { read: 1, call: "fn", write: NOT_OWNED, writeFn: NOT_OWNED }],
			["write", { read: 1, call: DENIED, write: "done", writeFn: "done" }],
			["full", { read: 1, call: "fn", write: "done", writeFn: "done" }]
		])(":%s", async (level, expected) => {
			await load({ policy: "deny", rules: [{ caller: "guest.**", target: `cache.*:${level}`, effect: "allow" }] });
			expect(await probe()).toEqual(expected);
		});

		it("no suffix is :access", async () => {
			await load({ policy: "deny", rules: [{ caller: "guest.**", target: "cache.*", effect: "allow" }] });
			expect(await probe()).toEqual({ read: 1, call: "fn", write: NOT_OWNED, writeFn: NOT_OWNED });
		});
	});

	describe("a deny under a write grant takes its row away, and the write with the read", () => {
		it.each([
			["call", { read: 1, call: DENIED, write: "done", writeFn: "done" }],
			["read", { read: DENIED, call: "fn", write: DENIED, writeFn: DENIED }],
			["access", { read: DENIED, call: DENIED, write: DENIED, writeFn: DENIED }],
			["write", { read: 1, call: "fn", write: DENIED, writeFn: DENIED }],
			["full", { read: DENIED, call: DENIED, write: DENIED, writeFn: DENIED }]
		])(":%s", async (level, expected) => {
			await load({ policy: "allow", rules: [...GRANT, { caller: "guest.**", target: `cache.*:${level}`, effect: "deny" }] });
			expect(await probe()).toEqual(expected);
		});

		it("no suffix is :access", async () => {
			await load({ policy: "allow", rules: [...GRANT, { caller: "guest.**", target: "cache.*", effect: "deny" }] });
			expect(await probe()).toEqual({ read: DENIED, call: DENIED, write: DENIED, writeFn: DENIED });
		});
	});

	describe("conflicts are decided per operation, most specific first", () => {
		it("cache.**:write allow and cache.* deny: the narrower deny refuses the read, so the write too", async () => {
			await load({
				policy: "allow",
				rules: [
					{ caller: "guest.**", target: "cache.**:write", effect: "allow" },
					{ caller: "guest.**", target: "cache.*", effect: "deny" }
				]
			});
			expect(await probe()).toEqual({ read: DENIED, call: DENIED, write: DENIED, writeFn: DENIED });
		});

		it("cache.key:write allow and cache.* deny: the narrower allow lets the key be read and written", async () => {
			await load({
				policy: "allow",
				rules: [
					{ caller: "guest.**", target: "cache.key:write", effect: "allow" },
					{ caller: "guest.**", target: "cache.*", effect: "deny" }
				]
			});
			expect(await probe()).toEqual({ read: 1, call: DENIED, write: "done", writeFn: NOT_OWNED });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.probe.read("cache.other"))).toBe(DENIED);
			expect(api.cache.key).toBe(5);
		});

		it("a :write allow lets a module read and write a variable under policy deny, and nothing beside it", async () => {
			await load({ policy: "deny", rules: [{ caller: "guest.**", target: "cache.key:write", effect: "allow" }] });
			expect(await api.guest.probe.read("cache.key")).toBe(1);
			expect(await api.guest.probe.write("cache.key", 7)).toBe("done");
			expect(await api.guest.probe.read("cache.key")).toBe(7);
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.probe.read("cache.other"))).toBe(DENIED);
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.probe.write("cache.other", 7))).toBe(NOT_OWNED);
		});
	});

	describe("a getter runs the module's code, so reading it is a call", () => {
		it.each([
			["call", { keys: [], computed: DENIED, plain: DENIED }],
			["read", { keys: ["plain"], computed: DENIED, plain: 2 }],
			["access", { keys: ["computed", "plain"], computed: 1, plain: 2 }],
			["write", { keys: ["plain"], computed: DENIED, plain: 2 }],
			["full", { keys: ["computed", "plain"], computed: 1, plain: 2 }]
		])("box.**:%s allow under policy deny", async (level, expected) => {
			await load({ policy: "deny", rules: [{ caller: "guest.**", target: `box.**:${level}`, effect: "allow" }] });
			expect(
				await withSuppressedSlothletErrorOutput(async () => ({
					keys: await api.guest.probe.keys("box"),
					computed: await api.guest.probe.read("box.computed"),
					plain: await api.guest.probe.read("box.plain")
				}))
			).toEqual(expected);
		});
	});

	describe(":full is a write rule", () => {
		it("grants an api.add from module code into another module's subtree", async () => {
			await load({ policy: "allow", rules: [{ caller: "guest.**", target: "cache.**:full", effect: "allow" }] });
			expect(await api.guest.probe.mount("cache.extra", path.join(FIXTURE, "extra"))).toBe("done");
			expect(await api.cache.extra.item.who()).toBe("item");
		});

		it("an :access allow grants no api.add there", async () => {
			await load({ policy: "allow", rules: [{ caller: "guest.**", target: "cache.**:access", effect: "allow" }] });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.probe.mount("cache.extra", path.join(FIXTURE, "extra")))).toBe(
				NOT_OWNED
			);
		});

		it("a :full deny refuses an api.add a broader grant allows", async () => {
			await load({ policy: "allow", rules: [...GRANT, { caller: "guest.**", target: "cache.extra:full", effect: "deny" }] });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.probe.mount("cache.extra", path.join(FIXTURE, "extra")))).toBe(DENIED);
		});
	});

	describe("rules module code registers", () => {
		it("accepts every level for the module's own subtree", async () => {
			await load({ policy: "allow" });
			for (const level of ["call", "read", "access", "write", "full"]) {
				expect(await api.guest.probe.addRule({ caller: "**", target: `guest.probe.read:${level}`, effect: "allow" })).toBe("done");
			}
		});

		it("refuses every level beyond the module's own subtree", async () => {
			await load({ policy: "allow" });
			for (const level of ["call", "read", "access", "write", "full"]) {
				expect(
					await withSuppressedSlothletErrorOutput(() =>
						api.guest.probe.addRule({ caller: "guest.**", target: `cache.**:${level}`, effect: "allow" })
					)
				).toBe("PERMISSION_RULE_INVALID");
				expect(
					await withSuppressedSlothletErrorOutput(() =>
						api.guest.probe.addRule({ caller: "guest.**", target: `slothlet.**:${level}`, effect: "allow" })
					)
				).toBe("PERMISSION_RULE_INVALID");
			}
		});

		it("a module's own :read deny on its subtree refuses another module the write of it, and leaves it the call", async () => {
			await load({ policy: "allow", rules: [{ caller: "**", target: "guest.**:write", effect: "allow" }] });
			await api.slothlet.api.add("other", path.join(FIXTURE, "peer"), { id: "other" });
			expect(await api.guest.probe.addRule({ caller: "other.**", target: "guest.probe.read:read", effect: "deny" })).toBe("done");
			expect(await withSuppressedSlothletErrorOutput(() => api.other.probe.write("guest.probe.read", () => 0))).toBe(DENIED);
			expect(await api.other.probe.call("guest.probe.read")).not.toBe(DENIED);
		});
	});

	describe("targets the host registers", () => {
		it("accepts a level on any api path, and refuses one on a capability", async () => {
			await load({ policy: "allow" });
			for (const level of ["call", "read", "access", "write", "full"]) {
				expect(() => api.slothlet.permissions.rules.add({ caller: "**", target: `cache.key:${level}`, effect: "deny" })).not.toThrow();
				expect(() => api.slothlet.permissions.rules.add({ caller: "**", target: `capability:code:${level}`, effect: "allow" })).toThrow(
					expect.objectContaining({ code: "PERMISSION_RULE_UNKNOWN_TARGET" })
				);
			}
		});

		it("refuses a level other than :write and :full on a slothlet member that is not there", async () => {
			await load({ policy: "allow" });
			for (const level of ["call", "read", "access"]) {
				expect(() => api.slothlet.permissions.rules.add({ caller: "**", target: `slothlet.nope:${level}`, effect: "deny" })).toThrow(
					expect.objectContaining({ code: "PERMISSION_RULE_UNKNOWN_TARGET" })
				);
			}
			for (const level of ["write", "full"]) {
				expect(() =>
					api.slothlet.permissions.rules.add({ caller: "config.**", target: `slothlet.nope:${level}`, effect: "allow" })
				).not.toThrow();
			}
		});

		it("refuses a config rule naming a level on a capability", async () => {
			await expect(
				slothlet({
					base: path.join(FIXTURE, "base"),
					mode,
					runtime,
					silent: true,
					permissions: { rules: [{ caller: "**", target: "capability:code:full", effect: "allow" }] }
				})
			).rejects.toMatchObject({ code: "PERMISSION_RULE_UNKNOWN_TARGET" });
		});
	});
});
