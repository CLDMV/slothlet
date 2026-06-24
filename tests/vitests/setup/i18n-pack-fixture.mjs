/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/i18n-pack-fixture.mjs
 *	@Date: 2026-06-23 20:55:34 -07:00 (1782273334)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-23 21:02:29 -07:00 (1782273749)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Shared staging for the optional `@cldmv/slothlet-i18n` test pack.
 *
 * The pack MUST live in the repo's real `node_modules` because slothlet resolves it with
 * `import.meta.resolve("@cldmv/slothlet-i18n/...")` from its OWN source (under `--conditions=slothlet-dev`
 * that is the in-repo `src/`), and Node resolves modules by realpath — so the only `node_modules` that
 * resolve can reach is an ancestor of the running slothlet source, i.e. the repo's. A temp tree can't be
 * substituted without `--preserve-symlinks` or copying the whole core in.
 *
 * What gets staged is the REAL carved package (`dist-packages/slothlet-i18n`, built via `build:subpackages`),
 * copied into `node_modules` so the suite exercises the actual published artifact — plus one sentinel locale
 * that exists ONLY in the pack, so the resolution test can prove a locale was served from the pack rather
 * than the internal fallback (in dev mode core still ships the same locales, so identical content can't
 * distinguish the source).
 *
 * To avoid (a) clobbering a developer's real install and (b) the cross-worker race that per-test-file
 * `beforeAll`/`afterAll` staging caused under `pool: "forks"`, the pack is staged ONCE by the runner
 * (`run-all-vitest.mjs`) before any worker spawns, and torn down after. The runner sets {@link STAGED_ENV};
 * suites that depend on the pack call {@link assertI18nPackStaged} and fail loudly when run bare
 * (outside the runner) instead of silently resolving the internal copy.
 *
 * @module tests/vitests/setup/i18n-pack-fixture
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync, renameSync, cpSync } from "node:fs";
import { join } from "node:path";

/** Env var the runner sets once the pack is staged; the guard checks it. @type {string} */
export const STAGED_ENV = "SLOTHLET_TEST_PACKS_STAGED";

/** Sentinel locale injected into the staged pack — exists ONLY in the pack, proving "served from pack". @type {string} */
export const PACK_LOCALE = "qa-pack";
/** Translation key shipped by the sentinel locale. @type {string} */
export const PACK_KEY = "TEST_PACK_KEY";
/** Translation value shipped by the sentinel locale. @type {string} */
export const PACK_MESSAGE = "Loaded from the @cldmv/slothlet-i18n pack";

/** Marker dropped into the staged copy so a crashed run's leftover is recognised as ours (not a real install). */
const FIXTURE_MARKER = ".slothlet-test-fixture";

/**
 * Absolute path to the staged pack inside the repo's `node_modules`.
 * @param {string} [root=process.cwd()] - Repo root (the runner and the workers share `process.cwd()`).
 * @returns {string} Absolute path to `<root>/node_modules/@cldmv/slothlet-i18n`.
 */
export function packDir(root = process.cwd()) {
	return join(root, "node_modules", "@cldmv", "slothlet-i18n");
}

/** Whether the dir at `p` is our staged copy (vs. a real installed pack). @param {string} p @returns {boolean} */
function isFixture(p) {
	return existsSync(join(p, FIXTURE_MARKER));
}

/**
 * Ensure the carved pack exists, building it via the npm scripts if needed.
 * @param {string} root - Repo root.
 * @returns {string} Absolute path to `dist-packages/slothlet-i18n`.
 */
function ensureCarvedPack(root) {
	const carved = join(root, "dist-packages", "slothlet-i18n");
	if (existsSync(join(carved, "package.json"))) return carved;
	// Build via the npm scripts (the carve reads dist/, so build:dist first). build:subpackages also
	// carves the types satellite, which needs built types and may fail — that's fine here; the i18n pack
	// is produced first, so we only require its output to exist afterward.
	execFileSync("npm", ["run", "build:dist"], { cwd: root, stdio: "ignore" });
	try {
		execFileSync("node", [join(root, "tools", "build", "build-subpackages.mjs")], { cwd: root, stdio: "ignore" });
	} catch {
		/* types-satellite carve may fail without built types; the i18n carve runs first — verified below. */
	}
	if (!existsSync(join(carved, "package.json"))) {
		throw new Error(`could not build dist-packages/slothlet-i18n — run "npm run build:dist && npm run build:subpackages" first`);
	}
	return carved;
}

/**
 * Stage the carved pack (+ sentinel) into `node_modules`, backing up (never destroying) a real install.
 * @param {string} [root=process.cwd()] - Repo root.
 * @returns {() => void} Idempotent restore function: removes the staged copy and puts any real install back.
 * @example
 * const restore = stageI18nPack();
 * try { await runTests(); } finally { restore(); }
 */
export function stageI18nPack(root = process.cwd()) {
	const carved = ensureCarvedPack(root);
	const dir = packDir(root);
	const backup = `${dir}.real-backup`;

	// Self-heal a prior crashed run: a leftover real-backup with no (or only our fixture) pack means the
	// previous restore never ran — recover the real install before staging over it again.
	if (existsSync(backup) && (!existsSync(dir) || isFixture(dir))) {
		rmSync(dir, { recursive: true, force: true });
		renameSync(backup, dir);
	}

	let hadReal = false;
	if (existsSync(dir)) {
		if (isFixture(dir)) {
			rmSync(dir, { recursive: true, force: true }); // stale fixture from a crashed run
		} else {
			rmSync(backup, { recursive: true, force: true });
			renameSync(dir, backup); // preserve the developer's real install
			hadReal = true;
		}
	}

	cpSync(carved, dir, { recursive: true });
	writeFileSync(join(dir, FIXTURE_MARKER), "staged by tests/vitests/setup/i18n-pack-fixture.mjs\n");
	writeFileSync(join(dir, "languages", `${PACK_LOCALE}.json`), JSON.stringify({ translations: { [PACK_KEY]: PACK_MESSAGE } }));

	let restored = false;
	return function restore() {
		if (restored) return;
		restored = true;
		rmSync(dir, { recursive: true, force: true });
		if (hadReal) renameSync(backup, dir);
	};
}

/**
 * Fail loudly when the pack wasn't staged by the runner (i.e. a bare `npx vitest` run).
 * @returns {void}
 * @throws {Error} When {@link STAGED_ENV} is unset.
 */
export function assertI18nPackStaged() {
	if (!process.env[STAGED_ENV]) {
		throw new Error(
			`The @cldmv/slothlet-i18n test pack is not staged (${STAGED_ENV} unset). Run this suite through the ` +
				`runner, which builds + stages it once and tears it down — e.g. \`node tests/vitests/run-all-vitest.mjs ` +
				`suites/i18n\` or \`npm run vitest -- suites/i18n\` — not a bare \`npx vitest\`.`
		);
	}
}
