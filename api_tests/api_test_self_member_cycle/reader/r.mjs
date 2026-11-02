/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_member_cycle/reader/r.mjs
 *	@Date: 2026-11-01T17:13:39-08:00 (1793582019)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T18:26:39-08:00 (1793586399)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads the cyclic member another module mounted, through `self` (#688).
 */
import { isDeepStrictEqual } from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check and report its outcome.
 * @param {function(): *} check - The check.
 * @returns {*} What it returned, or the name of what it threw.
 * @example
 * attempt(() => true); // true
 */
function attempt(check) {
	try {
		return check();
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Return `self.things.x`.
 * @returns {object} The node.
 * @example
 * read(); // self.things.x
 */
export function read() {
	return self.things.x;
}

/**
 * Follow `conn.self` around the cycle and compare what each lap hands back.
 * @returns {Record<string, *>} Each comparison's outcome.
 * @example
 * cycle(); // { lap: true, ... }
 */
export function cycle() {
	const conn = self.things.x.conn;
	const expected = { id: 1 };
	expected.self = expected;
	expected.open = expected.shut = { kind: "shared" };
	expected.loop = { back: expected };
	return {
		lap: conn.self.self === conn.self,
		laps: conn.self.self.self.self === conn.self,
		twoStep: conn.self.loop.back === conn.self,
		reread: self.things.x.conn.self === conn.self,
		deepEqual: attempt(() => isDeepStrictEqual(conn.self, expected))
	};
}

/**
 * Write a member of the cyclic value after following the cycle round.
 * @returns {string} `"done"`, or the error code the write was refused with.
 * @example
 * writeLap(); // "LOOSE_SET_NOT_OWNED" for a module that does not own things.x
 */
export function writeLap() {
	return attempt(() => {
		self.things.x.conn.self.self.planted = 1;
		return "done";
	});
}

/**
 * Leave the cyclic value, read round the cycle, on `globalThis`, for host code to write later with no module
 * behind the write.
 * @param {string} key - The global to leave it under.
 * @returns {void}
 * @example
 * stashLap("lap"); // globalThis.lap.later = 1 from host code: RUNTIME_NO_ACTIVE_CONTEXT_SELF without a grant
 */
export function stashLap(key) {
	globalThis[key] = self.things.x.conn.self.self;
}

/**
 * Write the object held at both `conn.open` and `conn.shut`: through `open`, through `shut`, and through `open`
 * again once it has also been read at `shut`. Each path keeps its own view and its own rule.
 * @returns {Record<string, *>} Each write's outcome, and whether both reads handed out the same view.
 * @example
 * writeShared();
 */
export function writeShared() {
	const conn = self.things.x.conn.self;
	const open = conn.open;
	const viaOpen = attempt(() => {
		open.first = 1;
		return "done";
	});
	const shut = conn.shut;
	return {
		same: open === shut,
		viaOpen,
		viaShut: attempt(() => {
			shut.second = 1;
			return "done";
		}),
		viaOpenAfterShut: attempt(() => {
			open.third = 1;
			return "done";
		})
	};
}
