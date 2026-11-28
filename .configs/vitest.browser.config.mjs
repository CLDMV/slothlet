/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /.configs/vitest.browser.config.mjs
 *	@Date: 2026-06-16T19:29:13-07:00 (1781663353)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T22:03:08-08:00 (1795845788)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Vitest **browser-mode** project: runs slothlet's browser-only code paths in a real
 * headless Chromium (Playwright provider) so the `!isNode` arms are genuinely exercised rather than
 * v8-ignored. Coverage is collected via the same v8 provider as the node suite, so the two
 * coverage-final.json reports share identical maps and merge cleanly (see tools/coverage/merge-browser-coverage.mjs).
 *
 * The config (node side) pre-generates the browser fixture manifest and exposes it to browser tests
 * via `virtual:browser-fixture-manifest` — generateBrowserAssets reads the filesystem and can't run
 * in the browser. Compose tests then mount that fixture in real browser mode to drive the runtime
 * `!isNode` arms (context-async null-ALS + tryGetContext, the Map-based lifecycle emitter, and the
 * EventEmitter enable/disable/cleanup arms reached via api.shutdown()).
 */

import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const slothletCondition = "slothlet-dev";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = resolve(REPO, "api_tests/api_test_browser");
const FIXTURE_REL = "api_tests/api_test_browser";
// A leaf whose helper files use slothlet's internal exports, inside and outside the module's folder.
const HELPER_REL = "api_tests/api_test_browser_internal_helper/api";
// A callable api root: its function's own members by every route, and its own code's reads.
const ROUTES_REL = "api_tests/api_test_function_member_routes/api";
const ROOT_LEAF_REL = "api_tests/api_test_root_own_leaf/plain";
const SELF_FN_REL = "api_tests/api_test_self_parity/api";
const SELF_OBJ_REL = "api_tests/api_test_self_parity_objroot/api";
// A sibling api file that imports a leaf's file itself.
const LEAF_COPY_REL = "api_tests/api_test_leaf_file_import_browser";
// A module turning strings into code by every route a browser offers (built-in capabilities).
const CODE_STRINGS_REL = "api_tests/api_test_code_strings_browser/api";

