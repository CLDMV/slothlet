/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-function-member-routes.test.vitest.mjs
 *	@Date: 2026-11-15T13:40:33-08:00 (1794778833)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:27-08:00 (1795869147)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function node's own data member answers the same by every route back to its function as by a direct
 * read: `node.prototype.constructor`, a descriptor of it, a read with another receiver, an instance's `constructor`.
 *
 * @description
 * Fixture `api_test_function_member_routes`:
 * ```
 * api/root.mjs     export default function root(), with root.tag = "TAG"   (the api root, and mounted again at `zz`)
 * api/reader.mjs   at(path): reads `tag` of the node at `path` by every route (lib/routes.mjs)
 * _own/api/own.mjs export default function own(), with own.tag = "OWNTAG" (mounted at `own`)
 * _own/api/peek.mjs at(): the same reads of `self.own`, from a leaf of the module mounted at `own`
 * _cls/api/k.mjs   export class K, with K.tag = "KTAG"                     (mounted at `cls`: `api.cls.k.K`)
 * ```
 * In plain JavaScript `fn.prototype.constructor === fn`, so each route reads the function's own member. A rule
 * refusing the reader the member therefore refuses every route, as it refuses the direct read; where the member is
 * allowed, each route answers what it answers on the plain function (`routes()` run on the module's own function).
 * The owner case checks a module reading its own folder's function: owning the path grants no read.
 * @module tests/vitests/suites/permissions/permissions-function-member-routes
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import plainRoot from "../../../../api_tests/api_test_function_member_routes/api/root.mjs";
import plainOwn from "../../../../api_tests/api_test_function_member_routes_own/api/own.mjs";
import { K as PlainK } from "../../../../api_tests/api_test_function_member_routes_cls/api/k.mjs";
import { routes, instanceRoutes } from "../../../../api_tests/api_test_function_member_routes/lib/routes.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_function_member_routes");
const BASE = path.join(FIXTURE, "api");
const DENIED = "threw:PERMISSION_DENIED";

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** Each node read, with the plain function it stands for. */
const NODES = [
	{ label: "the api root", plain: plainRoot, read: (api) => api.reader.at("") },
	{ label: "a mounted function node (zz)", plain: plainRoot, read: (api) => api.reader.at("zz") },
	{ label: "a class node (cls.k.K)", plain: PlainK, read: (api) => api.reader.at("cls.k.K") },
	{ label: "its own module's function node (own, read by own.peek)", plain: plainOwn, read: (api) => api.own.peek.at() }
];

/**
 * What each route answers to a reader refused the member: a read is refused, a description or listing leaves it out.
 * @param {Record<string, string>} plain - What the routes answer on the plain function.
 * @returns {Record<string, string>} The answers.
 */
const refused = (plain) => ({
	...Object.fromEntries(Object.keys(plain).map((key) => [key, DENIED])),
	constructorDescribesTag: "undefined",
	constructorListsTag: "false",
	constructorEntries: "undefined",
	prototypeChain: plain.prototypeChain,
	instanceUsed: plain.instanceUsed
});

/** The rules refusing each reader its node's member. */
const DENY_MEMBER = [
	{ caller: "reader.**", target: "tag", effect: "deny" },
	{ caller: "reader.**", target: "zz.tag", effect: "deny" },
	{ caller: "reader.**", target: "cls.k.K.tag", effect: "deny" },
	{ caller: "own.peek.**", target: "own.tag", effect: "deny" }
];
const ALLOW_ALL = [
	{ caller: "reader.**", target: "**", effect: "allow" },
	{ caller: "own.peek.**", target: "**", effect: "allow" }
];

const POLICIES = [
	{ label: "a deny rule on the member", permissions: (attribution) => ({ caller: { attribution }, rules: DENY_MEMBER }), allowed: false },
	{
		label: "default deny, everything but the member allowed",
		permissions: (attribution) => ({ policy: "deny", caller: { attribution }, rules: [...ALLOW_ALL, ...DENY_MEMBER] }),
		allowed: false
	},
	{ label: "default allow, no rule", permissions: (attribution) => ({ caller: { attribution } }), allowed: true },
	{
		label: "default deny, everything allowed",
		permissions: (attribution) => ({ policy: "deny", caller: { attribution }, rules: ALLOW_ALL }),
		allowed: true
	},
	{ label: "permissions off", permissions: () => undefined, allowed: true },
	{ label: "permissions disabled", permissions: () => ({ mode: "disabled" }), allowed: true }
];

describe.each(CONFIGS)(
	"a function node's own member by every route > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		describe.each(POLICIES)("$label", (policy) => {
			let api;

			beforeAll(async () => {
				api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: policy.permissions(attribution) });
				await api.slothlet.api.add("zz", BASE);
				await api.slothlet.api.add("own", path.join(`${FIXTURE}_own`, "api"));
				await api.slothlet.api.add("cls", path.join(`${FIXTURE}_cls`, "api"));
			}, 60000);

			afterAll(async () => {
				await api?.shutdown?.();
				api = null;
			}, 60000);

			describe.each(NODES)("$label", (node) => {
				const plain = routes(node.plain);
				const expected = policy.allowed ? plain : refused(plain);

				it.each(Object.keys(plain))("%s answers as the direct read rules", async (route) => {
					const answered = await node.read(api);
					expect(answered[route]).toBe(expected[route]);
				});
			});

			it("an instance a leaf of the class's module hands out reads its class's member as the class does", async () => {
				const plain = instanceRoutes(new PlainK());
				const expected = policy.allowed ? plain : { ...plain, constructor: DENIED, prototype: DENIED };
				expect(await api.reader.made()).toEqual(expected);
			});

			it("the host reads each member", () => {
				expect(api.tag).toBe("TAG");
				expect(api.zz.tag).toBe("TAG");
				expect(api.own.tag).toBe("OWNTAG");
				expect(api.cls.k.K.tag).toBe("KTAG");
				expect(api.prototype.constructor.tag).toBe("TAG");
			});
		});
	}
);
