/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/security/export-surface.test.vitest.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview H1 — export-surface narrowing. `@cldmv/slothlet/handlers/*` and
 * `@cldmv/slothlet/factories/*` are no longer public exports; they moved to the package
 * `imports` field (`#handlers/*` / `#factories/*`), reachable only from inside the package.
 * External consumers importing those subpaths must get ERR_PACKAGE_PATH_NOT_EXPORTED — which
 * closes the raw-instance leak (the only userland path to context-async's getContext()).
 */

import { describe, it, expect } from "vitest";
import { generateImportMap } from "@cldmv/slothlet/helpers/generate-manifest";

// Build specifiers at runtime so the bundler/module-runner cannot statically resolve (and reject)
// them at transform time — the point is to observe the resolver rejecting a no-longer-exported subpath.
const subpath = (...parts) => parts.join("/");

describe("Security > Export surface narrowing (H1)", () => {
	it("handlers/* is no longer a public export", async () => {
		const spec = subpath("@cldmv/slothlet", "handlers", "context-async");
		await expect(import(/* @vite-ignore */ spec)).rejects.toThrow(/not exported|ERR_PACKAGE_PATH_NOT_EXPORTED/);
	});

	it("factories/* is no longer a public export", async () => {
		const ctx = subpath("@cldmv/slothlet", "factories", "context");
		const base = subpath("@cldmv/slothlet", "factories", "component-base");
		await expect(import(/* @vite-ignore */ ctx)).rejects.toThrow(/not exported|ERR_PACKAGE_PATH_NOT_EXPORTED/);
		await expect(import(/* @vite-ignore */ base)).rejects.toThrow(/not exported|ERR_PACKAGE_PATH_NOT_EXPORTED/);
	});

	it("browser importmap still resolves the internal specifiers via #-prefixed keys", async () => {
		const { imports } = await generateImportMap("/");

		const handlerKeys = Object.keys(imports).filter((k) => k.startsWith("#handlers/"));
		const factoryKeys = Object.keys(imports).filter((k) => k.startsWith("#factories/"));

		expect(handlerKeys.length).toBeGreaterThan(0);
		expect(factoryKeys.length).toBeGreaterThan(0);
		expect(imports["#handlers/context-async"]).toMatch(/\.mjs$/);
		expect(imports["#factories/context"]).toMatch(/\.mjs$/);
	});
});
