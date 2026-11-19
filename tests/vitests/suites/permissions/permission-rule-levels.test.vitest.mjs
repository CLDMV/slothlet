/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permission-rule-levels.test.vitest.mjs
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
 * @fileoverview Rule access levels, decided by the rule manager: a target's suffix names what the rule governs.
 *
 * | suffix    | call | read | write |
 * | `:call`   | ✓    |      |       |
 * | `:read`   |      | ✓    |       |
 * | `:access` | ✓    | ✓    |       |
 * | `:write`  |      | ✓    | ✓     |
 * | `:full`   | ✓    | ✓    | ✓     |
 *
 * No suffix is `:access`. An allow grants its row. A deny takes its row away, except that a `:write` deny takes away
 * the write only; a deny that takes away the read takes away the write too, which the write gate holds (a write needs
 * the read), so the write rules here see `:write` and `:full` alone. Each operation is decided by the rules whose level
 * covers it, most specific first, as before.
 */

import { describe, it, expect, afterEach } from "vitest";
import { PermissionManager } from "#handlers/permission-manager";
import { SlothletError } from "@cldmv/slothlet/errors";
import { namesSlothletMember } from "#helpers/slothlet-tree";

const LEVELS = {
	call: { call: true, read: false, write: false },
	read: { call: false, read: true, write: false },
	access: { call: true, read: true, write: false },
	write: { call: false, read: true, write: true },
	full: { call: true, read: true, write: true }
};

const READ = { operation: "read" };
const ACCESS = { operation: "access" };

