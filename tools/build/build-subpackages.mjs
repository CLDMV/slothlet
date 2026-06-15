/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/build/build-subpackages.mjs
 *	@Date: 2026-06-08 23:00:20 -07:00 (1780984820)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-08 23:02:57 -07:00 (1780984977)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Carve the satellite sub-packages from the main build output and stage each as a
 * publish-ready directory. One source repo, multiple published packages.
 * @module @cldmv/slothlet/tools/build-subpackages
 * @internal
 * @description
 * The main build emits `dist/` and `types/dist/`. This step slices that output into standalone
 * packages (`@cldmv/slothlet-i18n`, `@cldmv/slothlet-types`), each with a generated `package.json`
 * assembled from three layers:
 *
 *   1. inherited — org / legal / marketing fields copied verbatim from the root package.json.
 *   2. authored  — description + keywords (and any explicit overrides) from packaging/<name>/package.json.
 *   3. computed  — name (scope + folder), version (root), exports, files, peerDependencies.
 *
 * Precedence is computed > authored > inherited. Output is staged under `dist-packages/<name>/`
 * (gitignored); the release workflow handles publishing, not this script.
 *
 * @example
 * // after building the main package:
 * node tools/build/build-subpackages.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(path.dirname(__dirname));
const packagingDir = path.join(projectRoot, "packaging");
const outRoot = process.env.SUBPACKAGES_OUT || path.join(projectRoot, "dist-packages");

/**
 * Locales that ship inside @cldmv/slothlet itself (en-us is also statically imported there).
 * Everything else is carved into @cldmv/slothlet-i18n.
 * @internal
 */
const BASE_LOCALES = new Set(["en-us"]);

/**
 * Whether to ship TypeScript declaration maps (.d.mts.map) in the types package. Off by default:
 * the maps point at the minified dist/ and the readable source is stripped on publish, so they add
 * ~27% to the payload for a near-useless "go to definition". Flip on (and ship the source) only for
 * a deliberate source-navigation build — otherwise we generally would not ship them.
 * @internal
 */
const INCLUDE_DECLARATION_MAPS = false;

/**
 * Root package.json fields copied verbatim onto every sub-package.
 * @internal
 */
const INHERIT_FIELDS = ["license", "author", "contributors", "funding", "repository", "bugs", "homepage", "publishConfig", "type", "engines", "sideEffects"];

/* ---------- small fs / json helpers ---------- */

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, obj) {
	fs.writeFileSync(file, JSON.stringify(obj, null, "\t") + "\n");
}

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function emptyDir(dir) {
	fs.rmSync(dir, { recursive: true, force: true });
	ensureDir(dir);
}

