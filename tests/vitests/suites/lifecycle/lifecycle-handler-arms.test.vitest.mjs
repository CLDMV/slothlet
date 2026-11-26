/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/lifecycle-handler-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:20:24-08:00 (1795598424)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:23-08:00 (1795600283)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lifecycle handler arms not reached by the integration suites: `off()` on a run's copy,
 * a synchronous throw inside `emit()` / `emitInternal()`, the debug log's fallbacks for an event without
 * `apiPath` / `moduleID`, and a subscriber whose reader is no module slothlet can run as.
 *
 * @module tests/vitests/suites/lifecycle/lifecycle-handler-arms.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { Lifecycle } from "#handlers/lifecycle";
import { WRITE_TARGET } from "#helpers/flow-stores";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * A minimal slothlet stand-in for the Lifecycle handler.
 * @param {object} [extra] - Fields merged onto the mock.
 * @returns {object} Mock slothlet.
 * @example
 * const mock = makeMock({ config: { debug: { lifecycle: true } } });
 */
function makeMock(extra = {}) {
	return { config: { silent: true, debug: {} }, debug: vi.fn(), SlothletError, SlothletWarning, ...extra };
}

describe("Lifecycle.off() on a copy", () => {
	it("removes the handler from the component the write target names", () => {
		const target = new Lifecycle(makeMock());
		const handler = () => {};
		target.on("impl:created", handler);
		const mock = makeMock();
		const lc = new Lifecycle(mock);
		// The instance chooses another component to write to (a run's copy).
		mock[WRITE_TARGET] = (component) => (component === lc ? target : component);
		lc.off("impl:created", handler);
		expect(target.subscribers.get("impl:created").has(handler)).toBe(false);
	});
});

describe("Lifecycle.emit() / emitInternal() synchronous failures", () => {
	it("emit() hands back a rejected promise when reading the event throws", async () => {
		const lc = new Lifecycle(makeMock());
		const boom = new Error("source getter");
		const data = {
			get source() {
				throw boom;
			}
		};
		await expect(lc.emit("impl:created", data)).rejects.toBe(boom);
	});

	it("emitInternal() hands back a rejected promise when logging the event throws", async () => {
		const lc = new Lifecycle(makeMock({ config: { silent: true, debug: { lifecycle: true } } }));
		const boom = new Error("spread getter");
		const data = {
			get apiPath() {
				throw boom;
			}
		};
		await expect(lc.emitInternal("impl:created", data)).rejects.toBe(boom);
	});
});

describe("Lifecycle debug log fallbacks", () => {
	it("derives apiPath from path and module from module when apiPath / moduleID are absent", async () => {
		const mock = makeMock({ config: { silent: true, debug: { lifecycle: true } } });
		const lc = new Lifecycle(mock);
		await lc.emit("impl:created", { path: ["math", "add"], module: "base" });
		expect(mock.debug).toHaveBeenCalledWith(
			"lifecycle",
			expect.objectContaining({ key: "DEBUG_MODE_LIFECYCLE_EVENT", apiPath: "math.add", moduleID: "base" })
		);
	});

	it("logs no apiPath when the event names neither apiPath nor path", async () => {
		const mock = makeMock({ config: { silent: true, debug: { lifecycle: true } } });
		const lc = new Lifecycle(mock);
		await lc.emit("materialized:complete", { total: 3 });
		const call = mock.debug.mock.calls.find((c) => c[0] === "lifecycle");
		expect(call[1].apiPath).toBeUndefined();
		expect(call[1].moduleID).toBeUndefined();
	});
});

describe("Lifecycle subscriber with a reader slothlet cannot run as", () => {
	it("calls the subscriber directly with the event when the reader is no framework module", async () => {
		const lc = new Lifecycle(makeMock());
		const seen = [];
		const handler = (data) => {
			seen.push(data);
		};
		lc.on("materialized:complete", handler);
		// A reader that is not one of slothlet's own module records.
		lc.subscriberReaders.get("materialized:complete").set(handler, {});
		await lc.emit("materialized:complete", { total: 1 });
		expect(seen).toEqual([{ total: 1 }]);
	});

	it("calls the subscriber directly when the instance has no context manager to run it in", async () => {
		const lc = new Lifecycle(makeMock());
		const seen = [];
		const handler = (data) => {
			seen.push(data);
		};
		lc.on("materialized:complete", handler);
		lc.subscriberReaders.get("materialized:complete").set(handler, { ____slothletInternal: true });
		await lc.emit("materialized:complete", { total: 2 });
		expect(seen).toEqual([{ total: 2 }]);
	});
});
