/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/platform.mjs
 *	@Date: 2026-05-30T20:46:07-07:00 (1780199167)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T22:07:04-08:00 (1795846024)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `#helpers/platform` under Node.js: Node's builtin modules, imported statically and handed to
 * `platform-host.mjs`, which every other file of slothlet's reads them through.
 * @module @cldmv/slothlet/helpers/platform
 * @internal
 *
 * @description
 * Static imports, not a top-level `await import()`: nothing in slothlet's graph awaits at its top level, so Node's
 * synchronous `require(esm)` loads a package that imports slothlet (#1034). Imported, not taken with
 * `process.getBuiltinModule`, so a host's loader hooks and a test's module mocks (`vi.mock("child_process")`) apply.
 * A browser build resolves `#helpers/platform` to `platform.browser.mjs` instead (package.json `imports`), so no
 * `node:*` specifier reaches it.
 */

import * as fsModule from "node:fs";
import * as fspModule from "node:fs/promises";
import * as pathModule from "node:path";
import * as urlModule from "node:url";
import * as utilModule from "node:util";
import * as eventsModule from "node:events";
import * as asyncHooksModule from "node:async_hooks";
import * as moduleModule from "node:module";
import * as vmModule from "node:vm";
// Without the `node:` scheme, as the loader has always imported it: a test's `vi.mock("child_process")` applies.
import * as childProcessModule from "child_process";
import { useNodeBuiltins } from "./platform-host.mjs";

// The static imports above loaded, so this host has Node's builtins.
useNodeBuiltins({
	fs: fsModule,
	fsp: fspModule,
	path: pathModule,
	url: urlModule,
	util: utilModule,
	events: eventsModule,
	asyncHooks: asyncHooksModule,
	module: moduleModule,
	vm: vmModule,
	childProcess: childProcessModule
});

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
