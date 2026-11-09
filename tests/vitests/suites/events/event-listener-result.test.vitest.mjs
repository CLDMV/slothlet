/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-listener-result.test.vitest.mjs
 *	@Date: 2026-11-08T15:47:43-08:00 (1794181663)
 *	@Author: Shinrai
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:47:46-08:00 (1794185266)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a listener returns is settled as the listener. A listener's result can carry the
 * subscriber's code (a `then` getter, a thenable's `then`, a `catch` method); that code runs as the
 * subscriber, under the subscriber's rules, whether the event is emitted by a module, by the host, or
 * delivered later through a strategy.
 *
 * Rules: everything allowed except `sub.** → vault.**`. So the subscriber's own code is refused the
 * vault, while the emitting module and the host may read it.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, "../../../../api_tests/api_test_listener_results");
const REFUSED = "threw PERMISSION_DENIED";
const PERMISSIONS = { defaultPolicy: "allow", rules: [{ caller: "sub.**", target: "vault.**", effect: "deny" }] };
const SHAPES = ["thenGetter", "thenMethod", "catchMethod", "asyncBody"];
// The value a listener's result settles to is the listener's too: the dispatcher never reads it.
const SETTLED_TO = ["nestedThen", "asyncResolvesThenGetter"];

describe.each(getMatrixConfigs())("Events > a listener's result is settled as the listener > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const compose = () => slothlet({ ...config, base: BASE, permissions: PERMISSIONS });

	it("the subscriber itself is refused the vault and the emitter may read it", async () => {
		api = await compose();
		expect(await api.vault.secret()).toBe("secret");
	});

	it.each(SHAPES)("%s: emitted by a module, the result's code runs as the subscriber", async (shape) => {
		api = await compose();
		await api.sub.listen("evt", shape);
		await api.app.fire("evt");
		expect(await api.sub.drain()).toEqual(shape === "catchMethod" ? [] : [{ tag: shape, value: REFUSED }]);
	});

	it.each(SHAPES)("%s: emitted by the host, the result's code runs as the subscriber", async (shape) => {
		api = await compose();
		await api.sub.listen("evt", shape);
		await api.slothlet.event.emit("evt", { n: 1 });
		expect(await api.sub.drain()).toEqual(shape === "catchMethod" ? [] : [{ tag: shape, value: REFUSED }]);
	});

	it.each(SHAPES)("%s: delivered later through a strategy, the result's code runs as the subscriber", async (shape) => {
		api = await compose();
		const held = [];
		api.slothlet.event.strategy((envelope, listeners) => {
			held.push({ envelope, listeners });
		});
		await api.sub.listen("evt", shape);
		await api.slothlet.event.emit("evt", { n: 1 });
		expect(held).toHaveLength(1);
		const result = await api.slothlet.event.deliver(held[0].envelope, held[0].listeners[0]);
		expect(result.delivered).toBe(true);
		expect(await api.sub.drain()).toEqual(shape === "catchMethod" ? [] : [{ tag: shape, value: REFUSED }]);
	});

	it.each(SETTLED_TO)("%s: the value the result settles to is read only as plain JS reads it, as the subscriber", async (shape) => {
		api = await compose();
		await api.sub.listen("evt", shape);
		await api.app.fire("evt");
		await api.slothlet.event.emit("evt", { n: 1 });
		// An async function resolving to an object reads its `then` once, inside the listener's own promise, as plain
		// JS does; the dispatcher never reads it. A thenable's resolved value is never read at all.
		const expected =
			shape === "asyncResolvesThenGetter"
				? [
						{ tag: shape, value: REFUSED },
						{ tag: shape, value: REFUSED }
					]
				: [];
		expect(await api.sub.drain()).toEqual(expected);
	});

	it("emit still waits for a listener's thenable and async body before it resolves", async () => {
		api = await compose();
		await api.sub.listen("evt", "thenMethod");
		await api.sub.listen("evt", "asyncBody");
		await api.app.fire("evt");
		const tags = (await api.sub.drain()).map((d) => d.tag).sort();
		expect(tags).toEqual(["asyncBody", "thenMethod"]);
	});
});
