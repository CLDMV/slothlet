/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/replace-builtins.mjs
 *	@Date: 2026-11-06T17:32:11-08:00 (1794015131)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T17:39:42-08:00 (1794015582)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Replaces the Node built-ins slothlet's attribution reads (#714), the way any code running after slothlet
 * loaded could: `process.getBuiltinModule`, the `fs` and `crypto` functions on Node's own module objects,
 * `TextDecoder`, `URLSearchParams`, `Map.prototype.forEach` and `Set.prototype.forEach`. Each replacement reports the
 * given source as the content of the given file, or answers with that source's hash, so code compiled under the file's
 * name from that source would hash as the file's own if slothlet read through them. Everything else is passed through
 * to the original.
 * @module api_test_host_owner_code.replace-builtins
 */
import fs from "node:fs";
import crypto from "node:crypto";

/**
 * Install the replacements.
 * @param {{file: string, source: string}} target - The file whose content is reported as `source`.
 * @returns {void}
 */
export function replaceBuiltins({ file, source }) {
	const original = {
		readFileSync: fs.readFileSync,
		statSync: fs.statSync,
		createHash: crypto.createHash,
		getBuiltinModule: process.getBuiltinModule,
		TextDecoder: globalThis.TextDecoder,
		URLSearchParams: globalThis.URLSearchParams,
		mapForEach: Map.prototype.forEach,
		setForEach: Set.prototype.forEach
	};
	const sourceHash = original.createHash("sha256").update(source).digest("hex");
	const fileText = original.readFileSync.call(fs, file, "utf8");
	const isFile = (path) => String(path) === file;
	let reads = 0;

	fs.readFileSync = function (path, ...rest) {
		if (!isFile(path)) return original.readFileSync.call(this, path, ...rest);
		return typeof rest[0] === "string" || rest[0]?.encoding ? source : Buffer.from(source);
	};
	// A new modification time on every look, so a reader that caches by it reads the file again.
	fs.statSync = function (path, ...rest) {
		const stats = original.statSync.call(this, path, ...rest);
		if (isFile(path)) stats.mtimeMs += ++reads;
		return stats;
	};
	crypto.createHash = function (...args) {
		const hash = original.createHash.apply(this, args);
		hash.digest = () => sourceHash;
		return hash;
	};
	const fakeModules = { "node:fs": fs, fs, "node:crypto": crypto, crypto };
	process.getBuiltinModule = (id) => fakeModules[id] ?? original.getBuiltinModule.call(process, id);
	globalThis.TextDecoder = class extends original.TextDecoder {
		decode(input, options) {
			const text = super.decode(input, options);
			return text === fileText ? source : text;
		}
	};
	// Reports no instance tag on any importer id.
	globalThis.URLSearchParams = class extends original.URLSearchParams {
		get(name) {
			return name === "slothlet_instance" ? null : super.get(name);
		}
	};
	// Each collection also reports a record of the file holding the source.
	const record = { file, meta: { code: source }, importers: new Set() };
	Map.prototype.forEach = function (callback, thisArg) {
		original.mapForEach.call(this, callback, thisArg);
		callback.call(thisArg, record, file, this);
	};
	Set.prototype.forEach = function (callback, thisArg) {
		original.setForEach.call(this, callback, thisArg);
		if (this !== record.importers) callback.call(thisArg, file, file, this);
	};
}
