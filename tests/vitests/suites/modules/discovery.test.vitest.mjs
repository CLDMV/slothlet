/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/discovery.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 */

/**
 * @fileoverview Tests for the pure async module discovery function.
 *
 * @description
 * Exercises discoverModules() against the three fixture directories under
 * api_tests/: api_test_modules_npm (npm-mode), api_test_modules_folder
 * (folder-mode per G6 alternate), api_test_modules_malformed (error paths).
 *
 * Pure function — no slothlet instance; no matrix.
 *
 * @module tests/vitests/suites/modules/discovery
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverModules } from "../../../../src/lib/helpers/module-discovery.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_NPM = path.join(FIXTURE_ROOT, "api_test_modules_npm");
const FIX_FOLDER = path.join(FIXTURE_ROOT, "api_test_modules_folder");
const FIX_MALFORMED = path.join(FIXTURE_ROOT, "api_test_modules_malformed");

// ─── npm-mode discovery ─────────────────────────────────────────────────────

describe("discoverModules — npm mode", () => {
	it("finds all three modules in the npm fixture", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM });
		const names = results.map((r) => r.packageName).sort();
		expect(names).toEqual(["@org/packrat-driver-bar", "@org/packrat-driver-foo", "packrat-extension-baz"]);
	});

	it("skips packages without slothlet.module.json silently", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM });
		const names = results.map((r) => r.packageName);
		expect(names).not.toContain("unrelated-package");
		expect(names).not.toContain("non-slothlet-tool");
	});

	it("populates packageRoot as an absolute filesystem path", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM });
		for (const r of results) {
			expect(path.isAbsolute(r.packageRoot)).toBe(true);
			expect(r.packageRoot.includes("api_test_modules_npm")).toBe(true);
		}
	});

	it("populates apiDir as an absolute path resolved against packageRoot", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM });
		for (const r of results) {
			expect(path.isAbsolute(r.apiDir)).toBe(true);
			expect(r.apiDir.startsWith(r.packageRoot)).toBe(true);
			expect(r.apiDir.endsWith("api")).toBe(true);
		}
	});

	it("normalizes mountPath to an array of segments", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM });
		for (const r of results) {
			expect(Array.isArray(r.mountPath)).toBe(true);
			expect(r.mountPath.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
		}
	});

	it("exposes the validated manifest on each result", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM });
		const foo = results.find((r) => r.packageName === "@org/packrat-driver-foo");
		expect(foo.manifest.kind).toBe("driver");
		expect(foo.manifest.priority).toBe(100);
		expect(foo.manifest.name).toBe("@org/packrat-driver-foo");
		expect(foo.manifest.version).toBe("1.0.0");
	});
});

// ─── folder-mode discovery ──────────────────────────────────────────────────

describe("discoverModules — folder mode", () => {
	it("finds modules in subfolders of scanRoot when node_modules is absent", async () => {
		const results = await discoverModules({ scanRoot: FIX_FOLDER });
		const names = results.map((r) => r.packageName).sort();
		expect(names).toEqual(["@local/driver-alpha", "@local/driver-beta"]);
	});

	it("skips subfolders that lack slothlet.module.json", async () => {
		const results = await discoverModules({ scanRoot: FIX_FOLDER });
		const dirs = results.map((r) => path.basename(r.packageRoot));
		expect(dirs).not.toContain("not-a-module");
	});

	it("preserves string-form mountPath as split segments", async () => {
		// driver-beta uses mountPath: "drivers.beta" (string form)
		const results = await discoverModules({ scanRoot: FIX_FOLDER });
		const beta = results.find((r) => r.packageName === "@local/driver-beta");
		expect(beta.mountPath).toEqual(["drivers", "beta"]);
	});
});

// ─── prefix filter ──────────────────────────────────────────────────────────

describe("discoverModules — prefix filter", () => {
	it("matches a single string prefix against full package name including scope", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM, prefix: "@org/" });
		const names = results.map((r) => r.packageName).sort();
		expect(names).toEqual(["@org/packrat-driver-bar", "@org/packrat-driver-foo"]);
	});

	it("matches any of multiple prefixes (array)", async () => {
		const results = await discoverModules({
			scanRoot: FIX_NPM,
			prefix: ["@org/packrat-driver-bar", "packrat-extension-"]
		});
		const names = results.map((r) => r.packageName).sort();
		expect(names).toEqual(["@org/packrat-driver-bar", "packrat-extension-baz"]);
	});

	it("returns empty array when no candidates match the prefix", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM, prefix: "nonexistent-" });
		expect(results).toEqual([]);
	});

	it("treats empty prefix array as no filter", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM, prefix: [] });
		expect(results.length).toBe(3);
	});
});

// ─── content filter ─────────────────────────────────────────────────────────

describe("discoverModules — content filter", () => {
	it("excludes results when the filter returns falsy", async () => {
		const results = await discoverModules({
			scanRoot: FIX_NPM,
			filter: (m) => m.kind === "driver"
		});
		const kinds = results.map((r) => r.manifest.kind).sort();
		expect(kinds).toEqual(["driver", "driver"]);
	});

	it("passes the validated manifest and packageName to the filter callback", async () => {
		const seen = [];
		await discoverModules({
			scanRoot: FIX_NPM,
			filter: (manifest, packageName) => {
				seen.push({ name: packageName, kind: manifest.kind });
				return true;
			}
		});
		expect(seen.length).toBe(3);
		for (const item of seen) {
			expect(typeof item.name).toBe("string");
			expect(typeof item.kind).toBe("string");
		}
	});
});

// ─── multiple scanRoots ─────────────────────────────────────────────────────

describe("discoverModules — multiple scanRoots", () => {
	it("aggregates results from npm + folder fixtures in a single call", async () => {
		const results = await discoverModules({ scanRoot: [FIX_NPM, FIX_FOLDER] });
		const names = results.map((r) => r.packageName).sort();
		expect(names).toEqual([
			"@local/driver-alpha",
			"@local/driver-beta",
			"@org/packrat-driver-bar",
			"@org/packrat-driver-foo",
			"packrat-extension-baz"
		]);
	});
});

// ─── DiscoverResult shape (M3 deep-freeze) ──────────────────────────────────

describe("discoverModules — DiscoverResult shape", () => {
	it("deep-freezes the manifest so consumers cannot mutate it (M3)", async () => {
		const [r] = await discoverModules({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		expect(Object.isFrozen(r.manifest)).toBe(true);
	});

	it("freezes the top-level DiscoverResult object", async () => {
		const [r] = await discoverModules({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		expect(Object.isFrozen(r)).toBe(true);
	});

	it("freezes the mountPath array", async () => {
		const [r] = await discoverModules({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		expect(Object.isFrozen(r.mountPath)).toBe(true);
	});
});

// ─── Malformed manifests (validator integration) ────────────────────────────

describe("discoverModules — malformed manifests", () => {
	it("throws MODULE_MANIFEST_INVALID on a bad-JSON manifest", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_MALFORMED, prefix: "bad-json" })
		).rejects.toThrow(/MODULE_MANIFEST_INVALID/);
	});

	it("MODULE_MANIFEST_INVALID for a scoped package reports the full `@scope/pkg` packageName, not the directory basename", async () => {
		// Regression: loadManifestRaw() previously derived packageName from
		// path.basename(path.dirname(manifestPath)), which drops the @scope
		// prefix (e.g. "@bad-scope/bad-json-scoped" → "bad-json-scoped"). Fix
		// threads pkg.name from package.json through to the error context.
		let caught;
		try {
			await discoverModules({ scanRoot: FIX_MALFORMED, prefix: "@bad-scope/" });
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeDefined();
		expect(caught.code).toBe("MODULE_MANIFEST_INVALID");
		expect(caught.context.packageName).toBe("@bad-scope/bad-json-scoped");
		expect(caught.context.reason).toMatch(/JSON parse error/);
	});

	it("throws MODULE_RESERVED_MOUNTPATH when mountPath uses a reserved root", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_MALFORMED, prefix: "reserved-mount" })
		).rejects.toThrow(/MODULE_RESERVED_MOUNTPATH/);
	});

	it("throws MODULE_MANIFEST_UNKNOWN_FIELD on an unrecognized top-level field", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_MALFORMED, prefix: "unknown-field" })
		).rejects.toThrow(/MODULE_MANIFEST_UNKNOWN_FIELD/);
	});

	it("throws MODULE_MANIFEST_NAME_MISMATCH when manifest name disagrees with package.json", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_MALFORMED, prefix: "name-mismatch" })
		).rejects.toThrow(/MODULE_MANIFEST_NAME_MISMATCH/);
	});

	it("throws MODULE_MANIFEST_VERSION_MISMATCH when manifest version disagrees with package.json", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_MALFORMED, prefix: "version-mismatch" })
		).rejects.toThrow(/MODULE_MANIFEST_VERSION_MISMATCH/);
	});

	it("throws MODULE_PATH_TRAVERSAL when apiDir escapes the package root", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_MALFORMED, prefix: "path-traversal" })
		).rejects.toThrow(/MODULE_PATH_TRAVERSAL/);
	});
});

// ─── Empty / edge cases ─────────────────────────────────────────────────────

describe("discoverModules — empty / edge", () => {
	it("returns an empty array when scanRoot has no modules", async () => {
		const emptyRoot = path.join(FIXTURE_ROOT, "api_test_modules_folder", "not-a-module");
		const results = await discoverModules({ scanRoot: emptyRoot });
		expect(results).toEqual([]);
	});

	it("returns an empty array when scanRoot does not exist", async () => {
		const results = await discoverModules({ scanRoot: "/nonexistent-path-for-test" });
		expect(results).toEqual([]);
	});

	it("throws INVALID_ARGUMENT when scanRoot is a non-string non-array", async () => {
		await expect(discoverModules({ scanRoot: 42 })).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT when prefix is a non-string non-array", async () => {
		await expect(discoverModules({ scanRoot: FIX_NPM, prefix: 42 })).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT when manifest option is empty string", async () => {
		await expect(discoverModules({ scanRoot: FIX_NPM, manifest: "" })).rejects.toThrow(/INVALID_ARGUMENT/);
	});
});

// ─── manifest override locator ──────────────────────────────────────────────

describe("discoverModules — manifest source override", () => {
	it("uses the default slothlet.module.json when no override is given", async () => {
		const results = await discoverModules({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		expect(results.length).toBe(1);
	});

	it("returns empty results when the override targets a missing file", async () => {
		const results = await discoverModules({
			scanRoot: FIX_NPM,
			manifest: "does-not-exist.json"
		});
		expect(results).toEqual([]);
	});

	it("supports the <file>#<dotted.key> locator form (subkey path resolution)", async () => {
		// Use package.json itself + a known existing string subkey ("name") wouldn't be
		// an object so it returns undefined → no modules. This exercises the parse +
		// walk path even without a dedicated fixture.
		const results = await discoverModules({
			scanRoot: FIX_NPM,
			manifest: "package.json#missing.subkey.here"
		});
		expect(results).toEqual([]);
	});

	it("throws INVALID_ARGUMENT when locator has an empty file part", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_NPM, manifest: "#subkey" })
		).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT when locator has an empty subkey part", async () => {
		await expect(
			discoverModules({ scanRoot: FIX_NPM, manifest: "file.json#" })
		).rejects.toThrow(/INVALID_ARGUMENT/);
	});
});
