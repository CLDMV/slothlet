/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-ambiguous-caller.test.vitest.mjs
 *	@Date: 2026-07-31 12:00:00 -07:00 (1785524400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-31 12:00:00 -07:00 (1785524400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Two different functions of one module, suspended at once, stay told apart.
 *
 * @description
 * Under the live runtime, two calls suspended at once are told apart by reading the stack. That works
 * while a frame names one of them. It stops working when two *different* functions of the same module
 * are suspended and the frame that resumes belongs to neither — a module-private helper, an anonymous
 * arrow, a renamed function. The module is visibly on the stack, but which of its suspended calls is
 * executing genuinely cannot be determined.
 *
 * `gatedSibling` reaches its target through a module-private `attemptWrite()` helper, so the innermost
 * frame carries that helper's name rather than either export — the case most likely to defeat a
 * name-based resolver. It does not: the export is still further up the stack, and resolution finds it.
 *
 * The rules deliberately permit exactly one of the two racing functions. If both were denied outright
 * these would pass whether or not attribution worked, and would prove nothing. The permitted one must
 * succeed and the other must be refused, in the same turn, from the same file.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > ambiguous caller > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Suspend both entry points together, then release them in the same turn.
	 * @param {Function} first - Bound entry point taking a gate.
	 * @param {Function} second - Bound entry point taking a gate.
	 * @returns {Promise<Array>} Both outcomes.
	 */
	const race = async (first, second) => {
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const settled = Promise.all([first(gate), second(gate)]);
		release();
		return await settled;
	};

	it("attributes each function separately when both are suspended in one file", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					// Permits exactly one of the two racing functions, so the pair cannot both pass or both fail
					// by accident — the rule only holds if each is attributed to itself.
					{ caller: "callers.untrustedCaller.gatedDbWrite", target: "db.write.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		const [viaExport, viaHelper] = await race(api.callers.untrustedCaller.gatedDbWrite, api.callers.untrustedCaller.gatedSibling);

		expect(viaExport.ok).toBe(true);
		expect(viaHelper.ok).toBe(false);
		expect(viaHelper.code).toMatch(/PERMISSION_DENIED/);
	});

	it("attributes an internal slothlet.* route the same way", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.untrustedCaller.**", target: "slothlet.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		// The internal namespace is guarded separately from call and read enforcement, so it needs its own
		// proof that concurrent attribution holds there too — that guard reaches the permission system
		// itself, including the switch that turns it off.
		const [viaExport, viaHelper] = await race(api.callers.untrustedCaller.gatedInternalRoute, api.callers.untrustedCaller.gatedSibling);

		// `gatedInternalRoute` is permitted to reach `slothlet.**`; `gatedSibling` targets `db.write`,
		// which nothing grants it.
		expect(viaExport.ok).toBe(true);
		expect(viaHelper.ok).toBe(false);
	});

	it("attributes a third module entering synchronously while two calls are parked", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.dataReader.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		// Park two calls at their awaits. Each is recorded as suspended the moment it returns its
		// promise, so both are in the set before anything below runs.
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const parked = Promise.all([api.callers.untrustedCaller.gatedDbWrite(gate), api.callers.untrustedCaller.gatedSibling(gate)]);

		// While both are parked, a third module from a different file reads a leaf denied to it —
		// synchronously, so it never joins the suspended set and the ambient field freshly names it.
		// The stack names neither parked call, so resolution cannot answer; the field has to. Every
		// wrong answer is visible: no caller reads as host-initiated and the default-allow admits the
		// read, and so would attributing it to the parked module. Only the field's fresh occupant
		// produces the denial.
		let outcome;
		try {
			outcome = { ok: true, value: String(await api.callers.dataReader.readToken()) };
		} catch (err) {
			outcome = { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
		}

		release();
		const [viaExport, viaHelper] = await parked;

		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
		// The parked pair still settle on their own standing, unaffected by the interleaved entry.
		expect(viaExport.ok).toBe(true);
		expect(viaHelper.ok).toBe(true);
	});

	it("still resolves cleanly when the two suspended calls are the same function", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.untrustedCaller.gatedDbWrite", target: "db.write.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		// Two invocations of one function need no disambiguation at all: whichever is executing, the
		// identity is the same. This is the shortcut path, and it must still land on "allowed".
		const [a, b] = await race(api.callers.untrustedCaller.gatedDbWrite, api.callers.untrustedCaller.gatedDbWrite);

		expect(a.ok).toBe(true);
		expect(b.ok).toBe(true);
	});
});
