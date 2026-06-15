/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/validate-typestubs.mjs
 *	@Date: 2026-06-14 00:00:00 -07:00 (1781913600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Consumer-side proof for the type-stub split (#146). @cldmv/slothlet ships only stubs
 * that re-export from @cldmv/slothlet-types; this asserts that, from a consumer's point of view, the
 * production (`default`) resolution condition type-checks when the satellite is installed and fails
 * with a clear "Cannot find module '@cldmv/slothlet-types'" when it is not.
 * @module tests/validate-typestubs
 * @description
 * Unlike tests/validate-typescript.mjs (which runs under `--customConditions slothlet-dev` against the
 * in-repo declarations), this runs WITHOUT that condition, exercising exactly what a published consumer
 * resolves: core stub → @cldmv/slothlet-types. The satellite is staged from the real carve output
 * (build-subpackages.mjs) and fixtured into node_modules alongside a self-link to core, mirroring a
 * project that installed both packages.
 */

import { execSync, execFileSync } from "node:child_process";
import { writeFileSync, rmSync, mkdirSync, existsSync, cpSync, symlinkSync, lstatSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);
const nodeModules = join(projectRoot, "node_modules", "@cldmv");
const satelliteLink = join(nodeModules, "slothlet-types");
const coreLink = join(nodeModules, "slothlet");
const carved = join(projectRoot, "dist-packages", "slothlet-types");

const CONSUMER = `
import slothlet, { slothlet as named } from "@cldmv/slothlet";
import * as cfg from "@cldmv/slothlet/helpers/config";
import * as errors from "@cldmv/slothlet/errors";
import * as runtimeAsync from "@cldmv/slothlet/runtime/async";

async function check() {
	const api = await slothlet({ base: "./api" });
	const api2 = await named({ base: "./api" });
	return { api, api2, cfg, errors, runtimeAsync };
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
	let createdCoreLink = false;
	mkdirSync(nodeModules, { recursive: true });
	mkdirSync(tmpDir, { recursive: true });
	const testFile = join(tmpDir, "consumer.mts");
	writeFileSync(testFile, CONSUMER, "utf8");

	let failed = false;
	try {
		// A real consumer installs both packages. Self-link core so the satellite's `@cldmv/slothlet/*`
		// back-references (self-referencing specifiers preserved in the .d.mts) resolve.
		if (!existsSync(coreLink)) {
			symlinkSync(projectRoot, coreLink, "dir");
			createdCoreLink = true;
		}

		// 1) Satellite present → consumer type-checks through the stubs, under every resolver.
		rmSync(satelliteLink, { recursive: true, force: true });
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
