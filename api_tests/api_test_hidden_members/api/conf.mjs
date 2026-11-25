/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_hidden_members/api/conf.mjs
 *	@Date: 2026-11-25T02:33:27-08:00 (1795602807)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:59:39-08:00 (1795604379)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An object export with non-enumerable own members: data, an object, and a getter, plus an enumerable
 * object that holds a non-enumerable member of its own.
 * @module api_test_hidden_members/conf
 */

const conf = { visible: 1, inner: { deep: 1 } };
Object.defineProperty(conf, "hidden", { value: 2, enumerable: false, writable: true, configurable: true });
Object.defineProperty(conf, "secret", { value: { deep: 3 }, enumerable: false, writable: true, configurable: true });
Object.defineProperty(conf, "computed", {
	get() {
		return conf.visible + 10;
	},
	enumerable: false,
	configurable: true
});
Object.defineProperty(conf.inner, "tucked", { value: 4, enumerable: false, writable: true, configurable: true });

export default conf;
