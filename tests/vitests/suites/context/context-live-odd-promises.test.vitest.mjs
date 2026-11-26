/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-odd-promises.test.vitest.mjs
 *	@Date: 2026-11-25T01:48:41-08:00 (1795600121)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:15:00-08:00 (1795601700)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Promises of unusual shapes returned by a module's pinned callback on the live runtime.
 *
 * @description
 * A callback a module hands the platform (here a timer's) runs pinned to the module; a promise it returns is followed
 * until it settles, without reacting to it (#597). Its state is read with the inspector only where that runs no code
 * of anyone's: a promise with an accessor or an object of its own, a Proxy on its prototype chain, a chain that does
 * not end in a realm's `Object.prototype`, a `Symbol.toStringTag` or `constructor` that is an accessor or holds a
 * brace, or a constructor that is a Proxy, has an accessor `name` or `prototype`, a brace in its name or its own
 * `Symbol.hasInstance`, is followed as pending instead. Whatever the shape, the callback runs as it would without
 * slothlet and the call that scheduled it resolves as written.
 *
 * Two instances following one pending promise each drop only their own follow when they shut down.
 * @module tests/vitests/suites/context/context-live-odd-promises
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_live_odd_promises/api");

const KINDS = [
	"plain",
	"pending",
	"subclass",
	"ownAccessor",
	"ownObject",
	"proxyProto",
	"nullEnd",
	"tagAccessor",
	"tagBrace",
	"ctorAccessor",
	"ctorBound",
	"ctorProxy",
	"ctorNameAccessor",
	"ctorNameBrace",
	"ctorHasInstance",
	"ctorPrototypeAccessor"
];

describe("Context > live runtime > promises a pinned callback returns", () => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ base: BASE, runtime: "live", silent: true });
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it.each(KINDS)("runs the callback and resolves the call for a %s promise", async (kind) => {
		expect(await api.odd.viaTimer(kind)).toBe("ran");
	});
});

describe("Context > live runtime > one pending promise followed for two instances", () => {
	it("drops each instance's follow at its shutdown, and the promise still settles for the other", async () => {
		const key = "__slothletSharedPending";
		let resolveShared;
		globalThis[key] = new Promise((resolve) => {
			resolveShared = resolve;
		});
		const first = await slothlet({ base: BASE, runtime: "live", silent: true });
		const second = await slothlet({ base: BASE, runtime: "live", silent: true });
		try {
			expect(await first.odd.shared(key)).toBe("ran");
			expect(await second.odd.shared(key)).toBe("ran");
			await first.shutdown();
			resolveShared("done");
			expect(await globalThis[key]).toBe("done");
		} finally {
			await second.shutdown();
			delete globalThis[key];
		}
	});

	it("drops a follow left pending when its only instance shuts down", async () => {
		const key = "__slothletSoloPending";
		globalThis[key] = new Promise(() => {});
		const only = await slothlet({ base: BASE, runtime: "live", silent: true });
		try {
			expect(await only.odd.shared(key)).toBe("ran");
		} finally {
			await only.shutdown();
			delete globalThis[key];
		}
	});
});
