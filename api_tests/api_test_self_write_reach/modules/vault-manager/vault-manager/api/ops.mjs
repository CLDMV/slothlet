/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api/ops.mjs
 *	@Date: 2026-10-18T20:47:59-07:00 (1792381679)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:34:52-07:00 (1792384492)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `vault-manager` fixture module's code (#625); see `shared/module-code.mjs`.
 */
import * as code from "../../../../shared/module-code.mjs";

/**
 * @param {object} rule - The rule.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addRuleFor({ caller: "guest.**", target: "victim.**:write", effect: "allow" });
 */
export function addRuleFor(rule) {
	return code.addRuleFor(rule);
}

/**
 * @returns {*} What the victim returned, or the error code the call was refused with.
 * @example
 * callVictim(); // 100
 */
export function callVictim() {
	return code.callVictim();
}
