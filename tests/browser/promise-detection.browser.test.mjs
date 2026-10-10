/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/promise-detection.browser.test.mjs
 *	@Date: 2026-08-04T12:00:00-07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:54-07:00 (1791090894)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */
/**
 * @fileoverview The browser util shim's promise detection: a native promise of any realm, nothing else.
 *
 * @description
 * The live runtime holds a host callback's attribution until a returned native promise settles (#601),
 * including one from another realm (an iframe), whose `instanceof Promise` is false. In a browser the
 * shim stands in for Node's brand check with the built-in tag, read in the browser host here: a
 * same-realm and an iframe promise detect, a plain object does not, and an object whose own
 * `Symbol.toStringTag` getter throws answers false rather than throwing.
 */

import { describe, it, expect } from "vitest";
import { util } from "@cldmv/slothlet/helpers/platform";

describe("browser platform shim > util.types.isPromise", () => {
	it("detects a native promise of this realm and of an iframe's", () => {
		expect(util.types.isPromise(Promise.resolve(1))).toBe(true);
		const frame = document.createElement("iframe");
		document.body.appendChild(frame);
		try {
			const foreign = frame.contentWindow.Promise.resolve(1);
			expect(foreign instanceof Promise).toBe(false);
			expect(util.types.isPromise(foreign)).toBe(true);
		} finally {
			frame.remove();
		}
	});

	it("answers false for anything else, including an object whose tag getter throws", () => {
		expect(util.types.isPromise({ then() {} })).toBe(false);
		expect(util.types.isPromise(null)).toBe(false);
		expect(util.types.isPromise(42)).toBe(false);
		const hostile = {
			get [Symbol.toStringTag]() {
				throw new Error("tag read");
			}
		};
		expect(util.types.isPromise(hostile)).toBe(false);
	});
});
