/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-slothlet-mutation-gating.test.vitest.mjs
 *	@Date: 2026-05-05T03:00:00-07:00 (1777975200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:08-08:00 (1794882608)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Slothlet Mutation Gating > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("denies inter-module rules.add when slothlet.permissions.rules.add is blocked", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.permissions.rules.add", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callAddRule({
					caller: "controlCaller.**",
					target: "payments.**",
					effect: "deny"
				});
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		const paymentRules = api.slothlet.permissions.global.rules.path("payments.charge.process");
		const injected = paymentRules.find(
			(rule) => rule.caller === "controlCaller.**" && rule.target === "payments.**" && rule.effect === "deny"
		);
		expect(injected).toBeUndefined();
	});

	it("denies descriptor-based bypass for slothlet.permissions.rules.add", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.permissions.rules.add", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callAddRuleViaDescriptorBypass({
					caller: "controlCaller.**",
					target: "payments.**",
					effect: "deny"
				});
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		const paymentRules = api.slothlet.permissions.global.rules.path("payments.charge.process");
		const injected = paymentRules.find(
			(rule) => rule.caller === "controlCaller.**" && rule.target === "payments.**" && rule.effect === "deny"
		);
		expect(injected).toBeUndefined();
	});

	it("denies denied alias sub-route after warming an allowed alias on the same function", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.i18n.translate.name", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callReadTranslateNameAfterTWarmup();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("re-checks permission at invocation time for cached slothlet callable references", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		expect(await api.controlCaller.cacheAddRuleReference()).toBe("function");

		api.slothlet.permissions.rules.add({
			caller: "controlCaller.**",
			target: "slothlet.permissions.rules.add",
			effect: "deny"
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callCachedAddRuleReference({
					caller: "controlCaller.**",
					target: "payments.**",
					effect: "deny"
				});
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		const paymentRules = api.slothlet.permissions.global.rules.path("payments.charge.process");
		const injected = paymentRules.find(
			(rule) => rule.caller === "controlCaller.**" && rule.target === "payments.**" && rule.effect === "deny"
		);
		expect(injected).toBeUndefined();
	});

	it("re-checks permission when callable is cached through getOwnPropertyDescriptor", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		expect(await api.controlCaller.cacheAddRuleDescriptorReference()).toBe("function");

		api.slothlet.permissions.rules.add({
			caller: "controlCaller.**",
			target: "slothlet.permissions.rules.add",
			effect: "deny"
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callCachedAddRuleDescriptorReference({
					caller: "controlCaller.**",
					target: "payments.**",
					effect: "deny"
				});
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		const paymentRules = api.slothlet.permissions.global.rules.path("payments.charge.process");
		const injected = paymentRules.find(
			(rule) => rule.caller === "controlCaller.**" && rule.target === "payments.**" && rule.effect === "deny"
		);
		expect(injected).toBeUndefined();
	});

	it("re-checks permission at invocation time for cached frozen materialize.get references", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		expect(await api.controlCaller.cacheMaterializeGetReference()).toBe("function");

		api.slothlet.permissions.rules.add({
			caller: "controlCaller.**",
			target: "slothlet.materialize.get",
			effect: "deny"
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callCachedMaterializeGetReference();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("re-checks permission when frozen accessor getter is cached through getOwnPropertyDescriptor", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		expect(await api.controlCaller.cacheMaterializedGetterReference()).toBe("function");

		api.slothlet.permissions.rules.add({
			caller: "controlCaller.**",
			target: "slothlet.materialize.complete",
			effect: "deny"
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callCachedMaterializedGetterReference();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("denies descriptor-based reads of non-configurable primitive leaves", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.i18n.translate.length", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callReadTranslateLengthViaDescriptor();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("denies accessor descriptor getter bypass for slothlet.materialize.complete", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.materialize.complete", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callReadMaterializedViaDescriptorGetter();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("re-checks configurable accessor descriptor getter on invocation", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.permissions.control.sealed", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callReadPermissionsSealedViaDescriptorGetter();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("denies reading slothlet.permissions namespace when exact namespace route is blocked", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.permissions", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callReadPermissionsNamespace();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("denies inter-module rules.remove when slothlet.permissions.rules.remove is blocked", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.permissions.rules.remove", effect: "deny" }]
			}
		});

		const ruleId = api.slothlet.permissions.rules.add({
			caller: "paymentsCaller.**",
			target: "payments.**",
			effect: "deny"
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callRemoveRule(ruleId);
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		const paymentRules = api.slothlet.permissions.global.rules.path("payments.charge.process");
		const persisted = paymentRules.find((rule) => rule.id === ruleId);
		expect(persisted).toBeDefined();
	});

	it("blocks internal metadata.global but keeps external direct call allowed", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.metadata.global", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callSetGlobalMetadata("securityTag", "blocked");
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		api.slothlet.metadata.global("securityTag", "allowed");
		expect(api.slothlet.metadata.get(api.controlCaller.callEnable).securityTag).toBe("allowed");
	});

	it("blocks internal i18n.language.set but keeps external direct call allowed", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.i18n.language.set", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callSetLanguage("en-gb");
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		expect(() => api.slothlet.i18n.language.set("en-gb")).not.toThrow();
		expect(api.slothlet.i18n.language.get()).toBe("en-gb");
	});

	it("blocks internal primitive route read but keeps external primitive read allowed", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: [{ caller: "controlCaller.**", target: "slothlet.version", effect: "deny" }]
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callReadVersion();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});

		expect(typeof api.slothlet.version).toBe("string");
	});

	it("allows external permissions.rules.add under default deny", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "deny",
				rules: []
			}
		});

		const ruleId = api.slothlet.permissions.rules.add({
			caller: "controlCaller.**",
			target: "payments.**",
			effect: "deny"
		});

		expect(typeof ruleId).toBe("string");
		const paymentRules = api.slothlet.permissions.global.rules.path("payments.charge.process");
		expect(paymentRules.some((rule) => rule.id === ruleId)).toBe(true);
	});

	it("passes runtimeContext from context.run into enforceInternalPermission (covers ctx.context non-null branch)", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		// Wrap the inter-module slothlet mutation in context.run so ctx.context is non-null
		// inside enforceInternalPermission — covers arm 1 of `ctx?.context ?? null`
		const ruleId = await api.slothlet.context.run({ tenant: "test" }, async () => {
			return await api.controlCaller.callAddRule({
				caller: "controlCaller.**",
				target: "payments.**",
				effect: "allow"
			});
		});

		expect(typeof ruleId).toBe("string");
	});
});
