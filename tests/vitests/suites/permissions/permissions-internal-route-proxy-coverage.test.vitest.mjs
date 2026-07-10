/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-internal-route-proxy-coverage.test.vitest.mjs
 *	@Date: 2026-05-06 00:00:00 -07:00 (1778041200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-06 15:46:54 -07:00 (1778107614)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Internal Route Proxy Coverage > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("handles symbol-keyed get and descriptor access through internal route proxy", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		const symbolValue = await api.internalProxyHelper.readPermissionsSymbolValue();
		const descriptorResult = await api.internalProxyHelper.readPermissionsSymbolDescriptor();

		expect(symbolValue === null || typeof symbolValue === "string").toBe(true);
		expect(descriptorResult).toBe(true);
	});

	it("handles non-string descriptor lookup when symbol descriptor exists", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		const ok = await api.internalProxyHelper.defineAndReadPermissionsSymbolDescriptor();
		expect(ok).toBe(true);
	});

	it("exercises construct trap by creating SlothletWarning via slothlet.diag", async () => {
		api = await slothlet({
			...config,
			diagnostics: true,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		const constructed = await api.internalProxyHelper.constructWarningThroughDiag();
		expect(constructed).toBe(true);
	});

	it("invokes wrapped accessor getter from getOwnPropertyDescriptor", async () => {
		api = await slothlet({
			...config,
			diagnostics: true,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		const enabled = await api.internalProxyHelper.readDiagHookEnabledViaDescriptorGetter();
		expect(typeof enabled).toBe("boolean");
	});

	it("invokes wrapped accessor setter from getOwnPropertyDescriptor", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		const captured = await api.internalProxyHelper.writeSyntheticSetterViaDescriptor(42);
		expect(captured).toBe(42);
	});

	it("denies string-key set mutation via internal route proxy set trap", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "**", target: "internalProxyHelper.**", effect: "allow" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "allow" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.__setProbe", effect: "deny" }
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.writePermissionsStringKey("__setProbe", 1);
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("denies string-key defineProperty mutation via internal route proxy defineProperty trap", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "**", target: "internalProxyHelper.**", effect: "allow" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "allow" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.__defineProbe", effect: "deny" }
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.definePermissionsStringKey("__defineProbe", 2);
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("denies string-key delete mutation via internal route proxy deleteProperty trap", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "**", target: "internalProxyHelper.**", effect: "allow" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "allow" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.__deleteProbe", effect: "deny" }
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.deletePermissionsStringKey("__deleteProbe");
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("allows symbol-key mutations without string-route enforcement", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		const ok = await api.internalProxyHelper.mutatePermissionsSymbolKey();
		expect(ok).toBe(true);
	});

	it("denies namespace read with unrelated allow rule present (descendant pre-check continues)", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "payments.**", effect: "allow" }
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.readPermissionsNamespace();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("denies namespace read with wildcard allow rule (descendant probe startsWith false arm)", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "**", effect: "allow" }
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.readPermissionsNamespace();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("throws INVALID_METADATA_KEY for empty key from module-internal setGlobal", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.callSetGlobalWithEmptyKey();
				expect.unreachable("Should have thrown INVALID_METADATA_KEY");
			} catch (err) {
				expect(err.message).toContain("INVALID_METADATA_KEY");
			}
		});
	});

	it("throws INVALID_ARGUMENT for non-string/non-object keyOrObj from module setGlobal", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.callSetGlobalWithInvalidType();
				expect.unreachable("Should have thrown INVALID_ARGUMENT");
			} catch (err) {
				expect(err.message).toContain("INVALID_ARGUMENT");
			}
		});
	});
});

