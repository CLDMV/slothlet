/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/event-rule-condition-context.test.vitest.mjs
 *	@Date: 2026-09-28T17:05:22-07:00 (1790640322)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:13-07:00 (1791090913)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;

describe("event-rule conditions receive the user context (#511)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("an object condition deep-matches the context.run() context in event.resolveLevel", async () => {
		api = await slothlet({
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: {
					default: "notify",
					rules: [{ caller: "remote.renderer", event: "cond.*", effect: "allow", condition: { tenant: "tenant-a" } }]
				}
			}
		});
		const inScope = await api.slothlet.context.run({ tenant: "tenant-a" }, () =>
			api.slothlet.event.resolveLevel("remote.renderer", "cond.data")
		);
		expect(inScope).toBe("allow");
		const otherTenant = await api.slothlet.context.run({ tenant: "tenant-b" }, () =>
			api.slothlet.event.resolveLevel("remote.renderer", "cond.data")
		);
		expect(otherTenant).toBe("notify");
		expect(api.slothlet.event.resolveLevel("remote.renderer", "cond.data")).toBe("notify");
	});

	it("a function condition reads ctx.actor directly, exactly as the same condition on a call rule does", async () => {
		const condition = (ctx) => ctx?.actor?.id === "u1";
		api = await slothlet({
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "remote.renderer", target: "probe.**", effect: "allow", condition }],
				events: {
					default: "notify",
					rules: [{ caller: "remote.renderer", event: "cond.*", effect: "allow", condition }]
				}
			}
		});
		const asU1 = await api.slothlet.context.run({ actor: { id: "u1" } }, () => ({
			event: api.slothlet.event.resolveLevel("remote.renderer", "cond.data"),
			call: api.slothlet.permissions.global.checkAccess("remote.renderer", "probe.anything")
		}));
		expect(asU1).toEqual({ event: "allow", call: true });
		const asU2 = await api.slothlet.context.run({ actor: { id: "u2" } }, () => ({
			event: api.slothlet.event.resolveLevel("remote.renderer", "cond.data"),
			call: api.slothlet.permissions.global.checkAccess("remote.renderer", "probe.anything")
		}));
		expect(asU2).toEqual({ event: "notify", call: false });
	});

	it("the per-emit re-resolution of a subscriber sees the emitter's context.run() context", async () => {
		api = await slothlet({
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: {
					default: "notify",
					rules: [{ caller: "subscriber.**", event: "cond.*", effect: "allow", condition: { tenant: "tenant-a" } }]
				}
			}
		});
		// Subscribed outside any context: the conditional rule does not match, so the grant is the default.
		expect(await api.subscriber.subscribe("cond.data")).toBe("notify");
		api.subscriber.drain();

		// Emitted inside the matching context: the level is re-resolved per emit (the pool is conditional),
		// the condition sees `{ tenant: "tenant-a" }`, and the payload is delivered.
		await api.slothlet.context.run({ tenant: "tenant-a" }, () => api.slothlet.event.emit("cond.data", { n: 1 }));
		// Emitted inside a non-matching context: trigger-only.
		await api.slothlet.context.run({ tenant: "tenant-b" }, () => api.slothlet.event.emit("cond.data", { n: 2 }));

		const deliveries = await api.subscriber.drain();
		expect(deliveries).toHaveLength(2);
		expect(deliveries[0].payload).toEqual({ n: 1 });
		expect(deliveries[1].payload).not.toEqual({ n: 2 });
	});
});
