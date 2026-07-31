/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/data-reader.mjs
 *	@Date: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self, context } from "@cldmv/slothlet/runtime";

// Writes a context key from inside this module (apiPath `callers.dataReader`). Used to exercise
// owner-locked / protected context keys: the runtime `context` set-trap resolves the writer identity
// from the executing module, so a write here is attributed to `callers.dataReader`.
export const writeContext = (key, value) => {
	context[key] = value;
	return context[key];
};

// Nested writes/reads through the runtime `context` proxy, attributed to `callers.dataReader`.
// Exercise deep protection of owner-locked keys: a write to a *nested* field of a protected/owned
// key must be enforced the same as a top-level write.
export const writeNestedContext = (key, subkey, value) => {
	context[key][subkey] = value;
	return context[key][subkey];
};
export const readNestedContext = (key, subkey) => context[key][subkey];
export const deleteNestedContext = (key, subkey) => {
	delete context[key][subkey];
	return context[key][subkey];
};
export const defineNestedContext = (key, subkey, value) => {
	Object.defineProperty(context[key], subkey, { value, writable: true, enumerable: true, configurable: true });
	return context[key][subkey];
};
// Returns the context value itself (for an owner-locked key: the protected VIEW) so tests can hand
// it to a different writer — the view must enforce whoever writes it at write time, not this module.
export const getContextValue = (key) => context[key];

// Cross-file reads of terminal data values exported by db/secrets.mjs.
// Each read is a property access, not a call — gated only when permissions.readGating is on.
export const readToken = () => self.db.secrets.token;
export const readBytes = () => self.db.secrets.bytes;

// Reads a value by export name — used to sweep every terminal-value type.
export const readByName = (name) => self.db.secrets[name];

// Reads and calls made after yielding to the microtask/timer queue. Caller identity has to
// survive the await: an absent caller reads as host-initiated and is exempt, so losing it here
// would let any module past its deny rules simply by awaiting something first. Awaiting is
// mandatory for lazy access, so this is the ordinary shape of module code, not a corner case.
export const readTokenAfterAwait = async () => {
	await null;
	return self.db.secrets.token;
};
export const readTokenAfterTimer = async () => {
	await new Promise((resolve) => setTimeout(resolve, 1));
	return self.db.secrets.token;
};
export const insertAfterAwait = async () => {
	await null;
	return self.db.write.insert({ x: 1 });
};

// Enumeration / serialization of a namespace or object holding values this module cannot
// read directly. These must not disclose denied leaves — neither their values nor their
// existence — while leaving permitted leaves visible.
export const keysOfSecrets = async () => Object.keys(await self.db.secrets);
export const stringifySecrets = async () => JSON.stringify(await self.db.secrets);
export const keysOfConfig = async () => Object.keys(await self.db.secrets.config);
export const stringifyConfig = async () => JSON.stringify(await self.db.secrets.config);
export const entriesOfConfig = async () => Object.entries(await self.db.secrets.config);
export const spreadConfig = async () => ({ ...(await self.db.secrets.config) });

