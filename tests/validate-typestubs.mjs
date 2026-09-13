/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/validate-typestubs.mjs
 *	@Date: 2026-06-14 00:00:00 -07:00 (1781913600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-21 17:11:00 -07:00 (1782087060)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Consumer-side proof for the type-stub split (#146). @cldmv/slothlet ships only stubs
 * that re-export from @cldmv/slothlet-types; this asserts that, from a consumer's point of view, the
 * production (`default`) resolution condition type-checks the real consumer surface (slothlet(),
 * runtime, helpers/sanitize, errors, typegen) when the satellite is installed, fails with a clear
 * "Cannot find module '@cldmv/slothlet-types'" when it is not, and that the carved satellite's OWN
 * `package.json` never advertises an internal-only subpath (e.g. runtime/async) as one of its
 * exports — that manifest, not any particular stub-resolution side effect, is the actual boundary
 * computeTypesExports (build-subpackages.mjs) enforces. An internal-only subpath's core stub in
 * `@cldmv/slothlet` itself ships a self-contained, accurate declaration instead of a broken
 * re-export (build-typestubs.mjs, #366) — and IS also verified here (1c): its `#factories/*`/
 * `#handlers/*` internal references must resolve via the generator's closure emission, not just
 * degrade to a copied-but-broken declaration (#372/#373).
 * @module tests/validate-typestubs
 * @description
 * Unlike tests/validate-typescript.mjs (which runs under `--customConditions slothlet-dev` against the
 * in-repo declarations), this runs WITHOUT that condition, exercising exactly what a published consumer
 * resolves: core stub → @cldmv/slothlet-types. The satellite is staged from the real carve output
 * (build-subpackages.mjs) and fixtured into node_modules alongside a self-link to core, mirroring a
 * project that installed both packages.
 */

import { execSync, execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, cpSync, symlinkSync, lstatSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);
const nodeModules = join(projectRoot, "node_modules", "@cldmv");
const satelliteLink = join(nodeModules, "slothlet-types");
const coreLink = join(nodeModules, "slothlet");
const carved = join(projectRoot, "dist-packages", "slothlet-types");

// The real, documented consumer surface (2026-09 scoping decision): the slothlet() factory itself,
// the unified runtime context interface, the property-name sanitizer, the thrown/emitted error
// classes, and the standalone `slothlet typegen` generator (docs/TYPESCRIPT.md documents it as
// CLI-and-programmatic). Everything else this package exposes as an `exports` subpath — including
// helpers/config (an @internal config-normalization class) and runtime/async (one of runtime's two
// mode-specific implementations, not something a consumer imports directly) — exists only so this
// package's OWN source files can reference each other cleanly; it was never a supported contract.
const CONSUMER = `
import slothlet, { slothlet as named } from "@cldmv/slothlet";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import * as errors from "@cldmv/slothlet/errors";
import * as runtime from "@cldmv/slothlet/runtime";
import { generateTypes } from "@cldmv/slothlet/typegen";

async function check() {
	const api = await slothlet({ base: "./api" });
	const api2 = await named({ base: "./api" });
	return { api, api2, sanitizePropertyName, errors, runtime, generateTypes };
}
export default check;
`;

// Validate under both the lax (bundler) and the strict ESM (nodenext) resolvers — nodenext is the
// common case for ESM-only consumers and is far pickier about subpath exports and conditions.
const RESOLUTIONS = ["bundler", "nodenext"];

/** Run tsc on a single file under a given moduleResolution (production/default condition). @returns {{ok:boolean, out:string}} */
function tsc(testFile, resolution) {
	const moduleFlag = resolution === "nodenext" ? "nodenext" : "esnext";
	try {
		const out = execSync(
			`npx tsc --noEmit --strict --moduleResolution ${resolution} --module ${moduleFlag} --target es2022 "${testFile}"`,
			{ stdio: "pipe", encoding: "utf8", cwd: projectRoot }
		);
		return { ok: true, out };
	} catch (err) {
		return { ok: false, out: (err.stdout || "") + (err.stderr || "") };
	}
}

function main() {
	console.log("🔍 Validating consumer type-stub resolution (#146)...\n");

	// Ensure the satellite carve is fresh (build-subpackages reads types/dist + types/src).
	if (!existsSync(join(projectRoot, "types", "stub")) || !existsSync(join(projectRoot, "types", "dist"))) {
		throw new Error('missing built types — run "npm run build:dist && npm run build:types && npm run build:typestubs" first');
	}
	console.log("• carving @cldmv/slothlet-types ...");
	execFileSync("node", [join(projectRoot, "tools", "build", "build-subpackages.mjs")], { stdio: "inherit", cwd: projectRoot });
	if (!existsSync(carved)) throw new Error("carve produced no dist-packages/slothlet-types");

	const tmpDir = join(projectRoot, "tmp", `typestub-sim-${process.pid}`);
	const satelliteBackup = `${satelliteLink}.real-backup`;
	let createdCoreLink = false;
	let backedUpSatellite = false;
	mkdirSync(nodeModules, { recursive: true });
	mkdirSync(tmpDir, { recursive: true });
	const testFile = join(tmpDir, "consumer.mts");
	writeFileSync(testFile, CONSUMER, "utf8");

	let failed = false;
	try {
		// A real consumer installs both packages. Self-link core so the satellite's `@cldmv/slothlet/*`
		// back-references (self-referencing specifiers preserved in the .d.mts) resolve. Use a junction so
		// the link works on Windows without Developer Mode / admin — a plain "dir" symlink needs elevation;
		// Node reports junctions as symlinks to lstat, so the cleanup below still removes it.
		if (!existsSync(coreLink)) {
			symlinkSync(projectRoot, coreLink, "junction");
			createdCoreLink = true;
		}

		// Preserve a developer's real @cldmv/slothlet-types instead of destroying it: move it aside and
		// restore it in the finally (the satellite MUST live in node_modules for the stub's back-reference
		// to resolve, so this stages there but never clobbers).
		rmSync(satelliteBackup, { recursive: true, force: true });
		if (existsSync(satelliteLink)) {
			renameSync(satelliteLink, satelliteBackup);
			backedUpSatellite = true;
		}

		// 1) Satellite present → consumer type-checks through the stubs, under every resolver.
		cpSync(carved, satelliteLink, { recursive: true });
		for (const res of RESOLUTIONS) {
			const withPack = tsc(testFile, res);
			if (withPack.ok) {
				console.log(`✅ [${res}] with @cldmv/slothlet-types installed: stubs resolve, consumer type-checks`);
			} else {
				failed = true;
				console.error(`❌ [${res}] expected the consumer to type-check with the satellite installed:\n` + withPack.out);
			}
		}

		// 1c) An internal-only subpath NOT carried by the satellite ships a self-contained declaration
		// instead of a re-export (build-typestubs.mjs). Verify one of those — ./modes/eager, whose
		// declaration imports the package-internal #factories/component-base — actually type-checks
		// under the production "types" condition, proving the generator's #factories/#handlers
		// closure emission resolved that internal reference to a real file instead of leaving a
		// TS2307 for any consumer importing an internal-but-exported subpath (#372/#373 review).
		const internalTestFile = join(tmpDir, "internal-consumer.mts");
		writeFileSync(
			internalTestFile,
			`import type { EagerMode } from "@cldmv/slothlet/modes/eager";\ndeclare const mode: EagerMode;\nexport default mode;\n`,
			"utf8"
		);
		const internalCheck = tsc(internalTestFile, "bundler");
		if (internalCheck.ok) {
			console.log("✅ internal self-contained subpath (./modes/eager) resolves its #factories/component-base reference");
		} else {
			failed = true;
			console.error("❌ internal self-contained subpath (./modes/eager) failed to type-check:\n" + internalCheck.out);
		}

		// 1b) The actual boundary: the carved satellite's OWN package.json must never advertise an
		// internal-only subpath as one of its exports, regardless of how @cldmv/slothlet's own stub
		// for that path happens to resolve (that's a separate concern — see build-typestubs.mjs).
		const satellitePkg = JSON.parse(readFileSync(join(satelliteLink, "package.json"), "utf8"));
		const internalKeysStillExported = ["./runtime/async", "./runtime/live", "./modes/*", "./builders/*", "./processors/*", "./i18n"].filter(
			(k) => Object.prototype.hasOwnProperty.call(satellitePkg.exports || {}, k)
		);
		if (internalKeysStillExported.length === 0) {
			console.log("✅ @cldmv/slothlet-types package.json does not advertise any internal-only subpath as an export");
		} else {
			failed = true;
			console.error(
				"❌ @cldmv/slothlet-types package.json unexpectedly exports internal-only subpath(s): " + internalKeysStillExported.join(", ")
			);
		}

		// 2) Satellite absent → must fail, naming the missing package (the install signal).
		rmSync(satelliteLink, { recursive: true, force: true });
		const withoutPack = tsc(testFile, "bundler");
		if (!withoutPack.ok && withoutPack.out.includes("@cldmv/slothlet-types")) {
			console.log("✅ without it: TypeScript reports the missing @cldmv/slothlet-types (expected degradation)");
		} else {
			failed = true;
			console.error("❌ expected a 'Cannot find module @cldmv/slothlet-types' error when absent:\n" + withoutPack.out);
		}
	} finally {
		rmSync(satelliteLink, { recursive: true, force: true });
		if (backedUpSatellite) renameSync(satelliteBackup, satelliteLink); // restore the developer's real install
		if (createdCoreLink) {
			try {
				if (lstatSync(coreLink).isSymbolicLink()) rmSync(coreLink, { force: true });
			} catch {
				/* ignore */
			}
		}
		rmSync(tmpDir, { recursive: true, force: true });
	}

	if (failed) {
		console.error("\n❌ type-stub consumer validation failed");
		process.exit(1);
	}
	console.log("\n🎉 type-stub consumer validation passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		main();
	} catch (err) {
		console.error(`\n❌ ${err.message}`);
		process.exit(1);
	}
}
