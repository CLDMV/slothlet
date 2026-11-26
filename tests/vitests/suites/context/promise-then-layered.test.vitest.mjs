/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/promise-then-layered.test.vitest.mjs
 *	@Date: 2026-11-25T01:35:11-08:00 (1795599311)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:33-08:00 (1795600293)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `helpers/promise-context` loaded while another copy's `then` patch is installed, and its own patch.
 *
 * @description
 * A copy of slothlet loaded into a realm where another copy has already wrapped `Promise.prototype.then` follows the
 * wrappers down (each keeps the function it replaced under `Symbol.for("slothlet.promise.originalThen")`) to the
 * engine's own `then`, and registers its reactions through that. Its own patch, once enabled, pins the reactions it
 * registers for the promise a call returned through the runtime's `forResult` form; a receiver whose derived promise
 * the engine would build from code of its own (an own `constructor`) gets a promise made by slothlet that settles the
 * same way.
 *
 * The copy is loaded over intrinsics that hold that wrapper as `Promise.prototype.then`.
 * @module tests/vitests/suites/context/promise-then-layered
 */

import { pathToFileURL } from "node:url";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { setApiCallerPinner } from "#helpers/caller-pinning";
// Loaded first, so the files it imports are loaded once, unmocked: only the copy below is evaluated over stand-ins.
import "#helpers/promise-context";
import { internalLibPath } from "../../setup/internal-resolve.mjs";

const ORIGINAL_THEN = Symbol.for("slothlet.promise.originalThen");
const engineThen = Promise.prototype.then;
let copy;
let bindings;

beforeAll(async () => {
	// Another copy's wrapper, two deep, in place as slothlet's intrinsics were taken.
	const inner = function then(...args) {
		return Reflect.apply(engineThen, this, args);
	};
	inner[ORIGINAL_THEN] = engineThen;
	const outer = function then(...args) {
		return Reflect.apply(inner, this, args);
	};
	outer[ORIGINAL_THEN] = inner;
	vi.doMock("#helpers/intrinsics", async (importOriginal) => {
		const original = await importOriginal();
		return {
			...original,
			PrototypeFunctions: { ...original.PrototypeFunctions, Promise: { ...original.PrototypeFunctions.Promise, then: outer } }
		};
	});
	try {
		copy = await import(`${pathToFileURL(internalLibPath("helpers/promise-context.mjs")).href}?layered=other-copy-installed`);
	} finally {
		vi.doUnmock("#helpers/intrinsics");
	}
	bindings = copy.internals("slothlet");
});

afterAll(() => {
	bindings?.disablePromisePatching();
	setApiCallerPinner(null);
});

describe("Context > promise context > loaded under another copy's then", () => {
	it("takes the engine's then from under the other copy's wrappers", () => {
		expect(copy.engineThenOf(engineThen)).toBe(engineThen);
		expect(copy.engineThenOf(function then() {})).toBe(null);
	});

	it("settles reactions it registers as then would", async () => {
		await expect(copy.nativeThen(Promise.resolve(1), (value) => value + 1)).resolves.toBe(2);
	});
});

describe("Context > promise context > reactions for a call's result under the patch", () => {
	beforeAll(() => bindings.enablePromisePatching());
	afterAll(() => {
		bindings.disablePromisePatching();
		setApiCallerPinner(null);
	});

	it("pins them through forResult and settles a receiver with its own constructor as then would", async () => {
		const seen = [];
		const strategy = (callback) => callback;
		strategy.forResult = (result, callbacks) => {
			seen.push(result);
			return callbacks;
		};
		setApiCallerPinner(strategy);
		const result = Promise.resolve(5);
		Object.defineProperty(result, "constructor", { value: Promise, configurable: true });
		await expect(copy.pinnedResultThen(result, (value) => value * 2)).resolves.toBe(10);
		expect(seen).toEqual([result]);
		const failed = Promise.reject(new Error("bad"));
		Object.defineProperty(failed, "constructor", { value: Promise, configurable: true });
		await expect(copy.pinnedResultThen(failed, undefined, (error) => error.message)).resolves.toBe("bad");
	});
});
