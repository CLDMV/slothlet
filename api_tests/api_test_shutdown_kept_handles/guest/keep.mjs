/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_shutdown_kept_handles/guest/keep.mjs
 *	@Date: 2026-11-21T22:02:45-08:00 (1795327365)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:50-08:00 (1795868990)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a module that keeps the framework's namespace it read through `self`, a class node and that
 * class's prototype in variables, and uses them later: from its own call, from a function it hands out, and from a
 * timer it leaves behind.
 * @module api_test_shutdown_kept_handles.keep
 */
import { self } from "@cldmv/slothlet/runtime";

/** What the module kept: the `slothlet` namespace, the class node, and the class's prototype. */
let kept = null;

/**
 * What one attempt gave: its value as a string, or `!` and the code of what it threw. A promise is reported as
 * `promise`, and what it rejects with is dropped.
 * @param {Function} fn - The attempt.
 * @returns {string} The outcome.
 */
function one(fn) {
	try {
		const value = fn();
		if (value !== null && typeof value === "object" && typeof value.then === "function") {
			value.then(
				() => {},
				() => {}
			);
			return "promise";
		}
		return String(value);
	} catch (error) {
		return `!${error?.code ?? error?.name ?? String(error)}`;
	}
}

/**
 * Every read through what was kept.
 * @returns {Object<string, string>} The outcomes by access.
 */
function reads() {
	const { s, Thing, proto } = kept;
	return {
		nsContextGet: one(() => typeof s.context.get),
		nsMetadata: one(() => typeof s.metadata),
		nsApiAdd: one(() => typeof s.api.add),
		nsReload: one(() => typeof s.reload),
		nsListKeys: one(() => Object.keys(s).includes("api")),
		nsHasApi: one(() => "api" in s),
		nsDescribeApi: one(() => typeof Object.getOwnPropertyDescriptor(s, "api")?.value),
		protoRead: one(() => typeof proto.read),
		protoCall: one(() => proto.read.call({ v: "y" })),
		protoListKeys: one(() => Reflect.ownKeys(proto).sort().join(",")),
		protoHas: one(() => "read" in proto),
		protoDescribe: one(() => typeof Object.getOwnPropertyDescriptor(proto, "read")?.value),
		protoPrototype: one(() => Object.getPrototypeOf(proto) === Object.prototype),
		protoConstructor: one(() => typeof proto.constructor),
		constructKept: one(() => new Thing("z").read()),
		constructFromProto: one(() => new proto.constructor("w").read())
	};
}

/**
 * Every call through what was kept that changes the instance: adding a folder, reloading, reading the context.
 * @returns {Object<string, string>} The outcomes by access.
 */
function calls() {
	const { s, extra } = kept;
	return {
		nsContextGetCall: one(() => s.context.get()),
		nsApiAddCall: one(() => s.api.add("extra", extra)),
		nsReloadCall: one(() => s.reload())
	};
}

/**
 * Keep what was read, hand out functions that use it, and leave a timer behind that uses it once the go-ahead is given.
 * @param {string} extra - The folder a kept namespace is asked to add later.
 * @returns {Object<string, string>} The outcomes of reading through what was kept now, from this call.
 */
export function hold(extra) {
	kept = { s: self.slothlet, Thing: self.vault.Thing, proto: self.vault.Thing.prototype, extra };
	const record = (globalThis.__slothletShutdownKeptHandles = { reads, calls, proto: kept.proto, timer: [] });
	const gate = globalThis.__slothletShutdownKeptHandlesGate;
	const step = () => {
		if (gate.stop) return;
		if (gate.go) record.timer.push({ ...reads(), ...calls() });
		else setTimeout(step, 1);
	};
	setTimeout(step, 1);
	return reads();
}
