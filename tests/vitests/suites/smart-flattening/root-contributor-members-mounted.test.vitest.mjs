/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/root-contributor-members-mounted.test.vitest.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:28-08:00 (1794882628)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A mounted folder's root file whose default export is a function: the file's members record the file
 * they were written in, and their code runs as the member, under the rules, as it does at the base load.
 *
 * @description
 * Fixture `api_test_root_contributor_members` (see `root-contributor-members.test.vitest.mjs`), mounted with
 * `api.slothlet.api.add()` at `zz` and at `zz.s`, beside the same folder loaded as the base folder. Expected values
 * are plain JavaScript and the rules: `peek` reads the vault when no rule names it, and is refused when a rule denies
 * it the vault, whoever calls it; `me` reads its own path; each member records `calc.mjs` as its file.
 * @module tests/vitests/suites/smart-flattening/root-contributor-members-mounted
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

const API_TESTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests");
const FIXTURE = path.join(API_TESTS, "api_test_root_contributor_members");
const WORK = path.join(API_TESTS, "api_test_globstar_zero", "work");

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);
const PLACES = ["", "zz", "zz.s"];

/**
 * The node at a dotted path.
 * @param {object} root - Where the path starts.
 * @param {string} at - The path.
 * @returns {unknown} The node.
 */
const nodeAt = (root, at) => at.split(".").reduce((node, key) => node[key], root);

/**
 * Builds the fixture at `place`.
 * @param {string} place - "" for the base load, or the mount path.
 * @param {object} options - Instance options.
 * @returns {Promise<{api: object, root: object}>} The api and the node the fixture's root is.
 */
async function build(place, options) {
	const api = await slothlet({ base: place ? WORK : FIXTURE, silent: true, ...options });
	if (place) await api.slothlet.api.add(place, FIXTURE);
	return { api, root: place ? nodeAt(api, place) : api };
}

describe.each(CONFIGS)(
	"a root file's members run as themselves wherever the folder is placed > $mode, $runtime, $attribution",
	(config) => {
		const { mode, runtime, attribution } = config;

		describe.each(PLACES)("placed at '%s'", (place) => {
			const P = place ? `${place}.` : "";
			const permissions = (rules) => ({ permissions: { policy: "allow", caller: { attribution }, rules } });

			it("each member records the file it was written in", async () => {
				const { api, root } = await build(place, { mode, runtime });
				try {
					for (const name of ["add", "peek", "me", "cfg", "cfg.f"]) {
						expect([name, path.basename(String(nodeAt(root, name).__metadata?.filePath))]).toEqual([name, "calc.mjs"]);
					}
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("with no rule naming it, a member's own access answers, called by the host or by a module", async () => {
				const { api, root } = await build(place, { mode, runtime, ...permissions([]) });
				try {
					expect(await root.peek(place)).toBe("SECRET");
					expect(await root.probe.call(`${P}peek`, place)).toBe("SECRET");
					expect(await root.me()).toBe(`${P}me`);
					expect(await root.probe.call(`${P}me`)).toBe(`${P}me`);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("a deny naming a member as the caller refuses its access, whoever calls it, and nothing beside it", async () => {
				const { api, root } = await build(place, {
					mode,
					runtime,
					...permissions([{ caller: `${P}peek`, target: `${P}vault.**`, effect: "deny" }])
				});
				try {
					await expect(root.peek(place)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
					expect(await root.probe.call(`${P}peek`, place)).toBe("PERMISSION_DENIED");
					expect(await root.vault.get()).toBe("SECRET");
					expect(await root.me()).toBe(`${P}me`);
				} finally {
					await api.slothlet.shutdown();
				}
			});
		});
	}
);
