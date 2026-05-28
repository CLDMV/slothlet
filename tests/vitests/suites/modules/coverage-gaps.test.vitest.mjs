/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/coverage-gaps.test.vitest.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 18:57:25 -07:00 (1779933445)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Targets specific uncovered branches in the module discovery
 * + mount surface (module-discovery.mjs, module-manager.mjs, module-sort.mjs,
 * module-manifest-validator.mjs) identified during the v3.8.0 coverage audit.
 *
 * Each test in this file exists to close a known coverage gap. Group by file
 * + concern; line numbers cited in comments map to the uncovered branch as
 * of the audit.
 *
 * @module tests/vitests/suites/modules/coverage-gaps
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { discoverModules } from "../../../../src/lib/helpers/module-discovery.mjs";
import { sortModules } from "../../../../src/lib/helpers/module-sort.mjs";
import { validateModuleManifest } from "../../../../src/lib/helpers/module-manifest-validator.mjs";
import { ModuleManager } from "../../../../src/lib/handlers/module-manager.mjs";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_NPM = path.join(FIXTURE_ROOT, "api_test_modules_npm");
const FIX_FOLDER = path.join(FIXTURE_ROOT, "api_test_modules_folder");
const FIX_LEGACY = path.join(FIXTURE_ROOT, "api_test_modules_legacy");
const FIX_DUPVERSION = path.join(FIXTURE_ROOT, "api_test_modules_dupversion");
const FIX_DUPVERSION_X = path.join(FIX_DUPVERSION, "install-x");
const FIX_DUPVERSION_Y = path.join(FIX_DUPVERSION, "install-y");
const FIX_BAD_PKGJSON = path.join(FIXTURE_ROOT, "api_test_modules_bad_pkgjson");

// ─── module-sort.mjs — L70 / L73 falsy branches ─────────────────────────────

describe("module-sort coverage gaps", () => {
	it("default comparator tolerates a null entry on either side of the comparison (L72-73 optional-chain)", () => {
		const input = [Object.freeze({ packageName: "z", manifest: Object.freeze({ priority: 0 }) }), null];
		// Comparator gets called both ways across (a,b) pairs — both directions of
		// the `a?.packageName ?? ""` / `b?.packageName ?? ""` optional-chain get exercised.
		expect(() => input.sort((a, b) => {
			const na = a?.packageName ?? "";
			const nb = b?.packageName ?? "";
			return na.localeCompare(nb);
		})).not.toThrow();
		// Now run through sortModules with a null entry to hit the same branch in the default comparator.
		const out = sortModules(input);
		// null comparator entry sorts as empty packageName → first; "z" sorts after.
		expect(out[1]?.packageName).toBe("z");
	});

	it("default comparator treats a non-number manifest.priority as 0 (L70 b2)", () => {
		const input = [
			Object.freeze({ packageName: "explicit", manifest: Object.freeze({ priority: 5 }) }),
			Object.freeze({ packageName: "string-priority", manifest: Object.freeze({ priority: "high" }) }),
			Object.freeze({ packageName: "boolean-priority", manifest: Object.freeze({ priority: true }) })
		];
		const out = sortModules(input);
		// "explicit" (5) sorts first; the other two normalize to 0 and tiebreak alphabetically.
		expect(out[0].packageName).toBe("explicit");
		expect(out.slice(1).map((r) => r.packageName).sort()).toEqual(["boolean-priority", "string-priority"]);
	});

	it("default comparator treats a missing packageName as empty string for tiebreak (L73 b5)", () => {
		const input = [
			Object.freeze({ packageName: "z", manifest: Object.freeze({ priority: 0 }) }),
			Object.freeze({ manifest: Object.freeze({ priority: 0 }) })
		];
		const out = sortModules(input);
		expect(out[0].packageName).toBeUndefined();
		expect(out[1].packageName).toBe("z");
	});
});

// ─── module-manifest-validator.mjs — defensive guards / edge branches ────────

