/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_manifest_dispatch/v2/costcode/costcode.mjs
 *	@Date: 2026-08-18 00:00:00 -07:00 (1787036400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-18 00:00:00 -07:00 (1787036400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * v2 of the extension — the manifest's `activationEvents` ARRAY carries DIFFERENT data than v1
 * (`ext/costcode`). Version-dispatching this data field is a legitimate use: a data point may hold
 * different data in one version than another (#287). Both versions must compose under permissions.
 */
export const name = "costcode";
export const manifest = {
	id: "costcode",
	required: false,
	activationEvents: ["onStartup", "onResume"],
	contributes: {}
};
export function activate() {
	return { ok: true, v: 2 };
}
export function deactivate() {}
