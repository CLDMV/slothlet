/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /.configs/vitest.browser.config.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest **browser-mode** project: runs slothlet's browser-only code paths in a real
 * headless Chromium (Playwright provider) so the `!isNode` arms are genuinely exercised rather than
 * `/* v8 ignore *​/`'d. Coverage is collected via the same v8 provider as the node suite, so the two
 * coverage-final.json reports share identical maps and merge cleanly (see tools/coverage/merge-browser-coverage.mjs).
 */

import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const slothletCondition = "slothlet-dev";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * slothlet loads non-default locales in a browser via `import(ref, { with: { type: "json" } })`
 * (native JSON modules). Vite serves .json as a transformed JS module, which breaks that type
 * assertion — so serve the locale JSON files raw (application/json) like a real browser/importmap
 * would, letting the i18n async-load success arm actually execute under coverage.
 */
const rawLocaleJsonPlugin = {
	name: "slothlet-raw-locale-json",
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			const url = req.url || "";
			if (/\/src\/lib\/i18n\/languages\/[^/?]+\.json(?:\?|$)/.test(url)) {
				try {
					const rel = url.split("?")[0];
					res.setHeader("Content-Type", "application/json; charset=utf-8");
					res.end(readFileSync(resolve(REPO, "." + rel)));
					return;
				} catch {
					/* fall through to vite */
				}
			}
			next();
		});
	}
};

export default defineConfig({
	resolve: {
		// Resolve @cldmv/slothlet to src (slothlet-dev) and prefer the browser condition,
		// matching how the package loads in a real browser.
		conditions: [slothletCondition, "module", "browser", "development|production"]
	},
	// Do NOT let vite pre-bundle slothlet — pre-bundled deps are served as an optimized bundle and
	// their coverage can't map back to src/**. Inlining serves them as source (vite-transformed, with
	// sourcemaps), so v8 coverage remaps to the real source files.
	optimizeDeps: { exclude: ["@cldmv/slothlet"] },
	test: {
		server: { deps: { inline: [/@cldmv\/slothlet/] } },
		include: ["tests/browser/**/*.browser.test.mjs"],
		exclude: ["node_modules"],
		globals: true,
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }]
		},
		coverage: {
			provider: "v8",
			include: ["src/**"],
			exclude: ["**/*.json", "api_tests/**", "tests/**", "tools/**"],
			// Separate dir so it doesn't clobber the node run's coverage/; merged afterwards.
			reportsDirectory: "coverage-browser",
			reporter: ["json", "json-summary", "text"]
		}
	}
});
