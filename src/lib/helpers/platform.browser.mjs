/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/platform.browser.mjs
 *	@Date: 2026-11-27T21:54:49-08:00 (1795845289)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:44-08:00 (1795869044)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `#helpers/platform` under the `browser` condition, and wherever the `node` condition does not apply:
 * the browser stand-ins, or Node's builtins where the page has a Node `process`.
 * @module @cldmv/slothlet/helpers/platform.browser
 * @internal
 *
 * @description
 * No `node:*` specifier, static or dynamic, and no top-level await (#1034). In a browser the Node-only values are
 * `null` and `util` is the minimal shim (see `platform-host.mjs`). A page with a Node `process` (an Electron renderer
 * with Node integration, built for the browser) gets Node's builtins as before, synchronously through
 * `process.getBuiltinModule`.
 */

import { Processes } from "#helpers/intrinsics";
import { hostHasNodeProcess, useNodeBuiltins, useBrowserStandIns } from "./platform-host.mjs";

/**
 * Node's builtin modules through `process.getBuiltinModule`, or null where the host cannot give them.
 * @returns {object|null} What `useNodeBuiltins` takes, or null.
 * @private
 */
function builtinsFromProcess() {
	if (!hostHasNodeProcess() || typeof Processes.getBuiltinModule !== "function") return null;
	const builtin = (id) => Processes.getBuiltinModule(id);
	return {
		fs: builtin("node:fs"),
		fsp: builtin("node:fs/promises"),
		path: builtin("node:path"),
		url: builtin("node:url"),
		util: builtin("node:util"),
		events: builtin("node:events"),
		asyncHooks: builtin("node:async_hooks"),
		module: builtin("node:module"),
		vm: builtin("node:vm"),
		childProcess: builtin("node:child_process")
	};
}

const builtins = builtinsFromProcess();
if (builtins === null) useBrowserStandIns();
else useNodeBuiltins(builtins);

export {
	isNode,
	fs,
	fsp,
	path,
	url,
	util,
	EventEmitter,
	AsyncLocalStorage,
	AsyncResource,
	executionAsyncResource,
	executionAsyncId,
	createHook,
	createRequire,
	vm,
	childProcess,
	loadJson,
	fileParts,
	scheduleMacrotask,
	inheritsFrom
} from "./platform-host.mjs";