describe("Permissions > rule access levels > the rule manager", () => {
	/** @type {PermissionManager[]} */
	const managers = [];

	afterEach(async () => {
		for (const manager of managers.splice(0)) await manager.shutdown();
	});

	/**
	 * A manager with the system on, holding `rules` in the order given.
	 * @param {Array<object>} rules - Rules.
	 * @param {string} [policy="allow"] - The default policy.
	 * @returns {PermissionManager} The manager.
	 */
	const build = (rules, policy = "allow") => {
		const manager = new PermissionManager({
			config: { permissions: { mode: "on", policy } },
			handlers: {},
			debug() {},
			SlothletError
		});
		managers.push(manager);
		for (const rule of rules) manager.addRule(rule);
		return manager;
	};

	/**
	 * What the manager answers `caller` for each operation on `target`.
	 * @param {PermissionManager} manager - The manager.
	 * @param {string} target - The api path.
	 * @param {string} [caller="guest.probe"] - The caller's api path.
	 * @returns {{call: boolean, read: boolean, write: string|null}} The answers.
	 */
	const answers = (manager, target, caller = "guest.probe") => ({
		call: manager.checkAccess(caller, target),
		read: manager.checkAccess(caller, target, null, null, null, READ),
		write: manager.decideWrite(caller, target)
	});

	describe.each(Object.entries(LEVELS))(":%s", (level, row) => {
		it("an allow grants exactly its row under policy deny", () => {
			const manager = build([{ caller: "guest.**", target: `cache.*:${level}`, effect: "allow" }], "deny");
			expect(answers(manager, "cache.key")).toEqual({ call: row.call, read: row.read, write: row.write ? "grant" : null });
			// Another caller and another path get nothing from it.
			expect(answers(manager, "cache.key", "other.probe")).toEqual({ call: false, read: false, write: null });
			expect(answers(manager, "store.key")).toEqual({ call: false, read: false, write: null });
		});

		it("a deny takes its row away under policy allow; a :write deny leaves the read", () => {
			const manager = build([{ caller: "guest.**", target: `cache.*:${level}`, effect: "deny" }]);
			expect(answers(manager, "cache.key")).toEqual({
				call: !row.call,
				read: !(row.read && level !== "write"),
				write: row.write ? "deny" : null
			});
		});

		it("access is allowed only when the call and the read both are", () => {
			const allowed = build([{ caller: "guest.**", target: `cache.*:${level}`, effect: "allow" }], "deny");
			expect(allowed.checkAccess("guest.probe", "cache.key", null, null, null, ACCESS)).toBe(row.call && row.read);
			const denied = build([{ caller: "guest.**", target: `cache.*:${level}`, effect: "deny" }]);
			expect(denied.checkAccess("guest.probe", "cache.key", null, null, null, ACCESS)).toBe(!row.call && level === "write");
		});
	});

	it("a target with no suffix is :access", () => {
		for (const effect of ["allow", "deny"]) {
			const policy = effect === "allow" ? "deny" : "allow";
			const bare = build([{ caller: "guest.**", target: "cache.*", effect }], policy);
			const access = build([{ caller: "guest.**", target: "cache.*:access", effect }], policy);
			expect(answers(bare, "cache.key")).toEqual(answers(access, "cache.key"));
			expect(answers(bare, "cache.key").write).toBe(null);
		}
	});

	it("decides each operation by the most specific rule that covers it", () => {
		// cache.* (no suffix = access) deny is more specific than cache.**:write allow: the read is refused, and the
		// write gate refuses the write it would otherwise grant.
		const broad = build([
			{ caller: "guest.**", target: "cache.**:write", effect: "allow" },
			{ caller: "guest.**", target: "cache.*", effect: "deny" }
		]);
		expect(answers(broad, "cache.key")).toEqual({ call: false, read: false, write: "grant" });
		// cache.key:write allow is more specific than cache.* deny: the read and the write are allowed, the call is not.
		const narrow = build([
			{ caller: "guest.**", target: "cache.key:write", effect: "allow" },
			{ caller: "guest.**", target: "cache.*", effect: "deny" }
		]);
		expect(answers(narrow, "cache.key")).toEqual({ call: false, read: true, write: "grant" });
		expect(answers(narrow, "cache.other")).toEqual({ call: false, read: false, write: null });
		// In the other order too.
		const reversed = build([
			{ caller: "guest.**", target: "cache.*", effect: "deny" },
			{ caller: "guest.**", target: "cache.key:write", effect: "allow" }
		]);
		expect(answers(reversed, "cache.key")).toEqual({ call: false, read: true, write: "grant" });
	});

	it("lets a narrower :call allow open the call under a broader :full deny, and nothing else", () => {
		const manager = build([
			{ caller: "guest.**", target: "cache.**:full", effect: "deny" },
			{ caller: "guest.**", target: "cache.fn:call", effect: "allow" }
		]);
		expect(answers(manager, "cache.fn")).toEqual({ call: true, read: false, write: "deny" });
	});

	it("lets a :full deny beat a broader :write grant for the write and the read", () => {
		const manager = build([
			{ caller: "guest.**", target: "cache.**:write", effect: "allow" },
			{ caller: "guest.**", target: "cache.key:full", effect: "deny" }
		]);
		expect(answers(manager, "cache.key")).toEqual({ call: false, read: false, write: "deny" });
		expect(answers(manager, "cache.other")).toEqual({ call: true, read: true, write: "grant" });
	});

	it("counts :full as a write rule for the subtree verdict behind the checked view", () => {
		expect(build([{ caller: "reader.**", target: "owner.**:full", effect: "allow" }]).writeSubtree("reader.x", "owner.Foo.prototype")).toBe(
			"grant"
		);
		expect(
			build([
				{ caller: "reader.**", target: "owner.**:full", effect: "allow" },
				{ caller: "reader.**", target: "owner.Foo.prototype.hi:full", effect: "deny" }
			]).writeSubtree("reader.x", "owner.Foo.prototype")
		).toBe("deny");
		// A level without the write is no write rule.
		expect(
			build([{ caller: "reader.**", target: "owner.**:access", effect: "allow" }]).writeSubtree("reader.x", "owner.Foo.prototype")
		).toBe(null);
		expect(build([{ caller: "reader.**", target: "owner.**:read", effect: "deny" }]).writeSubtree("reader.x", "owner.Foo.prototype")).toBe(
			null
		);
	});

	it("names :full rules among the write rules of a caller, and no other level", () => {
		const manager = build([
			{ caller: "reader.**", target: "owner.**:access", effect: "allow" },
			{ caller: "reader.**", target: "owner.**:read", effect: "deny" }
		]);
		const before = manager.writeRulesFor("reader.x");
		manager.addRule({ caller: "reader.**", target: "owner.**:full", effect: "allow" });
		expect(manager.writeRulesFor("reader.x")).not.toBe(before);
		expect(manager.writeRulesFor("other.x")).toBe(before);
	});

	it("lets a :full allow lift a built-in write rule as a :write allow does", () => {
		const manager = build([{ caller: "config.**", target: "slothlet.featureFlags:full", effect: "allow" }]);
		expect(manager.decideWrite("config.x", "slothlet.featureFlags")).toBe("grant");
		expect(manager.decideWrite("other.x", "slothlet.featureFlags")).toBe("deny");
		expect(manager.isWriteGranted("config.x", "slothlet.featureFlags")).toBe(true);
	});

	it("keeps hook rules hook rules", () => {
		const manager = build([{ caller: "auditor.**", target: "db.*:before", effect: "deny" }]);
		expect(manager.checkHookAccess("auditor.x", "db.read", "before")).toBe(false);
		expect(manager.checkHookAccess("auditor.x", "db.read", "after")).toBe(true);
		expect(answers(manager, "db.read", "auditor.x")).toEqual({ call: true, read: true, write: null });
	});

	it("accepts every level in slothlet's space where the path names a member, and :full where :write is", () => {
		for (const level of ["call", "read", "access", "write", "full"]) {
			expect(namesSlothletMember(`slothlet.hook.on:${level}`)).toBe(true);
			expect(namesSlothletMember(`slothlet.nope.**:${level}`)).toBe(level === "write" || level === "full");
		}
		const manager = build([]);
		expect(() => manager.addRule({ caller: "**", target: "slothlet.featureFlags:full", effect: "allow" })).not.toThrow();
		expect(() => manager.addRule({ caller: "**", target: "slothlet.featureFlags:read", effect: "allow" })).toThrow(
			expect.objectContaining({ code: "PERMISSION_RULE_UNKNOWN_TARGET" })
		);
	});

	it("refuses a level on a capability", () => {
		const manager = build([]);
		for (const level of ["call", "read", "access", "write", "full"]) {
			expect(() => manager.addRule({ caller: "**", target: `capability:code:${level}`, effect: "allow" })).toThrow(
				expect.objectContaining({ code: "PERMISSION_RULE_UNKNOWN_TARGET" })
			);
		}
	});

	it("leaves an unknown suffix a rule on the literal target, which matches no api path, as before", () => {
		const manager = build([{ caller: "guest.**", target: "cache.key:bogus", effect: "deny" }]);
		expect(answers(manager, "cache.key")).toEqual({ call: true, read: true, write: null });
	});

	it("refuses an operation it does not know", () => {
		const manager = build([]);
		expect(() => manager.checkAccess("a.b", "c.d", null, null, null, { operation: "delete" })).toThrow(
			expect.objectContaining({ code: "INVALID_ARGUMENT" })
		);
	});
});
