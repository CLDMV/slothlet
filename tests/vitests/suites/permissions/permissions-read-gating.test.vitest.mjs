/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-read-gating.test.vitest.mjs
 *	@Date: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Read-Level Gating > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("default (readGating omitted): inter-module data read is gated", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		// readGating defaults to true — the deny rule gates the property read.
		try {
			await api.callers.dataReader.readToken();
			expect.unreachable("read should have been denied by default");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("readGating: false opts out — data reads are not gated", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				readGating: false,
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		// Opted out — the deny rule (and deny policy) gate calls only, not property reads.
		const result = await api.callers.dataReader.readToken();
		expect(Buffer.isBuffer(result)).toBe(true);
		expect(result.toString()).toBe("super-secret-token");
	});

	it("flag on: denied data read throws PERMISSION_DENIED", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		try {
			await api.callers.dataReader.readToken();
			expect.unreachable("read should have been denied");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("flag on: allowed data read succeeds, unlisted one is still denied", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "allow" }]
			}
		});

		const token = await api.callers.dataReader.readToken();
		expect(Buffer.isBuffer(token)).toBe(true);
		expect(token.length).toBe(18);

		try {
			await api.callers.dataReader.readBytes();
			expect.unreachable("unlisted-target read should have been denied");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("flag on: namespace traversal stays ungated — only the terminal call is gated", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				readGating: true,
				// Allow only the call target — no rules for the `admin` / `admin.manage` segments.
				rules: [{ caller: "callers.**", target: "admin.**", effect: "allow" }]
			}
		});

		// Walking self.admin -> .manage -> .createUser must not require per-segment rules.
		const result = await api.callers.paymentsCaller.callAdmin();
		expect(result.ok).toBe(true);
	});

	it("flag on: external user-code read has no caller context and is exempt", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				readGating: true,
				rules: [{ caller: "**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		// Read directly from test code — no module caller — bypasses gating.
		const token = await api.db.secrets.token;
		expect(Buffer.isBuffer(token)).toBe(true);
		expect(token.toString()).toBe("super-secret-token");
	});

	it("flag on: self-call bypass — a module reads its own file's data value", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				readGating: true,
				rules: [{ caller: "**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		// readOwnToken lives in db/secrets.mjs and reads self.db.secrets.token (same file).
		const result = await api.db.secrets.readOwnToken();
		expect(Buffer.isBuffer(result)).toBe(true);
		expect(result.toString()).toBe("super-secret-token");
	});

	it("flag on: gating still enforced on a cached (second) read of the same value", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny" }]
			}
		});

		try {
			await api.callers.dataReader.readTokenTwice();
			expect.unreachable("read should have been denied");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	// Every primitive value type, in both directions: a deny rule blocks the read,
	// an allow rule lets it through with the value intact.
	// `expected: "symbol"` marker uses a typeof check instead of equality — slothlet's
	// module loader produces a different Symbol instance than a direct ESM import, so
	// identity comparison is not stable across the wrapper.
	const PRIMITIVES = [
		{ name: "label", value: "classified" }, // string
		{ name: "count", value: 42 }, // number
		{ name: "active", value: true }, // boolean
		{ name: "ledgerId", value: 9007199254740993n }, // bigint
		{ name: "marker", expected: "symbol" }, // symbol — typeof-checked
		{ name: "missing", value: null } // null
	];

	it("flag on: every primitive data-value type is gated when denied", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		for (const { name } of PRIMITIVES) {
			try {
				await api.callers.dataReader.readByName(name);
				expect.unreachable(`${name} read should have been denied`);
			} catch (err) {
				expect(err.message).toMatch(/PERMISSION_DENIED/);
			}
		}
	});

	it("flag on: every primitive data-value type is returned intact when allowed", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.*", effect: "allow" }]
			}
		});

		for (const entry of PRIMITIVES) {
			const read = await api.callers.dataReader.readByName(entry.name);
			if (entry.expected !== undefined) {
				expect(typeof read).toBe(entry.expected);
			} else {
				expect(read).toBe(entry.value);
			}
		}
	});

	it("a null module export is exposed as bare null, not an empty object", async () => {
		// Wrapping regression — independent of read gating: `export const x = null`
		// must surface as `null`, the same way a `number`/`string` export does.
		api = await slothlet({ ...config, base: BASE });

		const value = await api.db.secrets.missing;
		expect(value).toBeNull();
	});

	it("flag on: every terminal data-value type is gated", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		// Covers each branch of the read-gate terminal-value classifier:
		// TypedArray view, ArrayBuffer, Date, Map, Set, WeakMap, WeakSet, RegExp,
		// Promise, and Error.
		const names = ["bytes", "rawBuffer", "issued", "lookup", "memberSet", "weakLookup", "weakMembers", "pattern", "pending", "failure"];
		for (const name of names) {
			try {
				await api.callers.dataReader.readByName(name);
				expect.unreachable(`${name} read should have been denied`);
			} catch (err) {
				expect(err.message).toMatch(/PERMISSION_DENIED/);
			}
		}
	});

	it("flag on: every allowed built-in read returns the value UNWRAPPED, not proxy-wrapped", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.*", effect: "allow" }]
			}
		});

		// The read gate must not re-wrap the value — built-ins must cross `self` with
		// their intrinsic slots intact (the v3.5.1 unwrapping guarantee). A proxy
		// wrapper would break `.length` / `.byteLength` / native methods. This is the
		// allow-side counterpart of the deny sweep above — same ten built-in types.
		const r = api.callers.dataReader;

		const token = await r.readByName("token"); // Buffer
		expect(Buffer.isBuffer(token)).toBe(true);
		expect(token.length).toBe(18);
		expect(token.toString()).toBe("super-secret-token");

		const bytes = await r.readByName("bytes"); // TypedArray view
		expect(ArrayBuffer.isView(bytes)).toBe(true);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBe(4);
		expect(bytes.byteLength).toBe(4);

		const rawBuffer = await r.readByName("rawBuffer"); // ArrayBuffer
		expect(rawBuffer).toBeInstanceOf(ArrayBuffer);
		expect(rawBuffer.byteLength).toBe(8);

		const issued = await r.readByName("issued"); // Date
		expect(issued).toBeInstanceOf(Date);
		expect(issued.getUTCFullYear()).toBe(2026);

		const lookup = await r.readByName("lookup"); // Map
		expect(lookup).toBeInstanceOf(Map);
		expect(lookup.get("region")).toBe("us");

		const memberSet = await r.readByName("memberSet"); // Set
		expect(memberSet).toBeInstanceOf(Set);
		expect(memberSet.size).toBe(3);
		expect(memberSet.has(2)).toBe(true);

		const weakLookup = await r.readByName("weakLookup"); // WeakMap
		expect(weakLookup).toBeInstanceOf(WeakMap);

		const weakMembers = await r.readByName("weakMembers"); // WeakSet
		expect(weakMembers).toBeInstanceOf(WeakSet);

		const pattern = await r.readByName("pattern"); // RegExp
		expect(pattern).toBeInstanceOf(RegExp);
		expect(pattern.test("classified-7")).toBe(true);

		// Promise: applyTrap awaits a thenable return value, so the call resolves to
		// the Promise's resolved value — proving it crossed `self` as a real thenable.
		const pending = await r.readByName("pending"); // Promise
		expect(pending).toBe("ok");

		const failure = await r.readByName("failure"); // Error
		expect(failure).toBeInstanceOf(Error);
		expect(failure.message).toBe("sealed");
	});

	it("flag on: a denied read emits a permission:denied audit event", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: "verbose",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny" }]
			}
		});

		const deniedEvents = [];
		api.slothlet.lifecycle.on("permission:denied", (data) => {
			deniedEvents.push(data);
		});

		try {
			await api.callers.dataReader.readToken();
		} catch {
			// expected
		}

		expect(deniedEvents.length).toBeGreaterThan(0);
		expect(deniedEvents[0]).toHaveProperty("target", "db.secrets.token");
	});

	it("flag on but permissions disabled: reads succeed (isEnabled short-circuit)", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				enabled: false,
				defaultPolicy: "deny",
				readGating: true,
				rules: [{ caller: "**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		const result = await api.callers.dataReader.readToken();
		expect(Buffer.isBuffer(result)).toBe(true);
	});

	it("flag on: a context-conditional rule gates a read using the request context", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny", condition: { scope: "restricted" } }]
			}
		});

		// No request context — the conditional rule is inert, so the read is allowed.
		const open = await api.callers.dataReader.readToken();
		expect(Buffer.isBuffer(open)).toBe(true);

		// Inside a matching request context — the conditional deny rule fires for the read.
		await api.slothlet.context.run({ scope: "restricted" }, async () => {
			try {
				await api.callers.dataReader.readToken();
				expect.unreachable("read should have been denied under the request context");
			} catch (err) {
				expect(err.message).toMatch(/PERMISSION_DENIED/);
			}
		});
	});

	it("flag on: same caller in two contexts evaluates conditional rules per-context (cache miss across contexts)", async () => {
		// Regression — without per-context bucketing of the waitingProxyCache, a
		// caller that reads the same unmaterialized path in two different
		// `context.run({...}, …)` scopes would hit the cached proxy from the first
		// scope and re-evaluate conditional rules against the wrong context — a
		// potential bypass for context-sensitive permission rules.
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny", condition: { scope: "restricted" } }]
			}
		});

		// First read in a permissive context — fills the cache.
		await api.slothlet.context.run({ scope: "public" }, async () => {
			const ok = await api.callers.dataReader.readToken();
			expect(Buffer.isBuffer(ok)).toBe(true);
		});

		// Same caller, same path, restrictive context — must be denied, not served
		// from the permissive-context cache entry.
		await api.slothlet.context.run({ scope: "restricted" }, async () => {
			try {
				await api.callers.dataReader.readToken();
				expect.unreachable("read should have been denied under the restricted context");
			} catch (err) {
				expect(err.message).toMatch(/PERMISSION_DENIED/);
			}
		});

		// And going back to permissive — still allowed (each context.run gets its own bucket).
		await api.slothlet.context.run({ scope: "public" }, async () => {
			const ok = await api.callers.dataReader.readToken();
			expect(Buffer.isBuffer(ok)).toBe(true);
		});
	});

	it("control.readGating(true) starts gating a previously-allowed read at runtime", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: false,
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny" }]
			}
		});

		// Started opted out — the deny rule does not gate the read yet.
		expect(api.slothlet.permissions.control.readGatingEnabled).toBe(false);
		const before = await api.callers.dataReader.readToken();
		expect(Buffer.isBuffer(before)).toBe(true);

		// Toggle on — the same read is now gated.
		api.slothlet.permissions.control.readGating(true);
		expect(api.slothlet.permissions.control.readGatingEnabled).toBe(true);
		try {
			await api.callers.dataReader.readToken();
			expect.unreachable("read should have been denied after toggle");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("control.readGating(false) stops gating at runtime", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny" }]
			}
		});

		try {
			await api.callers.dataReader.readToken();
			expect.unreachable("read should have been denied while gating is on");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// Toggle off — the read is no longer gated.
		api.slothlet.permissions.control.readGating(false);
		expect(api.slothlet.permissions.control.readGatingEnabled).toBe(false);
		const after = await api.callers.dataReader.readToken();
		expect(Buffer.isBuffer(after)).toBe(true);
	});

	it("flag on: two callers reading the same path each get their own gate decision", async () => {
		// Regression — the waitingProxyCache in lazy mode is keyed so two different
		// modules touching the same unmaterialized path never share one cached
		// snapshot. Without per-caller keying, a second reader hitting the cache
		// would inherit the first reader's captured caller identity and bypass its
		// own deny rule (and audit attribution would credit the wrong module).
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: "verbose",
				readGating: true,
				rules: [
					// Explicit deny on dataReaderB so the rule-based "permission:denied"
					// event fires (default-policy fallthrough emits "permission:default").
					{ caller: "callers.dataReaderB.**", target: "db.secrets.token", effect: "deny" }
				]
			}
		});

		const denied = [];
		api.slothlet.lifecycle.on("permission:denied", (data) => denied.push(data));

		// Wrap each call in an async IIFE so synchronous throws (eager-mode read-gate
		// enforcement) become rejected promises that Promise.allSettled can capture.
		const callA = async () => api.callers.dataReader.readToken();
		const callB = async () => api.callers.dataReaderB.readToken();

		// Fire both reads in parallel — in lazy mode this is the scenario where the
		// waitingProxyCache would have collided pre-fix.
		const [a, b] = await Promise.allSettled([callA(), callB()]);

		expect(a.status).toBe("fulfilled");
		expect(Buffer.isBuffer(a.value)).toBe(true);
		expect(a.value.toString()).toBe("super-secret-token");

		expect(b.status).toBe("rejected");
		expect(b.reason.message).toMatch(/PERMISSION_DENIED/);

		// Reverse the order on a second pair to exercise the cache from the other side too.
		const [b2, a2] = await Promise.allSettled([callB(), callA()]);

		expect(b2.status).toBe("rejected");
		expect(b2.reason.message).toMatch(/PERMISSION_DENIED/);
		expect(a2.status).toBe("fulfilled");
		expect(Buffer.isBuffer(a2.value)).toBe(true);

		// At least one denial event should credit dataReaderB explicitly — not dataReader.
		expect(denied.length).toBeGreaterThan(0);
		const callers = denied.map((event) => event.caller);
		expect(callers.some((c) => /dataReaderB/.test(c))).toBe(true);
		expect(callers.every((c) => !/^callers\.dataReader(\.|$)/.test(c))).toBe(true);
	});

	it("control.readGating rejects a non-boolean argument", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "allow" }
		});

		expect(() => api.slothlet.permissions.control.readGating("yes")).toThrow(/INVALID_ARGUMENT/);
	});
});
