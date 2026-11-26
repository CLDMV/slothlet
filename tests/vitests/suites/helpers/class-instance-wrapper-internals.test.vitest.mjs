/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/class-instance-wrapper-internals.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The creator lookup, the class-instance check and the one-take rule of `class-instance-wrapper`'s
 * internal bindings, on a copy of the module that has taken nothing yet.
 *
 * @description
 * The module hands its internal bindings to each of slothlet's own consumers once. The suite's shared copy has been
 * taken by the real consumers already, so these tests load a second evaluation of the file (its own state) and take
 * the bindings from it.
 */
import { describe, it, expect } from "vitest";

const COPY = new URL("../../../../src/lib/helpers/class-instance-wrapper.mjs?internals-copy", import.meta.url).href;
const CONSUMER = "lib/handlers/context-async";

describe("Helpers > class-instance-wrapper > internal bindings", () => {
	it("answers null for the creator of anything that is no wrapped instance", async () => {
		const mod = await import(/* @vite-ignore */ COPY);
		const { runtime_classInstanceCreator } = mod.internals(CONSUMER);
		expect(runtime_classInstanceCreator(null)).toBeNull();
		expect(runtime_classInstanceCreator(undefined)).toBeNull();
		expect(runtime_classInstanceCreator(7)).toBeNull();
		expect(runtime_classInstanceCreator("text")).toBeNull();
		expect(runtime_classInstanceCreator({})).toBeNull();
	});

	it("refuses a second take of the bindings by the same consumer, and a consumer that is not listed", async () => {
		const mod = await import(/* @vite-ignore */ COPY);
		expect(() => mod.internals(CONSUMER)).toThrow();
		expect(() => mod.internals("lib/not/a/consumer")).toThrow();
		expect(() => mod.internals(42)).toThrow();
	});
});

describe("Helpers > class-instance-wrapper > runtime_isClassInstance", () => {
	it("is false for a value whose prototype chain cannot be read", async () => {
		const { runtime_isClassInstance } = await import("#helpers/class-instance-wrapper");
		const refusing = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw new Error("refused");
				}
			}
		);
		expect(runtime_isClassInstance(refusing)).toBe(false);
	});
});