// Tests for conditionMatches / deepObjectMatches branches inside canTraverseInternalNamespace
describe.each(getMatrixConfigs())("Permissions > conditionMatches branches (canTraverseInternalNamespace) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("conditionMatches(null) returns true — allow rule with no condition and startsWith prefix", async () => {
		// Allow rule targets "slothlet.permissions.addRule" (startsWith "slothlet.permissions.").
		// conditionMatches(null) fires and returns true → traversal allowed → readPermissionsNamespace succeeds.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.addRule", effect: "allow" }
				]
			}
		});

		const result = await api.internalProxyHelper.readPermissionsNamespace();
		expect(result != null).toBe(true);
	});

	it("conditionMatches `: false` arm — permissionManager without matchesCondition method → ternary false branch", async () => {
		// Same allow/deny shape as the conditionMatches(null) case so traversal reaches conditionMatches.
		// Swap the live permissionManager for a partial stub that OMITS matchesCondition: the ternary's
		// `typeof permissionManager.matchesCondition === "function"` is false → the `: false` arm fires.
		// The conditional allow then "fails", but the probe path (getRulesForCaller returns an allow rule
		// whose descendant probe is permitted under defaultPolicy=allow) still grants traversal, so the
		// public read resolves non-null.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.addRule", effect: "allow" }
				]
			}
		});

		const sl = resolveWrapper(api.internalProxyHelper).slothlet;
		const orig = sl.handlers.permissionManager;

		// Partial stub: bind the real implementations the helper depends on, but intentionally omit
		// matchesCondition so conditionMatches() takes its `: false` arm.
		sl.handlers.permissionManager = {
			isEnabled: orig.isEnabled.bind(orig),
			isReadGatingEnabled: orig.isReadGatingEnabled.bind(orig),
			enforceAccess: orig.enforceAccess.bind(orig),
			checkAccess: orig.checkAccess.bind(orig),
			getRulesForCaller: () => [{ effect: "allow", target: "slothlet.permissions.addRule", condition: { role: "x" } }]
		};

		try {
			const result = await api.internalProxyHelper.readPermissionsNamespace();
			expect(result != null).toBe(true);
		} finally {
			sl.handlers.permissionManager = orig;
		}
	});

	it("conditionMatches(fn) — function condition returns true → traversal allowed", async () => {
		// Condition function returns true → conditionMatches returns true → traversal allowed.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.addRule", effect: "allow", condition: () => true }
				]
			}
		});

		const result = await api.internalProxyHelper.readPermissionsNamespace();
		expect(result != null).toBe(true);
	});

	it("conditionMatches(fn) catch — function condition throws → treated as non-match → PERMISSION_DENIED", async () => {
		// Condition function throws → catch returns false → condition fails.
		// With defaultPolicy deny + only failing conditional allow + deny of probe paths → throws.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "**", target: "internalProxyHelper.**", effect: "allow" },
					{
						caller: "internalProxyHelper.**",
						target: "slothlet.permissions.addRule",
						effect: "allow",
						condition: () => {
							throw new Error("deliberate-throw-in-condition");
						}
					}
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.readPermissionsNamespace();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("conditionMatches plain object — object condition fails (no matching context) → PERMISSION_DENIED", async () => {
		// Plain object condition { role: "admin" } with empty runtimeContext → deepObjectMatches fails.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "**", target: "internalProxyHelper.**", effect: "allow" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.addRule", effect: "allow", condition: { role: "admin" } }
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.readPermissionsNamespace();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("conditionMatches plain object — object condition matches context → traversal allowed", async () => {
		// Plain object condition { role: "admin" } with context.run({ role: "admin" }) → matches → succeeds.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.addRule", effect: "allow", condition: { role: "admin" } }
				]
			}
		});

		const result = await api.slothlet.context.run({ role: "admin" }, async () => {
			return await api.internalProxyHelper.readPermissionsNamespace();
		});
		expect(result != null).toBe(true);
	});

	it("conditionMatches array — any matching entry allows traversal", async () => {
		// Array conditions are valid: any entry that matches runtime context should allow traversal.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{
						caller: "internalProxyHelper.**",
						target: "slothlet.permissions.addRule",
						effect: "allow",
						condition: [{ role: "guest" }, { role: "admin" }]
					}
				]
			}
		});

		const result = await api.slothlet.context.run({ role: "admin" }, async () => {
			return await api.internalProxyHelper.readPermissionsNamespace();
		});
		expect(result != null).toBe(true);
	});

	it("deepObjectMatches null candidate — nested condition with null context value → fails → PERMISSION_DENIED", async () => {
		// Condition: { profile: { role: "admin" } }. Context: { profile: null }.
		// deepObjectMatches({ role: "admin" }, null) → line 292 fires (candidate is null) → returns false.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "**", target: "internalProxyHelper.**", effect: "allow" },
					{
						caller: "internalProxyHelper.**",
						target: "slothlet.permissions.addRule",
						effect: "allow",
						condition: { profile: { role: "admin" } }
					}
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.context.run({ profile: null }, async () => {
					await api.internalProxyHelper.readPermissionsNamespace();
				});
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("deepObjectMatches nested pass — nested condition with matching context → traversal allowed", async () => {
		// Condition: { profile: { role: "admin" } }. Context: { profile: { role: "admin" } }.
		// deepObjectMatches({ role: "admin" }, { role: "admin" }) → true → overall condition passes.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{
						caller: "internalProxyHelper.**",
						target: "slothlet.permissions.addRule",
						effect: "allow",
						condition: { profile: { role: "admin" } }
					}
				]
			}
		});

		const result = await api.slothlet.context.run({ profile: { role: "admin" } }, async () => {
			return await api.internalProxyHelper.readPermissionsNamespace();
		});
		expect(result != null).toBe(true);
	});

	it("deepObjectMatches nested fail — nested condition with mismatching context → PERMISSION_DENIED", async () => {
		// Condition: { profile: { role: "admin" } }. Context: { profile: { role: "user" } }.
		// deepObjectMatches({role:"admin"}, {role:"user"}) → false → overall condition fails.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "**", target: "internalProxyHelper.**", effect: "allow" },
					{
						caller: "internalProxyHelper.**",
						target: "slothlet.permissions.addRule",
						effect: "allow",
						condition: { profile: { role: "admin" } }
					}
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.context.run({ profile: { role: "user" } }, async () => {
					await api.internalProxyHelper.readPermissionsNamespace();
				});
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("isPlainObject arm1 (null proto) — null-prototype condition object → isPlainObject returns true via proto===null", async () => {
		// Condition is a null-prototype object created with Object.create(null).
		// isPlainObject checks: proto === Object.prototype (false) || proto === null (true) → arm 1 covered.
		const nullProtoCondition = Object.assign(Object.create(null), { role: "admin" });

		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions.addRule", effect: "allow", condition: nullProtoCondition }
				]
			}
		});

		const result = await api.slothlet.context.run({ role: "admin" }, async () => {
			return await api.internalProxyHelper.readPermissionsNamespace();
		});
		expect(result != null).toBe(true);
	});
});

