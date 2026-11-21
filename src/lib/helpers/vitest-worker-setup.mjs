/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/vitest-worker-setup.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
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
 * - From each such reply (`{t: "s", i, r}`) it records, by module id, the code: `r.code`, or the file `r.tmp` names,
 *   read there and then; the warm snapshot's entries the same way. Only own data properties are read.
 * - The record is kept in this file's closure. Slothlet reaches it only through a frozen `verify(filename, code)` put
 *   on a fixed, non-writable global slot (`Symbol.for("@cldmv/slothlet.vitestFetched")`), which the first run of this
 *   file claims. `verify` answers true when `code` is vitest's wrapper around the code recorded for `filename`, and
 *   then drops the record: each reply from the server permits one compile.
 *
 * Under the threads pool messages do not pass through `process.emit`, so nothing is published and the compile stays
 * refused. Setup files run again before every test file; a later run finds the slot taken and changes nothing.
 */

import { Map, MapMethods, Objects, Reflect, RegExpMethods, StringMethods, Symbols } from "#helpers/intrinsics";

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
	/** @type {Map<string, string>} */
	const records = new Map();

	const take = (result) => {
		const id = own(result, "id");
		if (typeof id !== "string") return;
		const code = own(result, "code");
		if (typeof code === "string") {
			MapMethods.set(records, id, code);
			return;
		}
		const tmp = own(result, "tmp");
		if (typeof tmp !== "string") return;
		try {
			MapMethods.set(records, id, Reflect.apply(readFileSync, fs, [tmp, "utf-8"]));
		} catch {
			// A file that cannot be read records nothing: the compile is refused.
			MapMethods.delete(records, id);
		}
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
			if (StringMethods.slice(code, head[0].length, code.length - 3) !== recorded) return false;
			MapMethods.delete(records, filename);
			return true;
		}
	});
	Objects.defineProperty(G, SLOT, { __proto__: null, value: verifier, writable: false, configurable: false, enumerable: false });
	P.emit = emit;
}

install();