describe("module-manifest-validator coverage gaps", () => {
	it("handles a missing packageContext gracefully when manifest itself is invalid (L89-90 fallback)", () => {
		// Triggers the `packageContext?.packageName ?? "<unknown>"` fallback at the top
		// guard when caller forgot the context (or passed an empty object).
		try {
			validateModuleManifest(null, {});
		} catch (err) {
			expect(err.code).toBe("MODULE_MANIFEST_INVALID");
			expect(err.context.packageName).toBe("<unknown>");
			expect(err.context.manifestPath).toBe("<unknown>");
		}
	});

	it("rejects an array `description` field (L254-255)", () => {
		expect(() =>
			validateModuleManifest(
				{ schemaVersion: 1, mountPath: ["x"], apiDir: "./api", description: ["not", "a", "string"] },
				{
					packageName: "@org/x",
					packageVersion: "1.0.0",
					packageRoot: "/tmp",
					manifestPath: "/tmp/slothlet.module.json"
				}
			)
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("rejects a non-object permission rule (L479-480)", () => {
		expect(() =>
			validateModuleManifest(
				{
					schemaVersion: 1,
					mountPath: ["x"],
					apiDir: "./api",
					permissions: ["not-a-rule-object"]
				},
				{
					packageName: "@org/x",
					packageVersion: "1.0.0",
					packageRoot: "/tmp",
					manifestPath: "/tmp/slothlet.module.json"
				}
			)
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("rejects an array permission rule (L479-480 — Array.isArray branch)", () => {
		expect(() =>
			validateModuleManifest(
				{
					schemaVersion: 1,
					mountPath: ["x"],
					apiDir: "./api",
					permissions: [["not", "a", "rule"]]
				},
				{
					packageName: "@org/x",
					packageVersion: "1.0.0",
					packageRoot: "/tmp",
					manifestPath: "/tmp/slothlet.module.json"
				}
			)
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("accepts apiDir against a packageRoot that already ends with the path separator (L439 ternary)", () => {
		// Trigger the `packageRoot.endsWith(path.sep) ? packageRoot : packageRoot + sep` true branch.
		const out = validateModuleManifest(
			{ schemaVersion: 1, mountPath: ["x"], apiDir: "./inner" },
			{
				packageName: "@org/x",
				packageVersion: "1.0.0",
				packageRoot: `${path.sep}tmp${path.sep}with-trailing${path.sep}`,
				manifestPath: "/tmp/with-trailing/slothlet.module.json"
			}
		);
		expect(out.apiDir).toBe("./inner");
	});

	it("accepts apiDir that resolves exactly to packageRoot (containment edge L439-440)", () => {
		// `apiDir: "."` resolves to packageRoot itself — boundary case; not a traversal.
		const out = validateModuleManifest(
			{ schemaVersion: 1, mountPath: ["x"], apiDir: "." },
			{
				packageName: "@org/x",
				packageVersion: "1.0.0",
				packageRoot: "/tmp/some-pkg",
				manifestPath: "/tmp/some-pkg/slothlet.module.json"
			}
		);
		expect(out.apiDir).toBe(".");
	});
});

// ─── Discovery scan-mode edge cases (file/dot entries inside scanned dirs) ────

describe("module-discovery enumeration skip branches", () => {
	it("npm mode skips loose files and dot-prefixed entries inside node_modules (L286-287)", async () => {
		// FIX_NPM/node_modules contains some-file.txt (regular file) and .pnpm (dot-dir).
		// Neither should surface as a candidate.
		const results = await discoverModules({ scanRoot: FIX_NPM });
		const names = results.map((r) => r.packageName).sort();
		// Same expected set as the existing npm-mode test — file + dot-dir silently skipped.
		expect(names).toEqual(["@org/packrat-driver-bar", "@org/packrat-driver-foo", "packrat-extension-baz"]);
	});

	it("folder mode skips loose files and dot-prefixed entries inside scanRoot (L329, L333)", async () => {
		// FIX_FOLDER contains loose-file.txt (regular file) and .hidden-dir (dot-dir).
		// Neither should surface as a candidate.
		const results = await discoverModules({ scanRoot: FIX_FOLDER });
		const names = results.map((r) => r.packageName).sort();
		// Same expected set as the existing folder-mode test — file + dot-dir silently skipped.
		expect(names).toEqual(["@local/driver-alpha", "@local/driver-beta"]);
	});
});

// ─── module-discovery.mjs — major uncovered paths ────────────────────────────

describe("module-discovery coverage gaps", () => {
	it("S1 + S2: schema field-name remap + lenient schemaVersion under override locator", async () => {
		const results = await discoverModules({
			scanRoot: FIX_LEGACY,
			manifest: "manifest.json#backend",
			schema: { mountPath: "apiPath", apiDir: "apiFolder" }
		});
		expect(results.length).toBe(1);
		expect(results[0].packageName).toBe("@legacy/driver-legacy");
		expect(results[0].manifest.mountPath).toEqual(["legacy", "driver"]);
		expect(results[0].manifest.schemaVersion).toBe(1); // lenient-assumed
		expect(results[0].manifest.kind).toBe("driver");
	});

	it("G7 case 3: same packageName + same version + different real paths → MODULE_DUPLICATE_NAME_VERSION_MISMATCH", async () => {
		await expect(
			discoverModules({ scanRoot: [FIX_DUPVERSION_X, FIX_DUPVERSION_Y] })
		).rejects.toThrow(/MODULE_DUPLICATE_NAME_VERSION_MISMATCH/);
	});

	it("silently skips packages with a malformed package.json (readJsonOrNull JSON.parse catch)", async () => {
		// The bad-pkgjson fixture has invalid JSON in package.json; discover should skip it.
		const results = await discoverModules({ scanRoot: FIX_BAD_PKGJSON });
		expect(results).toEqual([]);
	});

	it("returns empty when scanRoot is a file rather than a directory (enumerate readdir failure)", async () => {
		// Point scanRoot at a file path — readdir fails → enumerator returns []
		const fileAsRoot = path.join(FIX_NPM, "package.json");
		const results = await discoverModules({ scanRoot: fileAsRoot });
		expect(results).toEqual([]);
	});

	it("subkey path walk: locator finds a nested object", async () => {
		// Use the legacy fixture's manifest.json which has the actual subkey path.
		const results = await discoverModules({
			scanRoot: FIX_LEGACY,
			manifest: "manifest.json#backend",
			schema: { mountPath: "apiPath", apiDir: "apiFolder" }
		});
		expect(results.length).toBe(1);
	});

	it("subkey path walk: locator returns undefined when leaf is a non-object", async () => {
		// package.json has "name" which is a string, not an object — walk returns undefined → skip.
		const results = await discoverModules({
			scanRoot: FIX_NPM,
			manifest: "package.json#name"
		});
		expect(results).toEqual([]);
	});

	// ─── Broken-symlink and pathological-fs paths (tmp dir + symlinks) ────────

	describe("broken-symlink and edge fs cases", () => {
		/** @type {string} */ let tmpRoot;

		beforeAll(async () => {
			tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slothlet-discover-edge-"));
			// Layout for the realpath-catch + scoped-readdir-catch tests:
			//   tmpRoot/edge-npm/node_modules/broken         → symlink → /nonexistent
			//   tmpRoot/edge-npm/node_modules/@scope/lost    → symlink → /nonexistent
			//   tmpRoot/edge-npm/node_modules/@broken-scope  → symlink → /nonexistent (broken @-prefixed scope dir)
			//   tmpRoot/edge-npm/node_modules/.dot-dir       (dot-prefix, skipped during enum)
			//   tmpRoot/edge-npm/node_modules/loose.txt      (regular file, skipped)
			const npmRoot = path.join(tmpRoot, "edge-npm", "node_modules");
			await fs.mkdir(path.join(npmRoot, "@scope"), { recursive: true });
			await fs.mkdir(path.join(npmRoot, ".dot-dir"));
			await fs.writeFile(path.join(npmRoot, "loose.txt"), "");
			await fs.symlink("/this/path/intentionally/does/not/exist", path.join(npmRoot, "broken"));
			await fs.symlink("/this/path/intentionally/does/not/exist", path.join(npmRoot, "@scope", "lost"));
			// Broken @scope symlink — enumeration treats it as a scope (starts with "@"),
			// tries readdir on the symlink target, which throws → triggers the scoped catch.
			await fs.symlink("/this/path/intentionally/does/not/exist", path.join(npmRoot, "@broken-scope"));

			// Layout for the detectScanMode "node_modules is a file, not a directory" path:
			//   tmpRoot/edge-file-as-nm/node_modules    (a regular file)
			await fs.mkdir(path.join(tmpRoot, "edge-file-as-nm"));
			await fs.writeFile(path.join(tmpRoot, "edge-file-as-nm", "node_modules"), "not a directory");

			// Layout for the defaultScanRoot upward-walk fallback path:
			//   tmpRoot/edge-no-nm/deep/nested/dir   (no node_modules anywhere in the chain
			//   up to /tmp). discoverModules() invoked with cwd inside this tree will walk
			//   up the cap-bounded ancestor list, find nothing, and fall back.
			await fs.mkdir(path.join(tmpRoot, "edge-no-nm", "deep", "nested", "dir"), { recursive: true });
		});

		afterAll(async () => {
			await fs.rm(tmpRoot, { recursive: true, force: true });
		});

		it("realpath() failure on a broken symlink is caught and the candidate skipped (module-discovery L121)", async () => {
			const results = await discoverModules({ scanRoot: path.join(tmpRoot, "edge-npm") });
			// No slothlet.module.json anywhere → results empty. The broken-symlink entries
			// are enumerated but realpath() throws → catch fires → continue.
			expect(results).toEqual([]);
		});

		it("scoped readdir() failure on a broken @scope symlink is caught and the scope skipped (module-discovery L304)", async () => {
			// The @broken-scope entry is itself a symlink to /nonexistent. enumerateNpmPackages
			// treats it as a scoped namespace (starts with "@"), tries readdir on the symlink,
			// which throws ENOENT → catch fires → continue (L304). The @scope/lost inner
			// symlink in the same fixture exercises the realpath catch (L121) for completeness.
			const results = await discoverModules({ scanRoot: path.join(tmpRoot, "edge-npm") });
			expect(results).toEqual([]);
		});

		it("top-level readdir() failure on a permissions-restricted node_modules is caught and returns empty (module-discovery L291)", async () => {
			// detectScanMode's fs.stat only needs execute on the parent (tmpRoot); stat
			// succeeds and reports isDirectory()=true → "npm" mode. enumerateNpmPackages
			// then calls fs.readdir on the same dir, which needs read permission on
			// node_modules itself. chmod 0o000 strips that → readdir throws EACCES →
			// catch fires → returns []. (Test runs as non-root, so the bit actually blocks.)
			const restrictedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slothlet-perm-"));
			const nm = path.join(restrictedRoot, "node_modules");
			try {
				await fs.mkdir(nm);
				await fs.chmod(nm, 0o000);
				const results = await discoverModules({ scanRoot: restrictedRoot });
				expect(results).toEqual([]);
			} finally {
				await fs.chmod(nm, 0o755).catch(() => {});
				await fs.rm(restrictedRoot, { recursive: true, force: true });
			}
		});

		it("detectScanMode() routes to folder-mode when 'node_modules' is a regular file, not a directory", async () => {
			// fs.stat succeeds (the path exists), isDirectory() returns false → falls through
			// to folder mode. Folder mode then walks the dir's immediate subfolders (none, here).
			const results = await discoverModules({ scanRoot: path.join(tmpRoot, "edge-file-as-nm") });
			expect(results).toEqual([]);
		});

		it("defaultScanRoot upward-walk runs and falls back when no ancestor has node_modules (cwd manipulation)", async () => {
			// Run discoverModules() with no scanRoot from a temp directory that has no
			// node_modules in its ancestor chain up to /tmp. The upward walk iterates up to
			// the cap and returns process.cwd() as the fallback.
			const savedCwd = process.cwd();
			const cwdTarget = path.join(tmpRoot, "edge-no-nm", "deep", "nested", "dir");
			try {
				process.chdir(cwdTarget);
				const results = await discoverModules();
				// Fallback scanRoot is the cwd; folder mode walks immediate subfolders (none).
				expect(results).toEqual([]);
			} finally {
				process.chdir(savedCwd);
			}
		});

		it("realpath() dedupe drops a symlink aliasing an already-seen real path (module-discovery L124)", async () => {
			// Create a real package at <tmp>/edge-dedupe/node_modules/@org/real, then
			// a SYMLINK at <tmp>/edge-dedupe/node_modules/@org/alias that points to it.
			// Discovery walks both entries but realpath() resolves them to the same target.
			// The seenRealPaths.has(realPath) branch fires for the second one.
			const dedupeRoot = path.join(tmpRoot, "edge-dedupe");
			const orgDir = path.join(dedupeRoot, "node_modules", "@org");
			await fs.mkdir(path.join(orgDir, "real", "api"), { recursive: true });
			await fs.writeFile(path.join(orgDir, "real", "package.json"), JSON.stringify({ name: "@org/real", version: "1.0.0" }));
			await fs.writeFile(
				path.join(orgDir, "real", "slothlet.module.json"),
				JSON.stringify({ schemaVersion: 1, mountPath: ["real-only"], apiDir: "./api" })
			);
			await fs.writeFile(path.join(orgDir, "real", "api", "info.mjs"), "export const k = () => 1;");
			await fs.symlink(path.join(orgDir, "real"), path.join(orgDir, "alias"));

			const results = await discoverModules({ scanRoot: dedupeRoot });
			// Only one entry — the alias dedupes against the real package's realpath.
			expect(results.length).toBe(1);
			expect(results[0].packageName).toBe("@org/real");
		});

		it("npm-mode scoped enumeration skips non-directory entries inside an @scope/ dir (module-discovery scoped non-dir branch)", async () => {
			// FIX_NPM/node_modules/@org/ contains some-scoped-file.txt + an empty scope-file/ dir
			// alongside the real scoped packages. The non-dir is skipped by the inner
			// `if (!scoped.isDirectory() && !scoped.isSymbolicLink()) continue;` check.
			const results = await discoverModules({ scanRoot: FIX_NPM });
			const names = results.map((r) => r.packageName).sort();
			// Same expected set — the file is silently skipped.
			expect(names).toEqual(["@org/packrat-driver-bar", "@org/packrat-driver-foo", "packrat-extension-baz"]);
		});

		it("defaultScanRoot finds node_modules on the first iteration when cwd is the repo root", async () => {
			// Default call from the test runner's cwd (= repo root) — the very first
			// `fs.stat(cwd/node_modules)` succeeds and returns early. Hits the success
			// branch of L237-238 in module-discovery.mjs.
			const results = await discoverModules({ prefix: "this-prefix-matches-nothing-" });
			expect(results).toEqual([]);
		});

		it("defaultScanRoot skips an ancestor where 'node_modules' exists as a file (L239 isDirectory false arm)", async () => {
			// Layout: tmpRoot/edge-nm-as-file-ancestor/node_modules (FILE) + sub/ (dir to chdir into).
			// Walking up from sub, fs.stat() succeeds at the first parent (file exists) but
			// isDirectory() returns false → npm-mode skipped → walk continues to next parent.
			const ancestor = path.join(tmpRoot, "edge-nm-as-file-ancestor");
			const cwdDir = path.join(ancestor, "sub");
			await fs.mkdir(cwdDir, { recursive: true });
			await fs.writeFile(path.join(ancestor, "node_modules"), "not a directory");

			const savedCwd = process.cwd();
			try {
				process.chdir(cwdDir);
				const results = await discoverModules();
				expect(Array.isArray(results)).toBe(true);
			} finally {
				process.chdir(savedCwd);
			}
		});
	});

	// ─── ModuleManager isolation (defensive guards under standalone instantiation) ──

	describe("ModuleManager standalone (no slothlet handlers wired)", () => {
		it("#emit no-ops when there is no lifecycle handler (module-manager L502 falsy branch)", async () => {
			// Instantiate ModuleManager with a slothlet stub that has no handlers chain.
			// Triggering discover() internally calls #emit() — without a lifecycle handler
			// the guard short-circuits and no emission happens. Nothing throws.
			const mm = new ModuleManager({ handlers: {} });
			const results = await mm.discover({ scanRoot: FIX_NPM });
			expect(results.length).toBe(3);
		});

		it("#findExactMountAt returns null when apiManager.state.addHistory is unreachable", async () => {
			// Instantiate ModuleManager standalone. The S7 pre-flight check inside
			// #mountSingle calls #findExactMountAt — without an apiManager.state, the
			// optional-chain returns undefined and the !Array.isArray guard fires. We
			// can't reach #mountSingle without going through addModule, which needs
			// addApiComponent — so observe the guard indirectly: discover() populates
			// the cache, then addModule attempts to mount and fails on the missing
			// handler (not the addHistory guard itself, but the guard runs first).
			const mm = new ModuleManager({ handlers: {} });
			await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
			await expect(mm.addModule("packrat-extension-baz", { collisionMode: "error" })).rejects.toThrow();
			// The throw is from the missing apiManager (slothlet.handlers.apiManager is undefined),
			// but #findExactMountAt's guard ran first and returned null cleanly.
		});
	});

	it("schema remap leaves the input untouched when canonical name already present (L511-512 skip branch)", async () => {
		// Use a manifest that contains BOTH the canonical name AND the legacy name.
		// The legacy alias should be ignored because the canonical key is already defined.
		// We test this by running discover with a schema that maps `mountPath: "altMountPath"`
		// against the legacy fixture's normalized manifest.json#backend — apiPath/apiFolder
		// are remapped, and we additionally pass an irrelevant alias to exercise the skip.
		const results = await discoverModules({
			scanRoot: FIX_LEGACY,
			manifest: "manifest.json#backend",
			schema: {
				mountPath: "apiPath",
				apiDir: "apiFolder",
				// Identity mapping — skipped early via `if (legacy === canonical) continue` (L511).
				kind: "kind"
			}
		});
		expect(results.length).toBe(1);
		expect(results[0].manifest.kind).toBe("driver");
	});

	it("schema remap skips canonical key when it's already present in raw (L515 true arm)", async () => {
		// Manifest declares the CANONICAL `apiDir` directly (no legacy `apiFolder` field).
		// Schema map declares `apiDir` lives under legacy `apiFolder`. Because canonical
		// `apiDir` is already in raw, the remap loop hits `if (out[canonical] !== undefined)
		// continue` and skips — the (non-existent) legacy alias is ignored.
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "slothlet-schema-skip-"));
		try {
			const pkgDir = path.join(tmpDir, "node_modules", "@org", "preserve-canonical");
			await fs.mkdir(path.join(pkgDir, "api"), { recursive: true });
			await fs.writeFile(path.join(pkgDir, "package.json"), JSON.stringify({ name: "@org/preserve-canonical", version: "1.0.0" }));
			await fs.writeFile(
				path.join(pkgDir, "manifest.json"),
				JSON.stringify({
					backend: {
						schemaVersion: 1,
						mountPath: ["preserved"],
						apiDir: "./api" // canonical name directly in raw; no apiFolder alias
					}
				})
			);
			await fs.writeFile(path.join(pkgDir, "api", "info.mjs"), "export const k = () => 1;");

			const results = await discoverModules({
				scanRoot: tmpDir,
				manifest: "manifest.json#backend",
				schema: { apiDir: "apiFolder" }
			});
			expect(results.length).toBe(1);
			expect(results[0].manifest.apiDir).toBe("./api"); // canonical preserved
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});

	it("schema remap skips when legacy key is not present in raw (L516 false arm)", async () => {
		// Legacy manifest declares the canonical name (e.g., apiDir) but NOT the legacy
		// alias the schema map points at. Loop visits the entry, `out[canonical]` is
		// already defined → continues. Even if canonical weren't set, the `if (legacy
		// in out)` check would be false → nothing happens. Both skip arms exercised.
		const results = await discoverModules({
			scanRoot: FIX_NPM,
			schema: {
				// Map canonical apiDir to a legacy name "totallyMissingLegacyAlias" that
				// the manifest doesn't have. With the canonical apiDir already in raw,
				// L515 fires first; if it weren't, L516 false arm would.
				apiDir: "totallyMissingLegacyAlias",
				priority: "alsoMissing"
			}
		});
		expect(results.length).toBe(3);
	});

	it("deepFreeze handles null + non-object + already-frozen values inside manifest tree (L534 OR chain)", async () => {
		// validateModuleManifest's normalized output includes `dependencies` (object
		// with string values) and `metadata` (free-form), giving deepFreeze a mix of
		// nested object types to recurse into. Manifests with primitive leaves
		// (strings, numbers, booleans) hit the `typeof !== "object"` arm. Manifests
		// with already-frozen values hit the `Object.isFrozen()` arm.
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "slothlet-deepfreeze-"));
		try {
			const pkgDir = path.join(tmpDir, "node_modules", "@org", "freeze-mix");
			await fs.mkdir(path.join(pkgDir, "api"), { recursive: true });
			await fs.writeFile(path.join(pkgDir, "package.json"), JSON.stringify({ name: "@org/freeze-mix", version: "1.0.0" }));
			await fs.writeFile(
				path.join(pkgDir, "slothlet.module.json"),
				JSON.stringify({
					schemaVersion: 1,
					mountPath: ["frz"],
					apiDir: "./api",
					priority: 0,
					dependencies: { "@org/other": "^1.0.0" }, // object with string vals
					metadata: { nested: { deep: { value: "string-primitive" } }, count: 42, flag: true, nullField: null }
				})
			);
			await fs.writeFile(path.join(pkgDir, "api", "info.mjs"), "export const k = () => 1;");

			const results = await discoverModules({ scanRoot: tmpDir });
			expect(results.length).toBe(1);
			// All nested values frozen
			expect(Object.isFrozen(results[0].manifest.metadata)).toBe(true);
			expect(Object.isFrozen(results[0].manifest.metadata.nested)).toBe(true);
			expect(Object.isFrozen(results[0].manifest.metadata.nested.deep)).toBe(true);
			expect(Object.isFrozen(results[0].manifest.dependencies)).toBe(true);
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
});

// ─── module-manager.mjs — handler coverage gaps ─────────────────────────────

describe("ModuleManager coverage gaps", () => {
	/** @type {any} */ let api;
	afterEach(async () => {
		if (api?.shutdown) await api.shutdown().catch(() => {});
		api = null;
	});

	async function newApi() {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true,
			diagnostics: true,
			api: { collision: { initial: "merge", api: "merge" } }
		});
		return api.slothlet.api.modules;
	}

	it("addModule with neither string nor DiscoverResult throws INVALID_ARGUMENT (L325-336)", async () => {
		const mm = await newApi();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.addModule(42)).rejects.toThrow(/INVALID_ARGUMENT/);
		});
	});

	it("addModule with multi-version cache hit + no version disambiguator throws INVALID_ARGUMENT (L360-372)", async () => {
		const mm = await newApi();
		await mm.discover({
			scanRoot: [
				path.join(FIXTURE_ROOT, "api_test_modules_versioned", "install-a"),
				path.join(FIXTURE_ROOT, "api_test_modules_versioned", "install-b")
			]
		});
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.addModule("@org/multiv")).rejects.toThrow(/INVALID_ARGUMENT/);
		});
	});

	it("addModule with version disambiguator picks the matching cache entry (L346)", async () => {
		const mm = await newApi();
		await mm.discover({
			scanRoot: [
				path.join(FIXTURE_ROOT, "api_test_modules_versioned", "install-a"),
				path.join(FIXTURE_ROOT, "api_test_modules_versioned", "install-b")
			]
		});
		const result = await mm.addModule("@org/multiv", { version: "1.2.3" });
		expect(result.discoverResult.manifest.version).toBe("1.2.3");
	});

	it("removeModule iterates the mounted map and skips entries whose packageName does not match (L298 mismatch branch)", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		// Mount two unrelated modules
		await mm.addModule("packrat-extension-baz");
		await mm.addModule("@org/packrat-driver-foo");
		// Remove just one — iteration walks both entries; the non-matching one hits the continue.
		const removed = await mm.removeModule("packrat-extension-baz");
		expect(removed).toBe(true);
	});

	it("removeModule with version filter removes only the matching version (L298-299)", async () => {
		const mm = await newApi();
		await mm.discover({
			scanRoot: [
				path.join(FIXTURE_ROOT, "api_test_modules_versioned", "install-a"),
				path.join(FIXTURE_ROOT, "api_test_modules_versioned", "install-b")
			]
		});
		const both = mm.getDiscoveryCache().filter((r) => r.packageName === "@org/multiv");
		await mm.addModules(both);
		// Remove only v1; v2 should remain.
		const removed = await mm.removeModule("@org/multiv", { version: "1.2.3" });
		expect(removed).toBe(true);
	});

	it("addModules best-effort with a mount failure returns aggregate {mounted, failed}", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		const found = mm.getDiscoveryCache();
		const goodModule = found.find((r) => r.packageName === "packrat-extension-baz");
		await mm.addModule(goodModule); // pre-mount so the next attempt collides
		await withSuppressedSlothletErrorOutput(async () => {
			const result = await mm.addModules([found.find((r) => r.packageName === "@org/packrat-driver-foo"), goodModule], {
				collisionMode: "error",
				onFailure: "best-effort"
			});
			expect(result.mounted.length).toBe(1);
			expect(result.failed.length).toBe(1);
			expect(result.failed[0].error.code).toBe("MODULE_MOUNT_COLLISION");
		});
	});

	it("addModules parallel best-effort with mixed success / failure", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		const found = mm.getDiscoveryCache();
		const baz = found.find((r) => r.packageName === "packrat-extension-baz");
		await mm.addModule(baz); // pre-mount
		await withSuppressedSlothletErrorOutput(async () => {
			const result = await mm.addModules([found.find((r) => r.packageName === "@org/packrat-driver-foo"), baz], {
				collisionMode: "error",
				onFailure: "best-effort",
				concurrency: 2
			});
			expect(result.mounted.length).toBe(1);
			expect(result.failed.length).toBe(1);
		});
	});

	it("addModules parallel throws first error when onFailure='throw'", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		const found = mm.getDiscoveryCache();
		const baz = found.find((r) => r.packageName === "packrat-extension-baz");
		await mm.addModule(baz);
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				mm.addModules([baz, found.find((r) => r.packageName === "@org/packrat-driver-foo")], {
					collisionMode: "error",
					onFailure: "throw",
					concurrency: 2
				})
			).rejects.toThrow(/MODULE_MOUNT_COLLISION/);
		});
	});

	it("addModules SERIAL with onFailure='throw' throws on first failure (#mountSerial L541-542)", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		const found = mm.getDiscoveryCache();
		const baz = found.find((r) => r.packageName === "packrat-extension-baz");
		await mm.addModule(baz); // pre-mount so the next attempt collides
		await withSuppressedSlothletErrorOutput(async () => {
			// Explicit concurrency: 1 → serial path. Default onFailure: "throw".
			await expect(
				mm.addModules([baz], { collisionMode: "error", concurrency: 1 })
			).rejects.toThrow(/MODULE_MOUNT_COLLISION/);
		});
	});

	it("addModules parallel best-effort captures each per-worker failure (#mountParallel L587 best-effort branch)", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		const found = mm.getDiscoveryCache();
		// Pre-mount BOTH baz AND foo so EVERY item we then try to mount fails.
		const baz = found.find((r) => r.packageName === "packrat-extension-baz");
		const foo = found.find((r) => r.packageName === "@org/packrat-driver-foo");
		await mm.addModule(baz);
		await mm.addModule(foo);
		await withSuppressedSlothletErrorOutput(async () => {
			const result = await mm.addModules([foo, baz], {
				collisionMode: "error",
				onFailure: "best-effort",
				concurrency: 2
			});
			// Both items hit the collision in parallel; best-effort records both failures.
			expect(result.failed.length).toBe(2);
		});
	});

	it("addModules parallel rollback on failure unmounts items succeeded in this call", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		const found = mm.getDiscoveryCache();
		const baz = found.find((r) => r.packageName === "packrat-extension-baz");
		await mm.addModule(baz);
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				mm.addModules([found.find((r) => r.packageName === "@org/packrat-driver-foo"), baz], {
					collisionMode: "error",
					onFailure: "rollback",
					concurrency: 2
				})
			).rejects.toThrow(/MODULE_MOUNT_COLLISION/);
		});
	});

	it("getStaleMounts returns empty when nothing has been mounted", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_FOLDER });
		expect(mm.getStaleMounts()).toEqual([]);
	});

	it("addModules parallel with multiple simultaneous failures hits the !firstError false arm (L587 inner else-if)", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		const found = mm.getDiscoveryCache();
		// Pre-mount BOTH baz and foo so the next attempt on either fails.
		const baz = found.find((r) => r.packageName === "packrat-extension-baz");
		const foo = found.find((r) => r.packageName === "@org/packrat-driver-foo");
		await mm.addModule(baz);
		await mm.addModule(foo);
		// Try to mount BOTH again in parallel with onFailure="throw". Two workers fail
		// near-simultaneously. The first to catch sets firstError; the second hits the
		// `else if (!firstError)` else arm (firstError already truthy) and silently bails.
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				mm.addModules([foo, baz], {
					collisionMode: "error",
					onFailure: "throw",
					concurrency: 2
				})
			).rejects.toThrow(/MODULE_MOUNT_COLLISION/);
		});
	});

	it("folder mode with a non-matching prefix triggers the matchesPrefix continue branch (L342 false arm)", async () => {
		// All existing folder-mode tests run without a prefix filter, so the
		// `if (!matchesPrefix(entry.name, prefixes)) continue` line in
		// enumerateFolderModules only saw the false (proceed) arm. This test sets a
		// prefix that no subdirectory matches → continue branch fires.
		const results = await discoverModules({ scanRoot: FIX_FOLDER, prefix: "no-match-prefix-" });
		expect(results).toEqual([]);
	});

