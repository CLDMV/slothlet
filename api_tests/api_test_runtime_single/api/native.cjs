/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_runtime_single/api/native.cjs
 *	@Date: 2026-11-12T22:54:52-08:00 (1794552892)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:54:52-08:00 (1794552892)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS api file. Node loads it itself, whatever loader runs slothlet: the runtime it asks for
 * with a dynamic import, and the file it loads with `import()`, are Node's to load as well.
 * @module api_test_runtime_single.native
 */
let self;
// The runtime is an ES module: a CommonJS file reaches it with a dynamic import.
const ready = import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/**
 * Read the vault through the runtime this file imported.
 * @returns {Promise<string>} What the vault holds.
 * @example
 * await api.native.read(); // "SECRET"
 */
async function read() {
	await ready;
	return self.vault.get();
}

/**
 * Read the vault through a file this one loads with `import()`, which imports the runtime itself.
 * @returns {Promise<string>} What the vault holds.
 * @example
 * await api.native.viaFile(); // "SECRET"
 */
async function viaFile() {
	const reader = await import("../helpers/reader.mjs");
	return reader.read();
}

module.exports = { read, viaFile };
