/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-generator-own-members.test.vitest.mjs
 *	@Date: 2026-11-25T02:34:26-08:00 (1795602866)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T08:40:37-08:00 (1795624837)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A generator object a module hands out keeps its own members and how far it is closed (#965).
 *
 * @description
 * While the permission system is on, a generator object a module hands out reaches the receiver as a stand-in whose
 * steps run as the module. The stand-in held none of the generator object's own members, so `label` read `undefined`,
 * and `Object.isFrozen()` / `isSealed()` / `isExtensible()` answered for the empty stand-in: a sealed or merely closed
 * generator with members read as frozen.
 *
 * Every answer is compared with the same code run on the fixture's module imported as a plain module, in eager and lazy
 * mode, the async and live runtime, under either attribution, for the host and for another module, for a generator and
 * an async generator, open, frozen, sealed and closed to extension.
 *
 * Each member's kind, `writable` and `configurable` are compared as well, open or closed (#965).
 * @module tests/vitests/suites/permissions/crossing-generator-own-members
 */

import { describe as describeBlock, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { describe, exercise, exerciseAsync } from "../../../../api_tests/api_test_generator_own_members/lib/exercise.mjs";

const FIXTURE = resolve("api_tests/api_test_generator_own_members");
const STATES = ["open", "frozen", "sealed", "closed"];

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

let twins = 0;

/**
 * A fresh copy of the fixture's generator module, imported as a plain module.
 * @returns {Promise<object>} Its namespace.
 */
const twin = () => import(`${pathToFileURL(join(FIXTURE, "api", "gen.mjs")).href}?plain-twin-${++twins}`);

describeBlock.each(matrix)("generator object own members > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.().catch(() => {});
		api = null;
	});

	/**
	 * Build an instance with the generator module and the reader mounted as modules of their own.
	 * @returns {Promise<object>} The api.
	 */
	async function build() {
		api = await slothlet({
			base: join(FIXTURE, "api"),
			mode,
			runtime,
			silent: true,
			permissions: { policy: "allow", caller: { attribution } }
		});
		await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { id: "reader" });
		for (const node of [api.gen, api.reader]) await node;
		return api;
	}

	for (const isAsync of [false, true]) {
		const kind = isAsync ? "an async generator" : "a generator";

		it(`hands the host ${kind}'s own members and closed state as plain JS shows them`, async () => {
			const plain = await twin();
			await build();
			for (const state of STATES) {
				const expected = describe(isAsync ? plain.makeAsync(state) : plain.make(state));
				const actual = describe(await (isAsync ? api.gen.makeAsync(state) : api.gen.make(state)));
				expect({ state, ...actual }).toEqual({ state, ...expected });
			}
		});

		it(`hands another module ${kind}'s own members and closed state as plain JS shows them`, async () => {
			const plain = await twin();
			await build();
			for (const state of STATES) {
				const expected = describe(isAsync ? plain.makeAsync(state) : plain.make(state));
				expect({ state, ...(await api.reader.look(state, isAsync)) }).toEqual({ state, ...expected });
			}
		});

		it(`carries writes to ${kind}'s members both ways across its steps, for the host`, async () => {
			const plain = await twin();
			await build();
			for (const state of STATES) {
				const expected = isAsync ? await exerciseAsync(plain.makeAsync(state)) : exercise(plain.make(state));
				const handed = await (isAsync ? api.gen.makeAsync(state) : api.gen.make(state));
				const actual = isAsync ? await exerciseAsync(handed) : exercise(handed);
				expect({ state, actual }).toEqual({ state, actual: expected });
			}
		});

		it(`carries writes to ${kind}'s members both ways across its steps, for another module`, async () => {
			const plain = await twin();
			await build();
			for (const state of STATES) {
				const expected = isAsync ? await exerciseAsync(plain.makeAsync(state)) : exercise(plain.make(state));
				expect({ state, actual: await api.reader.use(state, isAsync) }).toEqual({ state, actual: expected });
			}
		});
	}
});
