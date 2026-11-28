/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/context-set.test.vitest.mjs
 *	@Date: 2026-11-16T16:58:46-08:00 (1794877126)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:27-08:00 (1795869087)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.context.set()`: changes the instance-level context every leaf reads.
 * @module tests/vitests/suites/context/context-set.test.vitest
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, "../../../../api_tests/api_test_context_set");

describe.each(getMatrixConfigs({}))("context.set > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	test("one key: every leaf reads it, and context.get() returns it", async () => {
		api = await slothlet({ ...config, base: BASE, context: { tenant: "acme" } });
		api.slothlet.context.set("region", "eu");
		expect(await api.reader.read("region")).toBe("eu");
		expect(await api.reader.read("tenant")).toBe("acme");
		expect(api.slothlet.context.get("region")).toBe("eu");
	});

	test("an object sets several keys", async () => {
		api = await slothlet({ ...config, base: BASE });
		api.slothlet.context.set({ tenant: "globex", region: "us" });
		expect(api.slothlet.context.get()).toEqual({ tenant: "globex", region: "us" });
		expect(await api.reader.read("tenant")).toBe("globex");
	});

	test("the context passed to slothlet() is copied: changing it later changes nothing, set() leaves it alone", async () => {
		const passed = { tenant: "acme" };
		api = await slothlet({ ...config, base: BASE, context: passed });
		passed.tenant = "changed";
		passed.extra = 1;
		expect(await api.reader.read("tenant")).toBe("acme");
		expect(api.slothlet.context.get("extra")).toBeUndefined();
		api.slothlet.context.set("tenant", "globex");
		expect(passed.tenant).toBe("changed");
	});

	test("a run()'s own keys win inside it; a run keeps the context it started with", async () => {
		api = await slothlet({ ...config, base: BASE, context: { tenant: "acme", region: "eu" } });
		const seen = await api.slothlet.context.run({ tenant: "request" }, async () => {
			api.slothlet.context.set({ tenant: "globex", region: "us" });
			return [await api.reader.read("tenant"), await api.reader.read("region")];
		});
		expect(seen).toEqual(["request", "eu"]);
		expect(api.slothlet.context.get("tenant")).toBe("globex");
		// A run started after set() starts from the new value.
		const after = await api.slothlet.context.run({}, async () => api.reader.read("tenant"));
		expect(after).toBe("globex");
	});

	test("a reload keeps what set() made", async () => {
		api = await slothlet({ ...config, base: BASE, context: { tenant: "acme" } });
		api.slothlet.context.set("region", "eu");
		await api.slothlet.reload();
		expect(await api.reader.read("region")).toBe("eu");
		expect(api.slothlet.context.get("tenant")).toBe("acme");
	});

	test("a key the active scope protects is refused", async () => {
		api = await slothlet({ ...config, base: BASE });
		await expect(
			api.slothlet.context.scope({
				context: { tenant: "acme" },
				protect: ["tenant"],
				fn: async () => api.slothlet.context.set("tenant", "globex")
			})
		).rejects.toMatchObject({ code: "CONTEXT_KEY_PROTECTED" });
		expect(api.slothlet.context.get("tenant")).toBeUndefined();
	});

	test.each([
		["no arguments", []],
		["a key without a value", ["tenant"]],
		["an array", [["tenant"]]],
		["null", [null]],
		["__proto__ as a key", ["__proto__", {}]],
		["constructor in an object", [JSON.parse('{"constructor": 1}')]]
	])("refuses %s", async (_label, args) => {
		api = await slothlet({ ...config, base: BASE });
		expect(() => api.slothlet.context.set(...args)).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
	});

	test("module code is refused by the built-in rule while permissions are on", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { mode: "on" } });
		await expect((async () => api.writer.write("tenant", "evil"))()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
		expect(api.slothlet.context.get("tenant")).toBeUndefined();
	});

	test("module code may call it when a rule allows slothlet.context.set", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { mode: "on", rules: [{ caller: "writer.**", target: "slothlet.context.set", effect: "allow" }] }
		});
		await api.writer.write("tenant", "acme");
		expect(await api.reader.read("tenant")).toBe("acme");
	});
});
