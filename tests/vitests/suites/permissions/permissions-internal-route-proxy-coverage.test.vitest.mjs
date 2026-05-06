/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-internal-route-proxy-coverage.test.vitest.mjs
 *	@Date: 2026-05-06 00:00:00 -07:00 (1778041200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-06 00:00:00 -07:00 (1778041200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
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
			dir: `${BASE}/callers`,
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
			dir: `${BASE}/callers`,
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
			dir: `${BASE}/callers`,
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
			dir: `${BASE}/callers`,
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
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		const captured = await api.internalProxyHelper.writeSyntheticSetterViaDescriptor(42);
		expect(captured).toBe(42);
	});

	it("denies namespace read with unrelated allow rule present (descendant pre-check continues)", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
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
			dir: `${BASE}/callers`,
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
			dir: `${BASE}/callers`,
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
			dir: `${BASE}/callers`,
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