export default defineConfig(async () => {
	// Loaded by Node itself, not bundled into the config: vite bundles this file without the
	// `slothlet-dev` condition, so a static import here resolved generate-manifest's `#errors` /
	// `#helpers/*` imports to dist/ and the config failed to load (ERR_PACKAGE_IMPORT_NOT_DEFINED)
	// in any checkout without a build. A computed specifier stays external, and Node (started with
	// `--conditions=slothlet-dev` by the coverage:browser script) resolves those imports to src/.
	const { generateBrowserAssets, generateManifest } = await import(
		pathToFileURL(resolve(REPO, "src/lib/helpers/generate-manifest.mjs")).href
	);
	// Built once in node; the browser can't read the fixture tree to build a manifest itself.
	const { manifest, importmap } = await generateBrowserAssets(FIXTURE_DIR, { base: "/" });
	const helperManifest = await generateManifest(resolve(REPO, HELPER_REL));
	const routesManifest = await generateManifest(resolve(REPO, ROUTES_REL));
	const rootLeafManifest = await generateManifest(resolve(REPO, ROOT_LEAF_REL));
	const selfFnManifest = await generateManifest(resolve(REPO, SELF_FN_REL));
	const selfObjManifest = await generateManifest(resolve(REPO, SELF_OBJ_REL));
	const leafCopyManifest = await generateManifest(resolve(REPO, LEAF_COPY_REL));
	const codeStringsManifest = await generateManifest(resolve(REPO, CODE_STRINGS_REL));

	// slothlet resolves internal modules at runtime via `import(<computed bare specifier>)`, which vite
	// can't statically rewrite — so the browser needs an importmap for them. Point it at the vite-served
	// /src/* URLs (rewrite the default /dist/*) so those modules still go through vite's transform and
	// their v8 coverage maps to src/** (the whole reason this beats the raw-source playwright-smoke).
	// The importmap maps slothlet's own specifiers under `scopes` for slothlet's own files, so the page gets
	// the whole object, `scopes` included.
	const toSrc = (entries) => Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v.replace("/dist/lib/", "/src/lib/")]));
	const imports = toSrc(importmap.imports);
	const scopes = Object.fromEntries(
		Object.entries(importmap.scopes ?? {}).map(([scope, entries]) => [scope.replace("/dist/", "/src/"), toSrc(entries)])
	);

	/** Expose the node-built fixture manifest + its served base path to browser tests. */
	const fixtureManifestPlugin = {
		name: "slothlet-browser-fixture-manifest",
		resolveId(id) {
			if (id === "virtual:browser-fixture-manifest") return "\0virtual:browser-fixture-manifest";
		},
		load(id) {
			if (id === "\0virtual:browser-fixture-manifest") {
				return (
					`export const manifest = ${JSON.stringify(manifest)};\nexport const fixtureRel = ${JSON.stringify(FIXTURE_REL)};\n` +
					`export const helperManifest = ${JSON.stringify(helperManifest)};\nexport const helperRel = ${JSON.stringify(HELPER_REL)};\n` +
					`export const routesManifest = ${JSON.stringify(routesManifest)};\nexport const routesRel = ${JSON.stringify(ROUTES_REL)};\n` +
					`export const rootLeafManifest = ${JSON.stringify(rootLeafManifest)};\nexport const rootLeafRel = ${JSON.stringify(ROOT_LEAF_REL)};\n` +
					`export const selfFnManifest = ${JSON.stringify(selfFnManifest)};\nexport const selfFnRel = ${JSON.stringify(SELF_FN_REL)};\n` +
					`export const selfObjManifest = ${JSON.stringify(selfObjManifest)};\nexport const selfObjRel = ${JSON.stringify(SELF_OBJ_REL)};\n` +
					`export const leafCopyManifest = ${JSON.stringify(leafCopyManifest)};\nexport const leafCopyRel = ${JSON.stringify(LEAF_COPY_REL)};\n` +
					`export const codeStringsManifest = ${JSON.stringify(codeStringsManifest)};\nexport const codeStringsRel = ${JSON.stringify(CODE_STRINGS_REL)};\n`
				);
			}
		},
		// Inject slothlet's importmap into the tester page (head-prepend, before any module script) so
		// the runtime dynamic bare-specifier imports resolve to the vite-served src modules.
		transformIndexHtml() {
			return [{ tag: "script", attrs: { type: "importmap" }, children: JSON.stringify({ imports, scopes }), injectTo: "head-prepend" }];
		}
	};

	return {
		resolve: {
			// Resolve @cldmv/slothlet to src (slothlet-dev) and prefer the browser condition,
			// matching how the package loads in a real browser.
			conditions: [slothletCondition, "module", "browser", "development|production"]
		},
		plugins: [fixtureManifestPlugin],
		// Do NOT let vite pre-bundle slothlet — pre-bundled deps are served as an optimized bundle and
		// their coverage can't map back to src/**. Inlining serves them as source (vite-transformed,
		// with sourcemaps), so v8 coverage remaps to the real source files.
		optimizeDeps: { exclude: ["@cldmv/slothlet"] },
		test: {
			// Off for the same reason as in vitest.config.mjs: the cache never serves slothlet's suite and only grows.
			fsModuleCache: false,
			server: { deps: { inline: [/@cldmv\/slothlet/] } },
			include: ["tests/browser/**/*.browser.test.mjs"],
			exclude: ["node_modules"],
			globals: true,
			// Retry transient headless-Chromium flakes (browser-launch / RPC hiccups) so a one-off failure
			// doesn't redden the badge job; a genuine, repeatable failure still fails (not weakened away).
			retry: 2,
			browser: {
				enabled: true,
				provider: playwright(),
				headless: true,
				instances: [{ browser: "chromium" }]
			},
			coverage: {
				provider: "v8",
				// Scope to ONLY the modules with browser-only arms. The merge then touches just these
				// files (combined with the map-identical guard in merge-browser-coverage.mjs); instrumenting
				// the whole tree pulls in files the browser never ran (e.g. typegen), whose maps differ from
				// node's and corrupt a naive merge.
				include: [
					"src/lib/i18n/translations.mjs",
					"src/lib/helpers/platform-host.mjs",
					"src/lib/helpers/platform.browser.mjs",
					"src/lib/helpers/eventemitter-context.mjs",
					"src/lib/handlers/context-async.mjs",
					"src/lib/builders/api_builder.mjs",
					"src/slothlet.mjs",
					// Files with their own `isNode` / `getBuiltinModule?.()` / `globalThis.process` arms.
					"src/lib/handlers/frame-placement.mjs",
					"src/lib/handlers/unified-wrapper.mjs",
					"src/lib/handlers/shared-values.mjs",
					"src/lib/handlers/context-live.mjs",
					"src/lib/helpers/async-resource-context.mjs",
					"src/lib/helpers/async-store-slot.mjs",
					"src/lib/helpers/capability-context.mjs",
					"src/lib/helpers/clone-context.mjs",
					"src/lib/helpers/config.mjs",
					"src/lib/helpers/intrinsics.mjs",
					"src/lib/helpers/node-callback-context.mjs",
					"src/lib/helpers/permission-baseline.mjs",
					"src/lib/helpers/scheduler-context.mjs",
					"src/lib/processors/loader.mjs"
				],
				exclude: ["**/*.json", "api_tests/**", "tests/**", "tools/**"],
				// Separate dir so it doesn't clobber the node run's coverage/; merged afterwards.
				reportsDirectory: "coverage-browser",
				reporter: ["json", "json-summary", "text"]
			}
		}
	};
});
