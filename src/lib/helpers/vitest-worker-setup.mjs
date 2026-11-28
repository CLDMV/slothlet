/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/vitest-worker-setup.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:46-08:00 (1795869046)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The vitest worker setup file slothlet's vite plugin puts first in `setupFiles`: it records the code
 * vitest's server sends the worker for each module, so slothlet can tell vitest's own compile of a module file from
 * module code compiling a string under that file's name.
 * @module @cldmv/slothlet/helpers/vitest-worker-setup
 * @internal
 *
 * @description
 * Under vitest a module file is not compiled by Node's loader: the worker asks the vitest server for the file's
 * transformed code over the process's IPC channel and compiles it with `vm.runInThisContext`, wrapped as
 * `'use strict';async (<names>)=>{{<code>\n}}` and named after the module's id. With the permission system on, slothlet
 * refuses module code a `vm` compile (`capability:code`), and the file whose load runs that compile is a module's. This
 * file lets that one compile through, and nothing else.
 *
 * - It replaces `process.emit` in a forks worker. A message counts only when the frame directly below the replacement
 *   is Node's own `node:internal/child_process`, which is how a message the server sent arrives. A message module code
 *   emits itself, or one passed through code that replaced `process.emit` again, has another frame there and is not
 *   recorded.
 * - From each such reply (`{t: "s", i, r}`) it records, by module id, the code and its source map: `r.code` and
 *   `r.sourceMap`, or the file `r.tmp` names, read there and then; the warm snapshot's entries the same way. Only own
 *   data properties are read. Since vitest 5.1.1 that file holds the code with its source map after it
 *   (`<code>\n//# vitestSourceMap=<map>`, the last such marker), and the worker compiles only the code; a file with no
 *   marker (vitest 5.1.0 and earlier) is the code itself.
 * - The record is kept in this file's closure. Slothlet reaches it only through a frozen `verify(filename, code)` put
 *   on a fixed, non-writable global slot (`Symbol.for("@cldmv/slothlet.vitestFetched")`), which the first run of this
 *   file claims. `verify` answers true when `code` is vitest's wrapper around the code recorded for `filename` (or,
 *   while vitest inlines source maps for an attached debugger, around that code followed by exactly the recorded source
 *   map as an inline `sourceMappingURL` comment), and then drops the record: each reply from the server permits one
 *   compile.
 *
 * Under the threads pool messages do not pass through `process.emit`, so nothing is published and the compile stays
 * refused. Setup files run again before every test file; a later run finds the slot taken and changes nothing.
 */

import { Buffers, Map, MapMethods, Objects, Reflect, RegExpMethods, StringMethods, Symbols } from "#helpers/intrinsics";

/**
 * What vitest 5.1.1 puts between a module's code and its source map in the file a reply's `tmp` names.
 * @type {string}
 * @private
 */
const SOURCE_MAP_SEPARATOR = "\n//# vitestSourceMap=";

/**
 * What vitest puts before the base64 source map it appends to the code when it inlines the map.
 * @type {string}
 * @private
 */
const INLINE_SOURCE_MAP = "\n//# sourceMappingURL=data:application/json;base64,";

const SLOT = Symbols.for("@cldmv/slothlet.vitestFetched");
const G = globalThis;
const P = G.process;

/**
 * An own data property of a value, never through a getter or the prototype chain.
 * @param {*} value - The object.
 * @param {string} key - The property.
 * @returns {*} Its value, or undefined.
 * @private
 */
