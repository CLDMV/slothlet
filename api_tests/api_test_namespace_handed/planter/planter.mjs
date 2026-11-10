/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_namespace_handed/planter/planter.mjs
 *	@Date: 2026-11-08T10:28:19-08:00 (1794162499)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T10:32:17-08:00 (1794162737)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that leaves functions changing the framework's namespace where the host calls them later,
 * outside any call of the module's.
 * @module api_test_namespace_handed/planter
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the error code it was refused with.
 */
function attempt(change) {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Leave on `target`, and on `globalThis`, functions changing the namespace it was handed and the one `self` reads.
 * @param {object} target - An object of the host's.
 * @param {object} ns - The framework namespace, as the host handed it.
 * @returns {void}
 */
export function plant(target, ns) {
	const viaSelf = self.slothlet;
	target.changeHanded = () =>
		attempt(() => {
			ns.plantedHanded = 1;
		});
	target.changeSelf = () =>
		attempt(() => {
			viaSelf.plantedSelf = 1;
		});
	globalThis.__slothletPlantedChange = () =>
		attempt(() => {
			ns.plantedGlobal = 1;
		});
}

/**
 * Change the namespace it was handed from a timer, once the call has returned.
 * @param {object} ns - The framework namespace, as the host handed it.
 * @returns {Promise<string>} The outcome, once the timer ran.
 */
export function changeLater(ns) {
	return new Promise((resolve) => {
		setTimeout(
			() =>
				resolve(
					attempt(() => {
						ns.plantedTimer = 1;
					})
				),
			0
		);
	});
}