// Registers an EventEmitter listener from inside this module, then lets the registering call
// SETTLE before the event fires. That ordering matters: if the call were still in flight, the
// runtime would still be holding this module's identity and the listener would be attributed
// correctly for that reason alone — proving nothing about the listener itself. With the call
// finished, the only thing that can attribute the listener is what was captured when it was
// registered. The listener reads a gated value, so the outcome reveals whose authority it ran
// with: this module's (refused by the rules) or the host's (exempt).
let eventOutcome = null;
export const armEventListener = async () => {
	const { EventEmitter } = await import("node:events");
	const emitter = new EventEmitter();
	// Async, and awaits the read: under lazy composition a terminal value resolves through a waiting
	// proxy, so reading it synchronously would capture the proxy rather than the value (or the
	// denial) and say nothing about attribution.
	//
	// The outcome is left on a module variable rather than handed back as a promise. Handing back a
	// promise would mean the test awaits a *second* call into this module, keeping that one in flight
	// while the event fires — the runtime would then still be holding this module's identity and the
	// listener would be attributed correctly for that reason alone.
	emitter.on("go", async () => {
		try {
			eventOutcome = { ok: true, value: String(await self.db.secrets.token) };
		} catch (err) {
			eventOutcome = { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
		}
	});
	setTimeout(() => emitter.emit("go"), 5);
	return "armed";
};

// Synchronous read, polled by the test between events. Being synchronous matters: the call cannot
// suspend, so a timer-driven listener can never fire while it is on the stack.
export const readEventOutcome = () => eventOutcome;

// Fire-and-forget across a timer: the scheduling call returns immediately, so by the time the
// callback runs there is nothing in flight to lend it an identity. A leaf's deferred work should
// carry the leaf's own authority — running as nobody means running as the host, which is more than
// the leaf has. Each records its outcome on a module variable and is read back synchronously, so a
// timer can never fire while the reader is on the stack.
let timerOutcome = null;
let microtaskOutcome = null;
export const armTimerRead = () => {
	setTimeout(async () => {
		try {
			timerOutcome = { ok: true, value: String(await self.db.secrets.token) };
		} catch (err) {
			timerOutcome = { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
		}
	}, 5);
	return "armed";
};
export const readTimerOutcome = () => timerOutcome;

export const armMicrotaskRead = () => {
	queueMicrotask(async () => {
		try {
			microtaskOutcome = { ok: true, value: String(await self.db.secrets.token) };
		} catch (err) {
			microtaskOutcome = { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
		}
	});
	return "armed";
};
export const readMicrotaskOutcome = () => microtaskOutcome;

// DOM-style events, the boundary a browser actually uses. The target is parked on a global so the
// TEST dispatches it, not this module: a module-initiated dispatch would run the listener inside the
// dispatching call and attribute it correctly for that reason alone. Handing the target back through
// the api would have the same problem, and would read it through the wrapper besides.
//
// The listener removes itself once it has fired, both to keep a stale registration from firing into a
// later test and to exercise removal symmetry — a wrapped listener still has to come off by its
// original reference.
let domOutcome = null;
let domFireCount = 0;
export const armDomListener = () => {
	domOutcome = null;
	domFireCount = 0;
	const target = (globalThis.__slothletProbeTarget = new EventTarget());
	const handler = async () => {
		domFireCount++;
		target.removeEventListener("go", handler);
		try {
			domOutcome = { ok: true, value: String(await self.db.secrets.token) };
		} catch (err) {
			domOutcome = { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
		}
	};
	target.addEventListener("go", handler);
	return "armed";
};
export const readDomOutcome = () => domOutcome;

// How many times the listener ran. The test dispatches twice; a second run means the self-removal
// above did not take, i.e. a wrapped listener no longer comes off by its original reference.
export const readDomFireCount = () => domFireCount;

// Calls into a subtree mounted with `api.slothlet.api.add()` whose folder repeats the mount's
// own last segment, so smart-flattening collapses that level away. The callable path is the
// flattened one, and a permission rule has to be able to name it.
export const callMountedConfig = async () => await self.config.getNestedConfig();

// Reads the same data value twice — exercises the cached-property read path.
export const readTokenTwice = () => {
	void self.db.secrets.token;
	return self.db.secrets.token;
};

// Captures a NAMESPACE rather than a leaf, then reads through it after the call that took it has
// returned. The captured identity has to travel down the path, not just attach to the leaf that was
// read — otherwise capturing one level up is a way around it.
let heldNamespace = null;
export const captureSecretsNamespace = () => {
	heldNamespace = self.db.secrets;
	return "held";
};
export const readTokenViaHeldNamespace = async () => {
	try {
		return { ok: true, value: String(await heldNamespace.token) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};
export const readConfigViaHeldNamespace = async () => {
	try {
		return { ok: true, keys: Object.keys(await heldNamespace.config) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};

// A denied leaf must be undescribable as well as unlistable: `Object.keys()` and
// `getOwnPropertyDescriptor()` disagreeing is the same trap-by-trap inconsistency read gating exists
// to close.
export const describeSecret = async (name) => {
	const ns = await self.db.secrets;
	const desc = Object.getOwnPropertyDescriptor(ns, name);
	return desc === undefined ? "undescribable" : "described";
};

// Holds a namespace one level higher, so the read taken from it yields another namespace rather than
// a value. The captured identity has to survive that hop too, or holding the root would shed it.
let heldRoot = null;
export const captureDbRoot = () => {
	heldRoot = self.db;
	return "held-root";
};
export const readThroughHeldRoot = async () => {
	try {
		const secrets = await heldRoot.secrets;
		return { ok: true, value: String(await secrets.token) };
	} catch (err) {
		return { ok: false, code: err.code ?? String(err.message).slice(0, 40) };
	}
};

// `new self.x.Y()` makes the wrapper its own newTarget; `Reflect.construct` with an explicit third
// argument does not. Both have to construct the same instance — the wrapper only substitutes itself
// when it IS the newTarget.
export const constructWithExplicitTarget = async () => {
	class Derived {}
	const Widget = await self.widgets.Widget;
	const instance = Reflect.construct(Widget, ["explicit"], Derived);
	return { built: instance?.label ?? null, proto: Object.getPrototypeOf(instance) === Derived.prototype };
};

// Reads a child NAMESPACE (not a value) off a captured parent, with nothing denied — so the read
// completes instead of throwing, and the captured identity has to be carried onto the namespace it
// hands back rather than only onto terminal values.
export const walkHeldRootAllowed = async () => {
	const secrets = await heldRoot.secrets;
	const cfg = await secrets.config;
	return { kind: typeof cfg, keys: cfg ? Object.keys(cfg).length : -1 };
};

// Hands the captured namespace itself back to the caller. The host then does its reads with no module
// executing and no call context active — the one situation where the inner wrapper cannot attach an
// identity of its own and the view has to re-assert the lender's.
export const lendSecretsNamespace = () => self.db.secrets;
