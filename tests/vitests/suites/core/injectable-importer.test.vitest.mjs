/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/injectable-importer.test.vitest.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `slothlet({ import })` — route leaf loading through a consumer's importer (#235).
 *
 * @description
 * The loader imports each leaf via a native dynamic `import()` with a per-instance cache-busting
 * query. In a consumer project slothlet is an externalized dependency, so that import never enters
 * the test runner's module graph and leaf execution attributes to nothing — the coverage collector
 * sees the leaves as dead code even though their output is asserted. The `deps.inline` workaround
 * re-processes the whole package through the runner at a fidelity cost.
 *
 * The `import` option hands the loader a consumer-bound importer instead. Contract pinned here:
 * the importer receives the EXACT cache-busted URL the loader builds (`?slothlet_instance=…`,
 * `&module=…` for mounts, `&_reload=…` during reload) and its resolved module namespace is used
 * unchanged — so per-instance isolation, mount identity, and hot reload behave identically, the
 * only difference being whose `import()` executes. Unset, the loader uses the native import and
 * nothing changes.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;
const MOD_FILE = new URL("../../../../api_tests/api_test_underscore/mod/mod.mjs", import.meta.url).pathname;

describe("Core > injectable leaf importer (#235)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("routes every leaf load through the importer with the exact cache-busted URL", async () => {
		const seen = [];
		api = await slothlet({
			mode: "eager",
			base: BASE,
			import: (moduleUrl) => {
				seen.push(moduleUrl);
				return import(moduleUrl);
			}
		});

		// Every fixture leaf loaded through the consumer's importer, none through the native path.
		expect(seen.length).toBeGreaterThanOrEqual(3);
		for (const moduleUrl of seen) {
			expect(moduleUrl, "file URL form").toMatch(/^file:\/\//);
			expect(moduleUrl, "per-instance cache-bust intact").toContain("?slothlet_instance=");
		}
		// And the composed api is byte-for-byte the ordinary surface.
		expect(await api.mod.plain).toBe("ok");
		expect(Object.keys(api.mod).sort()).toEqual(["__priv", "_semi", "plain"]);
	});

	it("carries the mount identity in the URL for api.add loads", async () => {
		const seen = [];
		api = await slothlet({
			mode: "eager",
			base: BASE,
			import: (moduleUrl) => {
				seen.push(moduleUrl);
				return import(moduleUrl);
			}
		});

		seen.length = 0;
		const moduleID = await api.slothlet.api.add("m2", MOD_FILE);
		const mountLoad = seen.find((moduleUrl) => moduleUrl.includes("mod.mjs"));
		expect(mountLoad, "the mounted file loaded through the importer").toBeDefined();
		expect(mountLoad, "mount identity rides the URL").toContain(`&module=${moduleID}`);
		expect(await api.m2.plain).toBe("ok");
	});

	it("defers importer work to materialization under lazy", async () => {
		const seen = [];
		api = await slothlet({
			mode: "lazy",
			base: BASE,
			import: (moduleUrl) => {
				seen.push(moduleUrl);
				return import(moduleUrl);
			}
		});

		// Laziness is preserved: nothing loads until touched, then the touch loads through the importer.
		const before = seen.length;
		await api.mod.plain;
		expect(seen.length, "the touch loaded through the importer").toBeGreaterThan(before);
		expect(seen.some((moduleUrl) => moduleUrl.includes("mod.mjs"))).toBe(true);
	});

	it("passes the reload cache-bust through the importer", async () => {
		const seen = [];
		api = await slothlet({
			mode: "eager",
			base: BASE,
			import: (moduleUrl) => {
				seen.push(moduleUrl);
				return import(moduleUrl);
			}
		});

		seen.length = 0;
		await api.slothlet.api.reload(".");
		const reloadLoads = seen.filter((moduleUrl) => moduleUrl.includes("&_reload="));
		expect(reloadLoads.length, "reload re-imported through the importer with a fresh bust").toBeGreaterThan(0);
		expect(await api.mod.plain, "surface intact after reload").toBe("ok");
	});

	it("rejects a non-function importer with a named config error", async () => {
		await expect(slothlet({ mode: "eager", base: BASE, import: "not-a-function" })).rejects.toThrow(/INVALID_CONFIG_IMPORT/);
	});
});

describe("Core > coverage-run hint (#235)", () => {
	/**
	 * Runs the decision helper with captured warnings and restores console suppression.
	 * @param {object} config - Config under test.
	 * @param {object} overrides - Injected environment inputs.
	 * @returns {Promise<{fired: boolean, captured: number}>} Whether it warned and how many captures.
	 */
	async function probe(config, overrides) {
		const { warnIfCoverageWithoutImporter } = await import("@cldmv/slothlet/processors/loader");
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.clearCaptured();
		const prior = SlothletWarning.suppressConsole;
		SlothletWarning.suppressConsole = true;
		try {
			const fired = warnIfCoverageWithoutImporter(config, overrides);
			return { fired, captured: SlothletWarning.captured.filter((w) => w.code === "WARNING_COVERAGE_IMPORTER_UNSET").length };
		} finally {
			SlothletWarning.suppressConsole = prior;
			SlothletWarning.clearCaptured();
		}
	}

	const COVERAGE_WORKER = { config: { coverage: { enabled: true, provider: "v8" } } };

	it("warns exactly in the misattribution scenario", async () => {
		const out = await probe({}, { worker: COVERAGE_WORKER, externalized: true });
		expect(out.fired).toBe(true);
		expect(out.captured).toBe(1);
	});

	it("stays silent on a plain (non-coverage) test run", async () => {
		const out = await probe({}, { worker: { config: { coverage: { enabled: false } } }, externalized: true });
		expect(out.fired).toBe(false);
		expect(out.captured).toBe(0);
	});

	it("stays silent outside vitest entirely", async () => {
		// `null` — not `undefined` — expresses a genuinely absent worker: an explicit undefined
		// argument would trigger the parameter default and read the REAL worker global, which under
		// the repo's own coverage runs has coverage enabled.
		const out = await probe({}, { worker: null, externalized: true });
		expect(out.fired).toBe(false);
	});

	it("stays silent when this slothlet copy is inlined (attribution already works)", async () => {
		const out = await probe({}, { worker: COVERAGE_WORKER, externalized: false });
		expect(out.fired).toBe(false);
	});

	it("stays silent once the importer is configured — the fix is in place", async () => {
		const out = await probe({ import: (url) => import(url) }, { worker: COVERAGE_WORKER, externalized: true });
		expect(out.fired).toBe(false);
	});

	it("respects silent instances", async () => {
		const out = await probe({ silent: true }, { worker: COVERAGE_WORKER, externalized: true });
		expect(out.fired).toBe(false);
	});

	it("never fires from an in-repo boot, where slothlet is the project under test", async () => {
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.clearCaptured();
		const prior = SlothletWarning.suppressConsole;
		SlothletWarning.suppressConsole = true;
		let api;
		try {
			// The real boot consults the helper with REAL environment inputs; in this suite slothlet
			// is transformed project code (not externalized), so the hint must not fire even under
			// the repo's own coverage runs.
			api = await slothlet({ mode: "eager", base: BASE });
			expect(SlothletWarning.captured.filter((w) => w.code === "WARNING_COVERAGE_IMPORTER_UNSET")).toHaveLength(0);
		} finally {
			SlothletWarning.suppressConsole = prior;
			SlothletWarning.clearCaptured();
			if (api) await api.shutdown();
		}
	});
});
