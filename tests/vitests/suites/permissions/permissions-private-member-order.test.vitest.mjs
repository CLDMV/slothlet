/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-private-member-order.test.vitest.mjs
 *	@Date: 2026-11-25T11:36:09-08:00 (1795635369)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:56:53-08:00 (1795636613)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module privacy is decided ahead of the same-file self-call bypass and ahead of hook rules.
 *
 * @description
 * One folder is composed twice: as the base module and by `api.slothlet.api.add("ext", …)` as module `ext-mod`. Under
 * the default `private.scope: "module"` a private member belongs to the module that owns its path, so a leaf of
 * `tool.mjs` mounted by the base reaches none of the `_`-prefixed members `tool.mjs` exports at `ext.tool`, by any
 * route (call, read, write), although both leaves come from the same source file. Its public members stay reachable
 * through the self-call bypass. Under `"folder"` both mounts are one folder, so they read each other's members.
 *
 * A hook on another module's private member is refused however broad the hook rule that would allow it: a hook sees
 * the member's arguments and result, which is the member's to keep. A rule allowing it at registration, a pattern hook
 * firing on it, and a rule naming the member itself all leave it unhooked; the module that owns the member still hooks it.
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_private_order");
const DENIED = { value: undefined, error: "PERMISSION_DENIED" };
const ALLOWED = { value: true, error: null };

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["on", "strict"].map((permissionMode) => ({ mode, runtime, permissionMode })))
);

