/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /.configs/vitest.browser.config.mjs
 *	@Date: 2026-06-16T19:29:13-07:00 (1781663353)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-21 17:07:33 -07:00 (1782086853)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
import { fileURLToPath } from "node:url";
import { generateBrowserAssets } from "../src/lib/helpers/generate-manifest.mjs";

const slothletCondition = "slothlet-dev";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = resolve(REPO, "api_tests/api_test_browser");
const FIXTURE_REL = "api_tests/api_test_browser";

export default defineConfig(async () => {
	// Built once in node; the browser can't read the fixture tree to build a manifest itself.
	const { manifest, importmap } = await generateBrowserAssets(FIXTURE_DIR, { slothletBase: "/" });

	// slothlet resolves internal modules at runtime via `import(<computed bare specifier>)`, which vite
	// can't statically rewrite — so the browser needs an importmap for them. Point it at the vite-served
	// /src/* URLs (rewrite the default /dist/*) so those modules still go through vite's transform and
	// their v8 coverage maps to src/** (the whole reason this beats the raw-source playwright-smoke).
	const imports = Object.fromEntries(Object.entries(importmap.imports).map(([k, v]) => [k, v.replace("/dist/lib/", "/src/lib/")]));

	/** Expose the node-built fixture manifest + its served base path to browser tests. */
	const fixtureManifestPlugin = {
		name: "slothlet-browser-fixture-manifest",
		resolveId(id) {
			if (id === "virtual:browser-fixture-manifest") return "\0virtual:browser-fixture-manifest";
		},
		load(id) {
			if (id === "\0virtual:browser-fixture-manifest") {
				return `export const manifest = ${JSON.stringify(manifest)};\nexport const fixtureRel = ${JSON.stringify(FIXTURE_REL)};\n`;
			}
		},
		// Inject slothlet's importmap into the tester page (head-prepend, before any module script) so
		// the runtime dynamic bare-specifier imports resolve to the vite-served src modules.
		transformIndexHtml() {
			return [{ tag: "script", attrs: { type: "importmap" }, children: JSON.stringify({ imports }), injectTo: "head-prepend" }];
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
					"src/lib/helpers/platform.mjs",
					"src/lib/helpers/eventemitter-context.mjs",
					"src/lib/handlers/context-async.mjs",
					"src/lib/builders/api_builder.mjs",
					"src/slothlet.mjs"
				],
				exclude: ["**/*.json", "api_tests/**", "tests/**", "tools/**"],
				// Separate dir so it doesn't clobber the node run's coverage/; merged afterwards.
				reportsDirectory: "coverage-browser",
				reporter: ["json", "json-summary", "text"]
			}
		}
	};
});
