/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/returned-errors.browser.test.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:52-08:00 (1795869052)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, data holding an error a module returns comes back as itself with provenance off.
 *
 * @description
 * With `permissions.provenance` off, returned data is searched for code instead of frames being read, and an object of
 * plain data is checked once by a copy for being one of the language's iterators in disguise. An error of the
 * language's own is told by `Error.isError` and copied without formatting its stack, so data holding one comes back as
 * itself; a disguised iterator, alone or beside an error, still comes back as the module's stand-in, which the
 * platform's `structuredClone` refuses.
 * @module tests/browser/returned-errors
 */

import { describe, it, expect } from "vitest";

describe("browser returned errors", () => {
	/**
	 * An instance with provenance off and a module returning data holding errors and look-alikes.
	 * @returns {Promise<object>} The api.
	 */
	const boot = async () => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const api = await slothlet({
			loader: {
				platform: "browser"
			},
			mode: "eager",
			silent: true,
			permissions: { policy: "allow", caller: { provenance: false } }
		});
		const steal = () => "module code";
		await api.slothlet.api.add(
			"slots",
			{
				exports: {
					errorData: (kind) => {
						if (kind === "error") return { ok: false, error: new Error("x") };
						if (kind === "aggregate") return { error: new AggregateError([new TypeError("a")], "agg", { cause: { code: 1 } }) };
						if (kind === "iteratorHoldingError")
							return {
								inner: Object.assign(Object.setPrototypeOf([steal][Symbol.iterator](), Object.prototype), { error: new Error("i") })
							};
						if (kind === "errorBesideIterator")
							return { error: new Error("b"), inner: Object.setPrototypeOf([steal][Symbol.iterator](), Object.prototype) };
						return { error: Object.setPrototypeOf(new Error("r"), Object.prototype) };
					}
				}
			},
			{ id: "slots" }
		);
		return api;
	};

	/**
	 * Whether the platform's `structuredClone` copies a value: data does, a stand-in (a Proxy) does not.
	 * @param {unknown} value - The value.
	 * @returns {boolean} True when it copies.
	 */
	const copies = (value) => {
		try {
			structuredClone(value);
			return true;
		} catch {
			return false;
		}
	};

	it("hands out data holding an error as itself, without formatting its stack", async () => {
		const api = await boot();
		const saved = Object.getOwnPropertyDescriptor(Error, "prepareStackTrace");
		let formatted = 0;
		Error.prepareStackTrace = () => {
			formatted++;
			return "formatted";
		};
		try {
			const error = await api.slots.errorData("error");
			const aggregate = await api.slots.errorData("aggregate");
			expect(formatted).toBe(0);
			expect([copies(error), copies(aggregate)]).toEqual([true, true]);
			expect([Error.isError(error.error), aggregate.error.errors[0].message, aggregate.error.cause]).toEqual([true, "a", { code: 1 }]);
		} finally {
			if (saved) Object.defineProperty(Error, "prepareStackTrace", saved);
			else delete Error.prepareStackTrace;
			await api.slothlet.shutdown();
		}
	});

	it("hands out a disguised iterator, alone or beside an error, and an error with another prototype, as the module's", async () => {
		const api = await boot();
		try {
			const outcome = {};
			for (const kind of ["iteratorHoldingError", "errorBesideIterator", "prototypeReplaced"])
				outcome[kind] = copies(await api.slots.errorData(kind));
			expect(outcome).toEqual({ iteratorHoldingError: false, errorBesideIterator: false, prototypeReplaced: false });
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
