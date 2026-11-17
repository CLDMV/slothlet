/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-kept-node-reads.test.vitest.mjs
 *	@Date: 2026-11-16T00:13:19-08:00 (1794816799)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:56-08:00 (1794882596)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a module reaches through references it kept into another module's data is held to the rules,
 * read now or from a timer: its top-level node, a node taken from a descriptor's `value`, a closed node shown by
 * `util.inspect` with its hook off, what a method hands back as its receiver (alone or nested), and an object a member
 * defined at runtime with `Object.defineProperty` holds.
 *
 * @description
 * Fixture `api_test_kept_node_reads`: `secret` holds the data, `reader` keeps the references and reads and writes
 * through them. The rules deny `reader` each `hidden` member. A member it may read answers its value, one it may not
 * is refused, and a write into `secret`'s data is refused (the reader owns none of it), in eager and lazy mode, the
 * async and live runtime, and under both attributions. The defined member is defined by `secret` itself on its own
 * node and by the host, writable or read-only, configurable or not. (A member defined read-only and non-configurable
 * is left out: JavaScript requires the node to hand that value out as it was defined.)
 * @module tests/vitests/suites/permissions/permissions-kept-node-reads
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_kept_node_reads");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

const DENIED = { threw: "PERMISSION_DENIED" };
const NOT_OWNED = { threw: "LOOSE_SET_NOT_OWNED" };

/** What every check answers the reader: the value where the rules let it read, refused otherwise. */
const EXPECTED = {
	topHidden: DENIED,
	topNestedHidden: DENIED,
	topPub: "PUB",
	topNestedPub: 1,
	describedHidden: DENIED,
	describedNestedHidden: DENIED,
	describedPub: 1,
	inspectFrozen: false,
	inspectClosed: false,
	nestedReceiverWrite: NOT_OWNED,
	receiverWrite: NOT_OWNED,
	definedHidden: DENIED,
	definedV: 1,
	definedWrite: NOT_OWNED,
	definedDescribedHidden: DENIED
};

describe.each(matrix)(
	"references a module kept into another module's data > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const build = async (definedKey) => {
			const rules = ["hidden", "data.hidden", "data.cfg.hidden", "box.hidden", "closed.hidden", `holder.${definedKey}.hidden`].map(
				(target) => ({
					caller: "reader.**",
					target: `secret.${target}`,
					effect: "deny"
				})
			);
			api = await slothlet({
				base: join(FIXTURE, "host"),
				mode,
				runtime,
				silent: true,
				permissions: { policy: "allow", caller: { attribution }, rules }
			});
			for (const name of ["secret", "reader"]) await api.slothlet.api.add(name, join(FIXTURE, name), { id: name });
			for (const name of ["secret", "reader"]) await api[name];
			return api;
		};

		const SHAPES = [
			{ shape: "writable, not configurable", writable: true, configurable: false },
			{ shape: "read-only, configurable", writable: false, configurable: true },
			{ shape: "writable and configurable", writable: true, configurable: true }
		];
		const DEFINERS = [
			{ by: "the module itself, on its own node", define: (api, key, attributes) => api.secret.define(key, attributes) },
			{
				by: "the host",
				define: (api, key, { writable, configurable }) =>
					Reflect.defineProperty(api.secret.holder, key, { value: { v: 1, hidden: "H" }, writable, configurable, enumerable: true })
			}
		];

		it.each(DEFINERS.flatMap((definer) => SHAPES.map((shape) => ({ ...definer, ...shape }))))(
			"are held to the rules, now and from a timer; member defined by $by, $shape",
			async ({ define, writable, configurable }) => {
				const key = "late";
				await build(key);
				expect(await define(api, key, { writable, configurable })).toBe(true);
				await api.reader.keep(key);
				expect(await api.reader.now()).toEqual(EXPECTED);
				expect(await api.reader.later()).toEqual(EXPECTED);
				// Nothing the reader tried changed the data; the member is as it was defined.
				expect(api.secret.obj.name).toBe("o");
				expect(api.secret.holder[key].v).toBe(1);
				expect(JSON.stringify(api.secret.holder[key])).toBe(JSON.stringify({ v: 1, hidden: "H" }));
				expect(Object.getOwnPropertyDescriptor(api.secret.holder, key)).toMatchObject({ writable, configurable, enumerable: true });
			}
		);

		it.each(SHAPES)("leaves the module's own defined member its own to change and read: $shape", async ({ writable, configurable }) => {
			await build("late");
			expect(await api.secret.define("late", { writable, configurable })).toBe(true);
			expect(await api.secret.change("late", 5)).toBe(5);
			expect(api.secret.holder.late.hidden).toBe("H");
			// Defining the member again with the value it holds changes nothing, as on a plain object.
			expect(Reflect.defineProperty(api.secret.holder, "late", { value: api.secret.holder.late })).toBe(true);
			expect(api.secret.holder.late.v).toBe(5);
		});
	}
);
