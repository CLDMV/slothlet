/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/playwright-smoke.mjs
 *	@Date: 2026-05-30 00:00:00 -07:00 (1748588400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Real-browser smoke test for slothlet "browser mode" (issue #123).
 *
 * @description
 * Loads `@cldmv/slothlet` as raw ES modules (importmap, NO bundler) in a headless
 * Chromium — the faithful Electron-renderer / `<script type=module>` scenario #123
 * is about — and verifies the two things that matter:
 *   1. It LOADS: the module graph parses & evaluates with no console/page errors.
 *   2. The BASICS work: a browser-mode (manifest-based) compose returns a live api,
 *      and `api.math.add(2,3) === 5`.
 *
 * This is intentionally a thin smoke test (not the full node matrix). It serves
 * `src/` directly via a generated importmap (mirroring the `slothlet-dev` → src
 * mapping) so it can be iterated without a `dist` rebuild. Run via:
 *   node --conditions=slothlet-dev tests/browser/playwright-smoke.mjs
 * (wired as `npm run test:browser`). Exit code 0 = pass, non-zero = fail.
 */

import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join, extname } from "node:path";
import { chromium } from "playwright";
import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_REL = "api_tests/api_test_browser";
const PORT = 8123;

const MIME = {
	".mjs": "text/javascript; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".cjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".html": "text/html; charset=utf-8"
};

/**
 * Map a bare `@cldmv/slothlet[/sub]` specifier to its served /src path (mirrors
 * the package's slothlet-dev export conditions).
 * @param {string} spec
 * @returns {string}
 */
function specToServedPath(spec) {
	if (spec === "@cldmv/slothlet") return "/index.mjs";
	const sub = spec.slice("@cldmv/slothlet/".length);
	const special = {
		slothlet: "/src/slothlet.mjs",
		errors: "/src/lib/errors.mjs",
		i18n: "/src/lib/i18n/translations.mjs",
		devcheck: "/devcheck.mjs",
		typegen: "/src/lib/typegen/typegen.mjs",
		runtime: "/src/lib/runtime/runtime.mjs",
		"runtime/async": "/src/lib/runtime/runtime-asynclocalstorage.mjs",
		"runtime/live": "/src/lib/runtime/runtime-livebindings.mjs"
	};
	return special[sub] ?? `/src/lib/${sub}.mjs`;
}

/**
 * Recursively collect every `@cldmv/slothlet[/sub]` import specifier used in src/
 * + index.mjs, to build a complete importmap for the raw-ESM browser load.
 * @returns {Promise<Record<string,string>>} importmap "imports" object
 */
async function buildImportMap() {
	const specifiers = new Set(["@cldmv/slothlet"]);
	// Any quoted @cldmv/slothlet[/sub] specifier — static + dynamic imports AND the string-literal
	// lists used by browser component init (BROWSER_COMPONENT_SPECIFIERS). (Interim: the real fix is
	// generateManifest emitting slothlet's own importmap — see #123.)
	const re = /["'](@cldmv\/slothlet(?:\/[^"']+)?)["']/g;
	async function scanDir(dir) {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) await scanDir(full);
			else if (/\.(mjs|cjs|js)$/.test(entry.name)) {
				const src = await readFile(full, "utf8");
				let m;
				while ((m = re.exec(src))) specifiers.add(m[1] ?? m[2]);
			}
		}
	}
	await scanDir(join(REPO, "src"));
	const idx = await readFile(join(REPO, "index.mjs"), "utf8");
	let m;
	while ((m = re.exec(idx))) specifiers.add(m[1] ?? m[2]);
	const imports = {};
	for (const spec of specifiers) imports[spec] = specToServedPath(spec);
	// i18n locale files: the browser switches locale via dynamic import("@cldmv/slothlet/i18n/language/<lang>.json")
	// — a template specifier the static scan can't see — so map every shipped locale explicitly.
	for (const lang of ["de-de", "en-gb", "en-us", "es-es", "es-mx", "fr-fr", "hi-in", "ja-jp", "ko-kr", "pt-br", "ru-ru", "zh-cn"]) {
		imports[`@cldmv/slothlet/i18n/language/${lang}.json`] = `/src/lib/i18n/languages/${lang}.json`;
	}
	return imports;
}

