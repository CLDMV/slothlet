/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-self-call-identity.test.vitest.mjs
 *	@Date: 2026-11-11T15:00:00-08:00 (1794438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T15:00:00-08:00 (1794438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Each access of a member expression is checked as the code making it. `self.a.b()` is three accesses
 * (the `self` read, the member read, the call), and the identity one of them was checked under is never the answer
 * for an access other code makes: a getter on the path, a function handed the view, an argument expression, the
 * callee, a timer, another call running at the same time.
 *
 * @description
 * Fixture `api_test_self_call_identity`. Rules: everything is denied the vault except `ally` and the vault itself.
 * `gate` (denied) leaves functions of its own on a plain object both modules import, a route slothlet does not see,
 * and `ally` runs them inside its own calls. Expected values come from the rules. With `provenance` on, a module's
 * code running inside another module's call runs as that module with the call as its ceiling, so both have to be
 * allowed: `gate`'s code is refused wherever it makes the access, and `ally`'s own accesses around it go through.
 * With `provenance` off, code runs with the permissions of the call that runs it. A view or member `ally` kept is
 * held to `ally` and to whoever uses it, so `gate` is refused through it in every configuration.
 *
 * @module tests/vitests/suites/permissions/permissions-self-call-identity
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_self_call_identity/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";
const DATA = "DATA";
const RULES = [
	{ caller: "**", target: "vault.**", effect: "deny" },
	{ caller: "ally.**", target: "vault.**", effect: "allow" },
	{ caller: "vault.**", target: "vault.**", effect: "allow" }
];

const VARIANTS = [
	{ label: "default", permissions: {}, provenance: true },
	{ label: "capture off", permissions: { references: { capture: false } }, provenance: true },
	{ label: "provenance off", permissions: { provenance: false }, provenance: false }
];
const MATRIX = [];
for (const variant of VARIANTS)
	for (const attribution of ["precise", "fast"])
		for (const mode of ["eager", "lazy"])
			for (const runtime of ["async", "live"])
				MATRIX.push({ name: `${variant.label}, ${attribution} ${mode}/${runtime}`, variant, attribution, mode, runtime });

describe.each(MATRIX)("Permissions > who makes each access of a member expression > $name", ({ variant, attribution, mode, runtime }) => {
	let api;
	// What another module's code gets when it makes the access inside a call of the allowed module.
	const foreign = (allowed) => (variant.provenance ? DENIED : allowed);

	beforeAll(async () => {
		api = await slothlet({
			base: DIR,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", attribution, rules: RULES, ...variant.permissions }
		});
		// Load every file, so a lazy node answers as an eager one.
		await api.vault.get();
		await api.gate.post();
		await api.ally.post();
		await api.gate.tryVault();
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it("checks the allowed module's own expressions as that module, every time", async () => {
		expect(await api.ally.probe("call")).toBe(SECRET);
		expect(await api.ally.probe("read")).toBe(DATA);
		expect(await api.ally.probe("repeat")).toEqual([SECRET, DATA, SECRET, DATA, SECRET, DATA]);
	});

	it("checks the denied module's own expressions as that module, every time", async () => {
		for (let round = 0; round < 3; round++) {
			expect(await api.gate.probe("call")).toBe(DENIED);
			expect(await api.gate.probe("read")).toBe(DENIED);
			expect(await api.ally.probe("call")).toBe(SECRET);
		}
	});

	it("checks another module's function handed the view as that module, with nothing of slothlet's run in between", async () => {
		expect(await api.ally.probe("lentView")).toBe(foreign(SECRET));
		expect(await api.ally.probe("lentViewRead")).toBe(foreign(DATA));
		expect(await api.ally.probe("lentMember")).toBe(foreign(SECRET));
		expect(await api.ally.probe("microtaskForeign")).toBe(foreign(SECRET));
	});

	it("checks the rest of an expression as the module that wrote it after another module's function looked into the view", async () => {
		expect(await api.ally.probe("peekThenOwn")).toEqual([foreign(DATA), SECRET]);
	});

	it("checks a getter on the path as its own module, and the read around it as the reader", async () => {
		expect(await api.ally.probe("getterOnPath")).toEqual([DENIED, SECRET]);
	});

	it("checks a call made in an argument expression as its own module, and the call around it as the caller", async () => {
		expect(await api.ally.probe("argument")).toEqual([DENIED, SECRET]);
	});

	it("checks code the callee runs as the module that wrote it", async () => {
		expect(await api.ally.probe("callbackOwn")).toBe(SECRET);
		expect(await api.ally.probe("callbackForeign")).toBe(foreign(SECRET));
	});

	it("checks a member the allowed module kept as that module in its own timer and microtask", async () => {
		expect(await api.ally.probe("timerOwn")).toBe(SECRET);
		expect(await api.ally.probe("microtaskOwn")).toBe(SECRET);
	});

	it("refuses the denied module through a view or member the allowed module kept", async () => {
		expect(await api.gate.probe("useKept")).toBe(DENIED);
		expect(await api.gate.probe("useKeptRead")).toBe(DENIED);
		expect(await api.gate.probe("useKeptMember")).toBe(DENIED);
		// The allowed module's own use right after is still its own.
		expect(await api.ally.probe("call")).toBe(SECRET);
	});

	it("runs a callback pinned with lockCaller as the module that pinned it, whoever calls it", async () => {
		expect(await api.gate.probe("allyLent")).toBe(SECRET);
		expect(await api.ally.probe("gateLent")).toBe(DENIED);
	});

	it("tells overlapping calls of the two modules apart", async () => {
		const jobs = [];
		for (let i = 0; i < 4; i++) jobs.push(api.ally.slow(1 + (i % 2)), api.gate.slow(2 - (i % 2)));
		const results = await Promise.all(jobs);
		for (let i = 0; i < results.length; i++) {
			expect(results[i]).toEqual(i % 2 === 0 ? [SECRET, DATA, SECRET] : [DENIED, DENIED, DENIED]);
		}
	});
});
