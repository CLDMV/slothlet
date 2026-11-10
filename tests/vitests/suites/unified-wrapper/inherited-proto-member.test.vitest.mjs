/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/inherited-proto-member.test.vitest.mjs
 *	@Date: 2026-11-04T22:51:34-08:00 (1793861494)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-07T00:02:08-08:00 (1794038528)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `__proto__` and `constructor` read through an api node keep a module class's prototype behind the
 * node's checks (#630).
 *
 * @description
 * An inherited `__proto__` answers the engine's own prototypes (`Object.prototype`, `Function.prototype`) as the
 * plain value does. A prototype that is the module's code — a class instance's class prototype, the base class a
 * derived class extends — is still the module's: a module the rules deny the owner cannot call through it, and no
 * write through it reaches the owner's real prototype. With permissions off there is no rule to refuse such a write, so
 * it lands as it does in plain JS; with permissions on and no rules a module mounted on its own still writes only the paths it owns.
 * Checked in eager and lazy mode, async and live runtime, with permissions off, on with no rules, and with the deny rule.
 * @module tests/vitests/suites/unified-wrapper/inherited-proto-member
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_inherited_members_proto");
const INHERITED_BASE = resolve("api_tests/api_test_inherited_members");
/** A base holding neither the victim nor the attacker, for mounting them as modules of their own. */
const HOST_BASE = resolve("api_tests/api_test_plain_js_nodes/host");

let twinCount = 0;
/**
 * The victim module imported as plain JS: a new module instance each time, untouched by any slothlet instance.
 * @returns {Promise<object>} Its namespace.
 */
const plainVictim = () => import(`${pathToFileURL(join(BASE, "victim", "victim.mjs")).href}?plain=${++twinCount}`);

/**
 * The attacker's writes through `__proto__` (see `attacker/attacker.mjs`), made on a plain import of the victim, which
 * then reports its real prototypes: what plain JS does with them.
 * @returns {Promise<object>} The plain victim's `check()` afterwards.
 */
async function plainAttack() {
	const victim = await plainVictim();
	victim.inst.__proto__.secret = () => "replaced";
	Object.defineProperty(victim.inst.__proto__, "added", { value: 1, configurable: true });
	victim.Derived.__proto__.added = 1;
	return victim.check();
}

const DENY_VICTIM = { defaultPolicy: "allow", rules: [{ caller: "attacker.**", target: "victim.**", effect: "deny" }] };

const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	// The base module owns every path it loads, so the victim and the attacker are mounted as modules of their own here:
	// otherwise the attacker would own the victim's paths too.
	{ name: "permissions on, no rules, modules mounted apart", permissions: {}, apart: true },
	{ name: "deny rule", permissions: DENY_VICTIM }
];

const UNCHANGED_FOO = ["constructor", "secret"];
const UNCHANGED_BASE = ["kind", "length", "name", "prototype"];

describe.each(
	["eager", "lazy"].flatMap((mode) => ["async", "live"].flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))))
)(
	"__proto__ and constructor of a module's class through an api node > $mode / $runtime, $name",
	({ mode, runtime, permissions, apart }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const load = async () => {
			if (apart) {
				api = await slothlet({ base: HOST_BASE, mode, runtime, silent: true, permissions });
				await api.slothlet.api.add("victim", join(BASE, "victim"), { moduleID: "victim" });
				await api.slothlet.api.add("attacker", join(BASE, "attacker"), { moduleID: "attacker" });
			} else {
				api = await slothlet({ base: BASE, mode, runtime, ...(permissions ? { permissions } : {}) });
			}
			await api.victim;
			await api.victim.inst;
			await api.victim.Derived;
			await api.attacker;
			return api;
		};

		it("changes the owner's real class prototype through __proto__ only as the permissions allow", async () => {
			await load();
			const outcomes = await api.attacker.run();
			const real = await api.victim.check();
			if (permissions) {
				expect(real.fooMembers).toEqual(UNCHANGED_FOO);
				expect(real.secret).toBe("secret");
			} else {
				// With permissions off no write rule stands between modules, so the writes land on the owner's prototype as
				// they do in plain JS.
				const plainReal = await plainAttack();
				expect(real.fooMembers).toEqual(plainReal.fooMembers);
				expect(real.secret).toBe(plainReal.secret);
			}
			// `constructor` of a class instance's node is its class, as on the plain instance. A module the rules deny the
			// owner reads the class's prototype as a call of the node, so it is refused it, as through an exported class.
			const plain = await plainVictim();
			expect(outcomes.readConstructorPrototype).toBe(
				permissions === DENY_VICTIM ? "threw PERMISSION_DENIED" : typeof plain.inst.constructor.prototype.secret
			);
		});

		if (permissions === DENY_VICTIM) {
			it("denies the denied module every read, call and write through __proto__", async () => {
				await load();
				const outcomes = await api.attacker.run();
				expect(outcomes).toEqual({
					readProtoMember: "threw PERMISSION_DENIED",
					callProtoMember: "threw PERMISSION_DENIED",
					assignProtoMember: "threw PERMISSION_DENIED",
					defineProtoMember: "threw PERMISSION_DENIED",
					readConstructorPrototype: "threw PERMISSION_DENIED",
					assignBaseStatic: "threw PERMISSION_DENIED",
					callBaseStatic: "threw PERMISSION_DENIED"
				});
				expect((await api.victim.check()).baseMembers).toEqual(UNCHANGED_BASE);
			});
		}

		if (apart) {
			it("lets a module read and call through __proto__ but refuses its writes to the paths it does not own", async () => {
				await load();
				const outcomes = await api.attacker.run();
				const plain = await plainVictim();
				// Reads and calls are allowed, as in plain JS; the writes are writes to the owner's paths, which the module does
				// not own.
				expect(outcomes).toEqual({
					readProtoMember: typeof plain.inst.__proto__.secret,
					callProtoMember: plain.inst.__proto__.secret(),
					assignProtoMember: "threw LOOSE_SET_NOT_OWNED",
					defineProtoMember: "threw LOOSE_SET_NOT_OWNED",
					readConstructorPrototype: typeof plain.inst.constructor.prototype.secret,
					assignBaseStatic: "threw LOOSE_SET_NOT_OWNED",
					callBaseStatic: plain.Derived.__proto__.kind()
				});
				expect((await api.victim.check()).baseMembers).toEqual(UNCHANGED_BASE);
			});
		}

		it("still answers the engine's own prototypes through __proto__", async () => {
			const inherited = await slothlet({ base: INHERITED_BASE, mode, runtime, ...(permissions ? { permissions } : {}) });
			try {
				await inherited.obj;
				await inherited.obj.box;
				await inherited.obj.named;
				expect(inherited.obj.box.__proto__ === Object.prototype).toBe(true);
				expect(inherited.obj.named.__proto__ === Function.prototype).toBe(true);
			} finally {
				await inherited.shutdown();
			}
		});
	}
);
