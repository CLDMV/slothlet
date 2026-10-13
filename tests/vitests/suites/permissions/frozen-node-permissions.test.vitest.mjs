/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/frozen-node-permissions.test.vitest.mjs
 *	@Date: 2026-10-12T20:59:52-07:00 (1791863992)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-13T03:54:34-07:00 (1791888874)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Freezing a namespace or array api node keeps its permission checks (#609).
 *
 * @description
 * Fixture `api_test_frozen_permissions`:
 * ```
 * secrets.mjs   key = "SECRET", list = ["a", "b"]
 * rogue.mjs     readSecrets(), readList(list): each read of the member, its descriptor and JSON.stringify
 * ```
 * Rule: `rogue.**` is denied `secrets.**`. A frozen object must report each plain-value member's real
 * value to every reader, so a node whose own target held its members would hand them to the denied
 * caller once frozen. A node's target is a shell, and freezing fixes each member there as an accessor
 * whose getter runs the node's read, permission check included. The host keeps reading live values.
 *
 * @module tests/vitests/suites/permissions/frozen-node-permissions
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_frozen_permissions", import.meta.url).pathname;
const PERMISSIONS = { defaultPolicy: "allow", rules: [{ caller: "rogue.**", target: "secrets.**", effect: "deny" }] };

/**
 * Whether any outcome handed over a protected value.
 * @param {object} outcomes - The reads' outcomes.
 * @param {string} secret - The protected value.
 * @returns {boolean} True when a read gave it.
 */
const leaked = (outcomes, secret) => Object.values(outcomes).some((outcome) => JSON.stringify(outcome.value ?? null).includes(secret));

describe.each(getMatrixConfigs({}))("frozen node permissions (#609) > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a denied caller cannot read a frozen namespace's members, and the host still can", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		expect(leaked(await api.rogue.readSecrets(), "SECRET")).toBe(false);
		Object.freeze(api.secrets);
		expect(Object.isFrozen(api.secrets)).toBe(true);
		const outcomes = await api.rogue.readSecrets();
		expect(leaked(outcomes, "SECRET")).toBe(false);
		expect(outcomes.direct.error).toBe("PERMISSION_DENIED");
		expect(outcomes.descriptor.error).toBe("PERMISSION_DENIED");
		expect(outcomes.json.error).toBe("PERMISSION_DENIED");
		expect(api.secrets.key).toBe("SECRET");
	});

	it("a denied caller cannot read a frozen array member's elements, and the host still can", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		const list = api.secrets.list;
		expect(leaked(await api.rogue.readList(list), '"a"')).toBe(false);
		Object.freeze(list);
		expect(Object.isFrozen(list)).toBe(true);
		const outcomes = await api.rogue.readList(list);
		expect(leaked(outcomes, '"a"')).toBe(false);
		expect(outcomes.direct.error).toBe("PERMISSION_DENIED");
		expect(outcomes.descriptor.error).toBe("PERMISSION_DENIED");
		expect(outcomes.json.error).toBe("PERMISSION_DENIED");
		expect(list[0]).toBe("a");
		expect([...list]).toEqual(["a", "b"]);
	});

	it("serializing a namespace refuses an array element Object.keys() does not list, which JSON.stringify writes", async () => {
		const rules = [{ caller: "rogue.**", target: "secrets.hidden.1", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.secrets;
		const outcome = await api.rogue.serializeSecrets();
		expect(JSON.stringify(outcome.value ?? null)).not.toContain("HIDDEN");
		expect(outcome.error).toBe("PERMISSION_DENIED");
		expect(JSON.parse(JSON.stringify(api.secrets)).hidden).toEqual(["shown", "HIDDEN"]);
	});

	it("serializing a namespace leaves out an array element's leaves at the position the caller may not read, though it may read them at another", async () => {
		const rules = [{ caller: "rogue.**", target: "secrets.shared.1.**", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.secrets;
		const outcome = await api.rogue.serializeSecrets();
		expect(JSON.parse(outcome.value).shared).toEqual([{ v: "SHARED" }, {}]);
		expect(JSON.parse(JSON.stringify(api.secrets)).shared).toEqual([{ v: "SHARED" }, { v: "SHARED" }]);
	});

	it("serializing a member leaves out an object's leaves at the key the caller may not read, though it may read them at another", async () => {
		const rules = [{ caller: "rogue.**", target: "secrets.pair.second.**", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.secrets;
		expect(await api.rogue.serializePair()).toEqual({ first: { v: "SHARED" }, second: {} });
	});

	it("a function an array member holds keeps its reader's identity when called later past an unpatched boundary", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		expect(await api.rogue.callRevealLater()).toBe("armed");
		let outcome = null;
		for (let tries = 0; tries < 200 && !outcome; tries++) {
			outcome = await api.rogue.readRevealLater();
			if (!outcome) await new Promise((resolve) => setTimeout(resolve, 20));
		}
		expect(outcome).toEqual({ error: "PERMISSION_DENIED" });
		expect(api.secrets.labels.reveal()).toBe("y");
	});

	it("an object an array member holds under a key of its own is a member, read-gated like an object's", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		expect(await api.rogue.readLabelsMeta()).toEqual({ error: "PERMISSION_DENIED" });
		expect(api.secrets.labels.meta.note).toBe("META");
	});

	it("an object's symbol-keyed member reads as in plain JS, and is call-gated like its other members", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		const peek = Symbol.for("slothlet.test.peek");
		expect(await api.rogue.callTagged()).toEqual({ error: "PERMISSION_DENIED" });
		expect(api.secrets.tagged[peek]()).toBe("TAGGED");
		expect(peek in api.secrets.tagged).toBe(true);
		expect(Object.getOwnPropertySymbols(api.secrets.tagged)).toEqual([peek]);
	});

	it("a denied caller cannot reach an array member's elements through a function the array holds", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		const labels = api.secrets.labels;
		for (const freeze of [false, true]) {
			if (freeze) Object.freeze(labels);
			const outcomes = await api.rogue.callLabels(labels);
			expect(outcomes.json.error).toBe("PERMISSION_DENIED");
			expect(outcomes.reveal.error).toBe("PERMISSION_DENIED");
			expect(outcomes.symbol.error).toBe("PERMISSION_DENIED");
			expect(JSON.stringify(labels)).toBe('"x"');
			expect(labels.reveal()).toBe("y");
			expect(labels.toJSON).toBe(labels.toJSON);
		}
	});

	it("a function an array holds under two keys is gated at the key it is called by", async () => {
		const rules = [{ caller: "rogue.**", target: "secrets.aliased.denied", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.secrets;
		const aliased = api.secrets.aliased;
		// The allowed key is read first: its stand-in must not serve the denied key.
		expect(aliased.allowed).not.toBe(aliased.denied);
		const outcomes = await api.rogue.callAliased(aliased);
		expect(outcomes.allowed.value).toBe("PEEKED");
		expect(outcomes.denied.error).toBe("PERMISSION_DENIED");
	});

	it("a function an array holds is gated at the path its array sits at now, after the array moved", async () => {
		const rules = [{ caller: "rogue.**", target: "secrets.nested.0.fn", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.secrets;
		const nested = api.secrets.nested;
		const inner = nested[1];
		// Read before the move, so any stand-in made now carries the old position.
		expect(inner.fn).toBeTypeOf("function");
		expect((await api.rogue.callNested(inner)).value).toBe("NESTED");
		nested.reverse();
		try {
			expect((await api.rogue.callNested(inner)).error).toBe("PERMISSION_DENIED");
		} finally {
			nested.reverse();
		}
	});

	it("serializing a namespace holding a sparse array of the largest length fails as it does in plain JavaScript, without walking every index", async () => {
		const rules = [{ caller: "rogue.**", target: "sparse.big.1", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.sparse;
		const started = Date.now();
		const outcome = await api.rogue.serializeSparse();
		expect(outcome).toEqual({ error: "RangeError" });
		expect(Date.now() - started).toBeLessThan(10000);
		expect(() => JSON.stringify({ big: Object.assign(["a", "b"], { length: 4294967295 }) })).toThrow(RangeError);
	});

	it("serializing a namespace checks an element the array only inherits, which JSON.stringify reads", async () => {
		const rules = [{ caller: "rogue.**", target: "inherited.inh.0", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.inherited;
		const outcome = await api.rogue.serializeInherited();
		expect(outcome.error).toBe("PERMISSION_DENIED");
		expect(JSON.stringify(outcome)).not.toContain("SECRET");
	});

	it("serializing a namespace reads an array's element once, and gates the value it reads", async () => {
		const rules = [{ caller: "rogue.**", target: "stateful.flip.0", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.stateful;
		// The getter answers {} on its first read and "SECRET" after: JSON.stringify reads it once, as in plain JS.
		expect(await api.rogue.serializeStateful()).toEqual({ value: '{"flip":[{}]}' });
		// Every later read answers "SECRET", which the rule denies.
		expect(await api.rogue.serializeStateful()).toEqual({ error: "PERMISSION_DENIED" });
	});

	it("serializing a namespace checks an element an array proxy supplies from its get trap, which JSON.stringify reads", async () => {
		const rules = [{ caller: "rogue.**", target: "virtual.virt.0", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.virtual;
		const outcome = await api.rogue.serializeVirtual();
		expect(outcome.error).toBe("PERMISSION_DENIED");
		expect(JSON.stringify(outcome)).not.toContain("SECRET");
	});

	it.each(["string", "symbol"])(
		"a %s-keyed member a denied module took and called past every patched boundary is refused",
		async (kind) => {
			const rules = [{ caller: "rogue.**", target: "tools.**", effect: "deny" }];
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
			await api.tools;
			// Reading the member is itself allowed here: the rule bites on the call.
			// The node is handed to the module by the host, so the module's read of the member is the first that names it.
			expect(await api.rogue.stashTool(api.tools.holder, kind)).toBe("stashed");
			expect(await api.rogue.callStashedLater(kind)).toBe("armed");
			let outcome = null;
			for (let attempt = 0; attempt < 200 && !outcome; attempt++) {
				outcome = await api.rogue.readOutcome(kind);
				if (!outcome) await new Promise((resolve) => setTimeout(resolve, 20));
			}
			expect(outcome).not.toBeNull();
			expect(outcome.ok).toBe(false);
			expect(outcome.code).toMatch(/PERMISSION_DENIED/);
		}
	);

	it("a denied caller cannot read an object element through the array's descriptor", async () => {
		const rules = [{ caller: "rogue.**", target: "objects.items.**", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.objects;
		const outcome = await api.rogue.readObjectElement(api.objects.items);
		expect(outcome.error).toBe("PERMISSION_DENIED");
		expect(api.objects.items[0].secret).toBe("OBJSECRET");
	});

	it("a denied caller cannot call a function the array inherits from its prototype", async () => {
		const rules = [{ caller: "rogue.**", target: "objects.lst.**", effect: "deny" }];
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow", rules } });
		await api.objects;
		const outcome = await api.rogue.callInherited(api.objects.lst);
		expect(outcome.error).toBe("PERMISSION_DENIED");
		expect(api.objects.lst.reveal()).toBe("PROTOSECRET");
	});

	it("the inspect hook on an array member hands a denied caller nothing it may not read", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true, permissions: PERMISSIONS });
		await api.secrets;
		const outcome = await api.rogue.callInspectHook(api.secrets.list);
		expect(JSON.stringify(outcome)).not.toContain('"a"');
		expect(outcome.error).toBe("PERMISSION_DENIED");
	});
});