/**
 * Build the smoke HTML page (importmap + browser-mode compose + result beacon).
 * @param {Record<string,string>} importmap
 * @param {object} manifest
 * @returns {string}
 */
function smokeHtml(importmap, manifest) {
	const base = `http://localhost:${PORT}/${FIXTURE_REL}/`;
	return `<!doctype html><meta charset="utf-8"><title>slothlet browser smoke</title>
<script type="importmap">${JSON.stringify({ imports: importmap })}</script>
<script>window.__MANIFEST__ = ${JSON.stringify(manifest)};</script>
<script type="module">
const out = { loaded: false, composed: false, value: null, self: null, hook: null, metadataType: null, metadataGetFor: null, i18n: null, events: null, added: null, perm: null, keys: null, advanced: null, error: null };
const BASE = ${JSON.stringify(base)};
const cfg = (extra) => ({ platform: "browser", base: BASE, manifest: window.__MANIFEST__, resolveModuleSpecifier: ({ path }) => new URL(path, BASE).href, mode: "eager", ...extra });
// calc may smart-flatten to a function or to an object exposing addViaSelf — handle both.
const callCalc = (node, a, b) => (typeof node === "function" ? node(a, b) : node.addViaSelf(a, b));
try {
	const mod = await import("@cldmv/slothlet");
	const slothlet = mod.default ?? mod.slothlet;
	out.loaded = true;

	// ── Compose #1: basics + self live-binding + hooks + metadata + i18n ──
	const api = await slothlet(cfg({ hook: { enabled: true } }));
	out.composed = true;
	out.keys = Object.keys(api).filter((k) => !k.startsWith("_"));
	out.advanced = api.advanced ? Object.keys(api.advanced) : null;
	out.value = await api.math.add(2, 3); // 5

	// self live-binding: advanced.calc.addViaSelf() routes through self.math.add in live mode.
	out.self = await callCalc(api.advanced?.calc ?? api.advanced, 2, 3); // 5

	// hooks: a before: hook doubles the first arg (2 -> 4), so add(2,3) becomes add(4,3) = 7.
	api.slothlet.hook.on("before:math.add", ({ args }) => [args[0] * 2, args[1]], { id: "double-a" });
	out.hook = await api.math.add(2, 3); // 7

	// metadata: both the namespace presence (typeof) AND a real getFor() read (merged metadata for a path).
	out.metadataType = typeof api.slothlet.metadata; // "object" | "function"
	const meta = api.slothlet.metadata.getFor("math.add");
	out.metadataGetFor = meta && typeof meta === "object" ? "ok" : "bad:" + typeof meta;

	// i18n: switch locale via the async dynamic-import path (real browser fetch of the locale JSON).
	await api.slothlet.i18n.setLanguageAsync("es-mx");
	out.i18n = api.slothlet.i18n.getLanguage(); // "es-mx"

	// lifecycle events: subscribe, then trigger via api.add — a live mutation on the SAME instance, so
	// the subscription stays valid (reload would re-create the lifecycle handler and orphan it).
	// Lifecycle is a custom Map emitter (no node:events), so this proves the event system end-to-end
	// in a browser (and that api.add itself works there).
	let evCount = 0;
	const offs = ["impl:created", "impl:changed"].map((ev) => api.slothlet.lifecycle.on(ev, () => { evCount++; }));
	await api.slothlet.api.add("extra", BASE + "utils"); // api.add builds the mounted folder → impl:created/changed on this handler
	offs.forEach((off) => { if (typeof off === "function") off(); });
	out.events = evCount > 0 ? "fired:" + evCount : "none";
	out.added = api.extra ? "mounted" : "not-mounted";

	if (typeof api.shutdown === "function") await api.shutdown();

	// ── Compose #2: permissions gate the INTERNAL self.math.add call (external calls are exempt) ──
	const api2 = await slothlet(cfg({
		permissions: { defaultPolicy: "allow", rules: [{ caller: "advanced.calc.**", target: "math.**", effect: "deny" }] }
	}));
	try {
		await callCalc(api2.advanced?.calc ?? api2.advanced, 2, 3);
		out.perm = "NOT_DENIED";
	} catch (e) {
		const msg = String((e && (e.code || e.message)) || e);
		out.perm = msg.includes("PERMISSION") ? "denied" : "other:" + msg;
	}
	if (typeof api2.shutdown === "function") await api2.shutdown();
} catch (e) {
	out.error = String((e && e.stack) || e);
}
window.__SMOKE__ = out;
</script>`;
}

