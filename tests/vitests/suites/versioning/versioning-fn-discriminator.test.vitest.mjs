/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-fn-discriminator.test.vitest.mjs
 *	@Date: 2026-04-01T22:42:48-07:00 (1775108568)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:43-08:00 (1794882643)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Function discriminator — verify the allVersions and caller argument
 * shapes passed to the discriminator function.
 *
 * @module tests/vitests/suites/versioning/versioning-fn-discriminator
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Function Discriminator > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("discriminator receives correct allVersions shape", async () => {
		const receivedArgs = [];

		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versioning: {
				dispatcher: (allVersions, caller) => {
					receivedArgs.push({ allVersions, caller });
					return null; // fall to default
				}
			}
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1", default: true, metadata: { stable: true } } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2", metadata: { stable: false } } });

		// Trigger a dispatch
		api.unversionedCaller.callLogin("testUser");

		expect(receivedArgs.length).toBeGreaterThan(0);
		const { allVersions } = receivedArgs[0];

		// allVersions has both registered tags
		expect(allVersions).toHaveProperty("v1");
		expect(allVersions).toHaveProperty("v2");

		// Each entry has the version's user metadata and its version record { tag, default, metadata }
		expect(allVersions.v1).toHaveProperty("metadata");
		expect(allVersions.v1).toHaveProperty("version");
		expect(allVersions.v1.version).toHaveProperty("tag", "v1");
		expect(allVersions.v1.version).toHaveProperty("default", true);
		// version.metadata comes from the add option version.metadata { stable: true }
		expect(allVersions.v1.version.metadata).toHaveProperty("stable", true);

		// user metadata and version metadata are separate (not merged), and neither carries system facts
		expect(allVersions.v1.version.metadata).not.toHaveProperty("apiPath");
		expect(allVersions.v1.metadata).not.toHaveProperty("stable");
		expect(allVersions.v1.metadata).not.toHaveProperty("apiPath");
	});

	it("discriminator receives correct caller shape", async () => {
		let capturedCaller = null;

		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versioning: {
				dispatcher: (allVersions, caller) => {
					capturedCaller = caller;
					return "v1";
				}
			}
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1", default: true } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2" } });

		api.unversionedCaller.callLogin("testUser");

		expect(capturedCaller).not.toBeNull();
		// caller has the 4 fields { path, module, metadata, version }
		expect(Object.keys(capturedCaller).sort()).toEqual(["metadata", "module", "path", "version"]);
		expect(capturedCaller.path).toEqual(["unversionedCaller", "callLogin"]);
		expect(typeof capturedCaller.module).toBe("string");
		// unversionedCaller is no registered version → null
		expect(capturedCaller.version).toBeNull();
	});

	it("function discriminator can route based on caller regular metadata", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versioning: {
				dispatcher: (allVersions, caller) => caller.metadata?.targetVersion ?? null
			}
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1", default: true } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2" } });

		api.slothlet.metadata.set("v2Caller", { targetVersion: "v2" });

		const result = api.v2Caller.callLogin("user", "pass");
		expect(result.version).toBe("v2");
	});

	it("discriminator function that throws falls back to the default version", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versioning: {
				dispatcher: () => {
					throw new Error("discriminator exploded");
				}
			}
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1", default: true } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2" } });

		// Discriminator throws → resolveForPath catches it → returns null → getDefaultVersion fallback
		// v1 is explicit default, so result.version should be "v1"
		const result = api.unversionedCaller.callLogin("testUser");
		expect(result.version).toBe("v1");
	});
});
