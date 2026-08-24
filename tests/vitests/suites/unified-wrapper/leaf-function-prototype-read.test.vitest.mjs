/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/leaf-function-prototype-read.test.vitest.mjs
 *	@Date: 2026-08-24T00:00:00-08:00 (1756022400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-24T00:00:00-08:00 (1756022400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Reading a Function.prototype member off a callable leaf must not mutate its record (#304).
 *
 * @description
 * `leaf.apply(thisArg, args)` is a common forwarding idiom. The wrapper's get trap used to treat
 * every function-valued property — including the leaf's own inherited `apply`/`call`/`bind`/`constructor`
 * and its non-enumerable `prototype` — as a child endpoint, wrapping it and registering a phantom child.
 * A mere READ therefore flipped the leaf from `kind: "function"` to `kind: "namespace"` and grew a phantom
 * `leaf.apply` record. Built-in function members must return the function's own property untouched; only a
 * user-added enumerable own property materializes as a child. Verified in eager and lazy modes.
 * @module tests/vitests/suites/unified-wrapper/leaf-function-prototype-read
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";

const ROOT = resolve("tmp", `slothlet-leaffnproto-${Date.now()}-${Math.random().toString(36).slice(2)}`);

beforeAll(async () => {
	await mkdir(ROOT, { recursive: true });
	await writeFile(join(ROOT, "tool.mjs"), `export function ping() { return "pong"; }\n`);
	// A callable that ALSO carries a real, user-added enumerable own child (`version`): the built-in
	// members must still return native, but the genuine child must still materialize.
	await writeFile(join(ROOT, "greet.mjs"), `export function greet() { return "hi"; }\ngreet.version = function version() { return "v1"; };\n`);
});

const MODES = ["eager", "lazy"];
// The leaf function's OWN built-in surface, not api children: inherited callable members and the
// non-enumerable `prototype` slot. Reading any of them must not mutate the record.
const CALLABLE_MEMBERS = ["apply", "call", "bind", "constructor"];
const isPhantom = (p) => /\.(apply|call|bind|constructor|prototype)$/.test(p.path);

describe.each(MODES)("Function.prototype reads on a callable leaf leave the record intact — %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("does not turn a function leaf into a namespace or grow phantom children", async () => {
		api = await slothlet({ base: ROOT, silent: true, mode });

		const before = await api.slothlet.api.leaves(".", { details: true, includePrivate: true });
		expect(before.find((p) => p.path === "tool.ping")?.kind).toBe("function");
		expect(before.filter(isPhantom)).toHaveLength(0);

		// Read every built-in member — this must not mutate the record.
		for (const member of CALLABLE_MEMBERS) {
			expect(typeof api.tool.ping[member]).toBe("function");
		}
		expect(typeof api.tool.ping.prototype).toBe("object");
		expect(api.tool.ping()).toBe("pong");

		const after = await api.slothlet.api.leaves(".", { details: true, includePrivate: true });
		// The leaf stays a function, and no phantom `tool.ping.apply` / `.call` / `.bind` / … appeared.
		expect(after.find((p) => p.path === "tool.ping")?.kind).toBe("function");
		expect(after.filter(isPhantom)).toHaveLength(0);
		expect(after.some((p) => p.path.startsWith("tool.ping."))).toBe(false);
	});

	it("leaf.apply / leaf.call still invoke the leaf through slothlet", async () => {
		api = await slothlet({ base: ROOT, silent: true, mode });
		expect(api.tool.ping.apply(null, [])).toBe("pong");
		expect(api.tool.ping.call(null)).toBe("pong");
		const bound = api.tool.ping.bind(null);
		expect(bound()).toBe("pong");
	});

	it("a genuine user-added enumerable own child on a callable still materializes", async () => {
		api = await slothlet({ base: ROOT, silent: true, mode });
		// `greet.version` is a real enumerable own property — it IS a child endpoint and must resolve,
		// while `greet.apply` (built-in) returns the function's own member and is not a child.
		expect(api.greet()).toBe("hi");
		expect(api.greet.version()).toBe("v1");
		expect(typeof api.greet.apply).toBe("function");

		const details = await api.slothlet.api.leaves(".", { details: true, includePrivate: true });
		expect(details.find((p) => p.path === "greet.version")?.kind).toBe("function");
		expect(details.some((p) => isPhantom(p) && p.path.startsWith("greet."))).toBe(false);
	});
});
