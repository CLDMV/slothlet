/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/context-own-bindings-second-take.test.vitest.mjs
 *	@Date: 2026-11-25T01:25:30-08:00 (1795598730)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:27-08:00 (1795869087)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The context helpers hand their internal bindings to each listed file of slothlet's once.
 *
 * @description
 * Each boundary helper and context manager gives its internal bindings (enable/disable, the pinner setter) to the
 * files of slothlet's own that use them, once each, as they load. A second request under a listed file's name is
 * granted only to that file's own top level evaluated again by a module loader; any other caller asking again is
 * refused with `MODULE_INTERNAL_NOT_IMPORTABLE`. A name that is not listed is refused outright.
 *
 * No instance is created in this file: the first request below may be the one that takes the bindings.
 * @module tests/vitests/suites/context/context-own-bindings-second-take
 */

import { describe, it, expect } from "vitest";
import { internals as callerPinning } from "#helpers/caller-pinning";
import { internals as asyncResource } from "#helpers/async-resource-context";
import { internals as eventEmitter } from "#helpers/eventemitter-context";
import { internals as nodeCallback } from "#helpers/node-callback-context";
import { internals as scheduler } from "#helpers/scheduler-context";
import { internals as eventTargetProperty } from "#helpers/eventtarget-property-context";
import { internals as cloneContext } from "#helpers/clone-context";
import { internals as eventTarget } from "#helpers/eventtarget-context";
import { internals as observer } from "#helpers/observer-context";
import { internals as promise } from "#helpers/promise-context";
import { internals as contextLive } from "#handlers/context-live";
import { internals as contextAsync } from "#handlers/context-async";

const CASES = [
	["caller-pinning", callerPinning, "lib/handlers/context-live"],
	["async-resource-context", asyncResource, "slothlet"],
	["eventemitter-context", eventEmitter, "lib/handlers/context-live"],
	["node-callback-context", nodeCallback, "slothlet"],
	["scheduler-context", scheduler, "slothlet"],
	["eventtarget-property-context", eventTargetProperty, "slothlet"],
	["clone-context", cloneContext, "slothlet"],
	["eventtarget-context", eventTarget, "slothlet"],
	["observer-context", observer, "slothlet"],
	["promise-context", promise, "slothlet"],
	["context-live", contextLive, "lib/factories/context"],
	["context-async", contextAsync, "lib/factories/context"]
];

describe("Context > own bindings > a second request", () => {
	for (const [name, internals, consumer] of CASES) {
		it(`${name}: refuses a second request under ${consumer} from code that is not that file's top level`, () => {
			// The first request takes them when nothing has yet; either way they are taken after it.
			try {
				expect(typeof internals(consumer)).toBe("object");
			} catch (error) {
				expect(error.code).toBe("MODULE_INTERNAL_NOT_IMPORTABLE");
			}
			let refused = null;
			try {
				internals(consumer);
			} catch (error) {
				refused = error;
			}
			expect(refused?.code).toBe("MODULE_INTERNAL_NOT_IMPORTABLE");
		});

		it(`${name}: refuses a name it does not list`, () => {
			let refused = null;
			try {
				internals("lib/not-a-consumer");
			} catch (error) {
				refused = error;
			}
			expect(refused?.code).toBe("MODULE_INTERNAL_NOT_IMPORTABLE");
		});
	}
});
