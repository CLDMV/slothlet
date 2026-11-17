/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_kept_node_reads/reader/reader.mjs
 *	@Date: 2026-11-16T00:13:19-08:00 (1794816799)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:24:47-08:00 (1794882287)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Keeps references into another module's data and reads and writes through them, now and from a timer.
 * @module api_test_kept_node_reads/reader
 */

import { self } from "@cldmv/slothlet/runtime";
import { inspect } from "node:util";

/**
 * Run a check, answering what it returned, or the code of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

const kept = {};

/**
 * Whether `util.inspect` with the node's own hook turned off shows the value `"H"`.
 * @param {object} node - The node.
 * @returns {boolean} Whether it does.
 */
const shows = (node) => inspect(node, { customInspect: false, showProxy: false }).includes("'H'");

/** @type {Record<string, function(): *>} Each check, made on what {@link keep} kept. */
const CHECKS = {
	topHidden: () => kept.top.hidden,
	topNestedHidden: () => kept.top.data.hidden,
	topPub: () => kept.top.pub,
	topNestedPub: () => kept.top.data.pub,
	describedHidden: () => kept.described.hidden,
	describedNestedHidden: () => kept.describedNested.hidden,
	describedPub: () => kept.described.pub,
	inspectFrozen: () => shows(kept.box),
	inspectClosed: () => shows(kept.closed),
	nestedReceiverWrite: () => {
		kept.nestedReceiver.me.name = "changed";
		return "wrote";
	},
	receiverWrite: () => {
		kept.receiver.name = "changed";
		return "wrote";
	},
	definedHidden: () => kept.defined.hidden,
	definedV: () => kept.defined.v,
	definedWrite: () => {
		kept.defined.v = 2;
		return "wrote";
	},
	definedDescribedHidden: () => Object.getOwnPropertyDescriptor(kept.holder, kept.definedKey).value.hidden
};

/**
 * Keep references into the other module's data: its top-level node, nodes taken from descriptors, closed nodes, what
 * its methods hand back, and the member defined at `definedKey`.
 * @param {string} definedKey - The name of a member defined on `secret.holder` at runtime.
 * @returns {boolean} `true`.
 */
export function keep(definedKey) {
	kept.top = self.secret;
	kept.described = Object.getOwnPropertyDescriptor(self.secret, "data").value;
	kept.describedNested = Object.getOwnPropertyDescriptor(self.secret.data, "cfg").value;
	kept.box = self.secret.box;
	kept.closed = self.secret.closed;
	kept.nestedReceiver = self.secret.obj.whoami();
	kept.receiver = self.secret.obj.itself();
	kept.holder = self.secret.holder;
	kept.definedKey = definedKey;
	kept.defined = self.secret.holder[definedKey];
	return true;
}

/**
 * Each check's answer, now.
 * @returns {Record<string, *>} The answers.
 */
export function now() {
	const out = {};
	for (const [name, check] of Object.entries(CHECKS)) out[name] = answer(check);
	return out;
}

/**
 * Each check's answer, made from a timer.
 * @returns {Promise<Record<string, *>>} The answers.
 */
export function later() {
	return new Promise((done) =>
		setTimeout(() => {
			const out = {};
			for (const [name, check] of Object.entries(CHECKS)) out[name] = answer(check);
			done(out);
		}, 0)
	);
}