// Tests for line 343 (glob firstSegment) and line 409 (falsy/function result in canTraverse path)
describe.each(getMatrixConfigs())("Permissions > proxy traversal edge branches > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("glob firstSegment in probe path — rule target has wildcard segment → else branch on line 343", async () => {
		// Allow rule: "slothlet.permissions.*.addRule" — startsWith prefix is true, but condition always fails.
		// Falls through to probe path: suffix="*.addRule", firstSegment="*" which has glob char → else branch.
		// Probe "slothlet.permissions.__probe__" is then checked via defaultPolicy=allow → traversal allowed.
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.permissions", effect: "deny" },
					{
						caller: "internalProxyHelper.**",
						target: "slothlet.permissions.*.addRule",
						effect: "allow",
						condition: () => false
					}
				]
			}
		});

		// Probe "slothlet.permissions.__probe__" is allowed by defaultPolicy → canTraverse returns true.
		const result = await api.internalProxyHelper.readPermissionsNamespace();
		expect(result != null).toBe(true);
	});

	it("line-409 else branch — canTraverse=true but result is primitive (slothlet.version) → throws", async () => {
		// slothlet.version is a string (primitive). When canTraverse returns true for it,
		// result && (typeof result === "object" || typeof result === "function") → false (string).
		// Covers: line 409 else branch AND binary-expr arm 2 (typeof result === "function" evaluated).
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "internalProxyHelper.**", target: "slothlet.version", effect: "deny" },
					{ caller: "internalProxyHelper.**", target: "slothlet.version.patch", effect: "allow" }
				]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.internalProxyHelper.readSlothletVersion();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});
});
