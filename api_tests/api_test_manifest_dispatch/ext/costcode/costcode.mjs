/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_manifest_dispatch/ext/costcode/costcode.mjs
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
 * An extension lifecycle leaf that also exports a `manifest` OBJECT whose `activationEvents`
 * is an ARRAY — the shape that reproduced #287: the framework's dispatcher-detection walk read
 * `manifest.activationEvents.__isVersionDispatcher` as the host and was denied by `private.host`.
 */
export const name = "costcode";
export const manifest = {
	id: "costcode",
	required: false,
	activationEvents: ["onStartup"],
	contributes: {}
};
export function activate() {
	return { ok: true };
}
export function deactivate() {}
