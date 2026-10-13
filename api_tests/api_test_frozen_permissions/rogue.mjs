/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/rogue.mjs
 *	@Date: 2026-10-12T20:59:52-07:00 (1791863992)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-13T05:32:12-07:00 (1791894732)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#609): a module the rules deny `secrets.**`, reading it every way a frozen node could expose it.
 * @module api_test_frozen_permissions.rogue
 */

import { self } from "@cldmv/slothlet/runtime";
import util from "node:util";

/**
 * Run a read, reporting what it gave or the code it threw.
 * @param {Function} read - The read.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
const attempt = (read) => {
	try {
		return { value: read() };
	} catch (error) {
		return { error: error.code ?? error.name };
	}
};

/**
 * Read a property's value through its descriptor, as reflection would.
 * @param {object} object - The object.
 * @param {string} key - The property.
 * @returns {unknown} The value the descriptor gives.
 */
const throughDescriptor = (object, key) => {
	const descriptor = Object.getOwnPropertyDescriptor(object, key);
	if (!descriptor) return undefined;
	return "value" in descriptor ? descriptor.value : descriptor.get?.call(object);
};

/**
 * Every way to read the `secrets` namespace's `key`.
 * @returns {object} The outcome of each read.
 */
export const readSecrets = () => ({
	direct: attempt(() => self.secrets.key),
	descriptor: attempt(() => throughDescriptor(self.secrets, "key")),
	json: attempt(() => JSON.stringify(self.secrets))
});

/**
 * Every way to read an element of an array member handed over by the host.
 * @param {string[]} list - The `secrets.list` member.
 * @returns {object} The outcome of each read.
 */
export const readList = (list) => ({
	direct: attempt(() => list[0]),
	descriptor: attempt(() => throughDescriptor(list, "0")),
	json: attempt(() => JSON.stringify(list))
});

/**
 * Every way to reach an array member's elements through the functions the array holds.
 * @param {string[]} labels - The `secrets.labels` member.
 * @returns {object} The outcome of each call.
 */
export const callLabels = (labels) => ({
	json: attempt(() => JSON.stringify(labels)),
	reveal: attempt(() => labels.reveal()),
	symbol: attempt(() => labels[Symbol.for("slothlet.test.peek")]())
});

/**
 * Serialize the `secrets` namespace.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
export const serializeSecrets = () => attempt(() => JSON.stringify(self.secrets));

/**
 * Serialize the `secrets.pair` member.
 * @returns {object} What the caller gets.
 */
export const serializePair = () => JSON.parse(JSON.stringify(self.secrets.pair));

export const callAliased = (aliased) => ({
	denied: attempt(() => aliased.denied()),
	allowed: attempt(() => aliased.allowed())
});

export const callNested = (inner) => attempt(() => inner.fn());

export const serializeSparse = () => attempt(() => JSON.stringify(self.sparse));

/** @type {Function|null} A function read off `secrets.labels`, kept for a later call. */
let stashedReveal = null;

/** @type {{value?: unknown, error?: string}|null} What the later call gave. */
let stashedOutcome = null;

/**
 * Keep `secrets.labels.reveal`, then call it from a timer slothlet does not patch, where no caller is live.
 * @returns {Promise<string>} "armed" once the timer is set.
 */
export const callRevealLater = async () => {
	stashedReveal = self.secrets.labels.reveal;
	stashedOutcome = null;
	const timers = await import("node:timers");
	timers.setTimeout(() => {
		stashedOutcome = attempt(() => stashedReveal());
	}, 5);
	return "armed";
};

/**
 * What the later call of `secrets.labels.reveal` gave.
 * @returns {{value?: unknown, error?: string}|null} The outcome, or null before the timer fired.
 */
export const readRevealLater = () => stashedOutcome;

/**
 * Read a leaf of an object the array member `secrets.labels` holds under a key of its own.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
export const readLabelsMeta = () => attempt(() => self.secrets.labels.meta.note);

/**
 * Call the function `secrets.tagged` holds under a symbol key.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
export const callTagged = () => attempt(() => self.secrets.tagged[Symbol.for("slothlet.test.peek")]());

export const serializeInherited = () => attempt(() => JSON.stringify(self.inherited));

export const serializeVirtual = () => attempt(() => JSON.stringify(self.virtual));

/**
 * Serialize the `stateful` namespace.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
export const serializeStateful = () => attempt(() => JSON.stringify(self.stateful));

const tool = Symbol.for("slothlet.test.tool");
const stashed = {};
const outcomes = {};

// Take a reference to a member, then call it from a boundary slothlet does not patch (`node:timers`'s ESM
// exports are a snapshot taken at first link), so the call has no live caller of its own.
export const stashTool = (holder, kind) => {
	stashed[kind] = kind === "symbol" ? holder[tool] : holder.run;
	return "stashed";
};
export const callStashedLater = async (kind) => {
	const timers = await import("node:timers");
	timers.setTimeout(async () => {
		try {
			outcomes[kind] = { ok: true, value: await stashed[kind]() };
		} catch (error) {
			outcomes[kind] = { ok: false, code: error.code ?? String(error.message).slice(0, 40) };
		}
	}, 5);
	return "armed";
};
export const readOutcome = (kind) => outcomes[kind] ?? null;

export const readObjectElement = (items) => attempt(() => throughDescriptor(items, "0").secret);

export const callInherited = (lst) => attempt(() => lst.reveal());

export const callInspectHook = (list) =>
	attempt(() => {
		const hook = Object.getOwnPropertyDescriptor(list, Symbol.for("nodejs.util.inspect.custom"));
		return hook ? hook.value(0, {}, (value) => value) : "none";
	});

/**
 * Inspect the `secrets.pair` member, as a debugger or a log line would.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
export const inspectPair = () => attempt(() => util.inspect(self.secrets.pair, { depth: 4 }));

export const callElementGetter = (list) => attempt(() => Object.getOwnPropertyDescriptor(list, "0").get());

export const popIt = (list) => attempt(() => list.pop());

// Take the function a descriptor hands out (the accessor's getter, or the inspect hook), then call it from a boundary
// slothlet does not patch, so the call has no live caller of its own.
const held = {};
const heldOutcomes = {};
export const stashDescriptorFunction = (list, kind) => {
	const key = kind === "hook" ? Symbol.for("nodejs.util.inspect.custom") : "0";
	const descriptor = Object.getOwnPropertyDescriptor(list, key);
	held[kind] = kind === "hook" ? descriptor?.value : descriptor?.get;
	return held[kind] ? "stashed" : "hidden";
};
export const callHeldLater = async (kind) => {
	const timers = await import("node:timers");
	timers.setTimeout(() => {
		try {
			heldOutcomes[kind] = { ok: true, value: JSON.stringify(held[kind](0, {}, (value) => value)) };
		} catch (error) {
			heldOutcomes[kind] = { ok: false, code: error.code ?? String(error.message).slice(0, 40) };
		}
	}, 5);
	return "armed";
};
export const readHeldOutcome = (kind) => heldOutcomes[kind] ?? null;