function own(value, key) {
	if (value === null || typeof value !== "object") return undefined;
	const descriptor = Objects.getOwnPropertyDescriptor(value, key);
	return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/**
 * Builds the reader of the frames below the caller of {@link install}'s `process.emit`, from a `vm` realm of this
 * file's own: its `Error` formats with a formatter fixed here, whatever the process's own `Error` holds.
 * @param {object} vm - `node:vm`.
 * @returns {function(): Array<string|null>|null} The reader (file names, innermost first), or null.
 * @private
 */
function stackReader(vm) {
	try {
		const realm = vm.createContext(Objects.create(null));
		return vm.runInContext(
			`"use strict";
			(() => {
				const E = Error;
				Object.defineProperty(E, "prepareStackTrace", {
					value: (error, sites) => {
						const names = [];
						for (let index = 0; index < sites.length; index++) names[index] = sites[index].getFileName() ?? null;
						return names;
					},
					writable: false,
					configurable: false
				});
				Object.defineProperty(E, "stackTraceLimit", { value: 4, writable: false, configurable: false });
				return () => new E().stack;
			})()`,
			realm
		);
	} catch {
		/* v8 ignore next -- a platform without vm contexts gets no reader, and nothing is recorded. */
		return null;
	}
}

/**
 * Install the record and publish the verifier, once per worker process.
 * @returns {void}
 * @private
 */
function install() {
	if (Objects.getOwnPropertyDescriptor(G, SLOT) !== undefined) return;
	const vm = typeof P?.getBuiltinModule === "function" ? P.getBuiltinModule("node:vm") : null;
	const fs = typeof P?.getBuiltinModule === "function" ? P.getBuiltinModule("node:fs") : null;
	const threads = typeof P?.getBuiltinModule === "function" ? P.getBuiltinModule("node:worker_threads") : null;
	// Only a forks worker: a child process with an IPC channel, on its main thread.
	if (!vm || !fs || typeof P.send !== "function" || typeof P.emit !== "function" || threads?.isMainThread !== true) return;
	const read = stackReader(vm);
	if (read === null) return;
	const readFileSync = fs.readFileSync;
	const realEmit = P.emit;
	const bufferToString = typeof G.Buffer?.prototype?.toString === "function" ? G.Buffer.prototype.toString : null;
	/** @type {Map<string, {code: string, map: string|null}>} */
	const records = new Map();

	const record = (id, code, map) => {
		MapMethods.set(records, id, { __proto__: null, code, map: typeof map === "string" && map !== "" ? map : null });
	};

	const take = (result) => {
		const id = own(result, "id");
		if (typeof id !== "string") return;
		const code = own(result, "code");
		if (typeof code === "string") {
			record(id, code, own(result, "sourceMap"));
			return;
		}
		const tmp = own(result, "tmp");
		if (typeof tmp !== "string") return;
		let content;
		try {
			content = Reflect.apply(readFileSync, fs, [tmp, "utf-8"]);
		} catch {
			// A file that cannot be read records nothing: the compile is refused.
			MapMethods.delete(records, id);
			return;
		}
		// The map is JSON without line breaks, so the last marker is the separator.
		const index = StringMethods.lastIndexOf(content, SOURCE_MAP_SEPARATOR);
		if (index === -1) record(id, content, null);
		else record(id, StringMethods.slice(content, 0, index), StringMethods.slice(content, index + SOURCE_MAP_SEPARATOR.length));
	};

	/**
	 * Whether `body` is the recorded code followed by exactly its recorded source map, inlined as vitest inlines it.
	 * @param {string} body - The code inside vitest's wrapper.
	 * @param {{code: string, map: string|null}} recorded - The record.
	 * @returns {boolean} True for that code.
	 */
	const inlined = (body, recorded) => {
		if (recorded.map === null || bufferToString === null) return false;
		if (!StringMethods.startsWith(body, recorded.code)) return false;
		const base64 = Reflect.apply(bufferToString, Buffers.from(recorded.map, "utf8"), ["base64"]);
		return StringMethods.slice(body, recorded.code.length) === `${INLINE_SOURCE_MAP}${base64}\n`;
	};

	const emit = function emit(event, message) {
		if (event === "message" && own(message, "t") === "s") {
			const frames = read();
			// [0] the reader, [1] this function, [2] whoever called it: Node's IPC channel for a message the server sent.
			if (frames && frames[2] === "node:internal/child_process") {
				const result = own(message, "r");
				if (typeof own(result, "id") === "string") take(result);
				// The warm snapshot: an object of fetch results, by url.
				else if (result !== null && typeof result === "object" && own(message, "e") === undefined) {
					const keys = Objects.keys(result);
					for (let index = 0; index < keys.length; index++) {
						const entry = own(result, keys[index]);
						if (own(entry, "cached") === true) take(entry);
					}
				}
			}
		}
		return Reflect.apply(realEmit, this, arguments);
	};

	const PREFIX = /^'use strict';async \((?:[A-Za-z_$][\w$]*(?:,[A-Za-z_$][\w$]*)*)?\)=>\{\{/;
	const verifier = Objects.freeze({
		__proto__: null,
		/**
		 * Whether `code` is vitest's wrapper around the code the server last sent for `filename`; a match uses the
		 * record up.
		 * @param {*} filename - The module id the compile is named after.
		 * @param {*} code - The code compiled.
		 * @returns {boolean} True for vitest's own compile of that reply.
		 */
		verify(filename, code) {
			if (typeof filename !== "string" || typeof code !== "string") return false;
			const head = RegExpMethods.exec(PREFIX, code);
			if (head === null || !StringMethods.endsWith(code, "\n}}")) return false;
			const recorded = MapMethods.get(records, filename);
			if (recorded === undefined) return false;
			const body = StringMethods.slice(code, head[0].length, code.length - 3);
			if (body !== recorded.code && !inlined(body, recorded)) return false;
			MapMethods.delete(records, filename);
			return true;
		}
	});
	Objects.defineProperty(G, SLOT, { __proto__: null, value: verifier, writable: false, configurable: false, enumerable: false });
	P.emit = emit;
}

install();
