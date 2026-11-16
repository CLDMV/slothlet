/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/slothlet-namespace-view.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module lists and inspects `self.slothlet` as a plain object: only the members it may read, without
 * an error, and `util.inspect` shows exactly those.
 *
 * @description
 * A `reader` module lists members of `self.slothlet` (`Object.keys`, `Object.entries`, a spread copy) and inspects
 * them with `util.inspect` (depth, `showProxy`, `showHidden`). Expected values come from the module's own reads: a
 * listing holds the members whose read the module is given, and `util.inspect` shows the names the listing holds and
 * nothing the module may not read (an environment variable or `diag` a rule denies it). The host sees every member.
 * Permissions off, on with no rule, on with deny rules, and disabled; eager and lazy, the async and live runtime,
 * both attributions.
 * @module tests/vitests/suites/permissions/slothlet-namespace-view
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import util from "node:util";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_slothlet_namespace_view");
const MARKER_NAME = "SLOTHLET_NS_VIEW_MARKER";
const MARKER_VALUE = "ns-view-marker-7c2e41";

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** Permission setups: what the module is denied under each. */
const SETUPS = {
	off: { permissions: undefined, deniesMarker: false, deniesDiag: false },
	"on, no rule": { permissions: { defaultPolicy: "allow" }, deniesMarker: false, deniesDiag: false },
	"on, deny rules": {
		permissions: {
			defaultPolicy: "allow",
			rules: [
				{ caller: "reader.**", target: `slothlet.env.${MARKER_NAME}`, effect: "deny" },
				{ caller: "reader.**", target: "slothlet.diag", effect: "deny" }
			]
		},
		deniesMarker: true,
		deniesDiag: true
	},
	disabled: { permissions: { mode: "disabled" }, deniesMarker: false, deniesDiag: false }
};

const PATHS = ["slothlet", "slothlet.env", "slothlet.api", "slothlet.hook", "slothlet.permissions.control", "slothlet.materialize"];

/**
 * The names `util.inspect` shows at the top level of a `compact: false` text.
 * @param {string} text - The text.
 * @returns {string[]} The names.
 */
const names = (text) => [...text.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]);

/**
 * The host's member at a dotted path.
 * @param {object} api - The api.
 * @param {string} path - The path.
 * @returns {*} The member.
 */
const at = (api, path) => path.split(".").reduce((node, key) => node[key], api);

let markerBefore;
beforeAll(() => {
	markerBefore = process.env[MARKER_NAME];
	process.env[MARKER_NAME] = MARKER_VALUE;
});
afterAll(() => {
	if (markerBefore === undefined) delete process.env[MARKER_NAME];
	else process.env[MARKER_NAME] = markerBefore;
});

describe.each(Object.keys(SETUPS))("self.slothlet as a module lists and inspects it > permissions %s", (setupName) => {
	const setup = SETUPS[setupName];

	describe.each(configs)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Build the instance.
		 * @returns {Promise<object>} The api.
		 */
		async function build() {
			api = await slothlet({
				base: FIXTURE,
				silent: true,
				diagnostics: true,
				mode,
				runtime,
				...(setup.permissions ? { permissions: { ...setup.permissions, attribution } } : {})
			});
			await api.reader;
			return api;
		}

		it.each(PATHS)("lists only the members of %s it may read, without an error", async (path) => {
			await build();
			// A member the module may not read at all (`permissions.control` while the system is on) is refused as a read.
			if (!api.reader.reaches(path)) return;
			// The environment snapshot is frozen, so its listing has to hold every variable: one a rule denies the module is
			// refused, as reading it is.
			if (path === "slothlet.env" && setup.deniesMarker) {
				expect(api.reader.list(path)).toEqual({
					keys: "THROW PERMISSION_DENIED",
					entries: "THROW PERMISSION_DENIED",
					spread: "THROW PERMISSION_DENIED"
				});
				return;
			}
			const readable = api.reader.readable(path, Object.keys(at(api, path)));
			const { keys, entries, spread } = api.reader.list(path);
			expect(keys).toEqual(readable);
			expect(entries).toEqual(readable);
			expect(spread).toEqual(readable);
			if (path === "slothlet.env") expect(readable.includes(MARKER_NAME)).toBe(!setup.deniesMarker);
			if (path === "slothlet") expect(readable.includes("diag")).toBe(!setup.deniesDiag);
		});

		it.each(PATHS)("shows %s through util.inspect as the members it lists, and nothing it may not read", async (path) => {
			await build();
			if (!api.reader.reaches(path)) return;
			const listed = api.reader.list(path).keys;
			// The frozen environment snapshot's listing is refused under a rule on one of its variables; it shows the rest.
			const keys = Array.isArray(listed) ? listed : api.reader.readable(path, Object.keys(at(api, path)));
			for (const options of [{ depth: 0 }, { depth: 3 }, { depth: 3, showProxy: true }, { depth: 3, showHidden: true }]) {
				const text = api.reader.shown(path, { ...options, compact: false });
				expect(text.startsWith("THROW"), `${JSON.stringify(options)}: ${text}`).toBe(false);
				if (!options.showProxy) expect(names(text), JSON.stringify(options)).toEqual(keys);
				if (setup.deniesMarker) expect(text).not.toContain(MARKER_VALUE);
				if (setup.deniesDiag) expect(text).not.toContain("getAPI");
			}
		});

		it.each(PATHS)("reads a name %s does not hold as undefined, as at an api node", async (path) => {
			await build();
			if (!api.reader.reaches(path)) return;
			// `$$typeof` and `0` are what serializers and Node 22/24's util.inspect probe an object for.
			for (const name of ["$$typeof", "0", "notAMember"]) expect(api.reader.absent(path, name), name).toBe("undefined");
		});

		it.each(PATHS.filter((path) => path !== "slothlet.env"))(
			"reads a name %s inherits from Object.prototype as plain JS does",
			async (path) => {
				await build();
				if (!api.reader.reaches(path)) return;
				for (const name of ["constructor", "toString", "hasOwnProperty"]) expect(api.reader.inherited(path, name), name).toBe(true);
			}
		);

		it("shows a module the environment variables it may read", async () => {
			await build();
			expect(api.reader.shown("slothlet.env", {}).includes(MARKER_VALUE)).toBe(!setup.deniesMarker);
		});

		it("shows the host every member", async () => {
			await build();
			for (const path of PATHS) {
				expect(names(util.inspect(at(api, path), { depth: 0, compact: false })), path).toEqual(Object.keys(at(api, path)));
			}
			expect(util.inspect(api.slothlet.env)).toContain(MARKER_VALUE);
			expect(util.inspect(api.slothlet.materialize)).toContain("materialized: [Getter]");
		});
	});
});
