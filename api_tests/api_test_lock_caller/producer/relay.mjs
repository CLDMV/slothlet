/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lock_caller/producer/relay.mjs
 *	@Date: 2026-05-18T09:38:51-07:00 (1779122331)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 09:38:51 -07:00 (1779122331)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Producer module (module "A") for the lockCaller/bind repro.
 *
 * @description
 * Invokes a supplied callback while the producer module is the active caller,
 * mimicking the real bug: a callback stored in a plain array (a Fastify `addHook`
 * handler, a third-party event registry) runs with whatever async context happens
 * to be ambient — here, the producer module's — instead of the module that
 * registered it.
 *
 * @module api_tests/api_test_lock_caller/producer/relay
 */

import { EventEmitter } from "node:events";

const bus = new EventEmitter();
let listenerResult;
let ready = false;

/**
 * Register the emitter listener while the producer module is the active caller.
 * The listener is stored on a plain EventEmitter, so callbacks it invokes inherit
 * the producer module's ambient async context.
 * @returns {void}
 * @public
 * @example
 * api.producer.relay.setup();
 */
export function setup() {
	if (ready) return;
	bus.on("dispatch", (box) => {
		listenerResult = box.callback.apply(box.thisArg ?? undefined, box.args ?? []);
	});
	ready = true;
}

/**
 * Realistic repro: fire the emitter listener so the callback runs inside the
 * producer module's restored async context.
 * @param {Function} callback - Callback to invoke.
 * @param {*} [thisArg] - `this` binding for the callback.
 * @param {Array} [args] - Arguments forwarded to the callback.
 * @returns {*} The callback's return value.
 * @public
 * @example
 * api.producer.relay.viaEmitter(handler);
 */
export function viaEmitter(callback, thisArg, args = []) {
	bus.emit("dispatch", { callback, thisArg, args });
	return listenerResult;
}

/**
 * Direct repro: invoke the callback as a nested call inside producer code, so the
 * ambient caller identity is the producer module.
 * @param {Function} callback - Callback to invoke.
 * @param {*} [thisArg] - `this` binding for the callback.
 * @param {Array} [args] - Arguments forwarded to the callback.
 * @returns {*} The callback's return value.
 * @public
 * @example
 * api.producer.relay.viaDirect(handler);
 */
export function viaDirect(callback, thisArg, args = []) {
	return callback.apply(thisArg ?? undefined, args ?? []);
}
