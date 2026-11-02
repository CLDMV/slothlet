/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/shared-values.test.vitest.mjs
 *	@Date: 2026-10-30T12:52:45-07:00 (1793389965)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T23:04:10-07:00 (1793426650)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The record of values made by no module (#597): what it records.
 */

import { describe, it, expect } from "vitest";
import { isSharedExport, recordSharedExports } from "#handlers/shared-values";

describe("Handlers > shared-values (#597)", () => {
	it("records a value and everything it reaches, accessors included, with no getter run", () => {
		const deepest = () => {};
		const third = { deepest };
		const second = { third };
		const value = {
			first: { second },
			get lazy() {
				throw new Error("must not run");
			}
		};
		recordSharedExports(value);
		expect(isSharedExport(value)).toBe(true);
		expect(isSharedExport(value.first)).toBe(true);
		expect(isSharedExport(second)).toBe(true);
		expect(isSharedExport(third)).toBe(true);
		expect(isSharedExport(deepest)).toBe(true);
		expect(isSharedExport(Object.getOwnPropertyDescriptor(value, "lazy").get)).toBe(true);
	});

	it("passes over a Proxy and what refuses to be described", () => {
		const proxied = new Proxy({}, {});
		const refusing = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error("refused");
				}
			}
		);
		const value = { proxied, refusing };
		recordSharedExports(value);
		expect(isSharedExport(value)).toBe(true);
		expect(isSharedExport(proxied)).toBe(false);
		expect(isSharedExport(refusing)).toBe(false);
		expect(isSharedExport(42)).toBe(false);
		expect(isSharedExport(null)).toBe(false);
	});
});