describe.each(configs)(
	"module privacy before the self-call bypass and hook rules > $mode / $runtime / $permissionMode",
	({ mode, runtime, permissionMode }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Compose the folder as the base module and again as module `ext-mod` at `ext`.
		 * @param {"module"|"folder"} scope - `permissions.private.scope`.
		 * @param {object[]} [rules] - Permission rules.
		 * @returns {Promise<object>} The api.
		 */
		const build = async (scope, rules = []) => {
			const built = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				hook: true,
				permissions: { mode: permissionMode, policy: "allow", rules, private: { scope } }
			});
			await built.slothlet.api.add("ext", BASE, { id: "ext-mod" });
			return built;
		};

		describe('private.scope "module"', () => {
			it("a leaf of the same file mounted by another module is refused the other mount's private members", async () => {
				api = await build("module");
				expect(await api.tool.callAt("ext.tool._secret", "x")).toEqual(DENIED);
				// A private function is handed to the same file's leaf as to any other module's, whose call of it is refused.
				expect(await api.tool.readAt("ext.tool._secret")).toEqual(await api.peek.readAt("ext.tool._secret"));
				expect(await api.tool.readAt("ext.tool._value")).toEqual(DENIED);
				expect(await api.tool.writeAt("ext.tool._value", 2)).toEqual(DENIED);
				expect(await api.ext.tool.callAt("tool._secret", "x")).toEqual(DENIED);
				// The base module's member is refused to `ext` by ownership before privacy is asked.
				expect(["PERMISSION_DENIED", "LOOSE_SET_NOT_OWNED"]).toContain((await api.ext.tool.writeAt("tool._value", 2)).error);
				// Another file of the base module is refused the same way.
				expect(await api.peek.callAt("ext.tool._secret", "x")).toEqual(DENIED);
				expect(await api.peek.readAt("ext.tool._value")).toEqual(DENIED);
				// The refused writes changed nothing.
				expect(await api.ext.tool.readAt("ext.tool._value")).toEqual({ value: 41, error: null });
				expect(await api.tool.readAt("tool._value")).toEqual({ value: 41, error: null });
			});

			it("each mount reaches its own private members, and the other mount's public members, through the same file", async () => {
				api = await build("module");
				expect(await api.tool.callAt("tool._secret", "x")).toEqual({ value: "secret:x", error: null });
				expect(await api.ext.tool.callAt("ext.tool._secret", "x")).toEqual({ value: "secret:x", error: null });
				expect(await api.ext.tool.writeAt("ext.tool._value", 3)).toEqual(ALLOWED);
				expect(await api.ext.tool.readAt("ext.tool._value")).toEqual({ value: 3, error: null });
				expect(await api.tool.callAt("ext.tool.pub", "x")).toEqual({ value: "pub:x", error: null });
				expect(await api.ext.tool.callAt("tool.pub", "x")).toEqual({ value: "pub:x", error: null });
			});

			it("a call of the module's own private member in the same file is still audited as a self-call", async () => {
				api = await build("module");
				const bypasses = [];
				api.slothlet.lifecycle.on("permission:self-bypass", (payload) => bypasses.push([].concat(payload.target).join(".")));
				expect(await api.tool.callAt("tool._secret", "x")).toEqual({ value: "secret:x", error: null });
				expect(bypasses).toContain("tool._secret");
			});
		});

		describe('private.scope "folder"', () => {
			it("both mounts are one folder, so they reach each other's private members", async () => {
				api = await build("folder");
				expect(await api.tool.callAt("ext.tool._secret", "x")).toEqual({ value: "secret:x", error: null });
				expect(await api.peek.callAt("ext.tool._secret", "x")).toEqual({ value: "secret:x", error: null });
				expect(await api.ext.tool.callAt("tool._secret", "x")).toEqual({ value: "secret:x", error: null });
			});
		});

		describe.each(["module", "folder"])('hooks, private.scope "%s"', (scope) => {
			describe.each(["**:hook", "**:before", "ext.tool._secret:hook"])("a rule allowing %s", (target) => {
				const rules = [{ caller: "watch.**", target, effect: "allow" }];

				it("does not let another module register a hook on a private member", async () => {
					api = await build(scope, rules);
					expect(await api.watch.spy.arm("ext.tool._secret:before")).toEqual(DENIED);
					expect(await api.ext.tool.callAt("ext.tool._secret", "pw")).toEqual({ value: "secret:pw", error: null });
					expect(await api.watch.spy.drain()).toEqual([]);
				});

				it("does not fire another module's pattern hook on a private member", async () => {
					api = await build(scope, rules);
					expect(await api.watch.spy.arm("ext.tool.*:before")).toEqual(ALLOWED);
					expect(await api.ext.tool.callAt("ext.tool._secret", "pw")).toEqual({ value: "secret:pw", error: null });
					expect(await api.ext.tool.callAt("ext.tool.pub", "p")).toEqual({ value: "pub:p", error: null });
					const seen = (await api.watch.spy.drain()).map((record) => JSON.parse(record).path);
					expect(seen).not.toContain("ext.tool._secret");
					// The hook fires on the public member, whether a rule admits it or the call decision does.
					expect(seen).toContain("ext.tool.pub");
				});
			});

			it("lets a hook rule admit a hook on a public member of another module", async () => {
				api = await build(scope, [{ caller: "watch.**", target: "**:hook", effect: "allow" }]);
				expect(await api.watch.spy.arm("ext.tool.pub:after")).toEqual(ALLOWED);
				expect(await api.ext.tool.callAt("ext.tool.pub", "p")).toEqual({ value: "pub:p", error: null });
				expect(await api.watch.spy.drain()).toEqual([JSON.stringify({ path: "ext.tool.pub", args: ["p"], result: "pub:p" })]);
			});
		});

		it('lets a module hook its own private member under private.scope "module"', async () => {
			api = await build("module", [{ caller: "watch.**", target: "**:hook", effect: "allow" }]);
			expect(await api.watch.spy.arm("tool._secret:after")).toEqual(ALLOWED);
			expect(await api.tool.callAt("tool._secret", "pw")).toEqual({ value: "secret:pw", error: null });
			expect(await api.watch.spy.drain()).toEqual([JSON.stringify({ path: "tool._secret", args: ["pw"], result: "secret:pw" })]);
		});
	}
);