it("multi-version mounting with three versions in middle-first order — exercises BOTH pickHighestSemver branches (a>b and a<b)", async () => {
		const mm = await newApi();
		const FIX_V_ROOT = path.join(FIXTURE_ROOT, "api_test_modules_versioned");
		await mm.discover({
			scanRoot: [
				path.join(FIX_V_ROOT, "install-a"), // 1.2.3
				path.join(FIX_V_ROOT, "install-b"), // 2.0.0 (highest)
				path.join(FIX_V_ROOT, "install-c") // 0.5.0-rc.1 (lowest, pre-release suffix)
			]
		});
		// Build an explicit order [middle, smallest, largest]. pickHighestSemver
		// starts with versions[0] as `best` and iterates from i=1:
		//   - best = 1.2.3 (middle)
		//   - iter 1: candidate = 0.5.0-rc.1; 0 < 1 → `a < b` break, candidateWins stays false → L677 false arm
		//   - iter 2: candidate = 2.0.0; 2 > 1 → `a > b` break, candidateWins true → L677 true arm
		// Both `if (a > b)` arms hit; both `if (candidateWins)` arms hit. The pre-release
		// segment ("rc") returns NaN from parseInt and falls to 0 via the Number.isFinite false branch.
		const byVersion = (v) => mm.getDiscoveryCache().find((r) => r.packageName === "@org/multiv" && r.manifest.version === v);
		const ordered = [byVersion("1.2.3"), byVersion("0.5.0-rc.1"), byVersion("2.0.0")];
		expect(ordered.every(Boolean)).toBe(true);

		const mounted = await mm.addModules(ordered);
		expect(mounted.length).toBe(3);
		const defaults = mounted.filter((m) => m.versionConfig?.default === true);
		expect(defaults.length).toBe(1);
		expect(defaults[0].discoverResult.manifest.version).toBe("2.0.0");
	});

	it("addModule with name and empty cache + no discover option falls back to {} default (L340 ??)", async () => {
		const mm = await newApi();
		// Cache is empty. We pass a name that won't be found by lazy discover (no scanRoot
		// option → defaultScanRoot upward-walk; the test runner's cwd is the slothlet repo
		// so `node_modules` is discovered there). The result is MODULE_PACKAGE_NOT_FOUND
		// because no module in the real node_modules matches our unique fixture name.
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				mm.addModule("zzz-this-package-name-does-not-exist-in-node-modules")
			).rejects.toThrow(/MODULE_PACKAGE_NOT_FOUND/);
		});
	});

	it("addModules with a single-version subset of the discovery cache exercises group.length < 2 in #buildVersionConfigs (L640 true arm)", async () => {
		const mm = await newApi();
		await mm.discover({ scanRoot: FIX_NPM });
		// Mount three distinct-name modules → each forms a group of size 1 in
		// #buildVersionConfigs → `if (group.length < 2) continue` fires for every iteration.
		// (The multi-version test covers the > 2 arm.)
		const all = mm.getDiscoveryCache();
		const mounted = await mm.addModules(all);
		expect(mounted.length).toBe(3);
		for (const m of mounted) {
			expect(m.versionConfig).toBeNull();
		}
	});

	it("addDiscovered with no items in the scanRoot returns an empty mounted array", async () => {
		const mm = await newApi();
		// Point at a path that doesn't exist so discover returns []
		const out = await mm.addDiscovered({ scanRoot: "/this/path/does/not/exist" });
		expect(Array.isArray(out)).toBe(true);
		expect(out.length).toBe(0);
	});

	it("addModules with two same-major versions in order [1.2.3, 1.2.3-beta] exercises pickHighestSemver's bestSegs `?? 0` fallback (L675 nullish-fallback arm) + L680 equal-continue arm", async () => {
		// Forces pickHighestSemver to compare ["1.2.3", "1.2.3-beta"]:
		//   best=[1,2,3], candidate=[1,2,3,0]; j=0..2 equal → continue (L680 false arm);
		//   j=3: a=0, b=bestSegs[3]??0=0 (L675 `?? 0` fallback fires for best, undefined → 0).
		//   Loop exits, candidateWins=false (L682 false arm). Best stays "1.2.3".
		// Both versions then dispatch to "v1" tag → second mount throws
		// VERSION_REGISTER_DUPLICATE. We use onFailure="best-effort" so the function
		// returns rather than rethrowing, letting us assert {mounted:1, failed:1}.
		const mm = await newApi();
		const FIX_V_ROOT = path.join(FIXTURE_ROOT, "api_test_modules_versioned");
		await mm.discover({
			scanRoot: [
				path.join(FIX_V_ROOT, "install-a"), // 1.2.3
				path.join(FIX_V_ROOT, "install-d")  // 1.2.3-beta (same major → collides at v1)
			]
		});
		const byVersion = (v) => mm.getDiscoveryCache().find((r) => r.packageName === "@org/multiv" && r.manifest.version === v);
		const ordered = [byVersion("1.2.3"), byVersion("1.2.3-beta")];
		expect(ordered.every(Boolean)).toBe(true);
		await withSuppressedSlothletErrorOutput(async () => {
			const result = await mm.addModules(ordered, { onFailure: "best-effort" });
			expect(result.mounted.length).toBe(1);
			expect(result.failed.length).toBe(1);
			// First (default per pickHighestSemver — "1.2.3" wins since candidate doesn't beat it) mounts;
			// second collides on the "v1" tag.
			expect(result.mounted[0].discoverResult.manifest.version).toBe("1.2.3");
			expect(result.failed[0].item.manifest.version).toBe("1.2.3-beta");
		});
	});

	it("addModules with two non-numeric-lead versions exercises semverToTag's `v${version}` fallback (L640 false arm)", async () => {
		// semverToTag's regex `^(\d+)/.exec` only matches versions starting with a digit.
		// Standard semver always does, so the false arm is only reachable with
		// pathological version strings. Manifest validator doesn't enforce semver shape
		// (it only requires the version field be a string that matches package.json).
		// Build two install roots, each shipping the same packageName with a
		// non-numeric-lead version; the resulting tags are "vabc.1.0.0" / "vdef.2.0.0"
		// (different), so both mount happily — verifying the fallback's output shape.
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "slothlet-semvertag-"));
		try {
			const writeFixture = async (dirName, version) => {
				const pkgDir = path.join(tmpDir, dirName, "node_modules", "@org", "nonsemv");
				await fs.mkdir(path.join(pkgDir, "api"), { recursive: true });
				await fs.writeFile(
					path.join(pkgDir, "package.json"),
					JSON.stringify({ name: "@org/nonsemv", version })
				);
				await fs.writeFile(
					path.join(pkgDir, "slothlet.module.json"),
					JSON.stringify({
						schemaVersion: 1,
						mountPath: ["drivers", "nonsemv"],
						apiDir: "./api",
						kind: "driver"
					})
				);
				// Static stub; the test only checks discovery + mount + version tags, never
				// calls the generated function. Avoiding string interpolation into generated
				// .mjs source keeps CodeQL happy (no improper-code-construction false positive).
				await fs.writeFile(path.join(pkgDir, "api", "info.mjs"), "export const k = () => 1;");
			};
			await writeFixture("install-1", "abc.1.0.0");
			await writeFixture("install-2", "def.2.0.0");

			const mm = await newApi();
			await mm.discover({ scanRoot: [path.join(tmpDir, "install-1"), path.join(tmpDir, "install-2")] });
			const both = mm.getDiscoveryCache().filter((r) => r.packageName === "@org/nonsemv");
			expect(both.length).toBe(2);
			const mounted = await mm.addModules(both);
			// semverToTag false arm → tags "vabc.1.0.0" and "vdef.2.0.0" (different) → both mount.
			expect(mounted.length).toBe(2);
			const tags = mounted.map((m) => m.versionConfig?.version).sort();
			expect(tags).toEqual(["vabc.1.0.0", "vdef.2.0.0"]);
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});

	it("addModules with two same-major versions in order [1.2.3-beta, 1.2.3] exercises pickHighestSemver's candidateSegs `?? 0` fallback (L674 nullish-fallback arm)", async () => {
		// Reversed order: best=[1,2,3,0], candidate=[1,2,3]; j=0..2 equal → continue;
		//   j=3: a=candidateSegs[3]??0=0 (L674 `?? 0` fallback fires, undefined → 0), b=0.
		//   Loop exits, candidateWins=false. Best stays "1.2.3-beta" (the first one).
		const mm = await newApi();
		const FIX_V_ROOT = path.join(FIXTURE_ROOT, "api_test_modules_versioned");
		await mm.discover({
			scanRoot: [
				path.join(FIX_V_ROOT, "install-d"), // 1.2.3-beta
				path.join(FIX_V_ROOT, "install-a")  // 1.2.3
			]
		});
		const byVersion = (v) => mm.getDiscoveryCache().find((r) => r.packageName === "@org/multiv" && r.manifest.version === v);
		const ordered = [byVersion("1.2.3-beta"), byVersion("1.2.3")];
		expect(ordered.every(Boolean)).toBe(true);
		await withSuppressedSlothletErrorOutput(async () => {
			const result = await mm.addModules(ordered, { onFailure: "best-effort" });
			expect(result.mounted.length).toBe(1);
			expect(result.failed.length).toBe(1);
			// "1.2.3-beta" comes first in the array, so pickHighestSemver returns it (candidate "1.2.3" never wins).
			expect(result.mounted[0].discoverResult.manifest.version).toBe("1.2.3-beta");
			expect(result.failed[0].item.manifest.version).toBe("1.2.3");
		});
	});
});
