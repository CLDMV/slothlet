/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-root-function-members.test.vitest.mjs
 *	@Date: 2026-11-15T10:00:00-08:00 (1794765600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:07-08:00 (1794882607)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root function's own members (`prototype`, `name`, `length`, `toString`, and running it through
 * `call` / `apply` / `bind`) answer a module as a function node's do.
 *
 * @description
 * Fixture `api_test_root_function_members`:
 * ```
 * root.mjs    export default function root(a = 0, b = 0) → "root:<a+b>", with root.tag = "TAG"
 * reader.mjs  probe(at): reads those members of the api root (at "") or of the node at `at`
 * ```
 * The same folder is mounted at `zz`, so `self.zz` is the root's twin: a function node holding the same function.
 *
 * Expected values come from the twin and from plain JavaScript. A node's `prototype` and `toString` hold its code and
 * are checked as a call of the node, its `name` and `length` are read through the read gate, and a call through `call`,
 * `apply` or `bind` is a call of the node (docs/PERMISSIONS.md). Under `defaultPolicy: "deny"` with no rule the reader
 * is refused each of them at `zz`, so it is at the root; with the reads and calls allowed (a rule whose target is `**`
 * covers the root, which no rule names on its own), each answers what the plain function answers. With the permission
 * system off or disabled nothing is refused.
 * @module tests/vitests/suites/permissions/permissions-root-function-members
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import plainRoot from "../../../../api_tests/api_test_root_function_members/root.mjs";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_root_function_members");
const DENIED = "threw:PERMISSION_DENIED";

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** What each probe answers for the plain function, as `reader.probe` reports it. */
const PLAIN = {
	prototype: "object",
	constructorTag: String(plainRoot.prototype.constructor.tag),
	constructorRun: plainRoot.prototype.constructor(1, 2),
	name: plainRoot.name,
	length: String(plainRoot.length),
	source: plainRoot.toString().slice(0, 15),
	call: plainRoot.call(null, 1, 2),
	apply: plainRoot.apply(null, [1, 2]),
	bind: plainRoot.bind(null, 1)(2),
	describePrototype: "described",
	describeName: "described"
};

/** What each probe answers to a reader refused the node. */
const REFUSED = {
	prototype: DENIED,
	constructorTag: DENIED,
	constructorRun: DENIED,
	name: plainRoot.name,
	length: String(plainRoot.length),
	source: DENIED,
	call: DENIED,
	apply: DENIED,
	bind: DENIED,
	describePrototype: "none",
	describeName: "described"
};

const POLICIES = [
	{ label: "default deny, no rule", permissions: (attribution) => ({ policy: "deny", caller: { attribution } }), root: REFUSED },
	{
		label: "default deny, the reader allowed every target",
		permissions: (attribution) => ({
			policy: "deny",
			caller: { attribution },
			rules: [{ caller: "reader.**", target: "**", effect: "allow" }]
		}),
		root: PLAIN
	},
	{ label: "default allow", permissions: (attribution) => ({ policy: "allow", caller: { attribution } }), root: PLAIN },
	{ label: "permissions off", permissions: () => undefined, root: PLAIN },
	{ label: "permissions disabled", permissions: () => ({ mode: "disabled" }), root: PLAIN }
];

describe.each(CONFIGS)("the api root function's own members > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	describe.each(POLICIES)("$label", (policy) => {
		let api;
		let root;
		let twin;

		beforeAll(async () => {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: policy.permissions(attribution) });
			await api.slothlet.api.add("zz", BASE);
			root = await api.reader.probe("");
			twin = await api.reader.probe("zz");
		}, 60000);

		afterAll(async () => {
			await api?.shutdown?.();
			api = null;
		}, 60000);

		it.each(Object.keys(PLAIN).map((key) => ({ key, answer: policy.root[key] })))("$key answers $answer", ({ key, answer }) => {
			expect(root[key]).toBe(answer);
		});

		it.each(Object.keys(PLAIN).filter((key) => key !== "name"))("%s answers as at the mounted twin", (key) => {
			expect(root[key]).toBe(twin[key]);
		});

		it("the host still calls the root and reads its members", () => {
			expect(api(1, 2)).toBe("root:3");
			expect(typeof api.prototype).toBe("object");
			expect(api.name).toBe("root");
		});
	});
});
