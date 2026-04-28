/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/build/minify-dist.mjs
 *	@Date: 2026-04-26 00:00:00 -07:00 (1745654400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-26 00:00:00 -07:00 (1745654400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Minifies all `.mjs` files in `dist/` using esbuild.
 *
 * @description
 * Runs after `build:dist` (which copies src/ → dist/) and before
 * `build:prepend-license` (which prepends the Apache copyright header).
 * That ordering is intentional: esbuild strips all comments during
 * processing, so the license header must be added after, not before.
 *
 * Each file is transformed individually (not bundled) so the existing
 * self-referencing import graph (`@cldmv/slothlet/...`) is preserved
 * unchanged — only whitespace and comments are removed; identifiers and
 * syntax structure are left as-is.
 *
 * The `.mjs` extension is kept on every output file to maintain ESM
 * semantics and stay compatible with the package exports map.
 *
 * esbuild is an optional peer dependency. When it is not installed the
 * script exits with a clear warning rather than a hard failure so that
 * environments that don't need stripped output (e.g. `--conditions
 * slothlet-dev` dev runs) are unaffected.
 *
 * @module @cldmv/slothlet/tools/build/minify-dist
 * @package
 * @internal
 *
 * @example
 * node tools/build/minify-dist.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const distDir = path.join(projectRoot, "dist");

/**
 * Recursively collect all `.mjs` file paths under a directory.
 *
 * @param {string} dir - Root directory to walk.
 * @returns {Promise<string[]>} Absolute paths of every `.mjs` file found.
 * @example
 * const files = await collectMjs("/project/dist");
 */
async function collectMjs(dir) {
	const { readdir } = await import("node:fs/promises");
	/** @type {string[]} */
	const results = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await collectMjs(full)));
		} else if (entry.isFile() && entry.name.endsWith(".mjs")) {
			results.push(full);
		}
	}
	return results;
}

/**
 * Strip comments and whitespace from all `.mjs` files in `dist/` in-place
 * using esbuild's transform API. Identifiers and syntax are left untouched.
 * The `.mjs` extension is preserved on every output file.
 *
 * @returns {Promise<void>}
 * @throws {Error} When dist/ does not exist or esbuild transform fails for a file.
 * @example
 * node tools/build/minify-dist.mjs
 */
async function minifyDist() {
	// Guard: dist/ must exist (build:dist runs before this step).
	if (!existsSync(distDir)) {
		console.error("❌  dist/ not found — run build:dist first.");
		process.exit(1);
	}

	// Load esbuild — it is an optional peer dep; fail gracefully when absent.
	let esbuild;
	try {
		const mod = await import("esbuild");
		esbuild = mod.default ?? mod;
	} catch {
		console.warn("⚠️  esbuild not found — skipping dist minification.");
		console.warn("   Install it with: npm install --save-dev esbuild");
		process.exit(0);
	}

	const files = await collectMjs(distDir);

	if (files.length === 0) {
		console.warn("⚠️  No .mjs files found in dist/ — nothing to minify.");
		process.exit(0);
	}

	console.log(`🗜️  Stripping comments and whitespace from ${files.length} files in dist/…`);

	let minified = 0;
	let failed = 0;
	let savedBytes = 0;

	for (const file of files) {
		const source = await readFile(file, "utf8");

		let result;
		try {
			result = await esbuild.transform(source, {
				// Transform only — do NOT bundle; preserves all import specifiers.
				loader: "js",
				// esnext: no syntax lowering — we want zero transformations beyond
				// whitespace/comment stripping. Using a versioned target (e.g. node16)
				// causes esbuild to downlevel class syntax (static fields, private
				// fields) which breaks TypeScript's ability to generate declarations.
				target: "esnext",
				format: "esm",
				// Strip whitespace and comments only — identifiers and syntax
				// are intentionally left unchanged so the output stays readable
				// and debuggable while still being compact.
				minifyWhitespace: true,
				minifyIdentifiers: false,
				minifySyntax: false,
				// Drop all comments including legal ones — the Apache header is
				// prepended as the single canonical notice by build:prepend-license.
				legalComments: "none"
			});
		} catch (err) {
			console.error(`❌  Failed to minify ${path.relative(projectRoot, file)}: ${err.message}`);
			failed++;
			continue;
		}

		const before = Buffer.byteLength(source, "utf8");
		const after = Buffer.byteLength(result.code, "utf8");
		savedBytes += before - after;

		// esbuild always appends a trailing newline; keep it for consistency.
		await writeFile(file, result.code, "utf8");
		minified++;
	}

	const savedKb = (savedBytes / 1024).toFixed(1);
	console.log(`✅  Stripped ${minified}/${files.length} files — saved ${savedKb} KB`);

	if (failed > 0) {
		console.error(`❌  ${failed} file(s) failed — see errors above.`);
		process.exit(1);
	}
}

minifyDist();