function copyIfExists(src, dst) {
	if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

/**
 * Recursively copy a tsc declaration tree. Declaration maps only aid "go to definition" when the
 * original source ships too — it doesn't here — so unless INCLUDE_DECLARATION_MAPS is set, .d.mts.map
 * files are skipped and the now-dangling `sourceMappingURL` comment is stripped from each .d.mts.
 * @internal
 */
function copyDeclarations(srcDir, dstDir) {
	ensureDir(dstDir);
	let files = 0;
	let bytes = 0;
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const src = path.join(srcDir, entry.name);
		const dst = path.join(dstDir, entry.name);
		if (entry.isDirectory()) {
			const sub = copyDeclarations(src, dst);
			files += sub.files;
			bytes += sub.bytes;
			continue;
		}
		if (!INCLUDE_DECLARATION_MAPS && entry.name.endsWith(".d.mts.map")) continue;
		if (!INCLUDE_DECLARATION_MAPS && entry.name.endsWith(".d.mts")) {
			let txt = fs.readFileSync(src, "utf8").replace(/\r?\n\/\/# sourceMappingURL=[^\r\n]*\s*$/, "");
			if (!txt.endsWith("\n")) txt += "\n";
			fs.writeFileSync(dst, txt);
		} else {
			fs.copyFileSync(src, dst);
		}
		files++;
		bytes += fs.statSync(dst).size;
	}
	return { files, bytes };
}

function rel(p) {
	return path.relative(projectRoot, p) || ".";
}

function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Derive the published name from the root scope and the scaffold folder name
 * (packaging/slothlet-i18n -> @cldmv/slothlet-i18n). An explicit `name` in the scaffold wins.
 * @internal
 */
function deriveName(coreName, folder) {
	const scope = coreName.startsWith("@") ? coreName.split("/")[0] : null;
	return scope ? `${scope}/${folder}` : folder;
}

/**
 * Build the standalone types package's export map from the core export map. Core's `default` types
 * condition now points at the shipped stubs, so the canonical declaration layout is read from the
 * `slothlet-dev` condition (./types/src/X) instead — the satellite carries the dist mirror of that
 * same tree (./X). The root `.` maps to the generated aggregator (./index.d.mts). Exports the
 * satellite does not carry (no dist mirror, e.g. the empty `./devcheck`) are dropped.
 * @internal
 */
function computeTypesExports(coreExports) {
	const srcPrefix = "./types/src/";
	const distDir = path.join(projectRoot, "types", "dist");
	const out = { "./package.json": "./package.json" };
	for (const [key, value] of Object.entries(coreExports || {})) {
		if (key === "./package.json" || key.startsWith("./i18n/language") || key.startsWith("./schemas")) continue;
		if (key === ".") {
			out["."] = { types: "./index.d.mts" }; // generated root aggregator (no types/dist/index.d.mts)
			continue;
		}
		if (!value || typeof value !== "object") continue;
		const dev = value["slothlet-dev"];
		const devTypes = dev && typeof dev === "object" && typeof dev.types === "string" ? dev.types : null;
		if (!devTypes || !devTypes.startsWith(srcPrefix)) continue; // skips ./devcheck (./types/devcheck.d.mts)
		const rest = devTypes.slice(srcPrefix.length); // lib/helpers/*.d.mts | slothlet.d.mts
		const probe = rest.includes("*") ? path.posix.dirname(rest) : rest;
		if (!fs.existsSync(path.join(distDir, probe))) continue; // only what the satellite actually ships
		out[key] = { types: "./" + rest };
	}
	return out;
}

/**
 * The satellite has no `types/dist/index.d.mts` (the core root declaration lives at types/index.d.mts
 * and references src). Emit a small aggregator so `@cldmv/slothlet-types` has a `.` entry that mirrors
 * core's root surface — the default-bearing `slothlet` function.
 * @internal
 */
function writeTypesRootIndex(outDir) {
	const body =
		`// AUTO-GENERATED by tools/build/build-subpackages.mjs — do not edit.\n` +
		`export * from "./slothlet.mjs";\n` +
		`export { default } from "./slothlet.mjs";\n`;
	fs.writeFileSync(path.join(outDir, "index.d.mts"), body);
}

/* ---------- per-package carve rules ---------- */

const RULES = {
	"slothlet-i18n": {
		stage(_core, { outDir }) {
			const srcDir = path.join(projectRoot, "dist", "lib", "i18n", "languages");
			if (!fs.existsSync(srcDir)) {
				throw new Error(`missing ${rel(srcDir)} — run "npm run build:dist" first`);
			}
			const langOut = path.join(outDir, "languages");
			ensureDir(langOut);
			let files = 0;
			let bytes = 0;
			for (const name of fs.readdirSync(srcDir)) {
				if (!name.endsWith(".json")) continue;
				if (BASE_LOCALES.has(name.replace(/\.json$/, ""))) continue; // en-us stays in core
				const dst = path.join(langOut, name);
				fs.copyFileSync(path.join(srcDir, name), dst);
				files++;
				bytes += fs.statSync(dst).size;
			}
			return { files, bytes };
		},
		compute(core) {
			return {
				exports: {
					"./package.json": "./package.json",
					"./language/*": "./languages/*"
				},
				files: ["languages/", "README.md", "LICENSE"],
				// The locale data is consumed BY core (via import.meta.resolve), so core is an optional
				// peer: declared for version-mismatch visibility, optional so installing the pack before
				// core never hard-errors. Exact pin — built in lockstep. Mirrors the types satellite.
				peerDependencies: { [core.name]: core.version },
				peerDependenciesMeta: { [core.name]: { optional: true } }
			};
		}
	},

	"slothlet-types": {
		stage(_core, { outDir }) {
			const srcDir = path.join(projectRoot, "types", "dist");
			if (!fs.existsSync(srcDir)) {
				throw new Error(`missing ${rel(srcDir)} — run "npm run build:types" first`);
			}
			const copied = copyDeclarations(srcDir, outDir);
			writeTypesRootIndex(outDir); // root aggregator so the package has a `.` entry
			const idx = fs.statSync(path.join(outDir, "index.d.mts"));
			return { files: copied.files + 1, bytes: copied.bytes + idx.size };
		},
		compute(core) {
			// Consumers reach these declarations because @cldmv/slothlet ships stubs that re-export from
			// this package (the `default` types condition). It is core's optional `@cldmv/slothlet-types`
			// peer dependency; missing here means TypeScript reports a "Cannot find module" on import.
			const files = ["**/*.d.mts", "README.md", "LICENSE"];
			if (INCLUDE_DECLARATION_MAPS) files.splice(1, 0, "**/*.d.mts.map");
			return {
				exports: computeTypesExports(core.exports),
				files,
				// Core is a real (required-in-practice) peer: the carved declarations contain
				// self-referencing `@cldmv/slothlet/*` specifiers. Optional meta keeps install-order
				// flexible. Exact pin — built in lockstep.
				peerDependencies: { [core.name]: core.version },
				peerDependenciesMeta: { [core.name]: { optional: true } }
			};
		}
	}
};

/* ---------- merge + main ---------- */

/**
 * Assemble the final manifest from the three layers (computed > authored > inherited),
 * then re-emit with identity fields first for a readable, stable file.
 * @internal
 */
function buildManifest(folder, core, authored, computed) {
	const merged = {};
	for (const field of INHERIT_FIELDS) {
		if (field in core) merged[field] = core[field];
	}
	Object.assign(merged, authored, computed);
	merged.name = authored.name || deriveName(core.name, folder);
	merged.version = core.version;
	// npm provenance requires `repository` with a `directory` pointing at where the package lives in
	// the core repo (the satellite is carved from this build; its config lives under packaging/<name>).
	if (merged.repository && typeof merged.repository === "object") {
		merged.repository = { ...merged.repository, directory: `packaging/${folder}` };
	}

	const ordered = {
		name: merged.name,
		version: merged.version,
		description: merged.description,
		keywords: merged.keywords
	};
	for (const [key, value] of Object.entries(merged)) {
		if (!(key in ordered)) ordered[key] = value;
	}
	return ordered;
}

/**
 * Lockstep guard: the satellite is published at core.version and pins core exactly, so core's own
 * optional-peer range on the satellite must (a) exist and (b) share core's major — otherwise a
 * consumer who installs both gets an unsatisfiable peer. Core's range (e.g. `^3.11.0`) is a static
 * literal; this fails the build loudly if a future major bump forgets to widen it, instead of
 * shipping a broken range. Passes pre-bump (3.10.0 vs `^3.11.0` are both major 3) and post-bump.
 * @internal
 */
function assertCorePeerRange(core, satelliteName) {
	const range = core.peerDependencies && core.peerDependencies[satelliteName];
	if (!range) {
		throw new Error(
			`core package.json is missing an optional peerDependency on ${satelliteName} ` +
				`— add "${satelliteName}": "^${core.version}" + peerDependenciesMeta.${satelliteName}.optional`
		);
	}
	const coreMajor = String(core.version).split(".")[0];
	const rangeMajor = String(range).replace(/^[^0-9]*/, "").split(".")[0];
	if (rangeMajor !== coreMajor) {
		throw new Error(
			`core's peerDependency range for ${satelliteName} ("${range}") is major ${rangeMajor}, ` +
				`but core is ${core.version} (major ${coreMajor}). Update the range to "^${coreMajor}.x".`
		);
	}
}

function main() {
	if (!fs.existsSync(packagingDir)) {
		throw new Error(`no packaging/ directory at ${rel(packagingDir)}`);
	}
	const core = readJson(path.join(projectRoot, "package.json"));
	emptyDir(outRoot);

	const folders = fs
		.readdirSync(packagingDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	for (const folder of folders) {
		const rule = RULES[folder];
		if (!rule) {
			console.warn(`• ${folder}: no carve rule — skipped`);
			continue;
		}
		const authored = readJson(path.join(packagingDir, folder, "package.json"));
		const outDir = path.join(outRoot, folder);
		ensureDir(outDir);

		const staged = rule.stage(core, { outDir });
		const computed = rule.compute(core);
		const manifest = buildManifest(folder, core, authored, computed);
		assertCorePeerRange(core, manifest.name); // lockstep guard — fails loudly on peer-range drift

		writeJson(path.join(outDir, "package.json"), manifest);
		copyIfExists(path.join(packagingDir, folder, "README.md"), path.join(outDir, "README.md"));
		copyIfExists(path.join(projectRoot, "LICENSE"), path.join(outDir, "LICENSE"));

		console.log(`✓ ${manifest.name}@${manifest.version} → ${rel(outDir)} (${staged.files} files, ${formatBytes(staged.bytes)})`);
	}
}

try {
	main();
} catch (err) {
	console.error(`build-subpackages failed: ${err.message}`);
	process.exitCode = 1;
}
