/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/inherited-proto-member.test.vitest.mjs
 *	@Date: 2026-11-04T22:51:34-08:00 (1793861494)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:54:44-08:00 (1793861684)
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
 * it lands as it does in plain JS. Checked in eager and lazy mode, with the deny rule and with permissions off.
 * @module tests/vitests/suites/unified-wrapper/inherited-proto-member
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_inherited_members_proto");
const INHERITED_BASE = resolve("api_tests/api_test_inherited_members");

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

const UNCHANGED_FOO = ["constructor", "secret"];
const UNCHANGED_BASE = ["kind", "length", "name", "prototype"];

describe.each(["eager", "lazy"].flatMap((mode) => [null, DENY_VICTIM].map((permissions) => ({ mode, permissions }))))(
	"__proto__ and constructor of a module's class through an api node > $mode, permissions $permissions.defaultPolicy",
	({ mode, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const load = async () => {
			api = await slothlet({ base: BASE, mode, ...(permissions ? { permissions } : {}) });
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
				permissions ? "threw PERMISSION_DENIED" : typeof plain.inst.constructor.prototype.secret
			);
		});

		if (permissions) {
			it("denies the denied module a call through __proto__ and a write to the base class", async () => {
				await load();
				const outcomes = await api.attacker.run();
				expect(outcomes.callProtoMember).toBe("threw PERMISSION_DENIED");
				expect(outcomes.assignBaseStatic).toBe("threw PERMISSION_DENIED");
				expect(outcomes.callBaseStatic).toBe("threw PERMISSION_DENIED");
				expect((await api.victim.check()).baseMembers).toEqual(UNCHANGED_BASE);
			});
		}

		it("still answers the engine's own prototypes through __proto__", async () => {
			const inherited = await slothlet({ base: INHERITED_BASE, mode, ...(permissions ? { permissions } : {}) });
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
