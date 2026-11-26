/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-private-function-read.test.vitest.mjs
 *	@Date: 2026-11-25T12:09:24-08:00 (1795637364)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T12:23:24-08:00 (1795638204)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A read of another module's private function member is refused as a read of its private value is.
 *
 * @description
 * One folder is composed twice: as the base module and by `api.slothlet.api.add("ext", …)` as module `ext-mod`. Under
 * `private.scope: "module"` the `_`-prefixed members `tool.mjs` exports at `ext.tool` are `ext-mod`'s. A leaf of the base
 * module, in the same source file or another, is refused a read of the private function `ext.tool._secret` as it is
 * refused `ext.tool._value`, and the key is left out of what it lists of `ext.tool` the same way: the function's source
 * text and the members it carries are the module's. The owning module still reads, lists and calls it; a public
 * function and an underscore-prefixed folder (a public mount) of the other module stay readable. The host is refused
 * unless `private.host: "allow"`.
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const BASE = resolve("api_tests/api_test_private_fn_read/api");
const DENIED = { value: undefined, error: "PERMISSION_DENIED" };

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["on", "strict"].map((permissionMode) => ({ mode, runtime, permissionMode })))
);

/**
 * What the host gets reading a member.
 * @param {Function} read - The read.
 * @returns {{value: *, error: string|null}} The type read, or the refusal's code.
 */
const hostRead = (read) => {
	try {
		const value = read();
		return { value: typeof value === "function" ? "function" : value, error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
};

describe.each(configs)(
	"a private function member read by another module > $mode / $runtime / $permissionMode",
	({ mode, runtime, permissionMode }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Compose the folder as the base module and again as module `ext-mod` at `ext`.
		 * @param {object} [privateConfig] - `permissions.private`.
		 * @returns {Promise<object>} The api.
		 */
		const build = async (privateConfig = { scope: "module" }) => {
			const built = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				permissions: { mode: permissionMode, policy: "allow", private: privateConfig }
			});
			await built.slothlet.api.add("ext", BASE, { id: "ext-mod" });
			return built;
		};

		it.each(["tool", "peek"])("refuses a leaf of %s the read, as it refuses the private value", async (reader) => {
			api = await build();
			const fn = await api[reader].look("ext.tool._secret");
			const value = await api[reader].look("ext.tool._value");
			expect(value.read).toEqual(DENIED);
			expect(fn.read).toEqual(DENIED);
			expect(fn.reflectGet).toEqual(DENIED);
			expect(fn.source).toBeUndefined();
			expect(fn.held).toBeUndefined();
			// The key is left out of the listing as the private value's is.
			expect({ listed: fn.listed, ownKeys: fn.ownKeys, described: fn.described, spread: fn.spread }).toEqual({
				listed: value.listed,
				ownKeys: value.ownKeys,
				described: value.described,
				spread: value.spread
			});
			expect(fn.listed).toBe(false);
			expect(fn.inspected).not.toContain("_secret");
			expect(fn.inspected).not.toContain("SOURCE_7731");
			expect(fn.inspected).not.toContain("LABEL_7731");
			// Calling it stays refused.
			expect(await api[reader].call("ext.tool._secret", "x")).toEqual(DENIED);
		});

		it("lets the owning module read, list and call its private function", async () => {
			api = await build();
			const own = await api.ext.tool.look("ext.tool._secret");
			expect(own.read).toEqual({ value: "function", error: null });
			expect(own.source).toContain("SOURCE_7731");
			expect(own.held).toBe("LABEL_7731");
			expect(own.listed).toBe(true);
			expect(await api.ext.tool.call("ext.tool._secret", "x")).toEqual({ value: "SOURCE_7731:x", error: null });
			const base = await api.peek.look("tool._secret");
			expect(base.read).toEqual({ value: "function", error: null });
			expect(base.listed).toBe(true);
			expect(await api.peek.call("tool._secret", "y")).toEqual({ value: "SOURCE_7731:y", error: null });
		});

		it("leaves another module's public function and underscore-prefixed folder readable", async () => {
			api = await build();
			expect((await api.peek.look("ext.tool.pub")).read).toEqual({ value: "function", error: null });
			expect(await api.peek.call("ext.tool.pub", "p")).toEqual({ value: "pub:p", error: null });
			// An underscore-prefixed folder is a public mount: the node and what it holds are read and listed.
			expect((await api.peek.look("ext._box")).read.error).toBeNull();
			const open = await api.peek.look("ext._box.item.open");
			expect(open.read).toEqual({ value: "function", error: null });
		});

		it('lets every file of the folder read it under private.scope "folder"', async () => {
			api = await build({ scope: "folder" });
			for (const reader of ["tool", "peek"]) {
				const fn = await api[reader].look("ext.tool._secret");
				expect(fn.read).toEqual({ value: "function", error: null });
				expect(fn.listed).toBe(true);
				expect(await api[reader].call("ext.tool._secret", "z")).toEqual({ value: "SOURCE_7731:z", error: null });
			}
		});

		it("refuses the host the read as it refuses the private value, unless private.host allows it", async () => {
			api = await build();
			expect(hostRead(() => api.ext.tool._value)).toEqual(DENIED);
			expect(hostRead(() => api.ext.tool._secret)).toEqual(DENIED);
			await api.shutdown();
			api = await build({ scope: "module", host: "allow" });
			expect(hostRead(() => api.ext.tool._secret)).toEqual({ value: "function", error: null });
			expect(await api.ext.tool._secret("h")).toBe("SOURCE_7731:h");
		});
	}
);