async function main() {
	const manifest = await generateManifest(join(REPO, FIXTURE_REL));
	const importmap = await buildImportMap();
	const html = smokeHtml(importmap, manifest);

	const server = createServer(async (req, res) => {
		try {
			const url = decodeURIComponent((req.url || "/").split("?")[0]);
			if (url === "/" || url === "/smoke.html") {
				res.writeHead(200, { "content-type": MIME[".html"] });
				res.end(html);
				return;
			}
			const filePath = resolve(REPO, "." + url);
			if (!filePath.startsWith(REPO)) {
				res.writeHead(403);
				res.end("forbidden");
				return;
			}
			const body = await readFile(filePath);
			res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
			res.end(body);
		} catch {
			res.writeHead(404);
			res.end("not found");
		}
	});
	await new Promise((r) => server.listen(PORT, r));

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	const errors = [];
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text());
	});
	page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message)));
	page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ""}`));

	let smoke = null;
	try {
		await page.goto(`http://localhost:${PORT}/smoke.html`, { waitUntil: "load", timeout: 20000 });
		await page.waitForFunction(() => window.__SMOKE__ !== undefined, null, { timeout: 20000 });
		smoke = await page.evaluate(() => window.__SMOKE__);
	} catch (e) {
		errors.push("harness: " + (e.message || String(e)));
	} finally {
		await browser.close();
		server.close();
	}

	const importmapCount = Object.keys(importmap).length;
	console.log(`\n=== slothlet browser smoke (#123) ===`);
	console.log(`importmap entries: ${importmapCount}`);
	console.log(`smoke result:`, JSON.stringify(smoke, null, 2));
	if (errors.length) {
		console.log(`\n--- ${errors.length} browser console/page error(s) ---`);
		for (const e of errors.slice(0, 25)) console.log("  • " + e.split("\n")[0]);
	}

	const checks = {
		loaded: smoke?.loaded === true,
		composed: smoke?.composed === true,
		"add=5": smoke?.value === 5,
		"self=5": smoke?.self === 5,
		"hook=7": smoke?.hook === 7,
		"metadata(typeof)": smoke?.metadataType === "object" || smoke?.metadataType === "function",
		"metadata.getFor": smoke?.metadataGetFor === "ok",
		"i18n=es-mx": smoke?.i18n === "es-mx",
		events: String(smoke?.events).startsWith("fired"),
		"api.add": smoke?.added === "mounted",
		"perm=denied": smoke?.perm === "denied",
		"0 errors": errors.length === 0
	};
	const pass = Object.values(checks).every(Boolean);
	console.log(`\n${pass ? "✅ PASS" : "❌ FAIL"} — ` + Object.entries(checks).map(([k, v]) => `${v ? "✓" : "✗"}${k}`).join("  "));
	process.exit(pass ? 0 : 1);
}

main().catch((e) => {
	console.error("smoke harness crashed:", e);
	process.exit(2);
});
