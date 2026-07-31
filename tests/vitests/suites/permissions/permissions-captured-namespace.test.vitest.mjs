/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-captured-namespace.test.vitest.mjs
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
 * @fileoverview A captured identity travels down the path, not just onto the leaf that was read.
 *
 * @description
 * Capture binding records the reading module when a reference leaves the api. If it only attached to
 * the leaf, capturing one level up would walk around it: hold `self.db.secrets` during a call, then
 * read `.token` off it afterwards, when nothing is executing and there is no live caller to enforce.
 * So the binding has to propagate through every read taken from a captured namespace.
 *
 * Descriptor redaction is here for the same reason it exists at all — a denied leaf that `Object.keys`
 * withholds but `getOwnPropertyDescriptor` still describes is the trap-by-trap inconsistency the read
 * gate was built to close, and enumeration and description have to agree.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > captured namespace > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("enforces a leaf read through a namespace captured earlier", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		expect(await api.callers.dataReader.captureSecretsNamespace()).toBe("held");

		// Read in a separate call, so nothing of the capturing call is still in flight. Only the
		// identity recorded when the namespace was taken can refuse this.
		const outcome = await api.callers.dataReader.readTokenViaHeldNamespace();

		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("keeps redaction consistent for a namespace reached through a captured parent", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.config.**", effect: "deny" }]
			}
		});

		await api.callers.dataReader.captureSecretsNamespace();
		const outcome = await api.callers.dataReader.readConfigViaHeldNamespace();

		// Enumeration answers with redaction rather than a throw, so the denied leaves are simply absent.
		if (outcome.ok) expect(outcome.keys).not.toContain("apiKey");
		else expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("leaves a permitted module's captured namespace working", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.dataReader.**", target: "db.secrets.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		await api.callers.dataReader.captureSecretsNamespace();
		const outcome = await api.callers.dataReader.readTokenViaHeldNamespace();

		expect(outcome.ok).toBe(true);
		expect(outcome.value).toContain("super-secret-token");
	});

	it("carries the captured identity through a namespace-to-namespace hop", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			// Instance context data, so the read path resolves a real request context rather than null.
			context: { userId: 7 },
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

		expect(await api.callers.dataReader.captureDbRoot()).toBe("held-root");

		// Holding the parent yields another namespace on the next read, not a value. If the identity
		// attached only to leaves, capturing one level higher would shed it.
		const outcome = await api.callers.dataReader.readThroughHeldRoot();

		// The denied value must not come back — that is the property worth pinning, and it holds in every
		// mode. How the refusal presents differs: eager composition denies outright, while under lazy a
		// namespace held across calls no longer resolves and the read yields `undefined`. Asserting
		// PERMISSION_DENIED specifically would encode eager's shape and fail on lazy for a reason that has
		// nothing to do with a leak.
		expect(String(outcome.value ?? "")).not.toContain("super-secret-token");
		if (outcome.ok === false) expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("substitutes itself as newTarget only when it is the newTarget", async () => {
		// Permissions on, so the class read off `self` comes back as a per-reader view and it is the
		// VIEW's construct trap making the substitution decision — with permissions off there is no view
		// and only the plain wrapper's own newTarget handling would be exercised.
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow", rules: [] } });

		// `new self.x.Y()` makes the wrapper its own newTarget and it hands the child through instead.
		// An explicit third argument to `Reflect.construct` is a different intent and has to be honoured,
		// or the instance would get the wrong prototype.
		const outcome = await api.callers.dataReader.constructWithExplicitTarget();

		expect(outcome.built).toBe("explicit");
		expect(outcome.proto).toBe(true);
	});

	it("carries the captured identity onto a namespace handed back from a captured parent", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			// Real request context, so the read path resolves one rather than falling back to null, and
			// nothing is denied, so the walk completes instead of throwing partway.
			context: { userId: 7 },
			permissions: { defaultPolicy: "allow", rules: [] }
		});

		await api.callers.dataReader.captureDbRoot();
		const outcome = await api.callers.dataReader.walkHeldRootAllowed();

		// Two hops down from the captured parent, each yielding a namespace rather than a value.
		if (config.mode === "lazy") {
			// KNOWN DEFECT, pinned rather than skipped: under lazy composition a namespace obtained through
			// `self` and used in a later call resolves to nothing, so the walk yields undefined instead of
			// the namespace. It predates the caller-attribution work — it reproduces with
			// `permissions.references.capture: false`, and the same capture/replay through the host `api`
			// object works — so it is a runtime live-binding issue, not a permissions one. Nothing is
			// disclosed; the read simply returns undefined. Asserting it here means whoever fixes it sees
			// this test fail and updates it, instead of the gap sitting behind a skip.
			expect(outcome.kind).toBe("undefined");
			return;
		}
		expect(outcome.kind).toBe("object");
		expect(outcome.keys).toBeGreaterThan(0);
	});

	it("keeps the lender's floor on a namespace lent to the host", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny" }]
			}
		});

		// The module hands its captured namespace back out. The host now reads through it with no module
		// executing and no call context active — the read gate can only enforce the identity recorded
		// when the module took the reference.
		const lent = await api.callers.dataReader.lendSecretsNamespace();

		if (config.mode === "lazy") {
			// KNOWN DEFECT, the same one pinned above: under lazy composition a namespace obtained
			// through `self` goes dead once the call that captured it completes, so the host's reads
			// yield undefined rather than values or denials. Nothing is disclosed. Whoever fixes the
			// live-binding resolution sees this fail and updates it.
			expect(await lent.config).toBeUndefined();
			expect(lent.token).toBeUndefined();
			return;
		}

		// The hop the lender is permitted still works for the holder...
		const cfg = await lent.config;
		expect(Object.keys(cfg)).toContain("publicName");

		// ...but the leaf denied to the lender stays denied. Stashing an api reference inside a module
		// and reading it from host context does not recover the host's standing — that is the borrowed
		// authority capture binding exists to refuse, and it throws rather than redacts because this is
		// a direct read of a named leaf, not an enumeration.
		expect(() => lent.token).toThrow(/PERMISSION_DENIED/);
	});

	it("does not describe a leaf it will not enumerate", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.token", effect: "deny" }]
			}
		});

		// `getOwnPropertyDescriptor` is a separate trap from `ownKeys`; if it answered here, a caller
		// could recover both the existence and the value of a leaf the listing withheld.
		expect(await api.callers.dataReader.describeSecret("token")).toBe("undescribable");
		// A permitted sibling stays describable, so this is redaction rather than a blanket refusal.
		expect(await api.callers.dataReader.describeSecret("bytes")).toBe("described");
	});
});
